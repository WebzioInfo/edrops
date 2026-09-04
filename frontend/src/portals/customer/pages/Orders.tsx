import { useState, useEffect } from 'react';
import { Package, Clock, CheckCircle, ChevronRight, Ban, ShoppingBag, ShoppingCart, XCircle, CheckCircle2 } from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';
import { useSocket } from '../../../contexts/SocketContext';
import { toast } from 'react-hot-toast';
import { Link } from 'react-router-dom';
import LoadingSpinner from '../../../components/LoadingSpinner';
import { formatOrderStatus, getOrderStatusBadgeClass, formatDeliverySlot } from '../../../utils/orderFormatters';

export default function Orders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { socket } = useSocket();

  useEffect(() => {
    fetchWithAuth('/order')
      .then((orderData) => {
        setOrders(Array.isArray(orderData) ? orderData : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleStatusChanged = (data: { orderId: string; status: string }) => {
      setOrders((prev) => {
        const updated = prev.map((o) => (o.id === data.orderId ? { ...o, status: data.status } : o));
        return updated;
      });
      toast.success('Order ' + data.orderId.substring(0, 8) + ' is now ' + formatOrderStatus(data.status), { icon: '📦' });
    };

    socket.on('ORDER_STATUS_CHANGED', handleStatusChanged);
    return () => {
      socket.off('ORDER_STATUS_CHANGED', handleStatusChanged);
    };
  }, [socket]);

  const totalOrders = orders.length;
  const pendingOrders = orders.filter((o) =>
    ['PENDING', 'CONFIRMED', 'PROCESSING', 'OUT_FOR_DELIVERY', 'PENDING_ASSIGNMENT', 'ASSIGNED', 'ACCEPTED_BY_PARTNER'].includes(o.status)
  ).length;
  const deliveredOrders = orders.filter((o) => ['DELIVERED', 'COMPLETED'].includes(o.status)).length;
  const cancelledOrders = orders.filter((o) => o.status === 'CANCELLED').length;

  const safeNumber = (val: any) => {
    const num = Number(val);
    return isNaN(num) ? 0 : num;
  };

  if (loading) {
    return <LoadingSpinner fullPage label="Loading orders..." />;
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-[100px] lg:pb-12 text-[#0F172A]">
      <div className="mx-auto max-w-[1200px] px-4 md:px-6 py-6 md:py-10">

        {/* PAGE HEADER */}
        <div className="mb-6 md:mb-8">
          <h1 className="text-[24px] md:text-[32px] font-bold text-[#0F172A] mb-1 md:mb-2">Orders</h1>
          <p className="text-[14px] md:text-[16px] text-[#64748B]">Track and manage all your water deliveries.</p>
        </div>

        {/* SUMMARY CARDS */}
        {orders.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8 md:mb-10">
            <div className="bg-white p-4 md:p-5 rounded-[16px] border border-[#E2E8F0] shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-center mb-3 md:mb-4">
                <span className="text-[13px] font-semibold text-[#64748B]">Total Orders</span>
                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
                  <ShoppingCart className="w-4 h-4 text-blue-500" />
                </div>
              </div>
              <span className="text-[20px] md:text-[24px] font-bold text-[#0F172A]">{totalOrders}</span>
            </div>
            <div className="bg-white p-4 md:p-5 rounded-[16px] border border-[#E2E8F0] shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-center mb-3 md:mb-4">
                <span className="text-[13px] font-semibold text-[#64748B]">Active / Pending</span>
                <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-orange-500" />
                </div>
              </div>
              <span className="text-[20px] md:text-[24px] font-bold text-[#0F172A]">{pendingOrders}</span>
            </div>
            <div className="bg-white p-4 md:p-5 rounded-[16px] border border-[#E2E8F0] shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-center mb-3 md:mb-4">
                <span className="text-[13px] font-semibold text-[#64748B]">Delivered</span>
                <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </div>
              </div>
              <span className="text-[20px] md:text-[24px] font-bold text-[#0F172A]">{deliveredOrders}</span>
            </div>
            <div className="bg-white p-4 md:p-5 rounded-[16px] border border-[#E2E8F0] shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-center mb-3 md:mb-4">
                <span className="text-[13px] font-semibold text-[#64748B]">Cancelled</span>
                <div className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center">
                  <XCircle className="w-4 h-4 text-rose-500" />
                </div>
              </div>
              <span className="text-[20px] md:text-[24px] font-bold text-[#0F172A]">{cancelledOrders}</span>
            </div>
          </div>
        )}

        {/* ORDERS LIST */}
        {orders.length === 0 ? (
          <div className="bg-white rounded-[16px] border border-[#E2E8F0] shadow-sm p-8 md:p-10 flex flex-col items-center justify-center text-center min-h-[400px]">
            <div className="w-20 h-20 md:w-24 md:h-24 bg-[#F8FAFC] rounded-full flex items-center justify-center mb-6 border border-[#E2E8F0]">
              <Package className="h-10 w-10 text-[#64748B]" />
            </div>
            <h2 className="text-[20px] md:text-[24px] font-bold text-[#0F172A] mb-2">No Orders Yet</h2>
            <p className="text-[#64748B] text-[14px] md:text-[15px] mb-8 max-w-md">Order your first water jar.</p>
            <Link
              to="/customer/shop"
              className="px-8 py-3.5 rounded-[12px] bg-[#1E88E5] text-white font-semibold shadow-sm hover:bg-[#1565C0] transition-colors cursor-pointer inline-flex items-center gap-2"
            >
              <ShoppingBag className="w-4 h-4" /> Shop Now
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <Link
                key={order.id}
                to={`/customer/orders/${order.id}`}
                className="bg-white rounded-[16px] p-4 border border-[#E2E8F0] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:shadow-md hover:border-[#1E88E5]/40 transition-all duration-150 group block"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-[11px] font-bold bg-[#F8FAFC] text-[#0F172A] px-2 py-1 rounded-md uppercase tracking-wider border border-[#E2E8F0]">
                      #{order.id.substring(0, 8)}
                    </span>
                    <span className="text-[12px] font-medium text-[#64748B]">
                      {new Date(order.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <h3 className="text-[15px] font-bold text-[#0F172A] mb-1 line-clamp-1">
                    {order.items?.map((i: any) => `${i.quantity}x ${i.product?.name || 'Item'}`).join(', ')}
                  </h3>
                  <p className="text-[12px] font-medium text-[#64748B] flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#94A3B8]" /> Slot: {formatDeliverySlot(order.timeSlot)}
                  </p>
                </div>
                <div className="md:w-[160px] flex items-center">
                  <span
                    className={`px-2 py-1 rounded-[6px] text-[10px] font-bold uppercase tracking-wider border flex items-center gap-1.5 ${getOrderStatusBadgeClass(
                      order.status
                    )}`}
                  >
                    {['DELIVERED', 'COMPLETED'].includes(order.status) && <CheckCircle2 className="w-3 h-3" />}
                    {order.status === 'CANCELLED' && <Ban className="w-3 h-3" />}
                    {['CONFIRMED', 'ASSIGNED', 'ACCEPTED_BY_PARTNER'].includes(order.status) && <CheckCircle className="w-3 h-3" />}
                    {formatOrderStatus(order.status)}
                  </span>
                </div>
                <div className="flex items-center justify-between md:justify-end gap-4 md:w-[200px] pt-3 md:pt-0 border-t border-[#E2E8F0] md:border-0">
                  <div className="text-[16px] md:text-[18px] font-bold text-[#0F172A]">
                    ₹{safeNumber(order.totalAmount)}
                  </div>
                  <div className="h-[36px] px-3 rounded-[8px] bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] text-[12px] font-semibold group-hover:bg-[#1E88E5] group-hover:text-white group-hover:border-[#1E88E5] transition-colors flex items-center gap-1">
                    Details <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
