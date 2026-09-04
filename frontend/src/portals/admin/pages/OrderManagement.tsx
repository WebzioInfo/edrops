import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchWithAuth } from '../../../api/client';
import { Truck, CheckSquare, Square, Edit3 } from 'lucide-react';
import LoadingSpinner from '../../../components/LoadingSpinner';
import { formatOrderStatus } from '../../../utils/orderFormatters';

export default function OrderManagement() {
  const queryClient = useQueryClient();
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [selectedPartner, setSelectedPartner] = useState<string>('');
  
  // Queries
  const { data: orders = [], isLoading: isLoadingOrders } = useQuery({
    queryKey: ['adminOrdersPending'],
    queryFn: () => fetchWithAuth('/order'),
    // Filtering down to what makes sense for bulk management
    select: (data) => data.filter((o: any) => o.status === 'PENDING_ASSIGNMENT' || o.status === 'ASSIGNED')
  });

  const { data: partners = [] } = useQuery({
    queryKey: ['deliveryPartners'],
    queryFn: () => fetchWithAuth('/admin/partners') // Assuming an endpoint exists or will exist, otherwise fallback empty for now. If not, use users with role DELIVERY_PARTNER
  });

  const toggleOrderSelection = (id: string) => {
    setSelectedOrders(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    if (selectedOrders.length === orders.length) setSelectedOrders([]);
    else setSelectedOrders(orders.map((o: any) => o.id));
  };

  const bulkAssignMutation = useMutation({
    mutationFn: async () => {
      // If we had a bulk assign endpoint: /admin/delivery/bulk-assign
      return Promise.all(selectedOrders.map(orderId => 
        // using the order ID to find its delivery ID
        fetchWithAuth(`/admin/delivery/assign`, {
           method: 'POST',
           body: JSON.stringify({ orderId, partnerId: selectedPartner })
        })
      ));
    },
    onSuccess: () => {
      alert('Orders assigned successfully!');
      setSelectedOrders([]);
      queryClient.invalidateQueries({ queryKey: ['adminOrdersPending'] });
    }
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Bulk Management</h1>
          <p className="text-slate-500 font-semibold mt-1">Assign deliveries or override statuses in bulk.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Bulk Action Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 p-5">
            <h2 className="font-black text-slate-800 mb-4 flex items-center gap-2">
              <Truck className="w-5 h-5 text-[#2D79A8]" />
              Bulk Assign
            </h2>
            <div className="space-y-3">
              <label className="block text-sm font-bold text-slate-700">Select Partner</label>
              <select 
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold outline-none focus:border-[#2D79A8]"
                value={selectedPartner}
                onChange={e => setSelectedPartner(e.target.value)}
              >
                <option value="">-- Choose Partner --</option>
                {partners.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>
                ))}
              </select>
              
              <button
                disabled={selectedOrders.length === 0 || !selectedPartner || bulkAssignMutation.isPending}
                onClick={() => bulkAssignMutation.mutate()}
                className="w-full py-3 bg-[#2D79A8] hover:bg-[#245361] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold shadow-md shadow-[#2D79A8]/20 transition-all flex justify-center items-center gap-2 mt-4"
              >
                {bulkAssignMutation.isPending ? <LoadingSpinner size="sm" light /> : 'Assign Selected (' + selectedOrders.length + ')'}
              </button>
            </div>
          </div>
        </div>

        {/* Orders Table */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden">
             <table className="w-full text-left text-sm font-semibold border-collapse">
              <thead>
                <tr className="border-b border-border/50 text-[#245361] uppercase tracking-wider text-[10px] font-black bg-slate-50/50">
                  <th className="py-4 px-4 w-10">
                    <button onClick={toggleAll}>
                      {selectedOrders.length === orders.length && orders.length > 0 ? <CheckSquare className="w-5 h-5 text-[#2D79A8]" /> : <Square className="w-5 h-5 text-slate-300 hover:text-[#2D79A8]" />}
                    </button>
                  </th>
                  <th className="py-4 px-4">Order Details</th>
                  <th className="py-4 px-4">Customer</th>
                  <th className="py-4 px-4">Address</th>
                  <th className="py-4 px-4">Current Status</th>
                  <th className="py-4 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingOrders ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center"><LoadingSpinner size="md" /></td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-500 font-bold">No pending orders found.</td>
                  </tr>
                ) : (
                  orders.map((order: any) => (
                    <tr key={order.id} className={`border-b border-border/30 hover:bg-slate-50/50 transition-colors ${selectedOrders.includes(order.id) ? 'bg-[#EBF5FB]/30' : ''}`}>
                      <td className="py-4 px-4">
                        <button onClick={() => toggleOrderSelection(order.id)}>
                          {selectedOrders.includes(order.id) ? <CheckSquare className="w-5 h-5 text-[#2D79A8]" /> : <Square className="w-5 h-5 text-slate-300 hover:text-[#2D79A8]" />}
                        </button>
                      </td>
                      <td className="py-4 px-4">
                        <p className="font-bold text-slate-800">{order.id.split('-')[0].toUpperCase()}</p>
                        <p className="text-[10px] text-slate-500">{order.type}</p>
                      </td>
                      <td className="py-4 px-4">
                        <p className="font-bold text-slate-800">{order.customer?.user?.firstName}</p>
                        <p className="text-xs text-slate-500">{order.customer?.user?.phone}</p>
                      </td>
                      <td className="py-4 px-4">
                        <p className="text-xs text-slate-600 line-clamp-2 max-w-[150px]">{order.deliveryAddress?.street}, {order.deliveryAddress?.city}</p>
                      </td>
                      <td className="py-4 px-4">
                        <span className="bg-orange-100 text-orange-700 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider">
                          {formatOrderStatus(order.status)}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <button className="text-slate-400 hover:text-[#2D79A8] p-2 bg-slate-50 rounded-lg border border-slate-200 transition-colors">
                          <Edit3 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
