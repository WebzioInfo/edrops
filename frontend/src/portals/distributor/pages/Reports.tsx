import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Calendar,
  Download,
  RefreshCw,
  X,
  ChevronDown,
  Package,
  ShoppingCart,
  Users,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowUpRight,
  FileText,
} from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';
import { useAuth } from '../../../contexts/AuthContext';
import { formatOrderId, formatOrderStatus } from '../../../utils/orderFormatters';
import { getOrderStatusConfig } from '../../../utils/orderStateMachine';

// ─────────────────────────────────────────────────────────────────────────────
// Types (re-using shapes from existing pages)
// ─────────────────────────────────────────────────────────────────────────────

interface PurchaseItem {
  productName: string;
  quantity: number;
  rate: number;
  amount: number;
}

interface PurchaseRecord {
  id: string;
  purchaseNumber: string;
  purchaseDate: string;
  supplierName: string;
  supplierId?: string | null;
  supplier?: { id: string; name: string } | null;
  items: PurchaseItem[];
  subtotal: number;
  tax: number;
  total: number;
  paymentStatus: 'PAID' | 'PENDING' | 'PARTIAL' | 'CANCELLED';
  amountPaid?: number | null;
  notes?: string | null;
  createdAt: string;
}

interface SupplierRecord {
  id: string;
  name: string;
  companyName?: string | null;
  phone?: string | null;
  email?: string | null;
  isActive: boolean;
  purchaseCount: number;
  totalPurchased: number;
  totalPaid: number;
  balance: number;
  createdAt: string;
  updatedAt: string;
}

interface DistributorOrder {
  id: string;
  customerId: string;
  customer?: {
    user?: { firstName?: string; lastName?: string; phone?: string };
    companyName?: string | null;
  };
  status: string;
  totalAmount: number;
  amountPaid?: number;
  amountDue?: number;
  paymentStatus: string;
  paymentMethod?: string | null;
  createdAt: string;
  items: Array<{ quantity: number; product?: { isJar?: boolean } }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatINR(amount: number | null | undefined): string {
  const n = Number(amount ?? 0);
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function formatDate(dateStr: string | null | undefined, opts?: Intl.DateTimeFormatOptions): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', opts ?? { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true,
    });
  } catch {
    return '—';
  }
}

type DatePreset = 'today' | 'yesterday' | '7d' | '30d' | 'month' | 'custom';

function getDateRange(preset: DatePreset, customStart?: Date, customEnd?: Date): { start: Date; end: Date } {
  const now = new Date();
  const startOfDay = (d: Date) => { const r = new Date(d); r.setHours(0, 0, 0, 0); return r; };
  const endOfDay   = (d: Date) => { const r = new Date(d); r.setHours(23, 59, 59, 999); return r; };

  if (preset === 'today')     return { start: startOfDay(now), end: endOfDay(now) };
  if (preset === 'yesterday') {
    const y = new Date(now); y.setDate(y.getDate() - 1);
    return { start: startOfDay(y), end: endOfDay(y) };
  }
  if (preset === '7d') {
    const s = new Date(now); s.setDate(s.getDate() - 6);
    return { start: startOfDay(s), end: endOfDay(now) };
  }
  if (preset === '30d') {
    const s = new Date(now); s.setDate(s.getDate() - 29);
    return { start: startOfDay(s), end: endOfDay(now) };
  }
  if (preset === 'month') {
    const s = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start: startOfDay(s), end: endOfDay(now) };
  }
  if (preset === 'custom' && customStart && customEnd) {
    return { start: startOfDay(customStart), end: endOfDay(customEnd) };
  }
  const s = new Date(now); s.setDate(s.getDate() - 6);
  return { start: startOfDay(s), end: endOfDay(now) };
}

function isInRange(dateStr: string | null | undefined, range: { start: Date; end: Date }): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return d >= range.start && d <= range.end;
}

function isoDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  trend?: 'up' | 'down' | 'neutral';
}

