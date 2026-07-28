import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { fetchWithAuth } from '../../../api/client';
import { Search, UserPlus, ShoppingCart, Plus, Minus, CreditCard, Wallet, Banknote, CheckCircle, Package } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from '../../../components/LoadingSpinner';

export default function CreateOrderPOS() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  
  // Product Selection
  const [cartItems, setCartItems] = useState<{product: any, qty: number}[]>([]);
  
  // Payment
  const [paymentMethod, setPaymentMethod] = useState<'COD' | 'WALLET' | 'ONLINE' | 'HYBRID'>('COD');
  const [hybridSecondaryMethod, setHybridSecondaryMethod] = useState<'CASH' | 'CARD' | 'ONLINE'>('CASH');
  
  // Overrides (Admin only)
  const [waiveDeposit, setWaiveDeposit] = useState(false);
  const [waiveDelivery, setWaiveDelivery] = useState(false);
  const [customDiscount, setCustomDiscount] = useState<number>(0);
  const [adminNotes, setAdminNotes] = useState('');

  // Step Control
  const [step, setStep] = useState<1|2|3>(1);

  // Queries
  const { data: customers = [], isLoading: isSearching } = useQuery({
    queryKey: ['adminCustomerSearch', searchQuery],
    queryFn: () => fetchWithAuth(`/admin/customers/search?q=${searchQuery}`),
    enabled: searchQuery.length > 2,
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => fetchWithAuth('/product'),
  });

  const { data: activeWallet } = useQuery({
    queryKey: ['wallet', selectedCustomer?.id],
    queryFn: () => fetchWithAuth(`/admin/customers/${selectedCustomer?.id}`),
    enabled: !!selectedCustomer,
    select: (data) => data?.wallet,
  });

  const { data: validationParams } = useQuery({
    queryKey: ['checkoutValidation', selectedCustomer?.id, cartItems, waiveDeposit, waiveDelivery, customDiscount],
    queryFn: async () => {
      if (!selectedCustomer || cartItems.length === 0) return null;
      return fetchWithAuth(`/admin/checkout/${selectedCustomer.id}/validate`, {
        method: 'POST',
        body: JSON.stringify({
          buyNowItems: cartItems.map(c => ({ productId: c.product.id, quantity: c.qty })),
          adminOverride: {
            waiveDeposit,
            waiveDelivery,
            customDiscount: customDiscount > 0 ? customDiscount : undefined,
            adminNotes
          }
        }),
      });
    },
    enabled: !!selectedCustomer && cartItems.length > 0,
  });

  const placeOrderMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCustomer || !validationParams) throw new Error('Missing data');
      const addressId = selectedCustomer.addresses?.[0]?.id; // Just pick first or fallback
      
      return fetchWithAuth(`/admin/checkout/${selectedCustomer.id}/initiate`, {
        method: 'POST',
        body: JSON.stringify({
          addressId: addressId || 'dummy-if-walkin', // Might need better address handling
          paymentMethod: paymentMethod === 'ONLINE' ? 'RAZORPAY' : paymentMethod,
          hybridSecondaryMethod: paymentMethod === 'HYBRID' ? hybridSecondaryMethod : undefined,
          buyNowItems: cartItems.map(c => ({ productId: c.product.id, quantity: c.qty })),
          orderSource: 'PHONE_ORDER', // or WALK_IN
          adminOverride: {
            waiveDeposit,
            waiveDelivery,
            customDiscount: customDiscount > 0 ? customDiscount : undefined,
            adminNotes
          }
        })
      });
    },
    onSuccess: (res) => {
      alert('Order Placed Successfully! ID: ' + res.id);
      navigate('/admin/orders');
    }
  });

  const handleProductAdd = (product: any) => {
    setCartItems(prev => {
      const existing = prev.find(p => p.product.id === product.id);
      if (existing) {
        return prev.map(p => p.product.id === product.id ? { ...p, qty: p.qty + 1 } : p);
      }
      return [...prev, { product, qty: 1 }];
    });
  };

  const handleProductUpdate = (product: any, delta: number) => {
    setCartItems(prev => {
      return prev.map(p => {
        if (p.product.id === product.id) {
          const newQty = Math.max(0, p.qty + delta);
          return { ...p, qty: newQty };
        }
        return p;
      }).filter(p => p.qty > 0);
    });
  };

  const createWalkInMutation = useMutation({
    mutationFn: async (phone: string) => {
      return fetchWithAuth('/admin/customers/walk-in', {
        method: 'POST',
        body: JSON.stringify({ phone, firstName: 'Walk-in', lastName: 'Customer' })
      });
    },
    onSuccess: (data) => {
      setSelectedCustomer(data);
      setStep(2);
    }
  });

  return (
    <div className="max-w-6xl mx-auto p-6 animate-fade-in">
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Rapid POS Terminal</h1>
          <p className="text-slate-500 font-semibold mt-1">Create phone orders or walk-in orders in seconds.</p>
        </div>
        <div className="flex gap-2">
          <div className={`w-8 h-2 rounded-full ${step >= 1 ? 'bg-[#2D79A8]' : 'bg-slate-200'}`} />
          <div className={`w-8 h-2 rounded-full ${step >= 2 ? 'bg-[#2D79A8]' : 'bg-slate-200'}`} />
          <div className={`w-8 h-2 rounded-full ${step >= 3 ? 'bg-[#2D79A8]' : 'bg-slate-200'}`} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Work Area */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* STEP 1: CUSTOMER */}
          {step === 1 && (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 p-6">
              <h2 className="text-xl font-black text-slate-800 flex items-center gap-2 mb-6">
                <Search className="w-5 h-5 text-[#2D79A8]" />
                Select Customer
              </h2>
              <input 
                type="text"
                placeholder="Search by Phone, Name, Email..."
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-semibold text-lg outline-none focus:ring-2 focus:ring-[#2D79A8]/20 transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
              
              <div className="mt-4 space-y-2 max-h-[400px] overflow-y-auto">
                {isSearching ? <div className="p-4 text-center text-slate-500 font-semibold">Searching...</div> : null}
                {customers.map((c: any) => (
                  <div 
                    key={c.id} 
                    onClick={() => { setSelectedCustomer(c); setStep(2); }}
                    className="flex justify-between items-center p-4 border border-slate-100 rounded-2xl hover:border-[#2D79A8] hover:bg-[#EBF5FB] cursor-pointer transition-all"
                  >
                    <div>
                      <p className="font-bold text-slate-800">{c.user.firstName} {c.user.lastName}</p>
                      <p className="text-sm font-semibold text-slate-500">{c.user.phone}</p>
                    </div>
                    {c.isWalkIn && <span className="bg-orange-100 text-orange-600 px-2 py-1 rounded-md text-[10px] font-black uppercase">Walk-in</span>}
                  </div>
                ))}
                {searchQuery.length > 9 && customers.length === 0 && !isSearching && (
                  <button 
                    onClick={() => createWalkInMutation.mutate(searchQuery)}
                    className="w-full flex items-center justify-center gap-2 p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl font-bold hover:bg-emerald-100 transition-all"
                  >
                    <UserPlus className="w-5 h-5" />
                    Create Walk-In Customer for {searchQuery}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: PRODUCTS */}
          {step === 2 && (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 p-6 h-full flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                  <Package className="w-5 h-5 text-[#2D79A8]" />
                  Add Products
                </h2>
                <button onClick={() => setStep(1)} className="text-sm font-bold text-slate-500 hover:text-slate-800">Change Customer</button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 overflow-y-auto flex-1 pb-4">
                {products.map((p: any) => (
                  <div key={p.id} onClick={() => handleProductAdd(p)} className="border border-slate-100 p-4 rounded-2xl hover:border-[#2D79A8] hover:shadow-md cursor-pointer transition-all bg-slate-50 flex flex-col items-center text-center">
                    <img src={p.images?.[0]?.url || 'https://placehold.co/100x100?text=No+Image'} alt={p.name} className="w-20 h-20 object-contain mb-3 rounded-xl" />
                    <p className="font-bold text-slate-800 line-clamp-1">{p.name}</p>
                    <p className="text-[#2D79A8] font-black mt-1">₹{p.price}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* STEP 3: PAYMENT & OVERRIDES */}
          {step === 3 && (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 p-6 space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-[#2D79A8]" />
                  Payment & Overrides
                </h2>
                <button onClick={() => setStep(2)} className="text-sm font-bold text-slate-500 hover:text-slate-800">Back to Products</button>
              </div>

              {/* Payment Methods */}
              <div>
                <h3 className="font-bold text-slate-700 mb-3">Select Payment Method</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { id: 'COD', label: 'Cash / COD', icon: Banknote },
                    { id: 'WALLET', label: 'Wallet', icon: Wallet },
                    { id: 'ONLINE', label: 'Online Link', icon: CreditCard },
                    { id: 'HYBRID', label: 'Mixed', icon: Wallet },
                  ].map(m => {
                    const Icon = m.icon;
                    return (
                      <button 
                        key={m.id}
                        onClick={() => setPaymentMethod(m.id as any)}
                        className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all font-bold text-sm
                          ${paymentMethod === m.id ? 'border-[#2D79A8] bg-[#EBF5FB] text-[#2D79A8] shadow-sm' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                      >
                        <Icon className="w-5 h-5" />
                        {m.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              
              {paymentMethod === 'HYBRID' && (
                <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                  <h3 className="font-bold text-orange-800 mb-2 text-sm">Remaining Balance Paid Via:</h3>
                  <div className="flex gap-2">
                    {['CASH', 'ONLINE', 'CARD'].map(m => (
                       <button 
                        key={m}
                        onClick={() => setHybridSecondaryMethod(m as any)}
                        className={`px-4 py-2 rounded-lg font-bold text-xs transition-all ${hybridSecondaryMethod === m ? 'bg-orange-600 text-white shadow-md' : 'bg-white text-orange-600 border border-orange-200 hover:bg-orange-100'}`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Admin Overrides */}
              <div className="pt-6 border-t border-slate-100">
                <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                  <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded text-[10px] uppercase">Admin Only</span>
                  Manual Overrides
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer hover:border-slate-300">
                    <input type="checkbox" checked={waiveDeposit} onChange={e => setWaiveDeposit(e.target.checked)} className="w-5 h-5 rounded text-[#2D79A8] focus:ring-[#2D79A8]" />
                    <span className="font-bold text-slate-700 text-sm">Waive Deposit Charge</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer hover:border-slate-300">
                    <input type="checkbox" checked={waiveDelivery} onChange={e => setWaiveDelivery(e.target.checked)} className="w-5 h-5 rounded text-[#2D79A8] focus:ring-[#2D79A8]" />
                    <span className="font-bold text-slate-700 text-sm">Waive Delivery Fee</span>
                  </label>
                </div>
                <div className="mt-4">
                  <label className="block font-bold text-slate-700 text-sm mb-1.5">Custom Discount (₹)</label>
                  <input type="number" min="0" value={customDiscount || ''} onChange={e => setCustomDiscount(Number(e.target.value))} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-[#2D79A8]" />
                </div>
                <div className="mt-4">
                  <label className="block font-bold text-slate-700 text-sm mb-1.5">Audit Reason (Required for overrides)</label>
                  <input type="text" placeholder="E.g. VIP Customer, Approved by Manager" value={adminNotes} onChange={e => setAdminNotes(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none focus:border-[#2D79A8] text-sm" />
                </div>
              </div>

            </div>
          )}
        </div>

        {/* Sidebar Summary */}
        <div className="lg:col-span-1">
          <div className="bg-[#1B3B47] text-white rounded-3xl p-6 shadow-xl shadow-slate-200/50 sticky top-24">
            <h2 className="text-xl font-black mb-4 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-[#4CC9F0]" />
              Order Summary
            </h2>
            
            {selectedCustomer ? (
              <div className="mb-6 pb-6 border-b border-white/10">
                <p className="font-bold text-lg">{selectedCustomer.user.firstName} {selectedCustomer.user.lastName}</p>
                <p className="text-white/60 text-sm font-medium">{selectedCustomer.user.phone}</p>
                {activeWallet && (
                  <div className="mt-3 flex justify-between bg-white/5 p-3 rounded-xl border border-white/10">
                    <span className="text-sm font-medium text-white/80">Wallet Balance</span>
                    <span className="font-black text-[#4CC9F0]">₹{activeWallet.balance}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="mb-6 pb-6 border-b border-white/10 text-white/50 text-sm font-semibold italic text-center">
                No customer selected
              </div>
            )}

            <div className="space-y-4 mb-6 max-h-[300px] overflow-y-auto pr-2">
              {cartItems.map((c) => (
                <div key={c.product.id} className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/10">
                  <div className="flex-1">
                    <p className="font-bold text-sm line-clamp-1">{c.product.name}</p>
                    <p className="text-[#4CC9F0] text-xs font-black">₹{c.product.price} /ea</p>
                  </div>
                  <div className="flex items-center gap-2 bg-white/10 rounded-lg p-1">
                    <button onClick={() => handleProductUpdate(c.product, -1)} className="p-1 hover:bg-white/20 rounded-md transition"><Minus className="w-3 h-3" /></button>
                    <span className="font-black text-sm w-4 text-center">{c.qty}</span>
                    <button onClick={() => handleProductUpdate(c.product, 1)} className="p-1 hover:bg-white/20 rounded-md transition"><Plus className="w-3 h-3" /></button>
                  </div>
                </div>
              ))}
              {cartItems.length === 0 && step > 1 && (
                <div className="text-center text-white/40 text-sm font-bold py-4">Cart is empty</div>
              )}
            </div>

            {validationParams && (
              <div className="space-y-2 text-sm font-semibold mb-6 pb-6 border-b border-white/10">
                <div className="flex justify-between text-white/80">
                  <span>Subtotal</span>
                  <span>₹{validationParams.subTotal}</span>
                </div>
                {validationParams.depositTotal > 0 && (
                  <div className="flex justify-between text-orange-400">
                    <span>Jar Deposit (Refundable)</span>
                    <span>+₹{validationParams.depositTotal}</span>
                  </div>
                )}
                {validationParams.deliveryCharge > 0 && (
                  <div className="flex justify-between text-white/80">
                    <span>Delivery Charge</span>
                    <span>+₹{validationParams.deliveryCharge}</span>
                  </div>
                )}
                {validationParams.discountTotal > 0 && (
                  <div className="flex justify-between text-emerald-400 font-bold">
                    <span>Discount Applied</span>
                    <span>-₹{validationParams.discountTotal}</span>
                  </div>
                )}
                <div className="flex justify-between text-xl font-black mt-4 pt-4 border-t border-white/10">
                  <span>Total</span>
                  <span className="text-[#4CC9F0]">₹{validationParams.totalAmount}</span>
                </div>
              </div>
            )}

            {step === 2 && cartItems.length > 0 && (
              <button onClick={() => setStep(3)} className="w-full bg-[#4CC9F0] hover:bg-[#3AB0D3] text-[#1B3B47] py-4 rounded-2xl font-black text-lg transition-all shadow-lg shadow-[#4CC9F0]/20 flex items-center justify-center gap-2">
                Proceed to Payment
              </button>
            )}

            {step === 3 && (
              <button 
                onClick={() => placeOrderMutation.mutate()} 
                disabled={placeOrderMutation.isPending || (!adminNotes && (waiveDeposit || waiveDelivery || customDiscount > 0))}
                className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 rounded-2xl font-black text-lg transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
              >
                {placeOrderMutation.isPending ? <LoadingSpinner size="sm" light /> : <CheckCircle className="w-6 h-6" />}
                Confirm Order
              </button>
            )}
            
            {step === 3 && (!adminNotes && (waiveDeposit || waiveDelivery || customDiscount > 0)) && (
              <p className="text-red-400 text-xs font-bold text-center mt-3">Audit notes are required for overrides.</p>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
