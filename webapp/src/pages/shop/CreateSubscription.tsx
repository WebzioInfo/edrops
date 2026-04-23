import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProducts, useBrands, useMyAddresses, useCreateSubscription } from '../../lib/shopApi';
import { useWallet } from '../../lib/shopApi';
import ClayCard from '../../components/shop/ui/ClayCard';
import ClayButton from '../../components/shop/ui/ClayButton';
import { ArrowLeft, ArrowRight, CalendarCheck, Package, MapPin, Wallet } from 'lucide-react';

const FREQUENCIES = [
  { value: 'DAILY',          label: 'Daily',           desc: 'Every day' },
  { value: 'ALTERNATE_DAYS', label: 'Alternate Days',  desc: 'Every 2 days' },
  { value: 'WEEKLY',         label: 'Weekly',          desc: 'Once a week' },
];

export default function CreateSubscription() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  // Form state
  const [selectedItems, setSelectedItems] = useState({}); // { productId: quantity }
  const [frequency, setFrequency] = useState('DAILY');
  const [startDate, setStartDate] = useState(
    new Date(Date.now() + 86400000).toISOString().split('T')[0] // Tomorrow
  );
  const [selectedAddressId, setSelectedAddressId] = useState('');

  // Data
  const { data: brands = [] } = useBrands();
  const [activeBrand, setActiveBrand] = useState(null);
  const { data: products = [], isLoading: productsLoading } = useProducts(activeBrand);
  const { data: addresses = [], isLoading: addressesLoading } = useMyAddresses();
  const { data: wallet } = useWallet();

  const createSubscription = useCreateSubscription();

  // Computed values
  const selectedProducts = products.filter((p) => selectedItems[p.id] > 0);
  const totalAmount = selectedProducts.reduce(
    (sum, p) => sum + Number(p.price) * (selectedItems[p.id] || 0),
    0
  );
  const walletBalance = Number(wallet?.balance ?? 0);
  const hasSufficientBalance = walletBalance >= totalAmount;
  const hasItems = Object.values(selectedItems).some((q) => q > 0);

  const handleQuantityChange = (productId, delta) => {
    setSelectedItems((prev) => {
      const curr = prev[productId] || 0;
      const next = Math.max(0, curr + delta);
      return { ...prev, [productId]: next };
    });
  };

  const handleSubmit = async () => {
    const items = Object.entries(selectedItems)
      .filter(([, qty]) => qty > 0)
      .map(([productId, quantity]) => ({ productId, quantity }));

    createSubscription.mutate(
      { frequency, startDate, addressId: selectedAddressId, items },
      {
        onSuccess: () => navigate('/subscriptions'),
        onError: (err) => alert(err.response?.data?.message || 'Failed to create subscription'),
      }
    );
  };

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => (step > 1 ? setStep(s => s - 1) : navigate(-1))}
          className="w-9 h-9 clay-card flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h2 className="text-xl font-bold">New Subscription</h2>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-1">
        {[
          { n: 1, icon: Package,      label: 'Products' },
          { n: 2, icon: CalendarCheck, label: 'Schedule' },
          { n: 3, icon: MapPin,        label: 'Address' },
        ].map(({ n, icon: Icon, label }) => (
          <div key={n} className="flex items-center flex-1">
            <div className={`flex flex-col items-center flex-1 ${n < 3 ? 'relative' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors
                ${step >= n ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground'}`}>
                <Icon className="w-4 h-4" />
              </div>
              <span className={`text-[10px] mt-1 font-medium ${step >= n ? 'text-primary' : 'text-muted-foreground'}`}>
                {label}
              </span>
            </div>
            {n < 3 && (
              <div className={`h-0.5 flex-1 mx-1 mb-4 transition-colors ${step > n ? 'bg-primary' : 'bg-border'}`} />
            )}
          </div>
        ))}
      </div>

      {/* ─── STEP 1: Products ─── */}
      {step === 1 && (
        <div className="space-y-4">
          {/* Brand filter */}
          {brands.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-none">
              <button onClick={() => setActiveBrand(null)}
                className={`flex-shrink-0 px-4 py-1.5 rounded-2xl text-sm font-medium transition-all
                  ${!activeBrand ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground'}`}>
                All
              </button>
              {brands.map((b) => (
                <button key={b.id} onClick={() => setActiveBrand(b.id)}
                  className={`flex-shrink-0 px-4 py-1.5 rounded-2xl text-sm font-medium transition-all
                    ${activeBrand === b.id ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground'}`}>
                  {b.name}
                </button>
              ))}
            </div>
          )}

          {productsLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => <div key={i} className="clay-card animate-pulse h-16" />)}
            </div>
          ) : (
            <div className="space-y-2">
              {products.map((product) => {
                const qty = selectedItems[product.id] || 0;
                return (
                  <ClayCard key={product.id} className="flex items-center gap-4 p-3">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {product.imageUrl
                        ? <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                        : <Package className="w-6 h-6 text-primary/40" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm leading-tight line-clamp-1">{product.name}</p>
                      <p className="text-xs text-primary font-bold mt-0.5">₹{Number(product.price)}/delivery</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => handleQuantityChange(product.id, -1)}
                        className="w-7 h-7 rounded-lg bg-card flex items-center justify-center font-bold text-lg leading-none"
                        style={{ boxShadow: '2px 2px 4px #d1d9e6, -2px -2px 4px #ffffff' }}>
                        −
                      </button>
                      <span className="w-5 text-center font-bold text-sm">{qty}</span>
                      <button onClick={() => handleQuantityChange(product.id, 1)}
                        className="w-7 h-7 rounded-lg bg-primary text-white flex items-center justify-center font-bold text-lg leading-none"
                        style={{ boxShadow: '2px 2px 4px #d1d9e6, -2px -2px 4px #ffffff' }}>
                        +
                      </button>
                    </div>
                  </ClayCard>
                );
              })}
            </div>
          )}

          {/* Summary + Next */}
          {hasItems && (
            <ClayCard className="bg-primary/5 border-primary/20">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm text-muted-foreground">Daily Cost</span>
                <span className="font-bold text-primary text-lg">₹{totalAmount}</span>
              </div>
              <ClayButton className="w-full gap-2" onClick={() => setStep(2)}>
                Continue <ArrowRight className="w-4 h-4" />
              </ClayButton>
            </ClayCard>
          )}
        </div>
      )}

      {/* ─── STEP 2: Schedule ─── */}
      {step === 2 && (
        <div className="space-y-4">
          <h3 className="font-semibold text-lg">Choose Frequency</h3>
          <div className="space-y-3">
            {FREQUENCIES.map((f) => (
              <ClayCard
                key={f.value}
                className={`cursor-pointer transition-all ${frequency === f.value ? 'border-2 border-primary bg-primary/5' : ''}`}
                onClick={() => setFrequency(f.value)}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-semibold">{f.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{f.desc}</p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center
                    ${frequency === f.value ? 'border-primary' : 'border-muted'}`}>
                    {frequency === f.value && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                  </div>
                </div>
              </ClayCard>
            ))}
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Start Date</label>
            <input
              type="date"
              value={startDate}
              min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
              onChange={(e) => setStartDate(e.target.value)}
              className="clay-input"
            />
          </div>

          {/* Wallet check */}
          <ClayCard className={hasSufficientBalance ? 'bg-green-50' : 'bg-red-50'}>
            <div className="flex items-center gap-2">
              <Wallet className={`w-4 h-4 ${hasSufficientBalance ? 'text-green-600' : 'text-red-500'}`} />
              <div>
                <p className="text-sm font-semibold">Wallet Balance: ₹{walletBalance}</p>
                <p className={`text-xs mt-0.5 ${hasSufficientBalance ? 'text-green-600' : 'text-red-500'}`}>
                  {hasSufficientBalance
                    ? `✓ Sufficient for delivery (₹${totalAmount})`
                    : `⚠️ Insufficient — top up ₹${(totalAmount - walletBalance).toFixed(0)} before first delivery`}
                </p>
              </div>
            </div>
          </ClayCard>

          <ClayButton className="w-full gap-2" onClick={() => setStep(3)}>
            Continue <ArrowRight className="w-4 h-4" />
          </ClayButton>
        </div>
      )}

      {/* ─── STEP 3: Address ─── */}
      {step === 3 && (
        <div className="space-y-4">
          <h3 className="font-semibold text-lg">Delivery Address</h3>

          {addressesLoading ? (
            <div className="clay-card animate-pulse h-20" />
          ) : addresses.length === 0 ? (
            <ClayCard className="text-center py-8">
              <p className="text-muted-foreground text-sm">No addresses saved.</p>
              <p className="text-xs text-muted-foreground mt-1">Add one in your Profile.</p>
            </ClayCard>
          ) : (
            <div className="space-y-3">
              {addresses.map((addr) => (
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
                      <p className="text-sm mt-2">{addr.line1}, {addr.city}</p>
                      <p className="text-xs text-muted-foreground">{addr.district} - {addr.pincode}</p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 mt-1 flex items-center justify-center
                      ${selectedAddressId === addr.id ? 'border-primary' : 'border-muted'}`}>
                      {selectedAddressId === addr.id && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                    </div>
                  </div>
                </ClayCard>
              ))}
            </div>
          )}

          {/* Order summary */}
          {selectedAddressId && (
            <ClayCard className="bg-primary/5">
              <h4 className="font-semibold mb-3">Summary</h4>
              {selectedProducts.map((p) => (
                <div key={p.id} className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">{p.name} ×{selectedItems[p.id]}</span>
                  <span>₹{Number(p.price) * selectedItems[p.id]}</span>
                </div>
              ))}
              <div className="border-t border-primary/20 mt-2 pt-2 flex justify-between font-bold">
                <span>Per delivery</span>
                <span className="text-primary">₹{totalAmount}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Starts {new Date(startDate).toLocaleDateString('en-IN', {
                  weekday: 'short', day: 'numeric', month: 'short',
                })} · {FREQUENCIES.find(f => f.value === frequency)?.label}
              </p>
            </ClayCard>
          )}

          <ClayButton
            className="w-full"
            onClick={handleSubmit}
            disabled={!selectedAddressId || createSubscription.isPending}
          >
            {createSubscription.isPending ? 'Creating...' : 'Confirm Subscription'}
          </ClayButton>
        </div>
      )}
    </div>
  );
}
