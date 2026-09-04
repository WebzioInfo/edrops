import React, { useState } from 'react';
import { ShoppingBag, ShieldCheck, Tag, ChevronDown, ChevronUp, Check, Truck, Lock } from 'lucide-react';

export interface CheckoutOrderSummaryProps {
  items: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
    imageUrl?: string;
    brandName?: string;
    isJar?: boolean;
    depositAmount?: number;
  }>;
  subTotal: number;
  depositTotal: number;
  deliveryCharge: number;
  promoDiscount: number;
  appliedPromo: any | null;
  promoInput: string;
  setPromoInput: (code: string) => void;
  handleApplyPromo: () => void;
  handleRemovePromo: () => void;
  isValidatingPromo: boolean;
  promoError: string;
  walletBalance: number;
  walletDeduction: number;
  paymentMethod: string;
  grandTotal: number;
  isMobileDrawer?: boolean;
}

export const CheckoutOrderSummary: React.FC<CheckoutOrderSummaryProps> = ({
  items,
  subTotal,
  depositTotal,
  deliveryCharge,
  promoDiscount,
  appliedPromo,
  promoInput,
  setPromoInput,
  handleApplyPromo,
  handleRemovePromo,
  isValidatingPromo,
  promoError,
  walletBalance,
  walletDeduction,
  paymentMethod,
  grandTotal,
  isMobileDrawer = false,
}) => {
  const [itemsExpanded, setItemsExpanded] = useState(!isMobileDrawer);
  const [promoOpen, setPromoOpen] = useState(Boolean(appliedPromo));

  return (
    <div className={`bg-white rounded-2xl border border-[#E2E8F0] shadow-xs overflow-hidden ${isMobileDrawer ? 'border-0 shadow-none' : ''}`}>
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-[#F1F5F9] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingBag className="w-4 h-4 text-[#1E88E5]" />
          <h3 className="font-bold text-[16px] text-[#0F172A]">Order Summary</h3>
        </div>
        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#EBF5FB] text-[#1E88E5]">
          {items.reduce((acc, i) => acc + i.quantity, 0)} {items.reduce((acc, i) => acc + i.quantity, 0) === 1 ? 'item' : 'items'}
        </span>
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        {/* Compact Items List / Accordion */}
        <div>
          <button
            type="button"
            onClick={() => setItemsExpanded(!itemsExpanded)}
            className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#64748B] hover:text-[#0F172A] transition-colors pb-2 cursor-pointer"
          >
            <span>Products in Cart ({items.length})</span>
            {itemsExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {itemsExpanded && (
            <div className="space-y-2.5 max-h-48 overflow-y-auto no-scrollbar pt-1">
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-2.5 text-xs">
                  <div className="w-10 h-10 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <ShoppingBag className="w-4 h-4 text-[#94A3B8]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[#0F172A] truncate text-[13px]">{item.name}</p>
                    <p className="text-[11px] text-[#64748B]">
                      Qty: {item.quantity} × ₹{item.price}
                      {item.isJar && item.depositAmount ? ` · Deposit ₹${item.depositAmount}` : ''}
                    </p>
                  </div>
                  <span className="font-bold text-[#0F172A] text-[13px] shrink-0">
                    ₹{item.price * item.quantity}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Promo Code Input Accordion */}
        <div className="border-t border-[#F1F5F9] pt-3">
          {!appliedPromo && !promoOpen ? (
            <button
              type="button"
              onClick={() => setPromoOpen(true)}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#1E88E5] hover:text-[#1565C0] cursor-pointer"
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Have a promo code?</span>
            </button>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-[#64748B]">
                <span className="flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5 text-[#1E88E5]" /> Promo Code
                </span>
                {!appliedPromo && (
                  <button
                    type="button"
                    onClick={() => setPromoOpen(false)}
                    className="text-[11px] text-[#94A3B8] hover:text-[#64748B]"
                  >
                    Cancel
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter code"
                  value={promoInput}
                  onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                  disabled={Boolean(appliedPromo) || isValidatingPromo}
                  className="flex-1 h-9 px-3 border border-[#E2E8F0] bg-[#F8FAFC] rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1E88E5] focus:bg-white uppercase disabled:bg-slate-50 disabled:text-slate-400"
                />
                {appliedPromo ? (
                  <button
                    type="button"
                    onClick={handleRemovePromo}
                    className="px-3 h-9 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                  >
                    Remove
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleApplyPromo}
                    disabled={!promoInput.trim() || isValidatingPromo}
                    className="px-4 h-9 bg-[#1E88E5] hover:bg-[#1565C0] disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
                  >
                    {isValidatingPromo ? '...' : 'Apply'}
                  </button>
                )}
              </div>

              {promoError && <p className="text-[11px] text-rose-500 font-medium pl-1">{promoError}</p>}

              {appliedPromo && (
                <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center justify-between text-emerald-800 text-xs">
                  <div className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <div>
                      <span className="font-bold">{appliedPromo.code}</span>
                      <span className="text-[11px] text-emerald-600 block">{appliedPromo.description}</span>
                    </div>
                  </div>
                  <span className="font-black text-emerald-700">-₹{promoDiscount}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Breakdown Calculation */}
        <div className="border-t border-[#F1F5F9] pt-3 space-y-2 text-[13px] font-medium text-[#64748B]">
          <div className="flex justify-between items-center">
            <span>Items Subtotal</span>
            <span className="font-semibold text-[#0F172A]">₹{subTotal}</span>
          </div>

          {depositTotal > 0 && (
            <div className="flex justify-between items-center text-[#0F172A]">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#1E88E5]" /> Security Deposit
              </span>
              <span className="font-semibold">₹{depositTotal}</span>
            </div>
          )}

          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1">
              <Truck className="w-3.5 h-3.5 text-[#64748B]" /> Delivery Fee
            </span>
            <span className="font-semibold">
              {deliveryCharge === 0 ? <span className="text-emerald-600 font-bold">FREE</span> : `₹${deliveryCharge}`}
            </span>
          </div>

          {promoDiscount > 0 && (
            <div className="flex justify-between items-center text-emerald-600">
              <span>Coupon Discount</span>
              <span className="font-bold">-₹{promoDiscount}</span>
            </div>
          )}

          {walletDeduction > 0 && (
            <div className="flex justify-between items-center text-[#1E88E5]">
              <span>Wallet Applied (Bal: ₹{walletBalance})</span>
              <span className="font-bold">-₹{walletDeduction}</span>
            </div>
          )}
        </div>

        {/* Total Row */}
        <div className="border-t-2 border-dashed border-[#E2E8F0] pt-3 flex justify-between items-baseline">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
              {paymentMethod === 'WALLET' && grandTotal === 0 ? 'Paid via Wallet' : 'Total Amount'}
            </span>
            <p className="text-[11px] text-[#94A3B8] font-normal">Inclusive of all taxes</p>
          </div>
          <span className="text-[22px] sm:text-[24px] font-black text-[#1E88E5]">
            ₹{grandTotal}
          </span>
        </div>

        {/* Trust Badges */}
        {!isMobileDrawer && (
          <div className="pt-2 border-t border-[#F1F5F9] flex items-center justify-center gap-4 text-[11px] text-[#94A3B8]">
            <span className="flex items-center gap-1">
              <Lock className="w-3 h-3 text-emerald-600" /> 100% Safe Payments
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-[#1E88E5]" /> Instant Delivery
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default CheckoutOrderSummary;