const KpiCard: React.FC<KpiCardProps> = ({ label, value, sub, icon: Icon, color, trend }) => (
  <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 flex items-start gap-3">
    <div className={`shrink-0 flex h-9 w-9 items-center justify-center rounded-lg ${color}`}>
      <Icon className="w-4 h-4" />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-[11px] font-medium text-[#64748B] uppercase tracking-wide leading-none mb-1">{label}</p>
      <p className="text-lg font-bold text-[#16324F] leading-tight truncate">{value}</p>
      {sub && <p className="text-[11px] text-[#94A3B8] mt-0.5">{sub}</p>}
    </div>
    {trend === 'up' && <TrendingUp className="w-4 h-4 text-emerald-500 shrink-0 mt-1" />}
    {trend === 'down' && <TrendingDown className="w-4 h-4 text-rose-400 shrink-0 mt-1" />}
  </div>
);

const StatusBadge: React.FC<{ status: string; type?: 'payment' | 'order' }> = ({ status, type }) => {
  const s = status?.toUpperCase() ?? '';
  let cls = 'bg-slate-100 text-slate-600';
  if (type === 'payment') {
    if (s === 'PAID') cls = 'bg-emerald-50 text-emerald-700 border border-emerald-200';
    else if (s === 'PARTIAL') cls = 'bg-amber-50 text-amber-700 border border-amber-200';
    else if (s === 'PENDING') cls = 'bg-rose-50 text-rose-600 border border-rose-200';
  } else {
    const cfg = getOrderStatusConfig(s);
    cls = cfg?.badgeClass ?? 'bg-slate-100 text-slate-600';
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${cls}`}>
      {type === 'payment' ? s : formatOrderStatus(s)}
    </span>
  );
};

interface MiniBarChartProps {
  data: { label: string; value: number }[];
  label: string;
}

const MiniBarChart: React.FC<MiniBarChartProps> = ({ data, label }) => {
  const max = Math.max(...data.map(d => d.value), 1);
  const hasData = data.some(d => d.value > 0);

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center h-28 text-[#CBD5E1]">
        <BarChart3 className="w-8 h-8 mb-2 opacity-40" />
        <p className="text-xs">No data for period</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wide mb-3">{label}</p>
      <div className="flex items-end gap-1 h-20">
        {data.map((d, i) => {
          const pct = max > 0 ? (d.value / max) * 100 : 0;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${d.label}: ${d.value}`}>
              <div className="w-full flex flex-col justify-end" style={{ height: '64px' }}>
                <div
                  className="w-full rounded-sm bg-[#1677C8] opacity-80 transition-all"
                  style={{ height: `${Math.max(pct, pct > 0 ? 4 : 0)}%` }}
                />
              </div>
              <span className="text-[8px] text-[#94A3B8] truncate w-full text-center">{d.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// PDF Generation (browser print)
// ─────────────────────────────────────────────────────────────────────────────

interface PDFOpts {
  user: { firstName: string; lastName: string; email: string; phone?: string };
  reportType: string;
  rangeLabel: string;
  purchases: PurchaseRecord[];
  suppliers: (SupplierRecord & { purchasesInRange: number; totalInRange: number; lastPurchasedAt: string | null })[];
  orders: DistributorOrder[];
  kpis: Record<string, string | number>;
}

function generatePDF(opts: PDFOpts) {
  const { user, reportType, rangeLabel, purchases, suppliers, orders, kpis } = opts;
  const now = new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
  const distributorName = `${user.firstName} ${user.lastName}`;

  const tableStyle = `border-collapse:collapse;width:100%;font-size:11px;margin-bottom:16px;`;
  const thStyle = `background:#1677C8;color:#fff;padding:6px 8px;text-align:left;font-weight:600;`;
  const tdStyle = `border-bottom:1px solid #E2E8F0;padding:5px 8px;color:#374151;`;
  const trAlt = `background:#F8FAFC;`;

  let bodyHTML = '';

  bodyHTML += `
    <h2 style="font-size:13px;font-weight:700;color:#16324F;margin:18px 0 8px;">Key Metrics</h2>
    <table style="${tableStyle}">
      <thead><tr><th style="${thStyle}">Metric</th><th style="${thStyle}">Value</th></tr></thead>
      <tbody>${Object.entries(kpis).map(([k, v], i) =>
        `<tr style="${i % 2 === 1 ? trAlt : ''}"><td style="${tdStyle}">${k}</td><td style="${tdStyle};font-weight:600;">${v}</td></tr>`
      ).join('')}</tbody>
    </table>`;

  if (reportType === 'PURCHASES' || reportType === 'OVERVIEW') {
    bodyHTML += `
      <h2 style="font-size:13px;font-weight:700;color:#16324F;margin:18px 0 8px;">Purchases (${purchases.length})</h2>
      <table style="${tableStyle}">
        <thead><tr>
          <th style="${thStyle}">Purchase #</th><th style="${thStyle}">Date</th>
          <th style="${thStyle}">Supplier</th><th style="${thStyle}">Items</th>
          <th style="${thStyle}">Total</th><th style="${thStyle}">Paid</th>
          <th style="${thStyle}">Pending</th><th style="${thStyle}">Status</th>
        </tr></thead>
        <tbody>${purchases.map((p, i) => {
          const pending = Math.max(0, p.total - (p.amountPaid ?? 0));
          return `<tr style="${i % 2 === 1 ? trAlt : ''}">
            <td style="${tdStyle}">${p.purchaseNumber}</td>
            <td style="${tdStyle}">${formatDate(p.purchaseDate)}</td>
            <td style="${tdStyle}">${p.supplierName}</td>
            <td style="${tdStyle}">${p.items?.length ?? 0}</td>
            <td style="${tdStyle}">${formatINR(p.total)}</td>
            <td style="${tdStyle}">${formatINR(p.amountPaid)}</td>
            <td style="${tdStyle}">${formatINR(pending)}</td>
            <td style="${tdStyle}">${p.paymentStatus}</td>
          </tr>`;
        }).join('')}</tbody>
      </table>`;
  }

  if (reportType === 'SUPPLIERS' || reportType === 'OVERVIEW') {
    bodyHTML += `
      <h2 style="font-size:13px;font-weight:700;color:#16324F;margin:18px 0 8px;">Suppliers (${suppliers.length})</h2>
      <table style="${tableStyle}">
        <thead><tr>
          <th style="${thStyle}">Supplier</th><th style="${thStyle}">Purchases (Period)</th>
          <th style="${thStyle}">Total Purchased</th><th style="${thStyle}">Total Paid</th>
          <th style="${thStyle}">Outstanding</th>
        </tr></thead>
        <tbody>${suppliers.map((s, i) =>
          `<tr style="${i % 2 === 1 ? trAlt : ''}">
            <td style="${tdStyle}">${s.name}${s.companyName ? ` (${s.companyName})` : ''}</td>
            <td style="${tdStyle}">${s.purchasesInRange}</td>
            <td style="${tdStyle}">${formatINR(s.totalPurchased)}</td>
            <td style="${tdStyle}">${formatINR(s.totalPaid)}</td>
            <td style="${tdStyle};color:${s.balance > 0 ? '#DC2626' : '#16A34A'};">${formatINR(Math.abs(s.balance))}</td>
          </tr>`
        ).join('')}</tbody>
      </table>`;
  }

  if (reportType === 'ORDERS' || reportType === 'OVERVIEW') {
    bodyHTML += `
      <h2 style="font-size:13px;font-weight:700;color:#16324F;margin:18px 0 8px;">Orders (${orders.length})</h2>
      <table style="${tableStyle}">
        <thead><tr>
          <th style="${thStyle}">Order #</th><th style="${thStyle}">Date</th>
          <th style="${thStyle}">Customer</th><th style="${thStyle}">Amount</th>
          <th style="${thStyle}">Payment</th><th style="${thStyle}">Status</th>
        </tr></thead>
        <tbody>${orders.map((o, i) => {
          const custName = o.customer?.user?.firstName
            ? `${o.customer.user.firstName} ${o.customer.user.lastName ?? ''}`.trim()
            : o.customer?.companyName ?? '—';
          return `<tr style="${i % 2 === 1 ? trAlt : ''}">
            <td style="${tdStyle}">#${formatOrderId(o.id)}</td>
            <td style="${tdStyle}">${formatDate(o.createdAt)}</td>
            <td style="${tdStyle}">${custName}</td>
            <td style="${tdStyle}">${formatINR(o.totalAmount)}</td>
            <td style="${tdStyle}">${o.paymentStatus}</td>
            <td style="${tdStyle}">${formatOrderStatus(o.status)}</td>
          </tr>`;
        }).join('')}</tbody>
      </table>`;
  }

  const reportTitle = reportType === 'OVERVIEW' ? 'Business Overview Report'
    : `${reportType.charAt(0) + reportType.slice(1).toLowerCase()} Report`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Edrops – ${reportTitle} – ${rangeLabel}</title>
  <style>
    @page { size: A4; margin: 18mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #374151; font-size: 12px; margin: 0; }
    .header { border-bottom: 2px solid #1677C8; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start; }
    .logo-text { font-size: 24px; font-weight: 900; color: #1677C8; letter-spacing: -0.5px; margin: 0 0 4px; }
    .distributor-name { font-size: 16px; font-weight: 700; color: #16324F; margin: 0 0 2px; }
    .contact { font-size: 10px; color: #64748B; margin: 0; }
    .meta { text-align: right; }
    .report-title { font-size: 14px; font-weight: 700; color: #16324F; margin: 0 0 4px; }
    .period { font-size: 11px; color: #374151; margin: 0 0 2px; }
    .generated { font-size: 10px; color: #94A3B8; margin: 0; }
    footer { position: fixed; bottom: 0; left: 0; right: 0; font-size: 9px; color: #94A3B8; text-align: center; padding: 6px 0; border-top: 1px solid #E2E8F0; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <p class="logo-text">edrops</p>
      <p class="distributor-name">${distributorName}</p>
      <p class="contact">${user.email}${user.phone ? ' · ' + user.phone : ''}</p>
    </div>
    <div class="meta">
      <p class="report-title">${reportTitle}</p>
      <p class="period">Period: <strong>${rangeLabel}</strong></p>
      <p class="generated">Generated: ${now}</p>
    </div>
  </div>
  ${bodyHTML}
  <footer>Edrops Distributor Portal · Generated ${now}</footer>
</body>
</html>`;

  const printWin = window.open('', '_blank', 'width=900,height=700');
  if (!printWin) { alert('Please allow pop-ups to generate the PDF.'); return; }
  printWin.document.write(html);
  printWin.document.close();
  printWin.focus();
  setTimeout(() => { printWin.print(); }, 600);
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary Row helper
// ─────────────────────────────────────────────────────────────────────────────

function SummaryRow({ label, value, color, bold }: { label: string; value: string; color?: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-[#F1F5F9] last:border-0">
      <span className="text-xs text-[#64748B]">{label}</span>
      <span className={`text-xs ${bold ? 'font-bold text-[#16324F]' : 'font-medium'} ${color ?? 'text-[#374151]'}`}>{value}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

type ReportType = 'OVERVIEW' | 'PURCHASES' | 'SUPPLIERS' | 'ORDERS';

const PRESET_LABELS: Record<DatePreset, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  '7d': 'Last 7 Days',
  '30d': 'Last 30 Days',
  month: 'This Month',
  custom: 'Custom Range',
};

type SupplierSummary = SupplierRecord & {
  purchasesInRange: number;
  totalInRange: number;
  lastPurchasedAt: string | null;
};

export default function Reports() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // ── Data state ──
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([]);
  const [orders, setOrders] = useState<DistributorOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  // ── Filter state ──
  const [reportType, setReportType] = useState<ReportType>('OVERVIEW');
  const [datePreset, setDatePreset] = useState<DatePreset>('7d');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('ALL');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('ALL');
  const [supplierFilter, setSupplierFilter] = useState<string>('ALL');
  const [showDatePicker, setShowDatePicker] = useState(false);

  const datePickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(e.target as Node)) {
        setShowDatePicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Load data ──
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [purchasesData, suppliersData] = await Promise.all([
        fetchWithAuth('/purchases').catch(() => []),
        fetchWithAuth('/suppliers').catch(() => []),
      ]);
      const ordersRes = await fetchWithAuth('/orders/distributor/all?limit=500&page=1').catch(() => null);

      if (Array.isArray(purchasesData)) setPurchases(purchasesData);
      if (Array.isArray(suppliersData)) setSuppliers(suppliersData);
      if (ordersRes?.data) setOrders(ordersRes.data);
      else if (Array.isArray(ordersRes)) setOrders(ordersRes);

      setLastRefreshed(new Date());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Date range ──
  const dateRange = useMemo(() => {
    if (datePreset === 'custom' && customStart && customEnd) {
      return getDateRange('custom', new Date(customStart), new Date(customEnd));
    }
    return getDateRange(datePreset);
  }, [datePreset, customStart, customEnd]);

  const rangeLabel = useMemo(() => {
    if (datePreset === 'custom' && customStart && customEnd) {
      return `${formatDate(customStart)} – ${formatDate(customEnd)}`;
    }
    return `${PRESET_LABELS[datePreset]} (${formatDate(isoDateStr(dateRange.start))} – ${formatDate(isoDateStr(dateRange.end))})`;
  }, [datePreset, customStart, customEnd, dateRange]);

  // ── Filtered data ──
  const filteredPurchases = useMemo(() => {
    return purchases
      .filter(p => isInRange(p.purchaseDate || p.createdAt, dateRange))
      .filter(p => paymentStatusFilter === 'ALL' || p.paymentStatus === paymentStatusFilter)
      .filter(p => supplierFilter === 'ALL' || p.supplierId === supplierFilter || p.supplierName === supplierFilter)
      .sort((a, b) => {
        const da = new Date(a.purchaseDate || a.createdAt).getTime();
        const db = new Date(b.purchaseDate || b.createdAt).getTime();
        if (db !== da) return db - da;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [purchases, dateRange, paymentStatusFilter, supplierFilter]);

  const filteredOrders = useMemo(() => {
    return orders
      .filter(o => isInRange(o.createdAt, dateRange))
      .filter(o => orderStatusFilter === 'ALL' || o.status === orderStatusFilter)
      .filter(o => paymentStatusFilter === 'ALL' || o.paymentStatus === paymentStatusFilter)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, dateRange, orderStatusFilter, paymentStatusFilter]);

  const supplierSummaries = useMemo<SupplierSummary[]>(() => {
    const bySupplier: Record<string, PurchaseRecord[]> = {};
    filteredPurchases.forEach(p => {
      const key = p.supplierId ?? p.supplierName;
      if (!bySupplier[key]) bySupplier[key] = [];
      bySupplier[key].push(p);
    });

    return suppliers
      .filter(s => supplierFilter === 'ALL' || s.id === supplierFilter)
      .map(s => {
        const ps = bySupplier[s.id] ?? [];
        const purchasesInRange = ps.length;
        const totalInRange = ps.reduce((acc, p) => acc + p.total, 0);
        let lastPurchasedAt: string | null = null;
        if (ps.length > 0) {
          const latest = ps.reduce((latest, p) => {
            const d = new Date(p.purchaseDate || p.createdAt);
            return d > latest ? d : latest;
          }, new Date(0));
          if (latest.getTime() > 0) lastPurchasedAt = latest.toISOString();
        }
        return { ...s, purchasesInRange, totalInRange, lastPurchasedAt };
      })
      .sort((a, b) => b.balance - a.balance);
  }, [suppliers, filteredPurchases, supplierFilter]);

  // ── KPIs ──
  const kpis = useMemo(() => {
    const totalOrders = filteredOrders.length;
    const completedOrders = filteredOrders.filter(o => ['DELIVERED', 'COMPLETED'].includes(o.status?.toUpperCase())).length;
    const pendingOrders = filteredOrders.filter(o => ['PENDING', 'CONFIRMED', 'OUT_FOR_DELIVERY'].includes(o.status?.toUpperCase())).length;
    const cancelledOrders = filteredOrders.filter(o => ['CANCELLED', 'FAILED', 'REJECTED'].includes(o.status?.toUpperCase())).length;
    const totalOrderAmount = filteredOrders.reduce((s, o) => s + (o.totalAmount ?? 0), 0);

    const totalPurchaseAmount = filteredPurchases.reduce((s, p) => s + p.total, 0);
    const totalPaid = filteredPurchases.reduce((s, p) => s + (p.amountPaid ?? 0), 0);
    const totalPending = totalPurchaseAmount - totalPaid;

    const activeSuppliers = suppliers.filter(s => s.isActive).length;
    const suppliersWithPurchases = new Set(filteredPurchases.map(p => p.supplierId ?? p.supplierName)).size;
    const totalOutstanding = suppliers.reduce((s, sup) => s + Math.max(0, sup.balance), 0);

    return {
      totalOrders, completedOrders, pendingOrders, cancelledOrders,
      totalOrderAmount, totalPurchaseAmount, totalPaid, totalPending,
      activeSuppliers, suppliersWithPurchases, totalOutstanding,
    };
  }, [filteredOrders, filteredPurchases, suppliers]);

  // ── Chart data ──
  const dailyChartData = useMemo(() => {
    const days = (datePreset === '30d' || datePreset === 'month') ? 30 : 7;
    const purchasesByDay: { label: string; value: number }[] = [];
    const ordersByDay: { label: string; value: number }[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      const dayLabel = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

      purchasesByDay.push({
        label: dayLabel,
        value: filteredPurchases.filter(p => (p.purchaseDate || p.createdAt)?.split('T')[0] === key).length,
      });
      ordersByDay.push({
        label: dayLabel,
        value: filteredOrders.filter(o => o.createdAt?.split('T')[0] === key).length,
      });
    }
    return { purchasesByDay, ordersByDay };
  }, [filteredPurchases, filteredOrders, datePreset]);

  const clearFilters = () => {
    setDatePreset('7d');
    setCustomStart('');
    setCustomEnd('');
    setPaymentStatusFilter('ALL');
    setOrderStatusFilter('ALL');
    setSupplierFilter('ALL');
    setReportType('OVERVIEW');
  };

  const hasActiveFilters = datePreset !== '7d' || paymentStatusFilter !== 'ALL' ||
    orderStatusFilter !== 'ALL' || supplierFilter !== 'ALL';

  const handleDownloadPDF = () => {
    if (!user) return;
    const kpiMap: Record<string, string> = {
      'Total Orders': String(kpis.totalOrders),
      'Completed Orders': String(kpis.completedOrders),
      'Pending Orders': String(kpis.pendingOrders),
      'Total Purchase Amount': formatINR(kpis.totalPurchaseAmount),
      'Total Paid (Purchases)': formatINR(kpis.totalPaid),
      'Outstanding (Purchases)': formatINR(kpis.totalPending),
      'Active Suppliers': String(kpis.activeSuppliers),
      'Total Supplier Outstanding': formatINR(kpis.totalOutstanding),
    };
    generatePDF({
      user: { firstName: user.firstName, lastName: user.lastName, email: user.email, phone: user.phone },
      reportType,
      rangeLabel,
      purchases: filteredPurchases,
      suppliers: supplierSummaries,
      orders: filteredOrders,
      kpis: kpiMap,
    });
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="w-full min-h-full bg-[#F8FAFC]">

      {/* ── PAGE HEADER ── */}
      <div className="sticky top-0 z-20 bg-white border-b border-[#E2E8F0] px-4 sm:px-6 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1677C8]/10 text-[#1677C8] shrink-0">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[#16324F] leading-tight">Reports</h1>
              <p className="text-[11px] text-[#64748B]">
                {rangeLabel}
                {lastRefreshed && ` · Updated ${lastRefreshed.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#64748B] border border-[#E2E8F0] bg-white rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#1677C8] rounded-lg hover:bg-[#1361a8] transition-colors disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Download PDF</span>
              <span className="sm:hidden">PDF</span>
            </button>
          </div>
        </div>

        {/* ── FILTER BAR ── */}
        <div className="mt-3 flex flex-wrap gap-2 items-center overflow-x-auto pb-1">
          {/* Report type tabs */}
          <div className="flex bg-slate-100 rounded-lg p-0.5 shrink-0">
            {(['OVERVIEW', 'PURCHASES', 'SUPPLIERS', 'ORDERS'] as ReportType[]).map(rt => (
              <button
                key={rt}
                onClick={() => setReportType(rt)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  reportType === rt
                    ? 'bg-white text-[#1677C8] shadow-sm font-semibold'
                    : 'text-[#64748B] hover:text-[#16324F]'
                }`}
              >
                {rt.charAt(0) + rt.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {/* Date range picker */}
          <div className="relative shrink-0" ref={datePickerRef}>
            <button
              onClick={() => setShowDatePicker(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#374151] border border-[#E2E8F0] bg-white rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              <Calendar className="w-3.5 h-3.5 text-[#1677C8]" />
              {PRESET_LABELS[datePreset]}
              <ChevronDown className="w-3 h-3 text-[#94A3B8]" />
            </button>
            {showDatePicker && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-[#E2E8F0] rounded-xl shadow-lg p-2 min-w-[176px]">
                {(Object.entries(PRESET_LABELS) as [DatePreset, string][]).map(([p, label]) => (
                  <button
                    key={p}
                    onClick={() => { setDatePreset(p); if (p !== 'custom') setShowDatePicker(false); }}
                    className={`w-full text-left px-3 py-2 text-xs rounded-lg transition-colors ${
                      datePreset === p ? 'bg-[#1677C8]/10 text-[#1677C8] font-semibold' : 'text-[#374151] hover:bg-slate-50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
                {datePreset === 'custom' && (
                  <div className="mt-2 pt-2 border-t border-[#E2E8F0] flex flex-col gap-1.5 px-1">
                    <div>
                      <label className="text-[10px] text-[#64748B] font-medium">From</label>
                      <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                        className="w-full mt-0.5 text-xs border border-[#E2E8F0] rounded-md px-2 py-1 text-[#374151] focus:outline-none focus:ring-1 focus:ring-[#1677C8]" />
                    </div>
                    <div>
                      <label className="text-[10px] text-[#64748B] font-medium">To</label>
                      <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                        className="w-full mt-0.5 text-xs border border-[#E2E8F0] rounded-md px-2 py-1 text-[#374151] focus:outline-none focus:ring-1 focus:ring-[#1677C8]" />
                    </div>
                    {customStart && customEnd && (
                      <button onClick={() => setShowDatePicker(false)}
                        className="mt-1 w-full py-1.5 bg-[#1677C8] text-white text-xs font-semibold rounded-md hover:bg-[#1361a8] transition-colors">
                        Apply
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Payment status */}
          {(reportType === 'PURCHASES' || reportType === 'ORDERS' || reportType === 'OVERVIEW') && (
            <select value={paymentStatusFilter} onChange={e => setPaymentStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-xs text-[#374151] border border-[#E2E8F0] bg-white rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1677C8] cursor-pointer shrink-0">
              <option value="ALL">All Payment Status</option>
              <option value="PAID">Paid</option>
              <option value="PARTIAL">Partial</option>
              <option value="PENDING">Pending</option>
            </select>
          )}

          {/* Order status */}
          {(reportType === 'ORDERS' || reportType === 'OVERVIEW') && (
            <select value={orderStatusFilter} onChange={e => setOrderStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-xs text-[#374151] border border-[#E2E8F0] bg-white rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1677C8] cursor-pointer shrink-0">
              <option value="ALL">All Order Status</option>
              <option value="PENDING">Pending</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="OUT_FOR_DELIVERY">Out for Delivery</option>
              <option value="DELIVERED">Delivered</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          )}

          {/* Supplier filter */}
          {(reportType === 'PURCHASES' || reportType === 'SUPPLIERS' || reportType === 'OVERVIEW') && suppliers.length > 0 && (
            <select value={supplierFilter} onChange={e => setSupplierFilter(e.target.value)}
              className="px-3 py-1.5 text-xs text-[#374151] border border-[#E2E8F0] bg-white rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1677C8] cursor-pointer shrink-0 max-w-[160px]">
              <option value="ALL">All Suppliers</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}

          {/* Clear filters */}
          {hasActiveFilters && (
            <button onClick={clearFilters}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-rose-600 border border-rose-200 bg-rose-50 rounded-lg hover:bg-rose-100 transition-colors shrink-0">
              <X className="w-3 h-3" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div className="px-4 sm:px-6 py-5 space-y-6">

        {isLoading && (
          <div className="flex items-center justify-center py-16 text-[#94A3B8]">
            <RefreshCw className="w-6 h-6 animate-spin mr-2" />
            <span className="text-sm">Loading report data…</span>
          </div>
        )}

        {!isLoading && (
          <>
            {/* ═══════════════════════════════ OVERVIEW ════════════════════════════ */}
            {reportType === 'OVERVIEW' && (
              <div className="space-y-6">
                {/* KPI Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
                  <KpiCard label="Total Orders" value={String(kpis.totalOrders)} icon={ShoppingCart} color="bg-blue-50 text-blue-600" />
                  <KpiCard label="Completed" value={String(kpis.completedOrders)} icon={CheckCircle2} color="bg-emerald-50 text-emerald-600" />
                  <KpiCard label="Pending" value={String(kpis.pendingOrders)} icon={Clock} color="bg-amber-50 text-amber-600" />
                  <KpiCard label="Purchases" value={formatINR(kpis.totalPurchaseAmount)} sub={`${filteredPurchases.length} transactions`} icon={Package} color="bg-violet-50 text-violet-600" />
                  <KpiCard label="Total Paid" value={formatINR(kpis.totalPaid)} icon={TrendingDown} color="bg-emerald-50 text-emerald-600" />
                  <KpiCard label="Outstanding" value={formatINR(kpis.totalPending)} icon={AlertCircle} color="bg-rose-50 text-rose-600" />
                  <KpiCard label="Active Suppliers" value={String(kpis.activeSuppliers)} sub={`${kpis.suppliersWithPurchases} with purchases`} icon={Users} color="bg-sky-50 text-sky-600" />
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
                    <MiniBarChart data={dailyChartData.ordersByDay} label="Orders by Day" />
                  </div>
                  <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
                    <MiniBarChart data={dailyChartData.purchasesByDay} label="Purchases by Day" />
                  </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <ShoppingCart className="w-4 h-4 text-[#1677C8]" />
                      <h3 className="text-sm font-semibold text-[#16324F]">Orders Summary</h3>
                    </div>
                    <SummaryRow label="Total Orders" value={String(kpis.totalOrders)} />
                    <SummaryRow label="Completed" value={String(kpis.completedOrders)} color="text-emerald-600" />
                    <SummaryRow label="Pending" value={String(kpis.pendingOrders)} color="text-amber-600" />
                    {kpis.cancelledOrders > 0 && <SummaryRow label="Cancelled" value={String(kpis.cancelledOrders)} color="text-rose-500" />}
                    <SummaryRow label="Order Value" value={formatINR(kpis.totalOrderAmount)} bold />
                  </div>

                  <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Package className="w-4 h-4 text-violet-600" />
                      <h3 className="text-sm font-semibold text-[#16324F]">Purchases Summary</h3>
                    </div>
                    <SummaryRow label="No. of Purchases" value={String(filteredPurchases.length)} />
                    <SummaryRow label="Purchase Value" value={formatINR(kpis.totalPurchaseAmount)} bold />
                    <SummaryRow label="Amount Paid" value={formatINR(kpis.totalPaid)} color="text-emerald-600" />
                    <SummaryRow label="Pending Amount" value={formatINR(kpis.totalPending)} color="text-rose-600" />
                  </div>

                  <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Users className="w-4 h-4 text-sky-600" />
                      <h3 className="text-sm font-semibold text-[#16324F]">Supplier Summary</h3>
                    </div>
                    <SummaryRow label="Active Suppliers" value={String(kpis.activeSuppliers)} />
                    <SummaryRow label="With Purchases" value={String(kpis.suppliersWithPurchases)} />
                    <SummaryRow label="Total Outstanding" value={formatINR(kpis.totalOutstanding)} color="text-rose-600" bold />
                  </div>
                </div>
              </div>
            )}

            {/* ═══════════════════════════════ PURCHASES ═══════════════════════════ */}
            {reportType === 'PURCHASES' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <KpiCard label="Purchases" value={String(filteredPurchases.length)} icon={Package} color="bg-violet-50 text-violet-600" />
                  <KpiCard label="Total Value" value={formatINR(kpis.totalPurchaseAmount)} icon={TrendingUp} color="bg-blue-50 text-blue-600" />
                  <KpiCard label="Total Paid" value={formatINR(kpis.totalPaid)} icon={CheckCircle2} color="bg-emerald-50 text-emerald-600" />
                  <KpiCard label="Pending" value={formatINR(kpis.totalPending)} icon={AlertCircle} color="bg-rose-50 text-rose-600" />
                </div>

                <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                          <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase tracking-wide whitespace-nowrap">Purchase #</th>
                          <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase tracking-wide whitespace-nowrap">Date &amp; Time</th>
                          <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase tracking-wide">Supplier</th>
                          <th className="text-right px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase tracking-wide whitespace-nowrap hidden sm:table-cell">Items</th>
                          <th className="text-right px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase tracking-wide whitespace-nowrap hidden md:table-cell">Subtotal</th>
                          <th className="text-right px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase tracking-wide whitespace-nowrap hidden md:table-cell">Tax</th>
                          <th className="text-right px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase tracking-wide whitespace-nowrap">Total</th>
                          <th className="text-right px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase tracking-wide whitespace-nowrap hidden lg:table-cell">Paid</th>
                          <th className="text-right px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase tracking-wide whitespace-nowrap hidden lg:table-cell">Pending</th>
                          <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase tracking-wide whitespace-nowrap">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPurchases.length === 0 ? (
                          <tr>
                            <td colSpan={10} className="px-4 py-12 text-center text-sm text-[#94A3B8]">
                              <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                              <p>No purchases in selected period</p>
                            </td>
                          </tr>
                        ) : (
                          filteredPurchases.map((p, i) => {
                            const pending = Math.max(0, p.total - (p.amountPaid ?? 0));
                            return (
                              <tr key={p.id} className={`border-b border-[#F1F5F9] ${i % 2 === 0 ? 'bg-white' : 'bg-[#FAFBFC]'} hover:bg-blue-50/30 transition-colors`}>
                                <td className="px-4 py-3 font-mono font-semibold text-xs text-[#1677C8]">{p.purchaseNumber}</td>
                                <td className="px-4 py-3 text-xs text-[#374151] whitespace-nowrap">{formatDateTime(p.purchaseDate || p.createdAt)}</td>
                                <td className="px-4 py-3 text-xs text-[#374151] max-w-[140px] truncate">{p.supplierName}</td>
                                <td className="px-4 py-3 text-xs text-[#374151] text-right hidden sm:table-cell">{p.items?.length ?? 0}</td>
                                <td className="px-4 py-3 text-xs text-[#374151] text-right hidden md:table-cell">{formatINR(p.subtotal)}</td>
                                <td className="px-4 py-3 text-xs text-[#374151] text-right hidden md:table-cell">{formatINR(p.tax)}</td>
                                <td className="px-4 py-3 text-xs font-semibold text-[#16324F] text-right">{formatINR(p.total)}</td>
                                <td className="px-4 py-3 text-xs text-emerald-600 text-right hidden lg:table-cell">{formatINR(p.amountPaid)}</td>
                                <td className="px-4 py-3 text-xs text-right hidden lg:table-cell">
                                  <span className={pending > 0 ? 'text-rose-600' : 'text-[#94A3B8]'}>{formatINR(pending)}</span>
                                </td>
                                <td className="px-4 py-3">
                                  <StatusBadge status={p.paymentStatus} type="payment" />
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                      {filteredPurchases.length > 0 && (
                        <tfoot>
                          <tr className="border-t-2 border-[#E2E8F0] bg-[#F8FAFC]">
                            <td colSpan={6} className="px-4 py-3 text-xs font-semibold text-[#64748B]">Totals ({filteredPurchases.length})</td>
                            <td className="px-4 py-3 text-xs font-bold text-[#16324F] text-right">{formatINR(kpis.totalPurchaseAmount)}</td>
                            <td className="px-4 py-3 text-xs font-semibold text-emerald-600 text-right hidden lg:table-cell">{formatINR(kpis.totalPaid)}</td>
                            <td className="px-4 py-3 text-xs font-semibold text-rose-600 text-right hidden lg:table-cell">{formatINR(kpis.totalPending)}</td>
                            <td className="px-4 py-3" />
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ═══════════════════════════════ SUPPLIERS ═══════════════════════════ */}
            {reportType === 'SUPPLIERS' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <KpiCard label="Total Suppliers" value={String(suppliers.length)} icon={Users} color="bg-sky-50 text-sky-600" />
                  <KpiCard label="Active Suppliers" value={String(kpis.activeSuppliers)} icon={CheckCircle2} color="bg-emerald-50 text-emerald-600" />
                  <KpiCard label="Total Outstanding" value={formatINR(kpis.totalOutstanding)} icon={AlertCircle} color="bg-rose-50 text-rose-600" />
                </div>

                <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                          <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase tracking-wide">Supplier</th>
                          <th className="text-right px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase tracking-wide whitespace-nowrap">Purchases (Period)</th>
                          <th className="text-right px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase tracking-wide whitespace-nowrap hidden sm:table-cell">Total Purchased</th>
                          <th className="text-right px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase tracking-wide whitespace-nowrap hidden md:table-cell">Total Paid</th>
                          <th className="text-right px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase tracking-wide whitespace-nowrap">Outstanding</th>
                          <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase tracking-wide whitespace-nowrap hidden lg:table-cell">Last Purchase</th>
                          <th className="w-8 px-4 py-3" />
                        </tr>
                      </thead>
                      <tbody>
                        {supplierSummaries.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-4 py-12 text-center text-sm text-[#94A3B8]">
                              <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                              <p>No suppliers found</p>
                            </td>
                          </tr>
                        ) : (
                          supplierSummaries.map((s, i) => (
                            <tr
                              key={s.id}
                              onClick={() => navigate(`/distributor/suppliers/${s.id}`)}
                              className={`border-b border-[#F1F5F9] ${i % 2 === 0 ? 'bg-white' : 'bg-[#FAFBFC]'} hover:bg-blue-50/30 transition-colors cursor-pointer`}
                            >
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="h-7 w-7 rounded-full bg-[#1677C8]/10 flex items-center justify-center shrink-0">
                                    <span className="text-[10px] font-bold text-[#1677C8]">{s.name.charAt(0).toUpperCase()}</span>
                                  </div>
                                  <div>
                                    <p className="text-xs font-medium text-[#16324F]">{s.name}</p>
                                    {s.companyName && <p className="text-[10px] text-[#94A3B8]">{s.companyName}</p>}
                                  </div>
                                  {!s.isActive && <span className="ml-1 text-[9px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded-full">Inactive</span>}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-xs text-[#374151] text-right">{s.purchasesInRange}</td>
                              <td className="px-4 py-3 text-xs text-[#374151] text-right hidden sm:table-cell">{formatINR(s.totalPurchased)}</td>
                              <td className="px-4 py-3 text-xs text-emerald-600 text-right hidden md:table-cell">{formatINR(s.totalPaid)}</td>
                              <td className="px-4 py-3 text-right">
                                <span className={`text-xs font-semibold ${s.balance > 0 ? 'text-rose-600' : s.balance < 0 ? 'text-emerald-600' : 'text-[#94A3B8]'}`}>
                                  {s.balance === 0 ? '—' : formatINR(Math.abs(s.balance))}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-xs text-[#64748B] hidden lg:table-cell">
                                {s.lastPurchasedAt ? formatDate(s.lastPurchasedAt) : '—'}
                              </td>
                              <td className="px-4 py-3">
                                <ArrowUpRight className="w-3.5 h-3.5 text-[#94A3B8]" />
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ═══════════════════════════════ ORDERS ══════════════════════════════ */}
            {reportType === 'ORDERS' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <KpiCard label="Total Orders" value={String(kpis.totalOrders)} icon={ShoppingCart} color="bg-blue-50 text-blue-600" />
                  <KpiCard label="Completed" value={String(kpis.completedOrders)} icon={CheckCircle2} color="bg-emerald-50 text-emerald-600" />
                  <KpiCard label="Pending" value={String(kpis.pendingOrders)} icon={Clock} color="bg-amber-50 text-amber-600" />
                  <KpiCard label="Order Value" value={formatINR(kpis.totalOrderAmount)} icon={TrendingUp} color="bg-violet-50 text-violet-600" />
                </div>

                <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                          <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase tracking-wide whitespace-nowrap">Order #</th>
                          <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase tracking-wide whitespace-nowrap hidden sm:table-cell">Date &amp; Time</th>
                          <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase tracking-wide">Customer</th>
                          <th className="text-right px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase tracking-wide whitespace-nowrap hidden md:table-cell">Jars</th>
                          <th className="text-right px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase tracking-wide whitespace-nowrap">Amount</th>
                          <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase tracking-wide whitespace-nowrap hidden lg:table-cell">Payment</th>
                          <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase tracking-wide whitespace-nowrap">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredOrders.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-4 py-12 text-center text-sm text-[#94A3B8]">
                              <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-30" />
                              <p>No orders in selected period</p>
                            </td>
                          </tr>
                        ) : (
                          filteredOrders.map((o, i) => {
                            const custName = o.customer?.user?.firstName
                              ? `${o.customer.user.firstName} ${o.customer.user.lastName ?? ''}`.trim()
                              : o.customer?.companyName ?? '—';
                            const jars = o.items?.reduce((s, it) => s + (it.product?.isJar ? it.quantity : 0), 0) ?? 0;
                            const totalQty = o.items?.reduce((s, it) => s + it.quantity, 0) ?? 0;

                            return (
                              <tr key={o.id} className={`border-b border-[#F1F5F9] ${i % 2 === 0 ? 'bg-white' : 'bg-[#FAFBFC]'} hover:bg-blue-50/30 transition-colors`}>
                                <td className="px-4 py-3 font-mono font-semibold text-xs text-[#1677C8]">#{formatOrderId(o.id)}</td>
                                <td className="px-4 py-3 text-xs text-[#374151] whitespace-nowrap hidden sm:table-cell">{formatDateTime(o.createdAt)}</td>
                                <td className="px-4 py-3 text-xs text-[#374151] max-w-[140px] truncate">{custName}</td>
                                <td className="px-4 py-3 text-xs text-[#374151] text-right hidden md:table-cell">{jars > 0 ? jars : totalQty}</td>
                                <td className="px-4 py-3 text-xs font-semibold text-[#16324F] text-right">{formatINR(o.totalAmount)}</td>
                                <td className="px-4 py-3 hidden lg:table-cell">
                                  <StatusBadge status={o.paymentStatus} type="payment" />
                                </td>
                                <td className="px-4 py-3">
                                  <StatusBadge status={o.status} type="order" />
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                      {filteredOrders.length > 0 && (
                        <tfoot>
                          <tr className="border-t-2 border-[#E2E8F0] bg-[#F8FAFC]">
                            <td colSpan={4} className="px-4 py-3 text-xs font-semibold text-[#64748B]">Totals ({filteredOrders.length} orders)</td>
                            <td className="px-4 py-3 text-xs font-bold text-[#16324F] text-right">{formatINR(kpis.totalOrderAmount)}</td>
                            <td colSpan={2} className="px-4 py-3" />
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
