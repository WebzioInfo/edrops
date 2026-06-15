import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HelpCircle, Send, MessageSquare, Search, Box, AlertCircle, Clock,
  CreditCard, PackageX, Calendar, HeadphonesIcon, FileText, FileImage,
  MessageCircle, PhoneCall, Mail, ChevronDown, RefreshCcw, ArrowLeft
} from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';
import { toast } from 'react-hot-toast';
import { useSocket } from '../../../contexts/SocketContext';

interface Ticket {
  id: string;
  subject: string;
  description: string;
  category?: string;
  imageUrl?: string;
  invoiceUrl?: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'WAITING_FOR_CUSTOMER' | 'RESOLVED' | 'CLOSED';
  priority: string;
  createdAt: string;
  updatedAt: string;
  messages?: any[];
}

export default function SupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { socket, isConnected } = useSocket();

  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [priority] = useState('MEDIUM');
  const [imageName, setImageName] = useState('');
  const [invoiceName, setInvoiceName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [openFaqId, setOpenFaqId] = useState<string | null>(null);

  useEffect(() => {
    async function loadTickets() {
      try {
        const data = await fetchWithAuth('/support/tickets');
        setTickets(data || []);
      } catch {
        setTickets([]);
      } finally {
        setLoading(false);
      }
    }
    loadTickets();
  }, []);

  useEffect(() => {
    if (isConnected && socket) {
      socket.on('TICKET_UPDATE', (updatedTicket: Ticket) => {
        setTickets(prev => prev.map(t => t.id === updatedTicket.id ? updatedTicket : t));
        if (selectedTicket?.id === updatedTicket.id) {
          fetchTicketDetails(updatedTicket.id);
        }
        toast('Support ticket updated', { icon: '🔔' });
      });
      return () => {
        socket.off('TICKET_UPDATE');
      };
    }
  }, [isConnected, socket, selectedTicket]);

  const fetchTicketDetails = async (id: string) => {
    try {
      const data = await fetchWithAuth(`/support/tickets/${id}`);
      setSelectedTicket(data);
    } catch (err) {
      toast.error('Failed to load ticket details');
    }
  };

  const handleSelectTicket = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    fetchTicketDetails(ticket.id);
  };

  const [replyMessage, setReplyMessage] = useState('');
  const [replying, setReplying] = useState(false);

  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyMessage.trim()) return;

    setReplying(true);
    try {
      await fetchWithAuth(`/support/tickets/${selectedTicket.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          message: replyMessage,
          isInternal: false
        })
      });
      setReplyMessage('');
      fetchTicketDetails(selectedTicket.id);
      toast.success('Reply sent');
    } catch (err) {
      toast.error('Failed to send reply');
    } finally {
      setReplying(false);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim() || !category.trim()) {
      toast.error('Please fill in subject, description, and category.');
      return;
    }
    setSubmitting(true);
    try {
      const mockImageUrl = imageName ? `https://fake-img-storage.com/${imageName}` : undefined;
      const mockInvoiceUrl = invoiceName ? `https://fake-invoice-storage.com/${invoiceName}` : undefined;

      const newTicket = await fetchWithAuth('/support/tickets', {
        method: 'POST',
        body: JSON.stringify({ 
          subject, 
          description, 
          category,
          priority,
          imageUrl: mockImageUrl,
          invoiceUrl: mockInvoiceUrl
        }),
      });
      
      setTickets([newTicket, ...tickets]);
      setSubject('');
      setDescription('');
      setCategory('');
      setImageName('');
      setInvoiceName('');
      toast.success('Ticket created successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create ticket');
    } finally {
      setSubmitting(false);
    }
  };

  const quickActions = [
    { id: 'Missing Delivery', icon: PackageX, color: 'text-rose-500', bg: 'bg-rose-50' },
    { id: 'Delivery Delay', icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50' },
    { id: 'Billing Issue', icon: CreditCard, color: 'text-blue-500', bg: 'bg-blue-50' },
    { id: 'Quality Issue', icon: AlertCircle, color: 'text-purple-500', bg: 'bg-purple-50' },
    { id: 'Empty Jar Pickup', icon: Box, color: 'text-emerald-500', bg: 'bg-emerald-50' },
    { id: 'Refund Request', icon: RefreshCcw, color: 'text-indigo-500', bg: 'bg-indigo-50' },
    { id: 'Schedule Change', icon: Calendar, color: 'text-teal-500', bg: 'bg-teal-50' },
    { id: 'Contact Support', icon: HeadphonesIcon, color: 'text-slate-500', bg: 'bg-slate-50' },
  ];

  const faqs = [
    { id: 'faq1', q: 'How do I track my delivery in real-time?', a: 'You can track your delivery directly from the Orders page. Once a driver is assigned, a live tracking map will become available.', category: 'Delivery Issues' },
    { id: 'faq2', q: 'When will I receive my refund?', a: 'Refunds are typically processed within 5-7 business days depending on your payment method and bank.', category: 'Refunds' },
    { id: 'faq3', q: 'Can I change my subscription schedule?', a: 'Yes, you can easily modify your subscription schedule from your Dashboard. Changes take effect on your next billing cycle.', category: 'Subscriptions' },
    { id: 'faq4', q: 'How does the empty jar return work?', a: 'Simply hand over your empty jars to our delivery executive during your next scheduled drop-off. The security deposit will automatically be waived.', category: 'Products' },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN': return <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold whitespace-nowrap">Open</span>;
      case 'IN_PROGRESS': return <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold whitespace-nowrap">In Progress</span>;
      case 'WAITING_FOR_CUSTOMER': return <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold whitespace-nowrap">Action Needed</span>;
      case 'RESOLVED': return <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold whitespace-nowrap">Resolved</span>;
      case 'CLOSED': return <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold whitespace-nowrap">Closed</span>;
      default: return <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold whitespace-nowrap">{status}</span>;
    }
  };

  const getTimelineStep = (ticket: Ticket) => {
    let currentStep = 0;
    if (['IN_PROGRESS', 'WAITING_FOR_CUSTOMER'].includes(ticket.status)) currentStep = 2;
    if (ticket.status === 'RESOLVED') currentStep = 3;
    if (ticket.status === 'CLOSED') currentStep = 4;
    return currentStep;
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-[#F8FAFC]">
        <div className="w-12 h-12 rounded-full border-4 border-slate-200 border-t-[#1E88E5] animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-[#F8FAFC] min-h-screen pb-28 sm:pb-32 font-sans text-slate-800 w-full overflow-x-hidden">
      
      {/* 1. Top Hero Section */}
      <div className="bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A] pt-8 pb-20 sm:pt-12 sm:pb-28 px-4 sm:px-6 relative w-full flex flex-col items-center">
        <div className="max-w-3xl w-full text-center relative z-10">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-center mb-4 sm:mb-6">
            <div className="h-14 w-14 sm:h-16 sm:w-16 bg-white/10 backdrop-blur-md rounded-[16px] sm:rounded-[20px] flex items-center justify-center border border-white/10 shadow-lg">
              <HeadphonesIcon className="h-7 w-7 sm:h-8 sm:w-8 text-white" />
            </div>
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-2xl sm:text-4xl font-black text-white tracking-tight mb-2 sm:mb-3">
            How can we help?
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="text-sm sm:text-base text-slate-300 font-medium mb-6 sm:mb-8 max-w-xl mx-auto px-2">
            Search our knowledge base or open a ticket for fast support.
          </motion.p>
          
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="max-w-xl mx-auto relative group w-full">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-11 pr-4 py-3.5 sm:py-4 border-0 rounded-xl sm:rounded-2xl text-slate-900 bg-white shadow-xl focus:ring-2 focus:ring-[#1E88E5]/50 text-sm sm:text-base font-medium transition-all"
              placeholder="Search articles, issues..."
            />
          </motion.div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 -mt-12 sm:-mt-16 relative z-20 space-y-6 sm:space-y-8 w-full">
        
        {/* 2. Quick Action Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 w-full">
          {quickActions.map((action, idx) => (
            <motion.button
              key={action.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + (idx * 0.05) }}
              onClick={() => {
                setCategory(action.id);
                setSubject(action.id);
                document.getElementById('create-ticket-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className="bg-white p-3 sm:p-5 rounded-[16px] sm:rounded-[20px] border border-slate-100 shadow-sm hover:shadow-md transition-shadow flex flex-col items-center justify-center gap-2 sm:gap-3 text-center cursor-pointer w-full"
            >
              <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full ${action.bg} flex items-center justify-center shrink-0`}>
                <action.icon className={`w-5 h-5 sm:w-6 sm:h-6 ${action.color}`} />
              </div>
              <span className="text-[12px] sm:text-sm font-bold text-slate-800 leading-tight">{action.id}</span>
            </motion.button>
          ))}
        </div>

        {/* 3. Split Layout (Vertical on Mobile, Grid on Desktop) */}
        <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6 sm:gap-8 w-full items-start">
          
          {/* LEFT SIDE: Tickets (Order 1 on mobile) */}
          <div className="order-1 lg:col-span-7 lg:col-start-1 lg:row-start-1 w-full">
            {/* Tickets Viewer / List */}
            <div className="bg-white rounded-[20px] sm:rounded-[24px] p-4 sm:p-6 border border-slate-100 shadow-md w-full">
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <h2 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6 text-[#1E88E5]" />
                  Your Tickets
                </h2>
                {selectedTicket && (
                  <button 
                    onClick={() => setSelectedTicket(null)}
                    className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-full"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Back
                  </button>
                )}
              </div>

              <AnimatePresence mode="wait">
                {selectedTicket ? (
                  <motion.div
                    key="detail"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-6 w-full"
                  >
                    {/* Ticket Header */}
                    <div className="bg-[#F8FAFC] p-4 sm:p-5 rounded-[16px] border border-slate-100 w-full">
                      <div className="flex flex-wrap justify-between items-start gap-2 mb-3">
                        <div className="flex-1 min-w-0 pr-2">
                          <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase mb-0.5 truncate">Ticket #{selectedTicket.id.split('-')[0]}</p>
                          <h3 className="text-sm sm:text-base font-black text-slate-900 break-words leading-tight">{selectedTicket.subject}</h3>
                        </div>
                        <div className="shrink-0">
                          {getStatusBadge(selectedTicket.status)}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] sm:text-xs font-semibold text-slate-500 mb-4">
                        <span className="flex items-center gap-1 shrink-0"><Calendar className="w-3.5 h-3.5" /> {new Date(selectedTicket.createdAt).toLocaleDateString()}</span>
                        <span className="flex items-center gap-1 truncate"><Box className="w-3.5 h-3.5" /> {selectedTicket.category || 'General'}</span>
                      </div>
                      <div className="pt-4 border-t border-slate-200">
                        <p className="text-slate-700 text-xs sm:text-sm font-medium whitespace-pre-wrap break-words">{selectedTicket.description}</p>
                      </div>
                    </div>

                    {/* Timeline Component */}
                    <div className="w-full">
                      <h4 className="text-sm sm:text-base font-bold text-slate-900 mb-4">Timeline</h4>
                      <div className="relative pl-5 sm:pl-6 space-y-6 before:absolute before:inset-0 before:ml-[9px] sm:before:ml-[11px] before:h-full before:w-[2px] before:bg-slate-200">
                        
                        {['Created', 'Assigned', 'In Progress', 'Resolved', 'Closed'].map((stepTitle, idx) => {
                          const isActive = getTimelineStep(selectedTicket) >= idx;
                          const isCurrent = getTimelineStep(selectedTicket) === idx;
                          return (
                            <div key={idx} className="relative flex items-center w-full">
                              <div className={`flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-full border-4 border-white ${isActive ? 'bg-[#1E88E5]' : 'bg-slate-200'} absolute left-0 -translate-x-1/2 shrink-0 z-10 transition-colors`} />
                              
                              <div className="ml-4 sm:ml-5 w-full bg-white p-3 sm:p-4 rounded-[12px] sm:rounded-[14px] border border-slate-100 shadow-sm flex flex-col justify-center">
                                <h5 className={`font-bold text-xs sm:text-sm ${isActive ? 'text-slate-900' : 'text-slate-400'}`}>{stepTitle}</h5>
                                {isCurrent && idx === 1 && <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5">Agent reviewing ticket.</p>}
                                {isCurrent && idx === 2 && <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5">Working on solution.</p>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Messages / Chat UI */}
                    <div className="w-full mt-6">
                      <h4 className="text-sm sm:text-base font-bold text-slate-900 mb-4">Conversation</h4>
                      <div className="flex flex-col gap-4 mb-4">
                        {selectedTicket.messages?.map((msg, idx) => (
                          <div key={idx} className={`flex flex-col ${msg.user.role === 'CUSTOMER' ? 'items-end' : 'items-start'}`}>
                            <div className="text-[10px] text-slate-500 mb-1">{msg.user.firstName} {msg.user.lastName} • {new Date(msg.createdAt).toLocaleTimeString()}</div>
                            <div className={`p-3 rounded-[14px] text-sm max-w-[85%] ${msg.user.role === 'CUSTOMER' ? 'bg-[#1E88E5] text-white rounded-br-none' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none shadow-sm'}`}>
                              <p className="whitespace-pre-wrap">{msg.message}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {['RESOLVED', 'CLOSED'].includes(selectedTicket.status) ? (
                        <div className="bg-slate-50 border border-slate-100 rounded-[14px] p-4 text-center">
                          <p className="text-sm text-slate-500 font-medium">This ticket is closed. You can no longer reply.</p>
                        </div>
                      ) : (
                        <form onSubmit={handleReplySubmit} className="flex flex-col gap-2 relative">
                          <textarea
                            value={replyMessage}
                            onChange={e => setReplyMessage(e.target.value)}
                            placeholder="Type a reply..."
                            rows={3}
                            className="w-full rounded-[14px] border border-slate-200 bg-white p-3 pr-12 text-sm focus:border-[#1E88E5] focus:ring-1 focus:ring-[#1E88E5] resize-none shadow-sm"
                            required
                          />
                          <button
                            type="submit"
                            disabled={replying}
                            className="absolute bottom-3 right-3 p-2 bg-[#1E88E5] text-white rounded-full hover:bg-blue-600 disabled:opacity-50 transition-all"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        </form>
                      )}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="list"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col gap-3 w-full"
                  >
                    {tickets.length === 0 ? (
                      <div className="text-center py-8">
                        <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                          <MessageSquare className="w-5 h-5 text-slate-300" />
                        </div>
                        <h3 className="text-sm font-bold text-slate-900">No tickets found</h3>
                      </div>
                    ) : (
                      tickets.map((ticket) => (
                        <div 
                          key={ticket.id} 
                          onClick={() => handleSelectTicket(ticket)}
                          className="bg-white border border-slate-100 p-3.5 sm:p-4 rounded-[16px] hover:border-[#1E88E5]/30 hover:shadow-md transition-all cursor-pointer flex flex-col w-full"
                        >
                          <div className="flex justify-between items-start gap-2 mb-2 w-full">
                            <div className="flex flex-col flex-1 min-w-0 pr-2">
                               <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                 {getStatusBadge(ticket.status)}
                                 <span className="text-[10px] font-bold text-slate-400 uppercase">#{ticket.id.split('-')[0]}</span>
                               </div>
                               <h4 className="text-sm sm:text-base font-bold text-slate-900 truncate w-full">{ticket.subject}</h4>
                            </div>
                          </div>
                          <div className="flex items-center justify-between mt-2 w-full">
                            <span className="text-[11px] sm:text-xs font-semibold text-slate-400">{new Date(ticket.createdAt).toLocaleDateString()}</span>
                            <span className="text-[10px] sm:text-xs font-bold text-[#1E88E5] bg-[#EBF5FB] px-2.5 py-1 rounded-full whitespace-nowrap">
                              Details
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* RIGHT SIDE (Order 2 on mobile): Create Form & Shortcuts */}
          <div className="order-2 lg:col-span-5 lg:col-start-8 lg:row-start-1 lg:row-span-2 w-full flex flex-col gap-6 sm:gap-8 lg:sticky lg:top-24 pb-8 lg:pb-0" id="create-ticket-form">
            
            {/* Create Ticket Form */}
            <div className="bg-white rounded-[20px] sm:rounded-[24px] p-4 sm:p-6 border border-slate-100 shadow-md w-full">
              <h2 className="text-lg sm:text-xl font-black text-slate-900 mb-1.5">Create Ticket</h2>
              <p className="text-slate-500 font-medium text-xs sm:text-sm mb-5">Fill out the form below for fast support.</p>

              <form onSubmit={handleCreateTicket} className="flex flex-col gap-4 w-full">
                
                {/* Floating Label Select: Category */}
                <div className="relative w-full">
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className={`block w-full px-3.5 pb-2 pt-5 rounded-[12px] sm:rounded-[14px] border border-slate-200 bg-[#F8FAFC] focus:bg-white focus:border-[#1E88E5] focus:ring-1 focus:ring-[#1E88E5] appearance-none text-slate-900 font-semibold text-xs sm:text-sm cursor-pointer ${!category ? 'text-transparent' : ''}`}
                    required
                  >
                    <option value="" disabled className="text-slate-900">Select Category</option>
                    <option value="Missing Delivery" className="text-slate-900">Missing Delivery</option>
                    <option value="Billing Issue" className="text-slate-900">Billing & Payments</option>
                    <option value="Product Quality" className="text-slate-900">Product Quality</option>
                    <option value="Refund Request" className="text-slate-900">Refund Request</option>
                    <option value="Other" className="text-slate-900">Other Issue</option>
                  </select>
                  <label className={`absolute left-3.5 top-3.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-wide transition-all ${category ? 'text-[#1E88E5]' : 'text-slate-400'}`}>
                    Category *
                  </label>
                  <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>

                {/* Floating Label Input: Subject */}
                <div className="relative w-full">
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder=" "
                    className="block w-full px-3.5 pb-2 pt-5 rounded-[12px] sm:rounded-[14px] border border-slate-200 bg-[#F8FAFC] focus:bg-white focus:border-[#1E88E5] focus:ring-1 focus:ring-[#1E88E5] text-slate-900 font-semibold text-xs sm:text-sm peer transition-all"
                    required
                  />
                  <label className="absolute left-3.5 top-3.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-wide text-slate-400 transition-all peer-focus:text-[#1E88E5] peer-focus:top-3.5 peer-placeholder-shown:top-[14px] peer-placeholder-shown:text-[13px] peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal peer-placeholder-shown:font-medium pointer-events-none">
                    Subject *
                  </label>
                </div>

                {/* Floating Label Textarea: Description */}
                <div className="relative w-full">
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder=" "
                    rows={3}
                    className="block w-full px-3.5 pb-2 pt-5 rounded-[12px] sm:rounded-[14px] border border-slate-200 bg-[#F8FAFC] focus:bg-white focus:border-[#1E88E5] focus:ring-1 focus:ring-[#1E88E5] text-slate-900 font-semibold text-xs sm:text-sm peer transition-all resize-none"
                    required
                  />
                  <label className="absolute left-3.5 top-3.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-wide text-slate-400 transition-all peer-focus:text-[#1E88E5] peer-focus:top-3.5 peer-placeholder-shown:top-4 peer-placeholder-shown:text-[13px] peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal peer-placeholder-shown:font-medium pointer-events-none">
                    Description *
                  </label>
                </div>

                {/* File Uploads */}
                <div className="flex flex-col sm:flex-row gap-3 w-full">
                  <div className="relative flex-1 overflow-hidden rounded-[12px] border border-dashed border-slate-300 bg-[#F8FAFC] p-3 flex items-center gap-3 cursor-pointer">
                    <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => setImageName(e.target.files?.[0]?.name || '')} accept="image/*" />
                    <FileImage className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="text-[11px] sm:text-xs font-bold text-slate-600 truncate">{imageName || 'Add Image'}</span>
                  </div>
                  <div className="relative flex-1 overflow-hidden rounded-[12px] border border-dashed border-slate-300 bg-[#F8FAFC] p-3 flex items-center gap-3 cursor-pointer">
                    <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => setInvoiceName(e.target.files?.[0]?.name || '')} accept=".pdf,.png,.jpg" />
                    <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="text-[11px] sm:text-xs font-bold text-slate-600 truncate">{invoiceName || 'Add Invoice'}</span>
                  </div>
                </div>

                {/* Sticky Mobile Submit Button / Standard Desktop */}
                <div className="fixed bottom-16 sm:bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-100 sm:border-0 sm:bg-transparent sm:static sm:p-0 z-40 lg:z-auto lg:mt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full h-12 sm:h-[52px] rounded-[12px] sm:rounded-[14px] bg-[#1E88E5] text-white font-black text-sm sm:text-[15px] shadow-[0_4px_14px_-4px_rgba(30,136,229,0.5)] active:scale-[0.98] disabled:opacity-70 transition-all flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>Submit Ticket <Send className="w-4 h-4 ml-1" /></>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Support Shortcuts */}
            <div className="bg-white rounded-[20px] sm:rounded-[24px] p-4 sm:p-6 border border-slate-100 shadow-md w-full">
              <h3 className="text-sm sm:text-base font-black text-slate-900 mb-3 sm:mb-4">Instant Support</h3>
              <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full">
                <button className="flex flex-col items-center justify-center py-3 px-1 bg-emerald-50 rounded-[12px] sm:rounded-[16px] cursor-pointer">
                  <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-500 mb-1.5" />
                  <span className="text-[10px] sm:text-[11px] font-bold text-slate-700">WhatsApp</span>
                </button>
                <button className="flex flex-col items-center justify-center py-3 px-1 bg-blue-50 rounded-[12px] sm:rounded-[16px] cursor-pointer">
                  <PhoneCall className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500 mb-1.5" />
                  <span className="text-[10px] sm:text-[11px] font-bold text-slate-700">Call Us</span>
                </button>
                <button className="flex flex-col items-center justify-center py-3 px-1 bg-amber-50 rounded-[12px] sm:rounded-[16px] cursor-pointer">
                  <Mail className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500 mb-1.5" />
                  <span className="text-[10px] sm:text-[11px] font-bold text-slate-700">Email</span>
                </button>
              </div>
            </div>

          </div>

          {/* LEFT SIDE BOTTOM: Knowledge Base (Order 3 on mobile) */}
          <div className="order-3 lg:col-span-7 lg:col-start-1 lg:row-start-2 w-full">
            <div className="bg-white rounded-[20px] sm:rounded-[24px] p-4 sm:p-6 border border-slate-100 shadow-md w-full">
              <h2 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2 mb-4 sm:mb-6">
                <HelpCircle className="w-5 h-5 sm:w-6 sm:h-6 text-[#1E88E5]" />
                FAQs
              </h2>
              <div className="flex flex-col gap-2.5 w-full">
                {faqs.map(faq => (
                  <div key={faq.id} className="border border-slate-100 rounded-[16px] overflow-hidden w-full">
                    <button 
                      onClick={() => setOpenFaqId(openFaqId === faq.id ? null : faq.id)}
                      className="w-full px-4 sm:px-5 py-3.5 sm:py-4 flex items-center justify-between bg-white cursor-pointer"
                    >
                      <span className="font-bold text-slate-800 text-xs sm:text-sm text-left pr-3">{faq.q}</span>
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${openFaqId === faq.id ? 'rotate-180' : ''}`} />
                    </button>
                    <AnimatePresence>
                      {openFaqId === faq.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="px-4 sm:px-5 pb-4 bg-white"
                        >
                          <p className="text-slate-600 font-medium text-xs sm:text-sm pt-2 border-t border-slate-50">{faq.a}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
