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
  AlertTriangle,
  Package,
  ShieldCheck,
} from 'lucide-react';
import { formatOrderStatus, formatPaymentDetails, formatDeliverySlot } from '../../../utils/orderFormatters';

export interface DeliveryPartner {
  id: string;
  vehicleType?: string;
  vehicleNumber?: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
  };
}

interface OrderRowProps {
  order: any;
  partners: DeliveryPartner[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onStatusUpdate: (orderId: string, newStatus: string) => Promise<void>;
  onAssignPartner: (orderId: string, deliveryPartnerId: string) => Promise<void>;
  isAssigning: boolean;
}

export default function OrderRow({
  order,
  partners,
  isExpanded,
  onToggleExpand,
  onStatusUpdate,
  onAssignPartner,
  isAssigning,
}: OrderRowProps) {
  const [partnerPromptError, setPartnerPromptError] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const partnerSelectRef = useRef<HTMLSelectElement>(null);

  const payment = formatPaymentDetails(order);
  const assignedPartner = order.delivery?.assignment?.deliveryPartner;
  const assignedPartnerId = order.delivery?.assignment?.deliveryPartnerId || assignedPartner?.id;
  const isDelivered = order.status === 'DELIVERED' || order.status === 'COMPLETED';
  const isCancelled = order.status === 'CANCELLED';

  // Condensed Item summary string (e.g. "1x Edrops 20L Jar, 2x 10L Dispenser")
  const itemsSummary = order.items && order.items.length > 0
    ? order.items.map((i: any) => `${i.quantity}x ${i.product?.name || 'Item'}`).join(', ')
    : 'No items';

  // Status icon config
  const getStatusIcon = () => {
    if (isDelivered) return <CheckCircle className="h-4 w-4 text-emerald-600" />;
    if (isCancelled) return <Ban className="h-4 w-4 text-rose-600" />;
    if (['ASSIGNED', 'ACCEPTED_BY_PARTNER', 'OUT_FOR_DELIVERY'].includes(order.status)) {
      return <Truck className="h-4 w-4 text-blue-600" />;
    }
    return <Clock className="h-4 w-4 text-amber-600" />;
  };

  const getStatusIconBg = () => {
    if (isDelivered) return 'bg-emerald-50 border-emerald-200';
    if (isCancelled) return 'bg-rose-50 border-rose-200';
    if (['ASSIGNED', 'ACCEPTED_BY_PARTNER', 'OUT_FOR_DELIVERY'].includes(order.status)) {
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
      case 'ASSIGNED':
      case 'ACCEPTED_BY_PARTNER':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'NEW':
      case 'PENDING':
      case 'PENDING_ASSIGNMENT':
      case 'PENDING_PAYMENT':
      default:
        return 'bg-amber-50 text-amber-700 border-amber-200';
    }
  };

  const handlePartnerSelect = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (!val) return;
    setPartnerPromptError(null);
    await onAssignPartner(order.id, val);
  };

