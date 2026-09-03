import { useState, useEffect, useCallback } from 'react';
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
  User,
} from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';

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
    deposit: number;
    total: number;
    product?: {
      id?: string;
      name: string;
      price: number;
      brand?: { name: string };
    };
  }>;
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

// 4 Standard Display Statuses
export interface StatusConfig {
  label: string;
  badgeClass: string;
  dotColor: string;
  stepIndex: number;
}

export function getOrderStatusConfig(status?: string): StatusConfig {
  switch (status) {
    case 'NEW':
    case 'PLACED':
    case 'PENDING_ASSIGNMENT':
    case 'ASSIGNED':
      return {
        label: 'Placed',
        badgeClass: 'bg-amber-50 text-amber-800 border border-amber-200',
        dotColor: 'bg-amber-500',
        stepIndex: 0,
      };
    case 'ACCEPTED_BY_PARTNER':
    case 'SHIPPED':
      return {
        label: 'Shipped',
        badgeClass: 'bg-blue-50 text-blue-700 border border-blue-200',
        dotColor: 'bg-[#1677C8]',
        stepIndex: 1,
      };
    case 'OUT_FOR_DELIVERY':
      return {
        label: 'Out for Delivery',
        badgeClass: 'bg-orange-50 text-orange-700 border border-orange-200',
        dotColor: 'bg-orange-500',
        stepIndex: 2,
      };
    case 'DELIVERED':
    case 'COMPLETED':
      return {
        label: 'Delivered',
        badgeClass: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
        dotColor: 'bg-emerald-600',
        stepIndex: 3,
      };
    case 'CANCELLED':
      return {
        label: 'Cancelled',
        badgeClass: 'bg-rose-50 text-rose-700 border border-rose-200',
        dotColor: 'bg-rose-500',
        stepIndex: -1,
      };
    default:
      return {
        label: status || 'Placed',
        badgeClass: 'bg-slate-100 text-slate-700 border border-slate-200',
        dotColor: 'bg-slate-400',
        stepIndex: 0,
      };
  }
}

