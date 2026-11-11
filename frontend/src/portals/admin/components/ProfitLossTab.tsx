import { useState, useEffect, useCallback } from 'react';
import {
  DollarSign,
  Package,
  Plus,
  Trash2,
  Receipt,
  RotateCw,
  Building2,
  Fuel,
  Users,
  Wrench,
  Zap,
  ShieldCheck,
  X,
} from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';
import { toast } from '../../../utils/toast';

interface PnLData {
  period: {
    preset: string;
    startDate: string;
    endDate: string;
  };
  summary: {
    totalNetRevenue: number;
    totalCogs: number;
    grossProfit: number;
    grossMarginPercent: number;
    totalOpex: number;
    netOperatingProfit: number;
    netProfitMarginPercent: number;
    customerJarDepositLiability: number;
  };
  revenueBreakdown: {
    netOperatingOrderRevenue: number;
    subscriptionRevenue: number;
    customerJarDepositLiability: number;
    totalWaterJarsSold: number;
    totalOrdersCount: number;
    totalSubscriptionsCount: number;
  };
  cogsBreakdown: {
    totalCogs: number;
    waterJarsCost: number;
    otherGoodsCost: number;
    subscriptionJarsDelivered?: number;
    subscriptionJarsCost?: number;
    retailJarsDelivered?: number;
    retailJarsCost?: number;
  };
  opexBreakdown: {
    totalOpex: number;
    categories: Record<string, { label: string; amount: number; count: number }>;
  };
  recentExpenses: Array<{
    id: string;
    title: string;
    category: string;
    amount: number;
    expenseDate: string;
    paymentMethod: string;
    paymentStatus: string;
    vendorName?: string;
  }>;
}

interface ProfitLossTabProps {
  preset: string;
  customStart?: string;
  customEnd?: string;
}

