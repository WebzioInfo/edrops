import { useState, useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { fetchWithAuth } from '../../../api/client';
import { toast } from 'react-hot-toast';
import {
  Send,
  MessageCircle,
  Phone,
  ArrowLeft,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useSocket } from '../../../contexts/SocketContext';
import LoadingSpinner from '../../../components/LoadingSpinner';

interface Message {
  id: string;
  ticketId: string;
  userId: string;
  message: string;
  isInternal: boolean;
  createdAt: string;
  user: {
    id: string;
    firstName?: string;
    lastName?: string;
    role: string;
  };
}

interface Ticket {
  id: string;
  subject: string;
  description: string;
  category?: string;
  status: 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'WAITING_FOR_CUSTOMER' | 'RESOLVED' | 'CLOSED';
  priority: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
}

const QUICK_INQUIRIES = [
  '🚚 When will my water jars arrive today?',
  '💧 How many prepaid jars do I have remaining?',
  '📦 I have empty jars ready for collection.',
  '💳 I need help with my payment or wallet recharge.'
];

export default function CustomerLiveChat() {
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [inputMessage, setInputMessage] = useState('');
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadChatSession = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await fetchWithAuth('/support/live-chat');
      setTicket(data);
      setTimeout(scrollToBottom, 100);
    } catch {
      if (!silent) toast.error('Failed to connect to live support chat');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadChatSession();
  }, []);

  // Real-time socket listener
  useEffect(() => {
    if (!socket || !isConnected) return;

    if (ticket?.id) {
      socket.emit('join-ticket', ticket.id);
    }

    const handleNewMessage = (payload: any) => {
      if (!payload) return;

      // Extract message entity properly whether it is wrapped ({ ticketId, message }) or raw
      const messageObj: Message | null =
        payload.message && typeof payload.message === 'object'
          ? payload.message
          : payload.id && typeof payload.message === 'string'
          ? payload
          : null;

      if (!messageObj || !messageObj.id || typeof messageObj.message !== 'string') {
        return; // Ignore malformed or non-message payloads
      }

      const ticketId = payload.ticketId || messageObj.ticketId;

      // Privacy safeguard: Never display internal staff notes to customer
      if (messageObj.isInternal) return;

      if (ticket && ticket.id === ticketId) {
        setTicket((prev) => {
          if (!prev) return null;
          const exists = prev.messages.some((m) => m.id === messageObj.id);
          if (exists) return prev;
          return {
            ...prev,
            messages: [...prev.messages, messageObj],
          };
        });
        setTimeout(scrollToBottom, 80);
      }
    };

    const handleMessageDeleted = (payload: any) => {
      const { ticketId, messageId } = payload;
      if (ticket && ticket.id === ticketId) {
        setTicket((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            messages: prev.messages.filter((m) => m.id !== messageId),
          };
        });
      }
    };

    const handleStatusChanged = (payload: any) => {
      const ticketId = payload.id || payload.ticketId;
      if (ticket && ticket.id === ticketId && payload.status) {
        setTicket((prev) => (prev ? { ...prev, status: payload.status } : null));
      }
    };

    socket.on('NEW_SUPPORT_MESSAGE', handleNewMessage);
    socket.on('SUPPORT_MESSAGE_DELETED', handleMessageDeleted);
    socket.on('TICKET_STATUS_CHANGED', handleStatusChanged);

    return () => {
      if (ticket?.id) {
        socket.emit('leave-ticket', ticket.id);
      }
      socket.off('NEW_SUPPORT_MESSAGE', handleNewMessage);
      socket.off('SUPPORT_MESSAGE_DELETED', handleMessageDeleted);
      socket.off('TICKET_STATUS_CHANGED', handleStatusChanged);
    };
  }, [socket, isConnected, ticket?.id]);

  // Reconnection recovery: resync message history if disconnected then reconnected
  useEffect(() => {
    if (isConnected && ticket?.id) {
      loadChatSession(true);
    }
  }, [isConnected]);

  const handleSendMessage = async (customText?: string) => {
    const textToSend = (customText || inputMessage).trim();
    if (!ticket || !textToSend || sending) return;

    setSending(true);
    try {
      const sent = await fetchWithAuth(`/support/tickets/${ticket.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          message: textToSend,
          isInternal: false,
        }),
      });

      setInputMessage('');

      if (sent) {
        setTicket((prev) => {
          if (!prev) return null;
          const exists = prev.messages.some((m) => m.id === sent.id);
          if (exists) return prev;
          return {
            ...prev,
            messages: [...prev.messages, sent],
          };
        });
        setTimeout(scrollToBottom, 60);
      }
    } catch {
      toast.error('Failed to deliver message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 flex flex-col items-center justify-center min-h-[500px]">
        <LoadingSpinner fullPage label="Connecting to eDrops Support Team..." />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
      {/* ─── LIVE CHAT CONTAINER ────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[calc(100vh-140px)] min-h-[560px] overflow-hidden">
        
        {/* ─── CHAT TOP HEADER ──────────────────────────────────────────── */}
        <div className="px-4 py-3.5 bg-gradient-to-r from-slate-900 to-[#16324F] text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <NavLink
              to="/customer/dashboard"
              className="p-1.5 -ml-1 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              title="Back to Dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </NavLink>

            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-[#1677C8] text-white flex items-center justify-center font-bold text-sm shadow-sm ring-2 ring-white/20">
                <MessageCircle className="w-5 h-5" />
              </div>
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-slate-900 rounded-full" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white leading-tight">eDrops Support Desk</h2>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/30 text-blue-200 border border-blue-400/30">
                  Live Staff
                </span>
              </div>
              <p className="text-[11px] text-slate-300 flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Staff Online • Immediate response
              </p>
            </div>
          </div>

          {/* Quick Support Phone and WhatsApp Buttons */}
          <div className="flex items-center gap-2">
            <a
              href="https://wa.me/917012046930"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              WhatsApp
            </a>
            <a
              href="tel:+917012046930"
              className="p-2 sm:px-3 sm:py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
            >
              <Phone className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Call Hotline</span>
            </a>
            <button
              onClick={() => loadChatSession(true)}
              className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              title="Refresh messages"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ─── MESSAGES SCROLL AREA ─────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-[#F8FAFC]">
          {/* Welcome greeting card */}
          <div className="max-w-md mx-auto bg-white border border-slate-200/80 rounded-2xl p-4 text-center shadow-2xs space-y-2">
            <div className="w-10 h-10 rounded-full bg-blue-50 text-[#1677C8] flex items-center justify-center mx-auto">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h4 className="text-xs font-bold text-slate-800">
              Welcome to eDrops Live Support, {user?.firstName || 'Valued Customer'}!
            </h4>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Our operations and delivery staff are here to assist you with jar orders, delivery cadences, empty jar returns, and billing questions.
            </p>
            <div className="pt-1 flex items-center justify-center gap-1.5 text-[10px] text-slate-400 font-medium">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              Real-time synchronization active
            </div>
          </div>

          {/* Ticket status banner */}
          {ticket?.status === 'RESOLVED' && (
            <div className="max-w-md mx-auto bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center text-xs text-emerald-800 shadow-2xs">
              <span className="font-semibold">This conversation was marked resolved.</span> You can send a message anytime to reopen it.
            </div>
          )}
          {ticket?.status === 'CLOSED' && (
            <div className="max-w-md mx-auto bg-slate-100 border border-slate-200 rounded-xl p-3 text-center text-xs text-slate-700 shadow-2xs">
              <span className="font-semibold">This support session has been closed.</span> Sending a new message will automatically reopen a live support request.
            </div>
          )}

          {/* Messages */}
          {ticket?.messages
            ?.filter((msg) => !msg.isInternal && !!msg.message && typeof msg.message === 'string' && msg.message.trim().length > 0)
            .map((msg, index) => {
              const isCustomer = msg.user?.role === 'CUSTOMER';
              const isMe = msg.userId === user?.id;
              const formattedTime =
                msg.createdAt && !isNaN(new Date(msg.createdAt).getTime())
                  ? new Date(msg.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'Just now';

              return (
                <div
                  key={msg.id || index}
                  className={`flex flex-col ${
                    isMe || isCustomer ? 'items-end' : 'items-start'
                  }`}
                >
                  {/* Sender badge & time */}
                  <div className="text-[10px] text-slate-400 mb-1 px-1 font-medium flex items-center gap-1.5">
                    <span className="font-semibold text-slate-600">
                      {isMe || isCustomer ? 'You' : `Staff (${msg.user?.firstName || 'Support'})`}
                    </span>
                    <span>•</span>
                    <span>{formattedTime}</span>
                  </div>

                {/* Message Bubble */}
                <div
                  className={`p-3.5 rounded-2xl text-xs max-w-[85%] sm:max-w-[70%] leading-relaxed shadow-2xs ${
                    isMe || isCustomer
                      ? 'bg-[#1677C8] text-white rounded-tr-xs'
                      : 'bg-white border border-slate-200 text-slate-800 rounded-tl-xs'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                </div>
              </div>
            );
          })}

          <div ref={messagesEndRef} />
        </div>

        {/* ─── QUICK INQUIRY CHIPS ─────────────────────────────────────── */}
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-200/80 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-[#1677C8]" /> Quick Ask:
          </span>
          {QUICK_INQUIRIES.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSendMessage(item)}
              className="px-3 py-1 bg-white hover:bg-blue-50 hover:text-[#1677C8] text-slate-700 border border-slate-200 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer shrink-0 shadow-2xs"
            >
              {item}
            </button>
          ))}
        </div>

        {/* ─── CHAT INPUT BAR ─────────────────────────────────────────── */}
        <div className="p-3 bg-white border-t border-slate-200 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message to support staff..."
              className="flex-1 px-4 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-[#1677C8] focus:ring-1 focus:ring-[#1677C8] rounded-xl text-xs text-slate-800 focus:outline-none transition-all"
            />

            <button
              type="submit"
              disabled={!inputMessage.trim() || sending}
              className="px-4 py-2.5 bg-[#1677C8] hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer shrink-0"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Send</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
