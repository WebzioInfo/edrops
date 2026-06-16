
import { ShoppingBag, Minus, Plus, Trash2, CreditCard } from 'lucide-react';
import { useCart } from '../../../contexts/CartContext';
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchWithAuth } from '../../../api/client';
import { toast } from 'react-hot-toast';

export default function Cart() {
  const { items, returnEmptyJars, removeItem, updateQuantity } = useCart();
  const navigate = useNavigate();
  
  const [checkoutItems, setCheckoutItems] = useState(items);
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<any>(null);
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [isValidatingPromo, setIsValidatingPromo] = useState(false);
  const [promoError, setPromoError] = useState('');
  
  useEffect(() => {
    setCheckoutItems(items);
  }, [items]);

  useEffect(() => {
    const saved = localStorage.getItem('edrops_promo');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setPromoInput(parsed.code);
        setAppliedPromo(parsed);
      } catch (e) {}
    }
  }, []);
  
  const subTotal = useMemo(() => checkoutItems.reduce((sum, item) => sum + (item.price * item.quantity), 0), [checkoutItems]);
  const depositTotal = useMemo(() => returnEmptyJars ? 0 : checkoutItems.reduce((sum, item) => sum + (item.depositAmount * item.quantity), 0), [checkoutItems, returnEmptyJars]);
  const deliveryCharge = useMemo(() => checkoutItems.length > 0 ? (subTotal > 500 ? 0 : 50) : 0, [checkoutItems, subTotal]);

  useEffect(() => {
    if (appliedPromo) {
      setIsValidatingPromo(true);
      fetchWithAuth('/promo/validate', {
        method: 'POST',
        body: JSON.stringify({
          code: appliedPromo.code,
          orderAmount: subTotal,
          deliveryCharge
        })
      })
      .then((res) => {
        setPromoDiscount(res.calculatedDiscount);
        setPromoError('');
      })
      .catch((err) => {
        setAppliedPromo(null);
        setPromoDiscount(0);
        localStorage.removeItem('edrops_promo');
        setPromoError(err.message || 'Promo code is no longer valid');
      })
      .finally(() => {
        setIsValidatingPromo(false);
      });
    } else {
      setPromoDiscount(0);
    }
  }, [appliedPromo?.code, subTotal, deliveryCharge]);

  const grandTotal = Math.max(0, subTotal + depositTotal + deliveryCharge - promoDiscount);

  const updateLocalQuantity = (id: string, newQuantity: number) => {
    updateQuantity(id, newQuantity);
  };
  
  const removeLocalItem = (id: string) => {
    removeItem(id);
  };

  const [isProcessing, setIsProcessing] = useState(false);

  const handleApplyPromo = async () => {
    if (!promoInput.trim()) return;
    setIsValidatingPromo(true);
    setPromoError('');
    try {
      const res = await fetchWithAuth('/promo/validate', {
        method: 'POST',
        body: JSON.stringify({
          code: promoInput,
          orderAmount: subTotal,
          deliveryCharge
        })
      });
      setAppliedPromo(res);
      setPromoDiscount(res.calculatedDiscount);
      localStorage.setItem('edrops_promo', JSON.stringify(res));
      toast.success('Promo code applied successfully!');
    } catch (err: any) {
      setPromoError(err.message || 'Invalid promo code');
      toast.error(err.message || 'Invalid promo code');
    } finally {
      setIsValidatingPromo(false);
    }
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoDiscount(0);
    setPromoInput('');
    setPromoError('');
    localStorage.removeItem('edrops_promo');
    toast.success('Promo code removed');
  };

  const handleProceedToCheckout = () => {
    setIsProcessing(true);
    setTimeout(() => {
      navigate('/customer/checkout');
      setIsProcessing(false);
    }, 300);
  };

  if (checkoutItems.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center flex flex-col items-center">
        <div className="h-32 w-32 rounded-full bg-slate-50 flex items-center justify-center mb-6">
          <ShoppingBag className="h-12 w-12 text-slate-300" />
        </div>
        <h2 className="text-2xl font-black text-slate-800">Your cart is empty</h2>
        <p className="mt-2 text-slate-500 font-semibold mb-8">Looks like you haven't added any products yet.</p>
        <a href="/customer/shop" className="px-8 py-4 rounded-full bg-[#2D79A8] text-white font-black shadow-lg hover:bg-opacity-90 transition-all active:scale-95">
          Browse Products
        </a>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      <div className="flex items-center gap-3 mb-8">
        <h1 className="text-3xl font-black text-slate-800">Your Cart</h1>
        <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-sm font-black">{checkoutItems.length} items</span>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Cart & Settings */}
        <div className="lg:col-span-2 space-y-6">
          
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2"><ShoppingBag className="w-5 h-5 text-[#2D79A8]" /> Cart Items</h2>
            <div className="space-y-4">
              {checkoutItems.map((item) => (
                <div key={item.id} className="flex items-center gap-4 p-4 rounded-2xl border border-slate-100 bg-slate-50/50">
                  <div className="w-24 h-24 bg-slate-100 rounded-xl overflow-hidden flex-shrink-0 shadow-sm border border-slate-100">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} className="object-cover w-full h-full" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ShoppingBag className="w-8 h-8 text-slate-300" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-slate-800 truncate">{item.name}</p>
                    <p className="text-xs font-bold text-slate-400 mb-1">{item.brandName || 'Edrops Partner'}</p>
                    <p className="text-sm font-bold text-slate-500 mb-2">₹{item.price}</p>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center bg-white border border-slate-200 rounded-full overflow-hidden shadow-sm">
                        <button 
                          onClick={() => updateLocalQuantity(item.id, item.quantity - 1)}
                          className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-8 text-center text-sm font-black text-slate-800">{item.quantity}</span>
                        <button 
                          onClick={() => updateLocalQuantity(item.id, item.quantity + 1)}
                          className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <button 
                        onClick={() => removeLocalItem(item.id)}
                        className="text-slate-400 hover:text-rose-500 p-2 rounded-full hover:bg-rose-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="text-right flex flex-col justify-between items-end h-full">
                    <p className="font-black text-lg text-[#2D79A8]">₹{item.price * item.quantity}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
        </div>

        {/* Order Summary Checkout Card */}
        <div className="lg:col-span-1">
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50 sticky top-24">
            <h3 className="text-xl font-black text-slate-800 mb-6">Cart Summary</h3>
            
            <div className="space-y-4 text-sm font-semibold text-slate-600 border-b border-slate-100 pb-6 mb-6">
              <div className="flex justify-between">
                <span>Products Total ({checkoutItems.length} items)</span>
                <span className="font-black text-slate-800">₹{subTotal}</span>
              </div>
              
              {depositTotal > 0 && (
                <div className="flex justify-between items-center text-rose-600">
                  <div className="flex items-center gap-1">
                    <span>Security Deposit</span>
                  </div>
                  <span className="font-black">₹{depositTotal}</span>
                </div>
              )}

              {depositTotal === 0 && checkoutItems.some(i => i.isJar) && (
                <div className="flex justify-between items-center text-emerald-600 text-xs">
                  <span>Deposit Waived (Returning Jars)</span>
                </div>
              )}
              
              <div className="flex justify-between">
                <span>Delivery Charge</span>
                <span className="font-black">{deliveryCharge === 0 ? <span className="text-emerald-600">FREE</span> : `₹${deliveryCharge}`}</span>
              </div>

              {promoDiscount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Discount ({appliedPromo?.code})</span>
                  <span className="font-black">-₹{promoDiscount}</span>
                </div>
              )}
            </div>

            {/* Promo Code Section */}
            <div className="border-t border-slate-100 pt-6 mb-6">
              <label className="block text-sm font-black text-slate-800 mb-2">Have a Promo Code?</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter code (e.g. SAVE10)"
                  value={promoInput}
                  onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                  disabled={!!appliedPromo}
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-full text-sm font-bold focus:outline-none focus:border-[#2D79A8] uppercase disabled:bg-slate-50 disabled:text-slate-400"
                />
                {appliedPromo ? (
                  <button
                    onClick={handleRemovePromo}
                    className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs rounded-full transition-colors active:scale-95 cursor-pointer"
                  >
                    Remove
                  </button>
                ) : (
                  <button
                    onClick={handleApplyPromo}
                    disabled={!promoInput.trim() || isValidatingPromo}
                    className="px-5 py-2 bg-[#2D79A8] hover:bg-opacity-90 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold text-xs rounded-full transition-colors active:scale-95 cursor-pointer"
                  >
                    {isValidatingPromo ? '...' : 'Apply'}
                  </button>
                )}
              </div>
              {promoError && <p className="text-xs text-rose-500 font-semibold mt-1.5 ml-2">{promoError}</p>}
              {appliedPromo && (
                <div className="mt-2.5 p-3 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center justify-between text-emerald-800">
                  <div className="flex flex-col">
                    <span className="text-xs font-black">{appliedPromo.code} Applied!</span>
                    <span className="text-[10px] font-semibold text-emerald-600/95">{appliedPromo.description}</span>
                  </div>
                  <span className="text-sm font-black">-₹{promoDiscount}</span>
                </div>
              )}
            </div>
            
            <div className="flex justify-between items-end mb-8">
              <span className="text-slate-500 font-bold">Total Amount</span>
              <span className="text-4xl font-black text-[#2D79A8]">₹{grandTotal}</span>
            </div>
            
            <button
              onClick={handleProceedToCheckout}
              disabled={isProcessing}
              className="w-full py-4 rounded-full bg-[#245361] text-white font-black shadow-lg hover:shadow-[#245361]/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <CreditCard className="w-5 h-5" />
                  Proceed to Checkout
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
