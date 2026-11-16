import React, { useState, useEffect, useMemo } from 'react';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Plus,
  Download,
  Search,
  RefreshCw,
  Building,
  CreditCard,
  CheckCircle2,
  X,
  Clock,
  ArrowRight,
  Send,
  Loader2,
} from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';
import { showToast } from '../../../utils/toast';
import { DistributorTopbar } from '../components/DistributorTopbar';
import { EdropsPageLoader } from '../../../components/common/EdropsPageLoader';

interface WalletStats {
  totalTopUp: number;
  totalPurchasePaid: number;
  totalCommission: number;
  totalWithdrawal: number;
  totalCodSettlement: number;
  pendingPurchasesDue: number;
  pendingPurchasesCount: number;
}

interface WalletData {
  distributor: {
    id: string;
    agencyName: string;
    routeOrArea?: string;
  };
  wallet: {
    id: string;
    balance: number;
    currency: string;
    updatedAt: string;
  };
  stats: WalletStats;
}

interface WalletTransaction {
  id: string;
  type: 'TOP_UP' | 'PURCHASE_PAYMENT' | 'COMMISSION_CREDIT' | 'COD_SETTLEMENT' | 'WITHDRAWAL' | 'ADJUSTMENT' | 'REFUND';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  referenceId?: string | null;
  description?: string | null;
  createdAt: string;
}

interface PurchaseOption {
  id: string;
  purchaseNumber: string;
  supplierName: string;
  total: number;
  amountPaid: number;
  remainingDue: number;
}

