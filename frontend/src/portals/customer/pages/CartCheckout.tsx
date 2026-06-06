import { motion } from 'framer-motion';
import { ShoppingBag, Minus, Plus, Trash2, ShieldCheck, CreditCard } from 'lucide-react';
import { useCart } from '../../../contexts/CartContext';
import { fetchWithAuth } from '../../../api/client';
import { toast } from 'react-hot-toast';
import { useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';

export default function CartCheckout() {
  const { items, updateQuantity, removeItem, clearCart, subTotal, depositTotal, grandTotal } = useCart();
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);

  const loadRazorpay = () => {
    return new Promise<boolean>((resolve) => {
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
    if (items.length === 0) return;
    setIsProcessing(true);

    try {
      // 1. Sync cart to backend
      await fetchWithAuth('/cart/sync', {
        method: 'POST',
        body: JSON.stringify({ items: items.map(i => ({ productId: i.id, quantity: i.quantity })) })
      });

      // 2. Initialize checkout
      const checkout = await fetchWithAuth('/checkout/initialize', { method: 'POST' });

      const isLoaded = await loadRazorpay();
      if (!isLoaded) {
        throw new Error('Razorpay SDK failed to load. Please check your connection.');
      }

      // 3. Open Razorpay (assuming Razorpay is loaded via script tag in index.html)
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: checkout.amount * 100,
        currency: checkout.currency,
        name: 'Edrops Marketplace',
        description: 'Order Payment',
        order_id: checkout.razorpayOrderId,
        prefill: {
          name: user?.firstName + ' ' + user?.lastName,
          email: user?.email,
          contact: user?.phone,
        },
        handler: async function (response: any) {
          await fetchWithAuth('/payment/verify', {
            method: 'POST',
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });
          toast.success('Payment successful! Your order is confirmed.');
          clearCart();
        },
        theme: { color: '#2D79A8' }
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', function () {
        toast.error('Payment failed. Please try again.');
      });
      rzp.open();

    } catch (err: any) {
      toast.error(err.message || 'Checkout failed');
    } finally {
      setIsProcessing(false);
    }
  };

  if (items.length === 0) {
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
        <h1 className="text-3xl font-black text-slate-800">Shopping Cart</h1>
        <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-sm font-black">{items.length} items</span>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Cart Items List */}
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => (
            <motion.div 
              layout 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={item.id} 
              className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col sm:flex-row gap-4 items-center"
            >
              <div className="h-24 w-24 rounded-2xl bg-slate-50 flex-shrink-0 p-2 relative">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.name} className="w-full h-full object-contain mix-blend-multiply" />
                ) : (
                  <ShoppingBag className="w-full h-full text-slate-200 p-4" />
                )}
              </div>
              
              <div className="flex-1 text-center sm:text-left w-full">
                <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1">{item.brandName}</p>
                <h3 className="text-lg font-black text-slate-800 leading-tight">{item.name}</h3>
                
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 mt-3">
                  <div className="flex items-center bg-slate-100 rounded-full p-1">
                    <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="w-8 h-8 rounded-full flex items-center justify-center text-slate-600 hover:bg-white hover:shadow-sm transition-all">
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-10 text-center font-black text-sm">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-8 h-8 rounded-full flex items-center justify-center text-slate-600 hover:bg-white hover:shadow-sm transition-all">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <button onClick={() => removeItem(item.id)} className="text-rose-500 hover:text-rose-600 p-2">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="text-center sm:text-right flex flex-col justify-center items-center sm:items-end min-w-[120px]">
                <p className="text-2xl font-black text-[#2D79A8]">₹{item.price * item.quantity}</p>
                {item.isJar && (
                  <p className="text-[11px] font-bold text-slate-400 mt-1 flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-full">
                    <ShieldCheck className="w-3 h-3 text-rose-400" />
                    +₹{item.depositAmount * item.quantity} Dep.
                  </p>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Order Summary Checkout Card */}
        <div className="lg:col-span-1">
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50 sticky top-24">
            <h3 className="text-xl font-black text-slate-800 mb-6">Order Summary</h3>
            
            <div className="space-y-4 text-sm font-semibold text-slate-600 border-b border-slate-100 pb-6 mb-6">
              <div className="flex justify-between">
                <span>Subtotal ({items.length} items)</span>
                <span className="font-black text-slate-800">₹{subTotal}</span>
              </div>
              
              {depositTotal > 0 && (
                <div className="flex justify-between items-center text-rose-600">
                  <div className="flex items-center gap-1">
                    <span>Security Deposit (Refundable)</span>
                  </div>
                  <span className="font-black">₹{depositTotal}</span>
                </div>
              )}
              
              <div className="flex justify-between text-emerald-600">
                <span>Delivery Charge</span>
                <span className="font-black">FREE</span>
              </div>
            </div>
            
            <div className="flex justify-between items-end mb-8">
              <span className="text-slate-500 font-bold">Total Amount</span>
              <span className="text-4xl font-black text-[#2D79A8]">₹{grandTotal}</span>
            </div>
            
            <button
              onClick={handleCheckout}
              disabled={isProcessing}
              className="w-full py-4 rounded-full bg-[#245361] text-white font-black shadow-lg hover:shadow-[#245361]/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <CreditCard className="w-5 h-5" />
                  Proceed to Pay
                </>
              )}
            </button>
            <p className="text-center text-xs font-semibold text-slate-400 mt-4 flex items-center justify-center gap-1">
              <ShieldCheck className="w-4 h-4" /> Secure Razorpay Checkout
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
