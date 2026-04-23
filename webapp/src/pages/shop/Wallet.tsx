import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  useWallet,
  useWalletTransactions,
  useCreateRechargeOrder,
  useVerifyWalletRecharge,
} from '../../lib/shopApi';
import ClayCard from '../../components/shop/ui/ClayCard';
import ClayButton from '../../components/shop/ui/ClayButton';
import { Wallet, Plus, ArrowUpRight, ArrowDownLeft, ChevronRight } from 'lucide-react';

declare global {
  interface Window {
    Razorpay: any;
  }
}

const RECHARGE_AMOUNTS = [50, 100, 200, 500, 1000];

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

export default function WalletPage() {
  const [page, setPage] = useState(1);
  const [customAmount, setCustomAmount] = useState('');
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);

  const { data: wallet, isLoading: walletLoading } = useWallet();
  const { data: txData, isLoading: txLoading } = useWalletTransactions(page);

  const createRechargeOrder = useCreateRechargeOrder();
  const verifyRecharge = useVerifyWalletRecharge();

  const balance = Number(wallet?.balance ?? 0);
  const transactions = txData?.data ?? [];
  const totalTx = txData?.total ?? 0;

  const handleRecharge = async () => {
    const amount = Number(customAmount) || selectedAmount;
    if (!amount || amount < 10) {
      alert('Minimum recharge amount is ₹10');
      return;
    }

    const loaded = await loadRazorpay();
    if (!loaded) {
      alert('Failed to load Razorpay. Check your internet connection.');
      return;
    }

    const order = await createRechargeOrder.mutateAsync(amount);

    const options = {
      key: order.key,
      amount: order.amount,
      currency: order.currency,
      name: order.name,
      description: order.description,
      order_id: order.razorpayOrderId,
      handler: async (response: any) => {
        await verifyRecharge.mutateAsync({
          amount,
          razorpayOrderId: order.razorpayOrderId,
          razorpayPaymentId: response.razorpay_payment_id,
          razorpaySignature: response.razorpay_signature,
        });
        setCustomAmount('');
        setSelectedAmount(null);
        alert('Wallet recharged successfully! ✅');
      },
      prefill: { contact: wallet?.user?.phone },
      theme: { color: '#4F8CFF' },
    };

    const rzp = new window.Razorpay(options);
    rzp.open();
  };

  return (
    <div className="space-y-4 pb-6">
      <h2 className="text-2xl font-bold ml-1">Wallet</h2>

      {/* Balance Card */}
      <ClayCard className="bg-linear-to-br from-primary to-primary/80 text-primary-foreground text-center py-8">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Wallet className="w-5 h-5 opacity-80" />
          <span className="text-sm opacity-80 font-medium">Available Balance</span>
        </div>
        {walletLoading ? (
          <div className="h-12 w-32 bg-white/20 rounded-xl animate-pulse mx-auto" />
        ) : (
          <p className="text-5xl font-extrabold tracking-tight">
            ₹<span>{balance.toFixed(0)}</span>
            <span className="text-2xl opacity-60">.{(balance % 1).toFixed(2).slice(2)}</span>
          </p>
        )}
      </ClayCard>

      {/* Recharge */}
      <ClayCard>
        <h3 className="font-semibold text-base mb-3">Recharge Wallet</h3>

        {/* Quick amounts */}
        <div className="grid grid-cols-5 gap-2 mb-3">
          {RECHARGE_AMOUNTS.map((amt) => (
            <button
              key={amt}
              onClick={() => { setSelectedAmount(amt); setCustomAmount(''); }}
              className={`py-2 rounded-xl text-sm font-semibold transition-all
                ${selectedAmount === amt ? 'bg-primary text-primary-foreground shadow-md' : 'bg-card text-foreground'}`}
              style={{ boxShadow: selectedAmount === amt ? undefined : '2px 2px 4px #d1d9e6, -2px -2px 4px #ffffff' }}
            >
              ₹{amt}
            </button>
          ))}
        </div>

        {/* Custom amount */}
        <div className="relative mb-3">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">₹</span>
          <input
            type="number"
            placeholder="Enter custom amount"
            value={customAmount}
            onChange={(e) => { setCustomAmount(e.target.value); setSelectedAmount(null); }}
            className="clay-input pl-8"
            min="10"
          />
        </div>

        <ClayButton
          className="w-full gap-2"
          onClick={handleRecharge}
          disabled={createRechargeOrder.isPending || verifyRecharge.isPending || (!selectedAmount && !customAmount)}
        >
          <Plus className="w-4 h-4" />
          {createRechargeOrder.isPending ? 'Opening Razorpay...' : `Recharge ₹${customAmount || selectedAmount || ''}`}
        </ClayButton>
      </ClayCard>

      {/* Transactions */}
      <div>
        <div className="flex items-center justify-between mb-3 ml-1">
          <h3 className="font-semibold text-base">Transactions</h3>
          <span className="text-xs text-muted-foreground">{totalTx} total</span>
        </div>

        {txLoading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="clay-card animate-pulse h-14" />
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <ClayCard className="text-center py-8">
            <p className="text-muted-foreground text-sm">No transactions yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Recharge your wallet to get started.</p>
          </ClayCard>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => (
              <ClayCard key={tx.id} className="flex items-center gap-3 py-3 px-4">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0
                  ${tx.type === 'CREDIT' ? 'bg-green-100' : 'bg-red-100'}`}>
                  {tx.type === 'CREDIT'
                    ? <ArrowDownLeft className="w-4 h-4 text-green-600" />
                    : <ArrowUpRight className="w-4 h-4 text-red-500" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-tight line-clamp-1">
                    {tx.description || (tx.type === 'CREDIT' ? 'Wallet Credit' : 'Wallet Debit')}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(tx.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </div>
                <span className={`font-bold text-sm shrink-0
                  ${tx.type === 'CREDIT' ? 'text-green-600' : 'text-red-500'}`}>
                  {tx.type === 'CREDIT' ? '+' : '-'}₹{Number(tx.amount)}
                </span>
              </ClayCard>
            ))}

            {/* Pagination */}
            {totalTx > page * 20 && (
              <button
                onClick={() => setPage(p => p + 1)}
                className="w-full text-sm text-primary font-medium py-2 flex items-center justify-center gap-1"
              >
                Load more <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