  const handleMoveToOutForDelivery = async () => {
    if (!assignedPartnerId) {
      setPartnerPromptError('Please assign a delivery partner before marking this order out for delivery.');
      if (partnerSelectRef.current) {
        partnerSelectRef.current.focus();
        partnerSelectRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
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

  const handleStatusChange = async (targetStatus: string) => {
    setPartnerPromptError(null);
    setUpdatingStatus(true);
    try {
      await onStatusUpdate(order.id, targetStatus);
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
            {/* Top line: Order ID + Customer Name + Phone */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-bold text-[#1E88E5] bg-[#EBF5FB] px-1.5 py-0.5 rounded">
                #{order.id.substring(0, 8).toUpperCase()}
              </span>
              <span className="text-xs sm:text-sm font-bold text-[#0F172A] truncate">
                {order.customer?.user?.firstName} {order.customer?.user?.lastName}
              </span>
              {order.customer?.user?.phone && (
                <span className="text-[11px] text-[#64748B] hidden sm:inline">
                  • {order.customer.user.phone}
                </span>
              )}
            </div>

            {/* Bottom line: Condensed Items Summary */}
            <p className="text-[11px] text-[#64748B] truncate max-w-[280px] sm:max-w-md lg:max-w-xl">
              {itemsSummary}
            </p>
          </div>
        </div>

        {/* Right: Price + Status Badge + Manage Button */}
        <div className="flex items-center gap-2.5 sm:gap-4 shrink-0">
          {/* Price */}
          <div className="text-right">
            <div className="text-xs sm:text-sm font-black text-[#0F172A]">
              ₹{Number(order.totalAmount || 0).toLocaleString('en-IN')}
            </div>
            <div className="text-[10px] font-medium text-[#64748B]">
              {payment.method || 'COD'}
            </div>
          </div>

          {/* Status Badge */}
          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border whitespace-nowrap hidden sm:inline-flex items-center gap-1 ${getStatusBadgeStyle()}`}>
            {formatOrderStatus(order.status)}
          </span>

          {/* Manage Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer ${
              isExpanded
                ? 'bg-[#1E88E5] text-white border-[#1E88E5] shadow-xs'
                : 'bg-white text-[#16324F] border-[#CBD5E1] hover:border-[#1E88E5] hover:text-[#1E88E5]'
            }`}
          >
            <span>{isExpanded ? 'Close' : 'Manage'}</span>
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
              {/* Inline Validation Alert if Partner is Required */}
              {partnerPromptError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-rose-700 text-xs font-medium animate-pulse">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{partnerPromptError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Column 1: Address & Timestamps */}
                <div className="p-4 bg-white rounded-2xl border border-[#E2E8F0] space-y-2.5 text-xs">
                  <div className="font-bold text-[#0F172A] uppercase tracking-wider text-[11px] flex items-center gap-1.5 pb-1 border-b border-[#F1F5F9]">
                    <MapPin className="w-3.5 h-3.5 text-[#1E88E5]" /> Delivery Details
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

                  <div className="pt-1 text-[11px] text-[#64748B] space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-[#64748B]" />
                      <span>Placed: {new Date(order.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-[#0F172A]">Slot:</span> {formatDeliverySlot(order.timeSlot)}
                    </div>
                  </div>
                </div>

                {/* Column 2: Items Breakdown */}
                <div className="p-4 bg-white rounded-2xl border border-[#E2E8F0] space-y-2.5 text-xs">
                  <div className="font-bold text-[#0F172A] uppercase tracking-wider text-[11px] flex items-center gap-1.5 pb-1 border-b border-[#F1F5F9]">
                    <Package className="w-3.5 h-3.5 text-[#1E88E5]" /> Ordered Products ({order.items?.length || 0})
                  </div>
                  <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
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

                {/* Column 3: Partner Assignment & Actions */}
                <div className="p-4 bg-white rounded-2xl border border-[#E2E8F0] space-y-3 flex flex-col justify-between">
                  {/* Delivery Partner Assignment */}
                  <div>
                    <div className="flex items-center justify-between text-xs pb-1 mb-2 border-b border-[#F1F5F9]">
                      <span className="font-bold text-[#0F172A] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-[#1E88E5]" /> Delivery Partner
                      </span>
                      {assignedPartner ? (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          Assigned
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                          Unassigned
                        </span>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-[#64748B] block">
                        Assign / Reassign Partner
                      </label>
                      <select
                        ref={partnerSelectRef}
                        disabled={isAssigning || isDelivered || isCancelled}
                        value={assignedPartnerId || ''}
                        onChange={handlePartnerSelect}
                        className={`w-full text-xs font-medium bg-[#F8FAFC] border rounded-xl px-3 py-2 text-[#0F172A] outline-none transition-all cursor-pointer disabled:opacity-50 ${
                          partnerPromptError
                            ? 'border-rose-500 ring-2 ring-rose-200 bg-rose-50/50'
                            : 'border-[#CBD5E1] focus:border-[#1E88E5] focus:bg-white'
                        }`}
                      >
                        <option value="">-- Select Delivery Partner --</option>
                        {partners.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.user.firstName} {p.user.lastName} ({p.user.phone}) {p.vehicleNumber ? `• ${p.vehicleNumber}` : ''}
                          </option>
                        ))}
                      </select>
                      {assignedPartner && (
                        <p className="text-[11px] text-emerald-600 font-medium flex items-center gap-1 mt-1">
                          <ShieldCheck className="w-3.5 h-3.5" /> Assigned to {assignedPartner.user.firstName} {assignedPartner.user.lastName}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Status Action Buttons */}
                  <div className="pt-2 border-t border-[#F1F5F9] space-y-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                      Order Lifecycle Actions
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {/* NEW / PENDING STATES */}
                      {['NEW', 'PENDING', 'PENDING_ASSIGNMENT', 'PENDING_PAYMENT'].includes(order.status) && (
                        <button
                          type="button"
                          disabled={updatingStatus}
                          onClick={() => handleStatusChange('ASSIGNED')}
                          className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <Truck className="w-3.5 h-3.5" />
                          <span>Confirm Order</span>
                        </button>
                      )}

                      {/* ASSIGNED / ACCEPTED STATES */}
                      {['ASSIGNED', 'ACCEPTED_BY_PARTNER'].includes(order.status) && (
                        <button
                          type="button"
                          disabled={updatingStatus}
                          onClick={handleMoveToOutForDelivery}
                          className="flex-1 px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <Truck className="w-3.5 h-3.5" />
                          <span>Out for Delivery</span>
                        </button>
                      )}

                      {/* OUT FOR DELIVERY STATE */}
                      {order.status === 'OUT_FOR_DELIVERY' && (
                        <button
                          type="button"
                          disabled={updatingStatus}
                          onClick={() => handleStatusChange('DELIVERED')}
                          className="flex-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Mark Delivered</span>
                        </button>
                      )}

                      {/* CANCEL ACTION (For any non-final state) */}
                      {!isDelivered && !isCancelled && (
                        <button
                          type="button"
                          disabled={updatingStatus}
                          onClick={() => {
                            if (window.confirm('Are you sure you want to cancel this order?')) {
                              handleStatusChange('CANCELLED');
                            }
                          }}
                          className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          <span>Cancel</span>
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
                        <div className="w-full py-1.5 px-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-bold flex items-center justify-center gap-1.5">
                          <Ban className="w-4 h-4 text-rose-600" />
                          <span>Order Cancelled</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
