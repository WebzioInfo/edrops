import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  Users, 
  Droplets, 
  DollarSign, 
  AlertTriangle, 
  TrendingUp, 
  RefreshCw, 
  Plus, 
  ArrowUpRight, 
  Truck, 
  ShoppingCart, 
  FileText, 
  Search,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';

export default function AdminDashboard() {
  const [searchQuery, setSearchQuery] = useState('');

  const { data, isLoading: loading, isFetching, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['adminDashboardMetrics'],
    queryFn: async () => {
      const [analytics, customers] = await Promise.all([
        fetchWithAuth('/analytics/snapshot'),
        fetchWithAuth('/customer')
      ]);
      return { analytics, customers };
    },
    refetchInterval: 15000,
  });

  const analytics = data?.analytics;
  const customers = data?.customers || [];

  const metrics = [
    { 
      label: 'TOTAL CUSTOMERS', 
      value: customers.length, 
      detail: 'Registered customer accounts', 
      icon: Users, 
      iconBg: 'bg-blue-50 text-[#1677C8]',
      badge: 'Active',
      badgeClass: 'bg-blue-50 text-[#1677C8] border-blue-100'
    },
    { 
      label: 'HYDRATION DELIVERIES', 
      value: (analytics?.totalJarsDelivered ?? 0).toLocaleString(), 
      detail: 'All-time 20L jars fulfilled', 
      icon: Droplets, 
      iconBg: 'bg-teal-50 text-[#2B6E7A]',
      badge: 'Fulfilled',
      badgeClass: 'bg-teal-50 text-[#2B6E7A] border-teal-100'
    },
    { 
      label: 'ACTIVE SCHEDULES', 
      value: analytics?.activeSchedules ?? 0, 
      detail: 'Automated recurring routes', 
      icon: Truck, 
      iconBg: 'bg-indigo-50 text-indigo-700',
      badge: 'Automated',
      badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-100'
    },
    { 
      label: 'ERP SALES REVENUE', 
      value: `₹${(analytics?.totalRevenue ?? 0).toLocaleString()}`, 
      detail: 'Recharge & package sales', 
      icon: DollarSign, 
      iconBg: 'bg-emerald-50 text-emerald-700',
      badge: 'Verified',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-100'
    }
  ];

  const watchlist = customers.filter((c: any) => (c.jarBalance?.availableJars ?? 0) <= 5);

  const filteredWatchlist = watchlist.filter((c: any) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const name = `${c.user?.firstName || ''} ${c.user?.lastName || ''}`.toLowerCase();
    const phone = (c.user?.phone || '').toLowerCase();
    return name.includes(q) || phone.includes(q);
  });

  const lastUpdatedTime = dataUpdatedAt 
    ? new Date(dataUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : 'Live';

  return (
    <div className="space-y-3.5 sm:space-y-4">
      
      {/* ─── 1. COMPACT PAGE HEADER ROW (48–56px) ────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 bg-white border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 sm:px-4 sm:py-3 shadow-2xs">
        {/* Left: Title + Breadcrumb/Live Tag + Last Sync */}
        <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-bold text-[#16324F] tracking-tight">
              Dashboard
            </h1>
            <span className="text-xs text-[#94A3B8]">/</span>
            <span className="text-xs font-semibold text-[#64748B]">Overview</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live System
            </span>
            <span className="text-[11px] text-[#94A3B8] font-medium hidden md:inline">
              • Sync: {lastUpdatedTime}
            </span>
          </div>
        </div>

        {/* Right: Quick Actions Toolbar */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-1.5 text-[#64748B] hover:text-[#1677C8] hover:bg-slate-100 rounded-lg transition-colors border border-transparent hover:border-[#E2E8F0] cursor-pointer disabled:opacity-50"
            title="Refresh Data"
            aria-label="Refresh Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin text-[#1677C8]' : ''}`} />
          </button>

          <Link
            to="/admin/customers/add"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-[#E2E8F0] hover:bg-slate-50 text-[#16324F] text-xs font-semibold rounded-lg transition-colors shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5 text-[#64748B]" />
            <span className="hidden sm:inline">Add Customer</span>
            <span className="sm:hidden">Customer</span>
          </Link>

          <Link
            to="/admin/orders/new"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1677C8] hover:bg-[#1262A5] text-white text-xs font-semibold rounded-lg transition-colors shadow-2xs"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>New POS Order</span>
          </Link>
        </div>
      </div>

      {/* ─── 2. COMPACT KPI STAT CARDS (4-COL GRID) ─────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        {metrics.map((metric, idx) => {
          const Icon = metric.icon;
          return (
            <div 
              key={idx} 
              className="bg-white border border-[#E2E8F0] rounded-xl p-3 sm:p-3.5 shadow-2xs hover:border-[#CBD5E1] transition-all flex flex-col justify-between group"
            >
              {/* Card Header Row: Icon + Label + Inline Badge */}
              <div className="flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${metric.iconBg}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#64748B] truncate">
                    {metric.label}
                  </span>
                </div>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${metric.badgeClass}`}>
                  {metric.badge}
                </span>
              </div>

              {/* Number and Detail */}
              <div className="mt-2.5">
                <div className="text-xl sm:text-2xl font-bold text-[#16324F] tracking-tight">
                  {loading ? (
                    <div className="h-7 w-20 bg-slate-100 animate-pulse rounded" />
                  ) : (
                    metric.value
                  )}
                </div>
                <p className="text-[11px] text-[#64748B] font-medium truncate mt-0.5">
                  {metric.detail}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── 3. SECOND ROW: DENSE WATCHLIST TABLE + SIDE WIDGETS ──── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4 items-start">
        
        {/* Left Column (8 cols): Low Balance Watchlist Data Table */}
        <div className="lg:col-span-8 bg-white border border-[#E2E8F0] rounded-xl shadow-2xs overflow-hidden flex flex-col">
          
          {/* Table Card Header */}
          <div className="p-3 sm:p-3.5 border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-2.5 bg-white">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-3.5 h-3.5" />
              </div>
              <h2 className="text-xs sm:text-sm font-bold text-[#16324F]">
                Low Balance Watchlist (≤ 5 Jars)
              </h2>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                {watchlist.length}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-1 sm:flex-initial justify-end">
              {/* Table search filter */}
              <div className="relative min-w-[140px] sm:min-w-[180px]">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                <input
                  type="text"
                  placeholder="Filter name or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1 text-xs bg-slate-50 border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#1677C8] focus:bg-white transition-colors placeholder:text-[#94A3B8]"
                />
              </div>

              <Link
                to="/admin/customers"
                className="text-xs font-semibold text-[#1677C8] hover:text-[#1262A5] inline-flex items-center gap-0.5 shrink-0"
              >
                <span>View All</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Table Container with Sticky Header */}
          <div className="overflow-x-auto max-h-[350px] overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-[#F8FAFC] z-10 border-b border-[#E2E8F0]">
                <tr className="text-[#64748B] uppercase tracking-wider text-[10px] font-bold">
                  <th className="py-2 px-3">Customer</th>
                  <th className="py-2 px-3">Phone</th>
                  <th className="py-2 px-3 text-right">Prepaid Balance</th>
                  <th className="py-2 px-3 text-right">Deposit Due</th>
                  <th className="py-2 px-3 text-center w-16">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-[#16324F]">
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="h-10">
                      <td colSpan={5} className="py-2.5 px-3">
                        <div className="h-4 bg-slate-100 animate-pulse rounded" />
                      </td>
                    </tr>
                  ))
                ) : filteredWatchlist.length > 0 ? (
                  filteredWatchlist.map((cust: any) => {
                    const firstName = cust.user?.firstName || '';
                    const lastName = cust.user?.lastName || '';
                    const fullName = `${firstName} ${lastName}`.trim() || 'Unknown Customer';
                    const initials = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase() || 'CU';
                    const availableJars = cust.jarBalance?.availableJars ?? 0;
                    const depositDue = cust.jarDeposit?.depositDue ?? 0;
                    const isZero = availableJars === 0;

                    return (
                      <tr 
                        key={cust.id} 
                        className="h-10 hover:bg-slate-50/80 transition-colors"
                      >
                        {/* Customer Column */}
                        <td className="py-2 px-3 font-semibold text-[#16324F]">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-md bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-[10px] shrink-0">
                              {initials}
                            </div>
                            <span className="truncate max-w-[140px] sm:max-w-[180px]">
                              {fullName}
                            </span>
                          </div>
                        </td>

                        {/* Phone Column */}
                        <td className="py-2 px-3 text-[#64748B] font-mono text-[11px]">
                          {cust.user?.phone || '—'}
                        </td>

                        {/* Prepaid Balance Column (Right-aligned) */}
                        <td className="py-2 px-3 text-right">
                          <span 
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                              isZero 
                                ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                                : 'bg-amber-50 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {availableJars} {availableJars === 1 ? 'Jar' : 'Jars'}
                          </span>
                        </td>

                        {/* Deposit Outstanding Column (Right-aligned) */}
                        <td className={`py-2 px-3 text-right font-bold ${depositDue > 0 ? 'text-rose-600' : 'text-[#64748B]'}`}>
                          ₹{depositDue}
                        </td>

                        {/* Action Column */}
                        <td className="py-2 px-3 text-center">
                          <Link
                            to={`/admin/customers/${cust.id}`}
                            className="inline-flex items-center justify-center p-1 text-[#64748B] hover:text-[#1677C8] hover:bg-slate-100 rounded transition-colors"
                            title="View Customer Profile"
                          >
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-xs text-[#94A3B8] italic">
                      {searchQuery ? 'No matching customers found for this filter.' : 'No customer is currently below the low balance threshold (≤ 5 Jars).'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column (4 cols): Side Widgets Matching Height */}
        <div className="lg:col-span-4 space-y-3.5">
          
          {/* Widget 1: Promotional Growth Card */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-3.5 sm:p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-teal-50 text-[#2B6E7A] flex items-center justify-center shrink-0">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <h3 className="text-xs sm:text-sm font-bold text-[#16324F]">
                  Promotional Growth
                </h3>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-200">
                0% Churn
              </span>
            </div>

            <p className="text-xs text-[#64748B] leading-relaxed">
              Drive wallet recharges and retention with festival discounts, referral cashbacks, and package incentives.
            </p>

            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
              <Link
                to="/admin/promos"
                className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-[#F8FAFC] hover:bg-slate-100 text-[#16324F] text-xs font-semibold rounded-lg border border-[#E2E8F0] transition-colors"
              >
                <span>Promo Codes</span>
                <ChevronRight className="w-3 h-3 text-[#94A3B8]" />
              </Link>
              <Link
                to="/admin/catalog"
                className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-[#F8FAFC] hover:bg-slate-100 text-[#16324F] text-xs font-semibold rounded-lg border border-[#E2E8F0] transition-colors"
              >
                <span>Catalog</span>
                <ChevronRight className="w-3 h-3 text-[#94A3B8]" />
              </Link>
            </div>
          </div>

          {/* Widget 2: Operations Hub Quick Links */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-3.5 sm:p-4 shadow-2xs space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#1677C8] flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h3 className="text-xs sm:text-sm font-bold text-[#16324F]">
                  Operations Hub
                </h3>
              </div>
              <span className="text-[10px] font-semibold text-[#94A3B8]">
                Quick Jump
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <Link
                to="/admin/delivery-partners"
                className="flex items-center gap-2 p-2 rounded-lg bg-slate-50/70 hover:bg-slate-100/90 border border-slate-200/60 transition-colors group"
              >
                <Truck className="w-3.5 h-3.5 text-[#1677C8]" />
                <span className="font-semibold text-[#16324F] group-hover:text-[#1677C8] transition-colors truncate">
                  Partners
                </span>
              </Link>

              <Link
                to="/admin/orders/management"
                className="flex items-center gap-2 p-2 rounded-lg bg-slate-50/70 hover:bg-slate-100/90 border border-slate-200/60 transition-colors group"
              >
                <ShoppingCart className="w-3.5 h-3.5 text-[#2B6E7A]" />
                <span className="font-semibold text-[#16324F] group-hover:text-[#2B6E7A] transition-colors truncate">
                  Orders
                </span>
              </Link>

              <Link
                to="/admin/finance"
                className="flex items-center gap-2 p-2 rounded-lg bg-slate-50/70 hover:bg-slate-100/90 border border-slate-200/60 transition-colors group"
              >
                <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                <span className="font-semibold text-[#16324F] group-hover:text-emerald-600 transition-colors truncate">
                  Ledger
                </span>
              </Link>

              <Link
                to="/admin/reports"
                className="flex items-center gap-2 p-2 rounded-lg bg-slate-50/70 hover:bg-slate-100/90 border border-slate-200/60 transition-colors group"
              >
                <FileText className="w-3.5 h-3.5 text-indigo-600" />
                <span className="font-semibold text-[#16324F] group-hover:text-indigo-600 transition-colors truncate">
                  Reports
                </span>
              </Link>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
