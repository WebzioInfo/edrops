import { useParams, useNavigate } from 'react-router-dom';
import { Wallet, Package, ShoppingBag, Clock, ShieldCheck, LifeBuoy, User } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { fetchWithAuth } from '../../../api/client';
import LoadingSpinner from '../../../components/LoadingSpinner';
import { AdminTopbar } from '../components/AdminTopbar';
import { formatOrderId, formatOrderStatus } from '../../../utils/orderFormatters';

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: customer, isLoading } = useQuery({
    queryKey: ['adminCustomerDetail', id],
    queryFn: () => fetchWithAuth(`/admin/customers/${id}`),
    enabled: !!id,
  });

  if (isLoading) return <LoadingSpinner fullPage label="Loading Profile..." />;
  if (!customer) return <div className="text-center p-20 font-black text-2xl text-slate-500">Customer not found.</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-4 animate-fade-in pb-12">
      {/* ─── STANDARDIZED SHARED ADMIN TOPBAR ─────────────────────── */}
      <AdminTopbar
        title={`${customer.user.firstName} ${customer.user.lastName}`}
        subtitle={`${customer.user.phone} • ${customer.user.email || 'No email'}`}
        icon={User}
        iconVariant="blue"
        backLink={{ label: 'Back to Customers', to: '/admin/customers' }}
        badge={
          <div className="flex items-center gap-1.5">
            {customer.isWalkIn && <span className="bg-orange-100 text-orange-600 px-2 py-0.5 rounded text-[10px] uppercase font-bold">Walk-In</span>}
            {!customer.user.isActive && <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded text-[10px] uppercase font-bold">Inactive</span>}
          </div>
        }
        actions={
          <div className="flex gap-2">
            <button 
              type="button"
              onClick={() => navigate('/admin/orders/new')}
              className="px-3.5 py-1.5 bg-[#1677C8] hover:bg-[#1262A5] text-white font-bold rounded-xl text-xs transition-colors shadow-2xs cursor-pointer"
            >
              Place Order
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Financials & Assets */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Wallet */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-black text-slate-800 flex items-center gap-2">
                <Wallet className="w-5 h-5 text-[#2D79A8]" /> Wallet
              </h2>
            </div>
            <p className="text-4xl font-black text-[#2D79A8]">₹{customer.wallet?.balance || 0}</p>
            <div className="mt-4 flex gap-2">
              <button className="flex-1 bg-emerald-50 text-emerald-700 font-bold py-2 rounded-xl border border-emerald-200 hover:bg-emerald-100 transition-colors text-sm">Add Funds</button>
              <button className="flex-1 bg-slate-50 text-slate-700 font-bold py-2 rounded-xl border border-slate-200 hover:bg-slate-100 transition-colors text-sm">History</button>
            </div>
          </div>

          {/* Jars */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-black text-slate-800 flex items-center gap-2">
                <Package className="w-5 h-5 text-orange-500" /> Jars Held
              </h2>
            </div>
            {customer.jarBalances?.length > 0 ? (
              <div className="space-y-3">
                {customer.jarBalances.map((jb: any) => (
                  <div key={jb.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="font-bold text-slate-700 text-sm">{jb.brand.name}</span>
                    <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-lg font-black text-sm">{jb.quantity} Jars</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-sm font-semibold italic text-center py-4">No jars currently held.</p>
            )}
          </div>

          {/* Outstanding Deposit */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 p-6">
            <h2 className="font-black text-slate-800 flex items-center gap-2 mb-4">
              <ShieldCheck className="w-5 h-5 text-emerald-500" /> Jar Deposits
            </h2>
             {customer.jarDeposits?.length > 0 ? (
              <div className="space-y-3">
                {customer.jarDeposits.map((jd: any) => (
                  <div key={jd.id} className="flex justify-between items-center p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                    <span className="font-bold text-emerald-800 text-sm">{jd.brand.name}</span>
                    <span className="font-black text-emerald-600 text-sm">₹{jd.totalDepositAmount}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-sm font-semibold italic text-center py-4">No deposits currently held.</p>
            )}
          </div>
        </div>

        {/* Right Column: Activity */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Recent Orders */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-black text-slate-800 flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-indigo-500" /> Recent Orders
              </h2>
              <button className="text-sm font-bold text-indigo-600 hover:text-indigo-800">View All</button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm font-semibold">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-black">
                    <th className="py-2 px-2">ID</th>
                    <th className="py-2 px-2">Date</th>
                    <th className="py-2 px-2">Total</th>
                    <th className="py-2 px-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {customer.orders?.length > 0 ? (
                    customer.orders.map((order: any) => (
                      <tr key={order.id} className="border-b border-slate-100 last:border-0">
                        <td className="py-3 px-2 font-bold text-slate-700">{formatOrderId(order.id)}</td>
                        <td className="py-3 px-2 text-slate-500 text-xs">{new Date(order.createdAt).toLocaleDateString()}</td>
                        <td className="py-3 px-2 font-black text-slate-700">₹{order.totalAmount}</td>
                        <td className="py-3 px-2">
                          <span className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-wider border ${
                            order.status === 'DELIVERED' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                            ['CONFIRMED', 'ASSIGNED', 'OUT_FOR_DELIVERY'].includes(order.status) ? 'bg-blue-50 text-blue-600 border-blue-200' :
                            'bg-slate-50 text-slate-600 border-slate-200'
                          }`}>
                            {formatOrderStatus(order.status)}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400 font-bold italic">No orders found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Subscriptions */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 p-6">
             <div className="flex items-center justify-between mb-4">
              <h2 className="font-black text-slate-800 flex items-center gap-2">
                <Clock className="w-5 h-5 text-rose-500" /> Active Subscriptions
              </h2>
            </div>
             {customer.deliverySchedule?.rules?.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {customer.deliverySchedule.rules.map((rule: any) => (
                  <div key={rule.id} className="p-4 bg-rose-50 border border-rose-100 rounded-2xl">
                    <p className="font-black text-rose-800">{rule.frequency}</p>
                    <p className="text-sm font-semibold text-rose-600 mt-1">Qty: {rule.quantity} • Product ID: {rule.productId.substring(0,6)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-sm font-semibold italic text-center py-4 bg-slate-50 rounded-xl">No active subscriptions.</p>
            )}
          </div>
          
          {/* Support Tickets */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 p-6">
             <div className="flex items-center justify-between mb-4">
              <h2 className="font-black text-slate-800 flex items-center gap-2">
                <LifeBuoy className="w-5 h-5 text-teal-500" /> Recent Support Tickets
              </h2>
            </div>
             {customer.supportTickets?.length > 0 ? (
              <div className="space-y-3">
                {customer.supportTickets.map((ticket: any) => (
                  <div key={ticket.id} className="p-3 bg-teal-50 border border-teal-100 rounded-xl flex justify-between items-center">
                    <div>
                      <p className="font-bold text-teal-900 text-sm">{ticket.subject}</p>
                      <p className="text-xs text-teal-700 font-semibold">{new Date(ticket.createdAt).toLocaleDateString()}</p>
                    </div>
                    <span className="bg-teal-200 text-teal-800 px-2 py-1 rounded text-[10px] font-black uppercase">{ticket.status}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-sm font-semibold italic text-center py-4 bg-slate-50 rounded-xl">No support tickets found.</p>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
