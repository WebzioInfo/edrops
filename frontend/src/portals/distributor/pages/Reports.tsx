import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Download,
  RefreshCw,
  X,
  Package,
  ShoppingCart,
  Users,
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  DollarSign,
  ArrowDownRight,
  ChevronRight,
  Search,
  CreditCard,
  Building2,
  Award,
} from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';
import { useAuth } from '../../../contexts/AuthContext';
import { formatOrderId, formatOrderStatus } from '../../../utils/orderFormatters';
import { getOrderStatusConfig } from '../../../utils/orderStateMachine';
import { DistributorTopbar } from '../components/DistributorTopbar';
import { EdropsPageLoader } from '../../../components/common/EdropsPageLoader';
import {
  ReportDateFilter,
  calculateDateRange,
  isDateWithinRange,
  type DatePreset,
} from '../components/reports/ReportDateFilter';
import { ReportKpiCard } from '../components/reports/ReportKpiCard';
import {
  BarTimeSeriesChart,
  StatusDistributionChart,
  type TimeSeriesDataPoint,
} from '../components/reports/ReportChart';
import { InsightCard, type InsightItem } from '../components/reports/InsightCard';
import { ReportSection } from '../components/reports/ReportSection';
import { generateDistributorReportPDF } from '../utils/distributorReportPdfGenerator';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface PurchaseItem {
  itemName?: string;
  productName?: string;
  quantity: number;
  rate?: number;
  unitPrice?: number;
  amount: number;
}

interface PurchaseRecord {
  id: string;
  purchaseNumber: string;
  purchaseDate: string;
  supplierName: string;
  supplierId?: string | null;
  supplier?: { id: string; name: string; companyName?: string | null } | null;
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
    id?: string;
    companyName?: string | null;
    user?: { firstName?: string; lastName?: string; phone?: string; email?: string };
  };
  status: string;
  totalAmount: number;
  amountPaid?: number;
  amountDue?: number;
  paymentStatus: string;
  paymentMethod?: string | null;
  createdAt: string;
  items: Array<{ quantity: number; product?: { name?: string; price?: number; isJar?: boolean } }>;
  payments?: Array<{ id: string; amount: number; status: string }>;
}

export interface CustomerPerformance {
  customerId: string;
  customerName: string;
  companyName?: string | null;
  phone?: string | null;
  email?: string | null;
  orderCount: number;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  averageOrderValue: number;
  lastOrderDate: string;
  deliveredCount: number;
  pendingCount: number;
  cancelledCount: number;
}

type ReportType = 'OVERVIEW' | 'PURCHASES' | 'SUPPLIERS' | 'ORDERS';

// ─────────────────────────────────────────────────────────────────────────────
// Helper Formatters
// ─────────────────────────────────────────────────────────────────────────────

export function formatINR(amount: number | null | undefined): string {
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
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '—';
  }
}

