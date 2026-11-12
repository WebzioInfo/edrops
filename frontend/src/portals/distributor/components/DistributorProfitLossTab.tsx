import React, { useState, useEffect, useCallback } from 'react';
import {
  DollarSign,
  TrendingUp,
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
  AlertCircle,
  Truck,
  FileText,
  Printer,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Info,
} from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';
import { toast } from '../../../utils/toast';

export interface DistributorPnlData {
  distributor: {
    id: string;
    userId: string;
    agencyName: string;
    routeOrArea?: string | null;
    jarDepositRate: number;
    companyOwnedJars: number;
    distributorOwnedJars: number;
  };
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
    operatingProfit: number;
    netProfitBeforeTax: number;
    netProfitMarginPercent: number;
    customerJarDepositLiability: number;
    customerOutstandingReceivables: number;
    supplierOutstandingPayables: number;
  };
  revenueBreakdown: {
    grossRetailRevenue: number;
    totalOrderDiscounts: number;
    customerJarDepositLiability: number;
    netOperatingRetailRevenue: number;
    netAccessoryRevenue: number;
    subscriptionFulfillmentIncome: number;
    totalWaterJarsDelivered: number;
    totalAccessoryUnits: number;
    totalOrdersCount: number;
    customerCollectedPayments: number;
    customerOutstandingReceivables: number;
  };
  cogsBreakdown: {
    totalCogs: number;
    waterJarCogs: number;
    accessoryCogs: number;
    inventoryWriteOffs: number;
    unitWaterJarRateUsed: number;
    jarAssetRateUsed?: number;
    isCogsEstimated: boolean;
    damagedJarsCount: number;
  };
  opexBreakdown: {
    totalOpex: number;
    categories: Record<string, { label: string; amount: number; count: number }>;
    totalExpenseCount: number;
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
    invoiceNumber?: string;
  }>;
  auditFlags: {
    cogsEstimationNote: string;
    subscriptionRevenueExcluded: string;
    customerDepositsIsolated: string;
  };
}

interface DistributorProfitLossTabProps {
  preset: string;
  customStart?: string;
  customEnd?: string;
}

const EXPENSE_CATEGORY_CONFIG: Record<
  string,
  { label: string; icon: any; color: string; bg: string }
