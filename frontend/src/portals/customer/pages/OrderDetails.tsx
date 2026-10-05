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
  Download,
  CreditCard,
  KeyRound,
  Receipt,
  X,
} from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';
import { useSocket } from '../../../contexts/SocketContext';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '../../../components/LoadingSpinner';
import {
  formatOrderId,
  formatOrderStatus,
  formatDeliverySlot,
  formatPaymentDetails,
  getOrderPaymentState,
} from '../../../utils/orderFormatters';
import { generateOrderInvoice } from '../../../utils/InvoiceGenerator';

export default function OrderDetails() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { socket } = useSocket();
  const [order, setOrder] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payMethod, setPayMethod] = useState('UPI');
  const [isPaying, setIsPaying] = useState(false);

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

  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;
    const pst = getOrderPaymentState(order);
    if (!pst.hasDue) {
      toast.error('This order is already fully paid.');
      return;
    }

    try {
      setIsPaying(true);
      const idempotencyKey = `PAY-CUST-${order.id}-${Date.now()}`;
      await fetchWithAuth(`/orders/${order.id}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          amount: pst.due,
          paymentMethod: payMethod,
          notes: 'Customer online payment',
          idempotencyKey,
        }),
      });

      toast.success(`Payment of ₹${pst.due} processed successfully!`);
      setPayModalOpen(false);
      fetchOrder(true);
    } catch (err: any) {
      toast.error(err.message || 'Payment processing failed');
    } finally {
      setIsPaying(false);
    }
  };

  useEffect(() => {
    fetchOrder();
  }, [orderId]);

  // Real-time WebSocket updates
  useEffect(() => {
    if (!socket || !orderId) return;

    // Join order-specific room for real-time live tracking
    socket.emit('join-order', orderId);

    const handleStatusChanged = (data: { orderId: string; status: string }) => {
      if (data.orderId === orderId) {
        setOrder((prev: any) => (prev ? { ...prev, status: data.status } : prev));
        toast.success(`Order status updated: ${formatOrderStatus(data.status)}`, { icon: '📦' });
        fetchOrder();
      }
    };

    const handleOrderUpdated = (data: any) => {
      if (data && (data.id === orderId || data.orderId === orderId)) {
        if (data.status) {
          setOrder((prev: any) => (prev ? { ...prev, status: data.status, ...data } : { ...data }));
          toast.success(`Order updated: ${formatOrderStatus(data.status)}`, { icon: '📦' });
        }
        fetchOrder();
      }
    };

    socket.on('ORDER_STATUS_CHANGED', handleStatusChanged);
    socket.on('order:updated', handleOrderUpdated);
    socket.on('order:assigned', handleOrderUpdated);

    return () => {
      socket.emit('leave-order', orderId);
      socket.off('ORDER_STATUS_CHANGED', handleStatusChanged);
      socket.off('order:updated', handleOrderUpdated);
      socket.off('order:assigned', handleOrderUpdated);
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
      case 'ORDER_PLACED':
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
  const isDelivered = order.status === 'DELIVERED' || order.status === 'COMPLETED';

  // Authoritative settlement & delivery checks
  const dv = order.deliveryVerification;
  const hasDeliverySettlement = Boolean(
    order.hasDeliverySettlement ||
      (isDelivered && (order.settlement || dv?.isVerified || (dv?.calculatedTotal !== null && dv?.calculatedTotal !== undefined)))
  );

  const totalOrderedCount = (order.items || []).reduce((sum: number, i: any) => sum + (Number(i.quantity) || 0), 0);
  const totalAllocatedCount =
    order.jarAllocations && order.jarAllocations.length > 0
      ? order.jarAllocations.reduce((sum: number, a: any) => sum + (Number(a.quantity) || 0), 0)
      : totalOrderedCount;

  const deliveryData = order.delivery || (dv ? {
    completedAt: dv.completedAt || order.deliveredAt,
    otpVerified: dv.isVerified ?? true,
    dispatchedQty: dv.outForDeliveryQty || totalAllocatedCount,
    deliveredQty: dv.deliveredQty ?? (isDelivered ? totalAllocatedCount : 0),
    returnedQty: dv.returnedQty ?? 0,
    shortQty: dv.undeliveredQty ?? 0,
    shortDeliveryReason: dv.shortDeliveryReason,
    deliveryNotes: dv.deliveryNotes,
    netCustomerHolding: (dv.deliveredQty ?? 0) - (dv.returnedQty ?? 0),
    items: order.delivery?.items,
  } : null);

  const settlement = order.settlement || (dv ? {
    originalTotal: Number(order.totalAmount || 0),
    refillRate: Number(dv.refillRate || 100),
    depositRate: Number(dv.depositRate || 200),
    refillAmount: Number(dv.refillAmount || 0),
    baseDepositAmount: dv.deliveredQty && dv.depositRate
      ? Number((dv.deliveredQty * dv.depositRate).toFixed(2))
      : Number(dv.depositAmount || 0),
    returnDeduction: dv.returnedQty && dv.depositRate
      ? Number((dv.returnedQty * dv.depositRate).toFixed(2))
      : 0,
    finalDepositAmount: Number(dv.depositAmount || 0),
    calculatedTotal: Number(dv.calculatedTotal ?? order.totalAmount ?? 0),
    actualAmountReceived: Number(dv.amountReceived ?? 0),
    remainingDue: Number(order.dueAmount ?? order.amountDue ?? 0),
    paymentMethod: dv.paymentMethod || order.paymentMethod || 'CASH',
  } : null);

  const driverInfo = order.driver || (order.delivery?.assignment?.deliveryPartner ? {
    name: `${order.delivery.assignment.deliveryPartner.user?.firstName || ''} ${order.delivery.assignment.deliveryPartner.user?.lastName || ''}`.trim() || 'Assigned Delivery Partner',
    phone: order.delivery.assignment.deliveryPartner.user?.phone,
    vehicleNumber: order.delivery.assignment.deliveryPartner.vehicleNumber,
    vehicleType: order.delivery.assignment.deliveryPartner.vehicleType,
    routeOrArea: undefined,
  } : null);

  const completedAtFormatted = deliveryData?.completedAt
    ? new Date(deliveryData.completedAt).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;

  const timelineSteps = [
    { title: 'Order Placed', desc: 'Order logged & placed' },
    { title: 'Confirmed', desc: 'Order confirmed & accepted' },
    { title: 'Out for Delivery', desc: 'Delivery partner on the way' },
    {
      title: 'Delivered',
      desc: hasDeliverySettlement && deliveryData ? (
        <span>
          {completedAtFormatted ? `${completedAtFormatted} · ` : ''}
          {deliveryData.deliveredQty} jars delivered
          {deliveryData.returnedQty > 0 && ` · ${deliveryData.returnedQty} returned`}
          {settlement && ` · ₹${settlement.calculatedTotal.toFixed(2)}`}
          {deliveryData.otpVerified && ' · ✓ Verified'}
        </span>
      ) : (
        'Order delivered successfully'
      ),
    },
  ];

  const itemsTotal = order.items?.reduce(
    (sum: number, i: any) => sum + safeNumber(i.unitPrice || i.price) * safeNumber(i.quantity),
    0
  ) || safeNumber(order.subTotal);

  const depositTotal = safeNumber(order.depositTotal);
  const discountTotal = safeNumber(order.discountTotal);

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
                  Order {formatOrderId(order.id)}
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
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-2 text-rose-900">
                  <div className="flex items-center gap-2.5">
                    <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                    <div>
                      <h4 className="font-bold text-sm text-rose-900">This order was cancelled</h4>
                      {order.cancelledAt && (
                        <p className="text-[11px] text-rose-500">
                          Cancelled on {new Date(order.cancelledAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
                  </div>
                  {order.cancellationReason && (
                    <div className="pl-7 text-xs text-rose-800">
                      <span className="font-semibold">Reason:</span> {order.cancellationReason}
                    </div>
                  )}
                  <p className="pl-7 text-xs text-rose-600">
                    Any payments or wallet deductions have been reversed or credited. If you have questions, please reach out to customer support.
                  </p>
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
              {driverInfo && (
                <div className="mt-6 pt-5 border-t border-[#F1F5F9] bg-[#F8FAFC] p-4 rounded-xl border border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#EBF5FB] border border-[#BBDFF2] flex items-center justify-center text-[#1E88E5]">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#64748B] tracking-wider block">Assigned Delivery Partner</span>
                      <h4 className="text-sm font-bold text-[#0F172A]">
                        {driverInfo.name}
                      </h4>
                      {(driverInfo.vehicleType || driverInfo.vehicleNumber) && (
                        <span className="text-[11px] text-[#64748B] block">
                          Vehicle: {[driverInfo.vehicleType, driverInfo.vehicleNumber].filter(Boolean).join(' · ')}
                        </span>
                      )}
                    </div>
                  </div>

                  {driverInfo.phone && (
                    <a
                      href={`tel:${driverInfo.phone}`}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#1E88E5] text-white text-xs font-bold hover:bg-[#1565C0] transition-colors shadow-xs"
                    >
                      <Phone className="w-3.5 h-3.5" /> Call Partner
                    </a>
                  )}
                </div>
              )}
            </motion.div>

            {/* Delivery Result & Physical Jar Movement (Visible only for completed delivery) */}
            {hasDeliverySettlement && deliveryData && (
              <div className="bg-white rounded-2xl border border-emerald-200 p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-emerald-100/80">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900 leading-tight">
                        Delivery Result & Physical Jar Movement
                      </h3>
                      {completedAtFormatted && (
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Delivery completed on {completedAtFormatted}
                        </p>
                      )}
                    </div>
                  </div>
                  {deliveryData.otpVerified && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100/90 px-2.5 py-1 rounded-full border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5" /> PIN Verified
                    </span>
                  )}
                </div>

                {/* 6-Stat Grid for Complete Physical Handover Reconciliation */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-center">
                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
                      Ordered
                    </span>
                    <span className="text-base font-black text-slate-800">
                      {totalOrderedCount} <span className="text-xs font-normal text-slate-500">jars</span>
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-center">
                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
                      Dispatched
                    </span>
                    <span className="text-base font-black text-slate-800">
                      {deliveryData.dispatchedQty} <span className="text-xs font-normal text-slate-500">jars</span>
                    </span>
                  </div>

                  <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200 text-center">
                    <span className="text-[10px] uppercase font-bold text-emerald-700 tracking-wider block">
                      Delivered
                    </span>
                    <span className="text-base font-black text-emerald-800">
                      {deliveryData.deliveredQty} <span className="text-xs font-normal text-emerald-600">jars</span>
                    </span>
                  </div>

                  <div className={`p-3 rounded-xl border text-center ${deliveryData.shortQty > 0 ? "bg-amber-50/80 border-amber-200" : "bg-slate-50 border-slate-200/80"}`}>
                    <span className={`text-[10px] uppercase font-bold tracking-wider block ${deliveryData.shortQty > 0 ? "text-amber-800" : "text-slate-500"}`}>
                      Undelivered
                    </span>
                    <span className={`text-base font-black ${deliveryData.shortQty > 0 ? "text-amber-900" : "text-slate-800"}`}>
                      {deliveryData.shortQty} <span className="text-xs font-normal text-slate-500">jars</span>
                    </span>
                  </div>

                  <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-200 text-center">
                    <span className="text-[10px] uppercase font-bold text-indigo-700 tracking-wider block">
                      Returned Empty
                    </span>
                    <span className="text-base font-black text-indigo-800">
                      {deliveryData.returnedQty} <span className="text-xs font-normal text-indigo-600">jars</span>
                    </span>
                  </div>

                  <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200 text-center">
                    <span className="text-[10px] uppercase font-bold text-blue-700 tracking-wider block">
                      Customer Holding
                    </span>
                    <span className="text-base font-black text-blue-800">
                      {(deliveryData.netCustomerHolding ?? 0) >= 0
                        ? `+${deliveryData.netCustomerHolding}`
                        : deliveryData.netCustomerHolding}{' '}
                      <span className="text-xs font-normal text-blue-600">jars</span>
                    </span>
                  </div>
                </div>

                {/* Short delivery reason if applicable */}
                {deliveryData.shortQty > 0 && (
                  <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl space-y-1 text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-amber-900">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>
                        Short Delivery: {deliveryData.shortQty} jar{deliveryData.shortQty === 1 ? '' : 's'} undelivered
                      </span>
                    </div>
                    {deliveryData.shortDeliveryReason && (
                      <p className="text-amber-800 pl-5">
                        <span className="font-semibold">Reason:</span> {deliveryData.shortDeliveryReason}
                      </p>
                    )}
                  </div>
                )}

                {/* Multi-item allocations breakdown if order had multiple items */}
                {deliveryData.items && deliveryData.items.length > 1 && (
                  <div className="pt-2 border-t border-slate-100 space-y-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                      Item Delivery Details
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {deliveryData.items.map((it: any, idx: number) => (
                        <div key={it.id || idx} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/70 text-xs">
                          <span className="font-bold text-slate-800 block truncate">{it.name}</span>
                          <div className="text-[11px] text-slate-600 flex items-center gap-2 mt-0.5">
                            <span>Delivered: <strong>{it.deliveredQty}</strong></span>
                            <span>•</span>
                            <span>Returned: <strong>{it.returnedQty}</strong></span>
                            <span>•</span>
                            <span className="text-blue-700 font-semibold">Holding: +{it.netCustomerHolding}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {deliveryData.deliveryNotes && (
                  <div className="text-xs text-slate-600 pl-1 pt-1">
                    <span className="font-semibold">Delivery Note:</span> {deliveryData.deliveryNotes}
                  </div>
                )}
              </div>
            )}

            {/* Items Ordered Card (Historical Snapshot Preserved) */}
            <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 sm:p-6 shadow-xs">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#F1F5F9]">
                <h2 className="text-base font-bold text-[#0F172A] flex items-center gap-2">
                  <Package className="w-5 h-5 text-[#1E88E5]" /> Items Ordered ({order.items?.length || 0})
                </h2>
                {hasDeliverySettlement && (
                  <span className="text-[11px] font-semibold text-slate-400">
                    Original Order Snapshot
                  </span>
                )}
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
                          Ordered: <strong className="text-[#0F172A]">{itemQty}</strong> × ₹{itemPrice}
                          {itemDeposit > 0 && ` · Deposit ₹${itemDeposit}`}
                        </p>

                        {/* If completed delivery, show actual delivery result on item */}
                        {hasDeliverySettlement && (
                          <p className="text-[11px] text-emerald-700 font-semibold mt-0.5">
                            Delivered: {deliveryData?.deliveredQty ?? itemQty} · Returned: {deliveryData?.returnedQty ?? 0}
                          </p>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-extrabold text-sm sm:text-base text-[#0F172A]">
                          ₹{(itemPrice * itemQty + (item.deposit || 0)).toFixed(2)}
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
            
            {/* Delivery Verification PIN Card (Before Delivery) */}
            {order.deliveryVerification?.otp && !isCancelled && order.status !== 'DELIVERED' && order.status !== 'COMPLETED' && (
              <div className="bg-gradient-to-br from-sky-50 via-white to-blue-50/40 rounded-2xl border-2 border-sky-200 p-5 shadow-xs">
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-sky-100">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-[#1E88E5] text-white flex items-center justify-center font-bold">
                      <KeyRound className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-[#0F172A]">Delivery Verification</h3>
                      <p className="text-[11px] text-[#64748B]">Share with driver upon arrival</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-sky-700 bg-sky-100/80 px-2.5 py-1 rounded-full border border-sky-200">
                    PIN GENERATED
                  </span>
                </div>

                <div className="text-center py-3 bg-white rounded-xl border border-sky-100 my-2 shadow-2xs">
                  <p className="text-[11px] font-semibold text-[#64748B] mb-1">Your Delivery Verification PIN</p>
                  <div className="text-3xl font-black tracking-widest text-[#1E88E5] font-mono select-all">
                    {order.deliveryVerification.otp}
                  </div>
                </div>

                <p className="text-[11px] text-center text-[#64748B] mt-2">
                  Give this PIN to the delivery person when your order is delivered to verify handover.
                </p>
              </div>
            )}

            {/* Final Delivery Settlement Breakdown Card (Only shown for completed delivery orders) */}
            {hasDeliverySettlement && settlement && (
              <div className="bg-white rounded-2xl border border-sky-200 p-5 sm:p-6 shadow-xs">
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-sky-100">
                  <h3 className="font-bold text-base text-[#0F172A] flex items-center gap-2">
                    <Receipt className="w-5 h-5 text-[#1E88E5]" />
                    Final Delivery Settlement
                  </h3>
                  <span className="text-[10px] font-bold text-sky-700 bg-sky-50 px-2.5 py-0.5 rounded-full border border-sky-200">
                    ACTUAL RECONCILIATION
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  {/* Refill Calculation */}
                  {(() => {
                    const deliveredQty = deliveryData?.deliveredQty ?? 0;
                    const returnedQty = deliveryData?.returnedQty ?? 0;
                    const rRate = deliveryData?.items?.[0]?.refillRate ?? (deliveredQty > 0 ? settlement.refillAmount / deliveredQty : 0);
                    const dRate = deliveryData?.items?.[0]?.depositRate ?? (deliveredQty > 0 ? settlement.baseDepositAmount / deliveredQty : 0);
                    const depositBearingCount = Math.max(0, deliveredQty - returnedQty);

                    return (
                      <>
                        <div className="flex justify-between items-center text-[#64748B]">
                          <span>
                            Refill ({deliveredQty} × ₹{rRate.toFixed(2)})
                          </span>
                          <span className="font-semibold text-[#0F172A]">
                            ₹{settlement.refillAmount.toFixed(2)}
                          </span>
                        </div>

                        <div className="flex justify-between items-center text-[#64748B]">
                          <span>
                            Jar Deposit ({deliveredQty} × ₹{dRate.toFixed(2)})
                          </span>
                          <span className="font-semibold text-[#0F172A]">
                            ₹{settlement.baseDepositAmount.toFixed(2)}
                          </span>
                        </div>

                        {settlement.returnDeduction > 0 && (
                          <div className="flex justify-between items-center text-emerald-600 font-medium">
                            <span>
                              Returned Empty ({returnedQty} × ₹{dRate.toFixed(2)})
                            </span>
                            <span className="font-bold text-emerald-600">
                              −₹{settlement.returnDeduction.toFixed(2)}
                            </span>
                          </div>
                        )}

                        <div className="flex justify-between items-center text-xs pt-2 border-t border-dashed border-slate-200">
                          <span className="text-slate-600 font-medium">
                            Final Deposit ({depositBearingCount} deposit-bearing jar{depositBearingCount === 1 ? '' : 's'})
                          </span>
                          <span className="font-bold text-slate-800">
                            ₹{settlement.finalDepositAmount.toFixed(2)}
                          </span>
                        </div>

                        <div className="pt-3 border-t border-[#F1F5F9] flex justify-between items-center">
                          <div>
                            <span className="font-extrabold text-sm text-[#0F172A] block">
                              Final Delivery Amount
                            </span>
                            <span className="text-[11px] text-[#64748B]">
                              Original Order Total: <span className="line-through">₹{Number(order.totalAmount || 0).toFixed(2)}</span>
                            </span>
                          </div>
                          <span className="text-lg font-black text-[#1E88E5]">
                            ₹{settlement.calculatedTotal.toFixed(2)}
                          </span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Payment Summary Card */}
            <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 sm:p-6 shadow-xs">
              <h3 className="font-bold text-base text-[#0F172A] pb-3 mb-4 border-b border-[#F1F5F9]">
                Payment Summary
              </h3>

              {/* Pre-delivery order breakdown */}
              {!hasDeliverySettlement && (
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

                  {discountTotal > 0 && (
                    <div className="flex justify-between items-center text-emerald-600">
                      <span>Promo Discount</span>
                      <span className="font-bold">-₹{discountTotal}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Completed delivery financial summary */}
              {hasDeliverySettlement && (
                <div className="space-y-2 text-xs text-[#64748B]">
                  <div className="flex justify-between items-center">
                    <span>Original Order</span>
                    <span className="font-medium text-slate-500 line-through">
                      ₹{Number(order.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-[#0F172A]">Final Delivery Settlement</span>
                    <span className="font-bold text-[#0F172A]">
                      ₹{Number(settlement?.calculatedTotal ?? order.totalAmount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              )}

              {(() => {
                const pst = getOrderPaymentState(order);
                return (
                  <div className="pt-3 border-t border-[#F1F5F9] space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-[#64748B]">Paid</span>
                      <span className="font-bold text-emerald-600">
                        ₹{pst.paid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-[#64748B]">Remaining Due</span>
                      <span className={`font-bold ${pst.hasDue ? 'text-orange-600' : 'text-emerald-600'}`}>
                        ₹{pst.due.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    {pst.canonicalStatus === 'OVERPAID' && (
                      <div className="flex justify-between items-center text-xs text-sky-600">
                        <span className="font-semibold">Credit / Excess</span>
                        <span className="font-bold">
                          ₹{Math.max(0, pst.paid - pst.total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between items-center text-xs pt-1.5 border-t border-[#F1F5F9]">
                      <span className="font-semibold text-[#64748B]">Payment Status</span>
                      <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] border ${pst.badgeClass}`}>
                        {pst.canonicalStatus === 'PAID' ? 'PAID' : pst.canonicalStatus === 'PARTIALLY_PAID' ? 'PARTIALLY PAID' : pst.canonicalStatus === 'OVERPAID' ? 'OVERPAID' : 'UNPAID'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[#64748B] font-medium">Payment Method</span>
                      <span className="font-bold text-[#0F172A] bg-[#F8FAFC] px-2.5 py-1 rounded-lg border border-[#E2E8F0]">
                        {settlement?.paymentMethod || formatPaymentDetails(order).method}
                      </span>
                    </div>

                    {pst.hasDue && order.status !== 'CANCELLED' && (
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => setPayModalOpen(true)}
                          className="w-full py-2.5 px-3 bg-[#1E88E5] hover:bg-[#1565C0] text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <CreditCard className="w-4 h-4" />
                          <span>Pay Outstanding Balance (₹{pst.due.toLocaleString('en-IN', { minimumFractionDigits: 2 })})</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Delivery Driver Information Card (Only if driver data is available) */}
            {driverInfo && (
              <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-xs space-y-3">
                <h3 className="font-bold text-xs text-[#0F172A] uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-[#F1F5F9]">
                  <Truck className="w-4 h-4 text-[#1E88E5]" />
                  Delivery Driver
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Driver</span>
                    <span className="font-bold text-slate-800">{driverInfo.name}</span>
                  </div>
                  {(driverInfo.vehicleType || driverInfo.vehicleNumber) && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Vehicle</span>
                      <span className="font-semibold text-slate-700">
                        {[driverInfo.vehicleType, driverInfo.vehicleNumber].filter(Boolean).join(' · ')}
                      </span>
                    </div>
                  )}
                  {driverInfo.routeOrArea && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Route</span>
                      <span className="font-semibold text-slate-700">{driverInfo.routeOrArea}</span>
                    </div>
                  )}
                  {completedAtFormatted && (
                    <div className="flex justify-between items-center pt-1 border-t border-slate-100">
                      <span className="text-slate-500">Completed At</span>
                      <span className="font-medium text-slate-700">{completedAtFormatted}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Payment History Card (actual payment events only) */}
            {order.payments && order.payments.length > 0 && (
              <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-xs space-y-3">
                <h3 className="font-bold text-xs text-[#0F172A] uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-[#F1F5F9]">
                  <CreditCard className="w-4 h-4 text-[#1E88E5]" />
                  Payment History ({order.payments.length})
                </h3>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {order.payments.map((pmt: any) => (
                    <div key={pmt.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-[#0F172A]">₹{Number(pmt.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                        <div className="text-[10px] text-slate-500 font-medium">
                          {pmt.provider} · {new Date(pmt.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {pmt.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

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

      {/* ─── MODAL: CUSTOMER ONLINE PAYMENT ──────────────────────── */}
      {payModalOpen && (() => {
        const pst = getOrderPaymentState(order);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-black text-slate-800 text-base flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-[#1E88E5]" />
                    Pay Outstanding Balance
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Order: <span className="font-bold text-slate-800">#ORD-{formatOrderId(order.id)}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPayModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handlePaySubmit} className="space-y-4">
                {/* Breakdown */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-semibold">Total Order Amount:</span>
                    <span className="font-bold text-slate-800">₹{pst.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-semibold">Already Paid:</span>
                    <span className="font-bold text-emerald-600">₹{pst.paid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-slate-200/70 font-black text-sm">
                    <span className="text-orange-700">Amount Due:</span>
                    <span className="text-orange-700">₹{pst.due.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Select Payment Method
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'UPI', label: 'UPI / QR' },
                      { id: 'RAZORPAY', label: 'Online' },
                      { id: 'CARD', label: 'Card' },
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPayMethod(m.id)}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center cursor-pointer ${
                          payMethod === m.id
                            ? 'border-[#1E88E5] bg-blue-50/70 text-[#1E88E5] shadow-2xs'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setPayModalOpen(false)}
                    className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isPaying}
                    className="px-4 py-2.5 bg-[#1E88E5] hover:bg-[#1565C0] text-white rounded-xl text-xs font-bold disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-xs"
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>{isPaying ? 'Processing...' : `Pay ₹${pst.due}`}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
