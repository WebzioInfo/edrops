import { useState } from 'react';
import {
  X,
  Package,
  Phone,
  Mail,
  User,
  MapPin,
  Clock,
  CreditCard,
  Truck,
  Building2,
  Copy,
  Check,
} from 'lucide-react';
import {
  formatOrderId,
  formatOrderStatus,
  getOrderStatusBadgeClass,
  formatPaymentDetails,
  formatDeliverySlot,
} from '../../../utils/orderFormatters';
import { toast } from 'react-hot-toast';

interface AdminOrderDetailModalProps {
  order: any | null;
  onClose: () => void;
}

export default function AdminOrderDetailModal({ order, onClose }: AdminOrderDetailModalProps) {
  const [copied, setCopied] = useState(false);

  if (!order) return null;

  const orderId = order.id || '';
  const displayId = formatOrderId(orderId);
  const rawStatus = order.status || 'NEW';
  const statusLabel = formatOrderStatus(rawStatus);
  const statusBadge = getOrderStatusBadgeClass(rawStatus);

  const customerUser = order.customer?.user;
  const customerName = customerUser
    ? `${customerUser.firstName || ''} ${customerUser.lastName || ''}`.trim() || 'Valued Customer'
    : 'Valued Customer';
  const customerPhone = customerUser?.phone || order.customer?.phone || '—';
  const customerEmail = customerUser?.email || null;
  const companyName = order.customer?.companyName || null;

  const address = order.address;
  const addressString = address
    ? [address.street, address.city, address.district, address.state, address.zipCode]
        .filter(Boolean)
        .join(', ')
    : 'No address recorded';

  const orderType = order.orderType || order.type || 'ONETIME_ORDER';
  const isSubscription = orderType === 'SUBSCRIPTION_ORDER' || orderType === 'SUBSCRIPTION';

  const items = Array.isArray(order.items) ? order.items : [];
  const totalItemsCount = items.reduce((sum: number, it: any) => sum + (it.quantity || 1), 0);

  const distributor = order.distributor;
  const distributorName = distributor
    ? `${distributor.firstName || ''} ${distributor.lastName || ''}`.trim()
    : null;

  const driver = order.driver;
  const deliveryPartner = order.delivery?.assignment?.deliveryPartner?.user;
  const driverName = driver?.name || (deliveryPartner ? `${deliveryPartner.firstName || ''} ${deliveryPartner.lastName || ''}`.trim() : null);
  const driverPhone = driver?.phone || deliveryPartner?.phone || null;

  const paymentDetails = formatPaymentDetails(order);
  const totalAmount = Number(order.totalAmount || 0).toFixed(2);
  const subTotal = Number(order.subTotal || order.totalAmount || 0).toFixed(2);
  const deliveryFee = Number(order.deliveryCharge || 0).toFixed(2);
  const discountTotal = Number(order.discountTotal || 0).toFixed(2);
  const amountPaid = Number(order.amountPaid || 0).toFixed(2);
  const amountDue = Number(order.amountDue || Math.max(0, Number(order.totalAmount || 0) - Number(order.amountPaid || 0))).toFixed(2);

  const createdAtFormatted = order.createdAt
    ? new Date(order.createdAt).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

  const handleCopyId = () => {
    navigator.clipboard.writeText(orderId);
    setCopied(true);
    toast.success('Full Order UUID copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-gray-100 flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95">
        
        {/* Header Hero */}
        <div className="p-4 sm:p-5 border-b border-gray-100 bg-slate-50/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#1677C8]/10 text-[#1677C8] border border-[#1677C8]/20 flex items-center justify-center shrink-0">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-[#16324F]">
                  Order #{displayId}
                </h3>
                <button
                  type="button"
                  onClick={handleCopyId}
                  className="inline-flex items-center gap-1 text-[10px] font-mono text-slate-500 hover:text-[#1677C8] px-1.5 py-0.5 rounded bg-white border border-slate-200 hover:border-[#1677C8]/30 transition"
                  title="Copy full UUID"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'Copied' : 'UUID'}</span>
                </button>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusBadge}`}>
                  {statusLabel}
                </span>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                  isSubscription
                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                    : 'bg-blue-50 text-[#1677C8] border-blue-200'
                }`}>
                  {isSubscription ? 'Subscription' : 'Marketplace'}
                </span>
              </div>
              <p className="text-xs text-[#64748B] flex items-center gap-1.5 mt-0.5">
                <Clock className="w-3 h-3 text-slate-400" />
                <span>Placed on {createdAtFormatted}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-200/60 transition cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          
          {/* Customer & Delivery Location Card */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/60 space-y-2.5">
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">
              Customer & Delivery Details
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-[#1677C8]" />
                  <span className="font-bold text-[#16324F] text-sm">{customerName}</span>
                </div>
                {companyName && (
                  <p className="text-[11px] font-medium text-emerald-700 mt-0.5 ml-5">
                    {companyName}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-1.5 text-slate-600 ml-0.5">
                  <Phone className="w-3 h-3 text-slate-400" />
                  <span className="font-mono text-xs">{customerPhone}</span>
                </div>
                {customerEmail && (
                  <div className="flex items-center gap-2 mt-1 text-slate-600 ml-0.5">
                    <Mail className="w-3 h-3 text-slate-400" />
                    <span className="truncate max-w-[200px]">{customerEmail}</span>
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-start gap-1.5 text-slate-600">
                  <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    <span className="font-semibold text-slate-700 block">Delivery Address:</span>
                    <span className="text-slate-600">{addressString}</span>
                  </div>
                </div>
                {order.timeSlot && (
                  <div className="mt-2 ml-5 text-slate-600">
                    <span className="text-[11px] font-medium text-slate-500">Slot: </span>
                    <span className="font-semibold text-slate-800">{formatDeliverySlot(order.timeSlot)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Fulfillment & Assignment Status Card */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/60">
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block mb-2.5">
              Fulfillment Assignment
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Distributor */}
              <div className="flex items-start gap-2.5 p-2.5 bg-white rounded-lg border border-slate-200/70">
                <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700 shrink-0">
                  <Building2 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase block">Distributor</span>
                  {distributorName ? (
                    <>
                      <p className="font-bold text-[#16324F] truncate">{distributorName}</p>
                      {distributor.phone && <p className="text-[11px] text-slate-500 font-mono">{distributor.phone}</p>}
                    </>
                  ) : (
                    <p className="text-xs text-slate-400 font-medium italic">Unassigned</p>
                  )}
                </div>
              </div>

              {/* Driver / Partner */}
              <div className="flex items-start gap-2.5 p-2.5 bg-white rounded-lg border border-slate-200/70">
                <div className="p-2 rounded-lg bg-blue-50 text-[#1677C8] shrink-0">
                  <Truck className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase block">Assigned Driver</span>
                  {driverName ? (
                    <>
                      <p className="font-bold text-[#16324F] truncate">{driverName}</p>
                      {driverPhone && <p className="text-[11px] text-slate-500 font-mono">{driverPhone}</p>}
                      {driver?.vehicleNumber && (
                        <p className="text-[10px] font-semibold text-slate-500">{driver.vehicleNumber} ({driver.vehicleType || 'Vehicle'})</p>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-slate-400 font-medium italic">Unassigned</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="border border-slate-200/70 rounded-xl overflow-hidden">
            <div className="bg-slate-100/70 px-3.5 py-2 flex items-center justify-between border-b border-slate-200/70">
              <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
                Order Items ({totalItemsCount} {totalItemsCount === 1 ? 'item' : 'items'})
              </span>
            </div>
            {items.length === 0 ? (
              <p className="text-center py-4 text-slate-400 italic">No line items in order record.</p>
            ) : (
              <div className="divide-y divide-slate-100 bg-white">
                {items.map((item: any, idx: number) => {
                  const prod = item.product || {};
                  const prodName = prod.name || 'Item';
                  const qty = item.quantity || 1;
                  const unitPrice = Number(item.unitPrice || prod.price || 0).toFixed(2);
                  const lineTotal = Number(item.total || (qty * Number(unitPrice))).toFixed(2);

                  return (
                    <div key={item.id || idx} className="p-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0 font-bold text-xs">
                          {idx + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-[#16324F] truncate">{prodName}</p>
                          <p className="text-[10px] text-slate-500">
                            {qty} × ₹{unitPrice}
                            {item.deposit ? ` · Deposit: ₹${item.deposit}` : ''}
                          </p>
                        </div>
                      </div>
                      <span className="font-bold text-[#16324F] text-xs shrink-0">
                        ₹{lineTotal}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Financial Breakdown & Payment Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Payment Status Card */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/60 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block mb-2">
                  Payment Status
                </span>
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-slate-500" />
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${paymentDetails.badgeClass}`}>
                    {paymentDetails.status}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mt-2 font-medium">
                  Method: <span className="font-semibold text-slate-800">{paymentDetails.method}</span>
                </p>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Paid / Due:</span>
                <div className="text-right">
                  <span className="text-emerald-700 font-bold">₹{amountPaid}</span>
                  <span className="text-slate-400 mx-1">/</span>
                  <span className={Number(amountDue) > 0 ? 'text-amber-700 font-bold' : 'text-slate-500'}>
                    ₹{amountDue}
                  </span>
                </div>
              </div>
            </div>

            {/* Price Calculations */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/60 space-y-1.5">
              <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block mb-2">
                Cost Breakdown
              </span>
              <div className="flex items-center justify-between text-slate-600">
                <span>Subtotal</span>
                <span className="font-semibold text-slate-800">₹{subTotal}</span>
              </div>
              {Number(deliveryFee) > 0 && (
                <div className="flex items-center justify-between text-slate-600">
                  <span>Delivery Fee</span>
                  <span className="font-semibold text-slate-800">+₹{deliveryFee}</span>
                </div>
              )}
              {Number(discountTotal) > 0 && (
                <div className="flex items-center justify-between text-emerald-700">
                  <span>Discount</span>
                  <span className="font-semibold">-₹{discountTotal}</span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between text-sm font-bold text-[#16324F]">
                <span>Total Amount</span>
                <span className="text-base text-[#1677C8]">₹{totalAmount}</span>
              </div>
            </div>
          </div>

          {/* Status History (if present) */}
          {Array.isArray(order.history) && order.history.length > 0 && (
            <div className="border border-slate-200/70 rounded-xl overflow-hidden p-3.5 bg-slate-50">
              <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block mb-2.5">
                Lifecycle Timeline
              </span>
              <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                {order.history.map((h: any, i: number) => {
                  const histDate = h.createdAt
                    ? new Date(h.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '';
                  return (
                    <div key={h.id || i} className="flex items-start gap-2 text-[11px]">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#1677C8] mt-1.5 shrink-0" />
                      <div className="flex-1">
                        <span className="font-semibold text-slate-800">{formatOrderStatus(h.newStatus)}</span>
                        {h.reason && <span className="text-slate-500 ml-1.5">({h.reason})</span>}
                      </div>
                      <span className="text-slate-400 font-mono text-[10px] shrink-0">{histDate}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-gray-100 bg-slate-50/70 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:text-[#16324F] hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
