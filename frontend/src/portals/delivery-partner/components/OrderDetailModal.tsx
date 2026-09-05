import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  X,
  MapPin,
  Phone,
  Navigation,
  CheckCircle,
  Clock,
  Truck,
  Package,
  Calendar,
  Loader2,
  AlertCircle,
  ArrowRight,
  Coins,
  Info,
} from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';
import { useSocket } from '../../../contexts/SocketContext';
import { toast } from 'react-hot-toast';
import CompleteDeliveryModal from './CompleteDeliveryModal';
import { formatOrderId, formatPaymentDetails, getPaymentStatusLabel } from '../../../utils/orderFormatters';
import {
  getOrderStatusConfig,
  getNextPartnerAction,
  isSameStatus,
  type StatusConfig,
} from '../../../utils/orderStateMachine';

export { getOrderStatusConfig, type StatusConfig };

export interface OrderDetail {
  id: string;
  orderType: string;
  orderSource: string;
  status: string;
  subTotal: number;
  depositTotal: number;
  deliveryCharge: number;
  discountTotal: number;
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  adminNotes?: string;
  timeSlot?: string;
  createdAt: string;
  updatedAt?: string;
  customer?: {
    id: string;
    companyName?: string;
    customerType?: string;
    user?: {
      id?: string;
      firstName: string;
      lastName: string;
      phone: string;
      email?: string;
    };
  };
  address?: {
    id: string;
    street: string;
    houseName?: string;
    buildingName?: string;
    area?: string;
    landmark?: string;
    city: string;
    district?: string;
    state?: string;
    zipCode: string;
    country?: string;
    latitude?: number;
    longitude?: number;
    label?: string;
    googleMapsUrl?: string;
  };
  items?: Array<{
    id: string;
    productId: string;
    quantity: number;
    unitPrice: number;
    partnerCost?: number;
    deposit: number;
    total: number;
    product?: {
      id?: string;
      name: string;
      price: number;
      brand?: { name: string };
    };
  }>;
  payments?: Array<{
    id: string;
    amount: number;
    status: string;
    provider: string;
    createdAt: string;
  }>;
  delivery?: {
    id: string;
    status: string;
    assignment?: {
      rateSnapshot?: number;
      deliveryPartner?: {
        jarUnitPrice?: number;
        user?: { firstName: string; lastName: string; phone: string };
      };
    };
    report?: {
      partnerDeliveredQty?: number;
      partnerEmptyCollected?: number;
      partnerNotes?: string;
      partnerSubmittedAt?: string;
    };
  };
  history?: Array<{
    id: string;
    previousStatus: string;
    newStatus: string;
    reason?: string;
    createdAt: string;
    changedByUserId?: string;
    user?: {
      firstName: string;
      lastName: string;
      role?: string;
    };
  }>;
}

interface OrderDetailModalProps {
  orderId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusUpdated?: () => void;
}

