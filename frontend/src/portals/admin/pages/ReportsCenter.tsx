import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Download,
  RotateCw,
  Calendar,
  ShoppingCart,
  Users,
  TrendingUp,
  Clock,
  AlertCircle,
  Building2,
  Truck,
  Layers,
  Package,
  ChevronDown,
  Check,
  CreditCard,
  Search,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  XCircle,
  Receipt,
  FileSpreadsheet,
} from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';
import { EdropsPageLoader } from '../../../components/common/EdropsPageLoader';
import { DataErrorState } from '../../../components/common/DataErrorState';
import { toast } from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type DatePreset = 'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS' | 'LAST_30_DAYS' | 'THIS_MONTH' | 'CUSTOM';

type ReportTab =
  | 'overview'
  | 'orders'
  | 'sales'
  | 'customers'
  | 'distributors'
  | 'drivers'
  | 'products'
  | 'memberships'
  | 'audit';

interface KPIItem {
  value: number;
  prevValue?: number;
  change?: number;
  total?: number;
  label?: string;
}

interface AdminAnalyticsPayload {
  dateRange: {
    preset: string;
    startDate: string;
    endDate: string;
  };
  overview: {
    kpis: Record<string, KPIItem>;
    salesTimeSeries: Array<{
      date: string;
      label: string;
      orderSales: number;
      membershipSales: number;
      totalSales: number;
      orderCount: number;
      deliveredCount?: number;
    }>;
  };
  orders: {
    kpis: {
      total: number;
      newPlaced: number;
      confirmed: number;
      assigned: number;
      outForDelivery: number;
      delivered: number;
      cancelled: number;
      pending: number;
      averageOrderValue: number;
      deliveryCompletionRate: number;
    };
    byStatus: Array<{ status: string; count: number }>;
    byDistributor: Array<{ name: string; count: number }>;
    byDriver: Array<{ name: string; count: number }>;
    recentOrders: Array<{
      id: string;
      date: string;
      customerName: string;
      customerPhone: string;
      distributorName: string;
      driverName: string;
      itemsSummary: string;
      amount: number;
      paymentStatus: string;
      orderStatus: string;
      deliveredDate?: string | null;
    }>;
  };
  sales: {
    kpis: {
      grossSales: number;
      orderSales: number;
      membershipSales: number;
      paidAmount: number;
      pendingAmount: number;
      cashCollected: number;
      onlinePayments: number;
      refunds: number;
    };
    paymentMethods: Array<{ method: string; count: number; amount: number }>;
    salesByProduct: Array<{ id: string; name: string; category: string; unitsSold: number; revenue: number }>;
    salesByDistributor: Array<{ id: string; name: string; agencyName?: string; sales: number; collected: number; outstanding: number }>;
    transactions: Array<{
      id: string;
      orderId: string;
      customerName: string;
      amount: number;
      paid: number;
      due: number;
      paymentMethod: string;
      paymentStatus: string;
      date: string;
    }>;
  };
  customers: {
    kpis: {
      total: number;
      active: number;
      newInRange: number;
      withOrders: number;
      withOutstanding: number;
      membershipCustomers: number;
    };
    customerList: Array<{
      id: string;
      name: string;
      phone: string;
      ordersCount: number;
      totalPurchases: number;
      depositPaid: number;
      depositDue: number;
      jarsAtCustomer: number;
      membershipStatus: string;
      createdAt: string;
    }>;
  };
  distributors: {
    kpis: {
      total: number;
      active: number;
      assignedOrders: number;
      deliveredOrders: number;
      pendingOrders: number;
      cancelledOrders: number;
      revenueHandled: number;
    };
    performanceList: Array<{
      id: string;
      name: string;
      phone: string;
      agencyName?: string;
      assignedCount: number;
      deliveredCount: number;
      pendingCount: number;
      cancelledCount: number;
      sales: number;
      collected: number;
      outstanding: number;
      deliveryPerformance: number;
    }>;
  };
  drivers: {
    kpis: {
      total: number;
      active: number;
      assignedDeliveries: number;
      outForDelivery: number;
      delivered: number;
      failedCancelled: number;
      deliveryCompletionRate: number;
    };
    performanceList: Array<{
      id: string;
      name: string;
      phone: string;
      vehicleNumber: string;
      vehicleType: string;
      distributorName: string;
      assignedCount: number;
      deliveredCount: number;
      pendingCount: number;
      completionRate: number;
      isActive: boolean;
    }>;
  };
  products: {
    kpis: {
      totalProducts: number;
      activeCategories: number;
      activeBrands: number;
      totalUnitsSold: number;
      totalRevenue: number;
    };
    performanceList: Array<{
      id: string;
      name: string;
      category: string;
      brand: string;
      price: number;
      unitsSold: number;
      revenue: number;
      ordersCount: number;
      stock: number;
    }>;
  };
  memberships: {
    kpis: {
      totalPlans: number;
      plansSold: number;
      jarsVolumeSold: number;
      revenue: number;
      activeMemberships: number;
    };
    performanceList: Array<{
      id: string;
      name: string;
      jarCount: number;
      price: number;
      badge?: string;
      color?: string;
      soldCount: number;
      revenue: number;
      customersCount: number;
      status: string;
    }>;
  };
  audit: {
    activityList: Array<{
      id: string;
      timestamp: string;
      user: string;
      action: string;
      entity: string;
      previousState: string;
      newState: string;
      details: string;
    }>;
  };
}

