import { useState, useEffect } from 'react';
import { CreditCard, Tag, Sparkles, Droplet, Check, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { injectMockRazorpay } from '../../../utils/MockRazorpay';
import { fetchWithAuth } from '../../../api/client';
import LoadingSpinner from '../../../components/LoadingSpinner';

interface Pack {
  id: string;
  name: string;
  jarCount: number;
  price: number;
  originalPrice: number | null;
  discountPercent: number | null;
  offerLabel: string | null;
  packageBadge: string | null;
  packageColor: string | null;
}

export default function RechargePage() {
  const [packs, setPacks] = useState<Pack[]>([]);
  const [selectedPack, setSelectedPack] = useState<Pack | null>(null);
  const [loading, setLoading] = useState(true);
  const [promoCode, setPromoCode] = useState('');
  const [applying, setApplying] = useState(false);
  const [appliedPromo, setAppliedPromo] = useState<string | null>(null);
  const [discount, setDiscount] = useState<number>(0);
  const [promoError, setPromoError] = useState('');
  const [purchasing, setPurchasing] = useState(false);

  const loadPacks = async () => {
    try {
      setLoading(true);
      const data = await fetchWithAuth('/recharge/packages');
      setPacks(data || []);
      if (data && data.length > 0) {
        setSelectedPack(data[0]);
      }
    } catch (err: any) {
      toast.error('Failed to load prepaid packages.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPacks();
  }, []);

  const handleApplyPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoCode.trim()) return;
    setApplying(true);
    setPromoError('');
    try {
      const res = await fetchWithAuth('/promo/validate', {
        method: 'POST',
        body: JSON.stringify({
          code: promoCode,
          orderAmount: selectedPack ? selectedPack.price : undefined,
          isRecharge: true,
        }),
      });
      setAppliedPromo(promoCode.toUpperCase());
      setDiscount(res.calculatedDiscount || res.discountValue || 0);
      toast.success(`Coupon "${promoCode.toUpperCase()}" applied!`);
    } catch (err: any) {
      setAppliedPromo(null);
      setDiscount(0);
      const errMsg = err.message || 'Invalid coupon code';
      setPromoError(errMsg);
      toast.error(errMsg);
    } finally {
      setApplying(false);
    }
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setDiscount(0);
    setPromoCode('');
    setPromoError('');
    toast.success('Coupon removed');
  };

  useEffect(() => {
    if (appliedPromo && selectedPack) {
      fetchWithAuth('/promo/validate', {
        method: 'POST',
        body: JSON.stringify({
          code: appliedPromo,
          orderAmount: selectedPack.price,
          isRecharge: true
        })
      })
      .then((res) => {
        setDiscount(res.calculatedDiscount || res.discountValue || 0);
        setPromoError('');
      })
      .catch((err) => {
        setAppliedPromo(null);
        setDiscount(0);
        setPromoError(err.message || 'Coupon is no longer valid for this pack');
      });
    }
  }, [selectedPack?.id]);

  const loadRazorpay = () => {
    return new Promise((resolve) => {
      if (injectMockRazorpay()) {
        return resolve(true);
      }
      if ((window as any).Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleCheckout = async () => {
    if (!selectedPack) {
      toast.error('Please select a recharge pack first');
      return;
    }
    setPurchasing(true);
    try {
      const totalDue = Math.max(0, selectedPack.price - discount);
      
      const orderData = await fetchWithAuth('/payment/create-order', {
        method: 'POST',
        body: JSON.stringify({ amount: totalDue })
      });
      
      if (!orderData || !orderData.orderId) {
        throw new Error('Failed to initiate payment');
      }

      const isLoaded = await loadRazorpay();
      if (!isLoaded) {
        toast.error('Razorpay SDK failed to load. Please check your connection.');
        setPurchasing(false);
        return;
      }

      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_mockkey12345',
        amount: orderData.amount * 100,
        currency: 'INR',
        name: 'Edrops',
        description: `Recharge: ${selectedPack.name}`,
        order_id: orderData.orderId,
        handler: async function (response: any) {
          try {
            const verifiedPayment = await fetchWithAuth('/payment/verify', {
              method: 'POST',
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              })
            });
            await fetchWithAuth('/recharge/purchase', {
              method: 'POST',
              body: JSON.stringify({
                packageId: selectedPack.id,
                paymentId: verifiedPayment.id,
                amountPaid: totalDue,
                promoCode: appliedPromo,
              }),
            });
            toast.success('Recharge completed successfully!');
            setSelectedPack(null);
            setPromoCode('');
            setAppliedPromo(null);
            setDiscount(0);
          } catch (err: any) {
            toast.error('Payment verification failed.');
          }
        },
        theme: {
          color: '#0284C7'
        }
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', function (response: any) {
        toast.error(response.error.description || 'Payment failed');
      });
      rzp.open();
      
    } catch (err: any) {
      toast.error(err.message || 'Payment failed.');
    } finally {
      setPurchasing(false);
    }
  };

  /**
   * Helper to derive visual hierarchy, deduplicated signals, and tier treatments
   */
  const getPackCardInfo = (pack: Pack) => {
    const nameLower = pack.name.toLowerCase();
    const badgeLower = (pack.packageBadge || '').toLowerCase();
    const offerLower = (pack.offerLabel || '').toLowerCase();

    // Recommended package identification (e.g. Business Pack or explicit recommendation)
    const isRecommended =
      nameLower.includes('business') ||
      badgeLower.includes('recommend') ||
      offerLower.includes('recommend') ||
      badgeLower.includes('business choice');

    // Best Seller identification
    const isBestSeller =
      !isRecommended &&
      (badgeLower.includes('best') ||
        offerLower.includes('best') ||
        nameLower.includes('family'));

    // Maximum savings identification
    const isMaxSavings =
      !isRecommended &&
      !isBestSeller &&
      (badgeLower.includes('saving') ||
        offerLower.includes('super') ||
        nameLower.includes('enterprise'));

    // Top-Right Badge: Single, unambiguous signal
    let topBadge: { text: string; variant: 'recommended' | 'bestseller' | 'savings' | 'neutral' } | null = null;
    if (isRecommended) {
      topBadge = { text: '★ RECOMMENDED', variant: 'recommended' };
    } else if (isBestSeller) {
      topBadge = { text: 'BEST SELLER', variant: 'bestseller' };
    } else if (isMaxSavings) {
      topBadge = { text: 'MAX SAVINGS', variant: 'savings' };
    } else if (pack.packageBadge) {
      topBadge = { text: pack.packageBadge, variant: 'neutral' };
    }

    // Subtitle: Concrete value statement without repeating the badge claim
    let subtitle = '';
    const savings = (pack.originalPrice || pack.price * 1.25) - pack.price;
    const discountText = pack.discountPercent
      ? `Save ${pack.discountPercent}%`
      : savings > 0
      ? `Save ₹${Math.round(savings)}`
      : null;

    if (isRecommended) {
      subtitle = discountText
        ? `${discountText} • Optimized for offices & teams`
        : 'Optimized for small offices & active teams';
    } else if (isBestSeller) {
      subtitle = discountText
        ? `${discountText} • Most popular for homes`
        : 'Most popular choice for households';
    } else if (isMaxSavings) {
      subtitle = discountText
        ? `${discountText} • Lowest cost per jar`
        : 'Lowest cost per jar for high volume';
    } else if (nameLower.includes('starter')) {
      subtitle = discountText
        ? `${discountText} • Quick trial pack`
        : 'Ideal starter pack for individuals';
    } else if (pack.offerLabel && !['recommended', 'best value', 'super saver'].includes(offerLower)) {
      subtitle = pack.offerLabel;
    } else if (discountText) {
      subtitle = `${discountText} instant discount`;
    }

    return { isRecommended, isBestSeller, topBadge, subtitle, savings };
  };

  if (loading) {
    return <LoadingSpinner fullPage label="Loading recharge plans..." />;
  }

  return (
    <div className="min-h-screen bg-[#F7FAFC] pb-32 lg:pb-12 text-[#0F172A]">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 space-y-6 sm:space-y-8">
        
        {/* Page Header */}
        <div>
          <h1 className="text-[24px] md:text-[28px] font-bold text-[#0F172A] tracking-tight">
            Recharge Water
          </h1>
          <p className="text-[#64748B] text-sm mt-1 font-medium">
            Prepaid water jar packages with tiered discounts and guaranteed priority delivery
          </p>
        </div>

        <div className="grid gap-6 lg:gap-8 grid-cols-1 lg:grid-cols-12 items-start">

          {/* LEFT COLUMN: Pricing Packages Grid */}
          <div className="lg:col-span-8 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-bold text-[#0F172A] tracking-tight">
                Choose a Pack
              </h2>
              <span className="text-xs font-semibold text-[#64748B]">
                {packs.length} package options available
              </span>
            </div>

            {/* 2x2 Pack Grid on tablet/desktop, collapses to single column on mobile */}
            <div className="grid gap-5 grid-cols-1 sm:grid-cols-2">
              {packs.map((pack) => {
                const isSelected = selectedPack?.id === pack.id;
                const { isRecommended, topBadge, subtitle, savings } = getPackCardInfo(pack);
                
                // Styling classes for card states
                let cardStateStyle = '';
                if (isSelected) {
                  // Strengthened selected state with soft blue wash and layered shadow
                  cardStateStyle = 'border-2 border-[#0284C7] bg-[#F0F9FF] shadow-[0_12px_32px_rgba(2,132,199,0.14)] ring-2 ring-[#0284C7]/20';
                } else if (isRecommended) {
                  // Subtle distinguishing treatment for Recommended when not selected
                  cardStateStyle = 'border border-amber-300/80 bg-gradient-to-b from-amber-50/20 via-white to-white shadow-[0_4px_18px_rgba(245,158,11,0.06)] hover:border-amber-400 hover:shadow-[0_12px_28px_rgba(245,158,11,0.12)] hover:-translate-y-1';
                } else {
                  // Standard card treatment
                  cardStateStyle = 'bg-white border border-[#E2E8F0] hover:border-[#CBD5E1] shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_12px_28px_rgba(0,0,0,0.06)] hover:-translate-y-1';
                }

                return (
                  <button
                    key={pack.id}
                    type="button"
                    onClick={() => setSelectedPack(pack)}
                    className={`relative text-left rounded-[24px] p-5 sm:p-6 transition-all duration-200 flex flex-col justify-between min-h-[220px] cursor-pointer select-none ${cardStateStyle}`}
                  >
                    {/* Top-Right Badge: One clear signal per card */}
                    {topBadge && (
                      <div className="absolute top-4 right-4">
                        {topBadge.variant === 'recommended' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-amber-500 text-white px-2.5 py-1 rounded-full shadow-xs border border-amber-600/20">
                            <Sparkles className="w-3 h-3 text-amber-100" />
                            {topBadge.text}
                          </span>
                        )}
                        {topBadge.variant === 'bestseller' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-sky-500 text-white px-2.5 py-1 rounded-full shadow-xs">
                            {topBadge.text}
                          </span>
                        )}
                        {topBadge.variant === 'savings' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-emerald-600 text-white px-2.5 py-1 rounded-full shadow-xs">
                            {topBadge.text}
                          </span>
                        )}
                        {topBadge.variant === 'neutral' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-slate-700 text-white px-2.5 py-1 rounded-full shadow-xs">
                            {topBadge.text}
                          </span>
                        )}
                      </div>
                    )}

                    <div>
                      {/* Brand Blue Category Identifier (Water Droplet) */}
                      <div className="flex items-center gap-2.5 mb-2.5">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100/90 text-[#0284C7] shadow-xs ring-1 ring-sky-200/60">
                          <Droplet className="w-5 h-5 fill-[#0284C7]/20" />
                        </span>
                        <span className="text-xs font-bold uppercase tracking-wider text-[#0284C7]">
                          {pack.jarCount} Jars Pack
                        </span>
                      </div>

                      <h3 className="text-lg font-bold text-[#0F172A] tracking-tight">
                        {pack.name}
                      </h3>

                      {subtitle && (
                        <p className="text-xs text-emerald-700 font-semibold mt-1">
                          {subtitle}
                        </p>
                      )}

                      {/* Features checklist inside card */}
                      <div className="mt-4 space-y-1.5 border-t border-slate-100/80 pt-3">
                        <span className="text-xs font-semibold text-[#64748B] flex items-center gap-2">
                          <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> Priority doorstep delivery
                        </span>
                        <span className="text-xs font-semibold text-[#64748B] flex items-center gap-2">
                          <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> Flexible delivery schedule
                        </span>
                      </div>
                    </div>

                    {/* Bottom Pricing & Radio Indicator */}
                    <div className="mt-5 flex items-end justify-between w-full border-t border-slate-100/80 pt-4">
                      <div>
                        {pack.originalPrice && pack.originalPrice > pack.price && (
                          <span className="text-xs text-slate-400 line-through font-semibold block">
                            ₹{pack.originalPrice}
                          </span>
                        )}
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl sm:text-3xl font-black text-[#0F172A]">
                            ₹{pack.price}
                          </span>
                          {savings > 0 && (
                            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-md">
                              Save ₹{Math.round(savings)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Radio Selection Indicator */}
                      <span className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all ${
                        isSelected
                          ? 'border-[#0284C7] bg-[#0284C7] text-white shadow-xs'
                          : 'border-slate-300 bg-white'
                      }`}>
                        {isSelected && <span className="h-2 w-2 rounded-full bg-white" />}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* RIGHT COLUMN: Cohesive Summary & Coupon Sidebar */}
          <div className="lg:col-span-4 lg:sticky lg:top-24 space-y-5">

            {/* Promo Code Card */}
            <div className="bg-white rounded-[24px] border border-[#E2E8F0]/80 p-5 sm:p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
              <div className="flex items-center gap-2 mb-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-50 text-[#0284C7]">
                  <Tag className="h-3.5 w-3.5" />
                </span>
                <h4 className="text-xs font-bold text-[#64748B] uppercase tracking-wider">
                  Have a Coupon?
                </h4>
              </div>

              <form onSubmit={appliedPromo ? (e) => { e.preventDefault(); handleRemovePromo(); } : handleApplyPromo} className="flex gap-2">
                <input
                  type="text"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  placeholder="ENTER PROMO CODE"
                  disabled={!!appliedPromo}
                  className="flex-1 px-4 py-2.5 text-xs sm:text-sm font-semibold border border-[#CBD5E1] rounded-xl focus:outline-none focus:border-[#0284C7] focus:ring-3 focus:ring-[#0284C7]/15 uppercase disabled:bg-slate-50 disabled:text-slate-400 text-[#0F172A] transition-all"
                />
                <button
                  type="submit"
                  disabled={applying || (!appliedPromo && !promoCode.trim())}
                  className={`px-4 rounded-xl text-xs font-bold transition cursor-pointer select-none active:scale-95 ${
                    appliedPromo 
                      ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-xs' 
                      : 'bg-[#0284C7] hover:bg-[#0369A1] text-white shadow-xs disabled:bg-[#E2E8F0] disabled:text-[#94A3B8] disabled:cursor-not-allowed'
                  }`}
                >
                  {applying ? '...' : appliedPromo ? 'Remove' : 'Apply'}
                </button>
              </form>

              {promoError && <p className="text-xs text-rose-500 font-semibold mt-2.5 ml-1">{promoError}</p>}
              {appliedPromo && (
                <p className="text-xs font-bold text-emerald-600 mt-2.5 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
                  Code "{appliedPromo}" successfully applied!
                </p>
              )}
            </div>

            {/* Checkout Summary Card */}
            <div className="bg-white rounded-[24px] border border-[#E2E8F0]/80 p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col justify-between min-h-[280px]">
              <div>
                <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-50 text-[#0284C7]">
                    <CreditCard className="h-4 w-4" />
                  </span>
                  <h3 className="text-base font-bold text-[#0F172A]">
                    Recharge Summary
                  </h3>
                </div>

                <div className="mt-4 space-y-3 text-sm font-medium text-[#64748B]">
                  <div className="flex justify-between items-center text-[#0F172A]">
                    <span className="text-xs sm:text-sm text-[#64748B]">Selected Pack</span>
                    <span className="font-bold text-xs sm:text-sm text-[#0F172A]">
                      {selectedPack ? `${selectedPack.name} (${selectedPack.jarCount} Jars)` : 'None'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-xs sm:text-sm">Subtotal</span>
                    <span className="font-semibold text-slate-700">
                      ₹{selectedPack ? selectedPack.price.toFixed(2) : '0.00'}
                    </span>
                  </div>

                  {discount > 0 && (
                    <div className="flex justify-between items-center text-emerald-600 font-bold">
                      <span className="text-xs sm:text-sm">Coupon Discount</span>
                      <span>-₹{discount.toFixed(2)}</span>
                    </div>
                  )}
                  
                  {selectedPack && (
                    <div className="flex justify-between items-center text-xs text-[#94A3B8]">
                      <span>GST (18% Included)</span>
                      <span>₹{((Math.max(0, selectedPack.price - discount) * 0.18) / 1.18).toFixed(2)}</span>
                    </div>
                  )}

                  <div className="border-t border-slate-100 pt-3.5 flex justify-between items-baseline text-base font-bold text-[#0F172A]">
                    <span>Total Due</span>
                    <span className="text-2xl font-black text-[#0284C7]">
                      ₹{selectedPack ? Math.max(0, selectedPack.price - discount).toFixed(2) : '0.00'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Secure Recharge Checkout Button matching Wallet action */}
              <button
                type="button"
                onClick={handleCheckout}
                disabled={!selectedPack || purchasing}
                className={`w-full mt-6 py-3.5 px-4 rounded-xl text-sm font-bold transition-all flex flex-col items-center justify-center gap-0.5 select-none ${
                  selectedPack && !purchasing
                    ? 'bg-[#0284C7] hover:bg-[#0369A1] text-white shadow-md shadow-[#0284C7]/25 cursor-pointer active:scale-[0.98]'
                    : 'bg-[#E2E8F0] text-[#94A3B8] cursor-not-allowed shadow-none'
                }`}
              >
                <div className="flex items-center gap-2">
                  {purchasing ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <Sparkles className="w-4 h-4 text-cyan-200" />
                  )}
                  <span>{purchasing ? 'Processing Checkout...' : 'Secure Recharge Checkout'}</span>
                </div>
                <span className={`text-[10px] font-medium ${selectedPack && !purchasing ? 'text-white/80' : 'text-[#94A3B8]'}`}>
                  100% Encrypted & Protected Connection
                </span>
              </button>
            </div>

          </div>
        </div>

        {/* Mobile Sticky Checkout CTA Bar */}
        <div className="lg:hidden fixed bottom-[68px] left-0 right-0 bg-white border-t border-[#E2E8F0] px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] z-40 flex items-center justify-between gap-4">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Total Payable</span>
            <span className="text-xl font-black text-[#0284C7]">
              ₹{selectedPack ? Math.max(0, selectedPack.price - discount).toFixed(2) : '0.00'}
            </span>
            {selectedPack && (
              <span className="text-[10px] font-semibold text-[#64748B] truncate max-w-[130px]">{selectedPack.name}</span>
            )}
          </div>
          <button
            type="button"
            onClick={handleCheckout}
            disabled={!selectedPack || purchasing}
            className={`flex-1 py-3 px-5 rounded-xl text-xs font-bold transition-all text-center flex items-center justify-center gap-2 select-none ${
              selectedPack && !purchasing
                ? 'bg-[#0284C7] hover:bg-[#0369A1] text-white shadow-md shadow-[#0284C7]/25 cursor-pointer active:scale-95'
                : 'bg-[#E2E8F0] text-[#94A3B8] cursor-not-allowed shadow-none'
            }`}
          >
            {purchasing ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <CreditCard className="w-4 h-4" />
            )}
            <span>{purchasing ? 'Processing...' : 'Checkout Now'}</span>
          </button>
        </div>

      </div>
    </div>
  );
}
