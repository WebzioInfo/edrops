import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Search,
  Plus,
  RefreshCw,
  Calendar,
  Package,
  X,
  Edit2,
  Trash2,
  Tag,
  Building2,
} from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { DataErrorState } from '../../../components/common/DataErrorState';

export default function CustomerManagement() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCust, setSelectedCust] = useState<any | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'RESIDENTIAL' | 'COMMERCIAL'>('ALL');

  // Edit Schedule Modal state
  const [editingSchedule, setEditingSchedule] = useState(false);
  const [rules, setRules] = useState<any[]>([]);
  const [isScheduleActive, setIsScheduleActive] = useState(true);

  const loadCustomers = async () => {
    try {
      setError(null);
      setLoading(true);
      const data = await fetchWithAuth('/customer');
      setCustomers(data || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load customers');
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const viewDetails = async (cust: any) => {
    setIsDrawerOpen(true);
    try {
      setDrawerLoading(true);
      const detailed = await fetchWithAuth(`/customer/${cust.id}`);
      setSelectedCust(detailed || cust);
      setRules(detailed?.deliverySchedule?.rules || []);
      setIsScheduleActive(detailed?.deliverySchedule?.isActive ?? true);
    } catch {
      toast.error('Failed to load full customer details');
      setSelectedCust(cust);
    } finally {
      setDrawerLoading(false);
    }
  };

  const handleUpdateSchedule = async () => {
    if (!selectedCust) return;
    try {
      await fetchWithAuth(`/schedule/${selectedCust.id}`, {
        method: 'POST',
        body: JSON.stringify({
          isActive: isScheduleActive,
          rules: rules.map((r) => ({
            type: r.type,
            dayOfWeek: r.dayOfWeek,
            quantity: r.quantity,
            intervalDays: r.intervalDays,
            customNotes: r.customNotes,
          })),
        }),
      });
      toast.success('Customer delivery schedule updated successfully');
      setEditingSchedule(false);
      viewDetails(selectedCust);
      loadCustomers();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update schedule');
    }
  };

  const addRule = () => {
    setRules([...rules, { type: 'WEEKLY', dayOfWeek: 1, quantity: 2, intervalDays: 1 }]);
  };

  const removeRule = (idx: number) => {
    setRules(rules.filter((_, i) => i !== idx));
  };

  const updateRuleField = (idx: number, field: string, val: any) => {
    const updated = [...rules];
    updated[idx] = { ...updated[idx], [field]: val };
    setRules(updated);
  };

  // Filtered customers
  const filteredCustomers = useMemo(() => {
    const term = search.toLowerCase().trim();
    return customers.filter((c: any) => {
      const name = `${c.user?.firstName || ''} ${c.user?.lastName || ''}`.toLowerCase();
      const phone = c.user?.phone || '';
      const email = (c.user?.email || '').toLowerCase();
      const company = (c.companyName || '').toLowerCase();
      const id = (c.id || '').toLowerCase();

      const matchesSearch =
        !term ||
        name.includes(term) ||
        phone.includes(term) ||
        email.includes(term) ||
        company.includes(term) ||
        id.includes(term);

      if (!matchesSearch) return false;

      if (statusFilter === 'ACTIVE' && c.user?.isActive === false) return false;
      if (statusFilter === 'INACTIVE' && c.user?.isActive !== false) return false;

      if (typeFilter !== 'ALL') {
        const cType = (c.customerType || 'RESIDENTIAL').toUpperCase();
        if (cType !== typeFilter) return false;
      }

      return true;
    });
  }, [customers, search, statusFilter, typeFilter]);

  // Derived real summary statistics
  const summaryMetrics = useMemo(() => {
    const total = customers.length;
    const active = customers.filter((c) => c.user?.isActive !== false).length;
    const totalPrepaidBalance = customers.reduce(
      (sum, c) => sum + (Number(c.wallet?.balance) || 0),
      0,
    );
    const totalDepositPaid = customers.reduce(
      (sum, c) => sum + (Number(c.jarDeposits?.[0]?.depositPaid) || 0),
      0,
    );
    const totalDepositDue = customers.reduce(
      (sum, c) => sum + (Number(c.jarDeposits?.[0]?.depositDue) || 0),
      0,
    );

    return {
      total,
      active,
      totalPrepaidBalance,
      totalDepositPaid,
      totalDepositDue,
    };
  }, [customers]);

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* ─── 1. COMPACT TOOLBAR (SEARCH + FILTERS + ACTIONS) ────────── */}
      <div className="bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-1 flex-wrap items-center gap-2 min-w-[240px]">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px] sm:min-w-[260px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search customers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none focus:border-[#1677C8] focus:bg-white transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-[#1677C8]"
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>

          {/* Customer Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-[#1677C8]"
          >
            <option value="ALL">All Types</option>
            <option value="RESIDENTIAL">Residential</option>
            <option value="COMMERCIAL">Commercial</option>
          </select>

          {(search || statusFilter !== 'ALL' || typeFilter !== 'ALL') && (
            <button
              onClick={() => {
                setSearch('');
                setStatusFilter('ALL');
                setTypeFilter('ALL');
              }}
              className="text-xs font-bold text-[#1677C8] hover:underline px-1.5 py-1 cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={loadCustomers}
            disabled={loading}
            title="Refresh Directory"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 transition shadow-2xs disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#1677C8]' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/staff/customers/add')}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-[#1677C8] hover:bg-[#125ea0] text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Customer</span>
          </button>
        </div>
      </div>

      {/* ─── 2. COMPACT SUMMARY CARDS (EXACT DISTRIBUTOR DENSITY) ────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Total Customers
          </span>
          <span className="text-lg sm:text-xl font-black text-slate-800 leading-tight mt-0.5 block">
            {summaryMetrics.total}
          </span>
          <span className="text-[10px] text-slate-400 font-bold mt-0.5 block">
            Registered accounts
          </span>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 block">
            Active Customers
          </span>
          <span className="text-lg sm:text-xl font-black text-emerald-700 leading-tight mt-0.5 block">
            {summaryMetrics.active}
          </span>
          <span className="text-[10px] text-emerald-600/80 font-bold mt-0.5 block">
            {summaryMetrics.total > 0
              ? `${Math.round((summaryMetrics.active / summaryMetrics.total) * 100)}% operational`
              : '0% active'}
          </span>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600 block">
            Prepaid Balance
          </span>
          <span className="text-lg sm:text-xl font-black text-sky-700 leading-tight mt-0.5 block">
            ₹{summaryMetrics.totalPrepaidBalance.toLocaleString('en-IN')}
          </span>
          <span className="text-[10px] text-slate-400 font-bold mt-0.5 block">
            Combined wallet funds
          </span>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 block">
            Deposit Paid / Due
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-lg sm:text-xl font-black text-emerald-700">
              ₹{summaryMetrics.totalDepositPaid.toLocaleString('en-IN')}
            </span>
            <span className="text-slate-300 text-xs font-normal">/</span>
            <span className="text-xs font-bold text-rose-600">
              ₹{summaryMetrics.totalDepositDue.toLocaleString('en-IN')}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-bold mt-0.5 block">
            Jar security deposits
          </span>
        </div>
      </div>

      {/* ─── 3. DENSE CUSTOMER DIRECTORY TABLE & MOBILE LIST ────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs font-medium border-collapse min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-50/80 text-[10px] font-black uppercase tracking-wider text-slate-500 select-none">
                <th className="py-2.5 px-3">Customer</th>
                <th className="py-2.5 px-3">Phone</th>
                <th className="py-2.5 px-3">Referral / Distributor</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Prepaid Balance</th>
                <th className="py-2.5 px-3">Jar Balance</th>
                <th className="py-2.5 px-3">Deposit Paid/Due</th>
                <th className="py-2.5 px-3">Delivery Schedule</th>
                <th className="py-2.5 px-3">Registered</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse h-11">
                    <td className="p-3"><div className="h-4 w-32 bg-slate-200 rounded-sm" /></td>
                    <td className="p-3"><div className="h-4 w-24 bg-slate-200 rounded-sm" /></td>
                    <td className="p-3"><div className="h-4 w-24 bg-slate-200 rounded-sm" /></td>
                    <td className="p-3"><div className="h-4 w-16 bg-slate-200 rounded-full" /></td>
                    <td className="p-3"><div className="h-4 w-16 bg-slate-200 rounded-sm" /></td>
                    <td className="p-3"><div className="h-4 w-16 bg-slate-200 rounded-full" /></td>
                    <td className="p-3"><div className="h-4 w-20 bg-slate-200 rounded-sm" /></td>
                    <td className="p-3"><div className="h-4 w-24 bg-slate-200 rounded-sm" /></td>
                    <td className="p-3"><div className="h-4 w-20 bg-slate-200 rounded-sm" /></td>
                    <td className="p-3"><div className="h-4 w-16 bg-slate-200 rounded-sm ml-auto" /></td>
                  </tr>
                ))
              ) : error ? (
                <DataErrorState
                  isTableRow
                  colSpan={10}
                  title="Unable to load customers"
                  message={error}
                  onRetry={loadCustomers}
                />
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-14 text-center">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                      <div className="w-10 h-10 rounded-xl bg-sky-50 text-[#1677C8] flex items-center justify-center mb-2">
                        <Users className="w-5 h-5" />
                      </div>
                      <p className="font-bold text-slate-800 text-sm">No customers found</p>
                      <p className="text-xs text-slate-500 mt-1 mb-3 text-center">
                        {search || statusFilter !== 'ALL' || typeFilter !== 'ALL'
                          ? 'No customers match the current filter criteria.'
                          : 'Register your first customer to get started.'}
                      </p>
                      {(search || statusFilter !== 'ALL' || typeFilter !== 'ALL') && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearch('');
                            setStatusFilter('ALL');
                            setTypeFilter('ALL');
                          }}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                        >
                          Clear Filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((cust) => {
                  const fullName =
                    `${cust.user?.firstName || ''} ${cust.user?.lastName || ''}`.trim() ||
                    'Customer';
                  const availableJars =
                    cust.jarBalances?.[0]?.availableJars ?? cust.jars_at_customer ?? 0;
                  const walletBalance = cust.wallet?.balance ?? 0;
                  const depositPaid = cust.jarDeposits?.[0]?.depositPaid ?? 0;
                  const depositDue = cust.jarDeposits?.[0]?.depositDue ?? 0;
                  const scheduleActive = cust.deliverySchedule?.isActive ?? false;
                  const rulesCount = cust.deliverySchedule?.rules?.length ?? 0;
                  const isCommercial =
                    (cust.customerType || '').toUpperCase() === 'COMMERCIAL';
                  const isActive = cust.user?.isActive !== false;

                  return (
                    <tr
                      key={cust.id}
                      onClick={() => viewDetails(cust)}
                      className="hover:bg-slate-50/60 transition cursor-pointer"
                    >
                      {/* Customer Name */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-sky-100 text-[#1677C8] flex items-center justify-center font-bold text-xs shrink-0">
                            {fullName.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-800 hover:text-[#1677C8] transition truncate block">
                                {fullName}
                              </span>
                              {isCommercial ? (
                                <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-50 text-purple-700 border border-purple-200 shrink-0">
                                  Commercial
                                </span>
                              ) : null}
                            </div>
                            <span className="text-[11px] text-slate-400 truncate block">
                              {cust.companyName || cust.user?.email || (cust.referralCode ? `Code: ${cust.referralCode}` : 'Residential Customer')}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Phone */}
                      <td className="py-2.5 px-3 font-semibold text-slate-700 whitespace-nowrap">
                        <span className="font-mono">{cust.user?.phone || '—'}</span>
                      </td>

                      {/* Referral / Distributor */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {cust.referralInfo?.code ? (
                          <div>
                            <span className="text-[11px] text-slate-800 block truncate max-w-[150px] font-bold">
                              {cust.referralInfo.distributorName}
                            </span>
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-50 text-[#1677C8] border border-sky-200 mt-0.5">
                              <Tag className="w-2.5 h-2.5" />
                              {cust.referralInfo.code}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">Direct</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isActive
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isActive ? 'bg-emerald-500' : 'bg-rose-500'
                            }`}
                          />
                          {isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      {/* Prepaid Balance */}
                      <td className="py-2.5 px-3 font-bold">
                        <span className={walletBalance > 0 ? 'text-emerald-600' : 'text-slate-600'}>
                          ₹{Number(walletBalance).toFixed(2)}
                        </span>
                      </td>

                      {/* Jar Balance */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            availableJars <= 2
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : availableJars <= 5
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          <Package className="w-3 h-3" />
                          {availableJars} Jars
                        </span>
                      </td>

                      {/* Deposit Paid / Due */}
                      <td className="py-2.5 px-3 font-semibold whitespace-nowrap">
                        <span className="text-emerald-600">₹{depositPaid}</span>
                        <span className="text-slate-300 mx-1">/</span>
                        <span className="text-rose-500">₹{depositDue}</span>
                      </td>

                      {/* Delivery Schedule */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {cust.deliverySchedule ? (
                          <div className="flex items-center gap-1">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                scheduleActive
                                  ? 'bg-sky-50 text-[#1677C8] border border-sky-200'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {scheduleActive ? 'Active' : 'Paused'}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              ({rulesCount} {rulesCount === 1 ? 'rule' : 'rules'})
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">No schedule</span>
                        )}
                      </td>

                      {/* Registered */}
                      <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap font-mono text-[11px]">
                        {cust.user?.createdAt
                          ? new Date(cust.user.createdAt).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })
                          : '—'}
                      </td>

                      {/* Actions */}
                      <td
                        className="py-2.5 px-3 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => viewDetails(cust)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-sky-50 text-[#1677C8] rounded-lg text-xs font-bold transition cursor-pointer"
                          >
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate(`/staff/customers/${cust.id}/edit`)}
                            className="p-1 text-slate-400 hover:text-[#1677C8] hover:bg-slate-100 rounded-lg transition cursor-pointer"
                            title="Edit Customer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCust(cust);
                              setRules(cust.deliverySchedule?.rules || []);
                              setIsScheduleActive(cust.deliverySchedule?.isActive ?? true);
                              setEditingSchedule(true);
                            }}
                            className="p-1 text-slate-400 hover:text-[#1677C8] hover:bg-slate-100 rounded-lg transition cursor-pointer"
                            title="Manage Schedule"
                          >
                            <Calendar className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ─── Mobile Card List View ─────────────────────────────────── */}
        <div className="md:hidden divide-y divide-slate-100">
          {loading ? (
            Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="p-3 animate-pulse space-y-2">
                <div className="h-4 w-32 bg-slate-200 rounded" />
                <div className="h-3 w-48 bg-slate-100 rounded" />
              </div>
            ))
          ) : error ? (
            <div className="p-4 text-center text-xs text-rose-600 font-semibold">
              {error}
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 font-semibold">
              No customers found matching filter criteria.
            </div>
          ) : (
            filteredCustomers.map((cust) => {
              const fullName =
                `${cust.user?.firstName || ''} ${cust.user?.lastName || ''}`.trim() ||
                'Customer';
              const availableJars =
                cust.jarBalances?.[0]?.availableJars ?? cust.jars_at_customer ?? 0;
              const walletBalance = cust.wallet?.balance ?? 0;
              const isActive = cust.user?.isActive !== false;
              const isCommercial =
                (cust.customerType || '').toUpperCase() === 'COMMERCIAL';

              return (
                <div
                  key={cust.id}
                  onClick={() => viewDetails(cust)}
                  className="p-3 bg-white hover:bg-slate-50 transition cursor-pointer flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-sky-100 text-[#1677C8] flex items-center justify-center font-bold text-xs shrink-0">
                      {fullName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-xs text-slate-800 truncate">
                          {fullName}
                        </span>
                        {isCommercial && (
                          <span className="px-1 py-0.2 rounded text-[9px] font-bold bg-purple-50 text-purple-700 border border-purple-200 shrink-0">
                            Commercial
                          </span>
                        )}
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isActive ? 'bg-emerald-500' : 'bg-rose-500'
                          }`}
                        />
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5 flex-wrap">
                        <span className="font-mono">{cust.user?.phone || 'No phone'}</span>
                        <span>•</span>
                        <span
                          className={
                            walletBalance > 0
                              ? 'text-emerald-600 font-bold'
                              : 'text-slate-600'
                          }
                        >
                          ₹{Number(walletBalance).toFixed(0)}
                        </span>
                        <span>•</span>
                        <span>{availableJars} Jars</span>
                      </div>
                      {cust.referralInfo?.code && (
                        <div className="flex items-center gap-1.5 mt-1 text-[11px]">
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-sky-50 text-[#1677C8] border border-sky-100">
                            <Tag className="w-2.5 h-2.5" />
                            {cust.referralInfo.code}
                          </span>
                          <span className="text-slate-600 font-semibold truncate max-w-[180px]">
                            {cust.referralInfo.distributorName}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div
                    className="flex items-center gap-1 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => viewDetails(cust)}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-sky-50 text-[#1677C8] rounded-lg text-xs font-bold transition"
                    >
                      View
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(`/staff/customers/${cust.id}/edit`)}
                      className="p-1 text-slate-400 hover:text-[#1677C8] hover:bg-slate-100 rounded-lg transition"
                      title="Edit Customer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCust(cust);
                        setRules(cust.deliverySchedule?.rules || []);
                        setIsScheduleActive(cust.deliverySchedule?.isActive ?? true);
                        setEditingSchedule(true);
                      }}
                      className="p-1 text-slate-400 hover:text-[#1677C8] hover:bg-slate-100 rounded-lg transition"
                      title="Manage Schedule"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ─── 5. SLIDE-OVER CUSTOMER DETAILS DRAWER ─────────────────── */}
      <AnimatePresence>
        {isDrawerOpen && (
          <div className="fixed inset-0 z-50 overflow-hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDrawerOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            />

            <div className="fixed inset-y-0 right-0 w-full max-w-full sm:max-w-none flex justify-end sm:pl-10 pointer-events-none">
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="w-full sm:w-[560px] md:w-[620px] max-w-full sm:max-w-[90vw] bg-white sm:border-l border-slate-200/80 shadow-2xl flex flex-col h-full rounded-none sm:rounded-l-2xl pointer-events-auto overflow-hidden"
              >
                {/* Header */}
                <div className="px-4 py-3 sm:px-5 sm:py-3.5 bg-slate-50/80 border-b border-slate-200/80 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-[#1677C8] text-white flex items-center justify-center font-bold text-sm shrink-0">
                      {selectedCust?.user?.firstName?.charAt(0) || 'C'}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h2 className="text-base font-bold text-slate-800 truncate">
                          {selectedCust?.user?.firstName} {selectedCust?.user?.lastName}
                        </h2>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                            selectedCust?.user?.isActive !== false
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {selectedCust?.user?.isActive !== false ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      {selectedCust?.referralCode ? (
                        <p className="text-[11px] font-semibold text-[#1677C8] truncate">
                          Code: <span className="font-mono">{selectedCust.referralCode}</span>
                        </p>
                      ) : (
                        <p className="text-[11px] text-slate-400 truncate">
                          {selectedCust?.customerType ? selectedCust.customerType.replace('_', ' ') : 'Customer'}
                        </p>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => setIsDrawerOpen(false)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                  {drawerLoading ? (
                    <div className="py-16 text-center text-slate-500">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#1677C8] mb-2" />
                      <p className="text-xs font-semibold">Loading profile information...</p>
                    </div>
                  ) : selectedCust ? (
                    <>
                      {/* Financial & Jar Overview */}
                      <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs space-y-3">
                        <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Balance & Jar Statement
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                            <span className="text-[10px] font-bold text-slate-400 block">Prepaid Wallet</span>
                            <span className="text-base font-black text-emerald-600 mt-0.5 block">
                              ₹{Number(selectedCust.wallet?.balance || 0).toFixed(2)}
                            </span>
                          </div>
                          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                            <span className="text-[10px] font-bold text-slate-400 block">Available Jars</span>
                            <span className="text-base font-black text-slate-800 mt-0.5 block">
                              {selectedCust.jarBalances?.[0]?.availableJars ?? selectedCust.jars_at_customer ?? 0}
                            </span>
                          </div>
                          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                            <span className="text-[10px] font-bold text-slate-400 block">Deposit Paid</span>
                            <span className="text-base font-black text-emerald-600 mt-0.5 block">
                              ₹{selectedCust.jarDeposits?.[0]?.depositPaid ?? 0}
                            </span>
                          </div>
                          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                            <span className="text-[10px] font-bold text-slate-400 block">Deposit Due</span>
                            <span className="text-base font-black text-rose-500 mt-0.5 block">
                              ₹{selectedCust.jarDeposits?.[0]?.depositDue ?? 0}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                          <div className="bg-sky-50/60 p-2.5 rounded-lg border border-sky-100 flex items-center justify-between">
                            <span className="text-slate-600 font-semibold">Company Held Jars</span>
                            <span className="font-bold text-slate-800">
                              {selectedCust.jarOwnerships?.[0]?.companyJarsHeld ?? selectedCust.jarOwnership?.companyJarsHeld ?? 0}
                            </span>
                          </div>
                          <div className="bg-sky-50/60 p-2.5 rounded-lg border border-sky-100 flex items-center justify-between">
                            <span className="text-slate-600 font-semibold">Owned Jars</span>
                            <span className="font-bold text-slate-800">
                              {selectedCust.jarOwnerships?.[0]?.ownedJars ?? selectedCust.jarOwnership?.ownedJars ?? 0}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Customer Details */}
                      <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs space-y-2.5">
                        <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Customer Information
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 block">Phone</span>
                            <span className="text-slate-800 font-bold mt-0.5 block font-mono">
                              {selectedCust.user?.phone || '—'}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 block">Email</span>
                            <span className="text-slate-800 font-semibold mt-0.5 block truncate">
                              {selectedCust.user?.email || '—'}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 block">Account Type</span>
                            <span className="text-slate-800 font-bold mt-0.5 block">
                              {selectedCust.customerType || 'RESIDENTIAL'}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 block">Registered Date</span>
                            <span className="text-slate-800 font-medium mt-0.5 block">
                              {selectedCust.user?.createdAt
                                ? new Date(selectedCust.user.createdAt).toLocaleDateString()
                                : '—'}
                            </span>
                          </div>
                          {selectedCust.companyName && (
                            <div className="col-span-2">
                              <span className="text-[10px] font-bold text-slate-400 block">Company / Agency</span>
                              <span className="text-slate-800 font-bold mt-0.5 block">
                                {selectedCust.companyName} {selectedCust.gstNumber ? `(GST: ${selectedCust.gstNumber})` : ''}
                              </span>
                            </div>
                          )}
                        </div>

                        {selectedCust.addresses && selectedCust.addresses.length > 0 && (
                          <div className="pt-2 border-t border-slate-100">
                            <span className="text-[10px] font-bold text-slate-400 block mb-1">
                              Addresses
                            </span>
                            <div className="space-y-1">
                              {selectedCust.addresses.map((addr: any, idx: number) => (
                                <div key={idx} className="bg-slate-50 p-2 rounded-lg text-xs text-slate-700">
                                  <span className="font-bold text-[#1677C8] mr-1">
                                    {addr.label || 'Primary'}:
                                  </span>
                                  <span>{addr.street}, {addr.city}, {addr.state} - {addr.zipCode}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Referral Information */}
                      <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Tag className="w-3.5 h-3.5 text-[#1677C8]" />
                            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              Referral Information
                            </h3>
                          </div>
                          <span className="text-[9px] font-semibold text-slate-400">
                            Tracking attribution only
                          </span>
                        </div>

                        {selectedCust.referralInfo?.code ? (
                          <div className="bg-sky-50/60 p-3 rounded-xl border border-sky-100 space-y-2">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-[#1677C8]">
                              Referred By
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="text-[10px] text-slate-500 block">Distributor</span>
                                <span className="text-slate-800 font-bold mt-0.5 block flex items-center gap-1.5">
                                  <Building2 className="w-3.5 h-3.5 text-[#1677C8] shrink-0" />
                                  {selectedCust.referralInfo.distributorName}
                                </span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-500 block">Referral Code</span>
                                <span className="font-mono font-extrabold text-[#1677C8] text-sm mt-0.5 block">
                                  {selectedCust.referralInfo.code}
                                </span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-500 flex items-center justify-between">
                            <span className="text-[11px]">Channel:</span>
                            <span className="font-semibold text-slate-700 text-xs">Direct registration / Not referred</span>
                          </div>
                        )}
                      </div>

                      {/* Delivery Schedule Section */}
                      <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs space-y-2">
                        <div className="flex items-center justify-between">
                          <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Delivery Schedule
                          </h3>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingSchedule(true);
                              setRules(selectedCust.deliverySchedule?.rules || []);
                              setIsScheduleActive(selectedCust.deliverySchedule?.isActive ?? true);
                            }}
                            className="text-xs font-bold text-[#1677C8] hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <Calendar className="w-3.5 h-3.5" />
                            Edit Schedule
                          </button>
                        </div>

                        <div className="bg-slate-50 p-2.5 rounded-lg text-xs space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500 font-semibold">Status:</span>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                selectedCust.deliverySchedule?.isActive
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-rose-100 text-rose-700'
                              }`}
                            >
                              {selectedCust.deliverySchedule?.isActive ? 'Active' : 'Paused'}
                            </span>
                          </div>
                          {selectedCust.deliverySchedule?.rules?.map((rule: any, i: number) => (
                            <div key={i} className="flex items-center justify-between text-slate-700">
                              <span>
                                • {rule.type === 'WEEKLY'
                                  ? `Every ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][rule.dayOfWeek!]}`
                                  : rule.type === 'INTERVAL'
                                  ? `Every ${rule.intervalDays} Days`
                                  : 'Custom'}
                              </span>
                              <span className="font-bold text-[#1677C8]">
                                {rule.type === 'CUSTOM' ? rule.customNotes : `${rule.quantity} Jars`}
                              </span>
                            </div>
                          ))}
                          {(!selectedCust.deliverySchedule?.rules || selectedCust.deliverySchedule.rules.length === 0) && (
                            <p className="text-slate-400 italic text-[11px]">No active rules configured.</p>
                          )}
                        </div>
                      </div>

                      {/* Recent Transactions */}
                      {selectedCust.transactions && selectedCust.transactions.length > 0 && (
                        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs space-y-2">
                          <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Recent Transactions
                          </h3>
                          <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
                            {selectedCust.transactions.map((t: any) => (
                              <div
                                key={t.id}
                                className="bg-slate-50 p-2 rounded-lg flex justify-between items-center text-xs"
                              >
                                <div>
                                  <p className="text-slate-800 font-bold">{t.description || t.type}</p>
                                  <p className="text-slate-400 text-[10px]">
                                    {new Date(t.createdAt).toLocaleDateString()}
                                  </p>
                                </div>
                                <span
                                  className={`font-bold ${
                                    (t.amountJars ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-500'
                                  }`}
                                >
                                  {(t.amountJars ?? 0) >= 0 ? `+${t.amountJars}` : t.amountJars} Jars
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : null}
                </div>

                {/* Footer */}
                <div className="p-3.5 bg-slate-50 border-t border-slate-200/80 flex items-center justify-end gap-2">
                  <button
                    onClick={() => setIsDrawerOpen(false)}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => {
                      setIsDrawerOpen(false);
                      navigate(`/staff/customers/${selectedCust?.id}/edit`);
                    }}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Edit Account
                  </button>
                  <button
                    onClick={() => {
                      setEditingSchedule(true);
                      setRules(selectedCust?.deliverySchedule?.rules || []);
                      setIsScheduleActive(selectedCust?.deliverySchedule?.isActive ?? true);
                    }}
                    className="px-4 py-1.5 rounded-lg text-xs font-bold bg-[#1677C8] hover:bg-[#125ea0] text-white shadow-xs transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    Manage Schedule
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── 6. EDIT SCHEDULE MODAL ───────────────────────────────── */}
      {editingSchedule && selectedCust && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl p-5 sm:p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-4"
          >
            <div>
              <h3 className="text-lg font-bold text-slate-800">Edit Delivery Schedule</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure replenishment schedule for {selectedCust.user?.firstName}.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <label className="text-xs font-bold uppercase text-slate-500">Status:</label>
              <button
                onClick={() => setIsScheduleActive(!isScheduleActive)}
                className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
                  isScheduleActive ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                }`}
              >
                {isScheduleActive ? 'Active' : 'Paused'}
              </button>
            </div>

            <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
              {rules.map((rule, idx) => (
                <div
                  key={idx}
                  className="bg-slate-50 border border-slate-200 p-3 rounded-xl relative space-y-2 text-xs"
                >
                  <button
                    onClick={() => removeRule(idx)}
                    className="absolute top-2.5 right-2.5 text-rose-500 hover:text-rose-700 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                        Rule Type
                      </label>
                      <select
                        value={rule.type}
                        onChange={(e) => updateRuleField(idx, 'type', e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-semibold"
                      >
                        <option value="WEEKLY">Weekly</option>
                        <option value="INTERVAL">Interval</option>
                        <option value="CUSTOM">Custom</option>
                      </select>
                    </div>

                    {rule.type !== 'CUSTOM' && (
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                          Jars Qty
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={rule.quantity || 1}
                          onChange={(e) => updateRuleField(idx, 'quantity', parseInt(e.target.value) || 1)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-semibold"
                        />
                      </div>
                    )}
                  </div>

                  {rule.type === 'WEEKLY' ? (
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                        Day of Week
                      </label>
                      <select
                        value={rule.dayOfWeek || 1}
                        onChange={(e) => updateRuleField(idx, 'dayOfWeek', parseInt(e.target.value))}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-semibold"
                      >
                        {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(
                          (day, i) => (
                            <option key={i} value={i}>
                              {day}
                            </option>
                          ),
                        )}
                      </select>
                    </div>
                  ) : rule.type === 'INTERVAL' ? (
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                        Interval (Days)
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={rule.intervalDays || 1}
                        onChange={(e) => updateRuleField(idx, 'intervalDays', parseInt(e.target.value) || 1)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-semibold"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                        Instructions
                      </label>
                      <textarea
                        value={rule.customNotes || ''}
                        onChange={(e) => updateRuleField(idx, 'customNotes', e.target.value)}
                        placeholder="Deliver 2 jars on the 1st of every month..."
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 min-h-[50px]"
                      />
                    </div>
                  )}
                </div>
              ))}

              <button
                onClick={addRule}
                className="w-full py-2 border border-dashed border-[#1677C8]/40 rounded-xl text-xs font-bold uppercase tracking-wider text-[#1677C8] hover:bg-sky-50 transition flex items-center justify-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Delivery Rule
              </button>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setEditingSchedule(false)}
                className="px-4 py-1.5 rounded-lg text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateSchedule}
                className="px-5 py-1.5 rounded-lg text-xs font-bold bg-[#1677C8] hover:bg-[#125ea0] text-white shadow-xs transition cursor-pointer"
              >
                Save Schedule
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
