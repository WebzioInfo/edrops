import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Download,
  RotateCw,
  Calendar,
  ShoppingCart,
  Users,
  TrendingUp,
  Clock,
  AlertCircle,
  AlertTriangle,
  Building2,
  Truck,
  Award,
  ChevronDown,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
  Check,
} from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';
import { EdropsPageLoader } from '../../../components/common/EdropsPageLoader';
import { DataErrorState } from '../../../components/common/DataErrorState';
import { toast } from '../../../utils/toast';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type DatePreset = 'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS' | 'LAST_30_DAYS' | 'THIS_MONTH' | 'CUSTOM';

interface StaffReportsData {
  dateRange: {
    preset: string;
    startDate: string;
    endDate: string;
  };
  today: {
    ordersCount: number;
    salesAmount: number;
    orderSales: number;
    membershipSales: number;
    newCustomersCount: number;
    deliveriesCount: number;
    membershipsSoldCount: number;
    activeDistributorsCount: number;
    activeDriversCount: number;
    pendingOrdersCount: number;
  };
  period: {
    ordersCount: number;
    salesAmount: number;
    orderSales: number;
    membershipSales: number;
    newCustomersCount: number;
    deliveriesCount: number;
    membershipsSoldCount: number;
    cancelledOrdersCount: number;
    averageOrderValue: number;
  };
  operations: {
    ordersReceived: number;
    ordersProcessing: number;
    ordersOutForDelivery: number;
    ordersDelivered: number;
    ordersCancelled: number;
    totalHandled: number;
    deliveryPipeline: {
      waitingAssignment: number;
      assigned: number;
      outForDelivery: number;
      delivered: number;
      cancelled: number;
    };
  };
  fleet: {
    activeDistributors: number;
    totalDistributors: number;
    activeDrivers: number;
    totalDrivers: number;
  };
  customers: {
    totalCustomers: number;
    newCustomersInRange: number;
    activeCustomers: number;
    inactiveCustomers: number;
    growthTrend: Array<{
      date: string;
      label: string;
      count: number;
    }>;
  };
  salesTimeSeries: Array<{
    date: string;
    label: string;
    orderSales: number;
    membershipSales: number;
    totalSales: number;
    orderCount: number;
  }>;
  membershipPerformance: Array<{
    id: string;
    name: string;
    jarCount: number;
    price: number;
    soldCount: number;
    revenue: number;
    packageBadge?: string;
    packageColor?: string;
  }>;
  attentionItems: Array<{
    id: string;
    type: string;
    title: string;
    description: string;
    count: number;
    severity: 'high' | 'medium' | 'low';
    link: string;
    actionLabel: string;
    sampleItems: string[];
  }>;
  recentActivity: Array<{
    id: string;
    timestamp: string;
    type: 'ORDER' | 'CUSTOMER' | 'DRIVER' | 'SYSTEM' | 'SECURITY';
    title: string;
    description?: string;
    actor: string;
    role: string;
  }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatters & Normalizers
// ─────────────────────────────────────────────────────────────────────────────

function formatINR(val: number | null | undefined): string {
  const n = Number(val ?? 0);
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function formatRelativeTime(isoStr: string): string {
  if (!isoStr) return '—';
  try {
    const d = new Date(isoStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 2) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24 && d.getDate() === now.getDate()) {
      return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    }
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  } catch {
    return '—';
  }
}

function normalizeStaffReportResponse(raw: any): StaffReportsData {
  if (!raw) {
    throw new Error('No data received from report server');
  }
  // In case the response is wrapped inside { data: ... } or returned directly
  const root = raw.data && typeof raw.data === 'object' && raw.data.today ? raw.data : raw;
  if (!root || typeof root !== 'object' || !root.today || !root.period) {
    throw new Error('Invalid report structure received from server');
  }
  return root as StaffReportsData;
}

// ─────────────────────────────────────────────────────────────────────────────
// In-Flight Request Deduplication Cache (Prevents React StrictMode double fetch)
// ─────────────────────────────────────────────────────────────────────────────

const inFlightRequests = new Map<string, Promise<StaffReportsData>>();

async function fetchStaffReports(queryUrl: string, force = false): Promise<StaffReportsData> {
  if (!force && inFlightRequests.has(queryUrl)) {
    return inFlightRequests.get(queryUrl)!;
  }

  const promise = (async () => {
    try {
      const res = await fetchWithAuth(queryUrl);
      return normalizeStaffReportResponse(res);
    } finally {
      inFlightRequests.delete(queryUrl);
    }
  })();

  inFlightRequests.set(queryUrl, promise);
  return promise;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function StaffReports() {
  const navigate = useNavigate();
  const [data, setData] = useState<StaffReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Date filters
  const [preset, setPreset] = useState<DatePreset>('TODAY');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [appliedCustomStart, setAppliedCustomStart] = useState('');
  const [appliedCustomEnd, setAppliedCustomEnd] = useState('');
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [showCustomInputs, setShowCustomInputs] = useState(false);

  // Chart Metric
  const [chartMetric, setChartMetric] = useState<'totalSales' | 'orderCount'>('totalSales');
  const [hoveredPoint, setHoveredPoint] = useState<any | null>(null);

  // Component mount tracker and request ID to prevent race conditions & unmount leaks
  const isMountedRef = useRef(true);
  const latestRequestIdRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ── Load Report Data ───────────────────────────────────────────────────────
  const loadReports = useCallback(
    async (force = false) => {
      const requestId = ++latestRequestIdRef.current;
      if (force) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      if (preset === 'CUSTOM' && (!appliedCustomStart || !appliedCustomEnd)) {
        if (isMountedRef.current && requestId === latestRequestIdRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
        return;
      }

      try {
        let queryUrl = `/staff/reports/summary?preset=${preset}`;
        if (preset === 'CUSTOM' && appliedCustomStart && appliedCustomEnd) {
          queryUrl += `&startDate=${encodeURIComponent(appliedCustomStart)}&endDate=${encodeURIComponent(appliedCustomEnd)}`;
        }

        const reportData = await fetchStaffReports(queryUrl, force);
        if (isMountedRef.current && requestId === latestRequestIdRef.current) {
          setData(reportData);
          setError(null);
        }
      } catch (err: any) {
        if (isMountedRef.current && requestId === latestRequestIdRef.current) {
          console.error('Failed to load staff reports:', err);
          const msg = err?.message || 'Could not load staff report data.';
          setError(msg);
        }
      } finally {
        if (isMountedRef.current && requestId === latestRequestIdRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [preset, appliedCustomStart, appliedCustomEnd]
  );

  useEffect(() => {
    loadReports(false);
  }, [loadReports]);

  // ── Preset Selection ───────────────────────────────────────────────────────
  const handleSelectPreset = (p: DatePreset) => {
    if (p === 'CUSTOM') {
      setShowCustomInputs(true);
    } else {
      setShowCustomInputs(false);
      setFilterMenuOpen(false);
      if (p !== preset) {
        setLoading(true);
        setData(null);
        setPreset(p);
      }
    }
  };

  const applyCustomRange = () => {
    if (!customStart || !customEnd) {
      toast.error('Please select both start and end dates');
      return;
    }
    if (new Date(customStart) > new Date(customEnd)) {
      toast.error('Start date cannot be after end date');
      return;
    }
    setLoading(true);
    setData(null);
    setAppliedCustomStart(customStart);
    setAppliedCustomEnd(customEnd);
    setPreset('CUSTOM');
    setShowCustomInputs(false);
    setFilterMenuOpen(false);
  };

  // ── Export Report CSV ──────────────────────────────────────────────────────
  const exportReport = () => {
    if (!data) return;

    try {
      const rows: string[] = [];

      rows.push(`"eDrops Staff Operations Report"`);
      rows.push(`"Generated At","${new Date().toLocaleString('en-IN')}"`);
      rows.push(
        `"Date Range","${data.dateRange.preset} (${data.dateRange.startDate.slice(0, 10)} to ${data.dateRange.endDate.slice(0, 10)})"`
      );
      rows.push(``);

      // 1. Summary
      rows.push(`"--- EXECUTIVE SUMMARY ---"`);
      rows.push(`"Metric","Today Value","Selected Period Value"`);
      rows.push(`"Orders Handled",${data.today.ordersCount},${data.period.ordersCount}`);
      rows.push(`"Total Revenue (INR)",${data.today.salesAmount},${data.period.salesAmount}`);
      rows.push(`"Order Sales (INR)",${data.today.orderSales},${data.period.orderSales}`);
      rows.push(`"Membership Sales (INR)",${data.today.membershipSales},${data.period.membershipSales}`);
      rows.push(`"Completed Deliveries",${data.today.deliveriesCount},${data.period.deliveriesCount}`);
      rows.push(`"New Customers Added",${data.today.newCustomersCount},${data.period.newCustomersCount}`);
      rows.push(`"Memberships Sold",${data.today.membershipsSoldCount},${data.period.membershipsSoldCount}`);
      rows.push(`"Pending Orders (Current)",${data.today.pendingOrdersCount},"N/A"`);
      rows.push(
        `"Active Fleet","${data.fleet.activeDistributors} Distributors, ${data.fleet.activeDrivers} Drivers","N/A"`
      );
      rows.push(``);

      // 2. Operations Breakdown
      rows.push(`"--- OPERATIONS & ORDER STATUS ---"`);
      rows.push(`"Status Category","Count"`);
      rows.push(`"Orders Received",${data.operations.ordersReceived}`);
      rows.push(`"Orders Processing / Ready",${data.operations.ordersProcessing}`);
      rows.push(`"Out for Delivery",${data.operations.ordersOutForDelivery}`);
      rows.push(`"Orders Delivered",${data.operations.ordersDelivered}`);
      rows.push(`"Orders Cancelled",${data.operations.ordersCancelled}`);
      rows.push(`"Waiting for Assignment",${data.operations.deliveryPipeline.waitingAssignment}`);
      rows.push(`"Assigned to Partner",${data.operations.deliveryPipeline.assigned}`);
      rows.push(``);

      // 3. Daily Sales
      rows.push(`"--- DAILY SALES TREND ---"`);
      rows.push(
        `"Date","Label","Order Sales (INR)","Membership Sales (INR)","Total Sales (INR)","Order Count"`
      );
      data.salesTimeSeries.forEach((s) => {
        rows.push(
          `"${s.date}","${s.label}",${s.orderSales},${s.membershipSales},${s.totalSales},${s.orderCount}`
        );
      });
      rows.push(``);

      // 4. Membership Performance
      rows.push(`"--- MEMBERSHIP PERFORMANCE ---"`);
      rows.push(`"Plan Name","Jars Included","Price (INR)","Sold Count","Revenue Generated (INR)"`);
      data.membershipPerformance.forEach((m) => {
        rows.push(`"${m.name}",${m.jarCount},${m.price},${m.soldCount},${m.revenue}`);
      });
      rows.push(``);

      // 5. Attention Items
      rows.push(`"--- ACTIONABLE ISSUES ---"`);
      rows.push(`"Issue Category","Count","Severity","Description"`);
      if (data.attentionItems.length === 0) {
        rows.push(`"None",0,"normal","All systems and queues are clear."`);
      } else {
        data.attentionItems.forEach((item) => {
          rows.push(`"${item.title}",${item.count},"${item.severity}","${item.description}"`);
        });
      }

      const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(rows.join('\n'));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', csvContent);
      downloadAnchor.setAttribute(
        'download',
        `edrops-staff-report-${preset.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`
      );
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      document.body.removeChild(downloadAnchor);
      toast.success('Report exported successfully');
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Failed to export report');
    }
  };

  const presetLabels: Record<DatePreset, string> = {
    TODAY: 'Today',
    YESTERDAY: 'Yesterday',
    LAST_7_DAYS: 'Last 7 Days',
    LAST_30_DAYS: 'Last 30 Days',
    THIS_MONTH: 'This Month',
    CUSTOM: 'Custom Range',
  };

  // Calculations for chart scaling
  const maxChartValue = useMemo(() => {
    if (!data?.salesTimeSeries || data.salesTimeSeries.length === 0) return 100;
    const vals = data.salesTimeSeries.map((s) => (chartMetric === 'totalSales' ? s.totalSales : s.orderCount));
    const max = Math.max(...vals);
    return max > 0 ? max : 10;
  }, [data?.salesTimeSeries, chartMetric]);

  const maxMembershipSold = useMemo(() => {
    if (!data?.membershipPerformance || data.membershipPerformance.length === 0) return 1;
    const max = Math.max(...data.membershipPerformance.map((m) => m.soldCount));
    return max > 0 ? max : 1;
  }, [data?.membershipPerformance]);

  return (
    <div className="space-y-3.5 sm:space-y-4 animate-in fade-in duration-150">
      {/* ─── 1. TOP TOOLBAR & CONTROLS ───────────────────────────── */}
      <div className="bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-sky-50 text-[#1677C8] border border-sky-100">
            <Calendar className="w-3.5 h-3.5" />
            <span>Period: {presetLabels[preset]}</span>
          </span>
          {loading ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200/60 font-medium">
              <RotateCw className="w-3 h-3 animate-spin text-[#1677C8]" />
              <span>Updating period data...</span>
            </span>
          ) : data?.dateRange ? (
            <span className="text-[11px] text-[#64748B] hidden sm:inline">
              ({data.dateRange.startDate.slice(0, 10)} to {data.dateRange.endDate.slice(0, 10)})
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Date Range Selector Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setFilterMenuOpen(!filterMenuOpen)}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-200 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5 text-[#1677C8]" />
              <span>{presetLabels[preset]}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {filterMenuOpen && (
              <div className="absolute right-0 mt-2 w-60 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-40 text-xs animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Report Period
                </div>
                {(['TODAY', 'YESTERDAY', 'LAST_7_DAYS', 'LAST_30_DAYS', 'THIS_MONTH', 'CUSTOM'] as DatePreset[]).map(
                  (p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => handleSelectPreset(p)}
                      className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between transition-colors ${
                        preset === p ? 'bg-sky-50 text-[#1677C8] font-bold' : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span>{presetLabels[p]}</span>
                      {preset === p && <Check className="w-3.5 h-3.5 text-[#1677C8]" />}
                    </button>
                  )
                )}

                {showCustomInputs && (
                  <div className="p-2.5 border-t border-slate-100 space-y-2 bg-slate-50/70 rounded-b-xl">
                    <p className="text-[11px] font-semibold text-slate-700">Custom Date Range</p>
                    <div className="space-y-1.5">
                      <input
                        type="date"
                        value={customStart}
                        onChange={(e) => setCustomStart(e.target.value)}
                        className="w-full text-xs px-2 py-1 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-[#1677C8]"
                      />
                      <input
                        type="date"
                        value={customEnd}
                        onChange={(e) => setCustomEnd(e.target.value)}
                        className="w-full text-xs px-2 py-1 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-[#1677C8]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={applyCustomRange}
                      className="w-full mt-1 px-3 py-1.5 bg-[#1677C8] hover:bg-[#125ea0] text-white text-xs font-bold rounded-lg shadow-2xs transition-colors cursor-pointer"
                    >
                      Apply Range
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => loadReports(true)}
            disabled={refreshing || loading}
            className="p-1.5 text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
            title="Refresh report data"
          >
            <RotateCw className={`w-3.5 h-3.5 ${refreshing || loading ? 'animate-spin text-[#1677C8]' : ''}`} />
          </button>

          {/* Export Report CSV */}
          <button
            type="button"
            onClick={exportReport}
            disabled={loading || !data}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold shadow-2xs transition-all ${
              loading || !data
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-[#1677C8] hover:bg-[#125ea0] text-white cursor-pointer'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Report</span>
          </button>
        </div>
      </div>

      {/* ─── CONTENT AREA (ERROR / LOADING / DATA) ───────────────── */}
      {error ? (
        <div className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
          <DataErrorState
            title="Unable to load staff reports"
            message={error}
            onRetry={() => loadReports(true)}
          />
        </div>
      ) : loading ? (
        <div className="space-y-3.5 sm:space-y-4 animate-in fade-in duration-150">
          {/* Edrops Branded Loading Card */}
          <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col items-center justify-center text-center">
            <EdropsPageLoader
              size="md"
              minHeight="min-h-[140px]"
              label={`Loading ${presetLabels[preset]} operational reports...`}
            />
          </div>

          {/* Skeleton Placeholders for Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3 animate-pulse"
              >
                <div className="flex items-center justify-between">
                  <div className="h-3 w-20 bg-slate-200 rounded"></div>
                  <div className="h-8 w-8 bg-slate-100 rounded-xl"></div>
                </div>
                <div className="h-6 w-28 bg-slate-200 rounded"></div>
                <div className="h-2.5 w-16 bg-slate-100 rounded"></div>
              </div>
            ))}
          </div>

          {/* Skeleton Placeholders for Charts & Side Panels */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
            <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4 animate-pulse">
              <div className="flex items-center justify-between">
                <div className="h-4 w-32 bg-slate-200 rounded"></div>
                <div className="h-6 w-24 bg-slate-100 rounded-lg"></div>
              </div>
              <div className="h-48 bg-slate-50 rounded-xl flex items-end p-4 gap-2">
                {[...Array(7)].map((_, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-slate-200/70 rounded-t"
                    style={{ height: `${30 + (i * 15) % 60}%` }}
                  ></div>
                ))}
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4 animate-pulse">
              <div className="h-4 w-28 bg-slate-200 rounded"></div>
              <div className="space-y-3 pt-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-10 bg-slate-100 rounded-xl"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : data ? (
        <>
          {/* ─── 2. SUMMARY CARDS (TODAY / PERIOD) ────────────────────── */}
          <section className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              {preset === 'TODAY' ? "Today's Operational Summary" : `${presetLabels[preset]} Summary`}
            </span>
          </div>
          {preset !== 'TODAY' && (
            <span className="text-[11px] text-slate-400 font-medium">
              Live today stats: {data.today.ordersCount} orders | {formatINR(data.today.salesAmount)}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          {/* Card 1: Orders */}
          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-[#E2E8F0] shadow-2xs">
            <div className="flex items-center justify-between text-xs text-[#64748B]">
              <span className="font-semibold text-slate-600">
                {preset === 'TODAY' ? 'Orders Today' : 'Period Orders'}
              </span>
              <div className="w-7 h-7 rounded-lg bg-sky-50 text-[#1677C8] flex items-center justify-center">
                <ShoppingCart className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">
                {preset === 'TODAY' ? data.today.ordersCount : data.period.ordersCount}
              </span>
              <span className="text-xs text-slate-500 font-medium">orders</span>
            </div>
            <div className="mt-1 text-[11px] text-[#64748B]">
              {data.today.pendingOrdersCount > 0
                ? `${data.today.pendingOrdersCount} orders currently pending`
                : 'All incoming orders processed'}
            </div>
          </div>

          {/* Card 2: Sales */}
          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-[#E2E8F0] shadow-2xs">
            <div className="flex items-center justify-between text-xs text-[#64748B]">
              <span className="font-semibold text-slate-600">
                {preset === 'TODAY' ? 'Sales Today' : 'Period Sales'}
              </span>
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">
                {formatINR(preset === 'TODAY' ? data.today.salesAmount : data.period.salesAmount)}
              </span>
            </div>
            <div className="mt-1 text-[11px] text-[#64748B]">
              {preset === 'TODAY'
                ? `Orders: ${formatINR(data.today.orderSales)}`
                : `Avg Order: ${formatINR(data.period.averageOrderValue)}`}
            </div>
          </div>

          {/* Card 3: New Customers */}
          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-[#E2E8F0] shadow-2xs">
            <div className="flex items-center justify-between text-xs text-[#64748B]">
              <span className="font-semibold text-slate-600">New Customers</span>
              <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Users className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">
                +{preset === 'TODAY' ? data.today.newCustomersCount : data.period.newCustomersCount}
              </span>
              <span className="text-xs text-slate-500 font-medium">registered</span>
            </div>
            <div className="mt-1 text-[11px] text-[#64748B]">
              Total customer base: {data.customers.totalCustomers}
            </div>
          </div>

          {/* Card 4: Deliveries */}
          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-[#E2E8F0] shadow-2xs">
            <div className="flex items-center justify-between text-xs text-[#64748B]">
              <span className="font-semibold text-slate-600">Completed Deliveries</span>
              <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
                <Truck className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">
                {preset === 'TODAY' ? data.today.deliveriesCount : data.period.deliveriesCount}
              </span>
              <span className="text-xs text-slate-500 font-medium">delivered</span>
            </div>
            <div className="mt-1 text-[11px] text-[#64748B]">
              Active fleet: {data.fleet.activeDistributors} distributors · {data.fleet.activeDrivers} drivers
            </div>
          </div>
        </div>
      </section>

      {/* ─── 3. OPERATIONS & DELIVERY PIPELINE ───────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        {/* Operations Activity */}
        <section className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
          <div className="p-3.5 sm:p-4 border-b border-slate-200/80 bg-slate-50/70 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#0F172A]">Operations Activity</h2>
              <p className="text-[11px] text-[#64748B]">Order handling volume breakdown for period</p>
            </div>
            <span className="text-xs font-bold px-2 py-0.5 bg-slate-100 text-slate-700 rounded-lg">
              {data.operations.totalHandled} Handled
            </span>
          </div>

          <div className="p-4 space-y-3">
            {/* Orders Received */}
            <div>
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="font-medium text-slate-700 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  Orders Received
                </span>
                <span className="font-bold text-slate-900">{data.operations.ordersReceived}</span>
              </div>
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-300"
                  style={{
                    width: `${
                      data.operations.totalHandled > 0
                        ? Math.min(100, (data.operations.ordersReceived / data.operations.totalHandled) * 100)
                        : 0
                    }%`,
                  }}
                ></div>
              </div>
            </div>

            {/* Orders Processing */}
            <div>
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="font-medium text-slate-700 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  Orders Processing
                </span>
                <span className="font-bold text-slate-900">{data.operations.ordersProcessing}</span>
              </div>
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all duration-300"
                  style={{
                    width: `${
                      data.operations.totalHandled > 0
                        ? Math.min(100, (data.operations.ordersProcessing / data.operations.totalHandled) * 100)
                        : 0
                    }%`,
                  }}
                ></div>
              </div>
            </div>

            {/* Out for Delivery */}
            <div>
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="font-medium text-slate-700 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-sky-500"></span>
                  Out for Delivery
                </span>
                <span className="font-bold text-slate-900">{data.operations.ordersOutForDelivery}</span>
              </div>
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-sky-500 rounded-full transition-all duration-300"
                  style={{
                    width: `${
                      data.operations.totalHandled > 0
                        ? Math.min(100, (data.operations.ordersOutForDelivery / data.operations.totalHandled) * 100)
                        : 0
                    }%`,
                  }}
                ></div>
              </div>
            </div>

            {/* Orders Delivered */}
            <div>
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="font-medium text-slate-700 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Orders Delivered
                </span>
                <span className="font-bold text-slate-900">{data.operations.ordersDelivered}</span>
              </div>
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                  style={{
                    width: `${
                      data.operations.totalHandled > 0
                        ? Math.min(100, (data.operations.ordersDelivered / data.operations.totalHandled) * 100)
                        : 0
                    }%`,
                  }}
                ></div>
              </div>
            </div>

            {/* Orders Cancelled */}
            <div>
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="font-medium text-slate-700 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                  Orders Cancelled
                </span>
                <span className="font-bold text-slate-900">{data.operations.ordersCancelled}</span>
              </div>
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-rose-400 rounded-full transition-all duration-300"
                  style={{
                    width: `${
                      data.operations.totalHandled > 0
                        ? Math.min(100, (data.operations.ordersCancelled / data.operations.totalHandled) * 100)
                        : 0
                    }%`,
                  }}
                ></div>
              </div>
            </div>
          </div>
        </section>

        {/* Delivery Pipeline & Fleet */}
        <section className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden flex flex-col justify-between">
          <div>
            <div className="p-3.5 sm:p-4 border-b border-slate-200/80 bg-slate-50/70 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-[#0F172A]">Delivery Pipeline & Fleet</h2>
                <p className="text-[11px] text-[#64748B]">Real-time queue distribution</p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/staff/orders')}
                className="text-xs font-bold text-[#1677C8] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Orders</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Pipeline Stage Blocks */}
            <div className="p-4 grid grid-cols-3 gap-2.5">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 block">
                  Waiting
                </span>
                <span className="text-xl font-extrabold text-slate-900 mt-0.5 block">
                  {data.operations.deliveryPipeline.waitingAssignment}
                </span>
                <span className="text-[10px] text-slate-400">Unassigned</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600 block">
                  Assigned
                </span>
                <span className="text-xl font-extrabold text-slate-900 mt-0.5 block">
                  {data.operations.deliveryPipeline.assigned}
                </span>
                <span className="text-[10px] text-slate-400">With Partner</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 block">
                  On Vehicle
                </span>
                <span className="text-xl font-extrabold text-slate-900 mt-0.5 block">
                  {data.operations.deliveryPipeline.outForDelivery}
                </span>
                <span className="text-[10px] text-slate-400">Out for delivery</span>
              </div>
            </div>
          </div>

          {/* Active Fleet Strip */}
          <div className="p-3.5 bg-slate-50/70 border-t border-slate-100 flex items-center justify-around text-center">
            <div>
              <div className="flex items-center justify-center gap-1 text-[11px] text-[#64748B]">
                <Building2 className="w-3.5 h-3.5 text-blue-500" />
                <span>Distributors</span>
              </div>
              <div className="text-sm font-bold text-slate-900 mt-0.5">
                {data.fleet.activeDistributors}{' '}
                <span className="text-[10px] font-normal text-slate-400">
                  / {data.fleet.totalDistributors}
                </span>
              </div>
            </div>

            <div className="h-6 w-px bg-slate-200"></div>

            <div>
              <div className="flex items-center justify-center gap-1 text-[11px] text-[#64748B]">
                <Truck className="w-3.5 h-3.5 text-emerald-500" />
                <span>Drivers</span>
              </div>
              <div className="text-sm font-bold text-slate-900 mt-0.5">
                {data.fleet.activeDrivers}{' '}
                <span className="text-[10px] font-normal text-slate-400">
                  / {data.fleet.totalDrivers}
                </span>
              </div>
            </div>

            <div className="h-6 w-px bg-slate-200"></div>

            <div>
              <div className="flex items-center justify-center gap-1 text-[11px] text-[#64748B]">
                <Award className="w-3.5 h-3.5 text-amber-500" />
                <span>Memberships</span>
              </div>
              <div className="text-sm font-bold text-slate-900 mt-0.5">
                {data.period.membershipsSoldCount}{' '}
                <span className="text-[10px] font-normal text-slate-400">sold</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* ─── 4. SALES & MEMBERSHIP PERFORMANCE ───────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
        {/* Sales Overview Chart (2 cols) */}
        <section className="lg:col-span-2 bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
          <div className="p-3.5 sm:p-4 border-b border-slate-200/80 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-[#0F172A]">Sales Overview</h2>
              <p className="text-[11px] text-[#64748B]">Revenue timeline across orders and memberships</p>
            </div>

            {/* Toggle */}
            <div className="flex items-center bg-slate-200/70 p-0.5 rounded-lg text-xs font-semibold">
              <button
                type="button"
                onClick={() => setChartMetric('totalSales')}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  chartMetric === 'totalSales'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Revenue (₹)
              </button>
              <button
                type="button"
                onClick={() => setChartMetric('orderCount')}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  chartMetric === 'orderCount'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Orders
              </button>
            </div>
          </div>

          <div className="p-4">
            {data.salesTimeSeries.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                <ShoppingCart className="w-7 h-7 mx-auto mb-1 text-slate-300" />
                No sales data recorded for this period.
              </div>
            ) : (
              <div className="h-52 w-full flex flex-col justify-end pt-3 pb-1 relative">
                {/* Hover Tooltip */}
                {hoveredPoint && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-[#0F172A] text-white text-xs px-3 py-1.5 rounded-lg shadow-lg pointer-events-none z-10 flex items-center gap-2">
                    <span className="font-bold">{hoveredPoint.label}</span>
                    <span>Total: {formatINR(hoveredPoint.totalSales)}</span>
                    <span className="text-sky-300">({hoveredPoint.orderCount} orders)</span>
                  </div>
                )}

                {/* Bars */}
                <div className="flex items-end justify-between gap-1 h-36 px-1">
                  {data.salesTimeSeries.map((point) => {
                    const val = chartMetric === 'totalSales' ? point.totalSales : point.orderCount;
                    const heightPercent = maxChartValue > 0 ? Math.max(8, (val / maxChartValue) * 100) : 8;
                    const isHovered = hoveredPoint?.date === point.date;

                    return (
                      <div
                        key={point.date}
                        onMouseEnter={() => setHoveredPoint(point)}
                        onMouseLeave={() => setHoveredPoint(null)}
                        className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer"
                      >
                        <div className="w-full max-w-[28px] flex flex-col items-center h-full justify-end">
                          <div
                            className={`w-full rounded-t transition-all ${
                              isHovered
                                ? 'bg-[#1677C8]'
                                : val > 0
                                ? 'bg-gradient-to-t from-[#1677C8] to-[#08A9E6] opacity-90 group-hover:opacity-100'
                                : 'bg-slate-100'
                            }`}
                            style={{ height: `${heightPercent}%` }}
                          ></div>
                        </div>
                        <span className="text-[9px] text-slate-400 mt-1.5 truncate w-full text-center group-hover:text-slate-700 font-medium">
                          {point.label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100 mt-1">
                  <span>0</span>
                  <span>
                    Peak:{' '}
                    {chartMetric === 'totalSales' ? formatINR(maxChartValue) : `${maxChartValue} orders`}
                  </span>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Membership Performance (1 col) */}
        <section className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden flex flex-col justify-between">
          <div>
            <div className="p-3.5 sm:p-4 border-b border-slate-200/80 bg-slate-50/70 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-[#0F172A]">Membership Performance</h2>
                <p className="text-[11px] text-[#64748B]">Prepaid packages purchased</p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/staff/memberships')}
                className="text-xs font-bold text-[#1677C8] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Plans</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-3.5 space-y-2.5">
              {data.membershipPerformance.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  <Award className="w-6 h-6 mx-auto mb-1 text-slate-300" />
                  No membership plans available.
                </div>
              ) : (
                data.membershipPerformance.map((pkg) => {
                  const percent = Math.min(100, Math.round((pkg.soldCount / maxMembershipSold) * 100));

                  return (
                    <div key={pkg.id} className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-bold text-slate-800 flex items-center gap-1">
                          {pkg.name}
                          {pkg.packageBadge && (
                            <span className="text-[9px] px-1.5 py-0.2 bg-sky-100 text-sky-800 rounded font-semibold">
                              {pkg.packageBadge}
                            </span>
                          )}
                        </span>
                        <span className="font-extrabold text-slate-900">{pkg.soldCount} sold</span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                        <span>{pkg.jarCount} Jars · {formatINR(pkg.price)}</span>
                        <span>{formatINR(pkg.revenue)}</span>
                      </div>

                      <div className="h-1.5 w-full bg-slate-200/80 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-sky-400 to-[#1677C8] rounded-full"
                          style={{ width: `${percent}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="p-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Period Memberships Sold:</span>
            <span className="font-bold text-slate-900">{data.period.membershipsSoldCount}</span>
          </div>
        </section>
      </div>

      {/* ─── 5. CUSTOMER OVERVIEW & RECENT ACTIVITY ──────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        {/* Customer Overview */}
        <section className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
          <div className="p-3.5 sm:p-4 border-b border-slate-200/80 bg-slate-50/70 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#0F172A]">Customer Overview</h2>
              <p className="text-[11px] text-[#64748B]">Customer registrations and activity</p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/staff/customers')}
              className="text-xs font-bold text-[#1677C8] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Customers</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            {/* 4 Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-center">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total</span>
                <div className="text-lg font-extrabold text-slate-900 mt-0.5">
                  {data.customers.totalCustomers}
                </div>
              </div>

              <div className="p-2.5 bg-emerald-50/60 rounded-xl border border-emerald-100 text-center">
                <span className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider">New</span>
                <div className="text-lg font-extrabold text-emerald-800 mt-0.5">
                  +{data.customers.newCustomersInRange}
                </div>
              </div>

              <div className="p-2.5 bg-sky-50/60 rounded-xl border border-sky-100 text-center">
                <span className="text-[10px] text-sky-700 font-bold uppercase tracking-wider">Active</span>
                <div className="text-lg font-extrabold text-sky-900 mt-0.5">
                  {data.customers.activeCustomers}
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-center">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Inactive</span>
                <div className="text-lg font-extrabold text-slate-600 mt-0.5">
                  {data.customers.inactiveCustomers}
                </div>
              </div>
            </div>

            {/* Growth Trend */}
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1.5">
                <span>New Registrations Trend</span>
                <span className="text-[11px] text-slate-400 font-normal">By Date</span>
              </div>
              <div className="flex items-end gap-1 h-14 pt-1">
                {data.customers.growthTrend.map((item) => {
                  const maxCount = Math.max(1, ...data.customers.growthTrend.map((g) => g.count));
                  const heightPct = Math.max(15, (item.count / maxCount) * 100);

                  return (
                    <div key={item.date} className="flex-1 flex flex-col items-center h-full justify-end group">
                      <div
                        className={`w-full rounded-t transition-all ${
                          item.count > 0 ? 'bg-indigo-500 group-hover:bg-indigo-600' : 'bg-slate-100'
                        }`}
                        style={{ height: `${heightPct}%` }}
                        title={`${item.label}: ${item.count} new customers`}
                      ></div>
                      <span className="text-[8px] text-slate-400 mt-1 truncate group-hover:text-slate-700">
                        {item.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Recent Staff Activity Timeline */}
        <section className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
          <div className="p-3.5 sm:p-4 border-b border-slate-200/80 bg-slate-50/70 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#0F172A]">Recent Staff Activity</h2>
              <p className="text-[11px] text-[#64748B]">Operational event stream</p>
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Live Log</span>
          </div>

          <div className="p-4 max-h-72 overflow-y-auto">
            {data.recentActivity.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                <Clock className="w-6 h-6 mx-auto mb-1 text-slate-300" />
                No recent activity recorded for this period.
              </div>
            ) : (
              <div className="relative pl-5 space-y-3 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {data.recentActivity.map((act) => {
                  let dotColor = 'bg-blue-500 ring-blue-100';
                  if (act.type === 'CUSTOMER') dotColor = 'bg-indigo-500 ring-indigo-100';
                  if (act.type === 'DRIVER') dotColor = 'bg-emerald-500 ring-emerald-100';
                  if (act.type === 'SECURITY') dotColor = 'bg-rose-500 ring-rose-100';

                  return (
                    <div key={act.id} className="relative group">
                      <span
                        className={`absolute -left-5 top-1.5 w-2 h-2 rounded-full ring-3 ${dotColor}`}
                      ></span>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                        <div>
                          <span className="font-semibold text-slate-800">{act.title}</span>
                          {act.description && (
                            <p className="text-[11px] text-slate-500 mt-0.2">{act.description}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 self-start sm:self-center shrink-0">
                          <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded text-[10px] font-medium">
                            {act.actor}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {formatRelativeTime(act.timestamp)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ─── 6. NEEDS ATTENTION ──────────────────────────────────── */}
      <section className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
        <div className="p-3.5 sm:p-4 border-b border-slate-200/80 bg-slate-50/70 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-[#0F172A]">Needs Attention</h2>
            {data.attentionItems.length > 0 ? (
              <span className="px-2 py-0.5 bg-rose-100 text-rose-700 font-bold text-xs rounded-full">
                {data.attentionItems.length}
              </span>
            ) : (
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 font-bold text-xs rounded-full">
                0
              </span>
            )}
          </div>
          <p className="text-[11px] text-[#64748B]">Actionable queues requiring staff intervention</p>
        </div>

        <div className="p-4">
          {data.attentionItems.length === 0 ? (
            /* Clean "No items need attention" state (no giant empty card) */
            <div className="py-4 px-4 bg-emerald-50/50 rounded-xl border border-emerald-100 flex items-center gap-3">
              <div className="w-8 h-8 bg-emerald-100 text-emerald-700 rounded-lg flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-emerald-900">No items need attention</h3>
                <p className="text-[11px] text-emerald-700 mt-0.5">
                  All orders, assignments, and operations are running smoothly with no pending alerts.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {data.attentionItems.map((item) => {
                const isHigh = item.severity === 'high';
                const isMed = item.severity === 'medium';

                return (
                  <div
                    key={item.id}
                    className={`p-3.5 rounded-xl border flex flex-col justify-between ${
                      isHigh
                        ? 'bg-rose-50/50 border-rose-200'
                        : isMed
                        ? 'bg-amber-50/50 border-amber-200'
                        : 'bg-sky-50/50 border-sky-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          {isHigh ? (
                            <AlertCircle className="w-4 h-4 text-rose-600" />
                          ) : isMed ? (
                            <AlertTriangle className="w-4 h-4 text-amber-600" />
                          ) : (
                            <Clock className="w-4 h-4 text-sky-600" />
                          )}
                          {item.title}
                        </span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wider ${
                            isHigh
                              ? 'bg-rose-100 text-rose-800'
                              : isMed
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-sky-100 text-sky-800'
                          }`}
                        >
                          {item.severity}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-600 mb-2">{item.description}</p>

                      {item.sampleItems && item.sampleItems.length > 0 && (
                        <div className="space-y-1 mb-2.5">
                          {item.sampleItems.slice(0, 3).map((sample, idx) => (
                            <div
                              key={idx}
                              className="text-[10px] text-slate-500 bg-white/80 px-2 py-0.5 rounded border border-slate-200/60 truncate font-mono"
                            >
                              {sample}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => navigate(item.link)}
                      className={`inline-flex items-center justify-center gap-1.5 w-full py-1.5 px-3 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        isHigh
                          ? 'bg-rose-600 hover:bg-rose-700 text-white'
                          : isMed
                          ? 'bg-amber-600 hover:bg-amber-700 text-white'
                          : 'bg-sky-600 hover:bg-sky-700 text-white'
                      }`}
                    >
                      <span>{item.actionLabel}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
        </>
      ) : null}
    </div>
  );
}
