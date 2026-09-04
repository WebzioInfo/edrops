import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Package,
  Clock,
  CheckCircle2,
  Truck,
  MapPin,
  ShoppingBag,
  ShieldCheck,
  Copy,
  ArrowLeft,
  Phone,
  User,
  AlertCircle,
  XCircle,
  LifeBuoy,
  RefreshCw,
  Download
} from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';
import { useSocket } from '../../../contexts/SocketContext';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '../../../components/LoadingSpinner';
import { formatOrderStatus, formatDeliverySlot, formatPaymentDetails } from '../../../utils/orderFormatters';
import { generateOrderInvoice } from '../../../utils/InvoiceGenerator';

export default function OrderDetails() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { socket } = useSocket();
  const [order, setOrder] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOrder = async (isManual = false) => {
    if (!orderId) return;
    if (isManual) setRefreshing(true);
    try {
      const data = await fetchWithAuth(`/order/${orderId}`);
      setOrder(data);
    } catch {
      // Fallback: search in list
      try {
        const list = await fetchWithAuth('/order');
        if (Array.isArray(list)) {
          const found = list.find((o: any) => o.id === orderId);
          if (found) setOrder(found);
        }
      } catch (err: any) {
        toast.error('Failed to load order details');
      }
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrder();
    // Poll every 12 seconds if active order
    const interval = setInterval(() => {
      if (order && !['DELIVERED', 'CANCELLED'].includes(order.status)) {
        fetchOrder();
      }
    }, 12000);
    return () => clearInterval(interval);
  }, [orderId]);

  // Real-time WebSocket updates
  useEffect(() => {
    if (!socket || !orderId) return;

    const handleStatusChanged = (data: { orderId: string; status: string }) => {
      if (data.orderId === orderId) {
        setOrder((prev: any) => (prev ? { ...prev, status: data.status } : prev));
        toast.success(`Order status updated to: ${formatOrderStatus(data.status)}`, { icon: '📦' });
        fetchOrder();
      }
    };

    socket.on('ORDER_STATUS_CHANGED', handleStatusChanged);
    return () => {
      socket.off('ORDER_STATUS_CHANGED', handleStatusChanged);
    };
  }, [socket, orderId]);

  const copyOrderId = () => {
    if (orderId) {
      navigator.clipboard.writeText(orderId);
      toast.success('Order ID copied to clipboard!');
    }
  };

  const getTimelineStepIndex = (status: string) => {
    switch (status) {
      case 'NEW':
      case 'PENDING':
      case 'PENDING_PAYMENT':
      case 'PENDING_ASSIGNMENT':
        return 0; // Placed
      case 'CONFIRMED':
      case 'ASSIGNED':
      case 'ACCEPTED_BY_PARTNER':
      case 'PROCESSING':
        return 1; // Confirmed
      case 'OUT_FOR_DELIVERY':
        return 2; // Out for Delivery
      case 'DELIVERED':
      case 'COMPLETED':
        return 3; // Delivered
      case 'CANCELLED':
        return -1;
      default:
        return 0;
    }
  };

  const safeNumber = (val: any) => {
    const num = Number(val);
    return isNaN(num) ? 0 : num;
  };

  if (loading) {
    return <LoadingSpinner fullPage label="Loading order details..." />;
  }

  if (!order) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-16 h-16 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center mb-4 text-rose-500">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-[#0F172A]">Order Not Found</h2>
        <p className="mt-1.5 text-sm text-[#64748B] max-w-sm">
          We could not locate details for this order. It may have expired or is under a different account.
        </p>
        <Link
          to="/customer/orders"
          className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1E88E5] text-white text-xs font-bold shadow-xs hover:bg-[#1565C0] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> View All Orders
        </Link>
      </div>
    );
  }

  const stepIndex = getTimelineStepIndex(order.status);
  const isCancelled = order.status === 'CANCELLED';
  const partnerUser = order.delivery?.assignment?.deliveryPartner?.user;
  const partnerVehicle = order.delivery?.assignment?.deliveryPartner?.vehicleNumber;

  const timelineSteps = [
    { title: 'Order Placed', desc: 'Received & logged' },
    { title: 'Confirmed', desc: 'Assigned to delivery hub' },
    { title: 'Out for Delivery', desc: 'Partner on the way' },
    { title: 'Delivered', desc: 'Fulfilled successfully' },
  ];

  const itemsTotal = order.items?.reduce(
    (sum: number, i: any) => sum + safeNumber(i.unitPrice || i.price) * safeNumber(i.quantity),
    0
  ) || safeNumber(order.subTotal);

  const depositTotal = safeNumber(order.depositTotal);
  const deliveryCharge = safeNumber(order.deliveryCharge);
  const discountTotal = safeNumber(order.discountTotal);
  const grandTotal = safeNumber(order.totalAmount);

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24 lg:pb-12 text-[#0F172A]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        
        {/* Navigation & Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/customer/orders')}
              className="p-2 rounded-xl bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#64748B] hover:text-[#0F172A] transition-colors cursor-pointer shadow-xs"
              title="Back to Orders"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-[#0F172A]">
                  Order #{order.id.substring(0, 8).toUpperCase()}
                </h1>
                <button
                  onClick={copyOrderId}
                  className="p-1 text-[#94A3B8] hover:text-[#1E88E5] transition-colors cursor-pointer"
                  title="Copy full Order UUID"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-xs text-[#64748B] mt-0.5">
                Placed on {new Date(order.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchOrder(true)}
              disabled={refreshing}
              className="px-3.5 py-2 rounded-xl bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#0F172A] text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#1E88E5] ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh Status</span>
            </button>
            <Link
              to="/customer/support"
              className="px-3.5 py-2 rounded-xl bg-[#EBF5FB] hover:bg-sky-100 text-[#1E88E5] text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <LifeBuoy className="w-3.5 h-3.5" />
              <span>Need Help?</span>
            </Link>
          </div>
        </div>

        {/* Two-Column Tracking & Order Details Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT COLUMN: Status Timeline, Delivery Info, Items (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Live Order Status Timeline Card */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl border border-[#E2E8F0] p-5 sm:p-6 shadow-xs"
            >
              <div className="flex items-center justify-between pb-3 mb-5 border-b border-[#F1F5F9]">
                <h2 className="text-base font-bold text-[#0F172A] flex items-center gap-2">
                  <Truck className="w-5 h-5 text-[#1E88E5]" /> Live Delivery Status
                </h2>
                {!isCancelled && stepIndex < 3 && (
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Live Tracking
                  </span>
                )}
              </div>

              {isCancelled ? (
                <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-3 text-rose-800">
                  <XCircle className="w-6 h-6 text-rose-600 shrink-0" />
                  <div>
                    <h4 className="font-bold text-sm">This order was cancelled</h4>
                    <p className="text-xs text-rose-600 mt-0.5">
                      Any payments or wallet deductions have been reversed or credited.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  {/* MOBILE VERTICAL TIMELINE STEPPER (< lg) */}
                  <div className="lg:hidden space-y-5 relative pl-1 py-1">
                    {timelineSteps.map((step, idx) => {
                      const isComplete = stepIndex >= idx;
                      const isCurrent = stepIndex === idx;
                      const isLineComplete = stepIndex > idx;
                      const isLast = idx === timelineSteps.length - 1;

                      return (
                        <div key={idx} className="relative flex items-start gap-4">
                          {/* Left: Icon and connecting vertical line */}
                          <div className="relative flex flex-col items-center">
                            <div
                              className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-300 shadow-2xs z-10 ${
                                isComplete
                                  ? 'bg-[#1E88E5] text-white'
                                  : 'bg-[#F1F5F9] text-[#94A3B8] border border-[#E2E8F0]'
                              } ${isCurrent ? 'ring-4 ring-sky-100 scale-105' : ''}`}
                            >
                              {isComplete ? <CheckCircle2 className="w-5 h-5" /> : idx + 1}
                            </div>
                            {!isLast && (
                              <div
                                className={`w-0.5 absolute top-9 bottom-[-20px] left-1/2 -translate-x-1/2 transition-colors duration-300 ${
                                  isLineComplete ? 'bg-[#1E88E5]' : 'bg-[#E2E8F0]'
                                }`}
                              />
                            )}
                          </div>

                          {/* Right: Step Title & Description */}
                          <div className="pt-1.5 flex-1 min-w-0">
                            <h4 className={`text-sm font-bold ${isComplete ? 'text-[#0F172A]' : 'text-[#94A3B8]'}`}>
                              {step.title}
                            </h4>
                            <p className="text-xs text-[#64748B] mt-0.5 leading-snug">
                              {step.desc}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* DESKTOP HORIZONTAL 4-COL TIMELINE (≥ lg) - UNTOUCHED */}
                  <div className="hidden lg:grid grid-cols-4 gap-4 relative">
                    {timelineSteps.map((step, idx) => {
                      const isComplete = stepIndex >= idx;
                      const isCurrent = stepIndex === idx;

                      return (
                        <div key={idx} className="flex flex-col items-start text-left">
                          <div className="flex items-center w-full mb-3">
                            <div
                              className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-300 shadow-2xs ${
                                isComplete
                                  ? 'bg-[#1E88E5] text-white'
                                  : 'bg-[#F1F5F9] text-[#94A3B8] border border-[#E2E8F0]'
                              } ${isCurrent ? 'ring-4 ring-sky-100 scale-105' : ''}`}
                            >
                              {isComplete ? <CheckCircle2 className="w-5 h-5" /> : idx + 1}
                            </div>
                            {idx < timelineSteps.length - 1 && (
                              <div
                                className={`flex-1 h-1 mx-2 rounded-full transition-all ${
                                  stepIndex > idx ? 'bg-[#1E88E5]' : 'bg-[#E2E8F0]'
                                }`}
                              />
                            )}
                          </div>
                          <h4 className={`text-sm font-bold ${isComplete ? 'text-[#0F172A]' : 'text-[#94A3B8]'}`}>
                            {step.title}
                          </h4>
                          <p className="text-[11px] text-[#64748B] mt-0.5 leading-snug">
                            {step.desc}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Delivery Partner Details if Assigned */}
              {partnerUser && (
                <div className="mt-6 pt-5 border-t border-[#F1F5F9] bg-[#F8FAFC] p-4 rounded-xl border border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#EBF5FB] border border-[#BBDFF2] flex items-center justify-center text-[#1E88E5]">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#64748B] tracking-wider block">Assigned Delivery Partner</span>
                      <h4 className="text-sm font-bold text-[#0F172A]">
                        {partnerUser.firstName} {partnerUser.lastName}
                      </h4>
                      {partnerVehicle && (
                        <span className="text-[11px] text-[#64748B] block">Vehicle: {partnerVehicle}</span>
                      )}
                    </div>
                  </div>

                  {partnerUser.phone && (
                    <a
                      href={`tel:${partnerUser.phone}`}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#1E88E5] text-white text-xs font-bold hover:bg-[#1565C0] transition-colors shadow-xs"
                    >
                      <Phone className="w-3.5 h-3.5" /> Call Partner
                    </a>
                  )}
                </div>
              )}
            </motion.div>

            {/* Items Ordered Card */}
            <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 sm:p-6 shadow-xs">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#F1F5F9]">
                <h2 className="text-base font-bold text-[#0F172A] flex items-center gap-2">
                  <Package className="w-5 h-5 text-[#1E88E5]" /> Items Ordered ({order.items?.length || 0})
                </h2>
              </div>

              <div className="divide-y divide-[#F1F5F9]">
                {order.items?.map((item: any) => {
                  const product = item.product;
                  const itemPrice = safeNumber(item.unitPrice || item.price);
                  const itemQty = safeNumber(item.quantity);
                  const itemDeposit = safeNumber(item.deposit || product?.depositAmount);

                  return (
                    <div key={item.id} className="py-3.5 flex items-center gap-3 sm:gap-4 first:pt-0 last:pb-0">
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] overflow-hidden flex-shrink-0 flex items-center justify-center">
                        {product?.images?.[0]?.url ? (
                          <img src={product.images[0].url} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                          <ShoppingBag className="w-6 h-6 text-[#94A3B8]" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-xs sm:text-sm text-[#0F172A] truncate">
                            {product?.name || 'Water Product'}
                          </h4>
                          {product?.brand?.name && (
                            <span className="text-[10px] bg-[#EBF5FB] text-[#1E88E5] px-2 py-0.2 rounded-full font-bold">
                              {product.brand.name}
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-[#64748B] mt-0.5">
                          Quantity: <strong className="text-[#0F172A]">{itemQty}</strong> × ₹{itemPrice}
                          {itemDeposit > 0 && ` · Deposit ₹${itemDeposit}`}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-extrabold text-sm sm:text-base text-[#0F172A]">
                          ₹{itemPrice * itemQty + (item.deposit || 0)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Delivery & Schedule Info Card */}
            <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 sm:p-6 shadow-xs">
              <h2 className="text-base font-bold text-[#0F172A] flex items-center gap-2 pb-3 mb-4 border-b border-[#F1F5F9]">
                <MapPin className="w-5 h-5 text-[#1E88E5]" /> Delivery Address & Timing
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                  <span className="text-[#64748B] font-bold block mb-1">Destination Address</span>
                  {order.address ? (
                    <div>
                      <p className="font-bold text-sm text-[#0F172A] mb-0.5">{order.address.label || 'Home'}</p>
                      <p className="text-[#64748B] leading-relaxed">
                        {order.address.street}, {order.address.city} {order.address.zipCode}
                      </p>
                    </div>
                  ) : (
                    <p className="text-[#64748B]">Saved account address</p>
                  )}
                </div>

                <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                  <span className="text-[#64748B] font-bold block mb-1">Schedule & Slot</span>
                  <div className="flex items-center gap-2 text-sm font-bold text-[#0F172A] mb-1">
                    <Clock className="w-4 h-4 text-[#1E88E5]" />
                    <span>Slot: {formatDeliverySlot(order.timeSlot)}</span>
                  </div>
                  <p className="text-[#64748B] text-[11px]">
                    Delivered via Edrops direct fulfillment network.
                  </p>
                </div>
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: Payment Breakdown & Quick Actions (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Payment Breakdown Card */}
            <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 sm:p-6 shadow-xs">
              <h3 className="font-bold text-base text-[#0F172A] pb-3 mb-4 border-b border-[#F1F5F9]">
                Payment Summary
              </h3>

              <div className="space-y-2.5 text-xs text-[#64748B]">
                <div className="flex justify-between items-center">
                  <span>Items Subtotal</span>
                  <span className="font-bold text-[#0F172A]">₹{itemsTotal}</span>
                </div>

                {depositTotal > 0 && (
                  <div className="flex justify-between items-center text-[#0F172A]">
                    <span className="flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#1E88E5]" /> Security Deposit
                    </span>
                    <span className="font-bold">₹{depositTotal}</span>
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <span>Delivery Charge</span>
                  <span className="font-bold">
                    {deliveryCharge === 0 ? <span className="text-emerald-600">FREE</span> : `₹${deliveryCharge}`}
                  </span>
                </div>

                {discountTotal > 0 && (
                  <div className="flex justify-between items-center text-emerald-600">
                    <span>Promo Discount</span>
                    <span className="font-bold">-₹{discountTotal}</span>
                  </div>
                )}

                <div className="pt-3 border-t border-[#F1F5F9] flex justify-between items-center">
                  <span className="font-bold text-sm text-[#0F172A]">
                    {order.paymentMethod === 'COD' && !['DELIVERED', 'COMPLETED'].includes(order.status) ? 'Total Due' : 'Total Paid'}
                  </span>
                  <span className="text-2xl font-black text-[#1E88E5]">₹{grandTotal}</span>
                </div>
              </div>

              {/* Payment Method Badge */}
              <div className="mt-4 pt-3 border-t border-[#F1F5F9] flex items-center justify-between text-xs">
                <span className="text-[#64748B] font-medium">Payment Mode</span>
                <span className="font-bold text-[#0F172A] bg-[#F8FAFC] px-2.5 py-1 rounded-lg border border-[#E2E8F0]">
                  {formatPaymentDetails(order).fullLabel}
                </span>
              </div>
            </div>

            {/* Quick Actions Card */}
            <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-xs space-y-3">
              <button
                type="button"
                onClick={() => generateOrderInvoice(order)}
                className="w-full py-3 rounded-xl bg-white border border-[#E2E8F0] text-[#0F172A] font-bold text-xs sm:text-sm flex items-center justify-center gap-2 hover:bg-[#F8FAFC] transition-colors cursor-pointer shadow-2xs group"
              >
                <Download className="w-4 h-4 text-[#1E88E5] group-hover:-translate-y-0.5 transition-transform" />
                Download Receipt (PDF)
              </button>
              <Link
                to="/customer/shop"
                className="w-full py-3 rounded-xl bg-[#1E88E5] text-white font-bold text-xs sm:text-sm text-center block hover:bg-[#1565C0] transition-colors shadow-xs"
              >
                Continue Shopping
              </Link>
              <Link
                to="/customer/orders"
                className="w-full py-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] font-bold text-xs sm:text-sm text-center block hover:bg-[#E2E8F0] transition-colors"
              >
                All Orders List
              </Link>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
