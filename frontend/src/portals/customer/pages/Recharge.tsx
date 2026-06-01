import { useState, useEffect } from 'react';
import { CreditCard, Tag, Sparkles, ShoppingCart, Loader } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { fetchWithAuth } from '../../../api/client';

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
    try {
      const res = await fetchWithAuth('/promo/validate', {
        method: 'POST',
        body: JSON.stringify({ code: promoCode }),
      });
      setAppliedPromo(promoCode);
      setDiscount(res.discountValue || 0);
      toast.success(`Coupon "${promoCode}" applied!`);
    } catch {
      setAppliedPromo(null);
      setDiscount(0);
      toast.error('Invalid coupon code');
    } finally {
      setApplying(false);
    }
  };

  const loadRazorpay = () => {
    return new Promise((resolve) => {
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
        amount: orderData.amount,
        currency: 'INR',
        name: 'Edrops',
        description: `Recharge: ${selectedPack.name}`,
        order_id: orderData.orderId,
        handler: async function (response: any) {
          try {
            await fetchWithAuth('/payment/verify', {
              method: 'POST',
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              })
            });
            toast.success('Payment verified successfully!');
            setSelectedPack(null);
            setPromoCode('');
            setAppliedPromo(null);
            setDiscount(0);
          } catch (err: any) {
            toast.error('Payment verification failed.');
          }
        },
        theme: {
          color: '#2D79A8'
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
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader className="h-10 w-10 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8 space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-[#245361]">Recharge Water</h1>
        <p className="text-sm font-semibold text-[#245361]/80 mt-1">Buy water jar packs and enjoy exclusive discounted rates</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">

        {/* Left: Packs Listing */}
        <div className="space-y-4">
          <h3 className="text-lg font-black text-[#245361]">Choose a Pack</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {packs.map((pack) => (
              <button
                key={pack.id}
                onClick={() => setSelectedPack(pack)}
                className={`text-left rounded-2xl p-5 border transition flex flex-col justify-between min-h-[150px] relative ${
                  selectedPack?.id === pack.id
                    ? 'border-[#2D79A8] bg-[#BBDFF2]/10 shadow-md'
                    : 'border-border/60 bg-white hover:border-[#2D79A8]/50'
                }`}
              >
                {pack.packageBadge && (
                  <span className="absolute -top-3 right-4 text-[9px] font-black uppercase tracking-widest bg-orange-500 text-white px-2.5 py-0.5 rounded-full">
                    {pack.packageBadge}
                  </span>
                )}
                <div>
                  <h4 className="text-base font-black text-[#245361]">{pack.name}</h4>
                  <p className="text-xs font-bold text-slate-700 uppercase mt-0.5">{pack.jarCount} Jars</p>
                  
                  {pack.originalPrice && pack.originalPrice > pack.price && (
                    <p className="text-xs text-slate-400 line-through mt-1">₹{pack.originalPrice}</p>
                  )}
                  {pack.offerLabel && (
                    <p className="text-xs text-emerald-600 font-semibold mt-1">{pack.offerLabel}</p>
                  )}
                </div>
                <div className="mt-4 flex items-center justify-between w-full">
                  <span className="text-xl font-black text-[#245361]">₹{pack.price}</span>
                  <span className={`h-6 w-6 rounded-full border-2 flex items-center justify-center ${
                    selectedPack?.id === pack.id ? 'border-[#2D79A8] bg-[#2D79A8] text-white' : 'border-border'
                  }`}>
                    {selectedPack?.id === pack.id && <span className="h-2.5 w-2.5 rounded-full bg-white" />}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right: Cart Summary / Coupon Validation */}
        <div className="space-y-6">

          {/* Promo Code Form */}
          <div className="clay-card p-5">
            <h4 className="text-sm font-black text-[#245361] flex items-center gap-2 mb-3">
              <Tag className="h-4 w-4 text-[#2D79A8]" />
              Promo Code
            </h4>
            <form onSubmit={handleApplyPromo} className="flex gap-2">
              <input
                type="text"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                placeholder="Enter promo code"
                className="clay-input flex-1 text-sm py-2 px-3 bg-[#BBDFF2]/10"
              />
              <button
                type="submit"
                disabled={applying}
                className="bg-primary text-primary-foreground font-black text-xs px-4 rounded-xl hover:bg-primary/90 transition"
              >
                Apply
              </button>
            </form>
            {appliedPromo && (
              <p className="text-xs font-bold text-emerald-600 mt-2 flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Code "{appliedPromo}" successfully applied!
              </p>
            )}
          </div>

          {/* Checkout Summary Card */}
          <div className="clay-card p-6 flex flex-col justify-between min-h-[260px]">
            <div>
              <h3 className="text-lg font-black text-[#245361] border-b border-border pb-3 flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-[#2D79A8]" />
                Summary
              </h3>

              <div className="mt-4 space-y-2.5 text-sm font-semibold">
                <div className="flex justify-between text-slate-800">
                  <span>Selected Pack</span>
                  <span className="font-bold text-[#245361]">
                    {selectedPack ? `${selectedPack.name} (${selectedPack.jarCount} Jars)` : 'None'}
                  </span>
                </div>
                <div className="flex justify-between text-slate-800">
                  <span>Subtotal</span>
                  <span className="font-bold text-[#245361]">₹{selectedPack ? selectedPack.price.toFixed(2) : '0.00'}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Discount</span>
                    <span>-₹{discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="border-t border-border/80 pt-2.5 flex justify-between text-base font-black text-[#245361]">
                  <span>Total Due</span>
                  <span>
                    ₹{selectedPack ? Math.max(0, selectedPack.price - discount).toFixed(2) : '0.00'}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={handleCheckout}
              disabled={!selectedPack || purchasing}
              className="w-full mt-6 py-4 rounded-full sun-gradient text-sm font-black text-white shadow-lg disabled:opacity-50 disabled:pointer-events-none hover:shadow-orange-300/20 transition flex items-center justify-center gap-2"
            >
              <CreditCard className="h-4 w-4" /> {purchasing ? 'Processing...' : 'Secure Recharge Checkout'}
            </button>
          </div>

        </div>
      </div>

    </div>
  );
}
