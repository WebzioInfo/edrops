import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchWithAuth } from '../../../api/client';
import { toast } from 'react-hot-toast';
import { useSocket } from '../../../contexts/SocketContext';
import { ShoppingCart, Clock, CheckCircle2, Package } from 'lucide-react';

export default function OrderManagement() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { socket } = useSocket();

  const loadOrders = async () => {
    try {
      setLoading(true);
      const res = await fetchWithAuth('/order/staff/all');
      setOrders(res || []);
    } catch (err: any) {
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const handleStatusUpdate = async (orderId: string, newStatus: string) => {
    try {
      // Optimistic UI update
      setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
      
      await fetchWithAuth(`/order/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      toast.success('Order ' + newStatus);
    } catch (err) {
      toast.error('Failed to update status');
      loadOrders(); // Revert on failure
    }
  };

  useEffect(() => {
    if (!socket) return;

    const handleNewOrderEvent = (data: { order: any }) => {
      console.log('New order received via socket', data.order);
      // Data might just contain { id, amount, customerId, customerName, time }
      // We will refresh the orders list to get the full order items OR optimistically insert.
      // Easiest and safest is to just reload orders or prepend a basic placeholder and let them refresh.
      // Since we want full items to display, calling loadOrders is safer if we want all details.
      loadOrders();
    };

    socket.on('NEW_ORDER', handleNewOrderEvent);

    return () => {
      socket.off('NEW_ORDER', handleNewOrderEvent);
    };
  }, [socket]);

  if (loading && orders.length === 0) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#BBDFF2] border-t-[#2D79A8]"></div>
      </div>
    );
  }

  // Dashboard Stats
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  
  const todaysOrders = orders.filter(o => new Date(o.createdAt) >= todayStart);
  const pendingCount = orders.filter(o => o.status === 'PENDING').length;
  const totalRevenue = orders.reduce((sum, o) => sum + (o.paymentStatus === 'SUCCESS' ? o.totalAmount : 0), 0);

  return (
    <main className="min-h-screen px-4 py-5 text-[#245361] sm:px-6 lg:px-10 space-y-6">
      <section className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-[#E2E8F0]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-[#EBF5FB] px-4 py-2 text-xs font-black uppercase tracking-wider text-[#2D79A8]">
              <ShoppingCart className="h-4 w-4" />
              Live Orders
            </span>
            <h1 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl text-[#245361]">
              Order Management
            </h1>
            <p className="mt-2 text-sm text-[#64748B]">
              Real-time feed of all customer orders. Updates automatically.
            </p>
          </div>

          <div className="flex gap-4">
            <div className="rounded-2xl bg-[#F8FAFC] p-4 text-center min-w-[100px] border border-[#E2E8F0]">
              <p className="text-2xl font-black text-[#2D79A8]">{pendingCount}</p>
              <p className="mt-1 text-[10px] font-black uppercase tracking-wider text-[#64748B]">Pending</p>
            </div>
            <div className="rounded-2xl bg-[#F8FAFC] p-4 text-center min-w-[100px] border border-[#E2E8F0]">
              <p className="text-2xl font-black text-[#2D79A8]">{todaysOrders.length}</p>
              <p className="mt-1 text-[10px] font-black uppercase tracking-wider text-[#64748B]">Today's</p>
            </div>
            <div className="rounded-2xl bg-[#F8FAFC] p-4 text-center min-w-[100px] border border-[#E2E8F0]">
              <p className="text-2xl font-black text-emerald-600">₹{totalRevenue}</p>
              <p className="mt-1 text-[10px] font-black uppercase tracking-wider text-[#64748B]">Revenue</p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white rounded-3xl shadow-sm border border-[#E2E8F0] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E2E8F0] bg-[#F8FAFC]">
          <h3 className="font-bold text-[#0F172A]">Recent Orders</h3>
        </div>
        <div className="divide-y divide-[#E2E8F0]">
          <AnimatePresence>
            {orders.map((order) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="p-6 flex flex-col md:flex-row gap-6 hover:bg-[#F8FAFC] transition-colors"
              >
                <div className="flex items-start gap-4 flex-1">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${order.status === 'CONFIRMED' || order.status === 'DELIVERED' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                    {order.status === 'CONFIRMED' || order.status === 'DELIVERED' ? <CheckCircle2 className="h-6 w-6" /> : <Clock className="h-6 w-6" />}
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-[#0F172A]">
                      {order.customer?.user?.firstName} {order.customer?.user?.lastName}
                    </h4>
                    <p className="text-xs text-[#64748B] mt-1 font-mono">ID: {order.id.substring(0, 8)}</p>
                    <div className="mt-3 space-y-1">
                      {order.items?.map((item: any) => (
                        <div key={item.id} className="text-sm text-[#475569] flex items-center gap-2">
                          <Package className="h-3 w-3 text-[#94A3B8]" />
                          {item.quantity}x {item.product?.name}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-3 min-w-[200px]">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider">{new Date(order.createdAt).toLocaleTimeString()}</span>
                  </div>
                  <div className="text-xl font-black text-[#0F172A]">₹{order.totalAmount}</div>
                  <div className="flex gap-2">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      order.paymentStatus === 'SUCCESS' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {order.paymentMethod} {order.paymentStatus}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      order.status === 'CONFIRMED' || order.status === 'PROCESSING' || order.status === 'OUT_FOR_DELIVERY' ? 'bg-emerald-100 text-emerald-700' : 
                      order.status === 'DELIVERED' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {order.status.replace(/_/g, ' ')}
                    </span>
                  </div>

                  {/* Actions based on current status */}
                  <div className="flex flex-wrap gap-2 justify-end mt-2">
                    {order.status === 'PENDING' && (
                      <button onClick={() => handleStatusUpdate(order.id, 'CONFIRMED')} className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors">
                        Confirm Order
                      </button>
                    )}
                    {order.status === 'CONFIRMED' && (
                      <button onClick={() => handleStatusUpdate(order.id, 'PROCESSING')} className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors">
                        Start Processing
                      </button>
                    )}
                    {order.status === 'PROCESSING' && (
                      <button onClick={() => handleStatusUpdate(order.id, 'OUT_FOR_DELIVERY')} className="px-3 py-1 bg-[#2D79A8] hover:bg-[#245361] text-white rounded-lg text-xs font-bold transition-colors">
                        Out for Delivery
                      </button>
                    )}
                    {order.status === 'OUT_FOR_DELIVERY' && (
                      <button onClick={() => handleStatusUpdate(order.id, 'DELIVERED')} className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors">
                        Mark Delivered
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {orders.length === 0 && (
            <div className="p-10 text-center text-[#64748B]">
              <p>No orders found.</p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