> = {
  FUEL: { label: 'Fuel & Delivery Vehicles', icon: Fuel, color: 'text-amber-600', bg: 'bg-amber-50' },
  VEHICLE_MAINTENANCE: { label: 'Vehicle Maintenance & Repairs', icon: Wrench, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  DRIVER_SALARY: { label: 'Driver & Delivery Wages', icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
  HELPER_SALARY: { label: 'Helper & Loading Wages', icon: Users, color: 'text-cyan-600', bg: 'bg-cyan-50' },
  RENT: { label: 'Depot & Storage Rent', icon: Building2, color: 'text-purple-600', bg: 'bg-purple-50' },
  ELECTRICITY: { label: 'Electricity Utilities', icon: Zap, color: 'text-yellow-600', bg: 'bg-yellow-50' },
  WATER: { label: 'Water Utilities', icon: DropletIcon, color: 'text-sky-600', bg: 'bg-sky-50' },
  LOADING_UNLOADING: { label: 'Loading & Coolie Charges', icon: Package, color: 'text-orange-600', bg: 'bg-orange-50' },
  TRANSPORTATION: { label: 'Freight & Logistics', icon: Truck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  PACKAGING: { label: 'Packaging & Caps', icon: Layers, color: 'text-rose-600', bg: 'bg-rose-50' },
  INTERNET: { label: 'Mobile & Internet', icon: Info, color: 'text-teal-600', bg: 'bg-teal-50' },
  MARKETING: { label: 'Local Promotion', icon: ArrowUpRight, color: 'text-pink-600', bg: 'bg-pink-50' },
  REPAIRS: { label: 'Equipment Repairs', icon: Wrench, color: 'text-stone-600', bg: 'bg-stone-50' },
  BANK_CHARGES: { label: 'Bank & Payment Fees', icon: CreditCard, color: 'text-slate-600', bg: 'bg-slate-50' },
  OTHER: { label: 'General Overhead', icon: Receipt, color: 'text-gray-600', bg: 'bg-gray-50' },
};

function DropletIcon(props: any) {
  return <Package {...props} />;
}

export function formatINR(amount: number | null | undefined): string {
  const n = Number(amount ?? 0);
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export default function DistributorProfitLossTab({
  preset,
  customStart,
  customEnd,
}: DistributorProfitLossTabProps) {
  const [data, setData] = useState<DistributorPnlData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [submittingExpense, setSubmittingExpense] = useState(false);

  // Statement Section Expand States
  const [isStatementExpanded, setIsStatementExpanded] = useState(true);
  const [isOpexExpanded, setIsOpexExpanded] = useState(true);

  // Expense form state
  const [category, setCategory] = useState('FUEL');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [vendorName, setVendorName] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [description, setDescription] = useState('');

  const loadPnL = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const normalizedPreset = (() => {
        switch (preset?.toLowerCase()) {
          case 'today': return 'TODAY';
          case 'yesterday': return 'YESTERDAY';
          case '7d':
          case 'last_7_days': return 'LAST_7_DAYS';
          case '30d':
          case 'last_30_days': return 'LAST_30_DAYS';
          case 'this_month': return 'THIS_MONTH';
          case 'prev_month':
          case 'last_month': return 'LAST_MONTH';
          case 'this_quarter': return 'THIS_QUARTER';
          case 'this_year': return 'THIS_YEAR';
          case 'all_time': return 'ALL_TIME';
          case 'custom': return 'CUSTOM';
          default: return (preset || 'THIS_MONTH').toUpperCase();
        }
      })();

      let url = `/distributor/reports/pnl?preset=${normalizedPreset}`;
      if ((normalizedPreset === 'CUSTOM' || preset === 'custom') && customStart && customEnd) {
        url += `&startDate=${encodeURIComponent(customStart)}&endDate=${encodeURIComponent(customEnd)}`;
      }

      const res = await fetchWithAuth(url);
      if (res && res.summary) {
        setData(res);
      } else {
        toast.error('Failed to load Distributor Profit & Loss data.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Unable to fetch Profit & Loss statement.');
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
    if (!title.trim() || !amount || Number(amount) <= 0) {
      toast.error('Please provide a valid title and positive amount.');
      return;
    }

    setSubmittingExpense(true);
    try {
      await fetchWithAuth('/distributor/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          title: title.trim(),
          amount: Number(amount),
          paymentMethod,
          paymentStatus: 'PAID',
          status: 'APPROVED',
          vendorName: vendorName.trim() || undefined,
          invoiceNumber: invoiceNumber.trim() || undefined,
          description: description.trim() || undefined,
        }),
      });

      toast.success('Operating expense recorded successfully.');
      setIsExpenseModalOpen(false);
      setTitle('');
      setAmount('');
      setVendorName('');
      setInvoiceNumber('');
      setDescription('');
      loadPnL(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to record expense.');
    } finally {
      setSubmittingExpense(false);
    }
  };

  const handleCancelExpense = async (expenseId: string) => {
    if (!window.confirm('Are you sure you want to cancel this expense record?')) return;
    try {
      await fetchWithAuth(`/distributor/expenses/${expenseId}`, {
        method: 'DELETE',
      });
      toast.success('Expense cancelled successfully.');
      loadPnL(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel expense.');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-slate-200">
        <RotateCw className="w-8 h-8 text-[#1677C8] animate-spin mb-3" />
        <p className="text-sm font-semibold text-slate-600">Calculating Distributor Profit & Loss...</p>
        <p className="text-xs text-slate-400 mt-1">Aggregating delivered sales, wholesale COGS, and operating expenses</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-2" />
        <h3 className="text-base font-bold text-slate-800">Financial Data Unavailable</h3>
        <p className="text-sm text-slate-500 mt-1">Unable to generate Profit & Loss statement for the selected period.</p>
        <button
          onClick={() => loadPnL(false)}
          className="mt-4 px-4 py-2 bg-[#1677C8] text-white rounded-lg text-xs font-bold hover:bg-[#125ea0] transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  const { summary, revenueBreakdown, cogsBreakdown, opexBreakdown, recentExpenses, auditFlags, distributor } = data;
  const isNetProfitPositive = summary.netProfitBeforeTax >= 0;

  return (
    <div className="space-y-6">
      {/* ── TOP ACTION & TITLE BAR ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg sm:text-xl font-bold text-[#16324F] tracking-tight">
              Distributor Profit & Loss Statement
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#EBF5FB] text-[#1677C8] border border-[#BBDFF2]">
              {distributor.agencyName}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time operating income, wholesale COGS, and depot expenses from verified transactions.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          <button
            onClick={() => loadPnL(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
            title="Refresh Financials"
          >
            <RotateCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
            title="Print or Export PDF"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Statement</span>
          </button>

          <button
            onClick={() => setIsExpenseModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1677C8] hover:bg-[#125ea0] text-white rounded-xl text-xs font-bold transition-all shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Record Expense</span>
          </button>
        </div>
      </div>

      {/* ── EXECUTIVE KPI METRIC CARDS ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* 1. Net Operating Revenue */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Net Revenue</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-extrabold text-slate-900">{formatINR(summary.totalNetRevenue)}</div>
          <p className="text-[10px] text-slate-400 mt-1">
            {revenueBreakdown.totalOrdersCount} orders (Deposits excluded)
          </p>
        </div>

        {/* 2. Total COGS */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total COGS</span>
            <Package className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl font-extrabold text-slate-900">{formatINR(summary.totalCogs)}</div>
          <p className="text-[10px] text-slate-400 mt-1">
            {cogsBreakdown.unitWaterJarRateUsed > 0 ? `₹${cogsBreakdown.unitWaterJarRateUsed}/jar wholesale` : 'Wholesale rate'}
          </p>
        </div>

        {/* 3. Gross Profit */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Gross Profit</span>
            <TrendingUp className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-xl font-extrabold text-indigo-900">{formatINR(summary.grossProfit)}</div>
          <p className="text-[10px] font-semibold text-indigo-600 mt-1">
            Margin: {summary.grossMarginPercent}%
          </p>
        </div>

        {/* 4. Operating Expenses (OPEX) */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Depot OPEX</span>
            <Receipt className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-xl font-extrabold text-slate-900">{formatINR(summary.totalOpex)}</div>
          <p className="text-[10px] text-slate-400 mt-1">
            {opexBreakdown.totalExpenseCount} recorded expenses
          </p>
        </div>

        {/* 5. Net Profit Before Tax */}
        <div className={`p-4 rounded-xl border shadow-2xs ${isNetProfitPositive ? 'bg-emerald-50/50 border-emerald-200' : 'bg-rose-50/50 border-rose-200'}`}>
          <div className="flex items-center justify-between mb-1">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${isNetProfitPositive ? 'text-emerald-700' : 'text-rose-700'}`}>
              Net Profit
            </span>
            {isNetProfitPositive ? (
              <ArrowUpRight className="w-4 h-4 text-emerald-600" />
            ) : (
              <ArrowDownRight className="w-4 h-4 text-rose-600" />
            )}
          </div>
          <div className={`text-xl font-extrabold ${isNetProfitPositive ? 'text-emerald-900' : 'text-rose-900'}`}>
            {formatINR(summary.netProfitBeforeTax)}
          </div>
          <p className={`text-[10px] font-bold mt-1 ${isNetProfitPositive ? 'text-emerald-700' : 'text-rose-700'}`}>
            Net Margin: {summary.netProfitMarginPercent}%
          </p>
        </div>

        {/* 6. Customer Jar Liability */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Jar Deposits</span>
            <ShieldCheck className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-xl font-extrabold text-slate-800">{formatINR(summary.customerJarDepositLiability)}</div>
          <p className="text-[10px] text-slate-400 mt-1">
            Liability (Refundable to customers)
          </p>
        </div>
      </div>

      {/* ── EXPANDABLE DETAILED ACCOUNTING STATEMENT ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div
          onClick={() => setIsStatementExpanded(!isStatementExpanded)}
          className="flex items-center justify-between px-5 py-4 bg-slate-50 border-b border-slate-200 cursor-pointer select-none hover:bg-slate-100/80 transition-colors"
        >
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#1677C8]" />
            <h3 className="text-sm font-bold text-[#16324F]">Detailed Financial Income & Cost Statement</h3>
            <span className="text-xs text-slate-400 font-normal">
              ({data.period.preset.replace('_', ' ')})
            </span>
          </div>
          <button className="text-slate-400 hover:text-slate-600">
            {isStatementExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {isStatementExpanded && (
          <div className="p-5 space-y-6">
            {/* Section 1: Revenue */}
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 font-bold text-xs uppercase tracking-wider text-slate-500">
                <span>1. Operating Revenue</span>
                <span>Amount (INR)</span>
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                <div className="flex justify-between py-2.5">
                  <span className="text-slate-700">Gross Customer Retail Orders</span>
                  <span className="font-semibold text-slate-900">{formatINR(revenueBreakdown.grossRetailRevenue)}</span>
                </div>
                {revenueBreakdown.netAccessoryRevenue > 0 && (
                  <div className="flex justify-between py-2.5">
                    <span className="text-slate-700">Direct Retail Accessory Sales (Taxable)</span>
                    <span className="font-semibold text-slate-900">{formatINR(revenueBreakdown.netAccessoryRevenue)}</span>
                  </div>
                )}
                {revenueBreakdown.totalOrderDiscounts > 0 && (
                  <div className="flex justify-between py-2.5 text-rose-600">
                    <span>Less: Customer Order Discounts</span>
                    <span>-{formatINR(revenueBreakdown.totalOrderDiscounts)}</span>
                  </div>
                )}
                <div className="flex justify-between py-2.5 text-slate-500 bg-slate-50/50 px-2 rounded">
                  <span>Less: Customer Refundable Jar Deposits (Held on Balance Sheet)</span>
                  <span className="font-semibold">-{formatINR(revenueBreakdown.customerJarDepositLiability)}</span>
                </div>
                <div className="flex justify-between py-3 font-bold text-sm bg-emerald-50/50 text-emerald-900 px-3 rounded-lg mt-1">
                  <span>Total Net Operating Revenue</span>
                  <span>{formatINR(summary.totalNetRevenue)}</span>
                </div>
              </div>
            </div>

            {/* Section 2: COGS */}
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 font-bold text-xs uppercase tracking-wider text-slate-500">
                <span>2. Cost of Goods Sold (COGS)</span>
                <span>Amount (INR)</span>
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                <div className="flex justify-between py-2.5">
                  <span className="text-slate-700">
                    Water Jars Delivered ({revenueBreakdown.totalWaterJarsDelivered} jars @ ₹{cogsBreakdown.unitWaterJarRateUsed}/jar)
                  </span>
                  <span className="font-semibold text-slate-900">{formatINR(cogsBreakdown.waterJarCogs)}</span>
                </div>
                {cogsBreakdown.accessoryCogs > 0 && (
                  <div className="flex justify-between py-2.5">
                    <span className="text-slate-700">Accessories Wholesale Cost</span>
                    <span className="font-semibold text-slate-900">{formatINR(cogsBreakdown.accessoryCogs)}</span>
                  </div>
                )}
                {cogsBreakdown.inventoryWriteOffs > 0 && (
                  <div className="flex justify-between py-2.5 text-amber-700">
                    <span>
                      Damaged / Lost Inventory Write-offs ({cogsBreakdown.damagedJarsCount} jars @ ₹{cogsBreakdown.jarAssetRateUsed || 150}/jar container asset)
                    </span>
                    <span className="font-semibold">{formatINR(cogsBreakdown.inventoryWriteOffs)}</span>
                  </div>
                )}
                <div className="flex justify-between py-3 font-bold text-sm bg-blue-50/50 text-blue-900 px-3 rounded-lg mt-1">
                  <span>Total Cost of Goods Sold</span>
                  <span>{formatINR(summary.totalCogs)}</span>
                </div>
              </div>
            </div>

            {/* Gross Profit Summary */}
            <div className="p-4 rounded-xl bg-indigo-50/80 border border-indigo-100 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider">Gross Operating Profit</span>
                <p className="text-[11px] text-indigo-700 mt-0.5">Operating Revenue minus Wholesale Goods Cost</p>
              </div>
              <div className="text-right">
                <div className="text-lg font-extrabold text-indigo-950">{formatINR(summary.grossProfit)}</div>
                <span className="text-xs font-bold text-indigo-600">Margin: {summary.grossMarginPercent}%</span>
              </div>
            </div>

            {/* Section 3: Operating Expenses */}
            <div>
              <div
                onClick={() => setIsOpexExpanded(!isOpexExpanded)}
                className="flex items-center justify-between pb-2 border-b border-slate-200 font-bold text-xs uppercase tracking-wider text-slate-500 cursor-pointer"
              >
                <span>3. Operating Expenses (OPEX)</span>
                <span className="text-slate-400 flex items-center gap-1 font-normal text-[11px]">
                  {isOpexExpanded ? 'Collapse' : 'Expand'}
                  {isOpexExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </span>
              </div>

              {isOpexExpanded && (
                <div className="divide-y divide-slate-100 text-xs mt-1">
                  {Object.entries(opexBreakdown.categories).map(([key, cat]) => {
                    const cfg = EXPENSE_CATEGORY_CONFIG[key] || EXPENSE_CATEGORY_CONFIG.OTHER;
                    const IconComp = cfg.icon;
                    return (
                      <div key={key} className="flex items-center justify-between py-2.5 hover:bg-slate-50/50 px-2 rounded">
                        <div className="flex items-center gap-2">
                          <div className={`p-1 rounded ${cfg.bg}`}>
                            <IconComp className={`w-3.5 h-3.5 ${cfg.color}`} />
                          </div>
                          <span className="text-slate-700">{cat.label}</span>
                          {cat.count > 0 && (
                            <span className="text-[10px] text-slate-400">({cat.count} bills)</span>
                          )}
                        </div>
                        <span className={`font-semibold ${cat.amount > 0 ? 'text-slate-900' : 'text-slate-400'}`}>
                          {formatINR(cat.amount)}
                        </span>
                      </div>
                    );
                  })}
                  <div className="flex justify-between py-3 font-bold text-sm bg-amber-50/50 text-amber-900 px-3 rounded-lg mt-1">
                    <span>Total Operating Expenses</span>
                    <span>{formatINR(summary.totalOpex)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Net Operating Profit */}
            <div className={`p-4 rounded-xl border flex items-center justify-between ${isNetProfitPositive ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
              <div>
                <span className={`text-xs font-bold uppercase tracking-wider ${isNetProfitPositive ? 'text-emerald-900' : 'text-rose-900'}`}>
                  Net Operating Profit Before Tax
                </span>
                <p className={`text-[11px] mt-0.5 ${isNetProfitPositive ? 'text-emerald-700' : 'text-rose-700'}`}>
                  Gross Profit minus All Depot Operating Expenses
                </p>
              </div>
              <div className="text-right">
                <div className={`text-xl font-extrabold ${isNetProfitPositive ? 'text-emerald-950' : 'text-rose-950'}`}>
                  {formatINR(summary.netProfitBeforeTax)}
                </div>
                <span className={`text-xs font-bold ${isNetProfitPositive ? 'text-emerald-700' : 'text-rose-700'}`}>
                  Net Margin: {summary.netProfitMarginPercent}%
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── RECEIVABLES, PAYABLES & JAR RECONCILIATION SUMMARY CARDS ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Customer Receivables */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Customer Receivables</span>
            <Users className="w-4 h-4 text-[#1677C8]" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">
            {formatINR(summary.customerOutstandingReceivables)}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Uncollected payments on customer delivered orders.
          </p>
        </div>

        {/* Supplier Payables */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Supplier Payables</span>
            <Building2 className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">
            {formatINR(summary.supplierOutstandingPayables)}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Pending payments owed to water bottling plants / suppliers.
          </p>
        </div>

        {/* Jar Depot Holdings */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Depot Jars Breakdown</span>
            <Package className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-center gap-4 mt-2">
            <div>
              <span className="text-xs text-slate-400">Distributor Owned</span>
              <div className="text-xl font-extrabold text-emerald-700">{distributor.distributorOwnedJars}</div>
            </div>
            <div className="border-l border-slate-200 pl-4">
              <span className="text-xs text-slate-400">Company Owned</span>
              <div className="text-xl font-extrabold text-blue-700">{distributor.companyOwnedJars}</div>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Company jars settled at ₹{distributor.jarDepositRate || 150}/jar upon full acquisition.
          </p>
        </div>
      </div>

      {/* ── RECENT EXPENSE ACTIVITY TABLE ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-bold text-[#16324F]">Recent Operating Expenses</h3>
          </div>
          <button
            onClick={() => setIsExpenseModalOpen(true)}
            className="text-xs font-bold text-[#1677C8] hover:text-[#125ea0] transition-colors"
          >
            + Add Expense
          </button>
        </div>

        {recentExpenses.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            No operating expenses recorded for this period. Click "Record Expense" to add delivery vehicle fuel, depot rent, or driver wages.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                <tr>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-4 py-3">Title & Category</th>
                  <th className="px-4 py-3">Vendor / Invoice</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-5 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentExpenses.map((exp) => {
                  const cfg = EXPENSE_CATEGORY_CONFIG[exp.category] || EXPENSE_CATEGORY_CONFIG.OTHER;
                  return (
                    <tr key={exp.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3 whitespace-nowrap text-slate-500 font-medium">
                        {new Date(exp.expenseDate).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{exp.title}</div>
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${cfg.bg} ${cfg.color} mt-0.5`}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        <div>{exp.vendorName || '—'}</div>
                        {exp.invoiceNumber && <span className="text-[10px] text-slate-400">Bill: {exp.invoiceNumber}</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-500 font-medium">{exp.paymentMethod}</td>
                      <td className="px-4 py-3 text-right font-extrabold text-slate-900">
                        {formatINR(exp.amount)}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <button
                          onClick={() => handleCancelExpense(exp.id)}
                          className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded transition-colors"
                          title="Cancel Expense Record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── AUDIT INTEGRITY & ACCOUNTING TRANSPARENCY NOTICE ── */}
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 space-y-1">
        <div className="flex items-center gap-1.5 font-bold text-slate-700">
          <Info className="w-4 h-4 text-[#1677C8]" />
          <span>Accounting Architecture & Balance Sheet Separation:</span>
        </div>
        <p className="pl-5 leading-relaxed">
          • <strong>Customer Jar Deposits:</strong> {auditFlags.customerDepositsIsolated}
        </p>
        <p className="pl-5 leading-relaxed">
          • <strong>Wholesale COGS:</strong> {auditFlags.cogsEstimationNote}
        </p>
        <p className="pl-5 leading-relaxed">
          • <strong>Prepaid Subscriptions:</strong> {auditFlags.subscriptionRevenueExcluded}
        </p>
      </div>

      {/* ── RECORD EXPENSE MODAL ── */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-amber-600" />
                <h3 className="text-base font-bold text-[#16324F]">Record Operating Expense</h3>
              </div>
              <button
                onClick={() => setIsExpenseModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateExpense} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Expense Category *</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-[#1677C8] focus:ring-1 focus:ring-[#1677C8] transition-all cursor-pointer"
                >
                  {Object.entries(EXPENSE_CATEGORY_CONFIG).map(([k, cfg]) => (
                    <option key={k} value={k}>
                      {cfg.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Expense Title / Description *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Fuel for Tata Ace Delivery Van"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#1677C8] focus:ring-1 focus:ring-[#1677C8] transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Amount (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#1677C8] focus:ring-1 focus:ring-[#1677C8] transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-[#1677C8] focus:ring-1 focus:ring-[#1677C8] transition-all cursor-pointer"
                  >
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI / GPay / PhonePe</option>
                    <option value="BANK_TRANSFER">Bank Transfer (NEFT/IMPS)</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Vendor / Fuel Pump Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Bharat Petroleum, Kondotty"
                    value={vendorName}
                    onChange={(e) => setVendorName(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#1677C8] focus:ring-1 focus:ring-[#1677C8] transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Bill / Invoice Number</label>
                  <input
                    type="text"
                    placeholder="e.g. BP-84910"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#1677C8] focus:ring-1 focus:ring-[#1677C8] transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Additional Notes</label>
                <textarea
                  rows={2}
                  placeholder="Optional details or odometer reading"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#1677C8] focus:ring-1 focus:ring-[#1677C8] transition-all"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingExpense}
                  className="px-5 py-2 bg-[#1677C8] hover:bg-[#125ea0] text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50"
                >
                  {submittingExpense ? 'Recording...' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