export default function DistributorWalletPage() {
  const [data, setData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Transactions state
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modals state
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);
  const [isPayPurchaseOpen, setIsPayPurchaseOpen] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);

  // Top-Up Form State
  const [topUpAmount, setTopUpAmount] = useState<number | ''>(5000);
  const [topUpMethod, setTopUpMethod] = useState('UPI');
  const [topUpRef, setTopUpRef] = useState('');
  const [topUpNotes, setTopUpNotes] = useState('');
  const [isSubmittingTopUp, setIsSubmittingTopUp] = useState(false);

  // Pay Purchase Form State
  const [unpaidPurchases, setUnpaidPurchases] = useState<PurchaseOption[]>([]);
  const [selectedPurchaseId, setSelectedPurchaseId] = useState('');
  const [payAmount, setPayAmount] = useState<number | ''>('');
  const [loadingPurchases, setLoadingPurchases] = useState(false);
  const [isSubmittingPay, setIsSubmittingPay] = useState(false);

  // Withdraw Form State
  const [withdrawAmount, setWithdrawAmount] = useState<number | ''>('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [withdrawNotes, setWithdrawNotes] = useState('');
  const [isSubmittingWithdraw, setIsSubmittingWithdraw] = useState(false);

  // Load wallet overview
  const loadOverview = async (showToastNotice = false) => {
    try {
      if (showToastNotice) setRefreshing(true);
      const res = await fetchWithAuth('/distributor/wallet/overview');
      setData(res);
      if (showToastNotice) showToast.success('Wallet overview updated');
    } catch (err: any) {
      showToast.error(err.message || 'Failed to load wallet overview');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Load transactions
  const loadTransactions = async () => {
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
      });
      if (selectedType !== 'ALL') params.set('type', selectedType);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());

      const res = await fetchWithAuth(`/distributor/wallet/transactions?${params.toString()}`);
      setTransactions(res.items || []);
      setTotalPages(res.meta?.totalPages || 1);
      setTotalCount(res.meta?.total || 0);
    } catch (err: any) {
      showToast.error(err.message || 'Failed to load wallet transactions');
    }
  };

  // Load unpaid purchases for the settlement modal
  const loadUnpaidPurchases = async () => {
    try {
      setLoadingPurchases(true);
      const res = await fetchWithAuth('/distributor/purchases?limit=100');
      const items = res?.items || res || [];
      const eligible = items
        .filter((p: any) => p.paymentStatus === 'DUE' || p.paymentStatus === 'PARTIAL')
        .map((p: any) => {
          const total = Number(p.total) || 0;
          const amountPaid = Number(p.amountPaid) || 0;
          return {
            id: p.id,
            purchaseNumber: p.purchaseNumber || p.id.slice(0, 8),
            supplierName: p.supplierName || p.supplier?.name || 'Factory Supplier',
            total,
            amountPaid,
            remainingDue: Math.max(0, total - amountPaid),
          };
        });
      setUnpaidPurchases(eligible);
      if (eligible.length > 0) {
        setSelectedPurchaseId(eligible[0].id);
        setPayAmount(eligible[0].remainingDue);
      }
    } catch {
      // Fallback
    } finally {
      setLoadingPurchases(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  useEffect(() => {
    loadTransactions();
  }, [selectedType, searchQuery, page]);

  // Handle Top-Up submission
  const handleTopUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(topUpAmount);
    if (!amount || amount <= 0) {
      showToast.error('Please enter a valid recharge amount');
      return;
    }

    try {
      setIsSubmittingTopUp(true);
      await fetchWithAuth('/distributor/wallet/topup', {
        method: 'POST',
        body: JSON.stringify({
          amount,
          paymentMethod: topUpMethod,
          referenceId: topUpRef.trim() || undefined,
          notes: topUpNotes.trim() || undefined,
        }),
      });

      showToast.success(`Successfully added ₹${amount.toFixed(2)} to your wallet!`);
      setIsTopUpOpen(false);
      setTopUpAmount(5000);
      setTopUpRef('');
      setTopUpNotes('');
      loadOverview();
      loadTransactions();
    } catch (err: any) {
      showToast.error(err.message || 'Failed to recharge wallet');
    } finally {
      setIsSubmittingTopUp(false);
    }
  };

  // Handle Pay Purchase submission
  const handlePayPurchaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPurchaseId) {
      showToast.error('Please select a purchase order to pay');
      return;
    }
    const amount = Number(payAmount);
    if (!amount || amount <= 0) {
      showToast.error('Please enter a valid payment amount');
      return;
    }

    if (data && amount > data.wallet.balance) {
      showToast.error(`Insufficient wallet balance. You have ₹${data.wallet.balance.toFixed(2)}.`);
      return;
    }

    try {
      setIsSubmittingPay(true);
      await fetchWithAuth('/distributor/wallet/pay-purchase', {
        method: 'POST',
        body: JSON.stringify({
          purchaseId: selectedPurchaseId,
          amount,
        }),
      });

      showToast.success(`Successfully paid ₹${amount.toFixed(2)} from your wallet!`);
      setIsPayPurchaseOpen(false);
      setSelectedPurchaseId('');
      setPayAmount('');
      loadOverview();
      loadTransactions();
    } catch (err: any) {
      showToast.error(err.message || 'Purchase payment failed');
    } finally {
      setIsSubmittingPay(false);
    }
  };

  // Handle Withdrawal submission
  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(withdrawAmount);
    if (!amount || amount <= 0) {
      showToast.error('Please enter a valid withdrawal amount');
      return;
    }

    if (data && amount > data.wallet.balance) {
      showToast.error(`Withdrawal amount exceeds your available balance of ₹${data.wallet.balance.toFixed(2)}.`);
      return;
    }

    if (!bankName.trim() || !accountNumber.trim() || !ifscCode.trim()) {
      showToast.error('Please complete all bank payout details');
      return;
    }

    try {
      setIsSubmittingWithdraw(true);
      await fetchWithAuth('/distributor/wallet/withdraw', {
        method: 'POST',
        body: JSON.stringify({
          amount,
          bankName: bankName.trim(),
          accountNumber: accountNumber.trim(),
          ifscCode: ifscCode.trim().toUpperCase(),
          notes: withdrawNotes.trim() || undefined,
        }),
      });

      showToast.success(`Withdrawal request of ₹${amount.toFixed(2)} processed successfully!`);
      setIsWithdrawOpen(false);
      setWithdrawAmount('');
      setBankName('');
      setAccountNumber('');
      setIfscCode('');
      setWithdrawNotes('');
      loadOverview();
      loadTransactions();
    } catch (err: any) {
      showToast.error(err.message || 'Withdrawal failed');
    } finally {
      setIsSubmittingWithdraw(false);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (transactions.length === 0) {
      showToast.error('No transactions available to export');
      return;
    }

    const headers = ['Date', 'Transaction ID', 'Type', 'Amount (INR)', 'Balance Before', 'Balance After', 'Reference', 'Description'];
    const rows = transactions.map((t) => [
      new Date(t.createdAt).toLocaleString('en-IN'),
      t.id,
      t.type,
      t.amount.toFixed(2),
      t.balanceBefore.toFixed(2),
      t.balanceAfter.toFixed(2),
      t.referenceId || '',
      `"${(t.description || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Edrops_Distributor_Wallet_Statement_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast.success('Wallet statement exported as CSV');
  };

  // Format badge
  const getBadge = (type: WalletTransaction['type']) => {
    switch (type) {
      case 'TOP_UP':
      case 'ADJUSTMENT':
        return {
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          label: 'Wallet Top-Up',
          isCredit: true,
        };
      case 'COMMISSION_CREDIT':
        return {
          bg: 'bg-blue-50 text-[#1E88E5] border-blue-200',
          label: 'Delivery Commission',
          isCredit: true,
        };
      case 'PURCHASE_PAYMENT':
        return {
          bg: 'bg-amber-50 text-amber-800 border-amber-200',
          label: 'Purchase Paid',
          isCredit: false,
        };
      case 'WITHDRAWAL':
        return {
          bg: 'bg-purple-50 text-purple-700 border-purple-200',
          label: 'Bank Payout',
          isCredit: false,
        };
      case 'COD_SETTLEMENT':
        return {
          bg: 'bg-cyan-50 text-cyan-800 border-cyan-200',
          label: 'COD Settlement',
          isCredit: false,
        };
      case 'REFUND':
        return {
          bg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
          label: 'Refund Credit',
          isCredit: true,
        };
      default:
        return {
          bg: 'bg-slate-50 text-slate-700 border-slate-200',
          label: type,
          isCredit: true,
        };
    }
  };

  const selectedPurchase = useMemo(() => {
    return unpaidPurchases.find((p) => p.id === selectedPurchaseId);
  }, [unpaidPurchases, selectedPurchaseId]);

  if (loading) {
    return <EdropsPageLoader label="Loading distributor wallet & financial ledger..." />;
  }

  const walletBalance = data?.wallet?.balance ?? 0;
  const stats = data?.stats;

  return (
    <div className="w-full min-h-full flex flex-col bg-[#F8FAFC]">
      {/* ─── STANDARDIZED TOPBAR ─────────────────────────────────── */}
      <DistributorTopbar
        title="Distributor Wallet"
        subtitle="Floating balance for wholesale jar purchases, commission payouts, and live settlement"
        icon={Wallet}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => loadOverview(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[#1677C8]' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              type="button"
              onClick={() => setIsTopUpOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#1677C8] to-[#0E5290] hover:from-[#1366AC] hover:to-[#0B4173] text-white text-xs font-bold shadow-xs transition-all cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Add Funds</span>
            </button>
          </div>
        }
      />

      {/* ─── MAIN CONTENT CONTAINER ──────────────────────────────── */}
      <div className="w-full p-4 sm:p-6 space-y-5 flex-1 max-w-7xl mx-auto">
        
        {/* ─── KPI CARDS GRID ────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* CARD 1: PRIMARY WALLET BALANCE */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#16324F] via-[#1E4B75] to-[#0284C7] p-5 text-white shadow-md">
            <div className="absolute top-0 right-0 -mt-2 -mr-2 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-cyan-200 uppercase tracking-wider">
                Available Wallet Balance
              </span>
              <div className="p-2 rounded-xl bg-white/15 backdrop-blur-xs">
                <Wallet className="w-4 h-4 text-cyan-200" />
              </div>
            </div>
            <div className="mt-3">
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                ₹{walletBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h2>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-cyan-100">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Ready for factory purchase auto-deductions</span>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-white/15 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setIsTopUpOpen(true)}
                className="inline-flex items-center gap-1 text-xs font-bold text-white hover:text-cyan-200 transition-colors cursor-pointer"
              >
                <span>+ Recharge</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsWithdrawOpen(true)}
                className="inline-flex items-center gap-1 text-xs font-medium text-cyan-100 hover:text-white transition-colors cursor-pointer"
              >
                <span>Payout</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* CARD 2: WHOLESALE PURCHASE DUES */}
          <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                Plant Purchases Due
              </span>
              <div className="p-2 rounded-xl bg-amber-100 text-amber-800">
                <Building className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-amber-950">
                ₹{(stats?.pendingPurchasesDue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </h2>
              <p className="mt-1 text-xs text-amber-800">
                {stats?.pendingPurchasesCount || 0} unpaid / partial wholesale order(s)
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-amber-200/80">
              <button
                type="button"
                onClick={() => {
                  loadUnpaidPurchases();
                  setIsPayPurchaseOpen(true);
                }}
                className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-2xs"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Pay Orders via Wallet</span>
              </button>
            </div>
          </div>

          {/* CARD 3: TOTAL TOP-UP / RECHARGE INFLOW */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Total Deposits / Inflow
              </span>
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                <ArrowDownLeft className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
                ₹{(stats?.totalTopUp || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Lifetime funds credited into wallet
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Commissions:</span>
              <span className="font-bold text-emerald-600">+₹{(stats?.totalCommission || 0).toFixed(2)}</span>
            </div>
          </div>

          {/* CARD 4: TOTAL PURCHASE DEBITS & WITHDRAWALS */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Total Settled / Outflow
              </span>
              <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
                ₹{(stats?.totalPurchasePaid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Paid directly to water plants & suppliers
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Bank Payouts:</span>
              <span className="font-bold text-purple-600">₹{(stats?.totalWithdrawal || 0).toFixed(2)}</span>
            </div>
          </div>

        </div>

        {/* ─── TRANSACTION LEDGER CARD ────────────────────────────── */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          
          {/* Card Header & Controls */}
          <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white">
            <div>
              <h3 className="text-base font-bold text-slate-900">Wallet Transaction History</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Complete audit ledger with verified before & after balances
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Filter Tabs */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold overflow-x-auto">
                {['ALL', 'TOP_UP', 'PURCHASE_PAYMENT', 'WITHDRAWAL', 'COMMISSION_CREDIT'].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setSelectedType(t);
                      setPage(1);
                    }}
                    className={`px-3 py-1.5 rounded-lg whitespace-nowrap cursor-pointer transition-colors ${
                      selectedType === t
                        ? 'bg-white text-[#1677C8] font-bold shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {t === 'ALL'
                      ? 'All'
                      : t === 'TOP_UP'
                      ? 'Recharges'
                      : t === 'PURCHASE_PAYMENT'
                      ? 'Purchases'
                      : t === 'WITHDRAWAL'
                      ? 'Payouts'
                      : 'Commissions'}
                  </button>
                ))}
              </div>

              {/* Search Box */}
              <div className="relative min-w-[160px] sm:min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search reference..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-[#1677C8]"
                />
              </div>

              {/* Export CSV Button */}
              <button
                type="button"
                onClick={handleExportCSV}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">Export CSV</span>
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Description / Reference</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-right">Balance Before</th>
                  <th className="py-3 px-4 text-right">Balance After</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Wallet className="w-8 h-8 text-slate-300" />
                        <p className="text-sm font-semibold text-slate-600">No wallet transactions recorded yet</p>
                        <p className="text-xs text-slate-400">Add funds or settle wholesale purchases to view activity.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => {
                    const badge = getBadge(tx.type);
                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-4 whitespace-nowrap text-slate-600 font-medium">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>{new Date(tx.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                            <span className="text-[10px] text-slate-400">
                              {new Date(tx.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold border ${badge.bg}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 max-w-xs sm:max-w-md">
                          <p className="font-semibold text-slate-900 truncate">{tx.description || 'Transaction'}</p>
                          {tx.referenceId && (
                            <p className="text-[10px] font-mono text-slate-400 truncate">Ref: {tx.referenceId}</p>
                          )}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap text-right">
                          <span className={`font-black text-sm ${badge.isCredit ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {badge.isCredit ? '+' : '-'}₹{tx.amount.toFixed(2)}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap text-right text-slate-500 font-medium">
                          ₹{tx.balanceBefore.toFixed(2)}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap text-right font-bold text-slate-900">
                          ₹{tx.balanceAfter.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div className="p-3 sm:p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 bg-slate-50/50">
              <span>Showing {transactions.length} of {totalCount} transactions</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 cursor-pointer font-medium"
                >
                  Previous
                </button>
                <span className="px-2 font-bold text-slate-700">Page {page} of {totalPages}</span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 cursor-pointer font-medium"
                >
                  Next
                </button>
              </div>
            </div>
          )}

        </div>

      </div>

      {/* ─── MODAL 1: TOP-UP / RECHARGE WALLET ───────────────────── */}
      {isTopUpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                  <ArrowDownLeft className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Recharge Distributor Wallet</h3>
                  <p className="text-xs text-slate-500">Deposit funds for instant factory purchases</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTopUpOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleTopUpSubmit} className="mt-4 space-y-4">
              {/* Preset Amount Chips */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Select Preset Amount</label>
                <div className="grid grid-cols-4 gap-2">
                  {[2000, 5000, 10000, 25000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setTopUpAmount(amt)}
                      className={`py-2 px-1 text-center rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                        topUpAmount === amt
                          ? 'border-[#1677C8] bg-blue-50/80 text-[#1677C8]'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      ₹{amt.toLocaleString('en-IN')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Amount */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Recharge Amount (₹)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">₹</span>
                  <input
                    type="number"
                    min="1"
                    required
                    value={topUpAmount}
                    onChange={(e) => setTopUpAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full pl-8 pr-3 py-2 text-sm font-bold rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#1677C8]"
                    placeholder="Enter amount..."
                  />
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Deposit Method</label>
                <select
                  value={topUpMethod}
                  onChange={(e) => setTopUpMethod(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#1677C8]"
                >
                  <option value="UPI">UPI / GPay / PhonePe</option>
                  <option value="BANK_TRANSFER">Bank Transfer (IMPS / NEFT)</option>
                  <option value="NETBANKING">Net Banking</option>
                  <option value="CASH_DEPOSIT">Cash Deposit at Plant</option>
                </select>
              </div>

              {/* Reference ID */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Payment Reference / UTR Number</label>
                <input
                  type="text"
                  placeholder="e.g. UTR / Bank Reference number"
                  value={topUpRef}
                  onChange={(e) => setTopUpRef(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#1677C8]"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="Reason / notes..."
                  value={topUpNotes}
                  onChange={(e) => setTopUpNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#1677C8]"
                />
              </div>

              {/* Submit */}
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsTopUpOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTopUp}
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                >
                  {isSubmittingTopUp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  <span>{isSubmittingTopUp ? 'Recharging...' : 'Confirm Recharge'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: PAY WHOLESALE PURCHASE FROM WALLET ─────────── */}
      {isPayPurchaseOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-lg bg-white rounded-2xl p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-50 text-amber-700">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Settle Wholesale Purchase</h3>
                  <p className="text-xs text-slate-500">Pay factory supplier directly using your wallet balance</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPayPurchaseOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingPurchases ? (
              <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
                <p className="text-xs">Loading outstanding purchases...</p>
              </div>
            ) : unpaidPurchases.length === 0 ? (
              <div className="py-8 text-center text-slate-500">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                <h4 className="font-bold text-slate-800 text-sm">All Purchases are Fully Paid!</h4>
                <p className="text-xs text-slate-400 mt-1">There are no pending or partially paid wholesale orders.</p>
                <button
                  type="button"
                  onClick={() => setIsPayPurchaseOpen(false)}
                  className="mt-4 px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handlePayPurchaseSubmit} className="mt-4 space-y-4">
                {/* Available Balance Reminder */}
                <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl flex items-center justify-between text-xs">
                  <span className="text-blue-900 font-medium">Your Available Wallet Balance:</span>
                  <span className="font-black text-sm text-[#1677C8]">₹{walletBalance.toFixed(2)}</span>
                </div>

                {/* Purchase Select */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Select Purchase Order</label>
                  <select
                    value={selectedPurchaseId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedPurchaseId(id);
                      const found = unpaidPurchases.find((p) => p.id === id);
                      if (found) setPayAmount(found.remainingDue);
                    }}
                    className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#1677C8]"
                  >
                    {unpaidPurchases.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.purchaseNumber} — {p.supplierName} (Due: ₹{p.remainingDue.toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Selected Purchase Summary */}
                {selectedPurchase && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-500">
                      <span>Total Invoice Amount:</span>
                      <span className="font-bold text-slate-800">₹{selectedPurchase.total.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Already Paid:</span>
                      <span className="font-bold text-emerald-600">₹{selectedPurchase.amountPaid.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-700 font-bold border-t border-slate-200 pt-1">
                      <span>Outstanding Balance Due:</span>
                      <span className="text-amber-800">₹{selectedPurchase.remainingDue.toFixed(2)}</span>
                    </div>
                  </div>
                )}

                {/* Amount to Pay */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Payment Amount (₹)</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">₹</span>
                    <input
                      type="number"
                      min="1"
                      max={selectedPurchase?.remainingDue}
                      required
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full pl-8 pr-3 py-2 text-sm font-bold rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#1677C8]"
                    />
                  </div>
                </div>

                {/* Submit */}
                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPayPurchaseOpen(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingPay || Number(payAmount) > walletBalance}
                    className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isSubmittingPay ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CreditCard className="w-3.5 h-3.5" />}
                    <span>{isSubmittingPay ? 'Paying...' : 'Confirm Wallet Payment'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ─── MODAL 3: WITHDRAWAL / BANK PAYOUT ────────────────────── */}
      {isWithdrawOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-50 text-purple-700">
                  <ArrowUpRight className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Request Bank Payout</h3>
                  <p className="text-xs text-slate-500">Withdraw wallet earnings to your registered bank account</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsWithdrawOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleWithdrawSubmit} className="mt-4 space-y-3.5">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                <span className="text-slate-500">Maximum Withdrawable:</span>
                <span className="font-black text-sm text-slate-900">₹{walletBalance.toFixed(2)}</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Withdrawal Amount (₹)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">₹</span>
                  <input
                    type="number"
                    min="1"
                    max={walletBalance}
                    required
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full pl-8 pr-3 py-2 text-sm font-bold rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#1677C8]"
                    placeholder="Enter amount..."
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Bank Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HDFC Bank, SBI, ICICI"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#1677C8]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Account Number</label>
                <input
                  type="text"
                  required
                  placeholder="Enter account number"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#1677C8]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">IFSC Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HDFC0001234"
                  value={ifscCode}
                  onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 text-xs font-mono uppercase rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#1677C8]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="Optional reference notes..."
                  value={withdrawNotes}
                  onChange={(e) => setWithdrawNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#1677C8]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsWithdrawOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingWithdraw || Number(withdrawAmount) > walletBalance}
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingWithdraw ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>{isSubmittingWithdraw ? 'Submitting...' : 'Submit Payout Request'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