const STATUS_PROGRESSION_STEPS = [
  { key: 'PLACED', label: 'Placed', icon: Clock },
  { key: 'CONFIRMED', label: 'Confirmed', icon: Package },
  { key: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', icon: Truck },
  { key: 'DELIVERED', label: 'Delivered', icon: CheckCircle },
];

export default function OrderDetailModal({
  orderId,
  isOpen,
  onClose,
  onStatusUpdated,
}: OrderDetailModalProps) {
  const { socket } = useSocket();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [completeDeliveryModalOpen, setCompleteDeliveryModalOpen] = useState(false);

  // Always fetch latest order by ID from backend when opening
  const fetchOrderDetails = useCallback(async (id: string, isSilent = false) => {
    if (!isSilent) setLoading(true);
    setErrorMessage(null);
    try {
      console.log(`[Orders] GET /order/${id}`);
      const data = await fetchWithAuth(`/order/${id}`);
      setOrder(data);
    } catch (err: any) {
      console.error('Failed to load order details:', err);
      setErrorMessage(err.message || 'Unable to load order details. Please try again.');
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen || !orderId) {
      // Clear state when modal closed
      setOrder(null);
      setErrorMessage(null);
      setLoading(false);
      setUpdatingStatus(false);
      setCompleteDeliveryModalOpen(false);
      return;
    }

    fetchOrderDetails(orderId);

    if (socket) {
      socket.emit('join-order', orderId);

      const handleStatusChanged = (payload: any) => {
        const payloadOrderId = payload?.orderId || payload?.order?.id;
        if (payloadOrderId === orderId) {
          console.log('[OrderDetailModal] Live ORDER_STATUS_CHANGED event received:', payload);
          if (payload?.order) {
            setOrder(payload.order);
          } else {
            fetchOrderDetails(orderId, true);
          }
        }
      };

      const handleOrderUpdated = (payload: any) => {
        const payloadOrderId = payload?.id || payload?.orderId;
        if (payloadOrderId === orderId) {
          console.log('[OrderDetailModal] Live order:updated event received:', payload);
          if (payload?.id && payload?.status) {
            setOrder((prev) => (prev ? { ...prev, ...payload } : payload));
          } else {
            fetchOrderDetails(orderId, true);
          }
        }
      };

      socket.on('ORDER_STATUS_CHANGED', handleStatusChanged);
      socket.on('order:updated', handleOrderUpdated);

      return () => {
        socket.emit('leave-order', orderId);
        socket.off('ORDER_STATUS_CHANGED', handleStatusChanged);
        socket.off('order:updated', handleOrderUpdated);
      };
    }
  }, [isOpen, orderId, fetchOrderDetails, socket]);

  // Extract Real Timestamps for Timeline Stages from History & DB records
  const timelineTimestamps = useMemo(() => {
    if (!order) return { placed: null, confirmed: null, outForDelivery: null, delivered: null, payment: null };

    let placedTime: string | null = order.createdAt;
    let confirmedTime: string | null = null;
    let outTime: string | null = null;
    let deliveredTime: string | null = null;
    let paymentTime: string | null = null;

    if (order.history && Array.isArray(order.history)) {
      for (const h of order.history) {
        if (
          h.newStatus === 'CONFIRMED' ||
          h.newStatus === 'ASSIGNED' ||
          h.newStatus === 'ACCEPTED_BY_PARTNER' ||
          h.newStatus === 'SHIPPED'
        ) {
          if (!confirmedTime) confirmedTime = h.createdAt;
        } else if (h.newStatus === 'OUT_FOR_DELIVERY') {
          if (!outTime) outTime = h.createdAt;
        } else if (h.newStatus === 'DELIVERED' || h.newStatus === 'COMPLETED') {
          if (!deliveredTime) deliveredTime = h.createdAt;
        }

        if (h.reason && (h.reason.includes('Payment Received') || h.reason.includes('Payment Confirmed'))) {
          if (!paymentTime) paymentTime = h.createdAt;
        }
      }
    }

    if (order.payments && order.payments.length > 0) {
      const successPmt = order.payments.find((p) => p.status === 'SUCCESS' || p.status === 'PAID');
      if (successPmt) {
        paymentTime = successPmt.createdAt;
      }
    }

    return {
      placed: placedTime,
      confirmed: confirmedTime,
      outForDelivery: outTime,
      delivered: deliveredTime,
      payment: paymentTime,
    };
  }, [order]);

  // Partner Profit Calculation Breakdown
  const profitEconomics = useMemo(() => {
    if (!order) return null;

    const rateSnapshot = order.delivery?.assignment?.rateSnapshot 
      ? Number(order.delivery.assignment.rateSnapshot) 
      : (order.delivery?.assignment?.deliveryPartner?.jarUnitPrice ? Number(order.delivery.assignment.deliveryPartner.jarUnitPrice) : 35.00);

    let customerRevenue = 0;
    let edropsCost = 0;
    let totalJars = 0;

    if (order.items && order.items.length > 0) {
      for (const item of order.items) {
        const qty = item.quantity || 1;
        totalJars += qty;
        const lineRev = Number((qty * Number(item.unitPrice || 0)).toFixed(2));
        customerRevenue += lineRev;

        const itemCost = item.partnerCost !== null && item.partnerCost !== undefined
          ? Number(item.partnerCost)
          : rateSnapshot;
        const lineCost = Number((qty * itemCost).toFixed(2));
        edropsCost += lineCost;
      }
    } else {
      customerRevenue = Number(order.subTotal || order.totalAmount || 0);
      edropsCost = Number((1 * rateSnapshot).toFixed(2));
      totalJars = 1;
    }

    customerRevenue = Number(customerRevenue.toFixed(2));
    edropsCost = Number(edropsCost.toFixed(2));
    const partnerProfit = Number((customerRevenue - edropsCost).toFixed(2));

    const isDelivered = order.status === 'DELIVERED' || order.status === 'COMPLETED';
    const paymentDetails = formatPaymentDetails(order);
    const isPaid = paymentDetails.status === 'Paid' || paymentDetails.status === 'Collected';
    const isEligible = isDelivered && isPaid;

    return {
      customerRevenue,
      edropsCost,
      partnerProfit,
      totalJars,
      isEligible,
      isPaid,
      isDelivered,
    };
  }, [order]);

  if (!isOpen) return null;

  const statusConfig = getOrderStatusConfig(order?.status);
  const currentStepIndex = statusConfig.stepIndex;

  // Next status action progression
  const getNextAction = () => {
    if (!order) return null;
    const partnerAction = getNextPartnerAction(order.status);
    if (!partnerAction) return null;
    const icon =
      partnerAction.actionType === 'CONFIRM'
        ? Package
        : partnerAction.actionType === 'START_DELIVERY'
        ? Truck
        : CheckCircle;
    return {
      ...partnerAction,
      icon,
    };
  };

  const nextAction = getNextAction();

  // Trigger Status Progression or Open Delivery Confirmation
  const handleActionClick = async () => {
    if (!nextAction || !order) return;

    // Check same-status to prevent redundant action
    if (isSameStatus(order.status, nextAction.nextStatus)) {
      toast('Order is already in this status', { icon: 'ℹ️' });
      await fetchOrderDetails(order.id, true);
      return;
    }

    if (nextAction.nextStatus === 'DELIVERED') {
      setCompleteDeliveryModalOpen(true);
    } else {
      handleUpdateStatus(nextAction.nextStatus);
    }
  };

  // Handle Controlled Status Transition with optional Payment Confirmation
  const handleUpdateStatus = async (
    newStatus: string,
    paymentConfirmation?: {
      paymentReceived: boolean;
      paymentMethod?: string;
      amountReceived?: number;
    }
  ) => {
    if (!order) return;

    // Check same-status before calling API
    if (isSameStatus(order.status, newStatus)) {
      toast('Order is already in this status', { icon: 'ℹ️' });
      await fetchOrderDetails(order.id, true);
      return;
    }

    setUpdatingStatus(true);
    setErrorMessage(null);

    try {
      console.log(`[Orders] PATCH /order/${order.id}/status -> ${newStatus}`, paymentConfirmation);
      await fetchWithAuth(`/order/${order.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: newStatus,
          reason: `Status updated by Delivery Partner to ${newStatus}`,
          paymentConfirmation,
        }),
      });

      toast.success(`Status updated to ${getOrderStatusConfig(newStatus).label}`);
      // Refetch latest order from database to ensure fresh state
      await fetchOrderDetails(order.id, true);
      if (onStatusUpdated) onStatusUpdated();
    } catch (err: any) {
      console.error('Status update error:', err);
      const msg = err.message || 'Status could not be updated. Please try again.';
      setErrorMessage(msg);
      toast.error(msg);
      // Refresh order to ensure UI state syncs with DB
      await fetchOrderDetails(order.id, true);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const customerName =
    `${order?.customer?.user?.firstName || ''} ${order?.customer?.user?.lastName || ''}`.trim() ||
    order?.customer?.companyName ||
    'Customer';

  const fullAddress = [
    order?.address?.houseName,
    order?.address?.buildingName,
    order?.address?.street,
    order?.address?.area,
    order?.address?.landmark ? `Near ${order?.address?.landmark}` : '',
    order?.address?.city,
    order?.address?.district,
    order?.address?.state,
    order?.address?.zipCode ? `- ${order?.address?.zipCode}` : '',
  ]
    .filter(Boolean)
    .join(', ');

  const formatTimelineDate = (isoStr: string | null) => {
    if (!isoStr) return null;
    const d = new Date(isoStr);
    return {
      date: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
        <div className="bg-white w-full max-w-xl max-h-[92vh] rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between bg-slate-50/80">
            <div className="flex items-center gap-2.5">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-[#16324F]">
                    Order {order ? formatOrderId(order.id) : '...'}
                  </h2>
                  {order && (
                    <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${statusConfig.badgeClass}`}>
                      {statusConfig.label}
                    </span>
                  )}
                </div>
                {order && (
                  <p className="text-[11px] text-[#64748B] flex items-center gap-1 mt-0.5">
                    <Calendar className="w-3 h-3" />
                    <span>
                      {new Date(order.createdAt).toLocaleString('en-IN', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </span>
                  </p>
                )}
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-[#16324F] hover:bg-gray-200/60 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Loading State */}
            {loading && (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs text-[#64748B]">
                <Loader2 className="w-6 h-6 animate-spin text-[#1677C8]" />
                <span>Loading fresh order details...</span>
              </div>
            )}

            {/* Error Banner */}
            {errorMessage && !loading && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{errorMessage}</span>
              </div>
            )}

            {!loading && order && (
              <>
                {/* 1. STATUS PROGRESSION & TIMELINE WITH REAL TIMESTAMPS */}
                <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-[#16324F] uppercase tracking-wider">
                      Delivery Status Timeline
                    </span>
                    {(order.status === 'DELIVERED' || order.status === 'COMPLETED') && (
                      <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Delivered
                      </span>
                    )}
                  </div>

                  {/* Visual Stepper with Timestamps */}
                  <div className="grid grid-cols-4 gap-1 sm:gap-2">
                    {STATUS_PROGRESSION_STEPS.map((step, idx) => {
                      const isCompleted = currentStepIndex > idx || currentStepIndex === 3;
                      const isCurrent = currentStepIndex === idx && currentStepIndex !== 3;
                      
                      let stageTime: string | null = null;
                      if (step.key === 'PLACED') stageTime = timelineTimestamps.placed;
                      else if (step.key === 'CONFIRMED') stageTime = timelineTimestamps.confirmed;
                      else if (step.key === 'OUT_FOR_DELIVERY') stageTime = timelineTimestamps.outForDelivery;
                      else if (step.key === 'DELIVERED') stageTime = timelineTimestamps.delivered;

                      const formatted = formatTimelineDate(stageTime);

                      return (
                        <div key={step.key} className="flex flex-col items-center text-center space-y-1">
                          <div
                            className={`h-7 w-7 rounded-full flex items-center justify-center transition-all text-xs font-bold ${
                              isCompleted
                                ? 'bg-emerald-600 text-white'
                                : isCurrent
                                ? 'bg-[#1677C8] text-white ring-2 ring-[#1677C8]/20'
                                : 'bg-gray-200 text-gray-400'
                            }`}
                          >
                            {isCompleted ? <CheckCircle className="w-4 h-4" /> : idx + 1}
                          </div>
                          <span
                            className={`text-[10px] font-semibold leading-tight ${
                              isCompleted || isCurrent ? 'text-[#16324F] font-bold' : 'text-gray-400'
                            }`}
                          >
                            {step.label}
                          </span>

                          {/* Real Database Timestamp */}
                          {formatted ? (
                            <div className="text-[9px] text-[#64748B] leading-none space-y-0.5">
                              <p className="font-medium">{formatted.date}</p>
                              <p className="text-gray-400">{formatted.time}</p>
                            </div>
                          ) : (
                            <span className="text-[9px] text-gray-300">—</span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Status Action Button */}
                  {nextAction && (
                    <div className="pt-1">
                      <button
                        type="button"
                        disabled={updatingStatus}
                        onClick={handleActionClick}
                        className={`w-full py-2.5 text-white text-xs font-bold rounded-xl shadow-2xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${nextAction.btnClass}`}
                      >
                        {updatingStatus ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Updating Status...</span>
                          </>
                        ) : (
                          <>
                            <nextAction.icon className="w-4 h-4" />
                            <span>{nextAction.label}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* 2. CUSTOMER & DELIVERY ADDRESS */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Customer Card */}
                  <div className="p-3 bg-white border border-gray-200 rounded-xl space-y-1.5">
                    <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">
                      Customer
                    </span>
                    <p className="text-xs font-bold text-[#16324F]">{customerName}</p>
                    {order.customer?.user?.phone && (
                      <a
                        href={`tel:${order.customer.user.phone}`}
                        className="inline-flex items-center gap-1 text-xs text-emerald-700 font-semibold hover:underline"
                      >
                        <Phone className="w-3 h-3 text-emerald-600" />
                        <span>{order.customer.user.phone}</span>
                      </a>
                    )}
                    {order.customer?.user?.email && (
                      <p className="text-[11px] text-[#64748B] truncate">{order.customer.user.email}</p>
                    )}
                  </div>

                  {/* Delivery Location Card */}
                  <div className="p-3 bg-white border border-gray-200 rounded-xl space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
                        Delivery Location
                      </span>
                      {fullAddress && (
                        <a
                          href={
                            order.address?.googleMapsUrl ||
                            `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`
                          }
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1677C8] hover:underline"
                        >
                          <Navigation className="w-3 h-3" />
                          <span>Navigate</span>
                        </a>
                      )}
                    </div>
                    <p className="text-xs text-[#16324F] font-semibold leading-relaxed flex items-start gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#1677C8] shrink-0 mt-0.5" />
                      <span>{fullAddress || 'Delivery Address Snapshot on file'}</span>
                    </p>
                    <span className="text-[10px] text-[#94A3B8] block">
                      {order.address?.label || 'Order Address Snapshot'}
                    </span>
                  </div>
                </div>

                {/* 3. ORDER ITEMS & PRICING */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">
                    Order Items
                  </span>
                  <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
                    {order.items && order.items.length > 0 ? (
                      order.items.map((item) => (
                        <div key={item.id} className="p-3 bg-white flex items-center justify-between text-xs">
                          <div>
                            <p className="font-bold text-[#16324F]">{item.product?.name || 'Product'}</p>
                            <p className="text-[#64748B] text-[11px] mt-0.5">
                              Qty: <strong>{item.quantity}</strong> × ₹{Number(item.unitPrice).toFixed(2)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-[#1677C8]">₹{Number(item.total).toFixed(2)}</p>
                            {item.partnerCost !== null && item.partnerCost !== undefined && (
                              <span className="text-[10px] text-[#64748B] block">
                                Cost rate: ₹{Number(item.partnerCost).toFixed(2)}
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-3 text-center text-xs text-gray-500">No items in order.</div>
                    )}
                  </div>
                </div>

                {/* 4. PAYMENT SECTION */}
                <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
                      Payment Details
                    </span>
                    {(() => {
                      const pmt = getPaymentStatusLabel(order);
                      return (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${pmt.badgeClass}`}>
                          {pmt.label}
                        </span>
                      );
                    })()}
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                    <div>
                      <span className="text-[#64748B] block">Payment Method:</span>
                      <span className="font-semibold text-[#16324F]">
                        {formatPaymentDetails(order).method}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[#64748B] block">Amount Received:</span>
                      <span className="font-bold text-[#16324F]">
                        {profitEconomics?.isPaid ? `₹${Number(order.totalAmount || 0).toFixed(2)}` : '₹0.00'}
                      </span>
                    </div>
                  </div>

                  {timelineTimestamps.payment && (
                    <div className="pt-1.5 border-t border-gray-200 flex justify-between text-[11px] text-[#64748B]">
                      <span>Paid At:</span>
                      <span className="font-medium text-[#16324F]">
                        {new Date(timelineTimestamps.payment).toLocaleString('en-IN', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </span>
                    </div>
                  )}

                  {!profitEconomics?.isPaid && (
                    <div className="p-2 bg-amber-50 rounded-lg border border-amber-200/80 text-[11px] text-amber-800 flex items-start gap-1.5 mt-1">
                      <Info className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <span>Profit is not realized until customer payment is confirmed.</span>
                    </div>
                  )}
                </div>

                {/* 5. PARTNER PROFIT ECONOMICS */}
                {profitEconomics && (
                  <div className={`p-4 rounded-xl border space-y-2 text-xs transition-all ${
                    profitEconomics.isEligible
                      ? 'bg-gradient-to-br from-emerald-50/60 to-slate-50 border-emerald-200'
                      : 'bg-slate-50 border-slate-200 text-[#64748B]'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-[#16324F] uppercase tracking-wider flex items-center gap-1.5">
                        <Coins className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Partner Profit Economics</span>
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        profitEconomics.isEligible
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {profitEconomics.isEligible ? 'Realized Profit' : 'Pending Realization'}
                      </span>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <div className="flex justify-between text-[#64748B]">
                        <span>Customer Item Revenue:</span>
                        <span className="font-bold text-[#16324F]">₹{profitEconomics.customerRevenue.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-[#64748B]">
                        <span>Edrops Partner Cost ({profitEconomics.totalJars} jars):</span>
                        <span className="font-bold text-amber-700">-₹{profitEconomics.edropsCost.toFixed(2)}</span>
                      </div>
                      {!profitEconomics.isEligible && (
                        <div className="flex justify-between text-[#64748B]">
                          <span>Potential Profit (upon payment):</span>
                          <span className="font-semibold text-slate-700">₹{profitEconomics.partnerProfit.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="pt-2 border-t border-gray-200 flex justify-between items-center text-sm font-bold text-[#16324F]">
                        <span>{profitEconomics.isEligible ? 'Realized Partner Profit:' : 'Realized Profit (Current):'}</span>
                        <span className={`text-base font-black ${
                          profitEconomics.isEligible ? 'text-emerald-700' : 'text-gray-400'
                        }`}>
                          {profitEconomics.isEligible ? `+₹${profitEconomics.partnerProfit.toFixed(2)}` : '₹0.00'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-gray-100 bg-slate-50/80 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white border border-gray-200 hover:bg-gray-100 rounded-xl text-xs font-semibold text-[#16324F] transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal when marking as DELIVERED */}
      {completeDeliveryModalOpen && order && (
        <CompleteDeliveryModal
          order={order}
          isOpen={completeDeliveryModalOpen}
          onClose={() => setCompleteDeliveryModalOpen(false)}
          onConfirm={async (data) => {
            await handleUpdateStatus('DELIVERED', data);
          }}
        />
      )}
    </>
  );
}