export default function ProfitLossTab({ preset, customStart, customEnd }: ProfitLossTabProps) {
  const [data, setData] = useState<PnLData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [submittingExpense, setSubmittingExpense] = useState(false);

  // Expense form state
  const [category, setCategory] = useState('FUEL');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [vendorName, setVendorName] = useState('');
  const [notes, setNotes] = useState('');

  const loadPnL = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      let url = `/report/admin/pnl?preset=${preset}`;
      if (preset === 'CUSTOM' && customStart && customEnd) {
        url += `&startDate=${encodeURIComponent(customStart)}&endDate=${encodeURIComponent(customEnd)}`;
      }
      let res;
      try {
        res = await fetchWithAuth(url);
      } catch {
        res = await fetchWithAuth(url.replace('/report/admin/pnl', '/staff/reports/pnl'));
      }
      setData(res);
    } catch (err: any) {
      toast.error('Failed to load Profit & Loss statement');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [preset, customStart, customEnd]);

  useEffect(() => {
    loadPnL();
  }, [loadPnL]);

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!title.trim()) {
      toast.error('Please enter an expense title');
      return;
    }
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error('Please enter a valid expense amount');
      return;
    }

    setSubmittingExpense(true);
    try {
      await fetchWithAuth('/expenses', {
        method: 'POST',
        body: JSON.stringify({
          category,
          title: title.trim(),
          amount: numAmount,
          paymentMethod,
          vendorName: vendorName.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });

      toast.success('Expense recorded successfully!');
      setIsExpenseModalOpen(false);
      setTitle('');
      setAmount('');
      setVendorName('');
      setNotes('');
      await loadPnL(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to record expense');
    } finally {
      setSubmittingExpense(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this expense record?')) return;
    try {
      await fetchWithAuth(`/expenses/${id}`, { method: 'DELETE' });
      toast.success('Expense deleted');
      await loadPnL(true);
    } catch (err: any) {
      toast.error('Failed to delete expense');
    }
  };

  const formatINR = (val: number) => {
    return `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat.toUpperCase()) {
      case 'FUEL':
        return <Fuel className="w-4 h-4 text-amber-500" />;
      case 'RENT':
        return <Building2 className="w-4 h-4 text-blue-500" />;
      case 'SALARIES':
        return <Users className="w-4 h-4 text-emerald-500" />;
      case 'MAINTENANCE':
        return <Wrench className="w-4 h-4 text-rose-500" />;
      case 'UTILITIES':
        return <Zap className="w-4 h-4 text-yellow-500" />;
      default:
        return <Receipt className="w-4 h-4 text-slate-500" />;
    }
  };

  if (loading) {
    return (
      <div className="py-16 text-center">
        <RotateCw className="w-8 h-8 text-[#1677C8] animate-spin mx-auto mb-3" />
        <p className="text-sm font-semibold text-slate-600">Calculating Profit & Loss Statement...</p>
      </div>
    );
  }

  if (!data) return null;

  const isNetProfit = data.summary.netOperatingProfit >= 0;

  return (
    <div className="space-y-4">
      {/* ─── ACTION BAR ────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200">
        <div>
          <h2 className="text-sm font-bold text-slate-800">Executive Income Statement (P&L)</h2>
          <p className="text-[11px] text-slate-500">
            Realized operating revenue, Aquzio production COGS, and overhead expenses
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => loadPnL(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 transition-colors"
          >
            <RotateCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[#1677C8]' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={() => setIsExpenseModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1677C8] hover:bg-[#1264a8] text-white text-xs font-bold shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Record Expense</span>
          </button>
        </div>
      </div>

      {/* ─── 1. TOP 5 EXECUTIVE KPI CARDS ─────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Net Revenue */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Net Operating Revenue</span>
            <DollarSign className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-xl font-black text-slate-900">{formatINR(data.summary.totalNetRevenue)}</div>
          <p className="text-[11px] text-slate-500 mt-1">
            Orders ({formatINR(data.revenueBreakdown.netOperatingOrderRevenue)}) + Subs ({formatINR(data.revenueBreakdown.subscriptionRevenue)})
          </p>
        </div>

        {/* COGS */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cost of Goods (COGS)</span>
            <Package className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-black text-amber-600">-{formatINR(data.summary.totalCogs)}</div>
          <p className="text-[11px] text-slate-500 mt-1">
            {data.revenueBreakdown.totalWaterJarsSold} Jars @ ₹20 from Aquzio plant
          </p>
        </div>

        {/* Gross Profit */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gross Profit</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
              {data.summary.grossMarginPercent}%
            </span>
          </div>
          <div className="text-xl font-black text-emerald-700">{formatINR(data.summary.grossProfit)}</div>
          <p className="text-[11px] text-slate-500 mt-1">Revenue minus production costs</p>
        </div>

        {/* Total OPEX */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Operating Expenses</span>
            <Receipt className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-xl font-black text-rose-600">-{formatINR(data.summary.totalOpex)}</div>
          <p className="text-[11px] text-slate-500 mt-1">Overhead (Fuel, Rent, Wages)</p>
        </div>

        {/* Net Operating Profit / Loss */}
        <div
          className={`p-3.5 rounded-2xl border shadow-xs ${
            isNetProfit ? 'bg-emerald-50/50 border-emerald-200' : 'bg-rose-50/50 border-rose-200'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span
              className={`text-[10px] font-bold uppercase tracking-wider ${
                isNetProfit ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              Net Profit / (Loss)
            </span>
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                isNetProfit ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
              }`}
            >
              {data.summary.netProfitMarginPercent}%
            </span>
          </div>
          <div className={`text-xl font-black ${isNetProfit ? 'text-emerald-700' : 'text-rose-700'}`}>
            {isNetProfit ? '+' : ''}
            {formatINR(data.summary.netOperatingProfit)}
          </div>
          <p className="text-[11px] text-slate-600 mt-1">Bottom line business earnings</p>
        </div>
      </div>

      {/* ─── DEPOSIT LIABILITY NOTICE BANNER ────────────────────── */}
      <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-3 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-900 leading-relaxed">
          <strong className="font-bold">Accounting Compliance:</strong> Customer Jar Deposit Liability of{' '}
          <strong className="underline font-bold">{formatINR(data.summary.customerJarDepositLiability)}</strong> is
          strictly separated from revenue and held as a balance sheet liability. Refundable deposits are never recognized
          as operating income.
        </div>
      </div>

      {/* ─── 2. DETAILED GAAP INCOME STATEMENT ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Column: Line-item Statement */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-3.5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Statement of Profit & Loss</h3>
            <span className="text-[11px] text-slate-400">Values in INR (₹)</span>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            {/* Section 1: Revenue */}
            <div className="p-3 bg-slate-50/50">
              <span className="font-bold text-slate-900 uppercase text-[11px]">1. Operating Revenue</span>
            </div>
            <div className="px-4 py-2 flex justify-between text-slate-600">
              <span className="pl-3">• Packaged Water & Retail Orders ({data.revenueBreakdown.totalOrdersCount} orders)</span>
              <span className="font-semibold text-slate-800">{formatINR(data.revenueBreakdown.netOperatingOrderRevenue)}</span>
            </div>
            <div className="px-4 py-2 flex justify-between text-slate-600">
              <span className="pl-3">• Subscription & Package Deliveries ({data.revenueBreakdown.totalSubscriptionsCount} purchases)</span>
              <span className="font-semibold text-slate-800">{formatINR(data.revenueBreakdown.subscriptionRevenue)}</span>
            </div>
            <div className="px-4 py-2 flex justify-between text-slate-400 italic text-[11px]">
              <span className="pl-3">Less: Customer Refundable Jar Deposits (Held as Liability)</span>
              <span>({formatINR(data.revenueBreakdown.customerJarDepositLiability)})</span>
            </div>
            <div className="px-4 py-2.5 flex justify-between font-bold text-sky-800 bg-sky-50/40">
              <span>= Total Net Operating Revenue</span>
              <span>{formatINR(data.summary.totalNetRevenue)}</span>
            </div>

            {/* Section 2: COGS */}
            <div className="p-3 bg-slate-50/50">
              <span className="font-bold text-slate-900 uppercase text-[11px]">2. Cost of Goods Sold (COGS)</span>
            </div>
            <div className="px-4 py-2 flex justify-between text-slate-600">
              <span className="pl-3">
                • 20L Commercial Water Jars ({data.revenueBreakdown.totalWaterJarsSold} Jars @ ₹20 Aquzio Plant Cost)
              </span>
              <span className="font-semibold text-amber-700">-{formatINR(data.cogsBreakdown.waterJarsCost)}</span>
            </div>
            {Boolean(data.cogsBreakdown.subscriptionJarsDelivered && data.cogsBreakdown.subscriptionJarsDelivered > 0) && (
              <div className="px-4 py-1 flex justify-between text-[11px] text-slate-500 bg-slate-50/30">
                <span className="pl-6 font-medium">↳ Subscription deliveries fulfilled ({data.cogsBreakdown.subscriptionJarsDelivered} Jars)</span>
                <span className="text-amber-700">-{formatINR(data.cogsBreakdown.subscriptionJarsCost || 0)}</span>
              </div>
            )}
            {Boolean(data.cogsBreakdown.retailJarsDelivered && data.cogsBreakdown.retailJarsDelivered > 0) && (
              <div className="px-4 py-1 flex justify-between text-[11px] text-slate-500 bg-slate-50/30">
                <span className="pl-6 font-medium">↳ Retail orders fulfilled ({data.cogsBreakdown.retailJarsDelivered} Jars)</span>
                <span className="text-amber-700">-{formatINR(data.cogsBreakdown.retailJarsCost || 0)}</span>
              </div>
            )}
            {data.cogsBreakdown.otherGoodsCost > 0 && (
              <div className="px-4 py-2 flex justify-between text-slate-600">
                <span className="pl-3">• Other Finished Products Procurement Cost</span>
                <span className="font-semibold text-amber-700">-{formatINR(data.cogsBreakdown.otherGoodsCost)}</span>
              </div>
            )}
            <div className="px-4 py-2 text-[11px] text-slate-500 bg-slate-50/60 pl-7 leading-relaxed">
              💡 <em>Plant COGS note:</em> Every 20L jar delivered costs ₹20.00 from the Aquzio plant. Promotional / free trial jars (₹0 order total) legitimately reflect this ₹20 manufacturing cost as customer acquisition overhead.
            </div>
            <div className="px-4 py-2.5 flex justify-between font-bold text-amber-900 bg-amber-50/40">
              <span>= Total COGS</span>
              <span>-{formatINR(data.summary.totalCogs)}</span>
            </div>

            {/* GROSS PROFIT */}
            <div className="px-4 py-3 flex justify-between font-black text-emerald-800 bg-emerald-50/60 text-sm">
              <span>= GROSS PROFIT ({data.summary.grossMarginPercent}% Margin)</span>
              <span>{formatINR(data.summary.grossProfit)}</span>
            </div>

            {/* Section 3: OPEX */}
            <div className="p-3 bg-slate-50/50">
              <span className="font-bold text-slate-900 uppercase text-[11px]">3. Operating Expenses (OPEX)</span>
            </div>
            {Object.entries(data.opexBreakdown.categories).map(([catKey, cat]) => {
              if (cat.amount === 0) return null;
              return (
                <div key={catKey} className="px-4 py-2 flex justify-between text-slate-600">
                  <span className="pl-3 flex items-center gap-2">
                    {getCategoryIcon(catKey)}
                    <span>{cat.label} ({cat.count})</span>
                  </span>
                  <span className="font-semibold text-rose-700">-{formatINR(cat.amount)}</span>
                </div>
              );
            })}
            {data.summary.totalOpex === 0 && (
              <div className="px-4 py-3 text-slate-400 italic text-center">
                No operating expenses recorded for this period. Click "+ Record Expense" to log overhead.
              </div>
            )}
            <div className="px-4 py-2.5 flex justify-between font-bold text-rose-900 bg-rose-50/40">
              <span>= Total Operating Expenses</span>
              <span>-{formatINR(data.summary.totalOpex)}</span>
            </div>

            {/* FINAL NET OPERATING PROFIT / LOSS */}
            <div
              className={`px-4 py-4 flex justify-between font-black text-base ${
                isNetProfit ? 'text-emerald-900 bg-emerald-100/70' : 'text-rose-900 bg-rose-100/70'
              }`}
            >
              <span>= NET OPERATING PROFIT / (LOSS)</span>
              <span>
                {isNetProfit ? '+' : ''}
                {formatINR(data.summary.netOperatingProfit)}
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Expense Category Summary & Recent Expenses */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Overhead Breakdown</h3>
              <span className="text-[11px] font-bold text-slate-500">{formatINR(data.summary.totalOpex)}</span>
            </div>
            <div className="space-y-2">
              {Object.entries(data.opexBreakdown.categories).map(([catKey, cat]) => (
                <div key={catKey} className="flex items-center justify-between text-xs py-1 border-b border-slate-50 last:border-0">
                  <div className="flex items-center gap-2 text-slate-600">
                    {getCategoryIcon(catKey)}
                    <span>{cat.label.split('&')[0].trim()}</span>
                  </div>
                  <span className={`font-bold ${cat.amount > 0 ? 'text-slate-800' : 'text-slate-300'}`}>
                    {formatINR(cat.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Expenses List */}
          <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Recent Expenses</h3>
              <span className="text-[10px] text-slate-400">{data.recentExpenses.length} entries</span>
            </div>

            {data.recentExpenses.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs">
                <Receipt className="w-6 h-6 mx-auto mb-1 opacity-50" />
                No expenses logged yet.
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {data.recentExpenses.map((exp) => (
                  <div key={exp.id} className="p-2 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-semibold text-slate-800">{exp.title}</div>
                      <div className="text-[10px] text-slate-400">
                        {new Date(exp.expenseDate).toLocaleDateString()} • {exp.paymentMethod}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-rose-600">-{formatINR(exp.amount)}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteExpense(exp.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── MODAL: RECORD EXPENSE ─────────────────────────────── */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-100">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-xl border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-[#1677C8]" />
                <span>Record Operational Expense</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsExpenseModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateExpense} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Expense Category *</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#1677C8]"
                >
                  <option value="FUEL">⛽ Fuel & Delivery Vehicles</option>
                  <option value="RENT">🏢 Warehouse & Godown Rent</option>
                  <option value="SALARIES">👥 Staff & Driver Wages</option>
                  <option value="MAINTENANCE">🔧 Vehicle & Equipment Maintenance</option>
                  <option value="UTILITIES">⚡ Electricity & Water Utilities</option>
                  <option value="MARKETING">📢 Marketing & Promotions</option>
                  <option value="PACKAGING">📦 Packaging & Caps</option>
                  <option value="OTHER">📋 General & Administrative</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Title / Description *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Diesel for Delivery Van KL-10-AB-1234"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#1677C8]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Amount (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#1677C8] font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#1677C8]"
                  >
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI / GPay / PhonePe</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Vendor / Payee Name</label>
                <input
                  type="text"
                  placeholder="e.g. Indian Oil Kondotty, Landlord"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#1677C8]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Notes / Receipt Reference</label>
                <textarea
                  rows={2}
                  placeholder="Optional reference notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#1677C8]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingExpense}
                  className="px-4 py-1.5 rounded-xl bg-[#1677C8] hover:bg-[#1264a8] text-white font-bold shadow-sm transition-colors cursor-pointer"
                >
                  {submittingExpense ? 'Saving...' : 'Record Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
