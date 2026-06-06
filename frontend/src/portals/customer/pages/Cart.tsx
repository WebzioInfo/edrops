import { motion } from 'framer-motion';
import { ShoppingBag, Minus, Plus, Trash2, ShieldCheck, CreditCard, MapPin, Clock, Wallet as WalletIcon, RefreshCw } from 'lucide-react';
import { useCart } from '../../../contexts/CartContext';
import { fetchWithAuth } from '../../../api/client';
import { toast } from 'react-hot-toast';
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';

export default function Cart() {
  const { items, returnEmptyJars, setReturnEmptyJars } = useCart();
  const navigate = useNavigate();
  
  const [checkoutItems, setCheckoutItems] = useState(items);
  
  useEffect(() => {
    setCheckoutItems(items);
  }, [items]);
  
  const subTotal = useMemo(() => checkoutItems.reduce((sum, item) => sum + (item.price * item.quantity), 0), [checkoutItems]);
  const depositTotal = useMemo(() => returnEmptyJars ? 0 : checkoutItems.reduce((sum, item) => sum + (item.depositAmount * item.quantity), 0), [checkoutItems, returnEmptyJars]);
  const deliveryCharge = useMemo(() => checkoutItems.length > 0 ? (subTotal > 500 ? 0 : 50) : 0, [checkoutItems, subTotal]);
  const grandTotal = subTotal + depositTotal + deliveryCharge;

  const updateLocalQuantity = (id: string, newQuantity: number) => {
    if (newQuantity < 1) {
      setCheckoutItems(prev => prev.filter(i => i.id !== id));
      return;
    }
    setCheckoutItems(prev => prev.map(i => i.id === id ? { ...i, quantity: newQuantity } : i));
  };
  
  const removeLocalItem = (id: string) => {
    setCheckoutItems(prev => prev.filter(i => i.id !== id));
  };

  const [isProcessing, setIsProcessing] = useState(false);

  const handleProceedToCheckout = () => {
    setIsProcessing(true);
    // Any final validations before heading to checkout could go here
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
