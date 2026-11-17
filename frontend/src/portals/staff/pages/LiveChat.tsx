import { useState, useEffect, useRef } from 'react';
import { fetchWithAuth } from '../../../api/client';
import { toast } from 'react-hot-toast';
import {
  Search,
  Send,
  Phone,
  MessageCircle,
  ExternalLink,
  Lock,
  RefreshCw,
  CheckCircle2,
  Clock,
  Sparkles,
  ChevronLeft
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useSocket } from '../../../contexts/SocketContext';

interface CustomerUser {
  id: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
}

interface Customer {
  id: string;
  user?: CustomerUser;
  address?: string;
}

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
  customerId: string;
  customer?: Customer;
  assignedTo?: { id: string; firstName?: string; lastName?: string };
  assignedToId?: string;
  messages?: Message[];
  _count?: { messages: number };
}

const QUICK_RESPONSES = [
  '🚚 Your water delivery has been dispatched and is on the way!',
  '💧 Your prepaid jar balance has been successfully credited.',
  '📦 Our driver will collect the empty jars during today\'s delivery run.',
  '🙏 Thank you for reaching out to eDrops support. Is there anything else we can assist you with?'
];

export default function StaffLiveChat() {
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'RESOLVED'>('ALL');

  const [replyMessage, setReplyMessage] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversations = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await fetchWithAuth('/staff/support/tickets');
      if (Array.isArray(data)) {
        setTickets(data);
      }
    } catch {
      if (!silent) toast.error('Failed to load conversations');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const loadTicketDetails = async (ticketId: string) => {
    try {
      const data = await fetchWithAuth(`/support/tickets/${ticketId}`);
      setSelectedTicket(data);
      setTimeout(scrollToBottom, 100);
    } catch {
      toast.error('Failed to load message history');
    }
  };

  useEffect(() => {
    loadConversations();
  }, []);

  // Real-time socket events
  useEffect(() => {
    if (!socket || !isConnected) return;

    if (selectedTicket) {
      socket.emit('join-ticket', selectedTicket.id);
    }

    const handleNewMessage = (payload: any) => {
      const message = payload.message || payload;
      const ticketId = payload.ticketId || message.ticketId;

      // Update current active chat
      if (selectedTicket && selectedTicket.id === ticketId) {
        setSelectedTicket((prev) => {
          if (!prev) return null;
          // Avoid duplicate messages
          const exists = prev.messages?.some((m) => m.id === message.id);
          if (exists) return prev;
          return {
            ...prev,
            messages: [...(prev.messages || []), message],
          };
        });
        setTimeout(scrollToBottom, 80);
      }

      // Update conversations list in real-time
      setTickets((prev) => {
        const index = prev.findIndex((t) => t.id === ticketId);
        if (index === -1) {
          // If not in list, reload silently
          loadConversations(true);
          return prev;
        }
        const updatedTicket = {
          ...prev[index],
          updatedAt: new Date().toISOString(),
          messages: [message],
        };
        const newList = [...prev];
        newList.splice(index, 1);
        newList.unshift(updatedTicket);
        return newList;
      });
    };

    const handleStatusChanged = (data: any) => {
      setTickets((prev) =>
        prev.map((t) => (t.id === data.id ? { ...t, status: data.status } : t))
      );
      if (selectedTicket?.id === data.id) {
        setSelectedTicket((prev) => (prev ? { ...prev, status: data.status } : null));
      }
    };

    socket.on('NEW_SUPPORT_MESSAGE', handleNewMessage);
    socket.on('TICKET_STATUS_CHANGED', handleStatusChanged);

    return () => {
      if (selectedTicket) {
        socket.emit('leave-ticket', selectedTicket.id);
      }
      socket.off('NEW_SUPPORT_MESSAGE', handleNewMessage);
      socket.off('TICKET_STATUS_CHANGED', handleStatusChanged);
    };
  }, [socket, isConnected, selectedTicket?.id]);

  const handleSelectTicket = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setMobileChatOpen(true);
    loadTicketDetails(ticket.id);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedTicket || !replyMessage.trim() || sending) return;

    const messageText = replyMessage.trim();
    setSending(true);

    try {
      const sentMessage = await fetchWithAuth(
        `/support/tickets/${selectedTicket.id}/messages`,
        {
          method: 'POST',
          body: JSON.stringify({
            message: messageText,
            isInternal,
          }),
        }
      );

      setReplyMessage('');
      setIsInternal(false);

      // Optimistic update if socket hasn't fired yet
      if (sentMessage) {
        setSelectedTicket((prev) => {
          if (!prev) return null;
          const exists = prev.messages?.some((m) => m.id === sentMessage.id);
          if (exists) return prev;
          return {
            ...prev,
            messages: [...(prev.messages || []), sentMessage],
          };
        });
        setTimeout(scrollToBottom, 60);
      }
    } catch {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleStatusChange = async (newStatus: Ticket['status']) => {
    if (!selectedTicket) return;
    try {
      await fetchWithAuth(`/staff/support/tickets/${selectedTicket.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      setSelectedTicket((prev) => (prev ? { ...prev, status: newStatus } : null));
      setTickets((prev) =>
        prev.map((t) => (t.id === selectedTicket.id ? { ...t, status: newStatus } : t))
      );
      toast.success(`Chat marked as ${newStatus}`);
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleAssignToMe = async () => {
    if (!selectedTicket || !user?.id) return;
    try {
      await fetchWithAuth(`/staff/support/tickets/${selectedTicket.id}/assign`, {
        method: 'PATCH',
        body: JSON.stringify({ staffId: user.id }),
      });
      setSelectedTicket((prev) =>
        prev
          ? {
              ...prev,
              assignedToId: user.id,
              assignedTo: { id: user.id, firstName: user.firstName, lastName: user.lastName },
            }
          : null
      );
      toast.success('Conversation assigned to you');
    } catch {
      toast.error('Failed to assign conversation');
    }
  };

  // Filter conversations
  const filteredTickets = tickets.filter((ticket) => {
    const custName = `${ticket.customer?.user?.firstName || ''} ${ticket.customer?.user?.lastName || ''}`.toLowerCase();
    const phone = (ticket.customer?.user?.phone || '').toLowerCase();
    const subject = (ticket.subject || '').toLowerCase();
    const matchesSearch =
      custName.includes(search.toLowerCase()) ||
      phone.includes(search.toLowerCase()) ||
      subject.includes(search.toLowerCase()) ||
      ticket.id.includes(search.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === 'OPEN') {
      return ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED';
    }
    if (statusFilter === 'RESOLVED') {
      return ticket.status === 'RESOLVED' || ticket.status === 'CLOSED';
    }
    return true;
  });

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] min-h-[550px] bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
      {/* ─── LIVE CHAT INTERFACE: 2-COLUMN WHATSAPP STYLE ─────────────────── */}
      <div className="flex h-full w-full relative overflow-hidden">
        
        {/* ─── LEFT PANEL: CUSTOMER CONVERSATIONS LIST ─────────────────────── */}
        <div
          className={`${
            mobileChatOpen ? 'hidden md:flex' : 'flex'
          } flex-col w-full md:w-[350px] lg:w-[380px] border-r border-slate-200/80 bg-slate-50/60 shrink-0 h-full`}
        >
          {/* List Header */}
          <div className="p-3.5 bg-white border-b border-slate-200/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#1677C8]/10 text-[#1677C8] flex items-center justify-center font-bold">
                  <MessageCircle className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 leading-tight">Customer Live Chat</h2>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                    <span className={`inline-block w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
                    {isConnected ? 'Real-Time Connected' : 'Connecting...'}
                  </div>
                </div>
              </div>
              <button
                onClick={() => loadConversations()}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                title="Refresh conversations"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by customer name, phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-100/80 focus:bg-white border border-transparent focus:border-[#1677C8] rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#1677C8] transition-all"
              />
            </div>

            {/* Status Filter Tabs */}
            <div className="flex gap-1 p-0.5 bg-slate-100/90 rounded-lg">
              {(['ALL', 'OPEN', 'RESOLVED'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={`flex-1 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
                    statusFilter === tab
                      ? 'bg-white text-[#1677C8] shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {tab === 'ALL' ? 'All Chats' : tab === 'OPEN' ? 'Active' : 'Resolved'}
                </button>
              ))}
            </div>
          </div>

          {/* Conversations Scroll Area */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100/80">
            {loading ? (
              <div className="p-8 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-[#1677C8]" />
                Loading conversations...
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No conversations found.
              </div>
            ) : (
              filteredTickets.map((ticket) => {
                const customerName = `${ticket.customer?.user?.firstName || ''} ${ticket.customer?.user?.lastName || ''}`.trim() || 'Customer';
                const phone = ticket.customer?.user?.phone || 'No phone';
                const isSelected = selectedTicket?.id === ticket.id;
                const lastMsg = ticket.messages?.[0]?.message || ticket.description || 'No messages yet';
                const isResolved = ticket.status === 'RESOLVED' || ticket.status === 'CLOSED';

                return (
                  <div
                    key={ticket.id}
                    onClick={() => handleSelectTicket(ticket)}
                    className={`p-3 transition cursor-pointer flex items-start gap-3 border-l-3 ${
                      isSelected
                        ? 'bg-blue-50/70 border-l-[#1677C8]'
                        : 'bg-white hover:bg-slate-100/60 border-l-transparent'
                    }`}
                  >
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#1677C8] to-[#2D79A8] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                      {customerName.charAt(0).toUpperCase()}
                    </div>

                    {/* Conversation preview */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {customerName}
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                          {new Date(ticket.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-500 font-mono truncate mb-1">
                        {phone}
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] text-slate-600 truncate flex-1 font-medium">
                          {lastMsg}
                        </p>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                            isResolved
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {ticket.status}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ─── RIGHT PANEL: ACTIVE CHAT THREAD & MESSAGING ─────────────────── */}
        <div
          className={`${
            mobileChatOpen ? 'flex' : 'hidden md:flex'
          } flex-1 flex-col h-full bg-[#F8FAFC] relative overflow-hidden`}
        >
          {selectedTicket ? (
            <>
              {/* Active Conversation Top Bar */}
              <div className="px-4 py-3 bg-white border-b border-slate-200/80 flex items-center justify-between gap-3 shrink-0 shadow-2xs z-10">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Mobile Back Button */}
                  <button
                    onClick={() => setMobileChatOpen(false)}
                    className="md:hidden p-1.5 -ml-1 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  <div className="w-9 h-9 rounded-full bg-[#1677C8] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                    {(selectedTicket.customer?.user?.firstName || 'C').charAt(0).toUpperCase()}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900 truncate">
                        {selectedTicket.customer?.user?.firstName} {selectedTicket.customer?.user?.lastName || ''}
                      </h3>
                      <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">
                        #{selectedTicket.id.slice(0, 8)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-mono">{selectedTicket.customer?.user?.phone || 'No phone'}</span>
                      {selectedTicket.customer?.address && (
                        <>
                          <span>•</span>
                          <span className="truncate max-w-[200px] text-[11px] text-slate-400">
                            {selectedTicket.customer.address}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Top Action Buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* WhatsApp Direct Link */}
                  {selectedTicket.customer?.user?.phone && (
                    <a
                      href={`https://wa.me/${selectedTicket.customer.user.phone.replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/80 rounded-lg text-xs font-semibold transition-colors"
                      title="Open in WhatsApp"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      WhatsApp
                    </a>
                  )}

                  {/* Phone Call Link */}
                  {selectedTicket.customer?.user?.phone && (
                    <a
                      href={`tel:${selectedTicket.customer.user.phone}`}
                      className="p-1.5 sm:px-2.5 sm:py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                      title="Direct Phone Call"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Call</span>
                    </a>
                  )}

                  {/* Status Toggle */}
                  <select
                    value={selectedTicket.status}
                    onChange={(e) => handleStatusChange(e.target.value as any)}
                    className="px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#1677C8] cursor-pointer"
                  >
                    <option value="OPEN">Open</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="WAITING_FOR_CUSTOMER">Action Needed</option>
                    <option value="RESOLVED">Resolved</option>
                    <option value="CLOSED">Closed</option>
                  </select>

                  {!selectedTicket.assignedToId && (
                    <button
                      onClick={handleAssignToMe}
                      className="hidden lg:inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#1677C8] text-white hover:bg-blue-600 rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                    >
                      Assign to me
                    </button>
                  )}
                </div>
              </div>

              {/* Chat Messages Scrolling Thread */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
                {/* Intro notice banner */}
                <div className="flex items-center justify-center my-2">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200/80 rounded-full text-[11px] font-medium text-slate-500 shadow-2xs">
                    <Clock className="w-3 h-3 text-[#1677C8]" />
                    <span>Live support session active • Connected with {selectedTicket.customer?.user?.firstName || 'Customer'}</span>
                  </div>
                </div>

                {/* Messages List */}
                {selectedTicket.messages?.map((msg, index) => {
                  const isStaff = msg.user?.role !== 'CUSTOMER';
                  const isMyMessage = msg.userId === user?.id;

                  if (msg.isInternal) {
                    return (
                      <div key={msg.id || index} className="flex justify-center my-2">
                        <div className="max-w-[85%] bg-amber-50 border border-amber-200/90 rounded-xl p-3 text-xs text-amber-900 shadow-2xs space-y-1">
                          <div className="flex items-center gap-1.5 font-bold text-[11px] text-amber-800">
                            <Lock className="w-3 h-3" />
                            Internal Staff Note • {msg.user?.firstName || 'Staff'} ({new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                          </div>
                          <p className="whitespace-pre-wrap">{msg.message}</p>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={msg.id || index}
                      className={`flex flex-col ${
                        isStaff ? 'items-end' : 'items-start'
                      }`}
                    >
                      {/* Name tag and timestamp */}
                      <div className="text-[10px] text-slate-400 mb-0.5 px-1 font-medium flex items-center gap-1.5">
                        <span className="font-semibold text-slate-600">
                          {isStaff ? (isMyMessage ? 'You (Staff)' : `${msg.user?.firstName || 'Staff'}`) : `${selectedTicket.customer?.user?.firstName || 'Customer'}`}
                        </span>
                        <span>•</span>
                        <span>
                          {new Date(msg.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      {/* Bubble */}
                      <div
                        className={`p-3 rounded-2xl text-xs max-w-[85%] sm:max-w-[70%] leading-relaxed shadow-2xs ${
                          isStaff
                            ? 'bg-[#1677C8] text-white rounded-tr-xs'
                            : 'bg-white border border-slate-200/90 text-slate-800 rounded-tl-xs'
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                      </div>
                    </div>
                  );
                })}

                <div ref={messagesEndRef} />
              </div>

              {/* Quick Response Chips */}
              <div className="px-4 py-2 bg-slate-50 border-t border-slate-200/80 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-[#1677C8]" /> Quick:
                </span>
                {QUICK_RESPONSES.map((quick, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setReplyMessage(quick)}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer shrink-0 shadow-2xs"
                  >
                    {quick.slice(0, 32)}...
                  </button>
                ))}
              </div>

              {/* Chat Input Box */}
              <div className="p-3 bg-white border-t border-slate-200/80 shrink-0">
                <form onSubmit={handleSendMessage} className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isInternal}
                        onChange={(e) => setIsInternal(e.target.checked)}
                        className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 w-3.5 h-3.5"
                      />
                      <span className="flex items-center gap-1">
                        <Lock className="w-3 h-3 text-amber-500" />
                        Internal Staff Note (Customer won't see this)
                      </span>
                    </label>

                    <span className="text-[10px] text-slate-400 hidden sm:inline">
                      Press <kbd className="px-1 py-0.5 bg-slate-100 rounded text-[9px]">Enter</kbd> to send, <kbd className="px-1 py-0.5 bg-slate-100 rounded text-[9px]">Shift+Enter</kbd> for new line
                    </span>
                  </div>

                  <div className="relative flex items-center gap-2">
                    <textarea
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={
                        isInternal
                          ? 'Write an internal note for staff members...'
                          : `Reply directly to ${selectedTicket.customer?.user?.firstName || 'customer'}...`
                      }
                      rows={2}
                      className={`w-full p-2.5 pr-12 rounded-xl text-xs border resize-none focus:outline-none transition-all ${
                        isInternal
                          ? 'bg-amber-50/50 border-amber-300 focus:ring-1 focus:ring-amber-500 text-amber-900 placeholder:text-amber-400'
                          : 'bg-slate-50 focus:bg-white border-slate-200 focus:border-[#1677C8] focus:ring-1 focus:ring-[#1677C8] text-slate-800'
                      }`}
                    />

                    <button
                      type="submit"
                      disabled={!replyMessage.trim() || sending}
                      className={`absolute right-2.5 bottom-2.5 p-2 rounded-lg text-white font-semibold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                        isInternal
                          ? 'bg-amber-600 hover:bg-amber-700'
                          : 'bg-[#1677C8] hover:bg-blue-600'
                      }`}
                      title="Send Message"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              </div>
            </>
          ) : (
            /* Empty State */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-[#1677C8] mb-3">
                <MessageCircle className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-700 mb-1">eDrops Staff Live Support Chat</h3>
              <p className="text-xs text-slate-500 max-w-sm mb-4">
                Select an active customer conversation from the left to start live messaging, answer inquiries, or provide delivery updates.
              </p>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-[#1677C8] rounded-xl text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                Real-Time Two-Way WebSocket Messaging Active
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
