import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Minus,
  Plus,
  Truck,
  CreditCard,
  RotateCcw,
  PackageCheck,
} from 'lucide-react';
import { fetchWithAuth } from '../api/client';
import { toast } from 'react-hot-toast';
import { formatOrderId } from '../utils/orderFormatters';
import {
  calculateMultiItemDelivery,
  type ItemDeliveryCalculationParams,
} from '../utils/deliveryCalculation';

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
  const [amountReceived, setAmountReceived] = useState<string>('');
  const [isManualAmount, setIsManualAmount] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState('CASH');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const pinInputRef = useRef<HTMLInputElement>(null);

  // Resolve refill rate and deposit rate from order items
  const jarItem = useMemo(() => {
    if (!order?.items || order.items.length === 0) return null;
    return (
      order.items.find(
        (i: any) => i.product?.isJar || (i.product?.depositAmount && i.product?.depositAmount > 0)
      ) || order.items[0]
    );
  }, [order]);

  const defaultRefillRate = Number(jarItem?.unitPrice ?? 100);
  const defaultDepositRate = Number(
    jarItem?.product?.depositAmount && jarItem.product.depositAmount > 0
      ? jarItem.product.depositAmount
      : 200
  );

  const allocations = order?.jarAllocations || [];

  // Build items array for multi-item calculation
  const itemsForCalc: ItemDeliveryCalculationParams[] = useMemo(() => {
    if (!allocations || allocations.length === 0) {
      const fallbackQty = order?.items?.reduce((acc: number, i: any) => acc + (Number(i.quantity) || 0), 0) || 1;
      const delivered = deliveredQuantities['fallback'] ?? fallbackQty;
      const returned = returnedQuantities['fallback'] ?? 0;
      return [
        {
          id: 'fallback',
          name: 'Standard 20L Jar',
          outQty: fallbackQty,
          deliveredQty: delivered,
          returnedQty: returned,
          refillRate: defaultRefillRate,
          depositRate: defaultDepositRate,
        },
      ];
    }

    return allocations.map((alloc: any) => {
      const outQty = Number(alloc.quantity) || 0;
      const delivered = deliveredQuantities[alloc.jarItemId] ?? outQty;
      const returned = returnedQuantities[alloc.jarItemId] ?? 0;

      const ownershipLabel =
        alloc.jarItem?.ownershipType === 'COMPANY'
          ? 'Biodrops / Company Owned'
          : (alloc.jarItem?.name ? `${alloc.jarItem.name} (Distributor)` : 'Distributor Owned');

      return {
        id: alloc.jarItemId,
        name: ownershipLabel,
        outQty,
        deliveredQty: delivered,
        returnedQty: returned,
        refillRate: defaultRefillRate,
        depositRate: defaultDepositRate,
      };
    });
  }, [allocations, deliveredQuantities, returnedQuantities, defaultRefillRate, defaultDepositRate, order]);

  // Authoritative settlement calculation (single source of truth for all items)
  const settlement = useMemo(() => {
    return calculateMultiItemDelivery(itemsForCalc);
  }, [itemsForCalc]);

  const totalOut = settlement.totalOutQty;
  const totalDelivered = settlement.totalDeliveredQty;
  const totalReturned = settlement.totalReturnedQty;
  const totalUndelivered = settlement.totalUndeliveredQty;
  const isShortDelivery = totalDelivered < totalOut;

  // Existing payments already recorded
  const alreadyPaid = useMemo(() => {
    if (!order?.payments || order.payments.length === 0) return 0;
    return order.payments
      .filter((p: any) => p.status === 'PAID' || p.status === 'SUCCESS')
      .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
  }, [order]);

  // Expected remaining due based on actual delivery settlement
  const netPayable = Math.max(0, Number((settlement.grandCalculatedAmount - alreadyPaid).toFixed(2)));

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
      setAmountReceived('');
      setIsManualAmount(false);
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
    } else {
      const fallbackQty = order?.items?.reduce((acc: number, i: any) => acc + (Number(i.quantity) || 0), 0) || 1;
      initialDelivered['fallback'] = fallbackQty;
      initialReturned['fallback'] = 0;
    }
    setDeliveredQuantities(initialDelivered);
    setReturnedQuantities(initialReturned);

    // If order already has verified delivery verification
    if (order.deliveryVerification?.isVerified) {
      setIsPinVerified(true);
    }

    // Auto-focus the PIN input if not yet verified
    setTimeout(() => {
      pinInputRef.current?.focus();
    }, 150);
  }, [isOpen, order]);

  // Keep amountReceived in sync with netPayable unless manually modified
  useEffect(() => {
    if (!isManualAmount) {
      setAmountReceived(netPayable.toString());
    }
  }, [netPayable, isManualAmount]);

  if (!isOpen || !order) return null;

  const effectiveShortReason =
    shortReason === 'Other' ? otherReasonText.trim() : shortReason;

  // Handle PIN input change (numeric 4 digits only)
  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
    setPin(val);
    setPinError(null);
  };

  // Verify PIN via server
  const handleVerifyPin = async () => {
    if (pin.length !== 4) {
      setPinError('Please enter a 4-digit PIN.');
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
        setPinError('Invalid delivery PIN.');
      }
    } catch (err: any) {
      setPinError(err.message || 'Invalid delivery PIN.');
    } finally {
      setIsVerifyingPin(false);
    }
  };

  // Stepper handler for delivered quantity with automatic safe clamping of returned quantity
  const handleQuantityChange = (key: string, maxQty: number, delta: number) => {
    setDeliveredQuantities((prev) => {
      const current = prev[key] ?? maxQty;
      const nextDelivered = Math.max(0, Math.min(maxQty, current + delta));

      // Auto-clamp returned empty jars so returned cannot exceed delivered
      setReturnedQuantities((prevRet) => {
        const curRet = prevRet[key] ?? 0;
        if (curRet > nextDelivered) {
          return { ...prevRet, [key]: nextDelivered };
        }
        return prevRet;
      });

      return { ...prev, [key]: nextDelivered };
    });
  };

  // Stepper handler for empty jars returned (strictly clamped: 0 <= returned <= delivered)
  const handleReturnQuantityChange = (key: string, maxDelivered: number, delta: number) => {
    setReturnedQuantities((prev) => {
      const current = prev[key] ?? 0;
      const nextReturned = Math.max(0, Math.min(maxDelivered, current + delta));
      return { ...prev, [key]: nextReturned };
    });
  };

  // Manual payment amount handling
  const handleAmountReceivedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsManualAmount(true);
    setAmountReceived(e.target.value);
  };

  const handleResetToCalculated = () => {
    setIsManualAmount(false);
    setAmountReceived(netPayable.toString());
  };

  const numEntered = Number(amountReceived) || 0;
  const diff = Number((numEntered - netPayable).toFixed(2));

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

    if (totalReturned > totalDelivered) {
      toast.error('Returned empty jars cannot exceed delivered jars.');
      return;
    }

    setIsSubmitting(true);
    try {
      const itemsPayload = allocations.length > 0
        ? allocations.map((alloc: any) => ({
            jarItemId: alloc.jarItemId,
            deliveredQuantity: deliveredQuantities[alloc.jarItemId] ?? alloc.quantity,
          }))
        : [
            {
              jarItemId: 'fallback',
              deliveredQuantity: deliveredQuantities['fallback'] ?? totalOut,
            },
          ];

      const returnedItemsPayload = allocations.length > 0
        ? allocations.map((alloc: any) => ({
            jarItemId: alloc.jarItemId,
            returnedQuantity: returnedQuantities[alloc.jarItemId] ?? 0,
          }))
        : [
            {
              jarItemId: 'fallback',
              returnedQuantity: returnedQuantities['fallback'] ?? 0,
            },
          ];

      const isPartial = numEntered < netPayable;

      const payload: any = {
        pin: pin || '0000',
        items: itemsPayload,
        returnedItems: returnedItemsPayload,
        returnedQuantity: totalReturned,
        shortDeliveryReason: isShortDelivery ? effectiveShortReason : undefined,
        note: deliveryNotes.trim() || undefined,
        paymentInfo: {
          paymentMode: isPartial ? 'PARTIAL' : 'FULL',
          paymentMethod,
          amountPaid: numEntered,
          isManualAdjustment: isManualAmount,
          manualAmount: numEntered,
        },
      };

      await fetchWithAuth(`${apiPrefix}/${order.id}/delivery/complete`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      toast.success(
        isShortDelivery
          ? `Delivery confirmed (${totalDelivered}/${totalOut} delivered, ${totalReturned} returned)`
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

  const hasMultipleItems = settlement.items.length > 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-[1000px] max-h-[92vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden">
        {/* Compact Header */}
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 via-white to-sky-50/20 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#1677C8] text-white flex items-center justify-center font-bold shadow-xs">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 leading-tight">Complete Delivery</h2>
              <div className="flex items-center gap-1.5 mt-0.5 text-xs">
                <span className="font-bold text-[#1677C8]">Order #{formatOrderId(order.id)}</span>
                <span className="text-slate-300">•</span>
                <span className="text-slate-500 font-semibold">{totalOut} × 20L Jars</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Landscape Form Layout */}
        <form onSubmit={handleConfirmDelivery} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Main Content Area: 2 Columns on Desktop, Single Column on Mobile */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              
              {/* LEFT COLUMN: Delivery & Quantity Reconciliation (col-span-7) */}
              <div className="lg:col-span-7 space-y-3.5">
                
                {/* OTP Verification: Compact single-row UI */}
                <div
                  className={`px-3.5 py-2.5 rounded-xl border transition-all ${
                    isPinVerified
                      ? 'bg-emerald-50/70 border-emerald-200'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                          isPinVerified ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-[#1677C8]'
                        }`}
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        Delivery PIN
                      </span>
                    </div>

                    {isPinVerified ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100/90 px-2.5 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3.5 h-3.5" /> {isLegacyOrder ? 'Legacy Order' : 'Verified'}
                      </span>
                    ) : (
                      <div className="flex items-center gap-2">
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
                          className="w-24 text-center font-mono tracking-widest text-sm font-black py-1 px-2 bg-white border border-slate-300 rounded-lg focus:border-[#1677C8] outline-none text-slate-900"
                        />
                        <button
                          type="button"
                          onClick={handleVerifyPin}
                          disabled={isVerifyingPin || pin.length !== 4}
                          className="px-3 py-1 bg-[#1677C8] hover:bg-[#1264A8] text-white rounded-lg text-xs font-bold transition shadow-xs disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed shrink-0"
                        >
                          {isVerifyingPin ? '...' : 'Verify'}
                        </button>
                      </div>
                    )}
                  </div>
                  {pinError && (
                    <p className="text-xs text-rose-600 font-semibold flex items-center gap-1 mt-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{pinError}</span>
                    </p>
                  )}
                </div>

                {/* Delivery Section Header */}
                <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                  <div className="flex items-center gap-1.5">
                    <PackageCheck className="w-4 h-4 text-[#1677C8]" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Delivery Items
                    </span>
                  </div>
                  <span className="text-xs font-medium text-slate-500">
                    Out for Delivery: <strong className="text-slate-800 font-black">{totalOut}</strong>
                  </span>
                </div>

                {/* Separate Item Cards per Allocation */}
                <div className="space-y-2.5">
                  {settlement.items.map((item) => {
                    const key = item.id || 'fallback';
                    const outQty = item.outQty ?? totalOut;
                    const delivered = item.deliveredQty;
                    const returned = item.returnedQty;
                    const isItemShort = delivered < outQty;

                    return (
                      <div
                        key={key}
                        className={`p-3 rounded-xl border transition-all ${
                          !isPinVerified
                            ? 'opacity-60 pointer-events-none bg-slate-50/50 border-slate-200'
                            : 'bg-white border-slate-200 shadow-2xs hover:border-slate-300'
                        }`}
                      >
                        {/* Item Header */}
                        <div className="flex items-center justify-between gap-2 mb-2.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-xs font-black text-slate-800 truncate">
                              {item.name}
                            </span>
                            {isItemShort && (
                              <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded-md shrink-0">
                                Short: {outQty - delivered}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] font-semibold text-slate-500 shrink-0">
                            Out: <strong className="text-slate-700 font-black">{outQty}</strong>
                          </span>
                        </div>

                        {/* Delivered & Returned Stepper Controls */}
                        <div className="grid grid-cols-2 gap-2.5">
                          {/* Delivered Stepper */}
                          <div className="bg-slate-50 p-2 rounded-xl border border-slate-200/80 flex items-center justify-between">
                            <div>
                              <span className="block text-[10px] uppercase font-bold text-emerald-700 tracking-wider">
                                Delivered
                              </span>
                              <span className="text-[10px] text-slate-400">max {outQty}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleQuantityChange(key, outQty, -1)}
                                disabled={delivered <= 0 || !isPinVerified}
                                className="w-7 h-7 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 disabled:opacity-30 disabled:hover:bg-white flex items-center justify-center cursor-pointer transition shadow-2xs"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="w-5 text-center text-xs font-black text-emerald-700 tabular-nums">
                                {delivered}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleQuantityChange(key, outQty, 1)}
                                disabled={delivered >= outQty || !isPinVerified}
                                className="w-7 h-7 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 disabled:opacity-30 disabled:hover:bg-white flex items-center justify-center cursor-pointer transition shadow-2xs"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Returned Empty Stepper (strictly <= delivered) */}
                          <div className="bg-slate-50 p-2 rounded-xl border border-slate-200/80 flex items-center justify-between">
                            <div>
                              <span className="block text-[10px] uppercase font-bold text-indigo-700 tracking-wider">
                                Returned
                              </span>
                              <span className="text-[10px] text-slate-400">max {delivered}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleReturnQuantityChange(key, delivered, -1)}
                                disabled={returned <= 0 || !isPinVerified}
                                className="w-7 h-7 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 disabled:opacity-30 disabled:hover:bg-white flex items-center justify-center cursor-pointer transition shadow-2xs"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="w-5 text-center text-xs font-black text-indigo-700 tabular-nums">
                                {returned}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleReturnQuantityChange(key, delivered, 1)}
                                disabled={returned >= delivered || !isPinVerified}
                                className="w-7 h-7 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 disabled:opacity-30 disabled:hover:bg-white flex items-center justify-center cursor-pointer transition shadow-2xs"
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

                {/* Short Delivery Reason (ONLY VISIBLE WHEN totalDelivered < totalOut) */}
                {isShortDelivery && (
                  <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl space-y-2 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between text-xs font-bold text-amber-900">
                      <span className="flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                        Short Delivery ({totalUndelivered} jar{totalUndelivered === 1 ? '' : 's'} to yard)
                        <span className="text-rose-500">*</span>
                      </span>
                    </div>

                    <select
                      value={shortReason}
                      onChange={(e) => setShortReason(e.target.value)}
                      className="w-full p-2 bg-white border border-amber-300 rounded-lg text-xs font-semibold text-slate-800 outline-none"
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
                        placeholder="Specify reason for short delivery..."
                        value={otherReasonText}
                        onChange={(e) => setOtherReasonText(e.target.value)}
                        className="w-full p-2 bg-white border border-amber-300 rounded-lg text-xs font-medium text-slate-800 outline-none"
                      />
                    )}
                  </div>
                )}
              </div>

              {/* RIGHT COLUMN: Payment Summary & Calculation (col-span-5) */}
              <div className="lg:col-span-5 space-y-3.5">
                <div className="p-4 bg-slate-50/80 border border-slate-200 rounded-2xl space-y-3">
                  {/* Summary Header */}
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-[#1677C8]" /> Payment Summary
                    </span>
                    {isManualAmount && (
                      <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                        Adjusted
                      </span>
                    )}
                  </div>

                  {/* Multiple Items Breakdown or Single Clean Formula */}
                  {hasMultipleItems ? (
                    <div className="space-y-2.5">
                      {settlement.items.map((it) => (
                        <div key={it.id || it.name} className="p-2.5 bg-white border border-slate-200/70 rounded-xl space-y-1 text-xs">
                          <div className="flex items-center justify-between font-bold text-slate-800">
                            <span className="truncate">{it.name}</span>
                            <span className="text-[#1677C8] font-black tabular-nums">₹{it.totalAmount.toFixed(2)}</span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span>Refill ({it.deliveredQty} × ₹{it.refillRate})</span>
                            <span className="tabular-nums">₹{it.refillAmount.toFixed(2)}</span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span>Jar Deposit ({it.deliveredQty} × ₹{it.depositRate})</span>
                            <span className="tabular-nums">₹{it.baseDeposit.toFixed(2)}</span>
                          </div>
                          {it.returnedQty > 0 && (
                            <div className="flex items-center justify-between text-[11px] text-rose-600 font-semibold">
                              <span>Returned Empty ({it.returnedQty} × ₹{it.depositRate})</span>
                              <span className="tabular-nums">−₹{it.returnDeduction.toFixed(2)}</span>
                            </div>
                          )}
                          <div className="flex items-center justify-between text-[11px] text-slate-600 font-medium pt-0.5 border-t border-slate-100">
                            <span>Final Deposit</span>
                            <span className="tabular-nums">₹{it.finalDeposit.toFixed(2)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    /* Single Item Explicit Calculation (Clear breakdown of return deduction) */
                    <div className="space-y-1.5 text-xs">
                      {/* Refill Line */}
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600 font-medium">
                          Refill ({settlement.totalDeliveredQty} × ₹{settlement.refillRate})
                        </span>
                        <span className="font-bold text-slate-800 tabular-nums">
                          ₹{settlement.totalRefillAmount.toFixed(2)}
                        </span>
                      </div>

                      {/* Jar Deposit Line */}
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600 font-medium">
                          Jar Deposit ({settlement.totalDeliveredQty} × ₹{settlement.depositRate})
                        </span>
                        <span className="font-bold text-slate-800 tabular-nums">
                          ₹{settlement.totalBaseDeposit.toFixed(2)}
                        </span>
                      </div>

                      {/* Returned Empty Deduction */}
                      <div className="flex items-center justify-between text-rose-600">
                        <span className="font-medium">
                          Returned Empty ({settlement.totalReturnedQty} × ₹{settlement.depositRate})
                        </span>
                        <span className="font-bold tabular-nums">
                          −₹{settlement.totalReturnDeduction.toFixed(2)}
                        </span>
                      </div>

                      {/* Final Deposit Row */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-slate-700">
                        <span className="font-semibold">
                          Final Deposit ({settlement.depositQty} × ₹{settlement.depositRate})
                        </span>
                        <span className="font-bold tabular-nums">
                          ₹{settlement.totalFinalDeposit.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Prepaid Deduction if applicable */}
                  {alreadyPaid > 0 && (
                    <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-200/80 text-emerald-700">
                      <span className="font-medium">Prepaid Online</span>
                      <span className="font-bold tabular-nums">−₹{alreadyPaid.toFixed(2)}</span>
                    </div>
                  )}

                  {/* Calculated Grand Total */}
                  <div className="flex items-center justify-between pt-2 border-t-2 border-slate-200">
                    <div>
                      <span className="text-xs font-black uppercase tracking-wider text-slate-700 block">
                        Calculated Total
                      </span>
                      {alreadyPaid > 0 && (
                        <span className="text-[11px] text-slate-500 font-medium">Net Due: ₹{netPayable.toFixed(2)}</span>
                      )}
                    </div>
                    <span className="text-lg font-black text-[#1677C8] tabular-nums">
                      ₹{settlement.grandCalculatedAmount.toFixed(2)}
                    </span>
                  </div>

                  {/* Payment Collection & Manual Amount Edit */}
                  <div className="pt-2 border-t border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700">
                        Amount Received
                      </label>
                      {isManualAmount && (
                        <button
                          type="button"
                          onClick={handleResetToCalculated}
                          className="text-[11px] font-bold text-[#1677C8] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" /> Use Calculated Amount
                        </button>
                      )}
                    </div>

                    <div className="relative">
                      <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">₹</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={amountReceived}
                        onChange={handleAmountReceivedChange}
                        className="w-full pl-7 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-sm font-black text-slate-800 outline-none focus:border-[#1677C8] tabular-nums"
                        placeholder="0.00"
                      />
                    </div>

                    {/* Difference indicator when manual amount entered */}
                    {isManualAmount && diff !== 0 && (
                      <div className="flex items-center justify-between text-xs px-0.5">
                        <span className="text-slate-500 font-medium">Difference:</span>
                        {diff < 0 ? (
                          <span className="font-bold text-amber-600 tabular-nums">
                            ₹{Math.abs(diff).toFixed(2)} remaining
                          </span>
                        ) : (
                          <span className="font-bold text-emerald-600 tabular-nums">
                            +₹{diff.toFixed(2)} excess
                          </span>
                        )}
                      </div>
                    )}

                    {/* Payment Method Selector */}
                    <div className="pt-1">
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Payment Method
                      </label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-[#1677C8]"
                      >
                        <option value="CASH">Cash</option>
                        <option value="UPI">UPI</option>
                        <option value="BANK_TRANSFER">Bank Transfer</option>
                        <option value="CARD">Card</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sticky Bottom Footer */}
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/80 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="w-full sm:w-72">
              <input
                type="text"
                placeholder="Delivery notes (optional)..."
                value={deliveryNotes}
                onChange={(e) => setDeliveryNotes(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-[#1677C8] placeholder:text-slate-400"
              />
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer transition"
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
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed shadow-xs flex items-center gap-1.5 transition"
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
          </div>
        </form>
      </div>
    </div>
  );
};
