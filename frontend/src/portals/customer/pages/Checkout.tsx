import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, Plus, Trash2, ShieldCheck, CheckCircle2, Minus } from 'lucide-react';
import { useCart } from '../../../contexts/CartContext';
import { fetchWithAuth } from '../../../api/client';
import { toast } from 'react-hot-toast';
import { injectMockRazorpay } from '../../../utils/MockRazorpay';
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useSearchParams, useNavigate } from 'react-router-dom';
import AddressModal from '../components/AddressModal';

interface Address {
  id: string;
  label: string;
  street: string;
  city: string;
  zipCode: string;
  isDefault?: boolean;
}

interface TimeSlot {
  id: string;
  label: string;
}

export default function Checkout() {
  const { items, clearCart } = useCart();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const isBuyNow = searchParams.get('buyNow') === 'true';
  const buyNowProduct = isBuyNow ? [{
    id: searchParams.get('productId') || '',
    name: searchParams.get('name') || '',
    price: Number(searchParams.get('price')) || 0,
    quantity: Number(searchParams.get('quantity')) || 1,
    imageUrl: searchParams.get('imageUrl') || undefined,
    brandName: searchParams.get('brandName') || undefined,
    isJar: false,
    depositAmount: 0
  }] : [];

  const [checkoutItems, setCheckoutItems] = useState(isBuyNow ? buyNowProduct : items);
  const [currentStep, setCurrentStep] = useState(1);
  
  useEffect(() => {
    if (!isBuyNow) {
      // Only set if lengths mismatch to avoid overwriting local adjustments immediately
      // Actually, since we sync at the end, we can initialize from cart and then rely on local state.
      if (items.length > 0 && checkoutItems.length === 0) {
        setCheckoutItems(items);
      }
    }
  }, [items, isBuyNow]);

  const updateCheckoutQuantity = (id: string, newQuantity: number) => {
    if (newQuantity < 1) {
      setCheckoutItems(prev => prev.filter(i => i.id !== id));
      return;
    }
    setCheckoutItems(prev => prev.map(i => i.id === id ? { ...i, quantity: newQuantity } : i));
  };
  
  const removeCheckoutItem = (id: string) => {
    setCheckoutItems(prev => prev.filter(i => i.id !== id));
  };
  
  const [jarOwnerships, setJarOwnerships] = useState<any[]>([]);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [returnedJarsState, setReturnedJarsState] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchWithAuth('/auth/me').then(data => {
      if (data.customer?.jarOwnerships) {
        setJarOwnerships(data.customer.jarOwnerships);
      }
      if (data.customer?.wallet) {
        setWalletBalance(data.customer.wallet.balance);
      }
    }).catch(() => {});
  }, []);

  const updateReturnedJars = (brandId: string, delta: number) => {
    setReturnedJarsState(prev => {
      const current = prev[brandId] || 0;
      const ownership = jarOwnerships.find(j => j.brandId === brandId);
      const maxOwned = ownership ? (ownership.ownedJars + ownership.companyJarsHeld) : 0;
      
      let next = current + delta;
      if (next < 0) next = 0;
      if (next > maxOwned) next = maxOwned;
      
      return { ...prev, [brandId]: next };
    });
  };

  const returnedJarsArray = useMemo(() => {
    return Object.entries(returnedJarsState)
      .filter(([_, qty]) => qty > 0)
      .map(([brandId, quantity]) => ({ brandId, quantity }));
  }, [returnedJarsState]);

  const subTotal = useMemo(() => checkoutItems.reduce((sum, item) => sum + (item.price * item.quantity), 0), [checkoutItems]);
  
  // Calculate dynamic deposit based on net new jars per brand
  const depositTotal = useMemo(() => {
    let total = 0;
    const purchasedJarsByBrand: Record<string, { quantity: number; depositAmount: number }> = {};
    
    checkoutItems.forEach(item => {
      if (item.isJar && item.brandId) {
        if (!purchasedJarsByBrand[item.brandId]) {
          purchasedJarsByBrand[item.brandId] = { quantity: 0, depositAmount: item.depositAmount || 0 };
        }
        purchasedJarsByBrand[item.brandId].quantity += item.quantity;
      }
    });

    for (const [brandId, purchased] of Object.entries(purchasedJarsByBrand)) {
      const returnedQty = returnedJarsState[brandId] || 0;
      const netNewJars = purchased.quantity - returnedQty;
      if (netNewJars > 0) {
        // We do a simplified UI calculation assuming no previous deposit limit here
        // The real strict calculation happens on backend. This is just for UI estimate.
        // Wait, if they are acquiring net new jars, we charge deposit for the net new jars.
        total += netNewJars * purchased.depositAmount;
      }
    }
    return total;
  }, [checkoutItems, returnedJarsState]);

  const deliveryCharge = useMemo(() => checkoutItems.length > 0 ? (subTotal > 500 ? 0 : 50) : 0, [checkoutItems, subTotal]);

  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<any>(null);
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [isValidatingPromo, setIsValidatingPromo] = useState(false);
  const [promoError, setPromoError] = useState('');

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

  const baseTotal = Math.max(0, subTotal + depositTotal + deliveryCharge - promoDiscount);
  
  const walletDeduction = useMemo(() => {
    if (paymentMethod === 'WALLET') return Math.min(walletBalance, baseTotal);
    if (paymentMethod === 'HYBRID') return Math.min(walletBalance, baseTotal);
    return 0;
  }, [paymentMethod, walletBalance, baseTotal]);

  const grandTotal = Math.max(0, baseTotal - walletDeduction);

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

  const [isProcessing, setIsProcessing] = useState(false);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('ONLINE');

  const loadAddresses = () => {
    fetchWithAuth('/address').then((data) => {
      setAddresses(data);
      if (data.length > 0 && !selectedAddressId) setSelectedAddressId(data[0].id);
    }).catch(() => {});
  };

  useEffect(() => {
    loadAddresses();
    fetchWithAuth('/checkout/slots').then((data) => {
      setSlots(data);
      if (data.length > 0) setSelectedSlot(data[0].id);
    }).catch(() => {});
  }, []);

  const handleDeleteAddress = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await fetchWithAuth(`/address/${id}`, { method: 'DELETE' });
      toast.success('Address deleted');
      if (selectedAddressId === id) setSelectedAddressId('');
      loadAddresses();
    } catch (err) {
      toast.error('Failed to delete address');
    }
  };

  const loadRazorpay = () => {
    return new Promise((resolve) => {
      if (injectMockRazorpay()) {
        return resolve(true);
      }

      if ((window as any).Razorpay) return resolve(true);
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleCheckout = async () => {
    if (checkoutItems.length === 0) return;
    if (!selectedAddressId) {
      toast.error('Please add a delivery address first');
      setCurrentStep(2);
      return;
    }
    setIsProcessing(true);

    try {
      if (!isBuyNow) {
        await fetchWithAuth('/cart/sync', {
          method: 'POST',
          body: JSON.stringify({ items: checkoutItems.map(i => ({ productId: i.id, quantity: i.quantity })) })
        });
      }

      const initiatePayload: any = {
        addressId: selectedAddressId,
        paymentMethod: paymentMethod === 'ONLINE' ? 'RAZORPAY' : paymentMethod,
        timeSlot: selectedSlot,
        returnedJars: returnedJarsArray,
        promoCode: appliedPromo?.code || undefined
      };

      if (isBuyNow) {
        initiatePayload.buyNowItems = checkoutItems.map(i => ({ productId: i.id, quantity: i.quantity }));
      }

      const initiateRes = await fetchWithAuth('/checkout/initiate', { 
        method: 'POST',
        body: JSON.stringify(initiatePayload)
      });

      if (initiateRes.status === 'SUCCESS') {
        toast.success('Order placed successfully!');
        if (!isBuyNow) clearCart();
        localStorage.removeItem('edrops_promo');
        window.location.href = `/customer/order-success?id=${initiateRes.orderId}`;
        return;
      }

      if (initiateRes.razorpayOrderId) {
        const isLoaded = await loadRazorpay();
        if (!isLoaded) throw new Error('Razorpay SDK failed to load.');

        const options = {
          key: import.meta.env.VITE_RAZORPAY_KEY_ID || 'mock',
          amount: initiateRes.amount * 100,
          currency: initiateRes.currency,
          name: 'Edrops Marketplace',
          description: 'Order Payment',
          order_id: initiateRes.razorpayOrderId,
          prefill: {
            name: user?.firstName + ' ' + user?.lastName,
            email: user?.email,
            contact: user?.phone,
          },
          handler: async function (response: any) {
            await fetchWithAuth('/checkout/confirm', {
              method: 'POST',
              body: JSON.stringify({
                orderId: initiateRes.orderId,
                paymentMethod: paymentMethod === 'ONLINE' ? 'RAZORPAY' : paymentMethod,
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              }),
            });
            toast.success('Payment successful! Your order is confirmed.');
            if (!isBuyNow) clearCart();
            localStorage.removeItem('edrops_promo');
            window.location.href = `/customer/order-success?id=${initiateRes.orderId}`;
          },
          theme: { color: '#1E88E5' }
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.on('payment.failed', () => toast.error('Payment failed. Please try again.'));
        rzp.open();
      }
    } catch (err: any) {
      toast.error(err.message || 'Checkout failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleNextStep = () => {
    if (currentStep === 1 && checkoutItems.length === 0) return toast.error('Your cart is empty');
    if (currentStep === 2 && !selectedAddressId) return toast.error('Please select a delivery address');
    if (currentStep === 2 && !selectedSlot) return toast.error('Please select a delivery slot');
    setCurrentStep(prev => prev + 1);
  };

  if (checkoutItems.length === 0 && currentStep === 1) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center flex flex-col items-center bg-[#F8FAFC] min-h-screen">
        <div className="h-24 w-24 rounded-full bg-white border border-[#E2E8F0] shadow-sm flex items-center justify-center mb-4">
          <ShoppingBag className="h-10 w-10 text-[#64748B]" />
        </div>
        <h2 className="text-[24px] font-bold text-[#0F172A]">Your cart is empty</h2>
        <p className="mt-2 text-[#64748B] font-medium mb-8 text-[14px]">Looks like you haven't added any products yet.</p>
        <a href="/customer/shop" className="px-8 py-3.5 rounded-full bg-[#1E88E5] text-white font-semibold shadow-sm hover:bg-[#1565C0] transition-all text-[14px]">
          Browse Products
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] pb-[140px] md:pb-12">
      <div className="mx-auto max-w-[1280px] px-4 md:px-8 py-4 md:py-8">
        
        {/* Desktop Progress Header */}
        <div className="hidden md:flex items-center justify-center gap-4 mb-8 text-[14px] font-semibold">
          <span className={`flex items-center gap-1.5 ${currentStep >= 1 ? 'text-[#1E88E5]' : 'text-[#64748B]'}`}>
            {currentStep > 1 ? <CheckCircle2 className="w-5 h-5 text-[#1E88E5]" /> : <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#1E88E5] text-white text-[10px]">1</span>}
            Order Review
          </span>
          <span className={`w-12 h-px ${currentStep >= 2 ? 'bg-[#1E88E5]' : 'bg-[#E2E8F0]'}`}></span>
          <span className={`flex items-center gap-1.5 ${currentStep >= 2 ? 'text-[#1E88E5]' : 'text-[#64748B]'}`}>
            {currentStep > 2 ? <CheckCircle2 className="w-5 h-5 text-[#1E88E5]" /> : <span className={`flex items-center justify-center w-5 h-5 rounded-full ${currentStep === 2 ? 'bg-[#1E88E5] text-white' : 'border-2 border-[#E2E8F0] text-[#64748B]'} text-[10px]`}>2</span>}
            Delivery Details
          </span>
          <span className={`w-12 h-px ${currentStep >= 3 ? 'bg-[#1E88E5]' : 'bg-[#E2E8F0]'}`}></span>
          <span className={`flex items-center gap-1.5 ${currentStep === 3 ? 'text-[#1E88E5]' : 'text-[#64748B]'}`}>
            <span className={`flex items-center justify-center w-5 h-5 rounded-full ${currentStep === 3 ? 'bg-[#1E88E5] text-white' : 'border-2 border-[#E2E8F0] text-[#64748B]'} text-[10px]`}>3</span>
            Payment
          </span>
        </div>

        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between mb-4">
          <h1 className="text-[20px] font-bold text-[#0F172A]">
            {currentStep === 1 && 'Order Review'}
            {currentStep === 2 && 'Delivery Details'}
            {currentStep === 3 && 'Payment'}
          </h1>
          <span className="text-[12px] font-semibold text-[#1E88E5] bg-[#EBF5FB] px-2.5 py-1 rounded-full">
            Step {currentStep} of 3
          </span>
        </div>

        {/* Desktop Title */}
        <div className="hidden md:flex items-center gap-3 mb-6">
          <h1 className="text-[28px] font-bold text-[#0F172A]">Checkout</h1>
        </div>

        <div className="max-w-[800px] mx-auto w-full">
          <AnimatePresence mode="wait">
            {/* STAGE 1: ORDER REVIEW */}
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="bg-white p-4 md:p-6 rounded-[16px] border border-[#E2E8F0] shadow-sm"
              >
                <h2 className="hidden md:block text-[18px] md:text-[20px] font-bold text-[#0F172A] mb-4 border-b border-[#E2E8F0] pb-3">Order Review</h2>
                <div className="space-y-4 md:space-y-5">
                  {checkoutItems.map((item) => (
                    <div key={item.id} className="flex gap-3 md:gap-4 items-center">
                      <div className="w-16 h-16 md:w-20 md:h-20 bg-[#F8FAFC] rounded-[12px] overflow-hidden flex-shrink-0 border border-[#E2E8F0]">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.name} className="object-cover w-full h-full" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ShoppingBag className="w-6 h-6 md:w-8 md:h-8 text-[#64748B]" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <p className="font-semibold text-[14px] md:text-[15px] text-[#0F172A] truncate">{item.name}</p>
                        
                        <div className="flex items-center gap-2 mt-1 mb-1.5">
                          <div className="flex items-center bg-white border border-[#E2E8F0] rounded-[6px] overflow-hidden shadow-sm h-7">
                            <button 
                              onClick={() => updateCheckoutQuantity(item.id, item.quantity - 1)}
                              className="w-7 h-full flex items-center justify-center text-[#64748B] hover:bg-[#F8FAFC] transition-colors"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-8 text-center text-[13px] font-bold text-[#0F172A]">{item.quantity}</span>
                            <button 
                              onClick={() => updateCheckoutQuantity(item.id, item.quantity + 1)}
                              className="w-7 h-full flex items-center justify-center text-[#64748B] hover:bg-[#F8FAFC] transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                          <button 
                            onClick={() => removeCheckoutItem(item.id)}
                            className="text-[#94A3B8] hover:text-rose-500 p-1.5 rounded-full hover:bg-rose-50 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {item.isJar && (
                          <div className="inline-flex items-center gap-1 text-[11px] md:text-[12px] font-medium text-[#1E88E5]">
                            <ShieldCheck className="w-3 h-3" />
                            Deposit (₹{item.depositAmount}/ea)
                          </div>
                        )}
                      </div>
                      <div className="text-right flex flex-col justify-center">
                        <p className="text-[16px] md:text-[18px] font-bold text-[#0F172A]">₹{item.price * item.quantity}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* STAGE 2: DELIVERY DETAILS */}
            {currentStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                {/* Address Selection */}
                <div className="bg-white p-4 md:p-6 rounded-[16px] border border-[#E2E8F0] shadow-sm">
                  <div className="flex items-center justify-between mb-4 md:border-b md:border-[#E2E8F0] md:pb-3">
                    <h2 className="text-[16px] md:text-[18px] font-bold text-[#0F172A]">Delivery Address</h2>
                    <button 
                      onClick={() => setIsAddressModalOpen(true)}
                      className="text-[#1E88E5] text-[13px] md:text-[14px] font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add New
                    </button>
                  </div>
                  
                  {addresses.length === 0 ? (
                    <div className="text-center py-6 border border-dashed border-[#E2E8F0] rounded-[12px] bg-[#F8FAFC]">
                      <p className="text-[14px] text-[#64748B] font-medium mb-3">No addresses found.</p>
                      <button onClick={() => setIsAddressModalOpen(true)} className="px-4 py-2 bg-white text-[#0F172A] border border-[#E2E8F0] font-semibold rounded-[10px] text-[13px] shadow-sm cursor-pointer">
                        Add Address
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {addresses.map(addr => (
                        <label key={addr.id} className={`flex items-start gap-3 p-3 md:p-4 rounded-[12px] border cursor-pointer transition-all relative group ${selectedAddressId === addr.id ? 'border-[#1E88E5] bg-[#EBF5FB]' : 'border-[#E2E8F0] bg-white'}`}>
                          <div className={`mt-0.5 flex items-center justify-center w-4 h-4 rounded-full border ${selectedAddressId === addr.id ? 'border-[#1E88E5] bg-[#1E88E5]' : 'border-[#E2E8F0] bg-white'}`}>
                            {selectedAddressId === addr.id && <div className="w-1.5 h-1.5 rounded-full bg-white"></div>}
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-[14px] text-[#0F172A] flex items-center gap-2 mb-0.5">
                              {addr.label || 'Home Address'}
                              {addr.isDefault && <span className="text-[9px] bg-[#E2E8F0] text-[#64748B] px-1.5 py-0.5 rounded-sm uppercase font-bold">Default</span>}
                            </p>
                            <p className="text-[12px] text-[#64748B] leading-relaxed pr-6">{addr.street}, {addr.city} {addr.zipCode}</p>
                          </div>
                          <button 
                            onClick={(e) => handleDeleteAddress(e, addr.id)}
                            className="absolute right-2 top-2 p-1.5 text-[#94A3B8] hover:text-rose-500 rounded-full hover:bg-white cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Delivery Slot */}
                <div className="bg-white p-4 md:p-6 rounded-[16px] border border-[#E2E8F0] shadow-sm">
                  <h2 className="text-[16px] md:text-[18px] font-bold text-[#0F172A] mb-4 md:border-b md:border-[#E2E8F0] md:pb-3">Delivery Slot</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
                    {slots.map(slot => (
                      <label key={slot.id} className={`flex items-center justify-center min-h-[40px] md:min-h-[44px] text-center p-2 rounded-[10px] border cursor-pointer transition-colors ${selectedSlot === slot.id ? 'border-[#1E88E5] bg-[#1E88E5] text-white shadow-sm' : 'border-[#E2E8F0] bg-white text-[#64748B] hover:bg-[#F8FAFC]'}`}>
                        <input type="radio" name="slot" checked={selectedSlot === slot.id} onChange={() => setSelectedSlot(slot.id)} className="hidden" />
                        <span className="font-medium text-[13px]">{slot.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Brand-Wise Jar Return */}
                <div className="bg-white p-4 md:p-6 rounded-[16px] border border-[#E2E8F0] shadow-sm">
                  <h2 className="text-[16px] md:text-[18px] font-bold text-[#0F172A] mb-4 md:border-b md:border-[#E2E8F0] md:pb-3">Return Empty Jars</h2>
                  {jarOwnerships.length === 0 ? (
                    <p className="text-[13px] text-[#64748B]">You don't own any jars yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {jarOwnerships.map(ownership => {
                        const totalOwned = ownership.ownedJars + ownership.companyJarsHeld;
                        if (totalOwned === 0) return null;
                        const returned = returnedJarsState[ownership.brandId] || 0;

                        return (
                          <div key={ownership.brandId} className="flex items-center justify-between p-3 rounded-[12px] border border-[#E2E8F0] bg-[#F8FAFC]">
                            <div>
                              <p className="font-semibold text-[14px] text-[#0F172A]">{ownership.brand?.name || 'Water Jar'}</p>
                              <p className="text-[12px] text-[#64748B]">You have {totalOwned} empty jars</p>
                            </div>
                            <div className="flex items-center bg-white border border-[#E2E8F0] rounded-[8px] overflow-hidden shadow-sm h-8">
                              <button 
                                onClick={() => updateReturnedJars(ownership.brandId, -1)}
                                className="w-8 h-full flex items-center justify-center text-[#64748B] hover:bg-[#F8FAFC] transition-colors"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="w-10 text-center text-[14px] font-bold text-[#0F172A]">{returned}</span>
                              <button 
                                onClick={() => updateReturnedJars(ownership.brandId, 1)}
                                className="w-8 h-full flex items-center justify-center text-[#64748B] hover:bg-[#F8FAFC] transition-colors"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* STAGE 3: PAYMENT */}
            {currentStep === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div className="bg-white p-4 md:p-6 rounded-[16px] border border-[#E2E8F0] shadow-sm">
                  <h2 className="text-[16px] md:text-[18px] font-bold text-[#0F172A] mb-4 md:border-b md:border-[#E2E8F0] md:pb-3">Payment Method</h2>
                  <div className="relative">
                    <select 
                      value={paymentMethod} 
                      onChange={e => setPaymentMethod(e.target.value)}
                      className="w-full h-[48px] pl-3 pr-10 rounded-[12px] border border-[#E2E8F0] bg-[#F8FAFC] focus:bg-white focus:border-[#1E88E5] focus:ring-1 focus:ring-[#1E88E5] appearance-none text-[14px] font-medium text-[#0F172A] cursor-pointer"
                    >
                      <option value="ONLINE">Pay Online (Razorpay)</option>
                      <option value="WALLET">Edrops Wallet</option>
                      <option value="HYBRID">Hybrid (Wallet + Online)</option>
                      <option value="COD">Cash on Delivery</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[#64748B]">
                      <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-4 md:p-6 rounded-[16px] border border-[#E2E8F0] shadow-sm">
                  <h3 className="text-[16px] md:text-[18px] font-bold text-[#0F172A] mb-4 md:border-b md:border-[#E2E8F0] md:pb-3">Order Summary</h3>
                  
                  <div className="space-y-3 text-[13px] md:text-[14px] font-medium text-[#64748B] border-b border-[#E2E8F0] pb-4 mb-4">
                    <div className="flex justify-between">
                      <span>Product Total</span>
                      <span className="font-semibold text-[#0F172A]">₹{subTotal}</span>
                    </div>
                    
                    {depositTotal > 0 && (
                      <div className="flex justify-between items-center text-[#0F172A]">
                        <span>Security Deposit</span>
                        <span className="font-semibold">₹{depositTotal}</span>
                      </div>
                    )}

                    {/* Deposit waived calculation is complex per-brand now. We only show the total computed deposit above. */}
                    
                    <div className="flex justify-between">
                      <span>Delivery Charge</span>
                      <span className="font-semibold">{deliveryCharge === 0 ? <span className="text-[#1E88E5]">Free</span> : `₹${deliveryCharge}`}</span>
                    </div>

                    {promoDiscount > 0 && (
                      <div className="flex justify-between text-emerald-600">
                        <span>Discount ({appliedPromo?.code})</span>
                        <span className="font-semibold">-₹{promoDiscount}</span>
                      </div>
                    )}
                    
                    {walletDeduction > 0 && (
                      <div className="flex justify-between text-[#1E88E5]">
                        <span>Wallet Applied (Bal: ₹{walletBalance})</span>
                        <span className="font-semibold">-₹{walletDeduction}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-[#0F172A] font-bold text-[16px] md:text-[18px]">{paymentMethod === 'WALLET' && grandTotal === 0 ? 'Fully Paid' : 'Amount Payable'}</span>
                    <span className="text-[24px] md:text-[28px] font-bold text-[#1E88E5]">₹{grandTotal}</span>
                  </div>
                </div>

                {/* Promo Code Input */}
                <div className="bg-white p-4 md:p-6 rounded-[16px] border border-[#E2E8F0] shadow-sm">
                  <h3 className="text-[16px] md:text-[18px] font-bold text-[#0F172A] mb-4 md:border-b md:border-[#E2E8F0] md:pb-3">Promo Code</h3>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Enter promo code"
                      value={promoInput}
                      onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                      disabled={!!appliedPromo}
                      className="flex-1 px-4 py-2 border border-[#E2E8F0] bg-[#F8FAFC] rounded-[10px] text-sm font-medium focus:outline-none focus:border-[#1E88E5] focus:bg-white uppercase disabled:bg-slate-50 disabled:text-slate-400"
                    />
                    {appliedPromo ? (
                      <button
                        onClick={handleRemovePromo}
                        className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 font-semibold text-[13px] rounded-[10px] transition-colors cursor-pointer"
                      >
                        Remove
                      </button>
                    ) : (
                      <button
                        onClick={handleApplyPromo}
                        disabled={!promoInput.trim() || isValidatingPromo}
                        className="px-5 py-2 bg-[#1E88E5] hover:bg-[#1565C0] disabled:bg-slate-100 disabled:text-slate-400 text-white font-semibold text-[13px] rounded-[10px] transition-colors cursor-pointer"
                      >
                        {isValidatingPromo ? '...' : 'Apply'}
                      </button>
                    )}
                  </div>
                  {promoError && <p className="text-xs text-rose-500 font-semibold mt-1.5 ml-2">{promoError}</p>}
                  {appliedPromo && (
                    <div className="mt-2.5 p-3 bg-emerald-50 rounded-[10px] border border-emerald-100 flex items-center justify-between text-emerald-800">
                      <div className="flex flex-col">
                        <span className="text-[13px] font-bold">{appliedPromo.code} Applied!</span>
                        <span className="text-[11px] text-emerald-600 font-medium">{appliedPromo.description}</span>
                      </div>
                      <span className="text-[14px] font-bold">-₹{promoDiscount}</span>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center justify-between mt-8">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => navigate('/customer/shop')}
                className="h-[48px] px-6 rounded-[12px] bg-white border border-rose-200 text-rose-500 font-semibold text-[14px] hover:bg-rose-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              {currentStep > 1 && (
                <button 
                  onClick={() => setCurrentStep(prev => prev - 1)}
                  className="h-[48px] px-6 rounded-[12px] bg-white border border-[#E2E8F0] text-[#0F172A] font-semibold text-[14px] hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                >
                  Back to {currentStep === 2 ? 'Order Review' : 'Delivery Details'}
                </button>
              )}
            </div>

            {currentStep < 3 ? (
              <button 
                onClick={handleNextStep}
                className="h-[48px] px-8 rounded-[12px] bg-[#1E88E5] text-white font-semibold text-[14px] shadow-sm hover:bg-[#1565C0] transition-colors cursor-pointer"
              >
                Continue
              </button>
            ) : (
              <button 
                onClick={handleCheckout}
                disabled={isProcessing}
                className="h-[48px] px-10 rounded-[12px] bg-[#1E88E5] text-white font-bold text-[14px] shadow-sm hover:bg-[#1565C0] transition-colors cursor-pointer disabled:opacity-70 flex items-center justify-center min-w-[150px]"
              >
                {isProcessing ? <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Place Order'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Sticky CTA */}
      <div className="md:hidden fixed bottom-[65px] left-0 right-0 bg-white border-t border-[#E2E8F0] px-4 py-3 shadow-[0_-4px_24px_rgba(15,23,42,0.06)] z-40">
        <div className="flex justify-between items-center mb-3">
          <span className="text-[13px] font-medium text-[#64748B]">Total Amount</span>
          <span className="text-[18px] font-bold text-[#0F172A]">₹{grandTotal}</span>
        </div>
        <div className="flex gap-2.5">
          <button 
            onClick={() => navigate('/customer/shop')}
            className="h-[44px] px-3 rounded-[12px] bg-white border border-rose-200 text-rose-500 font-medium text-[13px] active:bg-rose-50 transition-colors cursor-pointer whitespace-nowrap"
          >
            Cancel
          </button>
          {currentStep > 1 && (
            <button 
              onClick={() => setCurrentStep(prev => prev - 1)}
              className="h-[44px] px-3 rounded-[12px] bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] font-medium text-[13px] active:bg-[#E2E8F0] transition-colors cursor-pointer whitespace-nowrap"
            >
              Back
            </button>
          )}
          {currentStep < 3 ? (
            <button 
              onClick={handleNextStep}
              className="flex-1 h-[44px] rounded-[12px] bg-[#1E88E5] text-white font-semibold text-[14px] shadow-sm active:bg-[#1565C0] transition-colors cursor-pointer"
            >
              Continue
            </button>
          ) : (
            <button 
              onClick={handleCheckout}
              disabled={isProcessing}
              className="flex-1 h-[44px] rounded-[12px] bg-[#1E88E5] text-white font-bold text-[14px] shadow-sm active:bg-[#1565C0] transition-colors cursor-pointer disabled:opacity-70 flex items-center justify-center"
            >
              {isProcessing ? <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Place Order'}
            </button>
          )}
        </div>
      </div>

      <AddressModal 
        isOpen={isAddressModalOpen} 
        onClose={() => setIsAddressModalOpen(false)} 
        onSuccess={loadAddresses}
      />
    </div>
  );
}
