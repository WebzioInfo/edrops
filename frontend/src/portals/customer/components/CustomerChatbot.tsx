import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Send,
  Truck,
  Wallet,
  Calendar,
  ShoppingBag,
  Phone,
  RefreshCw,
  ChevronRight,
  Bot,
  FileText
} from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';
import { useAuth } from '../../../contexts/AuthContext';
import { toast } from 'react-hot-toast';

interface ChatMessage {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  timestamp: Date;
  actions?: Array<{
    label: string;
    action: () => void;
    primary?: boolean;
  }>;
}

const QUICK_ACTIONS = [
  { id: 'track', label: '🚚 Track Delivery', icon: Truck },
  { id: 'balance', label: '💧 Jar & Wallet Balance', icon: Wallet },
  { id: 'schedule', label: '📅 My Schedule', icon: Calendar },
  { id: 'order', label: '🛒 Order Water', icon: ShoppingBag },
  { id: 'empties', label: '🔄 Empty Jar Rules', icon: RefreshCw },
  { id: 'ticket', label: '🎫 Support Ticket', icon: FileText },
  { id: 'whatsapp', label: '💬 WhatsApp Help', icon: Phone },
];

export default function CustomerChatbot() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [ticketMode, setTicketMode] = useState(false);
  const [ticketSubject, setTicketSubject] = useState('');

  // Cached user profile / account snapshot for live intelligence
  const [accountData, setAccountData] = useState<{
    profile: any;
    orders: any[];
    todayDelivery: any;
    loaded: boolean;
  }>({
    profile: null,
    orders: [],
    todayDelivery: null,
    loaded: false,
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const customerName = user?.firstName || (user as any)?.name?.split(' ')[0] || 'there';

  // Initial welcome message
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      sender: 'bot',
      text: `Hello ${customerName}! 👋 Welcome to eDrops Support. How can I help you today?`,
      timestamp: new Date(),
      actions: [
        {
          label: 'Track My Order',
          action: () => handleQuickAction('track'),
          primary: true,
        },
        {
          label: 'Check Balance',
          action: () => handleQuickAction('balance'),
        },
      ],
    },
  ]);

  // Load account context on initial chat open
  const loadAccountContext = async () => {
    try {
      const [profileRes, ordersRes, weeklyRes] = await Promise.allSettled([
        fetchWithAuth('/auth/me'),
        fetchWithAuth('/order'),
        fetchWithAuth('/delivery/weekly-summary'),
      ]);

      const profile = profileRes.status === 'fulfilled' ? profileRes.value : null;
      const orders = ordersRes.status === 'fulfilled' && Array.isArray(ordersRes.value) ? ordersRes.value : [];
      
      let todayDel = null;
      if (weeklyRes.status === 'fulfilled' && weeklyRes.value?.weeks) {
        const todayStr = new Date().toISOString().split('T')[0];
        for (const w of weeklyRes.value.weeks) {
          for (const d of w.deliveries || []) {
            if (d.scheduledFor && d.scheduledFor.startsWith(todayStr)) {
              todayDel = d;
              break;
            }
          }
          if (todayDel) break;
        }
      }

      setAccountData({
        profile,
        orders,
        todayDelivery: todayDel,
        loaded: true,
      });
    } catch {
      setAccountData((prev) => ({ ...prev, loaded: true }));
    }
  };

  useEffect(() => {
    if (isOpen && !accountData.loaded) {
      loadAccountContext();
    }
  }, [isOpen]);

  // Scroll chat to bottom on new message
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping, isOpen]);

  const addBotMessage = (text: string, actions?: ChatMessage['actions']) => {
    setIsTyping(true);
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-${Date.now()}-${Math.random()}`,
          sender: 'bot',
          text,
          timestamp: new Date(),
          actions,
        },
      ]);
      setIsTyping(false);
    }, 450);
  };

  const addUserMessage = (text: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        sender: 'user',
        text,
        timestamp: new Date(),
      },
    ]);
  };

  // Quick Action Handler
  const handleQuickAction = async (actionId: string) => {
    if (actionId === 'track') {
      addUserMessage('Track my delivery');
      handleTrackingQuery();
    } else if (actionId === 'balance') {
      addUserMessage('Check my jar and wallet balance');
      handleBalanceQuery();
    } else if (actionId === 'schedule') {
      addUserMessage('What is my delivery schedule?');
      handleScheduleQuery();
    } else if (actionId === 'order') {
      addUserMessage('I want to order water');
      addBotMessage('You can place an instant delivery order through our Shop, or order directly via WhatsApp.', [
        {
          label: 'Go to Shop 🛒',
          action: () => {
            setIsOpen(false);
            navigate('/customer/shop');
          },
          primary: true,
        },
        {
          label: 'Order on WhatsApp 💬',
          action: () => window.open('https://wa.me/917012046930?text=Hi%20eDrops,%20I%20would%20like%20to%20order%20water%20jars', '_blank'),
        },
      ]);
    } else if (actionId === 'empties') {
      addUserMessage('How does empty jar return work?');
      addBotMessage(
        '🔄 **Empty Jar Handover Policy:**\n\n• For every fresh 20L Biodrops jar delivered, please return 1 empty jar to the driver.\n• If you do not have an empty jar to return, a refundable jar deposit applies.\n• Your drivers record empty jar collections right at handover.',
        [
          {
            label: 'View Deliveries Calendar',
            action: () => {
              setIsOpen(false);
              navigate('/customer/deliveries');
            },
          },
        ]
      );
    } else if (actionId === 'ticket') {
      addUserMessage('I want to submit a support ticket');
      setTicketMode(true);
      addBotMessage(
        'Please describe your issue in detail below (e.g. "Late delivery today" or "Damaged jar"), and I will submit a formal ticket directly to our staff team.',
        [
          {
            label: 'Cancel Ticket',
            action: () => {
              setTicketMode(false);
              addBotMessage('Support ticket creation cancelled. How else may I assist you?');
            },
          },
        ]
      );
    } else if (actionId === 'whatsapp') {
      addUserMessage('Connect to WhatsApp Support');
      window.open('https://wa.me/917012046930?text=Hi%20eDrops%20Support,%20I%20need%20assistance%20with%20my%20account', '_blank');
      addBotMessage('I have opened our WhatsApp Support channel for you! Our customer care team is available 7 AM to 8 PM.');
    }
  };

  // Specific query builders
  const handleTrackingQuery = () => {
    const orders = accountData.orders;
    const todayDel = accountData.todayDelivery;

    const activeOrder = orders.find((o) =>
      ['PENDING', 'ORDER_PLACED', 'CONFIRMED', 'PROCESSING', 'OUT_FOR_DELIVERY', 'IN_TRANSIT'].includes(
        o.status?.toUpperCase()
      )
    );

    if (activeOrder) {
      const orderNum = activeOrder.orderNumber || activeOrder.id?.slice(0, 8);
      const pinText = activeOrder.deliveryVerificationPin
        ? `\n🔐 **Handover PIN:** ${activeOrder.deliveryVerificationPin}`
        : '';
      const statusText = activeOrder.status?.replace(/_/g, ' ');

      addBotMessage(
        `📦 **Active Order #${orderNum}**\n• Status: **${statusText}**\n• Items: ${activeOrder.orderItems?.length || 1} Jar(s)${pinText}\n\nOur driver will verify handover with you upon arrival.`,
        [
          {
            label: `View Order #${orderNum}`,
            action: () => {
              setIsOpen(false);
              navigate(`/customer/orders/${activeOrder.id}`);
            },
            primary: true,
          },
          {
            label: 'All Orders',
            action: () => {
              setIsOpen(false);
              navigate('/customer/orders');
            },
          },
        ]
      );
    } else if (todayDel) {
      const statusText = todayDel.status?.replace(/_/g, ' ');
      addBotMessage(
        `🚚 **Today's Scheduled Delivery:**\n• Quantity: **${todayDel.requiredQuantity} Jar(s)**\n• Status: **${statusText}**\n• Slot: 6:00 AM - 9:00 AM`,
        [
          {
            label: 'View Deliveries Calendar',
            action: () => {
              setIsOpen(false);
              navigate('/customer/deliveries');
            },
            primary: true,
          },
        ]
      );
    } else {
      addBotMessage(
        'You currently have no active orders in transit for today. Would you like to schedule a delivery or place an instant order?',
        [
          {
            label: 'Order Water Now 🛒',
            action: () => {
              setIsOpen(false);
              navigate('/customer/shop');
            },
            primary: true,
          },
          {
            label: 'Open Deliveries Calendar 📅',
            action: () => {
              setIsOpen(false);
              navigate('/customer/deliveries');
            },
          },
        ]
      );
    }
  };

  const handleBalanceQuery = () => {
    const cust = accountData.profile?.customer;
    const walletBalance = Number(cust?.wallet?.balance ?? 0);
    const availableJars = cust?.jarBalances?.[0]?.availableJars ?? cust?.jarBalance?.availableJars ?? 0;
    const jarsWithYou = cust?.jarDeposits?.[0]?.maxActiveJars ?? cust?.jarDeposit?.maxActiveJars ?? 0;

    addBotMessage(
      `💳 **Your Account Balance Summary:**\n\n• **Prepaid Jars:** ${availableJars} Jar(s) available\n• **Wallet Balance:** ₹${walletBalance.toFixed(2)}\n• **Active Jars with you:** ${jarsWithYou} Empty Jar(s)`,
      [
        {
          label: 'Recharge Wallet ➕',
          action: () => {
            setIsOpen(false);
            navigate('/customer/recharge');
          },
          primary: true,
        },
        {
          label: 'View Wallet History',
          action: () => {
            setIsOpen(false);
            navigate('/customer/wallet');
          },
        },
      ]
    );
  };

  const handleScheduleQuery = () => {
    const cust = accountData.profile?.customer;
    const rules = cust?.deliverySchedule?.rules || [];
    const isActive = cust?.deliverySchedule?.isActive ?? true;

    if (!isActive) {
      addBotMessage('⚠️ Your automatic recurring deliveries are currently **paused**.', [
        {
          label: 'Resume Schedule 📅',
          action: () => {
            setIsOpen(false);
            navigate('/customer/deliveries');
          },
          primary: true,
        },
      ]);
      return;
    }

    if (rules.length > 0) {
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const activeDays = rules
        .filter((r: any) => r.quantity > 0)
        .map((r: any) => `${dayNames[r.dayOfWeek]}: ${r.quantity} jar(s)`)
        .join(', ');

      addBotMessage(
        `📅 **Your Recurring Delivery Schedule:**\n• Active Days: ${activeDays || 'Everyday'}\n• Usual Timing: **6:00 AM – 9:00 AM**\n\nYou can easily modify jar quantities or pause deliveries from the Calendar tab.`,
        [
          {
            label: 'Edit Schedule / Calendar',
            action: () => {
              setIsOpen(false);
              navigate('/customer/deliveries');
            },
            primary: true,
          },
        ]
      );
    } else {
      addBotMessage('You do not have a recurring schedule set up yet. Would you like to configure your daily delivery calendar?', [
        {
          label: 'Setup Deliveries 📅',
          action: () => {
            setIsOpen(false);
            navigate('/customer/deliveries');
          },
          primary: true,
        },
      ]);
    }
  };

  // Support ticket submission from chat
  const submitSupportTicket = async (description: string) => {
    setIsTyping(true);
    try {
      const subject = description.length > 40 ? description.substring(0, 37) + '...' : description;
      const res = await fetchWithAuth('/support/tickets', {
        method: 'POST',
        body: JSON.stringify({
          subject: ticketSubject || subject || 'Customer Support Request',
          description,
          category: 'GENERAL',
          priority: 'MEDIUM',
        }),
      });

      const ticketRef = res?.id?.slice(0, 8)?.toUpperCase() || 'NEW';
      setTicketMode(false);
      setTicketSubject('');

      addBotMessage(
        `✅ **Support Ticket Created! (Ref: #${ticketRef})**\n\nOur operations team has received your ticket and will respond shortly. You can track replies in the Support section.`,
        [
          {
            label: 'View Support Tickets',
            action: () => {
              setIsOpen(false);
              navigate('/customer/support');
            },
            primary: true,
          },
        ]
      );
      toast.success('Ticket submitted successfully');
    } catch {
      setTicketMode(false);
      addBotMessage('Sorry, I could not submit the ticket automatically right now. Please reach out via WhatsApp or our Support page.', [
        {
          label: 'Open WhatsApp Help',
          action: () => window.open('https://wa.me/917012046930', '_blank'),
          primary: true,
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  // Smart Intent Matching
  const handleUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = inputMessage.trim();
    if (!query) return;

    addUserMessage(query);
    setInputMessage('');

    // If currently capturing a support ticket
    if (ticketMode) {
      submitSupportTicket(query);
      return;
    }

    const lower = query.toLowerCase();

    // Intent: Greeting
    if (/^(hi|hello|hey|good\s*(morning|evening|afternoon)|hola|namaste)/i.test(lower)) {
      addBotMessage(`Hello ${customerName}! How can I help you today? You can ask about your deliveries, jar balance, or place an order.`, [
        { label: 'Track Order', action: () => handleQuickAction('track') },
        { label: 'Check Balance', action: () => handleQuickAction('balance') },
      ]);
      return;
    }

    // Intent: Order / Delivery Tracking
    if (/(track|where.*order|where.*delivery|status|driver|pin|otp|when.*arrive|delivery.*time)/i.test(lower)) {
      handleTrackingQuery();
      return;
    }

    // Intent: Balance / Wallet / Jars
    if (/(balance|wallet|money|funds|how\s*many\s*jars|prepaid|recharge|cost|price)/i.test(lower)) {
      handleBalanceQuery();
      return;
    }

    // Intent: Schedule / Calendar / Days
    if (/(schedule|calendar|timing|days|recurring|cadence|pause|resume|skip|tomorrow)/i.test(lower)) {
      handleScheduleQuery();
      return;
    }

    // Intent: Order / Buy
    if (/(order|buy|purchase|water\s*jar|need\s*water|book|shop)/i.test(lower)) {
      handleQuickAction('order');
      return;
    }

    // Intent: Empty Jars / Returns
    if (/(empty|return|can|bottle|deposit|broken|leak)/i.test(lower)) {
      handleQuickAction('empties');
      return;
    }

    // Intent: Support Ticket / Human Help
    if (/(ticket|issue|complaint|problem|support|agent|help|call|contact|talk.*human|whatsapp)/i.test(lower)) {
      addBotMessage('I can help connect you with our team. What would you prefer?', [
        {
          label: 'Submit Ticket 🎫',
          action: () => handleQuickAction('ticket'),
          primary: true,
        },
        {
          label: 'Chat on WhatsApp 💬',
          action: () => handleQuickAction('whatsapp'),
        },
      ]);
      return;
    }

    // Default Fallback
    addBotMessage(
      `I'm here to help! I can look up your active deliveries, check your jar and wallet balance, explain jar return rules, or connect you with human support.`,
      [
        { label: 'Track Delivery 🚚', action: () => handleQuickAction('track') },
        { label: 'Check Balance 💧', action: () => handleQuickAction('balance') },
        { label: 'Support Ticket 🎫', action: () => handleQuickAction('ticket') },
      ]
    );
  };

  return (
    <>
      {/* ── 1. FLOATING ACTION TRIGGER BUTTON ── */}
      <div className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-50">
        <motion.button
          type="button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            setIsOpen(!isOpen);
            setHasUnread(false);
          }}
          className="relative flex items-center gap-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-[#16324F] to-[#2D79A8] text-white shadow-xl hover:shadow-2xl transition-all border border-white/20 cursor-pointer"
          aria-label="Open eDrops Support Assistant"
        >
          {isOpen ? (
            <X className="w-5 h-5 text-white" />
          ) : (
            <>
              <div className="relative">
                <Bot className="w-5 h-5 text-white" />
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-[#16324F]" />
              </div>
              <span className="text-xs font-bold tracking-wide hidden sm:inline">
                eDrops Help
              </span>
            </>
          )}

          {/* Unread Ping Badge */}
          {hasUnread && !isOpen && (
            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500" />
            </span>
          )}
        </motion.button>
      </div>

      {/* ── 2. INTERACTIVE CHAT PANEL ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 right-4 sm:bottom-20 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-[400px] h-[520px] max-h-[75vh] bg-white rounded-3xl shadow-2xl border border-slate-200/80 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="px-5 py-4 bg-gradient-to-r from-[#16324F] to-[#2D79A8] text-white flex items-center justify-between shrink-0 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center shrink-0 border border-white/10">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold leading-tight">eDrops Assistant</h3>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-emerald-400/20 text-emerald-300 text-[10px] font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Live
                    </span>
                  </div>
                  <p className="text-[11px] text-white/70">Instant answers, orders & support</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-white/80 hover:text-white transition-colors cursor-pointer"
                aria-label="Close Assistant"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Action Chips Bar */}
            <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
              {QUICK_ACTIONS.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => handleQuickAction(action.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-slate-200/80 text-[11px] font-semibold text-slate-700 hover:bg-[#EBF5FB] hover:text-[#2D79A8] hover:border-blue-200 transition-all shrink-0 cursor-pointer shadow-3xs"
                  >
                    <Icon className="w-3 h-3 text-[#2D79A8]" />
                    <span>{action.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-[#F8FAFC]">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-[#2D79A8] text-white rounded-br-xs shadow-xs'
                        : 'bg-white text-slate-800 rounded-bl-xs border border-slate-200/70 shadow-xs'
                    }`}
                  >
                    {/* Message Text with bold/list rendering */}
                    <div className="whitespace-pre-line">
                      {msg.text.split('\n').map((line, i) => {
                        // Simple inline bold formatting parser
                        const parts = line.split(/(\*\*.*?\*\*)/g);
                        return (
                          <div key={i} className={line.startsWith('•') ? 'ml-1' : ''}>
                            {parts.map((part, j) => {
                              if (part.startsWith('**') && part.endsWith('**')) {
                                return (
                                  <strong key={j} className="font-bold">
                                    {part.slice(2, -2)}
                                  </strong>
                                );
                              }
                              return part;
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Optional Interactive Action Buttons */}
                  {msg.actions && msg.actions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {msg.actions.map((act, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={act.action}
                          className={`inline-flex items-center gap-1 text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer shadow-3xs ${
                            act.primary
                              ? 'bg-[#2D79A8] text-white hover:bg-[#16324F]'
                              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <span>{act.label}</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      ))}
                    </div>
                  )}

                  <span className="text-[9px] text-slate-400 mt-1 px-1">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}

              {/* Typing Indicator */}
              {isTyping && (
                <div className="flex items-center gap-1.5 bg-white border border-slate-200/80 px-3 py-2 rounded-2xl rounded-bl-xs w-20 shadow-xs">
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <form
              onSubmit={handleUserSubmit}
              className="p-2.5 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0"
            >
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder={
                  ticketMode
                    ? 'Describe your issue for the ticket...'
                    : 'Ask about delivery, jars, balance...'
                }
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2D79A8] focus:bg-white transition-all"
              />
              <button
                type="submit"
                disabled={!inputMessage.trim()}
                className="w-8 h-8 rounded-xl bg-[#2D79A8] disabled:bg-slate-200 text-white flex items-center justify-center transition-all cursor-pointer disabled:cursor-not-allowed shrink-0"
                aria-label="Send Message"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
