import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  TrendingUp, 
  IndianRupee, 
  Coins, 
  Receipt, 
  Clock, 
  CheckCircle, 
  RotateCw, 
  ChevronRight, 
  X, 
  Info,
  Layers,
  RotateCcw,
  ShoppingBag,
  Search
} from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';
import LoadingSpinner from '../../../components/LoadingSpinner';
import { formatOrderId } from '../../../utils/orderFormatters';
import type { DeliveryTask } from './Overview';

interface ProfitsProps {
  tasks?: DeliveryTask[];
  loading?: boolean;
}

interface ProfitItem {
  productId?: string;
  productName: string;
  quantity: number;
  customerUnitPrice: number;
  customerRevenue: number;
  partnerUnitCost: number;
  edropsCost: number;
  profit: number;
}

interface ProfitTransaction {
  id: string;
  orderId?: string;
  orderNumber: string;
  deliveryId?: string;
  date: string;
  customerName: string;
  customerPhone: string;
  address: string;
  items: ProfitItem[];
  totalJars: number;
  paidAmount: number;
  edropsCost: number;
  profit: number;
  paymentStatus: string;
  deliveryStatus: string;
  isEligible: boolean;
  notes?: string;
}

export default function Profits({ tasks = [] }: ProfitsProps) {
  const [period, setPeriod] = useState<'ALL' | 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH'>('ALL');
  const [paymentFilter, setPaymentFilter] = useState<'ALL' | 'PAID' | 'PENDING' | 'REFUNDED'>('ALL');
  const [search, setSearch] = useState('');
  const [selectedTx, setSelectedTx] = useState<ProfitTransaction | null>(null);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['deliveryPartnerProfits', period],
    queryFn: () => fetchWithAuth(`/delivery/partner/profits?period=${period}`),
  });

  const summary = data?.summary || {
    totalProfit: 0,
    paidRevenue: 0,
    edropsCost: 0,
    profitMargin: 0,
    completedDeliveries: 0,
    totalJars: 0,
    currentJarRate: 0,
  };

  const rawTransactions: ProfitTransaction[] = data?.transactions || [];

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    const term = search.toLowerCase().trim();

    return rawTransactions.filter((tx) => {
      const matchesSearch =
        !term ||
        formatOrderId(tx.orderNumber || tx.orderId || tx.id).toLowerCase().includes(term) ||
        tx.customerName.toLowerCase().includes(term) ||
        tx.customerPhone.includes(term) ||
        tx.address.toLowerCase().includes(term);

      if (!matchesSearch) return false;

      if (paymentFilter === 'PAID' && tx.paymentStatus !== 'PAID') return false;
      if (paymentFilter === 'PENDING' && tx.paymentStatus !== 'PENDING') return false;
      if (paymentFilter === 'REFUNDED' && tx.paymentStatus !== 'REFUNDED') return false;

      return true;
    });
  }, [rawTransactions, search, paymentFilter]);

  // Operational metrics from tasks / reports
  const operationalStats = useMemo(() => {
    const completedTasks = tasks.filter(t => t.status === 'DELIVERED' || !!t.report);
    const totalStops = tasks.length;
    const completedCount = completedTasks.length;
    const completionRate = totalStops > 0 ? Math.round((completedCount / totalStops) * 100) : 0;

    const bottlesDelivered = completedTasks.reduce((sum, t) => {
      if (t.report?.partnerDeliveredQty !== undefined) {
        return sum + t.report.partnerDeliveredQty;
      }
      return sum + (t.requiredQuantity || 0);
    }, 0);

    const emptyBottlesCollected = completedTasks.reduce((sum, t) => {
      return sum + (t.report?.partnerEmptyCollected || 0);
    }, 0);

    return {
      totalStops,
      completedCount,
      completionRate,
      bottlesDelivered,
      emptyBottlesCollected,
    };
  }, [tasks]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* ─── HEADER ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-[#16324F] tracking-tight">Profits & Earnings</h1>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Live Economics
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#64748B] mt-0.5">
            Track your realized delivery profits, customer revenue, and Edrops cost breakdown.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2 text-[#64748B] hover:text-[#1677C8] bg-white hover:bg-slate-50 border border-[#E2E8F0] rounded-xl transition cursor-pointer disabled:opacity-50"
            title="Refresh Profits"
          >
            <RotateCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-[#1677C8]' : ''}`} />
          </button>
        </div>
      </div>

      {/* ─── RATE EXPLANATION BANNER ──────────────────────────── */}
      <div className="p-3.5 bg-blue-50/60 rounded-2xl border border-blue-100/90 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 text-[#16324F]">
          <Info className="w-4 h-4 text-[#1677C8] shrink-0" />
          <span>
            Current configured rate: <strong className="text-[#1677C8]">₹{Number(summary.currentJarRate).toFixed(2)} / jar</strong>.
            Historical deliveries use the rate snapshotted for each delivery/order.
          </span>
        </div>
        <span className="text-[11px] font-semibold text-[#64748B] self-start sm:self-auto">
          Profit = Paid Revenue - Edrops Cost
        </span>
      </div>

      {/* ─── FINANCIAL HERO SUMMARY CARDS ──────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        
        {/* Total Net Profit */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-[#1677C8] to-[#105691] text-white shadow-md relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between opacity-90 text-xs font-semibold">
            <span>TOTAL PROFIT</span>
            <Coins className="w-4 h-4 text-yellow-300" />
          </div>
          <div className="my-2">
            <span className="text-2xl sm:text-3xl font-black tracking-tight">
              ₹{Number(summary.totalProfit).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="text-[11px] opacity-80 flex items-center justify-between">
            <span>Based on paid completed deliveries</span>
            <span className="font-bold">{summary.profitMargin}% margin</span>
          </div>
        </div>

        {/* Paid Delivery Revenue */}
        <div className="p-5 rounded-2xl bg-white border border-[#E2E8F0] shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#64748B] text-xs font-semibold">
            <span>PAID REVENUE</span>
            <Receipt className="w-4 h-4 text-[#1677C8]" />
          </div>
          <div className="my-2">
            <span className="text-2xl font-black text-[#16324F] tracking-tight">
              ₹{Number(summary.paidRevenue).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="text-[11px] text-[#64748B]">
            Customer payments recognized
          </div>
        </div>

        {/* Edrops Cost */}
        <div className="p-5 rounded-2xl bg-white border border-[#E2E8F0] shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#64748B] text-xs font-semibold">
            <span>EDROPS COST</span>
            <IndianRupee className="w-4 h-4 text-amber-600" />
          </div>
          <div className="my-2">
            <span className="text-2xl font-black text-[#16324F] tracking-tight">
              ₹{Number(summary.edropsCost).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="text-[11px] text-[#64748B]">
            Assigned partner jar rate cost
          </div>
        </div>

        {/* Completed Deliveries */}
        <div className="p-5 rounded-2xl bg-white border border-[#E2E8F0] shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#64748B] text-xs font-semibold">
            <span>PAID DELIVERIES</span>
            <CheckCircle className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="my-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-700 tracking-tight">
              {summary.completedDeliveries}
            </span>
            {Number(summary.pendingPaymentCount || 0) > 0 && (
              <span className="text-xs font-bold text-amber-600">
                ({summary.pendingPaymentCount} pending)
              </span>
            )}
          </div>
          <div className="text-[11px] text-[#64748B]">
            {summary.totalJars} paid jars delivered
          </div>
        </div>

      </div>

      {/* ─── PENDING PAYMENT NOTICE (IF ANY) ──────────────────── */}
      {Number(summary.pendingPaymentCount || 0) > 0 && (
        <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-900 animate-in fade-in">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              You have <strong>{summary.pendingPaymentCount} delivered order{summary.pendingPaymentCount !== 1 ? 's' : ''}</strong> with payment pending.
              Potential profit upon payment: <strong className="text-emerald-800">₹{Number(summary.pendingProfit || 0).toFixed(2)}</strong>.
            </span>
          </div>
          <span className="text-[11px] font-semibold text-amber-700">Realizes upon payment confirmation</span>
        </div>
      )}

      {/* ─── FILTERS & SEARCH BAR ──────────────────────────────── */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          
          {/* Period Segment */}
          <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200/60 self-start">
            {[
              { key: 'ALL', label: 'All Time' },
              { key: 'TODAY', label: 'Today' },
              { key: 'THIS_WEEK', label: 'This Week' },
              { key: 'THIS_MONTH', label: 'This Month' },
            ].map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPeriod(p.key as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  period === p.key
                    ? 'bg-white text-[#1677C8] shadow-2xs font-bold'
                    : 'text-[#64748B] hover:text-[#16324F]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Search Bar & Payment Filter */}
          <div className="flex items-center gap-2.5 flex-1 max-w-md ml-auto">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search order #, customer, phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-8 py-1.5 text-xs bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl outline-none focus:bg-white focus:border-[#1677C8] focus:ring-2 focus:ring-[#1677C8]/10 text-[#16324F] font-medium"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200/60 text-xs">
              {[
                { key: 'ALL', label: 'All' },
                { key: 'PAID', label: 'Paid' },
                { key: 'PENDING', label: 'Pending' },
              ].map((pf) => (
                <button
                  key={pf.key}
                  type="button"
                  onClick={() => setPaymentFilter(pf.key as any)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                    paymentFilter === pf.key
                      ? 'bg-white text-[#1677C8] shadow-2xs font-bold'
                      : 'text-[#64748B] hover:text-[#16324F]'
                  }`}
                >
                  {pf.label}
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* ─── PROFIT TRANSACTIONS TABLE ─────────────────────────── */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-slate-50/60">
          <div>
            <h2 className="text-sm font-bold text-[#16324F]">Profit & Delivery Transactions</h2>
            <p className="text-[11px] text-[#64748B]">Transparent breakdown of revenue, cost, and net profit per delivery</p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 bg-gray-100 text-[#64748B] rounded-lg">
            {filteredTransactions.length} Record{filteredTransactions.length !== 1 ? 's' : ''}
          </span>
        </div>

        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center">
            <LoadingSpinner size="md" label="Loading profit records..." />
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="text-center py-16 px-4 space-y-2">
            <Clock className="w-10 h-10 mx-auto text-gray-300" />
            <h3 className="text-sm font-bold text-[#16324F]">No Completed Paid Deliveries Yet</h3>
            <p className="text-xs text-[#64748B] max-w-sm mx-auto leading-relaxed">
              Your profit will appear here after paid deliveries are completed and verified on your assigned routes.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-slate-50/70 text-[#64748B] uppercase tracking-wider text-[10px] font-bold">
                    <th className="py-3 px-4">DATE</th>
                    <th className="py-3 px-4">ORDER</th>
                    <th className="py-3 px-4">CUSTOMER</th>
                    <th className="py-3 px-4">ITEMS / JARS</th>
                    <th className="py-3 px-4">PAID AMOUNT</th>
                    <th className="py-3 px-4">EDROPS COST</th>
                    <th className="py-3 px-4">PROFIT</th>
                    <th className="py-3 px-4">STATUS</th>
                    <th className="py-3 px-4 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredTransactions.map((tx) => {
                    const formattedDate = new Date(tx.date).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    });

                    return (
                      <tr
                        key={tx.id}
                        onClick={() => setSelectedTx(tx)}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                      >
                        {/* Date */}
                        <td className="py-3 px-4 whitespace-nowrap text-[#64748B] font-medium text-[11px]">
                          {formattedDate}
                        </td>

                        {/* Order */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="font-mono font-bold text-[#1677C8] text-xs">
                            {formatOrderId(tx.orderNumber || tx.orderId || tx.id)}
                          </span>
                        </td>

                        {/* Customer */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div>
                            <p className="font-bold text-[#16324F]">{tx.customerName}</p>
                            <p className="text-[10px] text-[#64748B]">{tx.customerPhone}</p>
                          </div>
                        </td>

                        {/* Items / Jars */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="font-semibold text-[#16324F] text-xs">
                            {tx.totalJars} jar{tx.totalJars !== 1 ? 's' : ''}
                          </span>
                        </td>

                        {/* Paid Amount */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="font-bold text-[#16324F] text-xs">
                            ₹{Number(tx.paidAmount).toFixed(2)}
                          </span>
                        </td>

                        {/* Edrops Cost */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="text-[#64748B] font-semibold text-xs">
                            ₹{Number(tx.edropsCost).toFixed(2)}
                          </span>
                        </td>

                        {/* Profit */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-0.5 font-black text-xs ${
                            tx.profit >= 0 ? 'text-emerald-700' : 'text-rose-600'
                          }`}>
                            {tx.profit >= 0 ? '+' : ''}₹{Number(tx.profit).toFixed(2)}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              tx.paymentStatus === 'PAID'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                : tx.paymentStatus === 'REFUNDED'
                                ? 'bg-amber-50 text-amber-700 border border-amber-100'
                                : 'bg-gray-100 text-gray-500 border border-gray-200'
                            }`}>
                              <span>{tx.paymentStatus}</span>
                            </span>
                          </div>
                        </td>

                        {/* Action */}
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTx(tx);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-[#1677C8] bg-blue-50/60 hover:bg-[#1677C8] hover:text-white rounded-lg transition cursor-pointer"
                          >
                            <span>Breakdown</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card Stack View */}
            <div className="md:hidden divide-y divide-gray-100">
              {filteredTransactions.map((tx) => (
                <div
                  key={tx.id}
                  onClick={() => setSelectedTx(tx)}
                  className="p-4 space-y-2.5 hover:bg-slate-50 transition cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono font-bold text-xs text-[#1677C8]">{formatOrderId(tx.orderNumber || tx.orderId || tx.id)}</span>
                      <p className="text-xs font-bold text-[#16324F] mt-0.5">{tx.customerName}</p>
                    </div>
                    <div className="text-right">
                      <span className={`font-black text-sm block ${
                        tx.profit >= 0 ? 'text-emerald-700' : 'text-rose-600'
                      }`}>
                        {tx.profit >= 0 ? '+' : ''}₹{Number(tx.profit).toFixed(2)}
                      </span>
                      <span className="text-[10px] text-[#64748B]">Profit</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 py-1.5 px-2.5 bg-slate-50 rounded-xl text-[11px] border border-slate-100">
                    <div>
                      <span className="text-[#64748B] block text-[10px]">Revenue</span>
                      <span className="font-bold text-[#16324F]">₹{Number(tx.paidAmount).toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-[#64748B] block text-[10px]">Edrops Cost</span>
                      <span className="font-semibold text-[#64748B]">₹{Number(tx.edropsCost).toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-[#64748B] block text-[10px]">Jars</span>
                      <span className="font-bold text-[#16324F]">{tx.totalJars} drops</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 text-[11px]">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      tx.paymentStatus === 'PAID'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {tx.paymentStatus}
                    </span>
                    <span className="text-[#1677C8] font-bold flex items-center gap-1 text-xs">
                      <span>View Breakdown</span>
                      <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ─── OPERATIONAL ROUTE SUMMARY METRICS ─────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-[#E2E8F0] p-4 sm:p-5 rounded-xl">
          <div className="flex items-center justify-between text-xs font-medium text-[#64748B] mb-1">
            <span>Completed Stops</span>
            <CheckCircle className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-[#16324F]">{operationalStats.completedCount}</div>
          <div className="text-xs text-[#64748B] mt-0.5">
            out of {operationalStats.totalStops} assigned stops
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] p-4 sm:p-5 rounded-xl">
          <div className="flex items-center justify-between text-xs font-medium text-[#64748B] mb-1">
            <span>Bottles Delivered</span>
            <Layers className="w-4 h-4 text-[#1677C8]" />
          </div>
          <div className="text-2xl font-bold text-[#16324F]">{operationalStats.bottlesDelivered}</div>
          <div className="text-xs text-[#64748B] mt-0.5">Water jars dropped</div>
        </div>

        <div className="bg-white border border-[#E2E8F0] p-4 sm:p-5 rounded-xl">
          <div className="flex items-center justify-between text-xs font-medium text-[#64748B] mb-1">
            <span>Empty Returns</span>
            <RotateCcw className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-[#16324F]">{operationalStats.emptyBottlesCollected}</div>
          <div className="text-xs text-[#64748B] mt-0.5">Empty jars collected</div>
        </div>

        <div className="bg-white border border-[#E2E8F0] p-4 sm:p-5 rounded-xl">
          <div className="flex items-center justify-between text-xs font-medium text-[#64748B] mb-1">
            <span>Route Success</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-600">{operationalStats.completionRate}%</div>
          <div className="text-xs text-[#64748B] mt-0.5">Completion efficiency</div>
        </div>
      </div>

      {/* ─── SETTLEMENT & PAYOUT POLICY ───────────────────────── */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 space-y-2">
        <h3 className="text-sm font-bold text-[#16324F]">Settlement & Payout Policy</h3>
        <p className="text-xs text-[#64748B] leading-relaxed">
          Profits are calculated per verified paid delivery based on customer revenue minus Edrops assigned partner jar rates.
          Payouts and bank deposits are processed bi-weekly upon automated route verification.
        </p>
      </div>

      {/* ─── TRANSACTION BREAKDOWN MODAL ───────────────────────── */}
      {selectedTx && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedTx(null);
            }
          }}
        >
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-gray-100 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95">
            {/* Header */}
            <div className="p-5 border-b border-gray-100 bg-slate-50/80 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-[#16324F]">Profit Calculation Breakdown</h3>
                  <span className="font-mono text-xs font-bold text-[#1677C8] bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100">
                    {formatOrderId(selectedTx.orderNumber || selectedTx.orderId || selectedTx.id)}
                  </span>
                </div>
                <p className="text-xs text-[#64748B] mt-0.5">
                  {selectedTx.customerName} • {new Date(selectedTx.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTx(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-200/60 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Item-by-item breakdown */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Item Economics</h4>
                <div className="divide-y divide-gray-100 border border-[#E2E8F0] rounded-xl overflow-hidden">
                  {selectedTx.items.map((item, idx) => (
                    <div key={idx} className="p-3.5 space-y-2 bg-white text-xs">
                      <div className="flex items-center justify-between font-bold text-[#16324F]">
                        <span className="flex items-center gap-1.5">
                          <ShoppingBag className="w-3.5 h-3.5 text-[#1677C8]" />
                          <span>{item.productName}</span>
                        </span>
                        <span>Qty: {item.quantity}</span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-1 text-[11px]">
                        <div>
                          <span className="text-[#64748B] block">Customer Price</span>
                          <span className="font-semibold text-[#16324F]">₹{item.customerUnitPrice.toFixed(2)} / jar</span>
                          <span className="text-[10px] text-[#64748B] block">= ₹{item.customerRevenue.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-[#64748B] block">Edrops Cost</span>
                          <span className="font-semibold text-[#16324F]">₹{item.partnerUnitCost.toFixed(2)} / jar</span>
                          <span className="text-[10px] text-[#64748B] block">= ₹{item.edropsCost.toFixed(2)}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[#64748B] block">Item Profit</span>
                          <span className="font-black text-emerald-700">₹{item.profit.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total Calculation Equation Card */}
              <div className="p-4 bg-gradient-to-br from-slate-50 to-blue-50/40 rounded-2xl border border-blue-100/80 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#64748B]">Paid Customer Revenue:</span>
                  <span className="font-bold text-[#16324F]">₹{Number(selectedTx.paidAmount).toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#64748B]">Edrops Assigned Cost:</span>
                  <span className="font-bold text-amber-700">- ₹{Number(selectedTx.edropsCost).toFixed(2)}</span>
                </div>
                <div className="pt-2 border-t border-blue-200/80 flex items-center justify-between">
                  <span className="text-sm font-bold text-[#16324F]">Net Recognized Profit:</span>
                  <span className="text-xl font-black text-emerald-700">
                    +₹{Number(selectedTx.profit).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Status and metadata */}
              <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1 text-[#64748B]">
                <div className="flex items-center justify-between">
                  <span>Payment Status:</span>
                  <span className="font-bold text-[#16324F]">{selectedTx.paymentStatus}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Delivery Status:</span>
                  <span className="font-bold text-[#16324F]">{selectedTx.deliveryStatus}</span>
                </div>
                {selectedTx.address && (
                  <div className="flex items-center justify-between pt-1 border-t border-gray-200/60">
                    <span>Address:</span>
                    <span className="font-medium text-[#16324F] truncate max-w-[220px]">{selectedTx.address}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 flex items-center justify-end bg-slate-50/50 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedTx(null)}
                className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:text-[#16324F] bg-white border border-[#E2E8F0] rounded-xl hover:bg-gray-50 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
