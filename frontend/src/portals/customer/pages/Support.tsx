import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { HelpCircle, Plus, Send, MessageSquare } from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';
import { toast } from 'react-hot-toast';

interface Ticket {
  id: string;
  subject: string;
  description: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  priority: string;
  createdAt: string;
}

export default function SupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

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

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) {
      toast.error('Please fill in both subject and description');
      return;
    }
    setSubmitting(true);
    try {
      const newTicket = await fetchWithAuth('/support/tickets', {
        method: 'POST',
        body: JSON.stringify({ subject, description, priority }),
      });
      setTickets([newTicket, ...tickets]);
      setSubject('');
      setDescription('');
      toast.success('Support ticket created successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create support ticket');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusClass = (status: Ticket['status']) => {
    switch (status) {
      case 'OPEN':
        return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'IN_PROGRESS':
        return 'bg-amber-50 text-amber-700 border-amber-100';
      case 'RESOLVED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'CLOSED':
        return 'bg-slate-50 text-slate-700 border-slate-100';
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="relative h-16 w-16 rounded-full water-gradient shadow-2xl shadow-edrops-aqua/30">
          <div className="absolute inset-2 animate-ping rounded-full bg-white/40" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8 space-y-6">
      
      {/* 1. Header */}
      <div>
        <h1 className="text-3xl font-black text-[#245361]">Help & Support</h1>
        <p className="text-sm font-semibold text-[#245361]/80 mt-1">Get assistance, open tickets, or browse FAQs regarding water delivery</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        
        {/* Left: Open Tickets list */}
        <div className="space-y-6">
          <motion.section
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="clay-card p-6"
          >
            <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
              <div className="flex items-center gap-3">
                <MessageSquare className="h-6 w-6 text-[#2D79A8]" />
                <h2 className="text-xl font-black text-[#245361]">Support Tickets</h2>
              </div>
            </div>

            <div className="divide-y divide-border/60">
              {tickets.map((ticket) => (
                <div key={ticket.id} className="py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h4 className="text-base font-black text-[#245361]">{ticket.subject}</h4>
                      <p className="text-sm text-slate-800 font-semibold mt-1">{ticket.description}</p>
                      <p className="text-xs text-slate-700 font-semibold mt-1.5">
                        Opened on {new Date(ticket.createdAt).toLocaleDateString()} at {new Date(ticket.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <span className={`rounded-full border px-3 py-0.5 text-xs font-black uppercase tracking-wider ${getStatusClass(ticket.status)}`}>
                      {ticket.status.toLowerCase()}
                    </span>
                  </div>
                </div>
              ))}
              {tickets.length === 0 && (
                <p className="text-center text-sm font-semibold text-slate-700 py-6">No support tickets found.</p>
              )}
            </div>
          </motion.section>

          {/* FAQs section */}
          <motion.section
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="clay-card p-6"
          >
            <div className="flex items-center gap-3 border-b border-border pb-4 mb-4">
              <HelpCircle className="h-6 w-6 text-[#2D79A8]" />
              <h2 className="text-xl font-black text-[#245361]">Frequently Asked Questions</h2>
            </div>
            
            <div className="space-y-4 text-sm font-semibold">
              <div>
                <h4 className="text-base font-black text-[#245361]">How do I pause my delivery?</h4>
                <p className="text-slate-600 mt-1">Navigate to the Plan page, then click "Pause Plan". You can resume anytime without penalty.</p>
              </div>
              <div>
                <h4 className="text-base font-black text-[#245361]">What happens if I miss a scheduled delivery?</h4>
                <p className="text-slate-600 mt-1">If the delivery fails (e.g. no empty jars left outside), the driver will flag it and re-attempt the next business day.</p>
              </div>
            </div>
          </motion.section>
        </div>

        {/* Right: Create Ticket Form */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="clay-card p-6"
        >
          <div className="flex items-center gap-2 border-b border-border pb-4 mb-4">
            <Plus className="h-5 w-5 text-[#2D79A8]" />
            <h3 className="text-lg font-black text-[#245361]">Open a Ticket</h3>
          </div>

          <form onSubmit={handleCreateTicket} className="space-y-4">
            <div>
              <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Missed delivery, billing issue"
                className="w-full clay-input text-sm py-3 px-4 bg-[#BBDFF2]/10"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Explain the issue in detail..."
                rows={4}
                className="w-full clay-input text-sm py-3 px-4 bg-[#BBDFF2]/10 min-h-[100px] resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full clay-input text-sm py-3 px-4 bg-[#BBDFF2]/10"
              >
                <option value="LOW">Low - General query</option>
                <option value="MEDIUM">Medium - Normal issue</option>
                <option value="HIGH">High - Urgent concern</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-4 rounded-full sun-gradient text-sm font-black text-white shadow-lg disabled:opacity-50 transition flex items-center justify-center gap-2 mt-6"
            >
              <Send className="h-4 w-4" /> Open Ticket
            </button>
          </form>
        </motion.div>
      </div>

    </div>
  );
}
