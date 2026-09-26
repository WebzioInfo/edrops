import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  Truck,
  CheckCircle,
  Ban,
  ChevronDown,
  UserCheck,
  MapPin,
  Calendar,
  CreditCard,
  AlertTriangle,
  Package,
  ShieldCheck,
  X,
  Phone,
} from 'lucide-react';
import { formatOrderId, formatOrderStatus, formatPaymentDetails, formatDeliverySlot, getOrderPaymentState } from '../../../utils/orderFormatters';

export interface Distributor {
  id: string;
  userId?: string;
  role?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    email?: string;
  };
}

export type DeliveryPartner = Distributor;

interface OrderRowProps {
  order: any;
  partners?: Distributor[];
  distributors?: Distributor[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onStatusUpdate: (orderId: string, newStatus: string, paymentConfirmation?: any, reason?: string) => Promise<void>;
  onAssignPartner?: (orderId: string, deliveryPartnerId: string) => Promise<void>;
  onAssignDistributor?: (orderId: string, distributorId: string) => Promise<void>;
  onCollect?: (order: any) => void;
  isAssigning: boolean;
}

export default function OrderRow({
  order,
  partners = [],
  distributors = [],
  isExpanded,
  onToggleExpand,
  onStatusUpdate,
  onAssignPartner,
  onAssignDistributor,
  onCollect,
  isAssigning,
}: OrderRowProps) {
  const distributorList = distributors.length > 0 ? distributors : partners;
  const handleAssign = onAssignDistributor || onAssignPartner;

  const [partnerPromptError, setPartnerPromptError] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [paymentCollected, setPaymentCollected] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState<string | null>(null);
  const partnerSelectRef = useRef<HTMLSelectElement>(null);

  const handleConfirmCancel = async () => {
    if (!cancelReason.trim()) {
      setCancelError('Please specify a cancellation reason.');
      return;
    }
    setCancelError(null);
    setUpdatingStatus(true);
    try {
      await onStatusUpdate(order.id, 'CANCELLED', undefined, cancelReason.trim());
      setShowCancelModal(false);
      setCancelReason('');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const payment = formatPaymentDetails(order);
  const rawMethod = (order.paymentMethod || '').toUpperCase();
  const isCOD = rawMethod === 'COD' || rawMethod === 'CASH_ON_DELIVERY' || rawMethod.includes('COD') || rawMethod.includes('CASH');


  const matchedDist = order.distributorId
    ? distributorList.find((d: any) => d.id === order.distributorId || d.userId === order.distributorId)
    : null;
  const assignedDistributor =
    order.distributor ||
    (matchedDist ? ((matchedDist as any).user || matchedDist) : null) ||
    order.delivery?.assignment?.deliveryPartner?.user;

  const assignedDistributorId = order.distributorId || order.delivery?.assignment?.deliveryPartnerId;
  const isAssigned = !!(order.distributorId || order.distributor || (order.assignmentStatus && order.assignmentStatus !== 'UNASSIGNED'));

  const isDelivered = order.status === 'DELIVERED' || order.status === 'COMPLETED';
  const isCancelled = order.status === 'CANCELLED';

  // STAFF ASSIGNMENT RULE:
  // Staff may assign a distributor ONLY when:
  // - order status = ORDER PLACED (or NEW/PENDING)
  // - distributorId is NULL and assignmentStatus === 'UNASSIGNED'
  // If a distributor has already accepted or been assigned:
  // - status = CONFIRMED or later
  // - distributorId exists
  // Then Staff MUST NOT be able to assign/reassign the order. Hide or disable assignment control completely.
  const canAssignDistributor = !isAssigned && ['ORDER_PLACED', 'NEW', 'PENDING', 'PENDING_ASSIGNMENT'].includes(order.status);

  // Condensed Item summary string (e.g. "1x Edrops 20L Jar, 2x 10L Dispenser")
  const itemsSummary = order.items && order.items.length > 0
    ? order.items.map((i: any) => `${i.quantity}x ${i.product?.name || 'Item'}`).join(', ')
    : 'No items';

  // Status icon config
  const getStatusIcon = () => {
    if (isDelivered) return <CheckCircle className="h-4 w-4 text-emerald-600" />;
    if (isCancelled) return <Ban className="h-4 w-4 text-rose-600" />;
    if (['CONFIRMED', 'ASSIGNED', 'ACCEPTED_BY_PARTNER', 'OUT_FOR_DELIVERY'].includes(order.status)) {
      return <Truck className="h-4 w-4 text-blue-600" />;
    }
    return <Clock className="h-4 w-4 text-amber-600" />;
  };

  const getStatusIconBg = () => {
    if (isDelivered) return 'bg-emerald-50 border-emerald-200';
    if (isCancelled) return 'bg-rose-50 border-rose-200';
    if (['CONFIRMED', 'ASSIGNED', 'ACCEPTED_BY_PARTNER', 'OUT_FOR_DELIVERY'].includes(order.status)) {
      return 'bg-blue-50 border-blue-200';
    }
    return 'bg-amber-50 border-amber-200';
  };

  const getStatusBadgeStyle = () => {
    switch (order.status) {
      case 'DELIVERED':
      case 'COMPLETED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'CANCELLED':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'OUT_FOR_DELIVERY':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'CONFIRMED':
      case 'ASSIGNED':
      case 'ACCEPTED_BY_PARTNER':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'ORDER_PLACED':
      case 'NEW':
      case 'PENDING':
      case 'PENDING_ASSIGNMENT':
      case 'PENDING_PAYMENT':
      default:
        return 'bg-amber-50 text-amber-700 border-amber-200';
    }
  };

  const handleDistributorSelect = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (!val || !handleAssign) return;
    setPartnerPromptError(null);
    try {
      await handleAssign(order.id, val);
    } catch {
      // Assignment failed; do not attempt subsequent status transitions
    }
  };

  const handleMoveToOutForDelivery = async () => {
    if (isAssigning || updatingStatus) return;
    if (!assignedDistributorId && !assignedDistributor) {
      setPartnerPromptError('Please ensure a distributor is assigned before marking this order out for delivery.');
      return;
    }

    setPartnerPromptError(null);
    setUpdatingStatus(true);
    try {
      await onStatusUpdate(order.id, 'OUT_FOR_DELIVERY');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleStatusChange = async (targetStatus: string, paymentConfirmation?: any) => {
    if (isAssigning || updatingStatus) return;
    setPartnerPromptError(null);
    setUpdatingStatus(true);
    try {
      await onStatusUpdate(order.id, targetStatus, paymentConfirmation);
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <div className={`transition-colors border-b border-[#E2E8F0] last:border-b-0 ${isExpanded ? 'bg-[#F8FAFC]/70' : 'hover:bg-[#F8FAFC]/50 bg-white'}`}>
      {/* 1. COLLAPSED ROW — COMPACT DEFAULT STATE */}
      <div
        onClick={onToggleExpand}
        className="py-3 px-4 sm:px-6 flex items-center justify-between gap-3 cursor-pointer select-none group"
      >
        {/* Left: Status Icon + Order ID + Customer Name + Phone + Condensed Items */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className={`flex h-8 w-8 items-center justify-center rounded-xl border shrink-0 ${getStatusIconBg()}`}>
            {getStatusIcon()}
          </div>

          <div className="min-w-0 flex-1 space-y-0.5">
            {/* Top line: Order ID + Customer Name + Phone + Assigned Distributor Badge */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-bold text-[#1E88E5] bg-[#EBF5FB] px-1.5 py-0.5 rounded">
                {formatOrderId(order.id)}
              </span>
              <span className="text-xs sm:text-sm font-bold text-[#0F172A] truncate max-w-[120px] xs:max-w-[180px] sm:max-w-none">
                {order.customer?.user?.firstName} {order.customer?.user?.lastName}
              </span>
              {order.customer?.user?.phone && (
                <span className="text-[11px] text-[#64748B] hidden sm:inline">
                  • {order.customer.user.phone}
                </span>
              )}
              {assignedDistributor && (
                <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  <span>{assignedDistributor.firstName || 'Distributor'} {assignedDistributor.lastName || ''}</span>
                </span>
              )}
              {order.driver && (
                <span className="text-[11px] font-medium text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-md flex items-center gap-1 hidden sm:inline-flex" title={`Driver: ${order.driver.name}`}>
                  <Truck className="w-3 h-3 text-[#1677C8]" />
                  <span>Driver: {order.driver.name}</span>
                </span>
              )}
            </div>

            {/* Bottom line: Condensed Items Summary */}
            <p className="text-[11px] text-[#64748B] truncate max-w-[280px] sm:max-w-md lg:max-w-xl">
              {itemsSummary}
            </p>
          </div>
        </div>

        {/* Right: Price + Payment Status Indicator + Delivery Status Badge + Manage Button */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Price & Payment Status */}
          {(() => {
            const pst = getOrderPaymentState(order);
            return (
              <div className="flex items-center gap-1.5 sm:gap-2.5">
                <div className="text-right">
                  <div className="text-xs sm:text-sm font-black text-[#0F172A]">
                    ₹{pst.total.toLocaleString('en-IN')}
                  </div>
                  {pst.hasDue ? (
                    <div className="text-[10px] font-bold text-orange-600">
                      Due ₹{pst.due.toLocaleString('en-IN')}
                    </div>
                  ) : (
                    <div className="text-[10px] font-semibold text-emerald-600 hidden xs:block">
                      Paid
                    </div>
                  )}
                </div>

                {pst.hasDue && onCollect && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCollect(order);
                    }}
                    className="px-2 py-1 text-[10px] sm:text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer shadow-2xs flex items-center gap-1 shrink-0"
                    title={`Collect outstanding payment ₹${pst.due.toFixed(2)}`}
                  >
                    <CreditCard className="w-3 h-3" />
                    <span>Collect</span>
                  </button>
                )}
              </div>
            );
          })()}

          {/* Status Badge: Compact on mobile, full on desktop */}
          <span className={`text-[10px] sm:text-[11px] font-bold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full border whitespace-nowrap inline-flex items-center gap-1 ${getStatusBadgeStyle()}`}>
            {formatOrderStatus(order.status)}
          </span>

          {/* Manage Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            className={`p-1.5 sm:px-3 sm:py-1.5 text-xs font-bold rounded-xl border transition-all flex items-center gap-1 cursor-pointer ${
              isExpanded
                ? 'bg-[#1E88E5] text-white border-[#1E88E5] shadow-xs'
                : 'bg-white text-[#16324F] border-[#CBD5E1] hover:border-[#1E88E5] hover:text-[#1E88E5]'
            }`}
            title={isExpanded ? 'Close details' : 'Manage order'}
          >
            <span className="hidden sm:inline">{isExpanded ? 'Close' : 'Manage'}</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. EXPANDED ACCORDION STATE */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-[#E2E8F0] bg-[#F8FAFC]"
          >
            <div className="p-4 sm:p-6 space-y-4">
              {/* Inline Validation Alert */}
              {partnerPromptError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-rose-700 text-xs font-medium animate-pulse">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{partnerPromptError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Column 1: Address & Timestamps & Payment State */}
                <div className="p-4 bg-white rounded-2xl border border-[#E2E8F0] space-y-2.5 text-xs">
                  <div className="font-bold text-[#0F172A] uppercase tracking-wider text-[11px] flex items-center gap-1.5 pb-1 border-b border-[#F1F5F9]">
                    <MapPin className="w-3.5 h-3.5 text-[#1E88E5]" /> Delivery & Payment Info
                  </div>
                  <div>
                    <span className="font-semibold text-[#64748B]">Address:</span>
                    <p className="text-[#0F172A] mt-0.5 leading-relaxed font-medium">
                      {[
                        order.address?.houseName,
                        order.address?.buildingName,
                        order.address?.street,
                        order.address?.city,
                        order.address?.zipCode,
                      ]
                        .filter(Boolean)
                        .join(', ') || order.address?.street || 'Customer Address on File'}
                    </p>
                    {order.address?.landmark && (
                      <p className="text-[11px] text-[#64748B] mt-0.5">
                        <span className="font-semibold">Landmark:</span> {order.address.landmark}
                      </p>
                    )}
                  </div>

                  <div className="pt-1 text-[11px] text-[#64748B] space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-[#64748B]" />
                      <span>Placed: {new Date(order.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-[#0F172A]">Slot:</span> {formatDeliverySlot(order.timeSlot)}
                    </div>
                    {(() => {
                      const pst = getOrderPaymentState(order);
                      return (
                        <div className="pt-2 border-t border-[#F1F5F9] space-y-1.5 text-xs">
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-[#64748B]">Total Amount</span>
                            <span className="font-bold text-[#0F172A]">₹{pst.total.toLocaleString('en-IN')}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-[#64748B]">Paid</span>
                            <span className="font-bold text-emerald-600">₹{pst.paid.toLocaleString('en-IN')}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-[#64748B]">Due</span>
                            <span className={`font-bold ${pst.hasDue ? 'text-orange-600' : 'text-emerald-600'}`}>
                              ₹{pst.due.toLocaleString('en-IN')}
                            </span>
                          </div>
                          <div className="flex justify-between items-center pt-0.5">
                            <span className="font-semibold text-[#64748B]">Payment Status</span>
                            <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] border ${pst.badgeClass}`}>
                              {pst.canonicalStatus === 'PAID' ? 'PAID' : pst.canonicalStatus === 'PARTIALLY_PAID' ? 'PARTIALLY PAID' : 'UNPAID'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center pt-0.5">
                            <span className="font-semibold text-[#64748B]">Payment Method</span>
                            <span className="font-semibold text-[#0F172A]">{payment.method}</span>
                          </div>

                          {pst.hasDue && onCollect && (
                            <div className="pt-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onCollect(order);
                                }}
                                className="w-full py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                              >
                                <CreditCard className="w-3.5 h-3.5" />
                                <span>Collect ₹{pst.due.toLocaleString('en-IN')}</span>
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Column 2: Items Breakdown & Assigned Driver */}
                <div className="space-y-4 flex flex-col">
                  {/* Ordered Products Card */}
                  <div className="p-4 bg-white rounded-2xl border border-[#E2E8F0] space-y-2.5 text-xs">
                    <div className="font-bold text-[#0F172A] uppercase tracking-wider text-[11px] flex items-center gap-1.5 pb-1 border-b border-[#F1F5F9]">
                      <Package className="w-3.5 h-3.5 text-[#1E88E5]" /> Ordered Products ({order.items?.length || 0})
                    </div>
                    <div className="space-y-1.5 md:max-h-[140px] md:overflow-y-auto pr-1">
                      {order.items?.map((item: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between py-1 border-b border-[#F8FAFC] last:border-0 text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-bold text-[#1E88E5] bg-[#EBF5FB] px-1.5 py-0.5 rounded text-[11px]">
                              {item.quantity}x
                            </span>
                            <span className="text-[#0F172A] font-medium truncate">{item.product?.name}</span>
                          </div>
                          <span className="text-[#64748B] font-semibold shrink-0 ml-2">
                            ₹{Number(item.total || (item.quantity * item.unitPrice) || 0).toLocaleString('en-IN')}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2 border-t border-[#F1F5F9] flex justify-between items-center text-xs font-bold text-[#0F172A]">
                      <span>Total Amount</span>
                      <span className="text-sm text-[#1E88E5]">₹{Number(order.totalAmount || 0).toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  {/* Assigned Driver Section (Assigned by Distributor — Display-Only for Staff) */}
                  <div className="p-4 bg-white rounded-2xl border border-[#E2E8F0] space-y-2 text-xs flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between text-xs pb-1.5 mb-2 border-b border-[#F1F5F9]">
                        <span className="font-bold text-[#0F172A] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                          <Truck className="w-3.5 h-3.5 text-[#1677C8]" /> Assigned Driver
                        </span>
                        {order.driver ? (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            Assigned
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                            Not Assigned
                          </span>
                        )}
                      </div>

                      {order.driver ? (
                        <div className="p-3 bg-sky-50/70 border border-sky-100 rounded-xl space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-[#0F172A] truncate">
                              {order.driver.name}
                            </span>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[10px] font-bold shrink-0 ${
                                order.driver.isActive !== false
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                  : 'bg-slate-200 text-slate-600'
                              }`}
                            >
                              {order.driver.isActive !== false ? 'Active' : 'Inactive'}
                            </span>
                          </div>

                          {order.driver.phone && (
                            <div className="text-[11px] text-[#64748B] flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>{order.driver.phone}</span>
                            </div>
                          )}

                          {order.driver.vehicleNumber && (
                            <div className="text-[11px] text-[#64748B] flex items-center gap-1">
                              <Truck className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>
                                {order.driver.vehicleType ? `${order.driver.vehicleType} · ` : ''}
                                {order.driver.vehicleNumber}
                              </span>
                            </div>
                          )}

                          <div className="pt-1 border-t border-sky-100/60 text-[10px] text-slate-400 font-medium">
                            Assigned by distributor for delivery
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 flex items-center justify-between">
                          <span>Driver not assigned</span>
                          <span className="text-[10px] text-slate-400">Awaiting distributor</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Column 3: Distributor Assignment & Lifecycle Actions */}
                <div className="p-4 bg-white rounded-2xl border border-[#E2E8F0] space-y-3 flex flex-col justify-between">
                  {/* Distributor Assignment Section */}
                  <div>
                    <div className="flex items-center justify-between text-xs pb-1 mb-2 border-b border-[#F1F5F9]">
                      <span className="font-bold text-[#0F172A] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-[#1E88E5]" /> Distributor
                      </span>
                      {isAssigned || assignedDistributor ? (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          Assigned
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                          Unassigned
                        </span>
                      )}
                    </div>

                    {/* Strict Assignment Rule: Only show select control if order is unassigned AND status is ORDER_PLACED */}
                    {canAssignDistributor ? (
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-[#64748B] block">
                          Assign Distributor
                        </label>
                        <select
                          ref={partnerSelectRef}
                          disabled={isAssigning}
                          defaultValue=""
                          onChange={handleDistributorSelect}
                          className={`w-full text-xs font-medium bg-[#F8FAFC] border rounded-xl px-3 py-2 text-[#0F172A] outline-none transition-all cursor-pointer disabled:opacity-50 ${
                            partnerPromptError
                              ? 'border-rose-500 ring-2 ring-rose-200 bg-rose-50/50'
                              : 'border-[#CBD5E1] focus:border-[#1E88E5] focus:bg-white'
                          }`}
                        >
                          <option value="">-- Select Distributor --</option>
                          {distributorList.map((d: any) => {
                            const u = d.user || d;
                            return (
                              <option key={d.id} value={d.id}>
                                {u?.firstName || 'Distributor'} {u?.lastName || ''} {u?.phone ? `(${u.phone})` : ''}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    ) : assignedDistributor ? (
                      <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Distributor Assigned
                          </span>
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                            Locked
                          </span>
                        </div>
                        <div className="text-xs font-bold text-[#0F172A] mt-1">
                          {assignedDistributor.firstName || 'Distributor'} {assignedDistributor.lastName || ''}
                        </div>
                        {assignedDistributor.phone && (
                          <div className="text-[11px] text-[#64748B] flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{assignedDistributor.phone}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-[#64748B]">
                        Assignment locked ({formatOrderStatus(order.status)})
                      </div>
                    )}
                  </div>

                  {/* Status Action Buttons */}
                  <div className="pt-2 border-t border-[#F1F5F9] space-y-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                      Order Lifecycle Actions
                    </div>

                    <div className="space-y-2">
                      {/* ORDER_PLACED / NEW / PENDING STATES */}
                      {['ORDER_PLACED', 'NEW', 'PENDING', 'PENDING_ASSIGNMENT', 'PENDING_PAYMENT'].includes(order.status) && (
                        <button
                          type="button"
                          disabled={updatingStatus || isAssigning}
                          onClick={() => handleStatusChange('CONFIRMED')}
                          className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <Truck className="w-3.5 h-3.5" />
                          <span>Confirm Order</span>
                        </button>
                      )}

                      {/* CONFIRMED / ASSIGNED STATES */}
                      {['CONFIRMED', 'ASSIGNED', 'ACCEPTED_BY_PARTNER'].includes(order.status) && (
                        <button
                          type="button"
                          disabled={updatingStatus || isAssigning}
                          onClick={handleMoveToOutForDelivery}
                          className="w-full px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <Truck className="w-3.5 h-3.5" />
                          <span>Out for Delivery</span>
                        </button>
                      )}

                      {/* OUT FOR DELIVERY STATE (With COD Payment Confirmation Gate) */}
                      {order.status === 'OUT_FOR_DELIVERY' && (
                        <div className="space-y-2">
                          {isCOD && (
                            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                              <label className="flex items-start gap-2 cursor-pointer select-none text-xs font-bold text-amber-950">
                                <input
                                  type="checkbox"
                                  checked={paymentCollected}
                                  onChange={(e) => setPaymentCollected(e.target.checked)}
                                  className="w-4 h-4 mt-0.5 rounded border-amber-300 text-amber-600 focus:ring-amber-500 cursor-pointer shrink-0"
                                />
                                <span>Payment of ₹{Number(order.totalAmount || 0).toLocaleString('en-IN')} collected from customer</span>
                              </label>
                              {!paymentCollected && (
                                <p className="text-[10px] text-amber-700 pl-6">
                                  Confirmation required: Check box above to confirm cash collection.
                                </p>
                              )}
                            </div>
                          )}

                          <button
                            type="button"
                            disabled={updatingStatus || isAssigning || (isCOD && !paymentCollected)}
                            onClick={() => {
                              if (isCOD) {
                                handleStatusChange('DELIVERED', {
                                  paymentReceived: true,
                                  paymentMethod: 'COD',
                                  amountReceived: order.totalAmount,
                                });
                              } else {
                                handleStatusChange('DELIVERED');
                              }
                            }}
                            className={`w-full px-3 py-2 text-white text-xs font-bold rounded-xl transition-all shadow-2xs flex items-center justify-center gap-1.5 ${
                              isCOD && !paymentCollected
                                ? 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-60'
                                : 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer disabled:opacity-50'
                            }`}
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>{isCOD ? 'Mark Delivered & Confirm Payment' : 'Mark Delivered'}</span>
                          </button>
                        </div>
                      )}

                      {/* CANCEL ACTION (For any non-final state) */}
                      {!isDelivered && !isCancelled && (
                        <button
                          type="button"
                          disabled={updatingStatus || isAssigning}
                          onClick={() => {
                            setCancelReason('');
                            setCancelError(null);
                            setShowCancelModal(true);
                          }}
                          className="w-full px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          <span>Cancel Order</span>
                        </button>
                      )}

                      {/* COMPLETED / DELIVERED SUMMARY */}
                      {isDelivered && (
                        <div className="w-full py-1.5 px-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center justify-center gap-1.5">
                          <CheckCircle className="w-4 h-4 text-emerald-600" />
                          <span>Order Delivered Successfully</span>
                        </div>
                      )}

                      {/* CANCELLED SUMMARY */}
                      {isCancelled && (
                        <div className="w-full p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 space-y-1">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-rose-700">
                            <Ban className="w-4 h-4 text-rose-600" />
                            <span>Order Cancelled</span>
                            {order.cancelledBy && (
                              <span className="text-[11px] font-semibold text-rose-600">
                                by {order.cancelledBy.firstName} {order.cancelledBy.lastName || ''} ({order.cancelledBy.role})
                              </span>
                            )}
                          </div>
                          {order.cancellationReason && (
                            <p className="text-xs text-rose-800">
                              <span className="font-semibold">Reason:</span> {order.cancellationReason}
                            </p>
                          )}
                          {order.cancelledAt && (
                            <p className="text-[10px] text-rose-500">
                              Cancelled at {new Date(order.cancelledAt).toLocaleString('en-GB')}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Assignment History & Status History Section */}
              {(order.distributorAssignments?.length > 0 || order.history?.length > 0) && (
                <div className="pt-3 border-t border-[#E2E8F0] grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {order.distributorAssignments?.length > 0 && (
                    <div className="p-3 bg-white rounded-xl border border-[#E2E8F0] space-y-2">
                      <div className="text-[11px] font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        <span>Distributor Assignment History</span>
                      </div>
                      <div className="space-y-2 border-l-2 border-amber-200 pl-3 ml-1">
                        {order.distributorAssignments.map((a: any) => (
                          <div key={a.id} className="relative text-[11px]">
                            <div className={`absolute -left-[17px] top-1 w-2 h-2 rounded-full ${a.status === 'COMPLETED' ? 'bg-emerald-500' : a.status === 'RELEASED' ? 'bg-amber-500' : 'bg-blue-500'}`} />
                            <div className="font-bold text-slate-800">
                              {a.distributor ? `${a.distributor.firstName || ''} ${a.distributor.lastName || ''}`.trim() || 'Distributor' : 'Distributor'} • <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase ${a.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' : a.status === 'RELEASED' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>{a.status}</span>
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              Accepted: {new Date(a.acceptedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                              {a.releasedAt && ` • Released: ${new Date(a.releasedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`}
                              {a.releaseReason && ` • "${a.releaseReason}"`}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {order.history?.length > 0 && (
                    <div className="p-3 bg-white rounded-xl border border-[#E2E8F0] space-y-2">
                      <div className="text-[11px] font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-[#1E88E5]" />
                        <span>Status Audit Trail</span>
                      </div>
                      <div className="space-y-2 border-l-2 border-blue-200 pl-3 ml-1 md:max-h-[140px] md:overflow-y-auto">
                        {order.history.map((h: any) => (
                          <div key={h.id} className="relative text-[11px]">
                            <div className="absolute -left-[17px] top-1 w-2 h-2 rounded-full bg-[#1E88E5]" />
                            <div className="font-bold text-slate-800">
                              {h.previousStatus} → {h.newStatus}
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              {new Date(h.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                              {h.user && ` by ${h.user.firstName} ${h.user.lastName || ''}`}
                              {h.reason && ` • ${h.reason}`}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* STAFF CANCEL ORDER MODAL */}
      {showCancelModal && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in"
        >
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 text-rose-600 font-black text-base">
                <Ban className="w-5 h-5" />
                <span>Cancel Customer Order</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCancelModal(false);
                  setCancelReason('');
                  setCancelError(null);
                }}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-900 space-y-1">
              <p className="font-bold">
                Permanently cancel order {formatOrderId(order.id)}?
              </p>
              <p className="text-[11px] text-rose-800 leading-relaxed">
                This will mark the order as <strong>CANCELLED</strong>. Any active distributor assignments will be released, and the order will be permanently preserved in historical records. A non-empty reason is mandatory.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Cancellation Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                required
                placeholder="Specify the reason for cancellation (e.g. Customer requested cancellation via call)..."
                value={cancelReason}
                onChange={(e) => {
                  setCancelReason(e.target.value);
                  if (cancelError) setCancelError(null);
                }}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-rose-500"
              />
              {cancelError && (
                <p className="text-[11px] text-rose-600 font-semibold mt-1">{cancelError}</p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowCancelModal(false);
                  setCancelReason('');
                  setCancelError(null);
                }}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Keep Order
              </button>
              <button
                type="button"
                disabled={updatingStatus}
                onClick={handleConfirmCancel}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-xs"
              >
                {updatingStatus ? 'Cancelling...' : 'Confirm Order Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

