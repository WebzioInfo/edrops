import { useState, useEffect } from 'react';
import { CreditCard, Tag, Sparkles, ShoppingCart, Droplet, Check } from 'lucide-react';
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
          color: '#0F6E8C'
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

  if (loading) {
    return <LoadingSpinner fullPage label="Loading recharge plans..." />;
  }

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 lg:px-8 bg-[#F8FAFC] text-[#0F172A] pb-32 lg:pb-8">
      
      {/* Page Header */}
      <div className="space-y-2 mb-8">
        <h1 className="text-3xl font-black tracking-tight text-[#0F172A] sm:text-4xl">Recharge Water</h1>
        <p className="text-sm font-semibold text-slate-500">Buy water jar packs and enjoy exclusive discounted rates</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-12 items-start">

        {/* LEFT COLUMN: Pricing Packages Grid */}
        <div className="lg:col-span-8 space-y-4">
          <h2 className="text-lg font-black text-[#0F172A] tracking-tight">Choose a Pack</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {packs.map((pack) => {
              const isSelected = selectedPack?.id === pack.id;
              const savings = (pack.originalPrice || (pack.price * 1.25)) - pack.price;
              
              return (
                <button
                  key={pack.id}
                  onClick={() => setSelectedPack(pack)}
                  className={`relative text-left rounded-2xl p-5 border transition-all duration-300 flex flex-col justify-between min-h-[180px] cursor-pointer bg-white ${
                    isSelected
                      ? 'border-[#0F6E8C] shadow-[0_12px_40px_rgba(15,110,140,0.08)] ring-1 ring-[#0F6E8C]'
                      : 'border-slate-100 hover:border-slate-200 hover:-translate-y-1 shadow-[0_8px_30px_rgb(0,0,0,0.015)]'
                  }`}
                >
                  {/* Badge */}
                  {pack.packageBadge && (
                    <span className="absolute top-4 right-4 text-[9px] font-black uppercase tracking-wider bg-orange-500 text-white px-2.5 py-0.5 rounded-full">
                      {pack.packageBadge}
                    </span>
                  )}

                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="p-2 rounded-xl bg-[#0F6E8C]/10 text-[#0F6E8C]">
                        <Droplet className="w-5 h-5" />
                      </span>
                      <span className="text-xs font-black uppercase tracking-widest text-[#0F6E8C]">{pack.jarCount} Jars Pack</span>
                    </div>
                    <h3 className="text-lg font-black text-[#0F172A]">{pack.name}</h3>
                    {pack.offerLabel && (
                      <p className="text-xs text-emerald-600 font-bold mt-1">{pack.offerLabel}</p>
                    )}

                    {/* Features checklist inside the card */}
                    <div className="mt-4 space-y-1">
                      <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-500" /> Priority doorstep delivery
                      </span>
                      <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-500" /> Flexible delivery dates
                      </span>
                    </div>
                  </div>

                  <div className="mt-6 flex items-end justify-between w-full border-t border-slate-50 pt-4">
                    <div>
                      {pack.originalPrice && pack.originalPrice > pack.price && (
                        <span className="text-xs text-slate-350 line-through font-bold block">₹{pack.originalPrice}</span>
                      )}
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-2xl font-black text-[#0F172A]">₹{pack.price}</span>
                        {savings > 0 && (
                          <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                            Save ₹{Math.round(savings)}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all ${
                      isSelected ? 'border-[#0F6E8C] bg-[#0F6E8C] text-white' : 'border-slate-200'
                    }`}>
                      {isSelected && <span className="h-2 w-2 rounded-full bg-white" />}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: Summary & Coupon Sidebar */}
        <div className="lg:col-span-4 lg:sticky lg:top-24 space-y-6">

          {/* Promo Code Card */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-[0_8px_30px_rgb(0,0,0,0.01)]">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Tag className="h-4 w-4 text-[#0F6E8C]" /> Have a Coupon?
            </h4>
            <form onSubmit={appliedPromo ? (e) => { e.preventDefault(); handleRemovePromo(); } : handleApplyPromo} className="flex gap-2">
              <input
                type="text"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                placeholder="Enter promo code"
                disabled={!!appliedPromo}
                className="flex-1 px-4 py-2 text-sm font-bold border border-slate-200 rounded-xl focus:outline-none focus:border-[#0F6E8C] uppercase disabled:bg-slate-50 disabled:text-slate-400 text-[#0F172A]"
              />
              <button
                type="submit"
                disabled={applying || (!appliedPromo && !promoCode.trim())}
                className={`px-4 rounded-xl text-xs font-black transition cursor-pointer select-none active:scale-95 ${
                  appliedPromo 
                    ? 'bg-rose-505 hover:bg-rose-600 text-white bg-rose-500' 
                    : 'bg-[#0F6E8C] hover:bg-opacity-95 text-white disabled:bg-slate-100 disabled:text-slate-400'
                }`}
              >
                {applying ? '...' : appliedPromo ? 'Remove' : 'Apply'}
              </button>
            </form>
            {promoError && <p className="text-xs text-rose-500 font-bold mt-2 ml-1">{promoError}</p>}
            {appliedPromo && (
              <p className="text-xs font-bold text-emerald-600 mt-2 flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Code "{appliedPromo}" successfully applied!
              </p>
            )}
          </div>

          {/* Checkout Summary Card */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-[0_20px_50px_rgba(15,110,140,0.03)] flex flex-col justify-between min-h-[260px]">
            <div>
              <h3 className="text-lg font-black text-[#0F172A] border-b border-slate-50 pb-3 flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-[#0F6E8C]" /> Summary
              </h3>

              <div className="mt-4 space-y-3.5 text-sm font-semibold text-slate-500">
                <div className="flex justify-between text-slate-800">
                  <span>Selected Pack</span>
                  <span className="font-black text-[#0F172A]">
                    {selectedPack ? `${selectedPack.name} (${selectedPack.jarCount} Jars)` : 'None'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-bold text-slate-700">
                    ₹{selectedPack ? selectedPack.price.toFixed(2) : '0.00'}
                  </span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-bold">
                    <span>Discount</span>
                    <span>-₹{discount.toFixed(2)}</span>
                  </div>
                )}
                
                {/* GST (18% Included) for Premium Billing look */}
                {selectedPack && (
                  <div className="flex justify-between text-xs text-slate-400 font-medium">
                    <span>GST (18% Included)</span>
                    <span>₹{((Math.max(0, selectedPack.price - discount) * 0.18) / 1.18).toFixed(2)}</span>
                  </div>
                )}

                <div className="border-t border-slate-100 pt-3 flex justify-between text-base font-black text-[#0F172A]">
                  <span>Total Due</span>
                  <span className="text-xl text-[#0F6E8C]">
                    ₹{selectedPack ? Math.max(0, selectedPack.price - discount).toFixed(2) : '0.00'}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={handleCheckout}
              disabled={!selectedPack || purchasing}
              className="w-full mt-8 py-4 rounded-xl bg-gradient-to-r from-[#0F6E8C] to-[#0A566E] hover:from-[#0F6E8C]/95 hover:to-[#0A566E]/95 text-sm font-black text-white shadow-lg shadow-[#0F6E8C]/15 disabled:opacity-50 disabled:pointer-events-none hover:-translate-y-0.5 active:scale-95 transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer"
            >
              <span>{purchasing ? 'Processing...' : 'Secure Recharge Checkout'}</span>
              <span className="text-[10px] font-medium text-white/80">Secure SSL Payment Connection</span>
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Sticky Checkout CTA */}
      <div className="lg:hidden fixed bottom-[68px] left-0 right-0 bg-white border-t border-slate-100 px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-40 flex items-center justify-between gap-4">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Payable</span>
          <span className="text-xl font-black text-[#0F6E8C]">
            ₹{selectedPack ? Math.max(0, selectedPack.price - discount).toFixed(2) : '0.00'}
          </span>
          {selectedPack && (
            <span className="text-[10px] font-bold text-slate-500 truncate max-w-[120px]">{selectedPack.name}</span>
          )}
        </div>
        <button
          onClick={handleCheckout}
          disabled={!selectedPack || purchasing}
          className="flex-1 py-3 px-5 rounded-xl bg-gradient-to-r from-[#0F6E8C] to-[#0A566E] hover:from-[#0F6E8C]/95 hover:to-[#0A566E]/95 text-xs font-black text-white shadow-md disabled:opacity-50 disabled:pointer-events-none active:scale-95 transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <CreditCard className="w-4 h-4" />
          <span>{purchasing ? 'Processing...' : 'Checkout Now'}</span>
        </button>
      </div>

    </div>
  );
}
