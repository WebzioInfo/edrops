import { useState, useEffect } from 'react';
import { fetchWithAuth } from '../../../api/client';
import { toast } from 'react-hot-toast';
import { Search, X, Send } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useSocket } from '../../../contexts/SocketContext';

export default function SupportManagement() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();

  const [replyMessage, setReplyMessage] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [replying, setReplying] = useState(false);

  const loadTickets = async () => {
    try {
      const query = new URLSearchParams();
      if (search) query.append('search', search);
      if (statusFilter) query.append('status', statusFilter);
      
      const data = await fetchWithAuth(`/staff/support/tickets?${query.toString()}`);
      setTickets(data);
    } catch (err) {
      toast.error('Failed to load tickets');
    }
  };

  useEffect(() => {
    loadTickets();
  }, [search, statusFilter]);

  useEffect(() => {
    if (isConnected && socket) {
      socket.on('NEW_SUPPORT_MESSAGE', (msg) => {
        if (selectedTicket && msg.ticketId === selectedTicket.id) {
          fetchTicketDetails(selectedTicket.id);
        }
      });
      socket.on('TICKET_STATUS_CHANGED', (data) => {
        setTickets(prev => prev.map(t => t.id === data.id ? { ...t, status: data.status } : t));
        if (selectedTicket?.id === data.id) fetchTicketDetails(data.id);
      });
      socket.on('TICKET_ASSIGNED', (data) => {
        setTickets(prev => prev.map(t => t.id === data.id ? data : t));
        if (selectedTicket?.id === data.id) fetchTicketDetails(data.id);
      });
      return () => {
        socket.off('NEW_SUPPORT_MESSAGE');
        socket.off('TICKET_STATUS_CHANGED');
        socket.off('TICKET_ASSIGNED');
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

  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyMessage.trim()) return;

    setReplying(true);
    try {
      await fetchWithAuth(`/support/tickets/${selectedTicket.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ message: replyMessage, isInternal })
      });
      setReplyMessage('');
      setIsInternal(false);
      fetchTicketDetails(selectedTicket.id);
      toast.success('Reply sent');
    } catch (err) {
      toast.error('Failed to send reply');
    } finally {
      setReplying(false);
    }
  };

  const handleAssign = async (id: string) => {
    try {
      await fetchWithAuth(`/staff/support/tickets/${id}/assign`, {
        method: 'PATCH',
        body: JSON.stringify({ staffId: user?.id })
      });
      toast.success('Assigned to you');
    } catch (err) {
      toast.error('Failed to assign ticket');
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await fetchWithAuth(`/staff/support/tickets/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      toast.success('Status updated');
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Support Tickets</h1>
          <p className="text-sm text-slate-500">Manage customer issues and requests</p>
        </div>
        
        <div className="flex gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search tickets..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1E88E5]/20 focus:border-[#1E88E5]"
            />
          </div>
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1E88E5]/20 focus:border-[#1E88E5]"
          >
            <option value="">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="WAITING_FOR_CUSTOMER">Action Needed</option>
            <option value="RESOLVED">Resolved</option>
          </select>
        </div>
      </div>

      <div className="flex gap-6 flex-1 min-h-0 overflow-hidden">
        {/* Ticket List */}
        <div className="flex-1 bg-white border border-slate-200 rounded-[20px] overflow-hidden flex flex-col">
          <div className="overflow-y-auto flex-1">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 font-bold">Ticket</th>
                  <th className="px-6 py-4 font-bold">Customer</th>
                  <th className="px-6 py-4 font-bold">Status</th>
                  <th className="px-6 py-4 font-bold">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tickets.map(ticket => (
                  <tr 
                    key={ticket.id} 
                    onClick={() => {
                      setSelectedTicket(ticket);
                      fetchTicketDetails(ticket.id);
                    }}
                    className={`hover:bg-slate-50 cursor-pointer transition-colors ${selectedTicket?.id === ticket.id ? 'bg-[#1E88E5]/5' : ''}`}
                  >
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900 truncate max-w-[200px]">{ticket.subject}</div>
                      <div className="text-xs text-slate-500">#{ticket.id.split('-')[0]}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{ticket.customer?.user?.firstName} {ticket.customer?.user?.lastName}</div>
                      <div className="text-xs text-slate-500">{ticket.customer?.user?.phone}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        ticket.status === 'OPEN' ? 'bg-blue-100 text-blue-700' :
                        ticket.status === 'RESOLVED' ? 'bg-emerald-100 text-emerald-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {ticket.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-xs font-medium">
                      {new Date(ticket.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Ticket Drawer / Details Panel */}
        {selectedTicket && (
          <div className="w-[450px] shrink-0 bg-white border border-slate-200 rounded-[20px] shadow-sm flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="font-bold text-slate-900 truncate">#{selectedTicket.id.split('-')[0]}</h3>
                <p className="text-xs text-slate-500">
                  {selectedTicket.customer?.user?.firstName} {selectedTicket.customer?.user?.lastName}
                </p>
              </div>
              <button onClick={() => setSelectedTicket(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* Status Actions */}
              <div className="flex gap-2 pb-4 border-b border-slate-100">
                <select 
                  value={selectedTicket.status}
                  onChange={(e) => handleStatusChange(selectedTicket.id, e.target.value)}
                  className="px-3 py-1.5 bg-slate-100 border-none rounded-lg text-sm font-bold text-slate-700 focus:ring-2 focus:ring-[#1E88E5]/20"
                >
                  <option value="OPEN">Open</option>
                  <option value="ASSIGNED">Assigned</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="WAITING_FOR_CUSTOMER">Waiting Customer</option>
                  <option value="RESOLVED">Resolved</option>
                  <option value="CLOSED">Closed</option>
                </select>
                
                {!selectedTicket.assignedToId ? (
                  <button onClick={() => handleAssign(selectedTicket.id)} className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-sm font-bold hover:bg-blue-100 transition-colors">
                    Assign to me
                  </button>
                ) : (
                  <span className="px-3 py-1.5 bg-slate-50 text-slate-500 rounded-lg text-sm font-bold border border-slate-100">
                    Assigned: {selectedTicket.assignedTo?.firstName}
                  </span>
                )}
              </div>

              {/* Subject & Desc */}
              <div>
                <h4 className="font-bold text-slate-900 mb-2">{selectedTicket.subject}</h4>
                <p className="text-sm text-slate-600 whitespace-pre-wrap">{selectedTicket.description}</p>
              </div>

              {/* Conversation */}
              <div className="space-y-4">
                <h4 className="font-bold text-slate-900 border-b border-slate-100 pb-2">Conversation</h4>
                <div className="flex flex-col gap-3">
                  {selectedTicket.messages?.map((msg: any, idx: number) => (
                    <div key={idx} className={`flex flex-col ${msg.user.role === 'CUSTOMER' ? 'items-start' : 'items-end'}`}>
                      <div className="text-[10px] text-slate-500 mb-1">{msg.user.firstName} • {new Date(msg.createdAt).toLocaleTimeString()}</div>
                      <div className={`p-3 rounded-[14px] text-sm max-w-[90%] ${
                        msg.user.role === 'CUSTOMER' 
                          ? 'bg-slate-100 text-slate-800 rounded-tl-none' 
                          : msg.isInternal 
                            ? 'bg-amber-100 text-amber-900 rounded-tr-none border border-amber-200'
                            : 'bg-[#1E88E5] text-white rounded-tr-none'
                      }`}>
                        <p className="whitespace-pre-wrap">{msg.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Reply Box */}
            <div className="p-4 bg-slate-50 border-t border-slate-200">
              <form onSubmit={handleReplySubmit} className="flex flex-col gap-3">
                <div className="flex items-center gap-2 px-1">
                  <input 
                    type="checkbox" 
                    id="isInternal"
                    checked={isInternal}
                    onChange={(e) => setIsInternal(e.target.checked)}
                    className="w-4 h-4 text-amber-500 border-slate-300 rounded focus:ring-amber-500"
                  />
                  <label htmlFor="isInternal" className="text-xs font-bold text-slate-600">Internal Note (Hidden from customer)</label>
                </div>
                <div className="relative">
                  <textarea
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    placeholder={isInternal ? "Type an internal note..." : "Type a reply to the customer..."}
                    className={`w-full p-3 pr-12 rounded-xl text-sm border focus:ring-2 focus:outline-none resize-none ${isInternal ? 'bg-amber-50 border-amber-200 focus:ring-amber-500/20 focus:border-amber-500 placeholder:text-amber-300' : 'bg-white border-slate-200 focus:ring-[#1E88E5]/20 focus:border-[#1E88E5]'}`}
                    rows={3}
                    required
                  />
                  <button
                    type="submit"
                    disabled={replying}
                    className={`absolute bottom-3 right-3 p-2 text-white rounded-full transition-all disabled:opacity-50 ${isInternal ? 'bg-amber-500 hover:bg-amber-600' : 'bg-[#1E88E5] hover:bg-blue-600'}`}
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