export default function ReportsCenter() {
  // Navigation & State
  const [activeTab, setActiveTab] = useState<ReportTab>('overview');
  const [preset, setPreset] = useState<DatePreset>('LAST_30_DAYS');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);

  // Search & Filter within tabs
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Loading & Data
  const [data, setData] = useState<AdminAnalyticsPayload | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Race condition tracker
  const requestIdRef = useRef<number>(0);
  const dateDropdownRef = useRef<HTMLDivElement>(null);

  const presetLabels: Record<DatePreset, string> = {
    TODAY: 'Today',
    YESTERDAY: 'Yesterday',
    LAST_7_DAYS: 'Last 7 Days',
    LAST_30_DAYS: 'Last 30 Days',
    THIS_MONTH: 'This Month',
    CUSTOM: 'Custom Range',
  };

  // Close custom datepicker on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dateDropdownRef.current && !dateDropdownRef.current.contains(event.target as Node)) {
        setShowDatePicker(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch report data
  const loadReports = async (isManualRefresh = false) => {
    const currentReqId = ++requestIdRef.current;
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.append('preset', preset);
      if (preset === 'CUSTOM' && customStart && customEnd) {
        params.append('startDate', customStart);
        params.append('endDate', customEnd);
      }

      const response = await fetchWithAuth(`/report/admin/analytics?${params.toString()}`);
      if (currentReqId !== requestIdRef.current) return;

      if (!response) {
        throw new Error('No reporting data received from ERP server');
      }

      setData(response);
      if (isManualRefresh) {
        toast.success('Reports updated with latest ERP data');
      }
    } catch (err: any) {
      if (currentReqId !== requestIdRef.current) return;
      console.error('Failed to load admin analytics:', err);
      const msg = err.response?.data?.message || err.message || 'Failed to compile ERP reports';
      setError(msg);
      toast.error(msg);
    } finally {
      if (currentReqId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    loadReports(false);
  }, [preset]);

  const applyCustomRange = () => {
    if (!customStart || !customEnd) {
      toast.error('Please select both start and end dates');
      return;
    }
    if (new Date(customStart) > new Date(customEnd)) {
      toast.error('Start date cannot be after end date');
      return;
    }
    setShowDatePicker(false);
    setPreset('CUSTOM');
    loadReports(false);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // CSV EXPORT LOGIC
  // ─────────────────────────────────────────────────────────────────────────────

  const exportCurrentReport = () => {
    if (!data) return;

    let headers: string[] = [];
    let rows: string[][] = [];
    const dateTag = `${data.dateRange.preset}_${new Date().toISOString().slice(0, 10)}`;

    switch (activeTab) {
      case 'overview': {
        headers = ['Metric', 'Current Value', 'Previous Value', 'Percentage Change'];
        rows = Object.entries(data.overview.kpis).map(([key, item]) => [
          key.replace(/([A-Z])/g, ' $1').toUpperCase(),
          String(item.value ?? 0),
          String(item.prevValue ?? '—'),
          item.change !== undefined ? `${item.change > 0 ? '+' : ''}${item.change}%` : '—',
        ]);
        break;
      }
      case 'orders': {
        headers = ['Order ID', 'Date', 'Customer Name', 'Phone', 'Distributor', 'Driver', 'Items', 'Amount', 'Payment Status', 'Order Status'];
        rows = (data.orders.recentOrders || []).map((o) => [
          `#${o.id.slice(0, 8).toUpperCase()}`,
          new Date(o.date).toLocaleDateString(),
          `"${o.customerName}"`,
          `"${o.customerPhone}"`,
          `"${o.distributorName}"`,
          `"${o.driverName}"`,
          `"${o.itemsSummary}"`,
          `₹${o.amount}`,
          o.paymentStatus,
          o.orderStatus,
        ]);
        break;
      }
      case 'sales': {
        headers = ['Order ID', 'Customer Name', 'Total Amount', 'Paid Amount', 'Due Amount', 'Payment Method', 'Payment Status', 'Date'];
        rows = (data.sales.transactions || []).map((t) => [
          `#${t.orderId}`,
          `"${t.customerName}"`,
          `₹${t.amount}`,
          `₹${t.paid}`,
          `₹${t.due}`,
          t.paymentMethod,
          t.paymentStatus,
          new Date(t.date).toLocaleDateString(),
        ]);
        break;
      }
      case 'customers': {
        headers = ['Customer Name', 'Phone', 'Total Orders', 'Total Purchases', 'Deposit Paid', 'Deposit Due', 'Jars Held', 'Membership', 'Registered Date'];
        rows = (data.customers.customerList || []).map((c) => [
          `"${c.name}"`,
          `"${c.phone}"`,
          String(c.ordersCount),
          `₹${c.totalPurchases}`,
          `₹${c.depositPaid}`,
          `₹${c.depositDue}`,
          String(c.jarsAtCustomer),
          `"${c.membershipStatus}"`,
          new Date(c.createdAt).toLocaleDateString(),
        ]);
        break;
      }
      case 'distributors': {
        headers = ['Distributor Name', 'Agency / Area', 'Phone', 'Assigned Orders', 'Delivered Orders', 'Pending Orders', 'Cancelled Orders', 'Total Sales', 'Amount Collected', 'Outstanding Due', 'Delivery Performance %'];
        rows = (data.distributors.performanceList || []).map((d) => [
          `"${d.name}"`,
          `"${d.agencyName || '—'}"`,
          `"${d.phone}"`,
          String(d.assignedCount),
          String(d.deliveredCount),
          String(d.pendingCount),
          String(d.cancelledCount),
          `₹${d.sales}`,
          `₹${d.collected}`,
          `₹${d.outstanding}`,
          `${d.deliveryPerformance}%`,
        ]);
        break;
      }
      case 'drivers': {
        headers = ['Driver Name', 'Phone', 'Distributor', 'Vehicle Number', 'Vehicle Type', 'Assigned Deliveries', 'Delivered Orders', 'Pending Orders', 'Completion Rate %', 'Status'];
        rows = (data.drivers.performanceList || []).map((dr) => [
          `"${dr.name}"`,
          `"${dr.phone}"`,
          `"${dr.distributorName}"`,
          `"${dr.vehicleNumber}"`,
          `"${dr.vehicleType}"`,
          String(dr.assignedCount),
          String(dr.deliveredCount),
          String(dr.pendingCount),
          `${dr.completionRate}%`,
          dr.isActive ? 'Active' : 'Inactive',
        ]);
        break;
      }
      case 'products': {
        headers = ['Product Name', 'Category', 'Brand', 'Unit Price', 'Units Sold', 'Total Revenue', 'Orders Count', 'Current Stock'];
        rows = (data.products.performanceList || []).map((p) => [
          `"${p.name}"`,
          `"${p.category}"`,
          `"${p.brand}"`,
          `₹${p.price}`,
          String(p.unitsSold),
          `₹${p.revenue}`,
          String(p.ordersCount),
          String(p.stock),
        ]);
        break;
      }
      case 'memberships': {
        headers = ['Plan Name', 'Jars Count', 'Price', 'Customers Bought', 'Packages Sold', 'Total Revenue', 'Status'];
        rows = (data.memberships.performanceList || []).map((m) => [
          `"${m.name}"`,
          String(m.jarCount),
          `₹${m.price}`,
          String(m.customersCount),
          String(m.soldCount),
          `₹${m.revenue}`,
          m.status,
        ]);
        break;
      }
      case 'audit': {
        headers = ['Timestamp', 'User', 'Action', 'Entity', 'Previous State', 'New State', 'Details'];
        rows = (data.audit.activityList || []).map((a) => [
          new Date(a.timestamp).toLocaleString(),
          `"${a.user}"`,
          `"${a.action}"`,
          `"${a.entity}"`,
          `"${a.previousState}"`,
          `"${a.newState}"`,
          `"${a.details}"`,
        ]);
        break;
      }
    }

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Edrops_ERP_Report_${activeTab.toUpperCase()}_${dateTag}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${activeTab.toUpperCase()} report successfully`);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // TABS CONFIGURATION
  // ─────────────────────────────────────────────────────────────────────────────

  const tabsConfig = [
    { id: 'overview', label: 'Overview', icon: TrendingUp },
    { id: 'orders', label: 'Orders', icon: ShoppingCart },
    { id: 'sales', label: 'Sales & Payments', icon: CreditCard },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'distributors', label: 'Distributors', icon: Building2 },
    { id: 'drivers', label: 'Drivers & Delivery', icon: Truck },
    { id: 'products', label: 'Products & Inventory', icon: Package },
    { id: 'memberships', label: 'Memberships', icon: Layers },
    { id: 'audit', label: 'Audit & Activity', icon: Activity },
  ] as const;

  // Filtered recent orders
  const filteredOrders = useMemo(() => {
    if (!data?.orders.recentOrders) return [];
    return data.orders.recentOrders.filter((o) => {
      const matchesSearch =
        !searchQuery ||
        o.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.customerPhone.includes(searchQuery) ||
        o.distributorName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'ALL' || o.orderStatus === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [data?.orders.recentOrders, searchQuery, statusFilter]);

  // Filtered customers
  const filteredCustomers = useMemo(() => {
    if (!data?.customers.customerList) return [];
    return data.customers.customerList.filter((c) => {
      return (
        !searchQuery ||
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone.includes(searchQuery) ||
        c.membershipStatus.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  }, [data?.customers.customerList, searchQuery]);

  return (
    <div className="space-y-4 text-slate-800">
      {/* ─── 1. GLOBAL ERP REPORT HEADER ────────────────────────────── */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-[#1677C8]/10 text-[#1677C8]">
              <FileSpreadsheet className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-[#0F172A] tracking-tight">
                Reports & Analytics
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                Complete business, operations, customers, delivery and financial reporting
              </p>
            </div>
          </div>
        </div>

        {/* Global Toolbar: Date Selector + Refresh + Export */}
        <div className="flex items-center flex-wrap gap-2.5">
          {/* Global Date-Range Selector */}
          <div className="relative" ref={dateDropdownRef}>
            <button
              type="button"
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 shadow-2xs transition-colors cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5 text-[#1677C8]" />
              <span>{presetLabels[preset]}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {showDatePicker && (
              <div className="absolute right-0 mt-1 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl p-3 z-30 space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">
                  Preset Date Ranges
                </div>
                <div className="grid grid-cols-1 gap-1">
                  {(Object.keys(presetLabels) as DatePreset[]).map((key) => {
                    if (key === 'CUSTOM') return null;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          setPreset(key);
                          setShowDatePicker(false);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 text-xs rounded-lg font-medium transition-colors flex items-center justify-between cursor-pointer ${
                          preset === key
                            ? 'bg-[#1677C8] text-white font-bold'
                            : 'hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <span>{presetLabels[key]}</span>
                        {preset === key && <Check className="w-3.5 h-3.5" />}
                      </button>
                    );
                  })}
                </div>

                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">
                    Custom Date Range
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500">From</label>
                      <input
                        type="date"
                        value={customStart}
                        onChange={(e) => setCustomStart(e.target.value)}
                        className="w-full text-xs p-1.5 border border-slate-200 rounded-lg outline-none focus:border-[#1677C8]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500">To</label>
                      <input
                        type="date"
                        value={customEnd}
                        onChange={(e) => setCustomEnd(e.target.value)}
                        className="w-full text-xs p-1.5 border border-slate-200 rounded-lg outline-none focus:border-[#1677C8]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={applyCustomRange}
                      className="w-full mt-1 px-3 py-1.5 bg-[#1677C8] hover:bg-[#125ea0] text-white text-xs font-bold rounded-lg shadow-2xs transition-colors cursor-pointer"
                    >
                      Apply Custom Range
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => loadReports(true)}
            disabled={refreshing || loading}
            className="p-2 text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
            title="Refresh ERP Report Data"
          >
            <RotateCw className={`w-3.5 h-3.5 ${refreshing || loading ? 'animate-spin text-[#1677C8]' : ''}`} />
          </button>

          {/* Export Report CSV */}
          <button
            type="button"
            onClick={exportCurrentReport}
            disabled={loading || !data}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-2xs transition-all ${
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

      {/* ─── 2. ERP REPORTING NAVIGATION TABS ───────────────────────── */}
      <div className="bg-white p-1.5 rounded-2xl border border-slate-200/80 shadow-xs overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-1 min-w-max">
          {tabsConfig.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id as ReportTab);
                  setSearchQuery('');
                  setStatusFilter('ALL');
                }}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#1677C8] text-white shadow-sm'
                    : 'text-slate-600 hover:text-[#0F172A] hover:bg-slate-100/80'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── 3. TAB CONTENT AREA WITH IMMEDIATE LOADING & ERROR STATES ─ */}
      {error ? (
        <div className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
          <DataErrorState
            title="Unable to load reporting data"
            message={error}
            onRetry={() => loadReports(true)}
          />
        </div>
      ) : loading ? (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="bg-white p-8 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col items-center justify-center text-center">
            <EdropsPageLoader
              size="md"
              minHeight="min-h-[140px]"
              label={`Compiling ERP ${activeTab.toUpperCase()} report for ${presetLabels[preset]}...`}
            />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3 animate-pulse">
                <div className="h-3 w-20 bg-slate-200 rounded"></div>
                <div className="h-6 w-28 bg-slate-200 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      ) : !data ? null : (
        <div className="space-y-4">
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* TAB 1: OVERVIEW DASHBOARD                                         */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* 12 KPI Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {/* Total Orders */}
                <KPICard
                  title="Total Orders"
                  value={data.overview.kpis.totalOrders.value.toLocaleString()}
                  change={data.overview.kpis.totalOrders.change}
                  subtext="Orders in period"
                  icon={ShoppingCart}
                  color="blue"
                />

                {/* Orders Today */}
                <KPICard
                  title="Orders Today"
                  value={data.overview.kpis.ordersToday.value.toLocaleString()}
                  subtext="Active today"
                  icon={Clock}
                  color="sky"
                />

                {/* Pending Orders */}
                <KPICard
                  title="Pending Orders"
                  value={data.overview.kpis.pendingOrders.value.toLocaleString()}
                  subtext="Awaiting delivery"
                  icon={AlertCircle}
                  color="amber"
                />

                {/* Delivered Orders */}
                <KPICard
                  title="Delivered Orders"
                  value={data.overview.kpis.deliveredOrders.value.toLocaleString()}
                  change={data.overview.kpis.deliveredOrders.change}
                  subtext="Fulfilled orders"
                  icon={CheckCircle2}
                  color="emerald"
                />

                {/* Cancelled Orders */}
                <KPICard
                  title="Cancelled Orders"
                  value={data.overview.kpis.cancelledOrders.value.toLocaleString()}
                  subtext="Rejections/Cancels"
                  icon={XCircle}
                  color="rose"
                />

                {/* Total Sales */}
                <KPICard
                  title="Total Sales"
                  value={`₹${data.overview.kpis.totalSales.value.toLocaleString('en-IN')}`}
                  change={data.overview.kpis.totalSales.change}
                  subtext="Gross ERP volume"
                  icon={TrendingUp}
                  color="indigo"
                />

                {/* Amount Collected */}
                <KPICard
                  title="Amount Collected"
                  value={`₹${data.overview.kpis.amountCollected.value.toLocaleString('en-IN')}`}
                  subtext="Cash & online received"
                  icon={Receipt}
                  color="emerald"
                />

                {/* Outstanding Due */}
                <KPICard
                  title="Outstanding Due"
                  value={`₹${data.overview.kpis.outstandingAmount.value.toLocaleString('en-IN')}`}
                  subtext="Unpaid balance"
                  icon={CreditCard}
                  color="amber"
                />

                {/* Active Customers */}
                <KPICard
                  title="Active Customers"
                  value={data.overview.kpis.activeCustomers.value.toLocaleString()}
                  subtext={`Out of ${data.overview.kpis.activeCustomers.total || 0}`}
                  icon={Users}
                  color="cyan"
                />

                {/* Active Distributors */}
                <KPICard
                  title="Active Distributors"
                  value={data.overview.kpis.activeDistributors.value.toLocaleString()}
                  subtext={`Out of ${data.overview.kpis.activeDistributors.total || 0}`}
                  icon={Building2}
                  color="violet"
                />

                {/* Active Drivers */}
                <KPICard
                  title="Active Drivers"
                  value={data.overview.kpis.activeDrivers.value.toLocaleString()}
                  subtext={`Out of ${data.overview.kpis.activeDrivers.total || 0}`}
                  icon={Truck}
                  color="blue"
                />

                {/* Memberships Sold */}
                <KPICard
                  title="Memberships Sold"
                  value={data.overview.kpis.membershipsSold.value.toLocaleString()}
                  change={data.overview.kpis.membershipsSold.change}
                  subtext="Prepaid plans bought"
                  icon={Layers}
                  color="emerald"
                />
              </div>

              {/* Sales & Orders Daily Trend Visualization */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-[#1677C8]" /> Sales & Order Volume Over Time
                    </h3>
                    <p className="text-xs text-slate-500">
                      Daily breakdown across {presetLabels[preset]}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-semibold text-slate-600">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#1677C8]"></span> Total Sales (₹)
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Orders Count
                    </span>
                  </div>
                </div>

                {data.overview.salesTimeSeries.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400">
                    No time-series data available for this range.
                  </div>
                ) : (
                  <div className="pt-2">
                    {/* SVG Bar Chart */}
                    <div className="h-56 w-full flex items-end gap-1.5 sm:gap-2 px-1 pb-4">
                      {(() => {
                        const maxSales = Math.max(1, ...data.overview.salesTimeSeries.map((s) => s.totalSales));
                        return data.overview.salesTimeSeries.map((pt, idx) => {
                          const heightPct = Math.max(8, Math.round((pt.totalSales / maxSales) * 100));
                          return (
                            <div
                              key={idx}
                              className="flex-1 flex flex-col items-center gap-1.5 group relative h-full justify-end"
                            >
                              {/* Hover Tooltip */}
                              <div className="absolute -top-12 z-20 hidden group-hover:flex flex-col items-center bg-slate-900 text-white text-[10px] px-2 py-1 rounded-md shadow-lg pointer-events-none whitespace-nowrap">
                                <span className="font-bold">{pt.label}</span>
                                <span>₹{pt.totalSales.toLocaleString('en-IN')} · {pt.orderCount} orders</span>
                              </div>

                              {/* Bar */}
                              <div
                                style={{ height: `${heightPct}%` }}
                                className="w-full bg-[#1677C8]/80 hover:bg-[#1677C8] rounded-t-md transition-all relative flex flex-col justify-between p-0.5"
                              >
                                {pt.orderCount > 0 && (
                                  <span className="text-[9px] text-white/90 font-bold self-center hidden sm:inline">
                                    {pt.orderCount}
                                  </span>
                                )}
                              </div>
                              <span className="text-[9px] text-slate-400 font-medium truncate max-w-full">
                                {pt.label}
                              </span>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* TAB 2: ORDERS REPORT                                              */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'orders' && (
            <div className="space-y-4">
              {/* Order Status Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
                <StatusCountBadge label="Total" count={data.orders.kpis.total} color="slate" />
                <StatusCountBadge label="New / Placed" count={data.orders.kpis.newPlaced} color="blue" />
                <StatusCountBadge label="Confirmed" count={data.orders.kpis.confirmed} color="sky" />
                <StatusCountBadge label="Assigned" count={data.orders.kpis.assigned} color="indigo" />
                <StatusCountBadge label="Out for Delivery" count={data.orders.kpis.outForDelivery} color="amber" />
                <StatusCountBadge label="Delivered" count={data.orders.kpis.delivered} color="emerald" />
                <StatusCountBadge label="Cancelled" count={data.orders.kpis.cancelled} color="rose" />
                <StatusCountBadge label="Pending" count={data.orders.kpis.pending} color="purple" />
              </div>

              {/* Order Performance Highlights */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Average Order Value (AOV)</p>
                    <p className="text-2xl font-black text-[#0F172A] mt-1">₹{data.orders.kpis.averageOrderValue.toLocaleString('en-IN')}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Calculated across fulfilled orders</p>
                  </div>
                  <div className="p-3 bg-blue-50 text-[#1677C8] rounded-xl">
                    <CreditCard className="w-6 h-6" />
                  </div>
                </div>

                <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Delivery Completion Rate</p>
                    <p className="text-2xl font-black text-emerald-600 mt-1">{data.orders.kpis.deliveryCompletionRate}%</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Fulfilled vs total order demand</p>
                  </div>
                  <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                </div>
              </div>

              {/* Detailed Orders Table */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4 text-[#1677C8]" />
                    <h3 className="text-sm font-bold text-[#0F172A]">Detailed Order Records ({filteredOrders.length})</h3>
                  </div>

                  {/* Filters: Search & Status */}
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        placeholder="Search ID, customer, distributor..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#1677C8] w-48 sm:w-60"
                      />
                    </div>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#1677C8] cursor-pointer"
                    >
                      <option value="ALL">All Statuses</option>
                      <option value="NEW">New</option>
                      <option value="CONFIRMED">Confirmed</option>
                      <option value="ASSIGNED">Assigned</option>
                      <option value="OUT_FOR_DELIVERY">Out for Delivery</option>
                      <option value="DELIVERED">Delivered</option>
                      <option value="CANCELLED">Cancelled</option>
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/80 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200/80">
                      <tr>
                        <th className="py-2.5 px-3">Order ID</th>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Customer</th>
                        <th className="py-2.5 px-3">Distributor</th>
                        <th className="py-2.5 px-3">Driver</th>
                        <th className="py-2.5 px-3">Items</th>
                        <th className="py-2.5 px-3">Amount</th>
                        <th className="py-2.5 px-3">Payment</th>
                        <th className="py-2.5 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {filteredOrders.map((o) => (
                        <tr key={o.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2.5 px-3 font-bold text-[#1677C8]">#{o.id.slice(0, 8).toUpperCase()}</td>
                          <td className="py-2.5 px-3 text-slate-500">{new Date(o.date).toLocaleDateString()}</td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800">
                            <div>{o.customerName}</div>
                            <div className="text-[10px] text-slate-400">{o.customerPhone}</div>
                          </td>
                          <td className="py-2.5 px-3 text-slate-700">{o.distributorName}</td>
                          <td className="py-2.5 px-3 text-slate-700">{o.driverName}</td>
                          <td className="py-2.5 px-3 text-slate-600 max-w-[200px] truncate" title={o.itemsSummary}>
                            {o.itemsSummary}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-[#0F172A]">₹{o.amount.toLocaleString('en-IN')}</td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                o.paymentStatus === 'PAID'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {o.paymentStatus}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                o.orderStatus === 'DELIVERED'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : o.orderStatus === 'CANCELLED'
                                  ? 'bg-rose-50 text-rose-700'
                                  : 'bg-blue-50 text-blue-700'
                              }`}
                            >
                              {o.orderStatus}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {filteredOrders.length === 0 && (
                        <tr>
                          <td colSpan={9} className="text-center py-8 text-slate-400 italic">
                            No orders found matching the filter criteria.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* TAB 3: SALES & PAYMENTS                                           */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'sales' && (
            <div className="space-y-4">
              {/* Financial KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <KPICard title="Gross Sales" value={`₹${data.sales.kpis.grossSales.toLocaleString('en-IN')}`} subtext="Orders + Memberships" icon={TrendingUp} color="indigo" />
                <KPICard title="Paid Amount" value={`₹${data.sales.kpis.paidAmount.toLocaleString('en-IN')}`} subtext="Payments cleared" icon={CheckCircle2} color="emerald" />
                <KPICard title="Pending / Due" value={`₹${data.sales.kpis.pendingAmount.toLocaleString('en-IN')}`} subtext="Receivables" icon={AlertCircle} color="amber" />
                <KPICard title="Cash Collected" value={`₹${data.sales.kpis.cashCollected.toLocaleString('en-IN')}`} subtext="Handover collections" icon={Receipt} color="blue" />
                <KPICard title="Online Payments" value={`₹${data.sales.kpis.onlinePayments.toLocaleString('en-IN')}`} subtext="UPI / Gateway" icon={CreditCard} color="sky" />
                <KPICard title="Refunds / Returns" value={`₹${data.sales.kpis.refunds.toLocaleString('en-IN')}`} subtext="Reversals logged" icon={RotateCw} color="slate" />
              </div>

              {/* Payment Methods Breakdown & Top Product Sales */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Payment Methods */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
                  <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-[#1677C8]" /> Payment Methods Split
                  </h3>
                  <div className="space-y-2">
                    {data.sales.paymentMethods.map((pm, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 rounded-xl flex items-center justify-between text-xs">
                        <div>
                          <span className="font-bold text-slate-800">{pm.method}</span>
                          <span className="text-slate-400 ml-2">({pm.count} txns)</span>
                        </div>
                        <span className="font-bold text-[#0F172A]">₹{pm.amount.toLocaleString('en-IN')}</span>
                      </div>
                    ))}
                    {data.sales.paymentMethods.length === 0 && (
                      <div className="text-center py-6 text-xs text-slate-400 italic">No payments logged in range.</div>
                    )}
                  </div>
                </div>

                {/* Sales by Top Products */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
                  <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                    <Package className="w-4 h-4 text-[#1677C8]" /> Top Products by Revenue
                  </h3>
                  <div className="space-y-2">
                    {data.sales.salesByProduct.slice(0, 5).map((sp) => (
                      <div key={sp.id} className="p-3 bg-slate-50 rounded-xl flex items-center justify-between text-xs">
                        <div>
                          <span className="font-bold text-slate-800">{sp.name}</span>
                          <span className="text-slate-400 ml-2">({sp.unitsSold} units)</span>
                        </div>
                        <span className="font-bold text-emerald-600">₹{sp.revenue.toLocaleString('en-IN')}</span>
                      </div>
                    ))}
                    {data.sales.salesByProduct.length === 0 && (
                      <div className="text-center py-6 text-xs text-slate-400 italic">No product sales in range.</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Transactions Ledger Table */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[#0F172A]">Payment & Revenue Ledger ({data.sales.transactions.length})</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/80 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200/80">
                      <tr>
                        <th className="py-2.5 px-3">Order / Txn ID</th>
                        <th className="py-2.5 px-3">Customer</th>
                        <th className="py-2.5 px-3">Order Amount</th>
                        <th className="py-2.5 px-3">Paid</th>
                        <th className="py-2.5 px-3">Due</th>
                        <th className="py-2.5 px-3">Method</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {data.sales.transactions.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-50/60">
                          <td className="py-2.5 px-3 font-bold text-[#1677C8]">#{t.orderId}</td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800">{t.customerName}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">₹{t.amount.toLocaleString('en-IN')}</td>
                          <td className="py-2.5 px-3 font-bold text-emerald-600">₹{t.paid.toLocaleString('en-IN')}</td>
                          <td className="py-2.5 px-3 font-bold text-amber-600">₹{t.due.toLocaleString('en-IN')}</td>
                          <td className="py-2.5 px-3 text-slate-600">{t.paymentMethod}</td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                              {t.paymentStatus}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-500">{new Date(t.date).toLocaleDateString()}</td>
                        </tr>
                      ))}
                      {data.sales.transactions.length === 0 && (
                        <tr>
                          <td colSpan={8} className="text-center py-6 text-slate-400 italic">No transactions recorded.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* TAB 4: CUSTOMERS REPORT                                           */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'customers' && (
            <div className="space-y-4">
              {/* Customer KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <KPICard title="Total Customers" value={data.customers.kpis.total.toLocaleString()} subtext="All time registered" icon={Users} color="blue" />
                <KPICard title="Active Customers" value={data.customers.kpis.active.toLocaleString()} subtext="Active accounts" icon={CheckCircle2} color="emerald" />
                <KPICard title="New Customers" value={data.customers.kpis.newInRange.toLocaleString()} subtext="Joined in period" icon={TrendingUp} color="sky" />
                <KPICard title="Customers with Orders" value={data.customers.kpis.withOrders.toLocaleString()} subtext="Placed orders in range" icon={ShoppingCart} color="indigo" />
                <KPICard title="Outstanding Due" value={data.customers.kpis.withOutstanding.toLocaleString()} subtext="Customers with due" icon={AlertCircle} color="amber" />
                <KPICard title="Prepaid Memberships" value={data.customers.kpis.membershipCustomers.toLocaleString()} subtext="Active plan members" icon={Layers} color="violet" />
              </div>

              {/* Customers Table */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h3 className="text-sm font-bold text-[#0F172A]">Customer Records & Ledger ({filteredCustomers.length})</h3>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search customer by name, phone..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#1677C8] w-64"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/80 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200/80">
                      <tr>
                        <th className="py-2.5 px-3">Customer</th>
                        <th className="py-2.5 px-3">Phone</th>
                        <th className="py-2.5 px-3">Orders</th>
                        <th className="py-2.5 px-3">Purchases Total</th>
                        <th className="py-2.5 px-3">Deposit Paid</th>
                        <th className="py-2.5 px-3">Deposit Due</th>
                        <th className="py-2.5 px-3">Jars Held</th>
                        <th className="py-2.5 px-3">Membership</th>
                        <th className="py-2.5 px-3">Member Since</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {filteredCustomers.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50/60">
                          <td className="py-2.5 px-3 font-bold text-slate-800">{c.name}</td>
                          <td className="py-2.5 px-3 text-slate-500">{c.phone || '—'}</td>
                          <td className="py-2.5 px-3 font-semibold text-[#1677C8]">{c.ordersCount}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">₹{c.totalPurchases.toLocaleString('en-IN')}</td>
                          <td className="py-2.5 px-3 font-semibold text-emerald-600">₹{c.depositPaid.toLocaleString('en-IN')}</td>
                          <td className="py-2.5 px-3 font-semibold text-amber-600">₹{c.depositDue.toLocaleString('en-IN')}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-700">{c.jarsAtCustomer} Jars</td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700">
                              {c.membershipStatus}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-400">{new Date(c.createdAt).toLocaleDateString()}</td>
                        </tr>
                      ))}
                      {filteredCustomers.length === 0 && (
                        <tr>
                          <td colSpan={9} className="text-center py-6 text-slate-400 italic">No customers found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* TAB 5: DISTRIBUTOR REPORTS                                        */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'distributors' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                <KPICard title="Total Distributors" value={data.distributors.kpis.total.toLocaleString()} icon={Building2} color="blue" />
                <KPICard title="Active Agencies" value={data.distributors.kpis.active.toLocaleString()} icon={CheckCircle2} color="emerald" />
                <KPICard title="Assigned Orders" value={data.distributors.kpis.assignedOrders.toLocaleString()} icon={ShoppingCart} color="indigo" />
                <KPICard title="Delivered Orders" value={data.distributors.kpis.deliveredOrders.toLocaleString()} icon={Truck} color="emerald" />
                <KPICard title="Pending Orders" value={data.distributors.kpis.pendingOrders.toLocaleString()} icon={Clock} color="amber" />
                <KPICard title="Cancelled" value={data.distributors.kpis.cancelledOrders.toLocaleString()} icon={XCircle} color="rose" />
                <KPICard title="Revenue Handled" value={`₹${data.distributors.kpis.revenueHandled.toLocaleString('en-IN')}`} icon={TrendingUp} color="violet" />
              </div>

              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-[#0F172A]">Distributor Performance & Fulfillment</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/80 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200/80">
                      <tr>
                        <th className="py-2.5 px-3">Distributor</th>
                        <th className="py-2.5 px-3">Area / Agency</th>
                        <th className="py-2.5 px-3">Phone</th>
                        <th className="py-2.5 px-3">Assigned</th>
                        <th className="py-2.5 px-3">Delivered</th>
                        <th className="py-2.5 px-3">Pending</th>
                        <th className="py-2.5 px-3">Cancelled</th>
                        <th className="py-2.5 px-3">Sales</th>
                        <th className="py-2.5 px-3">Collected</th>
                        <th className="py-2.5 px-3">Outstanding</th>
                        <th className="py-2.5 px-3">Completion Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {data.distributors.performanceList.map((d) => (
                        <tr key={d.id} className="hover:bg-slate-50/60">
                          <td className="py-2.5 px-3 font-bold text-slate-800">{d.name}</td>
                          <td className="py-2.5 px-3 text-slate-600">{d.agencyName || '—'}</td>
                          <td className="py-2.5 px-3 text-slate-500">{d.phone}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">{d.assignedCount}</td>
                          <td className="py-2.5 px-3 font-bold text-emerald-600">{d.deliveredCount}</td>
                          <td className="py-2.5 px-3 font-bold text-amber-600">{d.pendingCount}</td>
                          <td className="py-2.5 px-3 font-bold text-rose-600">{d.cancelledCount}</td>
                          <td className="py-2.5 px-3 font-bold text-[#1677C8]">₹{d.sales.toLocaleString('en-IN')}</td>
                          <td className="py-2.5 px-3 font-bold text-emerald-600">₹{d.collected.toLocaleString('en-IN')}</td>
                          <td className="py-2.5 px-3 font-bold text-amber-600">₹{d.outstanding.toLocaleString('en-IN')}</td>
                          <td className="py-2.5 px-3">
                            <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                              {d.deliveryPerformance}%
                            </span>
                          </td>
                        </tr>
                      ))}
                      {data.distributors.performanceList.length === 0 && (
                        <tr>
                          <td colSpan={11} className="text-center py-6 text-slate-400 italic">No distributors recorded.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* TAB 6: DRIVERS & DELIVERY                                         */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'drivers' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                <KPICard title="Total Drivers" value={data.drivers.kpis.total.toLocaleString()} icon={Truck} color="blue" />
                <KPICard title="Active Drivers" value={data.drivers.kpis.active.toLocaleString()} icon={CheckCircle2} color="emerald" />
                <KPICard title="Assigned Deliveries" value={data.drivers.kpis.assignedDeliveries.toLocaleString()} icon={Package} color="indigo" />
                <KPICard title="Out for Delivery" value={data.drivers.kpis.outForDelivery.toLocaleString()} icon={Clock} color="amber" />
                <KPICard title="Delivered Orders" value={data.drivers.kpis.delivered.toLocaleString()} icon={CheckCircle2} color="emerald" />
                <KPICard title="Cancelled" value={data.drivers.kpis.failedCancelled.toLocaleString()} icon={XCircle} color="rose" />
                <KPICard title="Completion Rate" value={`${data.drivers.kpis.deliveryCompletionRate}%`} icon={TrendingUp} color="violet" />
              </div>

              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-[#0F172A]">Delivery Fleet Performance</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/80 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200/80">
                      <tr>
                        <th className="py-2.5 px-3">Driver Name</th>
                        <th className="py-2.5 px-3">Phone</th>
                        <th className="py-2.5 px-3">Distributor</th>
                        <th className="py-2.5 px-3">Vehicle</th>
                        <th className="py-2.5 px-3">Assigned</th>
                        <th className="py-2.5 px-3">Delivered</th>
                        <th className="py-2.5 px-3">Pending</th>
                        <th className="py-2.5 px-3">Completion Rate</th>
                        <th className="py-2.5 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {data.drivers.performanceList.map((dr) => (
                        <tr key={dr.id} className="hover:bg-slate-50/60">
                          <td className="py-2.5 px-3 font-bold text-slate-800">{dr.name}</td>
                          <td className="py-2.5 px-3 text-slate-500">{dr.phone}</td>
                          <td className="py-2.5 px-3 font-medium text-slate-700">{dr.distributorName}</td>
                          <td className="py-2.5 px-3 text-slate-600">
                            {dr.vehicleType} · {dr.vehicleNumber}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">{dr.assignedCount}</td>
                          <td className="py-2.5 px-3 font-bold text-emerald-600">{dr.deliveredCount}</td>
                          <td className="py-2.5 px-3 font-bold text-amber-600">{dr.pendingCount}</td>
                          <td className="py-2.5 px-3 font-bold text-emerald-700">{dr.completionRate}%</td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                dr.isActive
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {dr.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {data.drivers.performanceList.length === 0 && (
                        <tr>
                          <td colSpan={9} className="text-center py-6 text-slate-400 italic">No drivers found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* TAB 7: PRODUCTS & INVENTORY                                       */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'products' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <KPICard title="Total Products" value={data.products.kpis.totalProducts.toLocaleString()} icon={Package} color="blue" />
                <KPICard title="Active Categories" value={data.products.kpis.activeCategories.toLocaleString()} icon={Layers} color="indigo" />
                <KPICard title="Active Brands" value={data.products.kpis.activeBrands.toLocaleString()} icon={Building2} color="violet" />
                <KPICard title="Total Units Sold" value={data.products.kpis.totalUnitsSold.toLocaleString()} icon={ShoppingCart} color="emerald" />
                <KPICard title="Product Revenue" value={`₹${data.products.kpis.totalRevenue.toLocaleString('en-IN')}`} icon={TrendingUp} color="sky" />
              </div>

              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-[#0F172A]">Product Catalog Sales & Stock Ledger</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/80 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200/80">
                      <tr>
                        <th className="py-2.5 px-3">Product Name</th>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3">Brand</th>
                        <th className="py-2.5 px-3">Price</th>
                        <th className="py-2.5 px-3">Units Sold</th>
                        <th className="py-2.5 px-3">Total Revenue</th>
                        <th className="py-2.5 px-3">Orders Count</th>
                        <th className="py-2.5 px-3">Stock Available</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {data.products.performanceList.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50/60">
                          <td className="py-2.5 px-3 font-bold text-slate-800">{p.name}</td>
                          <td className="py-2.5 px-3 text-slate-600">{p.category}</td>
                          <td className="py-2.5 px-3 text-slate-600">{p.brand}</td>
                          <td className="py-2.5 px-3 font-semibold text-slate-900">₹{p.price}</td>
                          <td className="py-2.5 px-3 font-bold text-[#1677C8]">{p.unitsSold}</td>
                          <td className="py-2.5 px-3 font-bold text-emerald-600">₹{p.revenue.toLocaleString('en-IN')}</td>
                          <td className="py-2.5 px-3 text-slate-600">{p.ordersCount}</td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                p.stock > 10
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : p.stock > 0
                                  ? 'bg-amber-50 text-amber-700'
                                  : 'bg-rose-50 text-rose-700'
                              }`}
                            >
                              {p.stock} units
                            </span>
                          </td>
                        </tr>
                      ))}
                      {data.products.performanceList.length === 0 && (
                        <tr>
                          <td colSpan={8} className="text-center py-6 text-slate-400 italic">No products found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* TAB 8: MEMBERSHIP REPORTS                                         */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'memberships' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <KPICard title="Plans Offered" value={data.memberships.kpis.totalPlans.toLocaleString()} icon={Layers} color="indigo" />
                <KPICard title="Packages Sold" value={data.memberships.kpis.plansSold.toLocaleString()} icon={ShoppingCart} color="blue" />
                <KPICard title="Jars Volume Sold" value={`${data.memberships.kpis.jarsVolumeSold.toLocaleString()} Jars`} icon={Package} color="cyan" />
                <KPICard title="Membership Sales" value={`₹${data.memberships.kpis.revenue.toLocaleString('en-IN')}`} icon={TrendingUp} color="emerald" />
                <KPICard title="Active Subscribers" value={data.memberships.kpis.activeMemberships.toLocaleString()} icon={Users} color="violet" />
              </div>

              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-[#0F172A]">Prepaid Plans Performance & Revenue</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/80 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200/80">
                      <tr>
                        <th className="py-2.5 px-3">Plan Name</th>
                        <th className="py-2.5 px-3">Jars Volume</th>
                        <th className="py-2.5 px-3">Price</th>
                        <th className="py-2.5 px-3">Customers Bought</th>
                        <th className="py-2.5 px-3">Total Sold</th>
                        <th className="py-2.5 px-3">Total Revenue</th>
                        <th className="py-2.5 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {data.memberships.performanceList.map((m) => (
                        <tr key={m.id} className="hover:bg-slate-50/60">
                          <td className="py-2.5 px-3 font-bold text-slate-800">
                            <span className="flex items-center gap-1.5">
                              {m.name}
                              {m.badge && (
                                <span className="text-[9px] bg-sky-50 text-sky-700 px-1.5 py-0.2 rounded font-bold">
                                  {m.badge}
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-700">{m.jarCount} Jars</td>
                          <td className="py-2.5 px-3 font-semibold text-slate-900">₹{m.price}</td>
                          <td className="py-2.5 px-3 font-bold text-[#1677C8]">{m.customersCount}</td>
                          <td className="py-2.5 px-3 font-bold text-indigo-600">{m.soldCount}</td>
                          <td className="py-2.5 px-3 font-bold text-emerald-600">₹{m.revenue.toLocaleString('en-IN')}</td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                              {m.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {data.memberships.performanceList.length === 0 && (
                        <tr>
                          <td colSpan={7} className="text-center py-6 text-slate-400 italic">No prepaid packages configured.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* TAB 9: AUDIT & ACTIVITY                                           */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'audit' && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                      <Activity className="w-4 h-4 text-[#1677C8]" /> Real-Time ERP Audit Trail
                    </h3>
                    <p className="text-xs text-slate-500">Order lifecycle state transitions and administrative actions</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/80 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200/80">
                      <tr>
                        <th className="py-2.5 px-3">Timestamp</th>
                        <th className="py-2.5 px-3">User / Actor</th>
                        <th className="py-2.5 px-3">Action</th>
                        <th className="py-2.5 px-3">Entity</th>
                        <th className="py-2.5 px-3">Previous State</th>
                        <th className="py-2.5 px-3">New State</th>
                        <th className="py-2.5 px-3">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {data.audit.activityList.map((a) => (
                        <tr key={a.id} className="hover:bg-slate-50/60">
                          <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">
                            {new Date(a.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800">{a.user}</td>
                          <td className="py-2.5 px-3 font-bold text-[#1677C8]">{a.action}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-700">{a.entity}</td>
                          <td className="py-2.5 px-3 text-slate-500">{a.previousState}</td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800">
                              {a.newState}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 max-w-[250px] truncate" title={a.details}>
                            {a.details}
                          </td>
                        </tr>
                      ))}
                      {data.audit.activityList.length === 0 && (
                        <tr>
                          <td colSpan={7} className="text-center py-6 text-slate-400 italic">No activity logged in range.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// REUSABLE SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

interface KPICardProps {
  title: string;
  value: string;
  change?: number;
  subtext?: string;
  icon: any;
  color: 'blue' | 'indigo' | 'emerald' | 'amber' | 'rose' | 'sky' | 'cyan' | 'violet' | 'slate';
}

function KPICard({ title, value, change, subtext, icon: Icon, color }: KPICardProps) {
  const colorMap = {
    blue: 'bg-blue-50 text-[#1677C8]',
    indigo: 'bg-indigo-50 text-indigo-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
    sky: 'bg-sky-50 text-sky-600',
    cyan: 'bg-cyan-50 text-cyan-600',
    violet: 'bg-violet-50 text-violet-600',
    slate: 'bg-slate-100 text-slate-600',
  };

  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-2 hover:border-slate-300 transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">
          {title}
        </span>
        <div className={`p-2 rounded-xl shrink-0 ${colorMap[color] || colorMap.blue}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>

      <div>
        <p className="text-xl sm:text-2xl font-black text-[#0F172A] tracking-tight">{value}</p>
        <div className="flex items-center justify-between text-[11px] mt-1 text-slate-400">
          <span>{subtext}</span>
          {change !== undefined && (
            <span
              className={`font-bold flex items-center text-[10px] px-1.5 py-0.2 rounded ${
                change > 0
                  ? 'text-emerald-700 bg-emerald-50'
                  : change < 0
                  ? 'text-rose-700 bg-rose-50'
                  : 'text-slate-500 bg-slate-100'
              }`}
            >
              {change > 0 ? (
                <ArrowUpRight className="w-3 h-3 inline" />
              ) : change < 0 ? (
                <ArrowDownRight className="w-3 h-3 inline" />
              ) : null}
              {change > 0 ? `+${change}%` : `${change}%`}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusCountBadge({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    slate: 'text-slate-700',
    blue: 'text-blue-600',
    sky: 'text-sky-600',
    indigo: 'text-indigo-600',
    amber: 'text-amber-600',
    emerald: 'text-emerald-600',
    rose: 'text-rose-600',
    purple: 'text-purple-600',
  };

  return (
    <div className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-xs text-center space-y-1">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">
        {label}
      </span>
      <span className={`text-lg font-black ${colorMap[color] || 'text-[#0F172A]'}`}>
        {count.toLocaleString()}
      </span>
    </div>
  );
}