const STATUS_PROGRESSION_STEPS = [
  { key: 'PLACED', label: 'Placed', icon: Clock },
  { key: 'SHIPPED', label: 'Shipped', icon: Package },
  { key: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', icon: Truck },
  { key: 'DELIVERED', label: 'Delivered', icon: CheckCircle },
];

export default function OrderDetailModal({
  orderId,
  isOpen,
  onClose,
  onStatusUpdated,
}: OrderDetailModalProps) {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Always fetch latest order by ID from backend when opening
  const fetchOrderDetails = useCallback(async (id: string) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      console.log(`[Orders] GET /order/${id}`);
      const data = await fetchWithAuth(`/order/${id}`);
      setOrder(data);
    } catch (err: any) {
      console.error('Failed to load order details:', err);
      setErrorMessage(err.message || 'Unable to load order details. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && orderId) {
      fetchOrderDetails(orderId);
    } else {
      // Clear state when modal closed
      setOrder(null);
      setErrorMessage(null);
      setLoading(false);
      setUpdatingStatus(false);
    }
  }, [isOpen, orderId, fetchOrderDetails]);

  if (!isOpen) return null;

  const statusConfig = getOrderStatusConfig(order?.status);
  const currentStepIndex = statusConfig.stepIndex;

  // Next status action progression
  const getNextAction = () => {
    if (!order) return null;
    switch (order.status) {
      case 'NEW':
      case 'PLACED':
      case 'PENDING_ASSIGNMENT':
      case 'ASSIGNED':
        return {
          label: 'Mark as Shipped',
          nextStatus: 'ACCEPTED_BY_PARTNER',
          icon: Package,
          btnClass: 'bg-[#1677C8] hover:bg-[#1362a4]',
        };
      case 'ACCEPTED_BY_PARTNER':
      case 'SHIPPED':
        return {
          label: 'Start Delivery (Out for Delivery)',
          nextStatus: 'OUT_FOR_DELIVERY',
          icon: Truck,
          btnClass: 'bg-orange-600 hover:bg-orange-700',
        };
      case 'OUT_FOR_DELIVERY':
        return {
          label: 'Mark Delivered',
          nextStatus: 'DELIVERED',
          icon: CheckCircle,
          btnClass: 'bg-emerald-600 hover:bg-emerald-700',
        };
      default:
        return null;
    }
  };

  const nextAction = getNextAction();

  // Handle Controlled Status Transition
  const handleUpdateStatus = async (newStatus: string) => {
    if (!order) return;
    setUpdatingStatus(true);
    setErrorMessage(null);

    try {
      console.log(`[Orders] PATCH /order/${order.id}/status -> ${newStatus}`);
      await fetchWithAuth(`/order/${order.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: newStatus,
          reason: `Status advanced by Delivery Partner to ${newStatus}`,
        }),
      });

      // Refetch latest order from database to ensure fresh state
      await fetchOrderDetails(order.id);
      if (onStatusUpdated) onStatusUpdated();
    } catch (err: any) {
      console.error('Status update error:', err);
      setErrorMessage(err.message || 'Status could not be updated. Please try again.');
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

  // Determine Creator from Order Status History
  const firstHistoryItem = order?.history && order?.history.length > 0 ? order.history[0] : null;
  const creatorName = firstHistoryItem?.user
    ? `${firstHistoryItem.user.firstName} ${firstHistoryItem.user.lastName}`.trim()
    : 'Delivery Partner';
  const creatorRole = firstHistoryItem?.user?.role
    ? firstHistoryItem.user.role.replace('_', ' ')
    : 'DELIVERY PARTNER';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white w-full max-w-xl max-h-[92vh] rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[#16324F]">
                  Order #{order ? order.id.slice(-6).toUpperCase() : '...'}
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
              {/* 1. STATUS PROGRESSION TIMELINE */}
              <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-[#16324F] uppercase tracking-wider">
                    Delivery Progression
                  </span>
                  {(order.status === 'DELIVERED' || order.status === 'COMPLETED') && (
                    <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Delivered
                    </span>
                  )}
                </div>

                {/* Timeline Stepper */}
                <div className="grid grid-cols-4 gap-1 sm:gap-2">
                  {STATUS_PROGRESSION_STEPS.map((step, idx) => {
                    const isCompleted = currentStepIndex > idx || currentStepIndex === 3;
                    const isCurrent = currentStepIndex === idx && currentStepIndex !== 3;

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
                      onClick={() => handleUpdateStatus(nextAction.nextStatus)}
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

              {/* 2. CUSTOMER & DELIVERY ADDRESS (NO MAP) */}
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

                {/* Delivery Location Card (Clean Address Snapshot) */}
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

              {/* 3. ORDER ITEMS */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">
                  Order Items
                </span>
                <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
                  {order.items && order.items.length > 0 ? (
                    order.items.map((item) => (
                      <div key={item.id} className="p-2.5 bg-white flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-[#16324F]">{item.product?.name || 'Product'}</p>
                          <p className="text-[#64748B] text-[11px]">
                            Qty: {item.quantity} × ₹{Number(item.unitPrice).toFixed(2)}
                          </p>
                        </div>
                        <p className="font-bold text-[#1677C8]">₹{Number(item.total).toFixed(2)}</p>
                      </div>
                    ))
                  ) : (
                    <div className="p-3 text-center text-xs text-gray-500">No items in order.</div>
                  )}
                </div>
              </div>

              {/* 4. FINANCIAL SUMMARY */}
              <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1.5 text-xs">
                <div className="flex justify-between text-[#64748B]">
                  <span>Subtotal</span>
                  <span>₹{Number(order.subTotal || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[#64748B]">
                  <span>Delivery Charge</span>
                  <span>₹{Number(order.deliveryCharge || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[#64748B]">
                  <span>Discount</span>
                  <span>₹{Number(order.discountTotal || 0).toFixed(2)}</span>
                </div>
                <div className="pt-1.5 border-t border-gray-200 flex justify-between items-center text-sm font-bold text-[#16324F]">
                  <span>Total Amount</span>
                  <span className="text-base text-[#1677C8]">₹{Number(order.totalAmount || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-[11px] text-[#64748B] pt-1">
                  <span>Method: {order.paymentMethod ? order.paymentMethod.replace(/_/g, ' ') : 'Cash on Delivery'}</span>
                  <span>Payment: {order.paymentStatus}</span>
                </div>
              </div>

              {/* 5. CREATED BY INFO */}
              <div className="p-3 bg-blue-50/40 border border-blue-100 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-full bg-[#1677C8] text-white flex items-center justify-center font-bold text-xs">
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="font-bold text-[#16324F]">{creatorName}</p>
                    <p className="text-[10px] text-[#64748B]">{creatorRole}</p>
                  </div>
                </div>
                <div className="text-right text-[10px] text-[#64748B]">
                  <p>{new Date(order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                  <p>{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
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
  );
}