const StatusBadge: React.FC<{ status: string; type?: 'payment' | 'order' }> = ({ status, type }) => {
  const s = status?.toUpperCase() ?? '';
  let cls = 'bg-slate-100 text-slate-600 border border-slate-200';
  if (type === 'payment') {
    if (s === 'PAID' || s === 'SUCCESS') cls = 'bg-emerald-50 text-emerald-700 border border-emerald-200';
    else if (s === 'PARTIAL' || s === 'PARTIALLY_PAID') cls = 'bg-amber-50 text-amber-700 border border-amber-200';
    else if (s === 'PENDING' || s === 'UNPAID') cls = 'bg-rose-50 text-rose-600 border border-rose-200';
  } else {
    const cfg = getOrderStatusConfig(s);
    cls = cfg?.badgeClass ?? 'bg-slate-100 text-slate-600 border border-slate-200';
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider ${cls}`}>
      {type === 'payment' ? s : formatOrderStatus(s)}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Real Client-Side PDF Generation is handled via distributorReportPdfGenerator
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Main Reports Page Component
// ─────────────────────────────────────────────────────────────────────────────

export default function Reports() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // ── Raw Data State ──
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([]);
  const [orders, setOrders] = useState<DistributorOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  // ── Active Filters ──
  const [reportType, setReportType] = useState<ReportType>('OVERVIEW');
  const [datePreset, setDatePreset] = useState<DatePreset>('7d');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');

  // Tab-specific filters & view modes
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('ALL');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('ALL');
  const [supplierFilter, setSupplierFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [ordersViewMode, setOrdersViewMode] = useState<'customers' | 'records'>('customers');
  const [supplierSortBy, setSupplierSortBy] = useState<'purchases' | 'value' | 'outstanding' | 'paid'>('value');
  const [tablePage, setTablePage] = useState<number>(1);
  const pageSize = 20;

  // ── Fetch All Records ──
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [purchasesData, suppliersData, ordersRes] = await Promise.all([
        fetchWithAuth('/purchases').catch(() => []),
        fetchWithAuth('/suppliers').catch(() => []),
        fetchWithAuth('/orders/distributor/all?limit=3000&page=1').catch(() => null),
      ]);

      if (Array.isArray(purchasesData)) setPurchases(purchasesData);
      if (Array.isArray(suppliersData)) setSuppliers(suppliersData);
      if (ordersRes?.data && Array.isArray(ordersRes.data)) {
        setOrders(ordersRes.data);
      } else if (Array.isArray(ordersRes)) {
        setOrders(ordersRes);
      }

      setLastRefreshed(new Date());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Reset page when tab or filters change
  useEffect(() => {
    setTablePage(1);
  }, [reportType, datePreset, customStart, customEnd, paymentStatusFilter, orderStatusFilter, supplierFilter, searchQuery]);

  // ── Date Range Calculation (Timezone Consistent) ──
  const dateRange = useMemo(() => {
    return calculateDateRange(datePreset, customStart, customEnd);
  }, [datePreset, customStart, customEnd]);

  // ── Date-Filtered Transactions ──
  const filteredPurchases = useMemo(() => {
    return purchases
      .filter((p) => isDateWithinRange(p.purchaseDate || p.createdAt, dateRange))
      .filter((p) => paymentStatusFilter === 'ALL' || p.paymentStatus?.toUpperCase() === paymentStatusFilter)
      .filter((p) => supplierFilter === 'ALL' || p.supplierId === supplierFilter || p.supplierName === supplierFilter)
      .filter((p) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          p.purchaseNumber?.toLowerCase().includes(q) ||
          p.supplierName?.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const da = new Date(a.purchaseDate || a.createdAt).getTime();
        const db = new Date(b.purchaseDate || b.createdAt).getTime();
        return db - da;
      });
  }, [purchases, dateRange, paymentStatusFilter, supplierFilter, searchQuery]);

  const filteredOrders = useMemo(() => {
    return orders
      .filter((o) => isDateWithinRange(o.createdAt, dateRange))
      .filter((o) => {
        if (orderStatusFilter === 'ALL') return true;
        if (orderStatusFilter === 'DELIVERED') return ['DELIVERED', 'COMPLETED'].includes(o.status?.toUpperCase());
        if (orderStatusFilter === 'CANCELLED') return ['CANCELLED', 'FAILED', 'REJECTED'].includes(o.status?.toUpperCase());
        if (orderStatusFilter === 'PENDING') return ['NEW', 'PENDING', 'PENDING_PAYMENT', 'PENDING_ASSIGNMENT'].includes(o.status?.toUpperCase());
        return o.status?.toUpperCase() === orderStatusFilter;
      })
      .filter((o) => {
        if (paymentStatusFilter === 'ALL') return true;
        const s = o.paymentStatus?.toUpperCase();
        if (paymentStatusFilter === 'PAID') return s === 'PAID' || s === 'SUCCESS';
        if (paymentStatusFilter === 'PARTIAL') return s === 'PARTIAL' || s === 'PARTIALLY_PAID';
        if (paymentStatusFilter === 'PENDING') return s === 'PENDING' || s === 'UNPAID';
        return s === paymentStatusFilter;
      })
      .filter((o) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        const name = `${o.customer?.user?.firstName || ''} ${o.customer?.user?.lastName || ''}`.toLowerCase();
        const company = (o.customer?.companyName || '').toLowerCase();
        const phone = (o.customer?.user?.phone || '').toLowerCase();
        const id = o.id.toLowerCase();
        return name.includes(q) || company.includes(q) || phone.includes(q) || id.includes(q);
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, dateRange, orderStatusFilter, paymentStatusFilter, searchQuery]);

  // ── Customer Aggregated Reporting (Orders Tab & Insights) ──
  const customerReports = useMemo<CustomerPerformance[]>(() => {
    const map = new Map<string, CustomerPerformance>();

    // Process all orders that fall into the selected date range
    // NOTE: Customers are evaluated by their orders in THIS selected date period
    const periodOrders = orders.filter((o) => isDateWithinRange(o.createdAt, dateRange));

    periodOrders.forEach((o) => {
      const custId = o.customerId || o.customer?.id || o.customer?.user?.phone || o.id;
      const firstName = o.customer?.user?.firstName || '';
      const lastName = o.customer?.user?.lastName || '';
      const custName = firstName ? `${firstName} ${lastName}`.trim() : (o.customer?.companyName || 'Unknown Customer');

      const paid = Number(
        o.amountPaid ??
        (o.payments?.filter((p) => ['PAID', 'SUCCESS'].includes(p.status?.toUpperCase())).reduce((s, p) => s + p.amount, 0) ??
        (['PAID', 'SUCCESS'].includes(o.paymentStatus?.toUpperCase()) ? o.totalAmount : 0))
      );
      const total = Number(o.totalAmount || 0);
      const due = Math.max(0, total - paid);

      const isDelivered = ['DELIVERED', 'COMPLETED'].includes(o.status?.toUpperCase());
      const isCancelled = ['CANCELLED', 'FAILED', 'REJECTED'].includes(o.status?.toUpperCase());
      const isPending = !isDelivered && !isCancelled;

      if (!map.has(custId)) {
        map.set(custId, {
          customerId: custId,
          customerName: custName,
          companyName: o.customer?.companyName || null,
          phone: o.customer?.user?.phone || null,
          email: o.customer?.user?.email || null,
          orderCount: 1,
          totalAmount: total,
          paidAmount: paid,
          dueAmount: due,
          averageOrderValue: total,
          lastOrderDate: o.createdAt,
          deliveredCount: isDelivered ? 1 : 0,
          pendingCount: isPending ? 1 : 0,
          cancelledCount: isCancelled ? 1 : 0,
        });
      } else {
        const existing = map.get(custId)!;
        existing.orderCount += 1;
        existing.totalAmount += total;
        existing.paidAmount += paid;
        existing.dueAmount += due;
        existing.averageOrderValue = Math.round((existing.totalAmount / existing.orderCount) * 100) / 100;
        if (isDelivered) existing.deliveredCount += 1;
        if (isPending) existing.pendingCount += 1;
        if (isCancelled) existing.cancelledCount += 1;
        if (new Date(o.createdAt).getTime() > new Date(existing.lastOrderDate).getTime()) {
          existing.lastOrderDate = o.createdAt;
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [orders, dateRange]);

  // ── Supplier Aggregated Reporting (Suppliers Tab) ──
  const supplierSummaries = useMemo(() => {
    const purchasesBySupplier: Record<string, PurchaseRecord[]> = {};

    filteredPurchases.forEach((p) => {
      const key = p.supplierId || p.supplierName;
      if (!purchasesBySupplier[key]) purchasesBySupplier[key] = [];
      purchasesBySupplier[key].push(p);
    });

    return suppliers
      .filter((s) => supplierFilter === 'ALL' || s.id === supplierFilter)
      .map((s) => {
        const ps = purchasesBySupplier[s.id] || purchasesBySupplier[s.name] || [];
        const purchasesInRange = ps.length;
        const totalInRange = ps.reduce((acc, p) => acc + (Number(p.total) || 0), 0);
        const paidInRange = ps.reduce((acc, p) => acc + (Number(p.amountPaid) || 0), 0);
        const pendingInRange = Math.max(0, totalInRange - paidInRange);
        const averagePurchaseValue = purchasesInRange > 0 ? Math.round(totalInRange / purchasesInRange) : 0;

        let lastPurchasedAt: string | null = null;
        if (ps.length > 0) {
          const latest = ps.reduce((latestD, p) => {
            const d = new Date(p.purchaseDate || p.createdAt);
            return d > latestD ? d : latestD;
          }, new Date(0));
          if (latest.getTime() > 0) lastPurchasedAt = latest.toISOString();
        }

        return {
          ...s,
          purchasesInRange,
          totalInRange,
          paidInRange,
          pendingInRange,
          averagePurchaseValue,
          lastPurchasedAt,
        };
      })
      .sort((a, b) => {
        if (supplierSortBy === 'purchases') return b.purchasesInRange - a.purchasesInRange;
        if (supplierSortBy === 'outstanding') return b.balance - a.balance;
        if (supplierSortBy === 'paid') return b.paidInRange - a.paidInRange;
        return b.totalInRange - a.totalInRange;
      });
  }, [suppliers, filteredPurchases, supplierFilter, supplierSortBy]);

  // ── Executive KPI Calculations (Order total = Paid + Due guarantee) ──
  const kpis = useMemo(() => {
    // Orders
    const totalOrders = filteredOrders.length;
    const completedOrders = filteredOrders.filter((o) => ['DELIVERED', 'COMPLETED'].includes(o.status?.toUpperCase())).length;
    const pendingOrders = filteredOrders.filter((o) => ['NEW', 'PENDING', 'CONFIRMED', 'PROCESSING', 'READY', 'OUT_FOR_DELIVERY'].includes(o.status?.toUpperCase())).length;
    const cancelledOrders = filteredOrders.filter((o) => ['CANCELLED', 'FAILED', 'REJECTED'].includes(o.status?.toUpperCase())).length;

    const totalOrderAmount = filteredOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
    const paidOrderAmount = filteredOrders.reduce((sum, o) => {
      const paid = Number(
        o.amountPaid ??
        (o.payments?.filter((p) => ['PAID', 'SUCCESS'].includes(p.status?.toUpperCase())).reduce((s, p) => s + p.amount, 0) ??
        (['PAID', 'SUCCESS'].includes(o.paymentStatus?.toUpperCase()) ? o.totalAmount : 0))
      );
      return sum + Math.min(paid, Number(o.totalAmount) || 0);
    }, 0);
    const pendingOrderAmount = Math.max(0, Number((totalOrderAmount - paidOrderAmount).toFixed(2)));

    const paidOrdersCount = filteredOrders.filter((o) => ['PAID', 'SUCCESS'].includes(o.paymentStatus?.toUpperCase())).length;
    const partialOrdersCount = filteredOrders.filter((o) => ['PARTIAL', 'PARTIALLY_PAID'].includes(o.paymentStatus?.toUpperCase())).length;
    const unpaidOrdersCount = filteredOrders.filter((o) => ['UNPAID', 'PENDING'].includes(o.paymentStatus?.toUpperCase())).length;
    const avgOrderValue = totalOrders > 0 ? Math.round(totalOrderAmount / totalOrders) : 0;

    // Purchases
    const totalPurchases = filteredPurchases.length;
    const totalPurchaseAmount = filteredPurchases.reduce((sum, p) => sum + (Number(p.total) || 0), 0);
    const totalPurchasePaid = filteredPurchases.reduce((sum, p) => sum + (Number(p.amountPaid) || 0), 0);
    const totalPurchasePending = Math.max(0, Number((totalPurchaseAmount - totalPurchasePaid).toFixed(2)));

    const fullyPaidPurchasesCount = filteredPurchases.filter((p) => p.paymentStatus?.toUpperCase() === 'PAID').length;
    const partialPurchasesCount = filteredPurchases.filter((p) => p.paymentStatus?.toUpperCase() === 'PARTIAL').length;
    const pendingPurchasesCount = filteredPurchases.filter((p) => p.paymentStatus?.toUpperCase() === 'PENDING').length;
    const avgPurchaseValue = totalPurchases > 0 ? Math.round(totalPurchaseAmount / totalPurchases) : 0;

    // Suppliers
    const totalSuppliers = suppliers.length;
    const activeSuppliers = suppliers.filter((s) => s.isActive).length;
    const suppliersWithPurchases = new Set(filteredPurchases.map((p) => p.supplierId || p.supplierName)).size;
    const suppliersWithOutstanding = suppliers.filter((s) => s.balance > 0).length;
    const totalSupplierOutstanding = suppliers.reduce((sum, sup) => sum + Math.max(0, sup.balance), 0);

    return {
      totalOrders,
      completedOrders,
      pendingOrders,
      cancelledOrders,
      totalOrderAmount,
      paidOrderAmount,
      pendingOrderAmount,
      paidOrdersCount,
      partialOrdersCount,
      unpaidOrdersCount,
      avgOrderValue,
      totalPurchases,
      totalPurchaseAmount,
      totalPurchasePaid,
      totalPurchasePending,
      fullyPaidPurchasesCount,
      partialPurchasesCount,
      pendingPurchasesCount,
      avgPurchaseValue,
      totalSuppliers,
      activeSuppliers,
      suppliersWithPurchases,
      suppliersWithOutstanding,
      totalSupplierOutstanding,
    };
  }, [filteredOrders, filteredPurchases, suppliers]);

  // ── Daily Time Series Charts ──
  const { orderDailyData, purchaseDailyData } = useMemo(() => {
    // Generate day-by-day buckets across dateRange
    const dayBuckets: { [key: string]: { label: string; date: string } } = {};
    const curr = new Date(dateRange.start);
    const endT = dateRange.end.getTime();

    // Limit bucket count to max 35 days for chart readability
    const totalDays = Math.ceil((endT - curr.getTime()) / (1000 * 60 * 60 * 24)) || 1;
    const stepDays = totalDays > 35 ? Math.ceil(totalDays / 30) : 1;

    while (curr.getTime() <= endT) {
      const y = curr.getFullYear();
      const m = String(curr.getMonth() + 1).padStart(2, '0');
      const d = String(curr.getDate()).padStart(2, '0');
      const key = `${y}-${m}-${d}`;
      dayBuckets[key] = {
        label: curr.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        date: curr.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
      };
      curr.setDate(curr.getDate() + stepDays);
    }

    const orderDailyData: TimeSeriesDataPoint[] = [];
    const purchaseDailyData: TimeSeriesDataPoint[] = [];

    Object.keys(dayBuckets).forEach((key) => {
      const bucket = dayBuckets[key];

      // Match orders on this date key (local date string)
      const dayOrders = filteredOrders.filter((o) => {
        const od = new Date(o.createdAt);
        const oKey = `${od.getFullYear()}-${String(od.getMonth() + 1).padStart(2, '0')}-${String(od.getDate()).padStart(2, '0')}`;
        return oKey === key;
      });

      const dayTotalAmount = dayOrders.reduce((s, o) => s + (Number(o.totalAmount) || 0), 0);
      const dayPaidAmount = dayOrders.reduce((s, o) => {
        const p = Number(
          o.amountPaid ??
          (o.payments?.filter((pay) => ['PAID', 'SUCCESS'].includes(pay.status?.toUpperCase())).reduce((acc, pay) => acc + pay.amount, 0) ??
          (['PAID', 'SUCCESS'].includes(o.paymentStatus?.toUpperCase()) ? o.totalAmount : 0))
        );
        return s + Math.min(p, Number(o.totalAmount) || 0);
      }, 0);

      orderDailyData.push({
        date: bucket.date,
        label: bucket.label,
        primaryValue: dayTotalAmount,
        secondaryValue: dayPaidAmount,
        meta: {
          count: dayOrders.length,
          paid: dayPaidAmount,
          pending: Math.max(0, dayTotalAmount - dayPaidAmount),
        },
      });

      // Match purchases on this date key
      const dayPurchases = filteredPurchases.filter((p) => {
        const pd = new Date(p.purchaseDate || p.createdAt);
        const pKey = `${pd.getFullYear()}-${String(pd.getMonth() + 1).padStart(2, '0')}-${String(pd.getDate()).padStart(2, '0')}`;
        return pKey === key;
      });

      const dayPurchaseTotal = dayPurchases.reduce((s, p) => s + (Number(p.total) || 0), 0);
      const dayPurchasePaid = dayPurchases.reduce((s, p) => s + (Number(p.amountPaid) || 0), 0);

      purchaseDailyData.push({
        date: bucket.date,
        label: bucket.label,
        primaryValue: dayPurchaseTotal,
        secondaryValue: dayPurchasePaid,
        meta: {
          count: dayPurchases.length,
          paid: dayPurchasePaid,
          pending: Math.max(0, dayPurchaseTotal - dayPurchasePaid),
        },
      });
    });

    return { orderDailyData, purchaseDailyData };
  }, [dateRange, filteredOrders, filteredPurchases]);

  // ── Status Distributions ──
  const orderStatusDistribution = useMemo(() => {
    const statuses = [
      { label: 'Delivered', count: kpis.completedOrders, color: '#10B981' },
      { label: 'Pending Delivery', count: kpis.pendingOrders, color: '#F59E0B' },
      { label: 'Cancelled', count: kpis.cancelledOrders, color: '#F43F5E' },
    ];
    return statuses;
  }, [kpis]);

  const purchaseStatusDistribution = useMemo(() => {
    const statuses = [
      { label: 'Paid in Full', count: kpis.fullyPaidPurchasesCount, color: '#10B981' },
      { label: 'Partially Paid', count: kpis.partialPurchasesCount, color: '#F59E0B' },
      { label: 'Pending Payment', count: kpis.pendingPurchasesCount, color: '#F43F5E' },
    ];
    return statuses;
  }, [kpis]);

  // ── Dynamic Key Performance Insights ──
  const dynamicInsights = useMemo<InsightItem[]>(() => {
    const items: InsightItem[] = [];

    // Most active customer by order count
    if (customerReports.length > 0) {
      const topCustomerByOrders = [...customerReports].sort((a, b) => b.orderCount - a.orderCount)[0];
      if (topCustomerByOrders && topCustomerByOrders.orderCount > 0) {
        items.push({
          id: 'top-cust-orders',
          category: 'orders',
          title: 'Most Active Customer',
          entityName: topCustomerByOrders.customerName,
          value: `${topCustomerByOrders.orderCount} Orders`,
          subtext: `Total spend: ${formatINR(topCustomerByOrders.totalAmount)}`,
          badge: 'Top Volume',
          type: 'positive',
          icon: ShoppingCart,
        });
      }

      // Customer with highest revenue
      const topCustomerByValue = [...customerReports].sort((a, b) => b.totalAmount - a.totalAmount)[0];
      if (topCustomerByValue && topCustomerByValue.totalAmount > 0) {
        items.push({
          id: 'top-cust-value',
          category: 'orders',
          title: 'Highest Value Customer',
          entityName: topCustomerByValue.customerName,
          value: formatINR(topCustomerByValue.totalAmount),
          subtext: `${topCustomerByValue.orderCount} orders in period`,
          badge: 'Top Revenue',
          type: 'info',
          icon: TrendingUp,
        });
      }

      // Customer with highest outstanding amount
      const topCustomerOutstanding = [...customerReports].sort((a, b) => b.dueAmount - a.dueAmount)[0];
      if (topCustomerOutstanding && topCustomerOutstanding.dueAmount > 0) {
        items.push({
          id: 'top-cust-due',
          category: 'payments',
          title: 'Highest Due Customer',
          entityName: topCustomerOutstanding.customerName,
          value: formatINR(topCustomerOutstanding.dueAmount),
          subtext: `Collected: ${formatINR(topCustomerOutstanding.paidAmount)}`,
          badge: 'Pending Due',
          type: 'warning',
          icon: AlertCircle,
        });
      }

      // Highest Average Order Value
      const topCustAov = [...customerReports].filter((c) => c.orderCount >= 1).sort((a, b) => b.averageOrderValue - a.averageOrderValue)[0];
      if (topCustAov && topCustAov.averageOrderValue > 0) {
        items.push({
          id: 'top-cust-aov',
          category: 'orders',
          title: 'Highest Avg Order Value',
          entityName: topCustAov.customerName,
          value: formatINR(topCustAov.averageOrderValue),
          subtext: `Over ${topCustAov.orderCount} orders`,
          badge: 'High Ticket',
          type: 'neutral',
          icon: Award,
        });
      }
    }

    // Top Supplier by Purchases in period
    const topSupplierByValue = [...supplierSummaries].sort((a, b) => b.totalInRange - a.totalInRange)[0];
    if (topSupplierByValue && topSupplierByValue.totalInRange > 0) {
      items.push({
        id: 'top-sup-value',
        category: 'suppliers',
        title: 'Top Supplier by Volume',
        entityName: topSupplierByValue.name,
        value: formatINR(topSupplierByValue.totalInRange),
        subtext: `${topSupplierByValue.purchasesInRange} purchases in period`,
        badge: 'Top Procurement',
        type: 'info',
        icon: Building2,
      });
    }

    // Supplier with highest pending balance
    const topSupplierBalance = [...suppliers].sort((a, b) => b.balance - a.balance)[0];
    if (topSupplierBalance && topSupplierBalance.balance > 0) {
      items.push({
        id: 'top-sup-balance',
        category: 'suppliers',
        title: 'Largest Supplier Outstanding',
        entityName: topSupplierBalance.name,
        value: formatINR(topSupplierBalance.balance),
        subtext: 'Current total ledger balance',
        badge: 'Payable Due',
        type: 'warning',
        icon: Clock,
      });
    }

    return items;
  }, [customerReports, supplierSummaries, suppliers]);

  // ── Clear Filters ──
  const clearFilters = () => {
    setDatePreset('7d');
    setCustomStart('');
    setCustomEnd('');
    setPaymentStatusFilter('ALL');
    setOrderStatusFilter('ALL');
    setSupplierFilter('ALL');
    setSearchQuery('');
  };

  const hasActiveFilters =
    datePreset !== '7d' ||
    paymentStatusFilter !== 'ALL' ||
    orderStatusFilter !== 'ALL' ||
    supplierFilter !== 'ALL' ||
    searchQuery.trim() !== '';

  const handleDownloadPDF = () => {
    if (!user) return;

    // Transform filtered orders for PDF reporting
    const pdfOrders = filteredOrders.map((o) => {
      const custName = o.customer?.user?.firstName
        ? `${o.customer.user.firstName} ${o.customer.user.lastName ?? ''}`.trim()
        : (o.customer?.companyName || '—');

      const paid = Number(
        o.amountPaid ??
        (o.payments?.filter((p) => ['PAID', 'SUCCESS'].includes(p.status?.toUpperCase())).reduce((s, p) => s + p.amount, 0) ??
        (['PAID', 'SUCCESS'].includes(o.paymentStatus?.toUpperCase()) ? o.totalAmount : 0))
      );
      const total = Number(o.totalAmount || 0);
      const due = Math.max(0, Number((total - paid).toFixed(2)));

      return {
        id: o.id,
        createdAt: o.createdAt,
        customerName: custName,
        companyName: o.customer?.companyName || null,
        phone: o.customer?.user?.phone || null,
        totalAmount: total,
        amountPaid: paid,
        amountDue: due,
        paymentStatus: o.paymentStatus || 'UNPAID',
        status: o.status || 'PENDING',
        itemsCount: o.items?.reduce((s, it) => s + (it.quantity || 0), 0) || (o.items?.length || 0),
      };
    });

    // Transform filtered purchases for PDF reporting
    const pdfPurchases = filteredPurchases.map((p) => {
      const total = Number(p.total) || 0;
      const paid = Number(p.amountPaid) || 0;
      const pending = Math.max(0, Number((total - paid).toFixed(2)));

      return {
        id: p.id,
        purchaseNumber: p.purchaseNumber,
        purchaseDate: p.purchaseDate || p.createdAt,
        supplierName: p.supplierName,
        itemsCount: p.items?.reduce((s, it) => s + (it.quantity || 0), 0) || (p.items?.length || 0),
        subtotal: Number(p.subtotal) || total,
        tax: Number(p.tax) || 0,
        total,
        amountPaid: paid,
        pendingAmount: pending,
        paymentStatus: p.paymentStatus || 'PENDING',
      };
    });

    generateDistributorReportPDF({
      user: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
      },
      rangeLabel: dateRange.label,
      dateStart: dateRange.start,
      dateEnd: dateRange.end,
      kpis,
      insights: dynamicInsights.map((i) => ({
        title: i.title,
        entityName: i.entityName,
        value: i.value,
        subtext: i.subtext,
      })),
      dailyData: {
        orderDailyData,
        purchaseDailyData,
      },
      orders: pdfOrders,
      purchases: pdfPurchases,
      suppliers: supplierSummaries,
      customers: customerReports,
    });
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="w-full min-h-full bg-[#F8FAFC]">
      {/* ── UNIFIED DISTRIBUTOR TOPBAR ── */}
      <DistributorTopbar
        title="Reports"
        subtitle={
          <span>
            {dateRange.label}
            {lastRefreshed && (
              <span>
                {' '}
                · Live Updated {lastRefreshed.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
              </span>
            )}
          </span>
        }
        icon={BarChart3}
        hideQuickCustomer={true}
        actions={
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap justify-end w-full sm:w-auto">
            {/* Date filter - wraps to full-width row 2 on mobile as order-3, sits first on desktop as order-1 */}
            <div className="order-3 sm:order-1 w-full sm:w-auto mt-1 sm:mt-0">
              <ReportDateFilter
                datePreset={datePreset}
                customStart={customStart}
                customEnd={customEnd}
                onChangePreset={(p) => setDatePreset(p)}
                onChangeCustomRange={(s, e) => {
                  setCustomStart(s);
                  setCustomEnd(e);
                }}
              />
            </div>

            {/* Refresh button */}
            <button
              type="button"
              onClick={loadData}
              disabled={isLoading}
              className="order-1 sm:order-2 inline-flex items-center justify-center gap-1.5 p-2 sm:px-3 sm:py-1.5 text-xs font-semibold text-[#64748B] border border-[#E2E8F0] bg-white rounded-lg hover:bg-slate-50 hover:text-[#16324F] transition-colors disabled:opacity-50 cursor-pointer shadow-2xs shrink-0"
              title="Refresh Report Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#1677C8]' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {/* Export PDF button */}
            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={isLoading}
              className="order-2 sm:order-3 inline-flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-1.5 text-xs font-bold text-white bg-[#1677C8] hover:bg-[#125ea0] active:scale-95 rounded-lg transition-all shadow-xs disabled:opacity-50 cursor-pointer shrink-0"
              title="Export Report PDF"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export PDF</span>
              <span className="sm:hidden">Export</span>
            </button>
          </div>
        }
        secondaryRow={
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
            {/* Left: Tab Switcher (compact & horizontally scrollable on mobile) */}
            <div className="w-full sm:w-auto overflow-x-auto scrollbar-none -mx-0.5 px-0.5 py-0.5">
              <div className="inline-flex items-center bg-slate-100/90 rounded-lg p-0.5 sm:p-1 border border-[#E2E8F0] min-w-max">
                {(['OVERVIEW', 'PURCHASES', 'SUPPLIERS', 'ORDERS'] as ReportType[]).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setReportType(tab)}
                    className={`px-2.5 sm:px-3.5 py-1 sm:py-1.5 text-xs rounded-md transition-all font-semibold whitespace-nowrap cursor-pointer ${
                      reportType === tab
                        ? 'bg-white text-[#1677C8] shadow-xs font-bold'
                        : 'text-[#64748B] hover:text-[#16324F]'
                    }`}
                  >
                    {tab === 'OVERVIEW'
                      ? 'Overview'
                      : tab === 'PURCHASES'
                      ? 'Purchases'
                      : tab === 'SUPPLIERS'
                      ? 'Suppliers'
                      : 'Customer Orders'}
                  </button>
                ))}
              </div>
            </div>

            {/* Right: Secondary Filters */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap w-full sm:w-auto">
              {/* Status Filter for Purchases or Orders */}
              {(reportType === 'PURCHASES' || reportType === 'ORDERS') && (
                <select
                  value={paymentStatusFilter}
                  onChange={(e) => setPaymentStatusFilter(e.target.value)}
                  className="flex-1 sm:flex-initial text-xs font-medium px-2.5 py-1.5 border border-[#E2E8F0] bg-white rounded-lg text-[#374151] focus:outline-none focus:border-[#1677C8] cursor-pointer shadow-2xs"
                >
                  <option value="ALL">All Payment Status</option>
                  <option value="PAID">Paid in Full</option>
                  <option value="PARTIAL">Partially Paid</option>
                  <option value="PENDING">Pending / Unpaid</option>
                </select>
              )}

              {/* Order Status Filter */}
              {reportType === 'ORDERS' && (
                <select
                  value={orderStatusFilter}
                  onChange={(e) => setOrderStatusFilter(e.target.value)}
                  className="flex-1 sm:flex-initial text-xs font-medium px-2.5 py-1.5 border border-[#E2E8F0] bg-white rounded-lg text-[#374151] focus:outline-none focus:border-[#1677C8] cursor-pointer shadow-2xs"
                >
                  <option value="ALL">All Order Status</option>
                  <option value="DELIVERED">Delivered / Completed</option>
                  <option value="PENDING">Pending Delivery</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              )}

              {/* Supplier Filter for Purchases or Suppliers */}
              {(reportType === 'PURCHASES' || reportType === 'SUPPLIERS') && suppliers.length > 0 && (
                <select
                  value={supplierFilter}
                  onChange={(e) => setSupplierFilter(e.target.value)}
                  className="flex-1 sm:flex-initial text-xs font-medium px-2.5 py-1.5 border border-[#E2E8F0] bg-white rounded-lg text-[#374151] focus:outline-none focus:border-[#1677C8] cursor-pointer max-w-full sm:max-w-[170px] shadow-2xs"
                >
                  <option value="ALL">All Suppliers</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              )}

              {/* Clear Filters Button */}
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-rose-600 border border-rose-200 bg-rose-50 rounded-lg hover:bg-rose-100 transition-colors shrink-0 cursor-pointer shadow-2xs"
                  title="Reset filters"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
              )}
            </div>
          </div>
        }
      />

      {/* ── MAIN CONTENT ── */}
      <div className="w-full p-3.5 sm:p-6 space-y-4 sm:space-y-5">
        {isLoading && <EdropsPageLoader minHeight="min-h-[50vh]" />}

        {!isLoading && (
          <>
            {/* ═══════════════════════════════════════════════════════════════════
                1. OVERVIEW TAB
               ═══════════════════════════════════════════════════════════════════ */}
            {reportType === 'OVERVIEW' && (
              <div className="space-y-6">
                {/* KPI Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
                  <ReportKpiCard
                    label="Total Orders"
                    value={String(kpis.totalOrders)}
                    sub={`${kpis.completedOrders} Delivered`}
                    icon={ShoppingCart}
                    colorVariant="blue"
                  />
                  <ReportKpiCard
                    label="Order Revenue"
                    value={formatINR(kpis.totalOrderAmount)}
                    sub={`AOV: ${formatINR(kpis.avgOrderValue)}`}
                    icon={TrendingUp}
                    colorVariant="emerald"
                  />
                  <ReportKpiCard
                    label="Amount Collected"
                    value={formatINR(kpis.paidOrderAmount)}
                    sub={`${kpis.paidOrdersCount} Paid in full`}
                    icon={CheckCircle2}
                    colorVariant="emerald"
                  />
                  <ReportKpiCard
                    label="Order Due"
                    value={formatINR(kpis.pendingOrderAmount)}
                    sub={`${kpis.unpaidOrdersCount} Unpaid orders`}
                    icon={AlertCircle}
                    colorVariant="rose"
                  />
                  <ReportKpiCard
                    label="Purchases Total"
                    value={formatINR(kpis.totalPurchaseAmount)}
                    sub={`${kpis.totalPurchases} Orders placed`}
                    icon={Package}
                    colorVariant="violet"
                  />
                  <ReportKpiCard
                    label="Paid to Suppliers"
                    value={formatINR(kpis.totalPurchasePaid)}
                    sub={`${kpis.fullyPaidPurchasesCount} Paid in full`}
                    icon={CreditCard}
                    colorVariant="sky"
                  />
                  <ReportKpiCard
                    label="Active Suppliers"
                    value={String(kpis.activeSuppliers)}
                    sub={`${kpis.suppliersWithPurchases} active in period`}
                    icon={Users}
                    colorVariant="slate"
                  />
                </div>

                {/* 2-Column Full-Height Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <BarTimeSeriesChart
                    title="Order Revenue & Payment Collections by Day"
                    subtitle="Daily total order value vs actual amount collected"
                    data={orderDailyData}
                    primaryLabel="Order Amount"
                    secondaryLabel="Amount Collected"
                    primaryColor="#1677C8"
                    secondaryColor="#10B981"
                    isCurrency={true}
                    height={250}
                  />

                  <BarTimeSeriesChart
                    title="Procurement Purchases & Supplier Payments by Day"
                    subtitle="Daily total purchase volume vs supplier disbursements"
                    data={purchaseDailyData}
                    primaryLabel="Purchase Total"
                    secondaryLabel="Paid to Supplier"
                    primaryColor="#8B5CF6"
                    secondaryColor="#0EA5E9"
                    isCurrency={true}
                    height={250}
                  />
                </div>

                {/* Financial Reconciliation & Distributions */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                  {/* Financial Reconciliation Breakdown */}
                  <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 sm:p-5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-bold text-[#16324F] flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-[#1677C8]" />
                          Order Financial Breakdown
                        </h3>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          Reconciled
                        </span>
                      </div>
                      <p className="text-[11px] text-[#64748B] mb-4">
                        Financial flow for {dateRange.label}:
                      </p>

                      {/* Visual Flow: Total -> Collected -> Due */}
                      <div className="space-y-2 bg-[#F8FAFC] rounded-xl p-3 border border-[#E2E8F0]">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-[#16324F]">Total Order Amount</span>
                          <span className="text-sm font-bold text-[#16324F] font-mono">{formatINR(kpis.totalOrderAmount)}</span>
                        </div>
                        <div className="flex items-center justify-center text-[#94A3B8]">
                          <ArrowDownRight className="w-4 h-4" />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-emerald-700">Amount Collected</span>
                          <span className="text-sm font-bold text-emerald-700 font-mono">{formatINR(kpis.paidOrderAmount)}</span>
                        </div>
                        <div className="flex items-center justify-center text-[#94A3B8]">
                          <ArrowDownRight className="w-4 h-4" />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-rose-600">Pending / Due Balance</span>
                          <span className="text-sm font-bold text-rose-600 font-mono">{formatINR(kpis.pendingOrderAmount)}</span>
                        </div>
                      </div>

                      {/* Mathematical Guarantee verification note */}
                      <div className="mt-3 text-[11px] text-[#64748B] flex items-center justify-between px-1">
                        <span>Paid Orders: <strong>{kpis.paidOrdersCount}</strong></span>
                        <span>Partial: <strong>{kpis.partialOrdersCount}</strong></span>
                        <span>Unpaid: <strong>{kpis.unpaidOrdersCount}</strong></span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-[#F1F5F9] flex items-center justify-between text-xs">
                      <span className="text-[#64748B]">Average Order Value (AOV)</span>
                      <span className="font-bold text-[#16324F] font-mono">{formatINR(kpis.avgOrderValue)}</span>
                    </div>
                  </div>

                  {/* Order Status Distribution */}
                  <StatusDistributionChart
                    title="Order Fulfillment Status"
                    subtitle="Delivery and order status breakdown for selected period"
                    items={orderStatusDistribution}
                  />

                  {/* Purchase Payment Status Distribution */}
                  <StatusDistributionChart
                    title="Purchase Payment Status"
                    subtitle="Settlement status of distributor purchase orders"
                    items={purchaseStatusDistribution}
                  />
                </div>

                {/* Key Business Insights */}
                <InsightCard insights={dynamicInsights} />
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════════
                2. PURCHASES TAB
               ═══════════════════════════════════════════════════════════════════ */}
            {reportType === 'PURCHASES' && (
              <div className="space-y-6">
                {/* Purchase KPIs */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <ReportKpiCard
                    label="Total Purchases"
                    value={String(kpis.totalPurchases)}
                    sub={`Across ${kpis.suppliersWithPurchases} suppliers`}
                    icon={Package}
                    colorVariant="violet"
                  />
                  <ReportKpiCard
                    label="Total Purchase Value"
                    value={formatINR(kpis.totalPurchaseAmount)}
                    sub={`Avg: ${formatINR(kpis.avgPurchaseValue)}`}
                    icon={TrendingUp}
                    colorVariant="blue"
                  />
                  <ReportKpiCard
                    label="Paid to Suppliers"
                    value={formatINR(kpis.totalPurchasePaid)}
                    sub={`${kpis.fullyPaidPurchasesCount} Paid in full`}
                    icon={CheckCircle2}
                    colorVariant="emerald"
                  />
                  <ReportKpiCard
                    label="Pending to Suppliers"
                    value={formatINR(kpis.totalPurchasePending)}
                    sub={`${kpis.pendingPurchasesCount} Pending`}
                    icon={AlertCircle}
                    colorVariant="rose"
                  />
                </div>

                {/* Purchase Trend Chart */}
                <BarTimeSeriesChart
                  title="Daily Procurement Expenditure & Settlement"
                  subtitle="Purchase order totals vs supplier payments recorded"
                  data={purchaseDailyData}
                  primaryLabel="Purchased Amount"
                  secondaryLabel="Disbursed Payment"
                  primaryColor="#8B5CF6"
                  secondaryColor="#10B981"
                  isCurrency={true}
                  height={220}
                />

                {/* Detailed Purchase Table */}
                <ReportSection
                  title="Procurement Purchase Records"
                  subtitle={`Showing ${filteredPurchases.length} purchases during ${dateRange.label}`}
                  icon={Package}
                  actions={
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                      <input
                        type="text"
                        placeholder="Search purchase #, supplier…"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="text-xs pl-8 pr-3 py-1.5 border border-[#E2E8F0] rounded-lg bg-white text-[#16324F] placeholder-[#94A3B8] focus:outline-none focus:border-[#1677C8] w-48 sm:w-64"
                      />
                    </div>
                  }
                >
                  {/* Desktop Table View */}
                  <div className="hidden md:block overflow-x-auto -mx-4 sm:-mx-5 -my-4 sm:-my-5">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                          <th className="text-left px-4 py-3 font-semibold text-[#64748B] uppercase tracking-wider whitespace-nowrap">Purchase #</th>
                          <th className="text-left px-4 py-3 font-semibold text-[#64748B] uppercase tracking-wider whitespace-nowrap">Date &amp; Time</th>
                          <th className="text-left px-4 py-3 font-semibold text-[#64748B] uppercase tracking-wider">Supplier</th>
                          <th className="text-right px-4 py-3 font-semibold text-[#64748B] uppercase tracking-wider whitespace-nowrap hidden sm:table-cell">Items</th>
                          <th className="text-right px-4 py-3 font-semibold text-[#64748B] uppercase tracking-wider whitespace-nowrap hidden md:table-cell">Subtotal</th>
                          <th className="text-right px-4 py-3 font-semibold text-[#64748B] uppercase tracking-wider whitespace-nowrap hidden md:table-cell">Tax</th>
                          <th className="text-right px-4 py-3 font-semibold text-[#64748B] uppercase tracking-wider whitespace-nowrap">Total</th>
                          <th className="text-right px-4 py-3 font-semibold text-[#64748B] uppercase tracking-wider whitespace-nowrap hidden lg:table-cell">Paid</th>
                          <th className="text-right px-4 py-3 font-semibold text-[#64748B] uppercase tracking-wider whitespace-nowrap hidden lg:table-cell">Pending</th>
                          <th className="text-left px-4 py-3 font-semibold text-[#64748B] uppercase tracking-wider whitespace-nowrap">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F1F5F9]">
                        {filteredPurchases.length === 0 ? (
                          <tr>
                            <td colSpan={10} className="px-4 py-12 text-center text-[#94A3B8]">
                              <FileText className="w-8 h-8 mx-auto mb-2 opacity-30 stroke-1" />
                              <p className="text-xs font-semibold text-[#64748B]">No purchases found for this period</p>
                              <p className="text-[11px] text-[#94A3B8] mt-0.5">Try widening the date range or resetting filters</p>
                            </td>
                          </tr>
                        ) : (
                          filteredPurchases
                            .slice((tablePage - 1) * pageSize, tablePage * pageSize)
                            .map((p, idx) => {
                              const pending = Math.max(0, p.total - (p.amountPaid ?? 0));
                              return (
                                <tr key={p.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-[#FAFBFC]'} hover:bg-blue-50/40 transition-colors`}>
                                  <td className="px-4 py-3 font-mono font-semibold text-[#1677C8] whitespace-nowrap">{p.purchaseNumber}</td>
                                  <td className="px-4 py-3 text-[#374151] whitespace-nowrap">{formatDateTime(p.purchaseDate || p.createdAt)}</td>
                                  <td className="px-4 py-3 font-medium text-[#16324F] max-w-[160px] truncate">{p.supplierName}</td>
                                  <td className="px-4 py-3 text-[#64748B] text-right hidden sm:table-cell">{p.items?.length ?? 0}</td>
                                  <td className="px-4 py-3 text-[#64748B] text-right font-mono hidden md:table-cell">{formatINR(p.subtotal)}</td>
                                  <td className="px-4 py-3 text-[#64748B] text-right font-mono hidden md:table-cell">{formatINR(p.tax)}</td>
                                  <td className="px-4 py-3 font-bold text-[#16324F] text-right font-mono">{formatINR(p.total)}</td>
                                  <td className="px-4 py-3 text-emerald-600 text-right font-mono hidden lg:table-cell">{formatINR(p.amountPaid)}</td>
                                  <td className="px-4 py-3 text-right font-mono hidden lg:table-cell">
                                    <span className={pending > 0 ? 'text-rose-600 font-semibold' : 'text-[#94A3B8]'}>{formatINR(pending)}</span>
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap">
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
                            <td colSpan={6} className="px-4 py-3 text-xs font-bold text-[#16324F]">
                              Totals for {filteredPurchases.length} Purchases
                            </td>
                            <td className="px-4 py-3 text-xs font-bold text-[#16324F] text-right font-mono">{formatINR(kpis.totalPurchaseAmount)}</td>
                            <td className="px-4 py-3 text-xs font-bold text-emerald-700 text-right font-mono hidden lg:table-cell">{formatINR(kpis.totalPurchasePaid)}</td>
                            <td className="px-4 py-3 text-xs font-bold text-rose-600 text-right font-mono hidden lg:table-cell">{formatINR(kpis.totalPurchasePending)}</td>
                            <td className="px-4 py-3" />
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>

                  {/* Mobile Card List View (No internal IDs, clean hierarchy) */}
                  <div className="md:hidden divide-y divide-[#F1F5F9] -mx-4 sm:-mx-5 -my-4 sm:-my-5">
                    {filteredPurchases.length === 0 ? (
                      <div className="px-4 py-8 text-center text-[#94A3B8]">
                        <FileText className="w-8 h-8 mx-auto mb-2 opacity-30 stroke-1" />
                        <p className="text-xs font-semibold text-[#64748B]">No purchases found for this period</p>
                      </div>
                    ) : (
                      filteredPurchases
                        .slice((tablePage - 1) * pageSize, tablePage * pageSize)
                        .map((p) => {
                          const pending = Math.max(0, p.total - (p.amountPaid ?? 0));
                          return (
                            <div key={p.id} className="p-3.5 bg-white space-y-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-bold text-xs text-[#16324F] truncate">
                                  {p.supplierName}
                                </span>
                                <span className="text-[10px] text-[#94A3B8] font-medium shrink-0">
                                  {formatDateTime(p.purchaseDate || p.createdAt)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-2 text-xs">
                                <div className="text-slate-600 font-medium">
                                  <span>{p.items?.length ?? 0} items</span>
                                  <span className="mx-1 text-slate-300">•</span>
                                  <span className="font-bold text-[#16324F]">{formatINR(p.total)}</span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <StatusBadge status={p.paymentStatus} type="payment" />
                                  {pending > 0 && (
                                    <span className="text-rose-600 font-bold bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded text-[10px]">
                                      Due {formatINR(pending)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                    )}
                  </div>

                  {/* Pagination */}
                  {filteredPurchases.length > pageSize && (
                    <div className="flex items-center justify-between pt-4 mt-2 border-t border-[#F1F5F9] text-xs">
                      <span className="text-[#64748B]">
                        Showing {(tablePage - 1) * pageSize + 1}–{Math.min(tablePage * pageSize, filteredPurchases.length)} of {filteredPurchases.length}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          disabled={tablePage === 1}
                          onClick={() => setTablePage((p) => Math.max(1, p - 1))}
                          className="px-2.5 py-1 border border-[#E2E8F0] rounded bg-white text-[#374151] hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
                        >
                          Previous
                        </button>
                        <span className="px-2 font-semibold text-[#16324F]">{tablePage}</span>
                        <button
                          disabled={tablePage * pageSize >= filteredPurchases.length}
                          onClick={() => setTablePage((p) => p + 1)}
                          className="px-2.5 py-1 border border-[#E2E8F0] rounded bg-white text-[#374151] hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </ReportSection>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════════
                3. SUPPLIERS TAB
               ═══════════════════════════════════════════════════════════════════ */}
            {reportType === 'SUPPLIERS' && (
              <div className="space-y-6">
                {/* Summary KPI Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <ReportKpiCard
                    label="Total Suppliers"
                    value={String(kpis.totalSuppliers)}
                    sub={`${kpis.activeSuppliers} Active fleet partners`}
                    icon={Building2}
                    colorVariant="sky"
                  />
                  <ReportKpiCard
                    label="Suppliers with Purchases"
                    value={String(kpis.suppliersWithPurchases)}
                    sub={`Procured in this period`}
                    icon={CheckCircle2}
                    colorVariant="blue"
                  />
                  <ReportKpiCard
                    label="Purchases in Period"
                    value={formatINR(kpis.totalPurchaseAmount)}
                    sub={`${kpis.totalPurchases} Orders placed`}
                    icon={Package}
                    colorVariant="violet"
                  />
                  <ReportKpiCard
                    label="Total Outstanding Payable"
                    value={formatINR(kpis.totalSupplierOutstanding)}
                    sub={`${kpis.suppliersWithOutstanding} suppliers with balance`}
                    icon={AlertCircle}
                    colorVariant="rose"
                  />
                </div>

                {/* Supplier Performance Matrix */}
                <ReportSection
                  title="Supplier Performance & Balances"
                  subtitle={`Matrix of suppliers based on activity within ${dateRange.label}`}
                  icon={Building2}
                  actions={
                    <div className="flex items-center gap-2 flex-wrap">
                      <select
                        value={supplierSortBy}
                        onChange={(e) => setSupplierSortBy(e.target.value as any)}
                        className="text-xs font-semibold px-2.5 py-1.5 border border-[#E2E8F0] bg-white rounded-lg text-[#374151] focus:outline-none cursor-pointer"
                      >
                        <option value="value">Sort: Highest Purchases</option>
                        <option value="purchases">Sort: Most Orders</option>
                        <option value="outstanding">Sort: Highest Outstanding</option>
                        <option value="paid">Sort: Highest Paid</option>
                      </select>
                    </div>
                  }
                >
                  {/* Desktop Table View */}
                  <div className="hidden md:block overflow-x-auto -mx-4 sm:-mx-5 -my-4 sm:-my-5">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                          <th className="text-left px-4 py-3 font-semibold text-[#64748B] uppercase tracking-wider">Supplier</th>
                          <th className="text-right px-4 py-3 font-semibold text-[#64748B] uppercase tracking-wider whitespace-nowrap">Purchases (Period)</th>
                          <th className="text-right px-4 py-3 font-semibold text-[#64748B] uppercase tracking-wider whitespace-nowrap">Purchased Amount</th>
                          <th className="text-right px-4 py-3 font-semibold text-[#64748B] uppercase tracking-wider whitespace-nowrap hidden sm:table-cell">Paid (Period)</th>
                          <th className="text-right px-4 py-3 font-semibold text-[#64748B] uppercase tracking-wider whitespace-nowrap hidden md:table-cell">Avg Purchase</th>
                          <th className="text-right px-4 py-3 font-semibold text-[#64748B] uppercase tracking-wider whitespace-nowrap">Total Ledger Balance</th>
                          <th className="text-left px-4 py-3 font-semibold text-[#64748B] uppercase tracking-wider whitespace-nowrap hidden lg:table-cell">Last Purchase</th>
                          <th className="w-8 px-4 py-3" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F1F5F9]">
                        {supplierSummaries.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="px-4 py-12 text-center text-[#94A3B8]">
                              <Users className="w-8 h-8 mx-auto mb-2 opacity-30 stroke-1" />
                              <p className="text-xs font-semibold text-[#64748B]">No supplier records available</p>
                            </td>
                          </tr>
                        ) : (
                          supplierSummaries.map((s, idx) => (
                            <tr
                              key={s.id}
                              onClick={() => navigate(`/distributor/suppliers/${s.id}`)}
                              className={`cursor-pointer ${idx % 2 === 0 ? 'bg-white' : 'bg-[#FAFBFC]'} hover:bg-blue-50/40 transition-colors`}
                            >
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2.5">
                                  <div className="h-8 w-8 rounded-lg bg-[#1677C8]/10 text-[#1677C8] font-bold flex items-center justify-center shrink-0">
                                    {s.name.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <p className="font-bold text-[#16324F] flex items-center gap-1.5">
                                      {s.name}
                                      {!s.isActive && (
                                        <span className="text-[9px] px-1.5 py-0.2 bg-slate-100 text-slate-500 rounded font-normal">Inactive</span>
                                      )}
                                    </p>
                                    <p className="text-[11px] text-[#64748B]">{s.companyName || s.phone || 'No company info'}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right font-medium text-[#16324F]">{s.purchasesInRange}</td>
                              <td className="px-4 py-3 text-right font-bold text-[#16324F] font-mono">{formatINR(s.totalInRange)}</td>
                              <td className="px-4 py-3 text-right font-mono text-emerald-700 hidden sm:table-cell">{formatINR(s.paidInRange)}</td>
                              <td className="px-4 py-3 text-right font-mono text-[#64748B] hidden md:table-cell">{formatINR(s.averagePurchaseValue)}</td>
                              <td className="px-4 py-3 text-right font-mono">
                                <span className={`font-bold ${s.balance > 0 ? 'text-rose-600' : s.balance < 0 ? 'text-emerald-600' : 'text-[#94A3B8]'}`}>
                                  {s.balance === 0 ? '₹0' : formatINR(Math.abs(s.balance))}
                                  {s.balance > 0 && <span className="text-[10px] ml-1 font-normal uppercase">Due</span>}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-[#64748B] whitespace-nowrap hidden lg:table-cell">
                                {s.lastPurchasedAt ? formatDate(s.lastPurchasedAt) : '—'}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <ChevronRight className="w-4 h-4 text-[#94A3B8]" />
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Card List View */}
                  <div className="md:hidden divide-y divide-[#F1F5F9] -mx-4 sm:-mx-5 -my-4 sm:-my-5">
                    {supplierSummaries.length === 0 ? (
                      <div className="px-4 py-8 text-center text-[#94A3B8]">
                        <Users className="w-8 h-8 mx-auto mb-2 opacity-30 stroke-1" />
                        <p className="text-xs font-semibold text-[#64748B]">No supplier records available</p>
                      </div>
                    ) : (
                      supplierSummaries.map((s) => (
                        <div
                          key={s.id}
                          onClick={() => navigate(`/distributor/suppliers/${s.id}`)}
                          className="p-3.5 bg-white hover:bg-slate-50 transition cursor-pointer space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-xs text-[#16324F] truncate">
                              {s.name}
                            </span>
                            {!s.isActive ? (
                              <span className="text-[9px] px-1.5 py-0.2 bg-slate-100 text-slate-500 rounded font-normal shrink-0">
                                Inactive
                              </span>
                            ) : (
                              <span className="text-[9px] px-1.5 py-0.2 bg-emerald-50 text-emerald-700 rounded font-bold shrink-0">
                                Active
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-[#64748B] truncate">
                            {s.companyName || s.phone || 'No company info'}
                          </div>
                          <div className="flex items-center justify-between gap-2 text-xs pt-1">
                            <div className="text-slate-600 font-medium">
                              <span>{s.purchasesInRange} purchases</span>
                              <span className="mx-1 text-slate-300">•</span>
                              <span className="font-bold text-[#16324F]">{formatINR(s.totalInRange)}</span>
                            </div>
                            <span className={`font-bold text-xs ${s.balance > 0 ? 'text-rose-600' : s.balance < 0 ? 'text-emerald-600' : 'text-[#94A3B8]'}`}>
                              {s.balance === 0 ? '₹0' : formatINR(Math.abs(s.balance))}
                              {s.balance > 0 && <span className="text-[10px] ml-1 font-normal uppercase">Due</span>}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ReportSection>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════════
                4. ORDERS TAB (CUSTOMER-BASED REPORTING)
               ═══════════════════════════════════════════════════════════════════ */}
            {reportType === 'ORDERS' && (
              <div className="space-y-6">
                {/* Orders KPIs */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <ReportKpiCard
                    label="Orders in Period"
                    value={String(kpis.totalOrders)}
                    sub={`${customerReports.length} Customers active`}
                    icon={ShoppingCart}
                    colorVariant="blue"
                  />
                  <ReportKpiCard
                    label="Order Revenue"
                    value={formatINR(kpis.totalOrderAmount)}
                    sub={`Avg: ${formatINR(kpis.avgOrderValue)}`}
                    icon={TrendingUp}
                    colorVariant="emerald"
                  />
                  <ReportKpiCard
                    label="Amount Collected"
                    value={formatINR(kpis.paidOrderAmount)}
                    sub={`${kpis.paidOrdersCount} Paid orders`}
                    icon={CheckCircle2}
                    colorVariant="sky"
                  />
                  <ReportKpiCard
                    label="Pending Customer Balance"
                    value={formatINR(kpis.pendingOrderAmount)}
                    sub={`${kpis.unpaidOrdersCount} Unpaid orders`}
                    icon={AlertCircle}
                    colorVariant="rose"
                  />
                </div>

                {/* View Mode Toggle: Customer Performance vs Detailed Records */}
                <div className="flex items-center justify-between flex-wrap gap-2 pb-1">
                  <div className="flex bg-slate-100 p-0.5 rounded-lg border border-[#E2E8F0]">
                    <button
                      onClick={() => setOrdersViewMode('customers')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                        ordersViewMode === 'customers'
                          ? 'bg-white text-[#1677C8] shadow-xs'
                          : 'text-[#64748B] hover:text-[#16324F]'
                      }`}
                    >
                      Customer Performance ({customerReports.length})
                    </button>
                    <button
                      onClick={() => setOrdersViewMode('records')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                        ordersViewMode === 'records'
                          ? 'bg-white text-[#1677C8] shadow-xs'
                          : 'text-[#64748B] hover:text-[#16324F]'
                      }`}
                    >
                      Detailed Order Records ({filteredOrders.length})
                    </button>
                  </div>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                    <input
                      type="text"
                      placeholder="Search customer, phone, order #…"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="text-xs pl-8 pr-3 py-1.5 border border-[#E2E8F0] rounded-lg bg-white text-[#16324F] placeholder-[#94A3B8] focus:outline-none focus:border-[#1677C8] w-48 sm:w-64"
                    />
                  </div>
                </div>

                {/* VIEW 1: CUSTOMER PERFORMANCE MATRIX */}
                {ordersViewMode === 'customers' && (
                  <ReportSection
                    title="Customer Sales & Payment Breakdown"
                    subtitle={`Aggregated by customer orders placed within ${dateRange.label}`}
                    icon={Users}
                  >
                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto -mx-4 sm:-mx-5 -my-4 sm:-my-5">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                            <th className="text-left px-4 py-3 font-semibold text-[#64748B] uppercase tracking-wider">Customer</th>
                            <th className="text-right px-4 py-3 font-semibold text-[#64748B] uppercase tracking-wider whitespace-nowrap">Orders in Period</th>
                            <th className="text-right px-4 py-3 font-semibold text-[#64748B] uppercase tracking-wider whitespace-nowrap">Total Spend</th>
                            <th className="text-right px-4 py-3 font-semibold text-[#64748B] uppercase tracking-wider whitespace-nowrap hidden sm:table-cell">Paid Amount</th>
                            <th className="text-right px-4 py-3 font-semibold text-[#64748B] uppercase tracking-wider whitespace-nowrap">Pending Due</th>
                            <th className="text-right px-4 py-3 font-semibold text-[#64748B] uppercase tracking-wider whitespace-nowrap hidden md:table-cell">Avg Order Value</th>
                            <th className="text-left px-4 py-3 font-semibold text-[#64748B] uppercase tracking-wider whitespace-nowrap hidden lg:table-cell">Last Order</th>
                            <th className="text-left px-4 py-3 font-semibold text-[#64748B] uppercase tracking-wider whitespace-nowrap hidden lg:table-cell">Fulfillment</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#F1F5F9]">
                          {customerReports.length === 0 ? (
                            <tr>
                              <td colSpan={8} className="px-4 py-12 text-center text-[#94A3B8]">
                                <Users className="w-8 h-8 mx-auto mb-2 opacity-30 stroke-1" />
                                <p className="text-xs font-semibold text-[#64748B]">No customer orders in this period</p>
                                <p className="text-[11px] text-[#94A3B8] mt-0.5">Try selecting a wider date range</p>
                              </td>
                            </tr>
                          ) : (
                            customerReports.map((c, idx) => (
                              <tr key={c.customerId} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-[#FAFBFC]'} hover:bg-blue-50/40 transition-colors`}>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-full bg-[#1677C8]/10 text-[#1677C8] font-bold flex items-center justify-center shrink-0">
                                      {c.customerName.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                      <p className="font-semibold text-[#16324F] leading-tight">{c.customerName}</p>
                                      <p className="text-[11px] text-[#64748B] mt-0.5">{c.companyName || c.phone || '—'}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-right font-semibold text-[#16324F]">{c.orderCount}</td>
                                <td className="px-4 py-3 text-right font-bold text-[#16324F] font-mono">{formatINR(c.totalAmount)}</td>
                                <td className="px-4 py-3 text-right font-mono text-emerald-700 hidden sm:table-cell">{formatINR(c.paidAmount)}</td>
                                <td className="px-4 py-3 text-right font-mono">
                                  <span className={c.dueAmount > 0 ? 'text-rose-600 font-bold' : 'text-[#94A3B8]'}>
                                    {formatINR(c.dueAmount)}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right font-mono text-[#64748B] hidden md:table-cell">{formatINR(c.averageOrderValue)}</td>
                                <td className="px-4 py-3 text-[#64748B] whitespace-nowrap hidden lg:table-cell">{formatDate(c.lastOrderDate)}</td>
                                <td className="px-4 py-3 whitespace-nowrap hidden lg:table-cell">
                                  <span className="text-[11px] font-medium text-[#64748B]">
                                    {c.deliveredCount} Delivered · {c.pendingCount} Pending
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                        {customerReports.length > 0 && (
                          <tfoot>
                            <tr className="border-t-2 border-[#E2E8F0] bg-[#F8FAFC]">
                              <td className="px-4 py-3 text-xs font-bold text-[#16324F]">
                                Total for {customerReports.length} Customers
                              </td>
                              <td className="px-4 py-3 text-xs font-bold text-[#16324F] text-right font-mono">{kpis.totalOrders}</td>
                              <td className="px-4 py-3 text-xs font-bold text-[#16324F] text-right font-mono">{formatINR(kpis.totalOrderAmount)}</td>
                              <td className="px-4 py-3 text-xs font-bold text-emerald-700 text-right font-mono hidden sm:table-cell">{formatINR(kpis.paidOrderAmount)}</td>
                              <td className="px-4 py-3 text-xs font-bold text-rose-600 text-right font-mono">{formatINR(kpis.pendingOrderAmount)}</td>
                              <td colSpan={3} className="px-4 py-3" />
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>

                    {/* Mobile Card List View for Customer Matrix */}
                    <div className="md:hidden divide-y divide-[#F1F5F9] -mx-4 sm:-mx-5 -my-4 sm:-my-5">
                      {customerReports.length === 0 ? (
                        <div className="px-4 py-8 text-center text-[#94A3B8]">
                          <Users className="w-8 h-8 mx-auto mb-2 opacity-30 stroke-1" />
                          <p className="text-xs font-semibold text-[#64748B]">No customer orders in this period</p>
                        </div>
                      ) : (
                        customerReports.map((c) => (
                          <div key={c.customerId} className="p-3.5 bg-white space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-xs text-[#16324F] truncate">
                                {c.customerName}
                              </span>
                              <span className="text-xs font-bold text-[#16324F] font-mono">
                                {formatINR(c.totalAmount)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-2 text-[11px] text-[#64748B]">
                              <span>{c.companyName || c.phone || 'Residential'}</span>
                              <span>{c.orderCount} {c.orderCount === 1 ? 'order' : 'orders'}</span>
                            </div>
                            {c.dueAmount > 0 && (
                              <div className="flex justify-end pt-0.5">
                                <span className="text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded">
                                  Due {formatINR(c.dueAmount)}
                                </span>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </ReportSection>
                )}

                {/* VIEW 2: DETAILED ORDER RECORDS */}
                {ordersViewMode === 'records' && (
                  <ReportSection
                    title="Customer Order Records"
                    subtitle={`Listing individual orders placed within ${dateRange.label}`}
                    icon={ShoppingCart}
                  >
                    {/* Mobile View: Cards */}
                    <div className="md:hidden divide-y divide-[#F1F5F9]">
                      {filteredOrders.length === 0 ? (
                        <div className="py-10 text-center text-[#94A3B8]">
                          <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-30 stroke-1" />
                          <p className="text-xs font-semibold text-[#64748B]">No orders found for this period</p>
                        </div>
                      ) : (
                        filteredOrders
                          .slice((tablePage - 1) * pageSize, tablePage * pageSize)
                          .map((o) => {
                            const custName = o.customer?.user?.firstName
                              ? `${o.customer.user.firstName} ${o.customer.user.lastName ?? ''}`.trim()
                              : o.customer?.companyName ?? '—';
                            const jars = o.items?.reduce((s, it) => s + (it.product?.isJar ? it.quantity : 0), 0) ?? 0;
                            const totalQty = o.items?.reduce((s, it) => s + it.quantity, 0) ?? 0;
                            const paid = Number(
                              o.amountPaid ??
                              (o.payments?.filter((p) => ['PAID', 'SUCCESS'].includes(p.status?.toUpperCase())).reduce((s, p) => s + p.amount, 0) ??
                              (['PAID', 'SUCCESS'].includes(o.paymentStatus?.toUpperCase()) ? o.totalAmount : 0))
                            );
                            const due = Math.max(0, o.totalAmount - paid);

                            return (
                              <div key={o.id} className="py-3 px-1 space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="text-xs font-bold text-[#16324F] truncate">{custName}</div>
                                    <div className="text-[10px] text-[#64748B]">{formatDateTime(o.createdAt)}</div>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <StatusBadge status={o.status} type="order" />
                                    <StatusBadge status={o.paymentStatus} type="payment" />
                                  </div>
                                </div>
                                <div className="flex items-center justify-between text-xs pt-1 border-t border-[#F8FAFC]">
                                  <span className="text-[#64748B] text-[11px]">
                                    {jars > 0 ? `${jars} jars` : `${totalQty} items`}
                                  </span>
                                  <div className="text-right">
                                    <span className="font-bold text-[#16324F] font-mono">{formatINR(o.totalAmount)}</span>
                                    {due > 0 ? (
                                      <div className="text-[10px] text-rose-600 font-medium">Due {formatINR(due)}</div>
                                    ) : (
                                      <div className="text-[10px] text-emerald-600 font-medium">Paid</div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })
                      )}
                    </div>

                    {/* Desktop View: Table */}
                    <div className="hidden md:block overflow-x-auto -mx-4 sm:-mx-5 -my-4 sm:-my-5">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                            <th className="text-left px-4 py-3 font-semibold text-[#64748B] uppercase tracking-wider whitespace-nowrap">Order #</th>
                            <th className="text-left px-4 py-3 font-semibold text-[#64748B] uppercase tracking-wider whitespace-nowrap">Date &amp; Time</th>
                            <th className="text-left px-4 py-3 font-semibold text-[#64748B] uppercase tracking-wider">Customer</th>
                            <th className="text-right px-4 py-3 font-semibold text-[#64748B] uppercase tracking-wider whitespace-nowrap hidden sm:table-cell">Items</th>
                            <th className="text-right px-4 py-3 font-semibold text-[#64748B] uppercase tracking-wider whitespace-nowrap">Amount</th>
                            <th className="text-right px-4 py-3 font-semibold text-[#64748B] uppercase tracking-wider whitespace-nowrap hidden md:table-cell">Paid</th>
                            <th className="text-right px-4 py-3 font-semibold text-[#64748B] uppercase tracking-wider whitespace-nowrap hidden md:table-cell">Due</th>
                            <th className="text-left px-4 py-3 font-semibold text-[#64748B] uppercase tracking-wider whitespace-nowrap">Payment</th>
                            <th className="text-left px-4 py-3 font-semibold text-[#64748B] uppercase tracking-wider whitespace-nowrap">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#F1F5F9]">
                          {filteredOrders.length === 0 ? (
                            <tr>
                              <td colSpan={9} className="px-4 py-12 text-center text-[#94A3B8]">
                                <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-30 stroke-1" />
                                <p className="text-xs font-semibold text-[#64748B]">No orders found for this period</p>
                              </td>
                            </tr>
                          ) : (
                            filteredOrders
                              .slice((tablePage - 1) * pageSize, tablePage * pageSize)
                              .map((o, idx) => {
                                const custName = o.customer?.user?.firstName
                                  ? `${o.customer.user.firstName} ${o.customer.user.lastName ?? ''}`.trim()
                                  : o.customer?.companyName ?? '—';
                                const jars = o.items?.reduce((s, it) => s + (it.product?.isJar ? it.quantity : 0), 0) ?? 0;
                                const totalQty = o.items?.reduce((s, it) => s + it.quantity, 0) ?? 0;
                                const paid = Number(
                                  o.amountPaid ??
                                  (o.payments?.filter((p) => ['PAID', 'SUCCESS'].includes(p.status?.toUpperCase())).reduce((s, p) => s + p.amount, 0) ??
                                  (['PAID', 'SUCCESS'].includes(o.paymentStatus?.toUpperCase()) ? o.totalAmount : 0))
                                );
                                const due = Math.max(0, o.totalAmount - paid);

                                return (
                                  <tr key={o.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-[#FAFBFC]'} hover:bg-blue-50/40 transition-colors`}>
                                    <td className="px-4 py-3 font-mono font-semibold text-[#1677C8] whitespace-nowrap">#{formatOrderId(o.id)}</td>
                                    <td className="px-4 py-3 text-[#374151] whitespace-nowrap">{formatDateTime(o.createdAt)}</td>
                                    <td className="px-4 py-3 font-medium text-[#16324F] max-w-[140px] truncate">{custName}</td>
                                    <td className="px-4 py-3 text-right text-[#64748B] hidden sm:table-cell">{jars > 0 ? `${jars} jars` : `${totalQty} items`}</td>
                                    <td className="px-4 py-3 font-bold text-[#16324F] text-right font-mono">{formatINR(o.totalAmount)}</td>
                                    <td className="px-4 py-3 text-right font-mono text-emerald-700 hidden md:table-cell">{formatINR(paid)}</td>
                                    <td className="px-4 py-3 text-right font-mono hidden md:table-cell">
                                      <span className={due > 0 ? 'text-rose-600 font-semibold' : 'text-[#94A3B8]'}>{formatINR(due)}</span>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                      <StatusBadge status={o.paymentStatus} type="payment" />
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
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
                              <td colSpan={4} className="px-4 py-3 text-xs font-bold text-[#16324F]">
                                Totals ({filteredOrders.length} orders)
                              </td>
                              <td className="px-4 py-3 text-xs font-bold text-[#16324F] text-right font-mono">{formatINR(kpis.totalOrderAmount)}</td>
                              <td className="px-4 py-3 text-xs font-bold text-emerald-700 text-right font-mono hidden md:table-cell">{formatINR(kpis.paidOrderAmount)}</td>
                              <td className="px-4 py-3 text-xs font-bold text-rose-600 text-right font-mono hidden md:table-cell">{formatINR(kpis.pendingOrderAmount)}</td>
                              <td colSpan={2} className="px-4 py-3" />
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>

                    {/* Pagination */}
                    {filteredOrders.length > pageSize && (
                      <div className="flex items-center justify-between pt-4 mt-2 border-t border-[#F1F5F9] text-xs">
                        <span className="text-[#64748B]">
                          Showing {(tablePage - 1) * pageSize + 1}–{Math.min(tablePage * pageSize, filteredOrders.length)} of {filteredOrders.length}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            disabled={tablePage === 1}
                            onClick={() => setTablePage((p) => Math.max(1, p - 1))}
                            className="px-2.5 py-1 border border-[#E2E8F0] rounded bg-white text-[#374151] hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
                          >
                            Previous
                          </button>
                          <span className="px-2 font-semibold text-[#16324F]">{tablePage}</span>
                          <button
                            disabled={tablePage * pageSize >= filteredOrders.length}
                            onClick={() => setTablePage((p) => p + 1)}
                            className="px-2.5 py-1 border border-[#E2E8F0] rounded bg-white text-[#374151] hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </ReportSection>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
