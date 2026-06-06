import { useState } from 'react';
import { ShoppingBag, Package } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { fetchWithAuth } from '../../../api/client';

export default function OrdersDashboard() {
  const [filter, setFilter] = useState<'ALL' | 'ONETIME_ORDER' | 'SUBSCRIPTION_ORDER'>('ALL');

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['adminOrders'],
    queryFn: () => fetchWithAuth('/order')
  });

  const filteredOrders = orders.filter((order: any) => 
    filter === 'ALL' ? true : order.type === filter
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Orders Dashboard</h1>
          <p className="text-slate-500 font-semibold mt-1">Manage all marketplace and subscription orders.</p>
        </div>
        
        <div className="flex bg-white rounded-full p-1 border border-slate-200 shadow-sm">
          <button 
            onClick={() => setFilter('ALL')}
            className={`px-4 py-2 rounded-full text-xs font-black transition-all ${filter === 'ALL' ? 'bg-[#245361] text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            All Orders
          </button>
          <button 
            onClick={() => setFilter('ONETIME_ORDER')}
            className={`px-4 py-2 rounded-full text-xs font-black transition-all ${filter === 'ONETIME_ORDER' ? 'bg-[#245361] text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Marketplace
          </button>
          <button 
            onClick={() => setFilter('SUBSCRIPTION_ORDER')}
            className={`px-4 py-2 rounded-full text-xs font-black transition-all ${filter === 'SUBSCRIPTION_ORDER' ? 'bg-[#245361] text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Subscriptions
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 p-6 overflow-hidden">
        {isLoading ? (
          <div className="text-center py-20">
            <div className="w-10 h-10 border-4 border-[#245361]/20 border-t-[#245361] rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-500 font-medium">Loading orders...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-slate-50 mb-6">
              <ShoppingBag className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="text-xl font-black text-slate-700">No Orders Found</h3>
            <p className="text-slate-500 font-medium max-w-md mx-auto mt-2">
              There are currently no orders matching your filter criteria.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
             <table className="w-full text-left text-sm font-semibold border-collapse">
              <thead>
                <tr className="border-b border-border/50 text-[#245361] uppercase tracking-wider text-[10px] font-black bg-slate-50/50">
                  <th className="py-3 px-4">Order ID</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Total</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order: any) => (
                  <tr key={order.id} className="border-b border-border/30 hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-slate-400" />
                        <span className="font-bold text-slate-800">{order.id.split('-')[0].toUpperCase()}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">{new Date(order.createdAt).toLocaleDateString()}</p>
                    </td>
                    <td className="py-4 px-4">
                      <p className="font-bold text-slate-800">{order.customer?.user?.firstName} {order.customer?.user?.lastName}</p>
                      <p className="text-xs text-slate-500">{order.customer?.user?.phone}</p>
                    </td>
                    <td className="py-4 px-4">
                      <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border border-slate-200">
                        {order.type?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-4 px-4 font-black text-slate-700">
                      ₹{order.totalAmount}
                    </td>
                    <td className="py-4 px-4">
                      <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border
                        ${order.status === 'DELIVERED' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 
                          order.status === 'PENDING' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                          'bg-blue-50 text-blue-600 border-blue-200'}
                      `}>
                        {order.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
