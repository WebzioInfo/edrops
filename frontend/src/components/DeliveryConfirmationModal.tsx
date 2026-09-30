import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Minus,
  Plus,
  Truck,
  CreditCard,
  ShieldCheck,
} from 'lucide-react';
import { fetchWithAuth } from '../api/client';
import { toast } from 'react-hot-toast';
import { formatOrderId, getOrderPaymentState } from '../utils/orderFormatters';

export interface DeliveryConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any;
  onSuccess: () => void;
  apiPrefix?: string; // '/orders/distributor' or '/orders'
}

const SHORT_DELIVERY_REASONS = [
  'Customer requested partial delivery',
  'Customer unavailable',
  'Jar damaged during delivery',
  'Delivery issue',
  'Stock issue',
  'Other',
];

export const DeliveryConfirmationModal: React.FC<DeliveryConfirmationModalProps> = ({
  isOpen,
  onClose,
  order,
  onSuccess,
  apiPrefix = '/orders',
}) => {
  const [pin, setPin] = useState('');
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);
  const [isPinVerified, setIsPinVerified] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [isLegacyOrder, setIsLegacyOrder] = useState(false);

  // Delivered quantities mapping: jarItemId -> deliveredQty
  const [deliveredQuantities, setDeliveredQuantities] = useState<Record<string, number>>({});
  // Returned empty jars mapping: jarItemId -> returnedQty
  const [returnedQuantities, setReturnedQuantities] = useState<Record<string, number>>({});
  const [shortReason, setShortReason] = useState(SHORT_DELIVERY_REASONS[0]);
  const [otherReasonText, setOtherReasonText] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');

  // Payment collection on delivery
  const [paymentMode, setPaymentMode] = useState<'FULL' | 'PARTIAL'>('FULL');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const pinInputRef = useRef<HTMLInputElement>(null);

  // Initialize or reset state when modal opens
  useEffect(() => {
    if (!isOpen || !order) {
      setPin('');
      setIsPinVerified(false);
      setPinError(null);
      setIsLegacyOrder(false);
      setDeliveredQuantities({});
      setReturnedQuantities({});
      setOtherReasonText('');
      setDeliveryNotes('');
      return;
    }

    // Initialize delivered quantities to match out-for-delivery allocations
    const initialDelivered: Record<string, number> = {};
    const initialReturned: Record<string, number> = {};
    if (order.jarAllocations && order.jarAllocations.length > 0) {
      order.jarAllocations.forEach((alloc: any) => {
        initialDelivered[alloc.jarItemId] = alloc.quantity;
        initialReturned[alloc.jarItemId] = 0;
      });
    }
    setDeliveredQuantities(initialDelivered);
    setReturnedQuantities(initialReturned);

    // Auto-focus the PIN input
    setTimeout(() => {
      pinInputRef.current?.focus();
    }, 150);
  }, [isOpen, order]);

  if (!isOpen || !order) return null;

  const allocations = order.jarAllocations || [];
  const totalOut = allocations.reduce((sum: number, a: any) => sum + (Number(a.quantity) || 0), 0);
  const totalDelivered = allocations.reduce(
    (sum: number, a: any) => sum + (Number(deliveredQuantities[a.jarItemId]) ?? a.quantity),
    0
  );
  const totalReturned = allocations.reduce(
    (sum: number, a: any) => sum + (Number(returnedQuantities[a.jarItemId]) || 0),
    0
  );
  const totalUndelivered = Math.max(0, totalOut - totalDelivered);
  const netWithCustomer = totalDelivered - totalReturned;
  const isShortDelivery = totalDelivered < totalOut;

  const effectiveShortReason =
    shortReason === 'Other' ? otherReasonText.trim() : shortReason;

  const pst = getOrderPaymentState(order);

  // Handle PIN input change (numeric 4 digits only)
  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
    setPin(val);
    setPinError(null);
  };

  // Verify PIN via server
  const handleVerifyPin = async () => {
    if (pin.length !== 4) {
      setPinError('Please enter a 4-digit numeric delivery PIN.');
      return;
    }

    setIsVerifyingPin(true);
    setPinError(null);

    try {
      const res = await fetchWithAuth(`${apiPrefix}/${order.id}/delivery/verify-pin`, {
        method: 'POST',
        body: JSON.stringify({ pin }),
      });

      if (res.verified) {
        setIsPinVerified(true);
        if (res.isLegacy) {
          setIsLegacyOrder(true);
        }
        toast.success(res.isLegacy ? 'Legacy order confirmed' : 'Delivery PIN verified');
      } else {
        setPinError('Invalid delivery PIN. Please enter the PIN provided for this order.');
      }
    } catch (err: any) {
      setPinError(err.message || 'Invalid delivery PIN. Please enter the PIN provided for this order.');
    } finally {
      setIsVerifyingPin(false);
    }
  };

  // Stepper handlers for delivered quantity per jar
  const handleQuantityChange = (jarItemId: string, maxQty: number, delta: number) => {
    setDeliveredQuantities((prev) => {
      const current = prev[jarItemId] ?? maxQty;
      const next = Math.max(0, Math.min(maxQty, current + delta));
      return { ...prev, [jarItemId]: next };
    });
  };

  // Stepper handlers for empty jars returned per jar
  const handleReturnQuantityChange = (jarItemId: string, delta: number) => {
    setReturnedQuantities((prev) => {
      const current = prev[jarItemId] ?? 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [jarItemId]: next };
    });
  };

  // Handle final delivery completion submission
  const handleConfirmDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPinVerified) {
      setPinError('Delivery PIN verification is required before confirming delivery.');
      return;
    }

    if (isShortDelivery && !effectiveShortReason) {
      toast.error('Please specify a reason for short delivery.');
      return;
    }

    // Validate payment if due
    if (pst.hasDue && paymentMode === 'PARTIAL') {
      const amt = Number(paymentAmount);
      if (isNaN(amt) || amt <= 0) {
        toast.error('Please enter a valid partial payment amount.');
        return;
      }
      if (amt > pst.due + 0.01) {
        toast.error(`Payment amount cannot exceed remaining due of ₹${pst.due.toFixed(2)}.`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const itemsPayload = allocations.map((alloc: any) => ({
        jarItemId: alloc.jarItemId,
        deliveredQuantity: deliveredQuantities[alloc.jarItemId] ?? alloc.quantity,
      }));

      const returnedItemsPayload = allocations.map((alloc: any) => ({
        jarItemId: alloc.jarItemId,
        returnedQuantity: returnedQuantities[alloc.jarItemId] ?? 0,
      }));

      const payload: any = {
        pin: pin || '0000',
        items: itemsPayload,
        returnedItems: returnedItemsPayload,
        returnedQuantity: totalReturned,
        shortDeliveryReason: isShortDelivery ? effectiveShortReason : undefined,
        note: deliveryNotes.trim() || undefined,
      };

      if (pst.hasDue) {
        payload.paymentInfo = {
          paymentMode,
          paymentMethod,
          ...(paymentMode === 'PARTIAL' ? { amountPaid: Number(paymentAmount) } : {}),
        };
      }

      await fetchWithAuth(`${apiPrefix}/${order.id}/delivery/complete`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      toast.success(
        isShortDelivery
          ? `Delivery completed with reconciliation (${totalDelivered}/${totalOut} jars, ${totalReturned} returned)`
          : `Order delivered successfully! (${totalDelivered} delivered, ${totalReturned} returned)`
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to complete delivery');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 via-white to-sky-50/30 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#1E88E5] text-white flex items-center justify-center font-bold shadow-xs">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 leading-tight">Complete Delivery</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-bold text-[#1E88E5]">
                  Order #{formatOrderId(order.id)}
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-xs font-semibold text-slate-500">
                  {totalOut} × 20L Jars Out
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <form onSubmit={handleConfirmDelivery} className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* STEP 1: Delivery Verification PIN */}
          <div className={`p-4 rounded-2xl border transition-all ${
            isPinVerified
              ? 'bg-emerald-50/60 border-emerald-200'
              : 'bg-slate-50/70 border-slate-200'
          }`}>
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <KeyRound className={`w-4 h-4 ${isPinVerified ? 'text-emerald-600' : 'text-[#1E88E5]'}`} />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Step 1: Delivery Verification PIN
                </span>
              </div>
              {isPinVerified && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3.5 h-3.5" /> PIN Verified
                </span>
              )}
            </div>

            {!isPinVerified ? (
              <div className="space-y-3">
                <p className="text-xs text-slate-600">
                  Ask the customer for the 4-digit delivery verification PIN displayed on their order details page.
                </p>

                <div className="flex items-center gap-2.5">
                  <input
                    ref={pinInputRef}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    placeholder="• • • •"
                    value={pin}
                    onChange={handlePinChange}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleVerifyPin();
                      }
                    }}
                    className="flex-1 text-center font-mono tracking-widest text-xl font-black py-2.5 px-3 bg-white border border-slate-300 rounded-xl focus:border-[#1E88E5] focus:ring-2 focus:ring-sky-100 outline-none text-slate-900 transition-all placeholder:text-slate-300"
                  />
                  <button
                    type="button"
                    onClick={handleVerifyPin}
                    disabled={isVerifyingPin || pin.length !== 4}
                    className="px-4 py-2.5 bg-[#1E88E5] hover:bg-[#1565C0] text-white rounded-xl text-xs font-bold transition shadow-xs disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed shrink-0 flex items-center gap-1.5"
                  >
                    {isVerifyingPin ? (
                      <span>Verifying...</span>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>Verify PIN</span>
                      </>
                    )}
                  </button>
                </div>

                {pinError && (
                  <p className="text-xs text-rose-600 font-semibold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{pinError}</span>
                  </p>
                )}
              </div>
            ) : (
              <div className="text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  {isLegacyOrder
                    ? 'Legacy order verified without PIN. You may now confirm delivery.'
                    : 'Customer PIN verified successfully. You can now adjust delivered quantities.'}
                </span>
              </div>
            )}
          </div>

          {/* STEP 2: Actual Delivered Quantity (Active after verification) */}
          <div className={`space-y-4 transition-all ${
            !isPinVerified ? 'opacity-50 pointer-events-none select-none' : 'opacity-100'
          }`}>
            <div className="flex items-center justify-between pb-1 border-b border-slate-100">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Step 2: Actual Delivered Quantity
              </span>
              <span className="text-[11px] font-semibold text-slate-500">
                Cannot exceed Out for Delivery
              </span>
            </div>

            {/* Jar Rows */}
            <div className="space-y-3">
              {allocations.map((alloc: any) => {
                const jarItem = alloc.jarItem;
                const isCompany = jarItem?.ownershipType === 'COMPANY';
                const displayName = isCompany ? 'Biodrops / Company Owned' : (jarItem?.name || 'Distributor Jar');
                const outQty = alloc.quantity;
                const delivered = deliveredQuantities[alloc.jarItemId] ?? outQty;
                const returned = returnedQuantities[alloc.jarItemId] ?? 0;
                const netHolding = delivered - returned;

                return (
                  <div
                    key={alloc.id}
                    className="p-3.5 bg-slate-50/70 border border-slate-200 rounded-2xl space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-slate-200/60 pb-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900 truncate">
                            {displayName}
                          </span>
                          {isCompany && (
                            <span className="text-[10px] font-bold text-sky-700 bg-sky-100 px-1.5 py-0.2 rounded">
                              Standard
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Out for Delivery: <span className="font-bold text-slate-700">{outQty}</span>
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Net Customer Jar Δ
                        </span>
                        <span className={`text-xs font-black tabular-nums ${netHolding >= 0 ? 'text-[#1677C8]' : 'text-amber-600'}`}>
                          {netHolding >= 0 ? `+${netHolding}` : netHolding} jars
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* Delivered Stepper */}
                      <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
                        <div>
                          <span className="block text-[10px] uppercase font-bold text-emerald-700">Delivered</span>
                          <span className="text-[11px] text-slate-400 font-medium">To Customer</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleQuantityChange(alloc.jarItemId, outQty, -1)}
                            disabled={delivered <= 0}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-7 text-center text-xs font-black text-emerald-700 tabular-nums">
                            {delivered}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleQuantityChange(alloc.jarItemId, outQty, 1)}
                            disabled={delivered >= outQty}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Returned Stepper */}
                      <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
                        <div>
                          <span className="block text-[10px] uppercase font-bold text-indigo-700">Returned Empty</span>
                          <span className="text-[11px] text-slate-400 font-medium">Collected Back</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleReturnQuantityChange(alloc.jarItemId, -1)}
                            disabled={returned <= 0}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-7 text-center text-xs font-black text-indigo-700 tabular-nums">
                            {returned}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleReturnQuantityChange(alloc.jarItemId, 1)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Reconciliation Totals Summary Bar */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-500">Dispatched</p>
                <p className="text-sm font-black text-slate-800 mt-0.5">{totalOut}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-emerald-600">Delivered</p>
                <p className="text-sm font-black text-emerald-700 mt-0.5">{totalDelivered}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-indigo-600">Returned</p>
                <p className="text-sm font-black text-indigo-700 mt-0.5">{totalReturned}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-500">Net Customer Δ</p>
                <p className={`text-sm font-black mt-0.5 ${netWithCustomer >= 0 ? 'text-[#1677C8]' : 'text-amber-600'}`}>
                  {netWithCustomer >= 0 ? `+${netWithCustomer}` : netWithCustomer}
                </p>
              </div>
            </div>

            {/* Reason for Short Delivery (Mandatory if totalDelivered < totalOut) */}
            {isShortDelivery && (
              <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-2.5 animate-in fade-in duration-200">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Reason for short delivery <span className="text-rose-500">*</span></span>
                </div>

                <select
                  value={shortReason}
                  onChange={(e) => setShortReason(e.target.value)}
                  className="w-full p-2 bg-white border border-amber-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-[#1E88E5]"
                >
                  {SHORT_DELIVERY_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>

                {shortReason === 'Other' && (
                  <input
                    type="text"
                    required
                    placeholder="Enter reason for short delivery *"
                    value={otherReasonText}
                    onChange={(e) => setOtherReasonText(e.target.value)}
                    className="w-full p-2 bg-white border border-amber-300 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-[#1E88E5]"
                  />
                )}

                <p className="text-[11px] text-amber-700">
                  {totalUndelivered} jar{totalUndelivered === 1 ? '' : 's'} will be automatically reconciled back to the corresponding inventory stock.
                </p>
              </div>
            )}

            {/* Payment Collection if due */}
            {pst.hasDue && (
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-[#1E88E5]" /> Collect Payment on Delivery
                  </span>
                  <span className="font-black text-amber-600">
                    Due: ₹{pst.due.toFixed(2)}
                  </span>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMode('FULL')}
                    className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold border transition ${
                      paymentMode === 'FULL'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-slate-600 border-slate-200'
                    }`}
                  >
                    Fully Paid (₹{pst.due.toFixed(2)})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMode('PARTIAL')}
                    className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold border transition ${
                      paymentMode === 'PARTIAL'
                        ? 'bg-amber-600 text-white border-amber-600'
                        : 'bg-white text-slate-600 border-slate-200'
                    }`}
                  >
                    Partial Payment
                  </button>
                </div>

                {paymentMode === 'PARTIAL' && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Amount Collected
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={pst.due}
                      placeholder={`Max ₹${pst.due.toFixed(2)}`}
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-[#1E88E5]"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Payment Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-[#1E88E5]"
                  >
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="CARD">Card</option>
                  </select>
                </div>
              </div>
            )}

            {/* Optional Delivery Notes */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Notes (Optional)
              </label>
              <input
                type="text"
                placeholder="Optional delivery notes or customer comments..."
                value={deliveryNotes}
                onChange={(e) => setDeliveryNotes(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-[#1E88E5]"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                isSubmitting ||
                !isPinVerified ||
                (isShortDelivery && !effectiveShortReason)
              }
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed shadow-xs flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <span>Confirming...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm Delivery</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
