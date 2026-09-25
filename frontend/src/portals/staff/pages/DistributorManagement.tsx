import { useState, useMemo, useEffect } from 'react';
import {
  Building2,
  Search,
  Plus,
  RefreshCw,
  Tag,
  Copy,
  Check,
  Package,
  Edit2,
  X,
  MapPin,
  Truck,
  SlidersHorizontal,
} from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';
import { toast } from 'react-hot-toast';
import { DataErrorState } from '../../../components/common/DataErrorState';
import { EdropsPageLoader } from '../../../components/common/EdropsPageLoader';
import { MobileFilterSheet } from '../../../components/common/MobileFilterSheet';
import DistributorFormModal, { type DistributorRecord } from '../components/DistributorFormModal';
import DistributorDetailDrawer from '../components/DistributorDetailDrawer';

export default function DistributorManagement() {
  const [distributors, setDistributors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  // Modal / Drawer state
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [distributorToEdit, setDistributorToEdit] = useState<DistributorRecord | null>(null);
  const [selectedDistributor, setSelectedDistributor] = useState<any | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const loadDistributors = async () => {
    try {
      setError(null);
      setLoading(true);
      const data = await fetchWithAuth('/staff/distributors');
      setDistributors(data || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load distributors');
      toast.error('Failed to load distributors');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDistributors();
  }, []);

  const handleCopyCode = (e: React.MouseEvent, code: string, id: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedCodeId(id);
    toast.success(`Copied code: ${code}`);
    setTimeout(() => setCopiedCodeId(null), 2500);
  };

  const handleOpenCreate = () => {
    setDistributorToEdit(null);
    setFormModalOpen(true);
  };

  const handleOpenEdit = (dist: any) => {
    setDistributorToEdit({
      id: dist.id,
      userId: dist.userId || dist.id,
      firstName: dist.firstName,
      lastName: dist.lastName,
      fullName: dist.fullName,
      phone: dist.phone,
      email: dist.email,
      role: dist.role,
      isActive: dist.isActive,
      referralCode: dist.referralCode,
      agencyName: dist.agencyName,
      address: dist.address,
      routeOrArea: dist.routeOrArea,
      vehicleType: dist.vehicleType,
      vehiclePlate: dist.vehiclePlate,
      jarOwnership: dist.jarOwnership,
      companyOwnedJars: dist.companyOwnedJars,
      distributorOwnedJars: dist.distributorOwnedJars,
      servicePincodes: dist.servicePincodes || dist.distributorPincodes || [],
    });
    setFormModalOpen(true);
  };

  const handleOpenDetails = async (dist: any) => {
    try {
      const detailed = await fetchWithAuth(`/staff/distributors/${dist.id}`);
      setSelectedDistributor(detailed || dist);
    } catch {
      setSelectedDistributor(dist);
    }
    setDrawerOpen(true);
  };

  const handleToggleStatus = async (dist: any) => {
    try {
      const newStatus = !dist.isActive;
      const targetId = dist.userId || dist.id;
      await fetchWithAuth(`/staff/distributors/${targetId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: newStatus }),
      });
      toast.success(`Distributor ${newStatus ? 'activated' : 'deactivated'} successfully`);
      loadDistributors();
      if (selectedDistributor?.id === dist.id) {
        setSelectedDistributor({ ...selectedDistributor, isActive: newStatus });
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status');
    }
  };

  // Filtered list
  const filteredDistributors = useMemo(() => {
    const term = search.toLowerCase().trim();
    return distributors.filter((d: any) => {
      const name = (d.fullName || `${d.firstName || ''} ${d.lastName || ''}`).toLowerCase();
      const phone = (d.phone || '').toLowerCase();
      const email = (d.email || '').toLowerCase();
      const code = (d.referralCode || '').toLowerCase();
      const route = (d.routeOrArea || '').toLowerCase();
      const agency = (d.agencyName || '').toLowerCase();

      const matchesSearch =
        !term ||
        name.includes(term) ||
        phone.includes(term) ||
        email.includes(term) ||
        code.includes(term) ||
        route.includes(term) ||
        agency.includes(term);

      if (!matchesSearch) return false;

      if (statusFilter === 'ACTIVE' && d.isActive === false) return false;
      if (statusFilter === 'INACTIVE' && d.isActive !== false) return false;

      return true;
    });
  }, [distributors, search, statusFilter]);

  // Derived Summary Metrics from real data
  const summaryMetrics = useMemo(() => {
    const total = distributors.length;
    const active = distributors.filter((d) => d.isActive !== false).length;
    const inactive = total - active;
    const totalCompanyJars = distributors.reduce(
      (sum, d) => sum + (Number(d.companyOwnedJars) || 0),
      0,
    );
    const totalPartnerJars = distributors.reduce(
      (sum, d) => sum + (Number(d.distributorOwnedJars) || 0),
      0,
    );
    const totalJars = totalCompanyJars + totalPartnerJars;

    return {
      total,
      active,
      inactive,
      totalJars,
      totalCompanyJars,
    };
  }, [distributors]);

  const activeFilterCount = statusFilter !== 'ALL' ? 1 : 0;

  return (
    <div className="space-y-3.5 sm:space-y-4 animate-in fade-in duration-150">
      {/* ─── SEARCH, FILTER & ACTION TOOLBAR (RESPONSIVE) ──────────── */}
      <div className="bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200/80 shadow-xs">
        {/* Mobile View: Search + Filter Trigger + Refresh + Add Distributor */}
        <div className="flex md:hidden items-center gap-1.5 sm:gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search distributors..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none focus:border-[#1677C8] focus:bg-white transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsMobileFilterOpen(true)}
            className={`flex items-center gap-1.5 p-2 sm:px-3 sm:py-2 rounded-xl border text-xs font-bold transition-colors cursor-pointer shrink-0 ${
              activeFilterCount > 0
                ? 'bg-[#1677C8]/10 text-[#1677C8] border-[#1677C8]/30'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
            title="Filters"
          >
            <SlidersHorizontal className="w-4 h-4" />
            {activeFilterCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-[#1677C8] text-white text-[10px] font-black flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={loadDistributors}
            disabled={loading}
            title="Refresh Distributors"
            className="p-2 text-slate-600 hover:text-[#1677C8] bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer disabled:opacity-50 shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#1677C8]' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1 p-2 sm:px-3 sm:py-2 bg-[#1677C8] hover:bg-[#125ea0] text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer shrink-0"
            title="Register New Distributor"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add</span>
          </button>
        </div>

        {/* Desktop View: Inline Filters + Actions */}
        <div className="hidden md:flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-1 max-w-2xl">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by name, phone, referral code, route..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none focus:border-[#1677C8] focus:bg-white transition-all"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-[#1677C8] cursor-pointer"
            >
              <option value="ALL">All Status ({distributors.length})</option>
              <option value="ACTIVE">Active ({summaryMetrics.active})</option>
              <option value="INACTIVE">Inactive ({summaryMetrics.inactive})</option>
            </select>

            {(search || statusFilter !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setStatusFilter('ALL');
                }}
                className="text-xs font-bold text-[#1677C8] hover:underline px-2 py-1 cursor-pointer shrink-0"
              >
                Reset
              </button>
            )}
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={loadDistributors}
              disabled={loading}
              title="Refresh Distributors"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#1677C8]' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#1677C8] hover:bg-[#125ea0] text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              title="Register New Distributor"
            >
              <Plus className="w-4 h-4" />
              <span>Add Distributor</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── MOBILE FILTER SHEET ────────────────────────────────────── */}
      <MobileFilterSheet
        isOpen={isMobileFilterOpen}
        onClose={() => setIsMobileFilterOpen(false)}
        activeCount={activeFilterCount}
        onReset={() => {
          setStatusFilter('ALL');
        }}
      >
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            Operational Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-[#1677C8]"
          >
            <option value="ALL">All Statuses ({distributors.length})</option>
            <option value="ACTIVE">Active ({summaryMetrics.active})</option>
            <option value="INACTIVE">Inactive ({summaryMetrics.inactive})</option>
          </select>
        </div>
      </MobileFilterSheet>

      {/* ─── 2. COMPACT SUMMARY CARDS (EXACT DISTRIBUTOR DENSITY) ────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="bg-white p-3 rounded-xl border border-[#E2E8F0] shadow-2xs flex flex-col justify-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block truncate">
            Total Distributors
          </span>
          <span className="text-base sm:text-lg font-extrabold text-[#16324F] leading-tight mt-1 block">
            {summaryMetrics.total}
          </span>
        </div>

        <div className="bg-white p-3 rounded-xl border border-[#E2E8F0] shadow-2xs flex flex-col justify-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block truncate">
            Active Distributors
          </span>
          <span className="text-base sm:text-lg font-extrabold text-emerald-700 leading-tight mt-1 block">
            {summaryMetrics.active}
          </span>
        </div>

        <div className="bg-white p-3 rounded-xl border border-[#E2E8F0] shadow-2xs flex flex-col justify-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block truncate">
            Inactive Distributors
          </span>
          <span className="text-base sm:text-lg font-extrabold text-slate-700 leading-tight mt-1 block">
            {summaryMetrics.inactive}
          </span>
        </div>

        <div className="bg-white p-3 rounded-xl border border-[#E2E8F0] shadow-2xs flex flex-col justify-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 block truncate">
            Allocated Jars
          </span>
          <span className="text-base sm:text-lg font-extrabold text-purple-700 leading-tight mt-1 block">
            {summaryMetrics.totalJars}
          </span>
        </div>
      </div>

      {/* ─── 3. DENSE DISTRIBUTORS DIRECTORY TABLE & MOBILE LIST ───── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading && distributors.length === 0 ? (
          <EdropsPageLoader minHeight="min-h-[400px]" />
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs font-medium border-collapse min-w-[900px]">
                <thead>
                  <tr className="border-b border-slate-200/80 bg-slate-50/80 text-[10px] font-black uppercase tracking-wider text-slate-500 select-none">
                    <th className="py-2.5 px-3">Distributor</th>
                    <th className="py-2.5 px-3">Phone</th>
                    <th className="py-2.5 px-3">Referral Code</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Route / Area</th>
                    <th className="py-2.5 px-3">Vehicle</th>
                    <th className="py-2.5 px-3">Jar Allocation</th>
                    <th className="py-2.5 px-3">Registered</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {error ? (
                <DataErrorState
                  isTableRow
                  colSpan={9}
                  title="Unable to load distributors"
                  message={error}
                  onRetry={loadDistributors}
                />
              ) : filteredDistributors.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-14 text-center">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                      <div className="w-10 h-10 rounded-xl bg-sky-50 text-[#1677C8] flex items-center justify-center mb-2">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <p className="font-bold text-slate-800 text-sm">No distributors found</p>
                      <p className="text-xs text-slate-500 mt-1 mb-3 text-center">
                        {search || statusFilter !== 'ALL'
                          ? 'No distributors match the current filter criteria.'
                          : 'Register your first distributor partner to get started.'}
                      </p>
                      {(search || statusFilter !== 'ALL') && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearch('');
                            setStatusFilter('ALL');
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
                filteredDistributors.map((dist) => {
                  const fullName =
                    dist.fullName ||
                    `${dist.firstName || ''} ${dist.lastName || ''}`.trim() ||
                    'Distributor';
                  const isActive = dist.isActive !== false;
                  const isCopied = copiedCodeId === dist.id;

                  return (
                    <tr
                      key={dist.id}
                      onClick={() => handleOpenDetails(dist)}
                      className="hover:bg-slate-50/60 transition cursor-pointer"
                    >
                      {/* Distributor Name */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-sky-100 text-[#1677C8] flex items-center justify-center font-bold text-xs shrink-0">
                            {fullName.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-slate-800 hover:text-[#1677C8] transition truncate block">
                              {fullName}
                            </span>
                            <span className="text-[11px] text-slate-400 truncate block">
                              {dist.agencyName || dist.email || 'Independent Partner'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Phone */}
                      <td className="py-2.5 px-3 font-semibold text-slate-700 whitespace-nowrap">
                        <span className="font-mono">{dist.phone || '—'}</span>
                      </td>

                      {/* Referral Code */}
                      <td className="py-2.5 px-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-1 bg-sky-50 border border-sky-200 hover:border-sky-300 rounded-md px-2 py-0.5 text-xs font-mono font-bold text-[#1677C8] shadow-2xs">
                          <Tag className="w-3 h-3 text-[#1677C8]" />
                          <span>{dist.referralCode}</span>
                          <button
                            type="button"
                            onClick={(e) => handleCopyCode(e, dist.referralCode, dist.id)}
                            className="p-0.5 hover:bg-sky-100 rounded text-[#1677C8] transition cursor-pointer"
                            title="Copy Referral Code"
                          >
                            {isCopied ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(dist)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold transition cursor-pointer ${
                            isActive
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                              : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                          }`}
                          title={`Click to ${isActive ? 'deactivate' : 'activate'}`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isActive ? 'bg-emerald-500' : 'bg-rose-500'
                            }`}
                          />
                          {isActive ? 'Active' : 'Inactive'}
                        </button>
                      </td>

                      {/* Route / Area */}
                      <td className="py-2.5 px-3 text-slate-700">
                        {dist.routeOrArea ? (
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[130px] font-medium">{dist.routeOrArea}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Unassigned</span>
                        )}
                      </td>

                      {/* Vehicle */}
                      <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap">
                        {dist.vehiclePlate ? (
                          <div className="flex items-center gap-1">
                            <Truck className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="font-mono font-medium text-[11px]">{dist.vehiclePlate}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">No vehicle</span>
                        )}
                      </td>

                      {/* Jar Allocation */}
                      <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Package className="w-3 h-3 text-purple-600 shrink-0" />
                          <span className="font-bold text-slate-800">
                            {dist.totalJars ?? (dist.companyOwnedJars || 0) + (dist.distributorOwnedJars || 0)}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            ({dist.companyOwnedJars || 0} Co / {dist.distributorOwnedJars || 0} Ptr)
                          </span>
                        </div>
                      </td>

                      {/* Registered */}
                      <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap font-mono text-[11px]">
                        {dist.createdAt
                          ? new Date(dist.createdAt).toLocaleDateString('en-IN', {
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
                            onClick={() => handleOpenDetails(dist)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-sky-50 text-[#1677C8] rounded-lg text-xs font-bold transition cursor-pointer"
                          >
                            Profile
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(dist)}
                            className="p-1 text-slate-400 hover:text-[#1677C8] hover:bg-slate-100 rounded-lg transition cursor-pointer"
                            title="Edit Distributor"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
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
          {error ? (
            <div className="p-4 text-center text-xs text-rose-600 font-semibold">
              {error}
            </div>
          ) : filteredDistributors.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 font-semibold">
              No distributors match the current filter criteria.
            </div>
          ) : (
            filteredDistributors.map((dist) => {
              const distName =
                dist.fullName ||
                `${dist.firstName || ''} ${dist.lastName || ''}`.trim() ||
                'Distributor';
              const allocatedJars =
                (dist.companyOwnedJars || 0) + (dist.distributorOwnedJars || 0);
              const isActive = dist.isActive !== false;

              return (
                <div
                  key={dist.id}
                  onClick={() => handleOpenDetails(dist)}
                  className="p-3 bg-white hover:bg-slate-50 transition cursor-pointer flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-[#1677C8]/10 text-[#1677C8] flex items-center justify-center font-bold text-xs shrink-0">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-xs text-slate-800 truncate">
                          {distName}
                        </span>
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isActive ? 'bg-emerald-500' : 'bg-rose-500'
                          }`}
                        />
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5 flex-wrap">
                        <span className="font-mono">{dist.phone || 'No phone'}</span>
                        <span>•</span>
                        <button
                          type="button"
                          onClick={(e) => handleCopyCode(e, dist.referralCode, dist.id)}
                          className="inline-flex items-center gap-1 font-mono font-bold text-[#1677C8] bg-sky-50 px-1 py-0.5 rounded text-[10px] hover:bg-sky-100"
                        >
                          <Tag className="w-2.5 h-2.5" />
                          <span>{dist.referralCode || '—'}</span>
                          {copiedCodeId === dist.id ? (
                            <Check className="w-2.5 h-2.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-2.5 h-2.5 text-slate-400" />
                          )}
                        </button>
                        <span>•</span>
                        <span>{allocatedJars} Jars</span>
                      </div>
                    </div>
                  </div>

                  <div
                    className="flex items-center gap-1 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => handleOpenDetails(dist)}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-sky-50 text-[#1677C8] rounded-lg text-xs font-bold transition"
                    >
                      Profile
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(dist)}
                      className="p-1 text-slate-400 hover:text-[#1677C8] hover:bg-slate-100 rounded-lg transition"
                      title="Edit Distributor"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
          </>
        )}
      </div>

      {/* ─── ADD / EDIT DISTRIBUTOR MODAL ───────────────────────── */}
      <DistributorFormModal
        isOpen={formModalOpen}
        distributorToEdit={distributorToEdit}
        onClose={() => setFormModalOpen(false)}
        onSuccess={loadDistributors}
      />

      {/* ─── DISTRIBUTOR PROFILE DRAWER ─────────────────────────── */}
      <DistributorDetailDrawer
        isOpen={drawerOpen}
        distributor={selectedDistributor}
        onClose={() => setDrawerOpen(false)}
        onEdit={handleOpenEdit}
        onToggleStatus={handleToggleStatus}
      />
    </div>
  );
}
