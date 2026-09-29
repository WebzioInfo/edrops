import { motion, AnimatePresence } from 'framer-motion';
import {
  Package,
  Plus,
  Trash2,
  ShieldCheck,
  CheckCircle2,
  Minus,
  ChevronDown,
  ChevronUp,
  MapPin,
  Clock,
  CreditCard,
  Wallet,
  Banknote,
  ArrowLeft,
  X,
} from 'lucide-react';
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
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const productId = searchParams.get('productId');
  const rawDeposit = Number(searchParams.get('depositAmount'));
  const isJarParam = searchParams.get('isJar') === 'true' || Boolean(searchParams.get('name')?.toLowerCase().includes('jar'));
  const initialItems = productId ? [{
    id: productId,
    name: searchParams.get('name') || '',
    price: Number(searchParams.get('price')) || 0,
    quantity: Number(searchParams.get('quantity')) || 1,
    imageUrl: searchParams.get('imageUrl') || undefined,
    brandName: searchParams.get('brandName') || undefined,
    brandId: searchParams.get('brandId') || 'default-brand',
    isJar: isJarParam,
    depositAmount: rawDeposit > 0 ? rawDeposit : (isJarParam ? 200 : 0)
  }] : [];

  const [checkoutItems, setCheckoutItems] = useState<any[]>(initialItems);
  const [currentStep, setCurrentStep] = useState(1); // 1 = Delivery, 2 = Payment
  const [mobileSummaryOpen, setMobileSummaryOpen] = useState(false);

  const updateCheckoutQuantity = (id: string, newQuantity: number) => {
    if (newQuantity < 1) {
      setCheckoutItems((prev) => prev.filter((i) => i.id !== id));
      return;
    }
    const currentItem = checkoutItems.find((i) => i.id === id);
    const prevItemQty = currentItem?.quantity || 1;

    setCheckoutItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, quantity: newQuantity } : i))
    );

    // Sync return quantity if exceeds new quantity
    setItemReturns((prev) => {
      const current = prev[id];
      if (!current) return prev;
      if (current.returning) {
        const nextQty = current.quantity >= prevItemQty ? newQuantity : Math.min(newQuantity, current.quantity);
        return {
          ...prev,
          [id]: {
            ...current,
            quantity: nextQty,
          },
        };
      }
      return prev;
    });
  };

  const removeCheckoutItem = (id: string) => {
    setCheckoutItems((prev) => prev.filter((i) => i.id !== id));
  };

  const [walletBalance, setWalletBalance] = useState<number>(0);

  // Authoritative Jar Return State: map of productId -> { returning: boolean; quantity: number }
  const [itemReturns, setItemReturns] = useState<Record<string, { returning: boolean; quantity: number }>>(() => {
    const initial: Record<string, { returning: boolean; quantity: number }> = {};
    initialItems.forEach((item) => {
      if (item.isJar || (item.depositAmount && item.depositAmount > 0)) {
        initial[item.id] = { returning: true, quantity: item.quantity };
      }
    });
    return initial;
  });
  const [pendingNoItemId, setPendingNoItemId] = useState<string | null>(null);
  const [showNoReturnModal, setShowNoReturnModal] = useState(false);
  const [additionalReturns, setAdditionalReturns] = useState<{ brandId: string; quantity: number }[]>([]);
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([]);

  // Keep itemReturns in sync if checkoutItems change (e.g. newly added jar items)
  useEffect(() => {
    setItemReturns((prev) => {
      let changed = false;
      const updated = { ...prev };
      checkoutItems.forEach((item) => {
        if (item.isJar || (item.depositAmount && item.depositAmount > 0)) {
          if (!updated[item.id]) {
            updated[item.id] = { returning: true, quantity: item.quantity };
            changed = true;
          }
        }
      });
      return changed ? updated : prev;
    });
  }, [checkoutItems]);

  useEffect(() => {
    fetchWithAuth('/auth/me').then((data) => {
      if (data?.customer?.wallet) {
        setWalletBalance(data.customer.wallet.balance);
      }
    }).catch(() => {});

    fetchWithAuth('/catalog/brands').then((data) => {
      setBrands(data || []);
    }).catch(() => {});
  }, []);

  const subTotal = useMemo(
    () => checkoutItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [checkoutItems]
  );

  // Calculate dynamic deposit strictly based on unreturned jars per item
  const depositTotal = useMemo(() => {
    let total = 0;
    checkoutItems.forEach((item) => {
      const isJar = item.isJar || (item.depositAmount && item.depositAmount > 0);
      if (isJar) {
        const depositPerJar = item.depositAmount && item.depositAmount > 0 ? item.depositAmount : 200;
        const returnInfo = itemReturns[item.id];

        let returningCount = 0;
        if (returnInfo) {
          if (returnInfo.returning) {
            returningCount = Math.max(0, Math.min(item.quantity, returnInfo.quantity));
          } else {
            returningCount = 0;
          }
        } else {
          // Default: returning all jars (YES) -> deposit = 0
          returningCount = item.quantity;
        }

        const unreturnedJars = Math.max(0, item.quantity - returningCount);
        total += unreturnedJars * depositPerJar;
      }
    });
    return total;
  }, [checkoutItems, itemReturns]);

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
        }),
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
  }, [appliedPromo?.code, subTotal]);

  const [paymentMethod, setPaymentMethod] = useState('ONLINE');
  const baseTotal = Math.max(0, subTotal + depositTotal - promoDiscount);

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
        }),
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

  const deduplicateAddresses = (rawList: Address[]): Address[] => {
    if (!Array.isArray(rawList)) return [];

    const sorted = [...rawList].sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0));
    const seenIds = new Set<string>();
    const seenContent = new Set<string>();
    const deduplicated: Address[] = [];

    for (const addr of sorted) {
      if (!addr || !addr.id) continue;
      if (seenIds.has(addr.id)) continue;
      seenIds.add(addr.id);

      const contentKey = `${(addr.street || '').trim().toLowerCase()}_${(addr.city || '').trim().toLowerCase()}_${(addr.zipCode || '').trim()}`;
      if (contentKey && contentKey !== '__' && seenContent.has(contentKey)) {
        continue;
      }
      if (contentKey && contentKey !== '__') {
        seenContent.add(contentKey);
      }

      deduplicated.push(addr);
    }

    return deduplicated;
  };

  const loadAddresses = () => {
    fetchWithAuth('/address').then((data) => {
      const unique = deduplicateAddresses(data);
      setAddresses(unique);

      if (unique.length > 0) {
        setSelectedAddressId((prevId) => {
          if (prevId && unique.some((a) => a.id === prevId)) {
            return prevId;
          }
          const defaultAddr = unique.find((a) => a.isDefault) || unique[0];
          return defaultAddr.id;
        });
      } else {
        setSelectedAddressId('');
      }
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
      setCurrentStep(1);
      return;
    }
    setIsProcessing(true);

    try {
      const initiatePayload: any = {
        addressId: selectedAddressId,
        paymentMethod: paymentMethod === 'ONLINE' ? 'RAZORPAY' : paymentMethod,
        timeSlot: selectedSlot,
        itemReturns: checkoutItems.map((item) => {
          const returnInfo = itemReturns[item.id];
          const isReturning = returnInfo ? returnInfo.returning : true;
          const returnQty = returnInfo ? returnInfo.quantity : item.quantity;
          return {
            productId: item.id,
            quantity: isReturning ? Math.max(0, Math.min(item.quantity, returnQty)) : 0,
          };
        }),
        additionalReturns: additionalReturns.filter((ar) => ar.brandId && ar.quantity > 0),
        promoCode: appliedPromo?.code || undefined,
        buyNowItems: checkoutItems.map((i) => ({ productId: i.id, quantity: i.quantity })),
      };

      const initiateRes = await fetchWithAuth('/checkout/initiate', {
        method: 'POST',
        body: JSON.stringify(initiatePayload),
      });

      if (initiateRes.status === 'SUCCESS') {
        toast.success('Order placed successfully. Delivery verification PIN created. View order details.');
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
            toast.success('Order placed successfully. Delivery verification PIN created. View order details.');
            localStorage.removeItem('edrops_promo');
            window.location.href = `/customer/order-success?id=${initiateRes.orderId}`;
          },
          theme: { color: '#1E88E5' },
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

  // Validation on Delivery stage before proceeding to Payment
  const handleNextStep = () => {
    if (checkoutItems.length === 0) return toast.error('Your order is empty');
    if (!selectedAddressId) return toast.error('Please select a delivery address');
    if (!selectedSlot) return toast.error('Please select a delivery slot');

    setCurrentStep(2);
  };

  const handleSelectYes = (itemId: string) => {
    const item = checkoutItems.find((i) => i.id === itemId);
    setItemReturns((prev) => ({
      ...prev,
      [itemId]: {
        returning: true,
        quantity: item ? item.quantity : 1,
      },
    }));
  };

  const handleSelectNo = (itemId: string) => {
    setPendingNoItemId(itemId);
    setShowNoReturnModal(true);
  };

  const handleConfirmNoModal = () => {
    if (pendingNoItemId) {
      setItemReturns((prev) => ({
        ...prev,
        [pendingNoItemId]: { returning: false, quantity: 0 },
      }));
    }
    setPendingNoItemId(null);
    setShowNoReturnModal(false);
  };

  const handleCancelNoModal = () => {
    if (pendingNoItemId) {
      const item = checkoutItems.find((i) => i.id === pendingNoItemId);
      setItemReturns((prev) => ({
        ...prev,
        [pendingNoItemId]: { returning: true, quantity: item ? item.quantity : 1 },
      }));
    }
    setPendingNoItemId(null);
    setShowNoReturnModal(false);
  };

  const hasJarsInOrder = checkoutItems.some((i) => i.isJar || (i.depositAmount && i.depositAmount > 0));
  const biodropsProduct = checkoutItems.find((i) => i.isJar || i.name?.toLowerCase().includes('jar')) || checkoutItems[0];
  const biodropsImage = biodropsProduct?.imageUrl || 'https://res.cloudinary.com/dhydmxcq2/image/upload/v1788954302/edrops/products/bavftfeflutqng6dokqw.png';

  if (checkoutItems.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 text-center flex flex-col items-center justify-center min-h-[70vh]">
        <div className="h-20 w-20 rounded-full bg-white border border-[#E2E8F0] shadow-xs flex items-center justify-center mb-4 text-[#64748B]">
          <Package className="h-9 w-9" />
        </div>
        <h2 className="text-[22px] font-bold text-[#0F172A]">No product selected</h2>
        <p className="mt-1.5 text-[#64748B] text-sm max-w-sm">Looks like you haven't selected a product to checkout yet.</p>
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
    allowQuantityEdit: currentStep === 1,
    onUpdateQuantity: updateCheckoutQuantity,
    onRemoveItem: removeCheckoutItem,
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-[calc(148px+env(safe-area-inset-bottom,0px))] lg:pb-12 text-[#0F172A]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        
        {/* 2-Step Header: Delivery → Payment */}
        <div className="mb-4 sm:mb-6">
          <div className="flex items-center justify-between max-w-xl mx-auto bg-white rounded-2xl border border-[#E2E8F0] p-2 sm:p-3 shadow-xs">
            <button
              onClick={() => setCurrentStep(1)}
              className={`flex-1 flex items-center justify-center gap-2 py-1.5 px-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                currentStep === 1
                  ? 'bg-[#1E88E5] text-white shadow-xs'
                  : 'text-[#1E88E5] hover:bg-[#EBF5FB]'
              }`}
            >
              {currentStep > 1 ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              ) : (
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${currentStep === 1 ? 'bg-white text-[#1E88E5]' : 'bg-[#E2E8F0] text-[#64748B]'}`}>
                  1
                </span>
              )}
              <span className="truncate">Delivery</span>
            </button>

            <span className="text-[#CBD5E1] px-2 font-bold">›</span>

            <div
              className={`flex-1 flex items-center justify-center gap-2 py-1.5 px-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                currentStep === 2
                  ? 'bg-[#1E88E5] text-white shadow-xs'
                  : 'text-[#64748B]'
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${currentStep === 2 ? 'bg-white text-[#1E88E5]' : 'bg-[#E2E8F0] text-[#64748B]'}`}>
                2
              </span>
              <span className="truncate">Payment</span>
            </div>
          </div>
        </div>

        {/* Two-Column Grid (Desktop) / Single-Column (Mobile) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start w-full">
          
          {/* LEFT COLUMN: Active Step Content (~60-65% width on desktop) */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-4">
            
            {/* Mobile Order Summary Card with Quantity Controls (Visible on mobile on Delivery stage) */}
            {currentStep === 1 && (
              <div className="lg:hidden mb-4">
                <CheckoutOrderSummary {...orderSummaryProps} />
              </div>
            )}

            <AnimatePresence mode="wait">
              {/* STAGE 1: DELIVERY */}
              {currentStep === 1 && (
                <motion.div
                  key="step1-delivery"
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
                          <div
                            key={addr.id}
                            onClick={() => setSelectedAddressId(addr.id)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setSelectedAddressId(addr.id);
                              }
                            }}
                            className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all relative ${
                              selectedAddressId === addr.id
                                ? 'border-[#1E88E5] bg-[#EBF5FB]/60 ring-1 ring-[#1E88E5]'
                                : 'border-[#E2E8F0] bg-white hover:border-slate-300'
                            }`}
                          >
                            <div className={`mt-0.5 flex items-center justify-center w-4 h-4 rounded-full border shrink-0 transition-colors ${
                              selectedAddressId === addr.id ? 'border-[#1E88E5] bg-[#1E88E5]' : 'border-[#CBD5E1] bg-white'
                            }`}>
                              {selectedAddressId === addr.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                            </div>
                            <div className="flex-1 min-w-0 pr-8">
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
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleDeleteAddress(e, addr.id);
                              }}
                              className="absolute right-2 top-2 p-1.5 text-[#94A3B8] hover:text-rose-500 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                              title="Delete address"
                              aria-label="Delete address"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
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

                  {/* Return Empty Jars Section */}
                  <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#E2E8F0] shadow-xs">
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#F1F5F9]">
                      <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-[#1E88E5]" />
                        Return Empty Jars (Deposit Waiver)
                      </h3>
                    </div>

                    {hasJarsInOrder ? (
                      <div className="space-y-3 pt-1">
                        {checkoutItems.filter((i) => i.isJar || (i.depositAmount && i.depositAmount > 0)).map((item) => {
                          const returnInfo = itemReturns[item.id];
                          const isReturning = returnInfo ? returnInfo.returning : true;
                          const currentReturnQty = returnInfo ? returnInfo.quantity : item.quantity;

                          return (
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
                                    checked={isReturning}
                                    onChange={() => handleSelectYes(item.id)}
                                    className="w-3.5 h-3.5 text-[#1E88E5]"
                                  />
                                  <span>Yes</span>
                                </label>
                                <label className="flex items-center gap-1.5 text-xs font-bold text-[#334155] cursor-pointer">
                                  <input
                                    type="radio"
                                    name={`return_${item.id}`}
                                    checked={!isReturning}
                                    onChange={() => handleSelectNo(item.id)}
                                    className="w-3.5 h-3.5 text-[#1E88E5]"
                                  />
                                  <span>No</span>
                                </label>

                                {isReturning && (
                                  <div className="ml-auto flex items-center bg-white border border-[#E2E8F0] rounded-lg overflow-hidden h-7 w-24 shadow-2xs">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setItemReturns((prev) => ({
                                          ...prev,
                                          [item.id]: {
                                            returning: true,
                                            quantity: Math.max(0, currentReturnQty - 1),
                                          },
                                        }))
                                      }
                                      className="w-7 h-full flex items-center justify-center text-[#64748B] hover:bg-[#F8FAFC]"
                                      aria-label="Decrease return jars"
                                    >
                                      <Minus className="w-3 h-3" />
                                    </button>
                                    <span className="flex-1 text-center text-xs font-bold text-[#0F172A]">
                                      {currentReturnQty}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setItemReturns((prev) => ({
                                          ...prev,
                                          [item.id]: {
                                            returning: true,
                                            quantity: Math.min(item.quantity, currentReturnQty + 1),
                                          },
                                        }))
                                      }
                                      className="w-7 h-full flex items-center justify-center text-[#64748B] hover:bg-[#F8FAFC]"
                                      aria-label="Increase return jars"
                                    >
                                      <Plus className="w-3 h-3" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-[#64748B] py-1">
                        No 20L jars in today's order. You can still return other empty jars below if needed.
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

                  {/* Desktop Navigation Row (hidden on mobile to prevent duplicate buttons) */}
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
                      Continue to Payment →
                    </button>
                  </div>
                </motion.div>
              )}

              {/* STAGE 2: PAYMENT */}
              {currentStep === 2 && (
                <motion.div
                  key="step2-payment"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                  className="space-y-4"
                >
                  {/* Mobile Preview of Final Order Summary (Read-only on Payment) */}
                  <div className="lg:hidden mb-4">
                    <CheckoutOrderSummary {...orderSummaryProps} allowQuantityEdit={false} />
                  </div>

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

                  {/* Desktop Navigation Row (hidden on mobile to prevent duplicate buttons) */}
                  <div className="hidden lg:flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(1)}
                      className="px-4 py-2.5 rounded-xl bg-white border border-[#E2E8F0] text-[#64748B] font-semibold text-xs hover:bg-[#F8FAFC] hover:text-[#0F172A] transition-colors cursor-pointer"
                    >
                      ← Back to Delivery
                    </button>
                    <button
                      type="button"
                      onClick={handleCheckout}
                      disabled={isProcessing}
                      className="px-8 py-2.5 rounded-xl bg-[#1E88E5] text-white font-bold text-sm shadow-xs hover:bg-[#1565C0] transition-colors cursor-pointer disabled:opacity-70 flex items-center justify-center min-w-[170px]"
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

      {/* MOBILE STICKY BOTTOM BAR (<1024px) - Positioned above mobile bottom nav */}
      <div className="lg:hidden fixed bottom-[calc(68px+env(safe-area-inset-bottom,0px))] inset-x-0 z-30 bg-white border-t border-[#E2E8F0] px-3.5 py-2.5 shadow-[0_-4px_16px_rgba(15,23,42,0.06)]">
        <div className="flex items-center justify-between gap-2.5 max-w-md mx-auto">
          {/* Collapsed Total with View Details Trigger */}
          <button
            type="button"
            onClick={() => setMobileSummaryOpen(!mobileSummaryOpen)}
            className="flex flex-col text-left cursor-pointer group shrink-0"
          >
            <span className="text-[10px] sm:text-[11px] font-semibold text-[#64748B] flex items-center gap-0.5 group-hover:text-[#1E88E5]">
              Total Payable {mobileSummaryOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
            </span>
            <span className="text-base sm:text-lg font-black text-[#1E88E5]">
              ₹{grandTotal}
            </span>
          </button>

          {/* Stage Single Primary Action */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-1 justify-end min-w-0">
            {currentStep === 2 && (
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="h-10 px-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#64748B] font-bold text-xs active:bg-[#E2E8F0] transition-colors cursor-pointer shrink-0"
                aria-label="Back to Delivery"
                title="Back to Delivery"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}

            {currentStep === 1 ? (
              <button
                type="button"
                onClick={handleNextStep}
                className="h-10 px-3.5 sm:px-5 rounded-xl bg-[#1E88E5] text-white font-bold text-xs sm:text-sm shadow-xs active:bg-[#1565C0] transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5 w-full max-w-[210px]"
              >
                <span>Continue to Payment</span>
                <span className="text-white/80">→</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCheckout}
                disabled={isProcessing}
                className="h-10 px-3.5 sm:px-5 rounded-xl bg-[#1E88E5] text-white font-bold text-xs sm:text-sm shadow-xs active:bg-[#1565C0] transition-colors cursor-pointer disabled:opacity-70 flex items-center justify-center gap-1.5 whitespace-nowrap w-full max-w-[210px]"
              >
                {isProcessing ? (
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Pay ₹{grandTotal}</span>
                    <span className="text-white/80">→</span>
                  </>
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

      {/* Empty Jar Return Confirmation Dialog with Biodrops Image */}
      <AnimatePresence>
        {showNoReturnModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowNoReturnModal(false)}
              className="absolute inset-0"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="relative z-10 bg-white rounded-2xl border border-[#E2E8F0] shadow-2xl p-6 max-w-sm w-full mx-auto text-center"
            >
              {/* Biodrops Product Image */}
              <div className="w-24 h-24 sm:w-28 sm:h-28 mx-auto rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] p-2 flex items-center justify-center mb-4 shadow-xs overflow-hidden">
                <img
                  src={biodropsImage}
                  alt={biodropsProduct?.name || 'Biodrops 20L Jar'}
                  className="w-full h-full object-contain"
                />
              </div>

              <h3 className="text-base sm:text-lg font-bold text-[#0F172A] mb-2">
                Empty Jar Return
              </h3>
              <p className="text-xs sm:text-sm text-[#64748B] leading-relaxed mb-6 font-medium">
                Are you sure you want to continue without returning this item?
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 w-full">
                <button
                  type="button"
                  onClick={handleCancelNoModal}
                  className="w-full sm:flex-1 py-2.5 px-4 rounded-xl border border-[#CBD5E1] bg-white text-[#0F172A] hover:bg-[#F8FAFC] text-xs sm:text-sm font-bold transition-colors cursor-pointer"
                >
                  No, Return Item
                </button>
                <button
                  type="button"
                  onClick={handleConfirmNoModal}
                  className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-[#1E88E5] text-white hover:bg-[#1565C0] text-xs sm:text-sm font-bold transition-colors cursor-pointer shadow-xs"
                >
                  Yes, Continue
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
