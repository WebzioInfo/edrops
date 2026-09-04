import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, Plus, Trash2, ShieldCheck, CheckCircle2, Minus, ChevronDown, ChevronUp, MapPin, Clock, CreditCard, Wallet, Banknote, ArrowLeft, X } from 'lucide-react';
import { useCart } from '../../../contexts/CartContext';
import { fetchWithAuth } from '../../../api/client';
import { toast } from 'react-hot-toast';
import { injectMockRazorpay } from '../../../utils/MockRazorpay';
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import AddressModal from '../components/AddressModal';
import CheckoutOrderSummary from '../components/CheckoutOrderSummary';

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
    brandId: undefined,
    isJar: false,
    depositAmount: 0
  }] : [];

  const [checkoutItems, setCheckoutItems] = useState<any[]>(isBuyNow ? buyNowProduct : items);
  const [currentStep, setCurrentStep] = useState(1);
  const [mobileSummaryOpen, setMobileSummaryOpen] = useState(false);

  useEffect(() => {
    if (!isBuyNow) {
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

  const [walletBalance, setWalletBalance] = useState<number>(0);

  // Jar Return Wizard State
  const [itemReturns, setItemReturns] = useState<Record<string, {willReturn: boolean, quantity: number}>>({});
  const [additionalReturns, setAdditionalReturns] = useState<{brandId: string, quantity: number}[]>([]);
  const [brands, setBrands] = useState<{id:string, name:string}[]>([]);

  useEffect(() => {
    fetchWithAuth('/auth/me').then(data => {
      if (data?.customer?.wallet) {
        setWalletBalance(data.customer.wallet.balance);
      }
    }).catch(() => {});

    fetchWithAuth('/catalog/brands').then(data => {
      setBrands(data || []);
    }).catch(() => {});
  }, []);

  const subTotal = useMemo(() => checkoutItems.reduce((sum, item) => sum + (item.price * item.quantity), 0), [checkoutItems]);

  // Calculate dynamic deposit based on net new jars per brand
  const depositTotal = useMemo(() => {
    let total = 0;
    const purchasedJarsByBrand: Record<string, { quantity: number; depositAmount: number }> = {};
    const returnedJarsByBrand: Record<string, number> = {};

    checkoutItems.forEach(item => {
      if (item.isJar && item.brandId) {
        if (!purchasedJarsByBrand[item.brandId]) {
          purchasedJarsByBrand[item.brandId] = { quantity: 0, depositAmount: item.depositAmount || 0 };
        }
        purchasedJarsByBrand[item.brandId].quantity += item.quantity;

        const returnInfo = itemReturns[item.id];
        if (returnInfo?.willReturn && returnInfo.quantity > 0) {
          returnedJarsByBrand[item.brandId] = (returnedJarsByBrand[item.brandId] || 0) + returnInfo.quantity;
        }
      }
    });

    additionalReturns.forEach(ar => {
      if (ar.brandId) {
        returnedJarsByBrand[ar.brandId] = (returnedJarsByBrand[ar.brandId] || 0) + ar.quantity;
      }
    });

    for (const [brandId, purchased] of Object.entries(purchasedJarsByBrand)) {
      const returnedQty = returnedJarsByBrand[brandId] || 0;
      const netNewJars = purchased.quantity - returnedQty;
      if (netNewJars > 0) {
        total += netNewJars * purchased.depositAmount;
      }
    }
    return total;
  }, [checkoutItems, itemReturns, additionalReturns]);

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

  const [paymentMethod, setPaymentMethod] = useState('ONLINE');
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
        itemReturns: Object.entries(itemReturns).filter(([_, info]) => info.willReturn && info.quantity > 0).map(([id, info]) => ({productId: id, quantity: info.quantity})),
        additionalReturns: additionalReturns.filter(ar => ar.brandId && ar.quantity > 0),
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
            name: (user?.firstName || '') + ' ' + (user?.lastName || ''),
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

  const hasJarsInCart = checkoutItems.some(i => i.isJar);

  if (checkoutItems.length === 0 && currentStep === 1) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 text-center flex flex-col items-center justify-center min-h-[70vh]">
        <div className="h-20 w-20 rounded-full bg-white border border-[#E2E8F0] shadow-xs flex items-center justify-center mb-4 text-[#64748B]">
          <ShoppingBag className="h-9 w-9" />
        </div>
        <h2 className="text-[22px] font-bold text-[#0F172A]">Your cart is empty</h2>
        <p className="mt-1.5 text-[#64748B] text-sm max-w-sm">Looks like you haven't added any fresh water jars or products yet.</p>
        <Link
          to="/customer/shop"
          className="mt-6 inline-flex items-center justify-center px-6 py-2.5 rounded-xl bg-[#1E88E5] text-white text-sm font-semibold shadow-xs hover:bg-[#1565C0] transition-colors"
        >
          Browse Catalog
        </Link>
      </div>
    );
  }

  const orderSummaryProps = {
    items: checkoutItems,
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
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-28 lg:pb-12 text-[#0F172A]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        
        {/* Compact Refined 3-Step Header */}
        <div className="mb-4 sm:mb-6">
          <div className="flex items-center justify-between max-w-2xl mx-auto bg-white rounded-2xl border border-[#E2E8F0] p-2 sm:p-3 shadow-xs">
            <button
              onClick={() => setCurrentStep(1)}
              className={`flex-1 flex items-center justify-center gap-2 py-1.5 px-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                currentStep === 1
                  ? 'bg-[#1E88E5] text-white shadow-xs'
                  : currentStep > 1
                  ? 'text-[#1E88E5] hover:bg-[#EBF5FB]'
                  : 'text-[#64748B]'
              }`}
            >
              {currentStep > 1 ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              ) : (
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${currentStep === 1 ? 'bg-white text-[#1E88E5]' : 'bg-[#E2E8F0] text-[#64748B]'}`}>1</span>
              )}
              <span className="truncate">Order Review</span>
            </button>

            <span className="text-[#CBD5E1] px-1 font-bold">›</span>

            <button
              onClick={() => currentStep > 2 ? setCurrentStep(2) : undefined}
              className={`flex-1 flex items-center justify-center gap-2 py-1.5 px-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                currentStep === 2
                  ? 'bg-[#1E88E5] text-white shadow-xs'
                  : currentStep > 2
                  ? 'text-[#1E88E5] hover:bg-[#EBF5FB] cursor-pointer'
                  : 'text-[#64748B]'
              }`}
            >
              {currentStep > 2 ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              ) : (
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${currentStep === 2 ? 'bg-white text-[#1E88E5]' : 'bg-[#E2E8F0] text-[#64748B]'}`}>2</span>
              )}
              <span className="truncate">Delivery</span>
            </button>

            <span className="text-[#CBD5E1] px-1 font-bold">›</span>

            <div
              className={`flex-1 flex items-center justify-center gap-2 py-1.5 px-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                currentStep === 3
                  ? 'bg-[#1E88E5] text-white shadow-xs'
                  : 'text-[#64748B]'
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${currentStep === 3 ? 'bg-white text-[#1E88E5]' : 'bg-[#E2E8F0] text-[#64748B]'}`}>3</span>
              <span className="truncate">Payment</span>
            </div>
          </div>
        </div>

        {/* Two-Column Grid (Desktop) / Single-Column (Mobile) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start w-full">
          
          {/* LEFT COLUMN: Active Step Content (~60-65% width on desktop) */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-4">
            <AnimatePresence mode="wait">
              {/* STAGE 1: ORDER REVIEW */}
              {currentStep === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                  className="space-y-4"
                >
                  <div className="bg-white p-4 sm:p-6 rounded-2xl border border-[#E2E8F0] shadow-xs">
                    <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#F1F5F9]">
                      <h2 className="text-base sm:text-lg font-bold text-[#0F172A] flex items-center gap-2">
                        <ShoppingBag className="w-5 h-5 text-[#1E88E5]" />
                        Review Items ({checkoutItems.length})
                      </h2>
                      <span className="text-xs font-semibold text-[#64748B]">
                        Free delivery over ₹500
                      </span>
                    </div>

                    <div className="divide-y divide-[#F1F5F9]">
                      {checkoutItems.map((item) => (
                        <div key={item.id} className="py-3 sm:py-3.5 flex items-center gap-3 sm:gap-4 first:pt-0 last:pb-0">
                          {/* Compact Thumbnail */}
                          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] overflow-hidden flex-shrink-0 flex items-center justify-center">
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                            ) : (
                              <ShoppingBag className="w-6 h-6 text-[#94A3B8]" />
                            )}
                          </div>

                          {/* Info & Quantity Stepper */}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-xs sm:text-sm text-[#0F172A] truncate">
                              {item.name}
                            </h4>
                            <div className="flex items-center gap-2 mt-0.5 mb-1 text-[11px] text-[#64748B]">
                              <span>₹{item.price} / unit</span>
                              {item.isJar && item.depositAmount ? (
                                <span className="inline-flex items-center gap-0.5 text-[#1E88E5] font-semibold bg-[#EBF5FB] px-1.5 py-0.2 rounded-md text-[10px]">
                                  <ShieldCheck className="w-2.5 h-2.5" /> Deposit ₹{item.depositAmount}
                                </span>
                              ) : null}
                            </div>

                            {/* Stepper */}
                            <div className="flex items-center gap-2 mt-1">
                              <div className="flex items-center bg-white border border-[#E2E8F0] rounded-lg overflow-hidden shadow-2xs h-7">
                                <button
                                  type="button"
                                  onClick={() => updateCheckoutQuantity(item.id, item.quantity - 1)}
                                  className="w-7 h-full flex items-center justify-center text-[#64748B] hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                                  aria-label="Decrease quantity"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="w-7 text-center text-xs font-bold text-[#0F172A]">
                                  {item.quantity}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => updateCheckoutQuantity(item.id, item.quantity + 1)}
                                  className="w-7 h-full flex items-center justify-center text-[#64748B] hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                                  aria-label="Increase quantity"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>

                              <button
                                type="button"
                                onClick={() => removeCheckoutItem(item.id)}
                                className="text-[#94A3B8] hover:text-rose-500 p-1 rounded-md hover:bg-rose-50 transition-colors cursor-pointer"
                                title="Remove item"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Line Total */}
                          <div className="text-right shrink-0">
                            <span className="font-extrabold text-sm sm:text-base text-[#0F172A]">
                              ₹{item.price * item.quantity}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Desktop Column Navigation */}
                  <div className="hidden lg:flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={() => navigate('/customer/shop')}
                      className="px-4 py-2.5 rounded-xl bg-white border border-[#E2E8F0] text-[#64748B] font-semibold text-xs hover:bg-[#F8FAFC] hover:text-[#0F172A] transition-colors cursor-pointer"
                    >
                      ← Back to Shopping
                    </button>
                    <button
                      type="button"
                      onClick={handleNextStep}
                      className="px-8 py-2.5 rounded-xl bg-[#1E88E5] text-white font-bold text-sm shadow-xs hover:bg-[#1565C0] transition-colors cursor-pointer"
                    >
                      Proceed to Delivery →
                    </button>
                  </div>
                </motion.div>
              )}

              {/* STAGE 2: DELIVERY DETAILS */}
              {currentStep === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                  className="space-y-4"
                >
                  {/* Address Section */}
                  <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#E2E8F0] shadow-xs">
                    <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#F1F5F9]">
                      <h2 className="text-base font-bold text-[#0F172A] flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-[#1E88E5]" />
                        Delivery Address
                      </h2>
                      <button
                        type="button"
                        onClick={() => setIsAddressModalOpen(true)}
                        className="text-[#1E88E5] text-xs font-bold flex items-center gap-1 hover:text-[#1565C0] cursor-pointer bg-[#EBF5FB] px-2.5 py-1 rounded-lg"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Address
                      </button>
                    </div>

                    {addresses.length === 0 ? (
                      <div className="text-center py-6 border border-dashed border-[#E2E8F0] rounded-xl bg-[#F8FAFC]">
                        <p className="text-xs text-[#64748B] font-medium mb-2.5">No saved addresses found</p>
                        <button
                          type="button"
                          onClick={() => setIsAddressModalOpen(true)}
                          className="px-4 py-2 bg-white text-[#0F172A] border border-[#E2E8F0] font-bold rounded-xl text-xs shadow-xs cursor-pointer hover:bg-[#F8FAFC]"
                        >
                          + Add New Address
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {addresses.map((addr) => (
                          <label
                            key={addr.id}
                            className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all relative ${
                              selectedAddressId === addr.id
                                ? 'border-[#1E88E5] bg-[#EBF5FB]/60 ring-1 ring-[#1E88E5]'
                                : 'border-[#E2E8F0] bg-white hover:border-slate-300'
                            }`}
                          >
                            <div className={`mt-0.5 flex items-center justify-center w-4 h-4 rounded-full border shrink-0 ${
                              selectedAddressId === addr.id ? 'border-[#1E88E5] bg-[#1E88E5]' : 'border-[#CBD5E1] bg-white'
                            }`}>
                              {selectedAddressId === addr.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                            </div>
                            <div className="flex-1 min-w-0 pr-6">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="font-bold text-xs text-[#0F172A]">
                                  {addr.label || 'Home'}
                                </span>
                                {addr.isDefault && (
                                  <span className="text-[9px] bg-[#E2E8F0] text-[#64748B] px-1.5 py-0.2 rounded font-bold uppercase">
                                    Default
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-[#64748B] leading-relaxed truncate">
                                {addr.street}, {addr.city} {addr.zipCode}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteAddress(e, addr.id)}
                              className="absolute right-2 top-2 p-1 text-[#94A3B8] hover:text-rose-500 rounded-md hover:bg-white transition-colors cursor-pointer"
                              title="Delete address"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Delivery Slot */}
                  <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#E2E8F0] shadow-xs">
                    <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#F1F5F9]">
                      <h2 className="text-base font-bold text-[#0F172A] flex items-center gap-2">
                        <Clock className="w-4 h-4 text-[#1E88E5]" />
                        Delivery Schedule
                      </h2>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {slots.map((slot) => (
                        <label
                          key={slot.id}
                          className={`flex items-center justify-center min-h-[38px] px-2.5 py-1.5 rounded-xl border text-center cursor-pointer transition-all ${
                            selectedSlot === slot.id
                              ? 'border-[#1E88E5] bg-[#1E88E5] text-white font-bold shadow-xs'
                              : 'border-[#E2E8F0] bg-white text-[#64748B] font-semibold text-xs hover:bg-[#F8FAFC]'
                          }`}
                        >
                          <input
                            type="radio"
                            name="slot"
                            checked={selectedSlot === slot.id}
                            onChange={() => setSelectedSlot(slot.id)}
                            className="hidden"
                          />
                          <span className="text-xs">{slot.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Return Empty Jars Section (Compact & Contextual) */}
                  <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#E2E8F0] shadow-xs">
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#F1F5F9]">
                      <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-[#1E88E5]" />
                        Return Empty Jars (Deposit Waiver)
                      </h3>
                    </div>

                    {hasJarsInCart ? (
                      <div className="space-y-3 pt-1">
                        {checkoutItems.filter(i => i.isJar).map(item => (
                          <div key={item.id} className="p-3 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
                            <div className="flex justify-between items-center mb-1.5">
                              <span className="text-xs font-bold text-[#0F172A]">{item.name}</span>
                              <span className="text-[11px] text-[#64748B]">Ordered: {item.quantity}</span>
                            </div>
                            <p className="text-xs text-[#64748B] mb-2">Returning empty jars for {item.name}?</p>
                            <div className="flex items-center gap-3">
                              <label className="flex items-center gap-1.5 text-xs font-bold text-[#334155] cursor-pointer">
                                <input
                                  type="radio"
                                  name={`return_${item.id}`}
                                  checked={Boolean(itemReturns[item.id]?.willReturn)}
                                  onChange={() => setItemReturns(prev => ({
                                    ...prev,
                                    [item.id]: { willReturn: true, quantity: Math.min(item.quantity, prev[item.id]?.quantity || item.quantity) }
                                  }))}
                                  className="w-3.5 h-3.5 text-[#1E88E5]"
                                />
                                <span>Yes</span>
                              </label>
                              <label className="flex items-center gap-1.5 text-xs font-bold text-[#334155] cursor-pointer">
                                <input
                                  type="radio"
                                  name={`return_${item.id}`}
                                  checked={!itemReturns[item.id]?.willReturn}
                                  onChange={() => setItemReturns(prev => ({
                                    ...prev,
                                    [item.id]: { willReturn: false, quantity: 0 }
                                  }))}
                                  className="w-3.5 h-3.5 text-[#1E88E5]"
                                />
                                <span>No</span>
                              </label>

                              {itemReturns[item.id]?.willReturn && (
                                <div className="ml-auto flex items-center bg-white border border-[#E2E8F0] rounded-lg overflow-hidden h-7 w-24 shadow-2xs">
                                  <button
                                    type="button"
                                    onClick={() => setItemReturns(prev => ({
                                      ...prev,
                                      [item.id]: { ...prev[item.id], quantity: Math.max(0, prev[item.id].quantity - 1) }
                                    }))}
                                    className="w-7 h-full flex items-center justify-center text-[#64748B] hover:bg-[#F8FAFC]"
                                  >
                                    <Minus className="w-3 h-3" />
                                  </button>
                                  <span className="flex-1 text-center text-xs font-bold text-[#0F172A]">
                                    {itemReturns[item.id]?.quantity || 0}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setItemReturns(prev => ({
                                      ...prev,
                                      [item.id]: { ...prev[item.id], quantity: Math.min(item.quantity, prev[item.id].quantity + 1) }
                                    }))}
                                    className="w-7 h-full flex items-center justify-center text-[#64748B] hover:bg-[#F8FAFC]"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-[#64748B] py-1">
                        No 20L jars in today's cart. You can still return other empty jars below if needed.
                      </p>
                    )}

                    {/* Additional Brand Returns */}
                    <div className="mt-3 pt-3 border-t border-[#F1F5F9]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-[#64748B]">Other Brand Returns</span>
                        <button
                          type="button"
                          onClick={() => setAdditionalReturns([...additionalReturns, { brandId: '', quantity: 1 }])}
                          className="text-xs font-bold text-[#1E88E5] hover:text-[#1565C0] flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Return
                        </button>
                      </div>

                      {additionalReturns.map((ar, idx) => (
                        <div key={idx} className="flex items-center gap-2 mb-2">
                          <select
                            value={ar.brandId}
                            onChange={(e) => {
                              const newAr = [...additionalReturns];
                              newAr[idx].brandId = e.target.value;
                              setAdditionalReturns(newAr);
                            }}
                            className="flex-1 h-8 pl-2.5 pr-6 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-xs font-medium focus:outline-none focus:border-[#1E88E5]"
                          >
                            <option value="">Select Brand</option>
                            {brands.map((b) => (
                              <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                          </select>
                          <div className="flex items-center bg-white border border-[#E2E8F0] rounded-lg overflow-hidden h-8 w-24 shrink-0 shadow-2xs">
                            <button
                              type="button"
                              onClick={() => {
                                const newAr = [...additionalReturns];
                                newAr[idx].quantity = Math.max(1, newAr[idx].quantity - 1);
                                setAdditionalReturns(newAr);
                              }}
                              className="w-7 h-full flex items-center justify-center text-[#64748B] hover:bg-[#F8FAFC]"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="flex-1 text-center text-xs font-bold text-[#0F172A]">{ar.quantity}</span>
                            <button
                              type="button"
                              onClick={() => {
                                const newAr = [...additionalReturns];
                                newAr[idx].quantity += 1;
                                setAdditionalReturns(newAr);
                              }}
                              className="w-7 h-full flex items-center justify-center text-[#64748B] hover:bg-[#F8FAFC]"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => setAdditionalReturns(additionalReturns.filter((_, i) => i !== idx))}
                            className="p-1 text-[#94A3B8] hover:text-rose-500 rounded-md hover:bg-rose-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Desktop Column Navigation */}
                  <div className="hidden lg:flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(1)}
                      className="px-4 py-2.5 rounded-xl bg-white border border-[#E2E8F0] text-[#64748B] font-semibold text-xs hover:bg-[#F8FAFC] hover:text-[#0F172A] transition-colors cursor-pointer"
                    >
                      ← Back to Order Review
                    </button>
                    <button
                      type="button"
                      onClick={handleNextStep}
                      className="px-8 py-2.5 rounded-xl bg-[#1E88E5] text-white font-bold text-sm shadow-xs hover:bg-[#1565C0] transition-colors cursor-pointer"
                    >
                      Continue to Payment →
                    </button>
                  </div>
                </motion.div>
              )}

              {/* STAGE 3: PAYMENT */}
              {currentStep === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                  className="space-y-4"
                >
                  <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#E2E8F0] shadow-xs">
                    <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#F1F5F9]">
                      <h2 className="text-base font-bold text-[#0F172A] flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-[#1E88E5]" />
                        Select Payment Method
                      </h2>
                    </div>

                    <div className="space-y-2.5">
                      {/* Online Payment */}
                      <label
                        className={`flex items-center gap-3.5 p-3.5 rounded-xl border cursor-pointer transition-all ${
                          paymentMethod === 'ONLINE'
                            ? 'border-[#1E88E5] bg-[#EBF5FB]/60 ring-1 ring-[#1E88E5]'
                            : 'border-[#E2E8F0] bg-white hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="ONLINE"
                          checked={paymentMethod === 'ONLINE'}
                          onChange={() => setPaymentMethod('ONLINE')}
                          className="w-4 h-4 text-[#1E88E5]"
                        />
                        <div className="p-2 rounded-lg bg-sky-50 text-[#1E88E5]">
                          <CreditCard className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                          <span className="text-xs sm:text-sm font-bold text-[#0F172A] block">
                            UPI / Cards / NetBanking
                          </span>
                          <span className="text-[11px] text-[#64748B]">
                            Instant & secure online checkout via Razorpay
                          </span>
                        </div>
                      </label>

                      {/* Wallet Option */}
                      <label
                        className={`flex items-center gap-3.5 p-3.5 rounded-xl border cursor-pointer transition-all ${
                          paymentMethod === 'WALLET'
                            ? 'border-[#1E88E5] bg-[#EBF5FB]/60 ring-1 ring-[#1E88E5]'
                            : 'border-[#E2E8F0] bg-white hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="WALLET"
                          checked={paymentMethod === 'WALLET'}
                          onChange={() => setPaymentMethod('WALLET')}
                          className="w-4 h-4 text-[#1E88E5]"
                        />
                        <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                          <Wallet className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs sm:text-sm font-bold text-[#0F172A]">
                              Edrops Wallet
                            </span>
                            <span className="text-xs font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                              Bal: ₹{walletBalance}
                            </span>
                          </div>
                          <span className="text-[11px] text-[#64748B]">
                            {walletBalance >= baseTotal
                              ? 'Sufficient balance for instant one-click order'
                              : 'Partial payment applied; remaining payable via online/COD'}
                          </span>
                        </div>
                      </label>

                      {/* Cash on Delivery */}
                      <label
                        className={`flex items-center gap-3.5 p-3.5 rounded-xl border cursor-pointer transition-all ${
                          paymentMethod === 'COD'
                            ? 'border-[#1E88E5] bg-[#EBF5FB]/60 ring-1 ring-[#1E88E5]'
                            : 'border-[#E2E8F0] bg-white hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="COD"
                          checked={paymentMethod === 'COD'}
                          onChange={() => setPaymentMethod('COD')}
                          className="w-4 h-4 text-[#1E88E5]"
                        />
                        <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
                          <Banknote className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                          <span className="text-xs sm:text-sm font-bold text-[#0F172A] block">
                            Cash / UPI on Delivery
                          </span>
                          <span className="text-[11px] text-[#64748B]">
                            Pay the delivery partner upon arrival
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Desktop Column Navigation */}
                  <div className="hidden lg:flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(2)}
                      className="px-4 py-2.5 rounded-xl bg-white border border-[#E2E8F0] text-[#64748B] font-semibold text-xs hover:bg-[#F8FAFC] hover:text-[#0F172A] transition-colors cursor-pointer"
                    >
                      ← Back to Delivery
                    </button>
                    <button
                      type="button"
                      onClick={handleCheckout}
                      disabled={isProcessing}
                      className="px-8 py-2.5 rounded-xl bg-[#1E88E5] text-white font-bold text-sm shadow-xs hover:bg-[#1565C0] transition-colors cursor-pointer disabled:opacity-70 flex items-center justify-center min-w-[150px]"
                    >
                      {isProcessing ? (
                        <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        `Pay ₹${grandTotal} & Place Order`
                      )}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* RIGHT COLUMN: Persistent Sticky Order Summary on Desktop (≥1024px) */}
          <div className="hidden lg:block lg:col-span-5 xl:col-span-4 sticky top-24">
            <CheckoutOrderSummary {...orderSummaryProps} />
          </div>
        </div>
      </div>

      {/* MOBILE STICKY BOTTOM BAR (<1024px) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#E2E8F0] px-4 py-3 shadow-[0_-4px_20px_rgba(15,23,42,0.08)]">
        <div className="flex items-center justify-between gap-3">
          {/* Collapsed Total with View Details Trigger */}
          <button
            type="button"
            onClick={() => setMobileSummaryOpen(!mobileSummaryOpen)}
            className="flex flex-col text-left cursor-pointer group"
          >
            <span className="text-[11px] font-semibold text-[#64748B] flex items-center gap-1 group-hover:text-[#1E88E5]">
              Total Payable {mobileSummaryOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
            </span>
            <span className="text-lg font-black text-[#1E88E5]">
              ₹{grandTotal}
            </span>
          </button>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {currentStep > 1 && (
              <button
                type="button"
                onClick={() => setCurrentStep(prev => prev - 1)}
                className="h-10 px-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#64748B] font-bold text-xs active:bg-[#E2E8F0] transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}

            {currentStep < 3 ? (
              <button
                type="button"
                onClick={handleNextStep}
                className="h-10 px-5 rounded-xl bg-[#1E88E5] text-white font-bold text-xs sm:text-sm shadow-xs active:bg-[#1565C0] transition-colors cursor-pointer"
              >
                Continue
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCheckout}
                disabled={isProcessing}
                className="h-10 px-6 rounded-xl bg-[#1E88E5] text-white font-bold text-xs sm:text-sm shadow-xs active:bg-[#1565C0] transition-colors cursor-pointer disabled:opacity-70 flex items-center justify-center min-w-[130px]"
              >
                {isProcessing ? (
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  'Place Order'
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* MOBILE EXPANDABLE BOTTOM SHEET FOR ORDER BREAKDOWN */}
      <AnimatePresence>
        {mobileSummaryOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end bg-slate-900/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileSummaryOpen(false)}
              className="absolute inset-0"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative z-10 bg-white rounded-t-3xl border-t border-[#E2E8F0] max-h-[85vh] overflow-y-auto p-4 shadow-2xl"
            >
              <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto mb-3" />
              <div className="flex items-center justify-between pb-3 border-b border-[#F1F5F9] mb-3">
                <h3 className="font-bold text-base text-[#0F172A]">Detailed Breakdown</h3>
                <button
                  type="button"
                  onClick={() => setMobileSummaryOpen(false)}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-700 bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <CheckoutOrderSummary {...orderSummaryProps} isMobileDrawer={true} />

              <div className="mt-4 pt-3 border-t border-[#F1F5F9]">
                <button
                  type="button"
                  onClick={() => setMobileSummaryOpen(false)}
                  className="w-full py-2.5 bg-[#F8FAFC] text-[#0F172A] font-bold text-xs rounded-xl border border-[#E2E8F0]"
                >
                  Close Summary
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Address Creation Modal */}
      <AddressModal
        isOpen={isAddressModalOpen}
        onClose={() => setIsAddressModalOpen(false)}
        onSuccess={loadAddresses}
      />
    </div>
  );
}
