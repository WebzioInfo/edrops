import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Wallet, History, ArrowUpRight, ArrowDownLeft, AlertCircle, Sparkles, Loader2, Receipt } from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';
import { toast } from 'react-hot-toast';
import { injectMockRazorpay } from '../../../utils/MockRazorpay';
import { EdropsPageLoader } from '../../../components/common/EdropsPageLoader';

interface Transaction {
  id: string;
  type: 'TOP_UP' | 'DEDUCTION' | 'REFUND' | 'BONUS';
  amount: number;
  description: string;
  createdAt: string;
  balanceAfter: number;
}

export default function WalletPage() {
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
    } catch {
      toast.error('Failed to load wallet information');
    } finally {
      setLoading(false);
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

  useEffect(() => {
    loadWalletData();
  }, []);

  const activeAmount = customAmount ? parseInt(customAmount, 10) || 0 : selectedAmount;
  const isValidAmount = activeAmount >= 100 && activeAmount <= 100000;

  const handleRecharge = async () => {
    if (!isValidAmount) {
      toast.error('Please select or enter an amount between ₹100 and ₹1,00,000');
      return;
    }

    try {
      setRechargeLoading(true);
      // 1. Initiate Recharge
      const initiateRes = await fetchWithAuth('/wallet/recharge/initiate', {
        method: 'POST',
        body: JSON.stringify({ amount: activeAmount }),
      });

      // 2. Load Razorpay script
      const isLoaded = await loadRazorpay();
      if (!isLoaded) {
        toast.error('Razorpay SDK failed to load');
        return;
      }

      // 3. Open Razorpay Modal
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
            loadWalletData();
          } catch (confirmErr: any) {
            toast.error(confirmErr.message || 'Payment verification failed');
          }
        },
        theme: { color: '#0284C7' }
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

  if (loading) {
    return <EdropsPageLoader fullPage label="Loading wallet..." />;
  }

  return (
    <div className="min-h-screen bg-[#F7FAFC] pb-20">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 space-y-6">
        
        {/* 1. Header with Title */}
        <div>
          <h1 className="text-[24px] md:text-[28px] font-bold text-[#0F172A] tracking-tight">
            Wallet & Payments
          </h1>
          <p className="text-[#64748B] text-sm mt-1 font-medium">
            Manage your funds, auto-debits, and recharge transactions
          </p>
        </div>

        {/* 2. Balance & Top-Up Section */}
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-[1.2fr_0.8fr]">
          
          {/* Large Balance Card with layered depth and gradient */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-[#0EA5E9] via-[#0284C7] to-[#0B3B5C] p-6 sm:p-8 text-white shadow-[0_12px_32px_rgba(14,165,233,0.22)] border border-white/15 flex flex-col justify-between min-h-[230px]"
          >
            {/* Ambient Lighting & Glows */}
            <div className="absolute -top-16 -right-16 w-52 h-52 bg-white/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-14 -left-14 w-44 h-44 bg-cyan-400/20 rounded-full blur-2xl pointer-events-none" />
            
            {/* Subtle Watermark Icon */}
            <Wallet className="absolute -bottom-6 -right-6 w-44 h-44 text-white/[0.07] stroke-[1.2] pointer-events-none select-none" />

            {/* Top Bar: Label + Secure Badge */}
            <div className="relative flex items-center justify-between z-10">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/15 backdrop-blur-xs text-white">
                  <Wallet className="h-4 w-4" />
                </span>
                <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/80">
                  Available Balance
                </span>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/15 backdrop-blur-xs px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white/90 border border-white/20">
                <Sparkles className="h-3 w-3 text-cyan-200" /> Secure
              </span>
            </div>

            {/* Center: Main Balance Figure with Breathing Room */}
            <div className="relative my-auto py-5 z-10">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl sm:text-3xl font-bold text-white/80">₹</span>
                <span className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white">
                  {balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <p className="text-[11px] font-semibold text-white/70 tracking-wide mt-2 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Auto-debited on each verified delivery
              </p>
            </div>

            {/* Bottom Meta */}
            <div className="relative z-10 pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-white/60">
              <span>Instant Wallet Top-Up</span>
              <span>100% Encrypted & Protected</span>
            </div>
          </motion.div>

          {/* Quick Actions (Add Money) */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="bg-white rounded-[24px] p-6 sm:p-7 border border-[#E2E8F0]/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-base font-bold text-[#0F172A]">Quick Top-Up</h3>
                <span className="text-[11px] font-medium text-[#64748B]">Min ₹100 • Max ₹1,00,000</span>
              </div>
              <p className="text-xs text-[#64748B]">Refill wallet for uninterrupted water delivery.</p>
              
              {/* Preset Buttons */}
              <div className="grid grid-cols-3 gap-2 mt-4">
                {[200, 500, 1000].map((amt) => {
                  const isSelected = selectedAmount === amt && !customAmount;
                  return (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => {
                        setSelectedAmount(amt);
                        setCustomAmount('');
                      }}
                      className={`h-11 rounded-xl text-center text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center ${
                        isSelected
                          ? 'bg-[#0284C7] text-white shadow-md shadow-[#0284C7]/20 border border-[#0284C7]'
                          : 'bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#0F172A] border border-[#E2E8F0] hover:border-[#CBD5E1]'
                      }`}
                    >
                      +₹{amt}
                    </button>
                  );
                })}
              </div>

              {/* Custom Input */}
              <div className="mt-3 relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-[#64748B] font-bold text-sm select-none">
                  ₹
                </span>
                <input
                  type="number"
                  min={100}
                  max={100000}
                  placeholder="Or enter custom amount..."
                  value={customAmount}
                  onChange={(e) => {
                    setCustomAmount(e.target.value);
                    setSelectedAmount(0);
                  }}
                  className="w-full h-11 pl-8 pr-4 rounded-xl border border-[#CBD5E1] bg-white text-[#0F172A] placeholder:text-[#94A3B8] font-semibold text-xs sm:text-sm outline-none transition-all focus:border-[#0284C7] focus:ring-3 focus:ring-[#0284C7]/15"
                />
              </div>
            </div>

            {/* Top-up Action Button with explicit active & disabled states */}
            <button
              type="button"
              onClick={handleRecharge}
              disabled={!isValidAmount || rechargeLoading}
              className={`w-full mt-5 h-12 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                isValidAmount && !rechargeLoading
                  ? 'bg-[#0284C7] hover:bg-[#0369A1] text-white shadow-md shadow-[#0284C7]/25 cursor-pointer active:scale-[0.98]'
                  : 'bg-[#E2E8F0] text-[#94A3B8] cursor-not-allowed shadow-none'
              }`}
            >
              {rechargeLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Processing Recharge...</span>
                </>
              ) : (
                <>
                  <Sparkles className={`w-4 h-4 ${isValidAmount ? 'text-white/80' : 'text-[#94A3B8]'}`} />
                  <span>
                    {isValidAmount ? `Add ₹${activeAmount} Securely` : 'Enter Amount to Top Up'}
                  </span>
                </>
              )}
            </button>
          </motion.div>
        </div>

        {/* 3. Transaction History / Ledger */}
        <motion.section
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white rounded-[24px] p-6 sm:p-7 border border-[#E2E8F0]/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)]"
        >
          <div className="flex items-center justify-between pb-4 border-b border-[#F1F5F9]">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0284C7]/10 text-[#0284C7]">
                <History className="h-4.5 w-4.5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#0F172A]">Recent Transactions</h2>
                <p className="text-[11px] text-[#64748B] font-medium">Automatic billing and recharge log</p>
              </div>
            </div>
            {transactions.length > 0 && (
              <span className="text-xs font-semibold text-[#64748B] bg-[#F1F5F9] px-2.5 py-1 rounded-full">
                {transactions.length} record{transactions.length === 1 ? '' : 's'}
              </span>
            )}
          </div>

          <div className="mt-2">
            {/* Non-empty State */}
            {transactions.length > 0 && (
              <div className="divide-y divide-[#F1F5F9]">
                {transactions.map((tx) => {
                  const isDeduction = tx.type === 'DEDUCTION';
                  return (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between py-3.5 px-1 hover:bg-[#F8FAFC] rounded-xl transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`flex h-10 w-10 items-center justify-center rounded-xl shrink-0 ${
                            isDeduction
                              ? 'bg-rose-50 text-rose-600 border border-rose-100'
                              : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                          }`}
                        >
                          {isDeduction ? (
                            <ArrowDownLeft className="h-5 w-5" />
                          ) : (
                            <ArrowUpRight className="h-5 w-5" />
                          )}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-bold text-[#0F172A] truncate">
                            {tx.description || (isDeduction ? 'Delivery Deduction' : 'Wallet Top-Up')}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[#64748B] flex-wrap">
                            <span className="font-medium">
                              {new Date(tx.createdAt).toLocaleDateString([], {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}{' '}
                              at{' '}
                              {new Date(tx.createdAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            <span className="text-[#CBD5E1]">•</span>
                            <span className="font-semibold text-[#0284C7]">
                              {isDeduction ? 'Order Debit' : 'Online Recharge'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0 pl-3">
                        <p
                          className={`text-xs sm:text-sm font-black ${
                            isDeduction ? 'text-[#0F172A]' : 'text-emerald-600'
                          }`}
                        >
                          {isDeduction ? '-' : '+'}₹{Number(tx.amount || 0).toFixed(2)}
                        </p>
                        {typeof tx.balanceAfter === 'number' && (
                          <p className="text-[10px] font-medium text-[#64748B] mt-0.5">
                            Bal: ₹{tx.balanceAfter.toFixed(2)}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Empty State */}
            {transactions.length === 0 && (
              <div className="py-12 px-4 flex flex-col items-center justify-center text-center">
                <div className="w-14 h-14 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center text-[#64748B] mb-3.5 shadow-xs">
                  <Receipt className="w-6 h-6 text-[#64748B]" />
                </div>
                <h3 className="text-sm font-bold text-[#0F172A]">No transactions yet</h3>
                <p className="text-xs text-[#64748B] max-w-xs mt-1 leading-relaxed">
                  Your recharge and delivery deductions will appear here.
                </p>
              </div>
            )}
          </div>
        </motion.section>

        {/* 4. Tips & Alerts: Warmer Amber Cautionary Styling */}
        <motion.section
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-amber-50/80 rounded-2xl p-4 border border-amber-200/80 flex gap-3 items-start"
        >
          <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700 shrink-0 mt-0.5">
            <AlertCircle className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wider">Auto-Debit Notice</h4>
            <p className="text-xs text-amber-900/80 mt-0.5 leading-relaxed font-medium">
              Wallet balance is automatically debited upon each successful delivery. To ensure uninterrupted drops, maintain a balance of at least ₹150.00.
            </p>
          </div>
        </motion.section>

      </div>
    </div>
  );
}
