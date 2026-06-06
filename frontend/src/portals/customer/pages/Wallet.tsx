import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Wallet, History, ArrowUpRight, ArrowDownLeft, ShieldAlert, Sparkles, Loader2 } from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../../contexts/AuthContext';

interface Transaction {
  id: string;
  type: 'TOP_UP' | 'DEDUCTION' | 'REFUND' | 'BONUS';
  amount: number;
  description: string;
  createdAt: string;
  balanceAfter: number;
}

export default function WalletPage() {
  const { user } = useAuth();
  const [balance, setBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAmount, setSelectedAmount] = useState<number>(500);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [rechargeLoading, setRechargeLoading] = useState(false);

  const loadWalletData = async () => {
    try {
      const data = await fetchWithAuth('/auth/me');
      if (data?.customer?.wallet) {
        setBalance(data.customer.wallet.balance);
      }

      const txData = await fetchWithAuth('/wallet/transactions');
      setTransactions(txData || []);
    } catch (err: any) {
      toast.error('Failed to load wallet information');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWalletData();
  }, []);

  const handleRecharge = async () => {
    const amount = customAmount ? parseInt(customAmount) : selectedAmount;
    if (!amount || amount < 100 || amount > 100000) {
      toast.error('Please enter a valid amount (Min: ₹100, Max: ₹100,000)');
      return;
    }

    try {
      setRechargeLoading(true);
      await fetchWithAuth('/wallet/recharge', {
        method: 'POST',
        body: JSON.stringify({ amount }),
      });

      toast.success(`Successfully added ₹${amount} to your wallet!`);
      setCustomAmount('');
      loadWalletData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to recharge wallet');
    } finally {
      setRechargeLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="relative h-16 w-16 rounded-full water-gradient shadow-2xl shadow-edrops-aqua/30">
          <div className="absolute inset-2 animate-ping rounded-full bg-white/40" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8 space-y-6">
      
      {/* 1. Header with Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-[#245361]">Wallet & Payments</h1>
          <p className="text-sm font-semibold text-[#245361]/95 mt-1">Manage your funds, rewards, and transaction history</p>
        </div>
      </div>

      {/* 2. Balance & Top-Up Section */}
      <div className="grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
        
        {/* Large Balance Card */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="clay-card bg-primary text-white rounded-[2.5rem] p-6 sm:p-10 relative overflow-hidden flex flex-col justify-between min-h-[220px]"
        >
          <div className="absolute inset-x-0 bottom-0 h-28 wave-mask opacity-30" />
          
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 text-white">
                <Wallet className="h-6 w-6" />
              </span>
              <span className="text-sm font-black uppercase tracking-[0.2em] text-white">Available Balance</span>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.1em] text-[#2D79A8]">
              <Sparkles className="h-3 w-3" /> Secure
            </span>
          </div>

          <div className="relative mt-6">
            <p className="text-5xl sm:text-6xl font-black text-white">₹{balance.toFixed(2)}</p>
            <p className="text-xs font-black text-white uppercase tracking-widest mt-2">INR AVAILABLE TO USE</p>
          </div>
        </motion.div>

        {/* Quick Actions (Add Money) */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="clay-card p-6 flex flex-col justify-between"
        >
          <div>
            <h3 className="text-lg font-black text-[#245361]">Quick Top-Up</h3>
            <p className="text-sm text-slate-700 mt-1">Refill wallet for uninterrupted water delivery.</p>
            
            <div className="grid grid-cols-3 gap-2 mt-4">
              {[200, 500, 1000].map((amt) => (
                <button
                  key={amt}
                  onClick={() => { setSelectedAmount(amt); setCustomAmount(''); }}
                  className={`rounded-2xl py-3 text-center text-sm font-black transition ${selectedAmount === amt && !customAmount ? 'bg-[#2D79A8] text-white shadow-lg shadow-[#2D79A8]/30' : 'bg-secondary/15 text-[#2D79A8] border border-transparent hover:border-[#2D79A8]'}`}
                >
                  +₹{amt}
                </button>
              ))}
            </div>

            <div className="mt-4 relative">
              <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400 font-bold">₹</span>
              <input
                type="number"
                placeholder="Or enter custom amount..."
                value={customAmount}
                onChange={(e) => { setCustomAmount(e.target.value); setSelectedAmount(0); }}
                className="w-full pl-8 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#2D79A8] focus:ring-2 focus:ring-[#2D79A8]/20 transition-all font-semibold text-sm outline-none"
              />
            </div>
          </div>

          <button
            onClick={handleRecharge}
            disabled={rechargeLoading}
            className="w-full mt-6 py-4 rounded-full sun-gradient text-sm font-black text-white shadow-lg hover:shadow-orange-300/20 active:scale-98 transition flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {rechargeLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Add Money Securely'}
          </button>
        </motion.div>
      </div>

      {/* 3. Transaction History / Ledger */}
      <motion.section
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="clay-card p-6"
      >
        <div className="flex items-center gap-3 border-b border-border pb-4 mb-4">
          <History className="h-6 w-6 text-[#2D79A8]" />
          <h2 className="text-xl font-black text-[#245361]">Recent Transactions</h2>
        </div>

        <div className="divide-y divide-border/60">
          {transactions.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3.5">
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tx.type === 'DEDUCTION' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                  {tx.type === 'DEDUCTION' ? <ArrowDownLeft className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
                </span>
                <div>
                  <p className="text-base font-black text-[#245361]">{tx.description}</p>
                  <p className="text-xs font-semibold text-slate-700 mt-0.5">{new Date(tx.createdAt).toLocaleDateString()} at {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-base font-black ${tx.type === 'DEDUCTION' ? 'text-[#245361]' : 'text-emerald-600'}`}>
                  {tx.type === 'DEDUCTION' ? '-' : '+'}Rs {tx.amount.toFixed(2)}
                </p>
                <p className="text-[10px] font-bold text-slate-700 mt-0.5">Bal: Rs {tx.balanceAfter.toFixed(2)}</p>
              </div>
            </div>
          ))}
          {transactions.length === 0 && (
            <p className="text-center text-sm font-semibold text-slate-600 py-6">No transaction records found.</p>
          )}
        </div>
      </motion.section>

      {/* 4. Tips & Alerts */}
      <section className="bg-[#BBDFF2]/30 rounded-3xl p-5 border border-[#BBDFF2] flex gap-4 items-start">
        <ShieldAlert className="h-6 w-6 text-[#2D79A8] shrink-0 mt-0.5" />
        <div>
          <h4 className="text-sm font-black text-[#245361]">Auto-Debit Warning</h4>
          <p className="text-sm text-slate-700 mt-1">
            Wallet balance is automatically debited upon each successful delivery. To avoid skipped deliveries, maintain a balance of at least ₹150.00.
          </p>
        </div>
      </section>

    </div>
  );
}
