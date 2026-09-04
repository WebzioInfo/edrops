import { useState, useEffect } from 'react';
import { 
  X, 
  CheckCircle, 
  AlertCircle, 
  IndianRupee, 
  CreditCard, 
  Banknote, 
  QrCode, 
  Loader2, 
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import type { OrderDetail } from './OrderDetailModal';
import { formatOrderId } from '../../../utils/orderFormatters';

interface CompleteDeliveryModalProps {
  order: OrderDetail | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data?: {
    paymentReceived: boolean;
    paymentMethod?: string;
    amountReceived?: number;
  }) => Promise<void>;
}

export default function CompleteDeliveryModal({
  order,
  isOpen,
  onClose,
  onConfirm,
}: CompleteDeliveryModalProps) {
  const rawMethod = (order?.paymentMethod || '').toUpperCase();
  const isCOD = rawMethod === 'COD' || rawMethod === 'CASH_ON_DELIVERY' || rawMethod.includes('COD') || rawMethod.includes('CASH');
  const isAlreadyPaid = !isCOD && (order?.paymentStatus === 'PAID' || order?.paymentStatus === 'SUCCESS');

  const [paymentReceived, setPaymentReceived] = useState<boolean>(true);
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH');
  const [amountReceived, setAmountReceived] = useState<number>(0);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (order) {
      setPaymentReceived(true);
      setAmountReceived(Number(order.totalAmount || 0));
      setPaymentMethod(order.paymentMethod || 'CASH');
      setError(null);
      setSubmitting(false);
    }
  }, [order, isOpen]);

  if (!isOpen || !order) return null;

  const customerName =
    `${order.customer?.user?.firstName || ''} ${order.customer?.user?.lastName || ''}`.trim() ||
    order.customer?.companyName ||
    'Customer';

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);

    // Validations if not already paid
    if (!isAlreadyPaid) {
      if (paymentReceived) {
        if (!paymentMethod) {
          setError('Please select a payment method.');
          setSubmitting(false);
          return;
        }
        if (Number(amountReceived) <= 0) {
          setError('Amount received must be greater than ₹0.00 when marking as paid.');
          setSubmitting(false);
          return;
        }
      }
    }

    try {
      if (isAlreadyPaid) {
        // Pre-verified online payment -> only confirm delivery
        await onConfirm();
      } else {
        await onConfirm({
          paymentReceived,
          paymentMethod: paymentReceived ? paymentMethod : undefined,
          amountReceived: paymentReceived ? Number(amountReceived) : 0,
        });
      }
      onClose();
    } catch (err: any) {
      console.error('Failed to complete delivery:', err);
      setError(err.message || 'Failed to complete delivery. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div 
        className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 bg-slate-50/90 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-[#16324F]">Complete Delivery</h3>
              <span className="font-mono text-xs font-bold text-[#1677C8] bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100">
                {formatOrderId(order.id)}
              </span>
            </div>
            <p className="text-xs text-[#64748B] mt-0.5">
              Confirm order dropoff and customer payment state
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="p-1.5 text-gray-400 hover:text-[#16324F] hover:bg-gray-200/60 rounded-xl transition cursor-pointer disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Order Summary Snapshot */}
          <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-[#64748B] font-medium">Customer:</span>
              <span className="font-bold text-[#16324F]">{customerName}</span>
            </div>
            <div className="flex justify-between items-start">
              <span className="text-[#64748B] font-medium">Items:</span>
              <div className="text-right font-medium text-[#16324F] space-y-0.5">
                {order.items?.map((item) => (
                  <div key={item.id}>
                    {item.product?.name || 'Item'} × {item.quantity}
                  </div>
                )) || <div>1 × Delivery Drop</div>}
              </div>
            </div>
            <div className="flex justify-between items-center pt-1.5 border-t border-gray-200">
              <span className="font-bold text-[#16324F]">Order Amount:</span>
              <span className="text-sm font-black text-[#1677C8]">₹{Number(order.totalAmount || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-[#64748B]">Current Payment Status:</span>
              <span className={`font-bold px-2 py-0.5 rounded-full ${
                isAlreadyPaid
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-amber-50 text-amber-700'
              }`}>
                {isAlreadyPaid ? 'PAID' : 'PENDING'}
              </span>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {/* CASE 1: ALREADY VERIFIED ONLINE PAYMENT */}
          {isAlreadyPaid ? (
            <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2 animate-in fade-in">
              <div className="flex items-center gap-2 text-emerald-800">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider">Payment Verified</h4>
                  <p className="text-[11px] text-emerald-700">Online payment verified via payment gateway</p>
                </div>
              </div>

              <div className="pt-2 border-t border-emerald-200/80 text-xs space-y-1">
                <div className="flex justify-between text-emerald-900">
                  <span>Amount Paid:</span>
                  <span className="font-bold">₹{Number(order.totalAmount || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-emerald-900">
                  <span>Payment Method:</span>
                  <span className="font-semibold">{order.paymentMethod || 'Online'}</span>
                </div>
              </div>
            </div>
          ) : (
            /* CASE 2: UNVERIFIED / MANUAL ORDER PAYMENT CONFIRMATION */
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-[#16324F] uppercase tracking-wider block">
                  Customer Payment Confirmation
                </label>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Has the customer paid for this delivery?
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setPaymentReceived(true)}
                  className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition cursor-pointer ${
                    paymentReceived
                      ? 'border-emerald-500 bg-emerald-50/60 text-emerald-900 ring-2 ring-emerald-500/20'
                      : 'border-gray-200 bg-white hover:bg-slate-50 text-[#64748B]'
                  }`}
                >
                  <div className={`h-5 w-5 rounded-full border flex items-center justify-center shrink-0 ${
                    paymentReceived
                      ? 'border-emerald-600 bg-emerald-600 text-white'
                      : 'border-gray-300 bg-white'
                  }`}>
                    {paymentReceived && <CheckCircle className="w-3.5 h-3.5" />}
                  </div>
                  <div>
                    <p className="text-xs font-bold leading-tight">Yes, Received</p>
                    <p className="text-[10px] text-emerald-700 font-medium mt-0.5">Realizes profit</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentReceived(false)}
                  className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition cursor-pointer ${
                    !paymentReceived
                      ? 'border-amber-500 bg-amber-50/60 text-amber-900 ring-2 ring-amber-500/20'
                      : 'border-gray-200 bg-white hover:bg-slate-50 text-[#64748B]'
                  }`}
                >
                  <div className={`h-5 w-5 rounded-full border flex items-center justify-center shrink-0 ${
                    !paymentReceived
                      ? 'border-amber-600 bg-amber-600 text-white'
                      : 'border-gray-300 bg-white'
                  }`}>
                    {!paymentReceived && <CheckCircle className="w-3.5 h-3.5" />}
                  </div>
                  <div>
                    <p className="text-xs font-bold leading-tight">No, Unpaid</p>
                    <p className="text-[10px] text-amber-700 font-medium mt-0.5">Payment pending</p>
                  </div>
                </button>
              </div>

              {/* Conditional Payment Method & Amount Fields */}
              {paymentReceived ? (
                <div className="space-y-3 pt-2 border-t border-gray-100 animate-in fade-in">
                  <div>
                    <label className="text-xs font-bold text-[#16324F] block mb-1">
                      Amount Received (₹) <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">₹</span>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={amountReceived}
                        onChange={(e) => setAmountReceived(parseFloat(e.target.value) || 0)}
                        className="w-full pl-7 pr-3 py-2 text-xs font-bold bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl outline-none focus:bg-white focus:border-[#1677C8] text-[#16324F]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[#16324F] block mb-1">
                      Payment Method <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {[
                        { key: 'CASH', label: 'Cash', icon: Banknote },
                        { key: 'UPI', label: 'UPI / QR Code', icon: QrCode },
                        { key: 'ONLINE', label: 'Online', icon: CreditCard },
                        { key: 'CARD', label: 'Card', icon: CreditCard },
                        { key: 'OTHER', label: 'Other', icon: IndianRupee },
                      ].map((method) => {
                        const Icon = method.icon;
                        const isSelected = paymentMethod === method.key;
                        return (
                          <button
                            key={method.key}
                            type="button"
                            onClick={() => setPaymentMethod(method.key)}
                            className={`p-2.5 rounded-xl border flex items-center gap-2 transition cursor-pointer text-left ${
                              isSelected
                                ? 'border-[#1677C8] bg-blue-50/60 text-[#1677C8] font-bold'
                                : 'border-gray-200 bg-white text-[#64748B] hover:bg-slate-50'
                            }`}
                          >
                            <Icon className="w-3.5 h-3.5 shrink-0" />
                            <span className="text-[11px] truncate">{method.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-amber-50/70 border border-amber-200/90 rounded-xl flex items-start gap-2.5 text-xs text-amber-900 animate-in fade-in">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5 text-[11px] leading-relaxed">
                    <p className="font-bold">Delivery will be completed with Payment: PENDING</p>
                    <p className="text-amber-800">
                      This order will NOT enter your realized partner profit until the payment is confirmed and recorded.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-slate-50/80 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2.5 text-xs font-semibold text-[#64748B] hover:text-[#16324F] bg-white border border-[#E2E8F0] rounded-xl hover:bg-gray-100 transition cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={submitting}
            onClick={handleSubmit}
            className={`px-5 py-2.5 text-white text-xs font-bold rounded-xl shadow-2xs transition flex items-center gap-2 cursor-pointer disabled:opacity-50 ${
              isAlreadyPaid
                ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                : paymentReceived
                ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                : 'bg-[#16324F] hover:bg-slate-800 shadow-slate-900/20'
            }`}
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processing...</span>
              </>
            ) : isAlreadyPaid ? (
              <>
                <CheckCircle className="w-4 h-4" />
                <span>Confirm Delivery</span>
              </>
            ) : paymentReceived ? (
              <>
                <CheckCircle className="w-4 h-4" />
                <span>Confirm Payment & Deliver</span>
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                <span>Complete Delivery (Unpaid)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
