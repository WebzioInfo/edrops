import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useCartStore from '../../store/useCartStore';
import ClayCard from '../../components/shop/ui/ClayCard';
import ClayButton from '../../components/shop/ui/ClayButton';
import { MapPin, Clock, CreditCard, CheckCircle2, ArrowLeft, Plus, Ticket, X } from 'lucide-react';
import { useMyAddresses, usePlaceOrder, useValidatePromo, useWallet, api } from '../../lib/shopApi';

declare global {
  interface Window {
    Razorpay: any;
  }
}

const DELIVERY_SLOTS = [
  { id: 'morning', label: 'Morning', time: '6 AM – 10 AM', available: true },
  { id: 'afternoon', label: 'Afternoon', time: '11 AM – 2 PM', available: true },
  { id: 'evening', label: 'Evening', time: '4 PM – 7 PM', available: true },
];

function loadRazorpay() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function Checkout() {
  const { items, cartTotal, clearCart } = useCartStore() as any;
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);

  // Form state
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');

  // Data
  const { data: addresses = [], isLoading: addrLoading } = useMyAddresses();
  const { data: wallet } = useWallet();
  const placeOrder = usePlaceOrder();
  const validatePromo = useValidatePromo();

  // Promo State
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<any>(null);
  const [promoError, setPromoError] = useState('');

  const baseTotal = cartTotal();
  const discountAmount = appliedPromo ? appliedPromo.discountAmount : 0;
  const finalTotal = baseTotal - discountAmount;

  const walletBalance = Number(wallet?.balance ?? 0);
  const canPayWithWallet = walletBalance >= finalTotal;

  const handleApplyPromo = async () => {
    setPromoError('');
    if (!promoInput) return;
    try {
      const result = await validatePromo.mutateAsync({ code: promoInput, orderAmount: baseTotal });
      if (result.isValid) {
        setAppliedPromo({ code: promoInput, discountAmount: result.discountAmount });
      }
    } catch (err: any) {
      setPromoError(err.response?.data?.message || 'Invalid promo code');
    }
  };

  const removePromo = () => {
    setAppliedPromo(null);
    setPromoInput('');
    setPromoError('');
  };

  // ─── Success Screen ───────────────────────────
  if (orderPlaced) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center gap-6 px-6">
        <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 className="w-14 h-14 text-green-500" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Order Confirmed!</h2>
          <p className="text-muted-foreground">Your water is on its way. 💧</p>
          {placedOrderId && (
            <p className="text-xs text-muted-foreground">
              Order #{placedOrderId.slice(-8).toUpperCase()}
            </p>
          )}
        </div>
        <ClayButton onClick={() => navigate('/orders')} className="px-8">
          Track Order
        </ClayButton>
      </div>
    );
  }

  // ─── Empty Cart Guard ─────────────────────────
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-4">
        <p className="text-xl font-bold">Your cart is empty</p>
        <ClayButton onClick={() => navigate('/')}>Browse Products</ClayButton>
      </div>
    );
  }

  // ─── Place Order Handler ──────────────────────
  const handlePlaceOrder = async () => {
    const orderData = {
      addressId: selectedAddressId,
      promoCode: appliedPromo ? appliedPromo.code : undefined,
      paymentMethod:
        paymentMethod === 'cod' ? 'CASH' :
          paymentMethod === 'wallet' ? 'WALLET' :
            'RAZORPAY',
      notes: `Slot: ${selectedSlot}`,
      items: items.map((i: any) => ({ productId: i.id, quantity: i.quantity })),
    };

    if (paymentMethod === 'razorpay') {
      // First create the E-Drops order, then open Razorpay
      const order = await placeOrder.mutateAsync({ ...orderData, paymentMethod: 'RAZORPAY' });
      await handleRazorpayCheckout(order.id);
      return;
    }

    placeOrder.mutate(orderData, {
      onSuccess: (order) => {
        setPlacedOrderId(order.id);
        clearCart();
        setOrderPlaced(true);
      },
      onError: (err: any) => {
        alert(err.response?.data?.message || 'Failed to place order. Please try again.');
      },
    });
  };

  const handleRazorpayCheckout = async (orderId: string) => {
    const loaded = await loadRazorpay();
    if (!loaded) {
      alert('Failed to load Razorpay. Please check your internet connection.');
      return;
    }

    try {
      // 1. Create Razorpay order on our backend
      const rzpData = await api.post(`/payments/razorpay/create/${orderId}`).then(r => r.data);

      const options = {
        key: rzpData.key,
        amount: rzpData.amount,
        currency: rzpData.currency,
        name: rzpData.name,
        description: rzpData.description,
        order_id: rzpData.razorpayOrderId,
        handler: async (response: any) => {
          try {
            // 2. Verify payment on our backend
            await api.post('/payments/razorpay/verify', {
              orderId,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });

            // 3. Success!
            clearCart();
            setPlacedOrderId(orderId);
            setOrderPlaced(true);
          } catch (err: any) {
            alert('Payment verification failed! Please contact support.');
            console.error(err);
          }
        },
        modal: {
          ondismiss: () => {
            console.log('Razorpay modal closed');
          }
        },
        theme: { color: '#4F8CFF' },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err: any) {
      alert('Failed to initialize payment. Please try again.');
      console.error(err);
    }
  };

  const STEPS = [
    { id: 1, icon: MapPin, label: 'Address' },
    { id: 2, icon: Clock, label: 'Slot' },
    { id: 3, icon: CreditCard, label: 'Payment' },
  ];

  return (
    <div className="space-y-5 pb-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => step > 1 ? setStep(s => s - 1) : navigate(-1)}
          className="w-9 h-9 clay-card flex items-center justify-center"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h2 className="text-xl font-bold">Checkout</h2>
      </div>

      {/* Step Progress */}
      <div className="flex items-center">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all
                ${step >= s.id ? 'bg-primary text-primary-foreground shadow-lg' : 'bg-card text-muted-foreground'}`}
                style={{ boxShadow: step >= s.id ? '0 4px 12px rgba(79,140,255,0.35)' : undefined }}
              >
                <s.icon className="w-5 h-5" />
              </div>
              <span className={`text-[10px] mt-1 font-medium ${step >= s.id ? 'text-primary' : 'text-muted-foreground'}`}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-0.5 flex-1 mx-1 mb-4 transition-colors ${step > s.id ? 'bg-primary' : 'bg-border'}`} />
            )}
          </div>
        ))}
      </div>

      {/* ─── STEP 1: Address ─── */}
      {step === 1 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-lg ml-1">Delivery Address</h3>
          {addrLoading ? (
            <div className="clay-card animate-pulse h-20" />
          ) : addresses.length === 0 ? (
            <ClayCard className="text-center py-6">
              <p className="text-muted-foreground text-sm mb-3">No saved addresses.</p>
              <button onClick={() => navigate('/profile')} className="text-primary text-sm font-semibold flex items-center gap-1 mx-auto">
                <Plus className="w-4 h-4" /> Add Address in Profile
              </button>
            </ClayCard>
          ) : (
            addresses.map((addr: any) => (
              <ClayCard
                key={addr.id}
                className={`cursor-pointer transition-all ${selectedAddressId === addr.id ? 'border-2 border-primary bg-primary/5' : ''}`}
                onClick={() => setSelectedAddressId(addr.id)}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-lg">
                      {addr.label}
                    </span>
                    <p className="text-sm font-medium mt-2">{addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{addr.city}, {addr.district} – {addr.pincode}</p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 mt-1 flex items-center justify-center shrink-0
                    ${selectedAddressId === addr.id ? 'border-primary' : 'border-muted'}`}>
                    {selectedAddressId === addr.id && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                  </div>
                </div>
              </ClayCard>
            ))
          )}
          <ClayButton className="w-full" onClick={() => setStep(2)} disabled={!selectedAddressId}>
            Continue
          </ClayButton>
        </div>
      )}

      {/* ─── STEP 2: Slot ─── */}
      {step === 2 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-lg ml-1">Delivery Slot</h3>
          <div className="grid grid-cols-1 gap-3">
            {DELIVERY_SLOTS.map((slot: any) => (
              <ClayCard
                key={slot.id}
                className={`cursor-pointer transition-all ${selectedSlot === slot.id ? 'border-2 border-primary bg-primary/5' : ''}`}
                onClick={() => setSelectedSlot(slot.id)}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-semibold">{slot.label}</p>
                    <p className="text-sm text-muted-foreground">{slot.time}</p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center
                    ${selectedSlot === slot.id ? 'border-primary' : 'border-muted'}`}>
                    {selectedSlot === slot.id && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                  </div>
                </div>
              </ClayCard>
            ))}
          </div>
          <ClayButton className="w-full" onClick={() => setStep(3)} disabled={!selectedSlot}>
            Continue to Payment
          </ClayButton>
        </div>
      )}

      {/* ─── STEP 3: Payment ─── */}
      {step === 3 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-lg ml-1">Payment Method</h3>

          {[
            {
              id: 'cod',
              label: 'Cash on Delivery',
              desc: 'Pay when you receive',
              available: true,
            },
            {
              id: 'razorpay',
              label: 'Razorpay (UPI / Card)',
              desc: 'Pay securely online',
              available: true,
            },
            {
              id: 'wallet',
              label: 'E-Drops Wallet',
              desc: canPayWithWallet
                ? `Balance: ₹${walletBalance}`
                : `Insufficient balance (₹${walletBalance}) – need ₹${finalTotal}`,
              available: canPayWithWallet,
            },
          ].map((method) => (
            <ClayCard
              key={method.id}
              className={`cursor-pointer transition-all
                ${!method.available ? 'opacity-50 cursor-not-allowed' : ''}
                ${paymentMethod === method.id ? 'border-2 border-primary bg-primary/5' : ''}`}
              onClick={() => method.available && setPaymentMethod(method.id)}
            >
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="font-semibold text-sm">{method.label}</h4>
                  <p className={`text-xs mt-0.5 ${!method.available ? 'text-red-500' : 'text-muted-foreground'}`}>
                    {method.desc}
                  </p>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center
                  ${paymentMethod === method.id ? 'border-primary' : 'border-muted'}`}>
                  {paymentMethod === method.id && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                </div>
              </div>
            </ClayCard>
          ))}

          {/* Promo Code Input */}
          <ClayCard className="bg-primary/5">
            <h4 className="font-semibold mb-3 text-sm flex items-center gap-2">
              <Ticket size={16} className="text-primary" /> Have a Promo Code?
            </h4>

            {!appliedPromo ? (
              <div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter code"
                    value={promoInput}
                    onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                    className="clay-input flex-1 uppercase"
                  />
                  <ClayButton
                    onClick={handleApplyPromo}
                    disabled={validatePromo.isPending || !promoInput}
                    className="px-4 py-2 text-sm"
                  >
                    {validatePromo.isPending ? '...' : 'Apply'}
                  </ClayButton>
                </div>
                {promoError && <p className="text-xs text-red-500 mt-2 ml-1">{promoError}</p>}
              </div>
            ) : (
              <div className="flex justify-between items-center bg-green-100 text-green-800 p-3 rounded-xl border border-green-200">
                <div className="flex flex-col">
                  <span className="text-sm font-bold flex items-center gap-1"><CheckCircle2 size={14} /> {appliedPromo.code} Applied</span>
                  <span className="text-xs">You saved ₹{appliedPromo.discountAmount}</span>
                </div>
                <button onClick={removePromo} className="p-1 hover:bg-green-200 rounded-lg transition-colors">
                  <X size={16} />
                </button>
              </div>
            )}
          </ClayCard>

          {/* Order Summary */}
          <ClayCard className="bg-primary/5">
            <h4 className="font-semibold mb-3 text-sm">Order Summary</h4>
            {items.map((item: any) => (
              <div key={item.id} className="flex justify-between text-sm mb-1.5">
                <span className="text-muted-foreground">{item.name} ×{item.quantity}</span>
                <span>₹{item.price * item.quantity}</span>
              </div>
            ))}

            {appliedPromo && (
              <div className="flex justify-between text-sm mb-1.5 text-green-600 font-medium">
                <span>Promo Discount ({appliedPromo.code})</span>
                <span>-₹{appliedPromo.discountAmount}</span>
              </div>
            )}

            <div className="border-t border-primary/20 mt-2 pt-2 flex justify-between font-bold text-base">
              <span>Total</span>
              <span className="text-primary">₹{finalTotal}</span>
            </div>
          </ClayCard>

          <ClayButton
            className="w-full text-base py-4"
            onClick={handlePlaceOrder}
            disabled={!paymentMethod || placeOrder.isPending}
          >
            {placeOrder.isPending ? 'Placing Order...' : `Confirm & Pay ₹${finalTotal}`}
          </ClayButton>
        </div>
      )}
    </div>
  );
}
