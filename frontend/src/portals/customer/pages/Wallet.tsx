import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet,
  History,
  ArrowUpRight,
  ArrowDownLeft,
  Loader2,
  Receipt,
  Award,
  CheckCircle2,
  X,
  CreditCard,
  Package,
  Droplets,
  Search,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';
import { toast } from 'react-hot-toast';
import { injectMockRazorpay } from '../../../utils/MockRazorpay';
import { EdropsPageLoader } from '../../../components/common/EdropsPageLoader';
import { useSearchParams, useNavigate } from 'react-router-dom';

interface TransactionItem {
  id: string;
  category: 'SUBSCRIPTION' | 'WALLET' | 'ORDER' | 'DEPOSIT';
  title: string;
  description: string;
  amount: number;
  jars?: number;
  status: string;
  direction: 'CREDIT' | 'DEBIT';
  createdAt: string;
  referenceId?: string;
}

export default function WalletPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [balance, setBalance] = useState<number>(0);
  const [depositDue, setDepositDue] = useState<number>(0);
  const [depositPaid, setDepositPaid] = useState<number>(0);
  const [maxActiveJars, setMaxActiveJars] = useState<number>(0);
  const [availableJars, setAvailableJars] = useState<number>(0);

  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAmount, setSelectedAmount] = useState<number>(500);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [rechargeLoading, setRechargeLoading] = useState(false);

  // Pay Deposit Modal State
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [depositPayMethod, setDepositPayMethod] = useState<'WALLET' | 'ONLINE'>('WALLET');
  const [isPayingDeposit, setIsPayingDeposit] = useState(false);

  // Filter & Search State
  const [activeCategory, setActiveCategory] = useState<'ALL' | 'SUBSCRIPTION' | 'WALLET' | 'ORDER' | 'DEPOSIT'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);

      // Load Profile & Balances
      const profileData = await fetchWithAuth('/auth/me');
      if (profileData?.customer) {
        const c = profileData.customer;
        if (c.wallet) {
          setBalance(Number(c.wallet.balance || 0));
        }
        if (c.jarBalances?.[0]) {
          setAvailableJars(c.jarBalances[0].availableJars || 0);
        }
        if (c.jarDeposits?.[0]) {
          setDepositDue(Number(c.jarDeposits[0].depositDue || 0));
          setDepositPaid(Number(c.jarDeposits[0].depositPaid || 0));
          setMaxActiveJars(c.jarDeposits[0].maxActiveJars || 0);
        }
      }

      // Load Unified Full Billing History
      const historyData = await fetchWithAuth('/wallet/all-history');
      if (historyData) {
        setTransactions(historyData.transactions || []);
        if (typeof historyData.walletBalance === 'number') setBalance(historyData.walletBalance);
        if (typeof historyData.depositDue === 'number') setDepositDue(historyData.depositDue);
        if (typeof historyData.depositPaid === 'number') setDepositPaid(historyData.depositPaid);
        if (typeof historyData.maxActiveJars === 'number') setMaxActiveJars(historyData.maxActiveJars);
      }
    } catch {
      toast.error('Failed to load transaction & wallet data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Check if opened with ?action=pay-deposit
  useEffect(() => {
    if (searchParams.get('action') === 'pay-deposit') {
      setIsDepositModalOpen(true);
      // Clean query param
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

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

  const activeAmount = customAmount ? parseInt(customAmount, 10) || 0 : selectedAmount;
  const isValidAmount = activeAmount >= 100 && activeAmount <= 100000;

  // Wallet Top-Up via Razorpay
  const handleRecharge = async () => {
    if (!isValidAmount) {
      toast.error('Please select or enter an amount between ₹100 and ₹1,00,000');
      return;
    }

    try {
      setRechargeLoading(true);
      const initiateRes = await fetchWithAuth('/wallet/recharge/initiate', {
        method: 'POST',
        body: JSON.stringify({ amount: activeAmount }),
      });

      const isLoaded = await loadRazorpay();
      if (!isLoaded) {
        toast.error('Razorpay SDK failed to load');
        return;
      }

      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_mock',
        amount: initiateRes.amount * 100,
        currency: initiateRes.currency,
        name: 'Edrops Wallet',
        description: 'Wallet Top-Up',
        order_id: initiateRes.razorpayOrderId,
        handler: async function (response: any) {
          try {
            await fetchWithAuth('/wallet/recharge/confirm', {
              method: 'POST',
              body: JSON.stringify({
                razorpayOrderId: initiateRes.razorpayOrderId,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              }),
            });
            toast.success(`Successfully added ₹${activeAmount} to your wallet!`);
            setCustomAmount('');
            loadData();
          } catch (confirmErr: any) {
            toast.error(confirmErr.message || 'Payment verification failed');
          }
        },
        theme: { color: '#0284C7' },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', () => toast.error('Payment failed or cancelled.'));
      rzp.open();
    } catch (err: any) {
      toast.error(err.message || 'Failed to initiate recharge');
    } finally {
      setRechargeLoading(false);
    }
  };

  // Pay Outstanding Deposit
  const handlePayDeposit = async () => {
    if (depositDue <= 0) {
      toast.success('You have no outstanding deposit due.');
      setIsDepositModalOpen(false);
      return;
    }

    try {
      setIsPayingDeposit(true);

      if (depositPayMethod === 'WALLET') {
        if (balance < depositDue) {
          toast.error(`Insufficient wallet balance. You have ₹${balance}, but ₹${depositDue} is required.`);
          return;
        }

        const res = await fetchWithAuth('/wallet/pay-deposit-wallet', {
          method: 'POST',
          body: JSON.stringify({ amount: depositDue }),
        });

        if (res.success) {
          toast.success(`Deposit of ₹${res.amountPaid} paid successfully from your wallet!`);
          setIsDepositModalOpen(false);
          loadData();
        }
      } else {
        // Online Payment via Razorpay
        const initiateRes = await fetchWithAuth('/wallet/pay-deposit-online/initiate', {
          method: 'POST',
          body: JSON.stringify({ amount: depositDue }),
        });

        const isLoaded = await loadRazorpay();
        if (!isLoaded) {
          toast.error('Payment gateway failed to load');
          return;
        }

        const options = {
          key: import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_mock',
          amount: initiateRes.amount * 100,
          currency: initiateRes.currency,
          name: 'Edrops Water',
          description: `Jar Security Deposit Payment (₹${depositDue})`,
          order_id: initiateRes.razorpayOrderId,
          handler: async function (response: any) {
            try {
              await fetchWithAuth('/wallet/pay-deposit-online/confirm', {
                method: 'POST',
                body: JSON.stringify({
                  razorpayOrderId: initiateRes.razorpayOrderId,
                  razorpayPaymentId: response.razorpay_payment_id,
                  razorpaySignature: response.razorpay_signature,
                }),
              });
              toast.success(`Deposit of ₹${depositDue} paid successfully!`);
              setIsDepositModalOpen(false);
              loadData();
            } catch (confirmErr: any) {
              toast.error(confirmErr.message || 'Deposit verification failed');
            }
          },
          theme: { color: '#0284C7' },
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.on('payment.failed', () => toast.error('Payment cancelled or failed.'));
        rzp.open();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to process deposit payment');
    } finally {
      setIsPayingDeposit(false);
    }
  };

  // Filtered Transactions
  const filteredTransactions = transactions.filter((tx) => {
    if (activeCategory !== 'ALL' && tx.category !== activeCategory) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = tx.title?.toLowerCase().includes(q);
      const matchDesc = tx.description?.toLowerCase().includes(q);
      const matchRef = tx.referenceId?.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchRef) return false;
    }
    return true;
  });

  const categoryCounts = {
    ALL: transactions.length,
    SUBSCRIPTION: transactions.filter((t) => t.category === 'SUBSCRIPTION').length,
    WALLET: transactions.filter((t) => t.category === 'WALLET').length,
    ORDER: transactions.filter((t) => t.category === 'ORDER').length,
    DEPOSIT: transactions.filter((t) => t.category === 'DEPOSIT').length,
  };

  if (loading) {
    return <EdropsPageLoader fullPage label="Loading billing & transactions..." />;
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-28 sm:pb-24">
      <div className="mx-auto max-w-7xl px-3 sm:px-6 py-4 sm:py-8 lg:px-8 space-y-5 sm:space-y-6">
        
        {/* ─── 1. PAGE HEADER ────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200/80">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Wallet & Billing History
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
              Manage your balance, package plans, jar deposits and complete payment ledger
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => navigate('/customer/recharge')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#1E88E5] hover:bg-[#1565C0] text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Package className="w-3.5 h-3.5" />
              <span>Buy Water Plan</span>
            </button>
            {depositDue > 0 && (
              <button
                type="button"
                onClick={() => setIsDepositModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <Award className="w-3.5 h-3.5" />
                <span>Pay Deposit (₹{depositDue})</span>
              </button>
            )}
          </div>
        </div>

        {/* ─── 2. THREE-CARD SUMMARY STRIP ───────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Card 1: Available Wallet Balance */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0EA5E9] via-[#0284C7] to-[#0B3B5C] p-5 text-white shadow-sm border border-white/15 flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20 backdrop-blur-xs text-white">
                  <Wallet className="h-4 w-4" />
                </span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-white/90">
                  Wallet Balance
                </span>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold text-cyan-100">
                <CheckCircle2 className="h-3 w-3 text-cyan-200" /> Auto-Debit Ready
              </span>
            </div>

            <div className="my-3">
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold text-white/80">₹</span>
                <span className="text-3xl sm:text-4xl font-black tracking-tight text-white">
                  {balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <p className="text-[11px] font-medium text-white/80 mt-1">
                Used for auto-debited water orders and instant store purchases
              </p>
            </div>

            <div className="pt-2 border-t border-white/15 flex items-center justify-between text-[11px] text-white/70">
              <span>Instant Refill via UPI</span>
              <span className="font-semibold text-white">100% Protected</span>
            </div>
          </motion.div>

          {/* Card 2: Jar Security Deposit Status */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="rounded-2xl bg-white p-5 border border-slate-200/90 shadow-2xs flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                  <Award className="h-4 w-4" />
                </span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Jar Security Deposit
                </span>
              </div>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  depositDue > 0
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {depositDue > 0 ? 'Payment Due' : 'Paid & Settled'}
              </span>
            </div>

            <div className="my-3">
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-black text-slate-900">
                  {depositDue > 0 ? `₹${depositDue}` : `₹${depositPaid}`}
                </span>
                <span className="text-xs font-bold text-slate-500">
                  {depositDue > 0 ? 'Due' : 'Held with Company'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                For <strong>{maxActiveJars || 2} rotation can(s)</strong> (@ ₹300/can). 100% refundable upon jar return.
              </p>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              {depositDue > 0 ? (
                <button
                  type="button"
                  onClick={() => setIsDepositModalOpen(true)}
                  className="w-full py-1.5 px-3 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Pay Deposit Now (₹{depositDue})</span>
                </button>
              ) : (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Deposit fully settled and protected</span>
                </div>
              )}
            </div>
          </motion.div>

          {/* Card 3: Prepaid Jars Status */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl bg-white p-5 border border-slate-200/90 shadow-2xs flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-[#1E88E5]">
                  <Droplets className="h-4 w-4" />
                </span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Prepaid Water Balance
                </span>
              </div>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-[#1E88E5]">
                Plan Active
              </span>
            </div>

            <div className="my-3">
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-black text-slate-900">
                  {availableJars}
                </span>
                <span className="text-xs font-bold text-slate-500">Jars Remaining</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Fulfilled automatically on scheduled delivery mornings
              </p>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => navigate('/customer/recharge')}
                className="w-full py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer"
              >
                <span>Recharge / Upgrade Plan</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>

        </div>

        {/* ─── 3. QUICK TOP-UP BAR ────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                <Wallet className="w-4 h-4 text-[#0284C7]" />
                <span>Top-Up Wallet Instantly</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Add funds via UPI, Card, or Netbanking for automated daily drop billing
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {[200, 500, 1000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => {
                    setSelectedAmount(amt);
                    setCustomAmount('');
                  }}
                  className={`h-9 px-3.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    selectedAmount === amt && !customAmount
                      ? 'bg-[#0284C7] text-white shadow-2xs border border-[#0284C7]'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                  }`}
                >
                  +₹{amt}
                </button>
              ))}

              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-slate-400 font-bold text-xs select-none">
                  ₹
                </span>
                <input
                  type="number"
                  min={100}
                  max={100000}
                  placeholder="Custom amount"
                  value={customAmount}
                  onChange={(e) => {
                    setCustomAmount(e.target.value);
                    setSelectedAmount(0);
                  }}
                  className="w-32 h-9 pl-6 pr-2.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-900 outline-none focus:border-[#0284C7] focus:ring-2 focus:ring-[#0284C7]/20"
                />
              </div>

              <button
                type="button"
                onClick={handleRecharge}
                disabled={!isValidAmount || rechargeLoading}
                className="h-9 px-4 rounded-xl bg-[#0284C7] hover:bg-[#0369A1] disabled:opacity-50 text-white text-xs font-bold shadow-2xs flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                {rechargeLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CreditCard className="w-3.5 h-3.5" />
                )}
                <span>Add ₹{activeAmount}</span>
              </button>
            </div>
          </div>
        </motion.div>

        {/* ─── 4. UNIFIED BILLING & TRANSACTION HISTORY ───────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16 }}
          className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden"
        >
          {/* Header & Filter Controls */}
          <div className="p-4 sm:p-5 border-b border-slate-100 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-[#0284C7]">
                  <History className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">All Transactions & Ledger</h2>
                  <p className="text-[11px] text-slate-500">
                    Showing complete history of subscriptions, wallet top-ups, orders, and jar deposits
                  </p>
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by plan, order, ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-8 pl-8 pr-3 rounded-lg border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Category Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-semibold no-scrollbar scroll-smooth touch-pan-x">
              {(
                [
                  { id: 'ALL', label: 'All Transactions' },
                  { id: 'SUBSCRIPTION', label: 'Subscriptions & Plans' },
                  { id: 'WALLET', label: 'Wallet Top-ups' },
                  { id: 'ORDER', label: 'Orders' },
                  { id: 'DEPOSIT', label: 'Jar Deposits' },
                ] as const
              ).map((tab) => {
                const count = categoryCounts[tab.id];
                const isActive = activeCategory === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveCategory(tab.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                      isActive
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                        isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Transactions List */}
          <div className="divide-y divide-slate-100">
            {filteredTransactions.length > 0 ? (
              filteredTransactions.map((tx) => {
                const isCredit = tx.direction === 'CREDIT';
                const isDeposit = tx.category === 'DEPOSIT';
                const isSub = tx.category === 'SUBSCRIPTION';
                const isOrder = tx.category === 'ORDER';

                return (
                  <div
                    key={tx.id}
                    className="p-3 sm:p-4 sm:px-5 flex items-center justify-between gap-2.5 sm:gap-3 hover:bg-slate-50/80 transition-colors"
                  >
                    {/* Left: Category Icon + Description */}
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                      <span
                        className={`flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl shrink-0 ${
                          isSub
                            ? 'bg-blue-50 text-blue-600 border border-blue-100'
                            : isDeposit
                            ? 'bg-amber-50 text-amber-600 border border-amber-100'
                            : isOrder
                            ? 'bg-purple-50 text-purple-600 border border-purple-100'
                            : isCredit
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {isSub ? (
                          <Package className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
                        ) : isDeposit ? (
                          <Award className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
                        ) : isOrder ? (
                          <Receipt className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
                        ) : isCredit ? (
                          <ArrowUpRight className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
                        ) : (
                          <ArrowDownLeft className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
                        )}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                          <p className="text-xs sm:text-sm font-bold text-slate-900 truncate max-w-[140px] xs:max-w-[210px] sm:max-w-none">
                            {tx.title}
                          </p>
                          <span
                            className={`text-[9px] uppercase font-black px-1.5 py-0.5 rounded-md shrink-0 ${
                              isSub
                                ? 'bg-blue-100 text-blue-800'
                                : isDeposit
                                ? 'bg-amber-100 text-amber-800'
                                : isOrder
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {tx.category}
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-500 truncate max-w-[180px] xs:max-w-[260px] sm:max-w-none mt-0.5">
                          {tx.description}
                        </p>

                        <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 text-[10px] text-slate-400 flex-wrap">
                          <span>
                            {new Date(tx.createdAt).toLocaleDateString('en-IN', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}{' '}
                            at{' '}
                            {new Date(tx.createdAt).toLocaleTimeString('en-IN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          {tx.referenceId && (
                            <>
                              <span>•</span>
                              <span className="font-mono text-[9px] text-slate-400">
                                Ref: {tx.referenceId.slice(0, 10)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Amount & Status */}
                    <div className="text-right shrink-0 pl-2 sm:pl-3 whitespace-nowrap">
                      <p
                        className={`text-xs sm:text-sm font-black ${
                          isCredit ? 'text-emerald-600' : 'text-slate-900'
                        }`}
                      >
                        {isCredit ? '+' : '-'}₹{Number(tx.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </p>
                      {tx.jars && tx.jars > 0 ? (
                        <p className="text-[10px] font-bold text-blue-600 mt-0.5">
                          {tx.jars} Jars
                        </p>
                      ) : (
                        <p className="text-[10px] font-semibold text-slate-400 mt-0.5 uppercase tracking-wider">
                          {tx.status}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-12 px-4 flex flex-col items-center justify-center text-center">
                <Receipt className="w-8 h-8 text-slate-300 mb-2" />
                <h4 className="text-xs font-bold text-slate-800">No records found</h4>
                <p className="text-[11px] text-slate-500 max-w-xs mt-0.5">
                  No transaction records matching the selected filter or search term.
                </p>
              </div>
            )}
          </div>
        </motion.section>

      </div>

      {/* ─── 5. PAY JAR DEPOSIT MODAL ───────────────────────────────────────── */}
      <AnimatePresence>
        {isDepositModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden"
            >
              {/* Modal Header */}
              <div className="px-5 py-4 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
                    <Award className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Pay Jar Security Deposit</h3>
                    <p className="text-[11px] text-slate-500">Refundable company asset guarantee</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDepositModalOpen(false)}
                  className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 space-y-4">
                {/* Deposit Amount Due Callout */}
                <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-4 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Outstanding Deposit
                    </span>
                    <div className="text-2xl font-black text-slate-900 mt-0.5">
                      ₹{depositDue}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-700">
                      {maxActiveJars || 2} Company Can(s)
                    </span>
                    <p className="text-[10px] text-slate-500 mt-0.5">@ ₹300 per can</p>
                  </div>
                </div>

                {/* Return Policy Notice */}
                <div className="rounded-xl bg-amber-50/70 border border-amber-200/70 p-3 flex items-start gap-2.5 text-xs text-amber-900">
                  <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-relaxed">
                    <strong>100% Refundable:</strong> This deposit remains safely held with eDrops while your subscription is active. When you stop ordering and return the cans, our staff will verify and refund this entire amount back to you.
                  </p>
                </div>

                {/* Choose Payment Method */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    Select Payment Method
                  </label>
                  <div className="space-y-2">
                    {/* Method 1: Wallet Balance */}
                    <div
                      onClick={() => setDepositPayMethod('WALLET')}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                        depositPayMethod === 'WALLET'
                          ? 'border-blue-500 bg-blue-50/50 shadow-2xs'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                          <Wallet className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900">Pay from Wallet Balance</p>
                          <p className="text-[11px] text-slate-500">
                            Available: <strong>₹{balance.toFixed(2)}</strong>
                            {balance < depositDue && (
                              <span className="text-rose-600 font-semibold ml-1">(Insufficient)</span>
                            )}
                          </p>
                        </div>
                      </div>
                      <input
                        type="radio"
                        name="depositMethod"
                        checked={depositPayMethod === 'WALLET'}
                        onChange={() => setDepositPayMethod('WALLET')}
                        className="text-blue-600"
                      />
                    </div>

                    {/* Method 2: Online via UPI / Card */}
                    <div
                      onClick={() => setDepositPayMethod('ONLINE')}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                        depositPayMethod === 'ONLINE'
                          ? 'border-blue-500 bg-blue-50/50 shadow-2xs'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                          <CreditCard className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900">Pay Online (UPI / Card)</p>
                          <p className="text-[11px] text-slate-500">Google Pay, PhonePe, Paytm, Cards</p>
                        </div>
                      </div>
                      <input
                        type="radio"
                        name="depositMethod"
                        checked={depositPayMethod === 'ONLINE'}
                        onChange={() => setDepositPayMethod('ONLINE')}
                        className="text-blue-600"
                      />
                    </div>
                  </div>
                </div>

                {/* Confirm Pay Button */}
                <button
                  type="button"
                  onClick={handlePayDeposit}
                  disabled={isPayingDeposit || (depositPayMethod === 'WALLET' && balance < depositDue)}
                  className="w-full mt-2 h-11 rounded-xl bg-[#1E88E5] hover:bg-[#1565C0] disabled:opacity-50 text-white text-xs sm:text-sm font-bold shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isPayingDeposit ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Processing Payment...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirm & Pay ₹{depositDue}</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
