import React, { useEffect, useState, useMemo } from 'react';
import {
  Award,
  Plus,
  Search,
  RefreshCw,
  Edit2,
  Trash2,
  X,
  CheckCircle2,
  XCircle,
  TrendingDown,
  Droplets,
  Sparkles,
  Info,
} from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';
import { showToast } from '../../../utils/toast';
import { EdropsPageLoader } from '../../../components/common/EdropsPageLoader';

export interface MembershipPackage {
  id: string;
  name: string;
  description?: string | null;
  jarCount: number;
  price: number;
  originalPrice?: number | null;
  discountPercent?: number | null;
  offerLabel?: string | null;
  packageBadge?: string | null;
  packageColor?: string | null;
  displayOrder?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    purchases: number;
  };
}

interface FormState {
  name: string;
  description: string;
  jarCount: string | number;
  price: string | number;
  originalPrice: string | number;
  offerLabel: string;
  packageBadge: string;
  packageColor: string;
  displayOrder: string | number;
  isActive: boolean;
}

const initialFormState: FormState = {
  name: '',
  description: '',
  jarCount: 20,
  price: '',
  originalPrice: '',
  offerLabel: '',
  packageBadge: '',
  packageColor: 'blue',
  displayOrder: 0,
  isActive: true,
};

export default function MembershipManagement() {
  const [memberships, setMemberships] = useState<MembershipPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filter & Search states
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Modal states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(initialFormState);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete modal states
  const [deleteTarget, setDeleteTarget] = useState<MembershipPackage | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadMemberships = async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) setRefreshing(true);
      else setLoading(true);

      const data = await fetchWithAuth('/recharge/packages/all');
      if (Array.isArray(data)) {
        setMemberships(data);
      }
    } catch (err: any) {
      showToast.error(err.message || 'Failed to load membership plans');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadMemberships();
  }, []);

  // Filtered memberships
  const filteredMemberships = useMemo(() => {
    return memberships.filter((pkg) => {
      // Status match
      if (statusFilter === 'ACTIVE' && !pkg.isActive) return false;
      if (statusFilter === 'INACTIVE' && pkg.isActive) return false;

      // Search match
      if (search.trim()) {
        const query = search.toLowerCase().trim();
        const nameMatch = pkg.name?.toLowerCase().includes(query);
        const descMatch = pkg.description?.toLowerCase().includes(query);
        const labelMatch = pkg.offerLabel?.toLowerCase().includes(query);
        const badgeMatch = pkg.packageBadge?.toLowerCase().includes(query);
        const jarMatch = `${pkg.jarCount}`.includes(query);
        return nameMatch || descMatch || labelMatch || badgeMatch || jarMatch;
      }

      return true;
    });
  }, [memberships, search, statusFilter]);

  // Counts
  const stats = useMemo(() => {
    const total = memberships.length;
    const active = memberships.filter((p) => p.isActive).length;
    const inactive = total - active;
    return { total, active, inactive };
  }, [memberships]);

  // Real-time savings preview in modal
  const liveSavings = useMemo(() => {
    const numPrice = Number(form.price);
    const numOriginal = Number(form.originalPrice);
    const numJars = Number(form.jarCount) || 1;

    if (!numPrice || isNaN(numPrice)) {
      return null;
    }

    const perJar = (numPrice / numJars).toFixed(1);
    let discount = 0;
    let savings = 0;

    if (numOriginal && numOriginal > numPrice) {
      savings = numOriginal - numPrice;
      discount = Math.round(((numOriginal - numPrice) / numOriginal) * 100);
    }

    return {
      perJar,
      savings,
      discount,
      hasDiscount: savings > 0,
    };
  }, [form.price, form.originalPrice, form.jarCount]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingId(null);
    setForm(initialFormState);
    setFormErrors({});
    setIsFormOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (pkg: MembershipPackage) => {
    setEditingId(pkg.id);
    setForm({
      name: pkg.name || '',
      description: pkg.description || '',
      jarCount: pkg.jarCount,
      price: pkg.price,
      originalPrice: pkg.originalPrice ?? '',
      offerLabel: pkg.offerLabel || '',
      packageBadge: pkg.packageBadge || '',
      packageColor: pkg.packageColor || 'blue',
      displayOrder: pkg.displayOrder ?? 0,
      isActive: pkg.isActive,
    });
    setFormErrors({});
    setIsFormOpen(true);
  };

  // Quick toggle active/inactive status
  const handleToggleStatus = async (pkg: MembershipPackage) => {
    const updatedStatus = !pkg.isActive;
    try {
      await fetchWithAuth(`/recharge/package/${pkg.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: updatedStatus }),
      });
      showToast.success(
        `Membership "${pkg.name}" ${updatedStatus ? 'activated' : 'deactivated'}`
      );
      setMemberships((prev) =>
        prev.map((item) =>
          item.id === pkg.id ? { ...item, isActive: updatedStatus } : item
        )
      );
    } catch (err: any) {
      showToast.error(err.message || 'Failed to update membership status');
    }
  };

  // Form submit (Create / Edit)
  const handleSaveMembership = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    const errors: Record<string, string> = {};
    if (!form.name.trim()) {
      errors.name = 'Membership name is required';
    }
    const jarCountNum = Number(form.jarCount);
    if (isNaN(jarCountNum) || jarCountNum <= 0) {
      errors.jarCount = 'Jar count must be greater than 0';
    }
    const priceNum = Number(form.price);
    if (form.price === '' || isNaN(priceNum) || priceNum < 0) {
      errors.price = 'Selling price must be 0 or greater';
    }
    const originalPriceNum = form.originalPrice !== '' ? Number(form.originalPrice) : null;
    if (originalPriceNum !== null && (isNaN(originalPriceNum) || originalPriceNum < 0)) {
      errors.originalPrice = 'Original price must be a valid positive number';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      setIsSubmitting(true);
      const payload: any = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        jarCount: jarCountNum,
        price: priceNum,
        originalPrice: originalPriceNum,
        offerLabel: form.offerLabel.trim() || undefined,
        packageBadge: form.packageBadge.trim() || undefined,
        packageColor: form.packageColor || 'blue',
        displayOrder: Number(form.displayOrder) || 0,
        isActive: form.isActive,
      };

      if (editingId) {
        const updated = await fetchWithAuth(`/recharge/package/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        showToast.success(`Membership "${form.name}" updated successfully`);
        setMemberships((prev) =>
          prev.map((item) => (item.id === editingId ? { ...item, ...updated } : item))
        );
      } else {
        const created = await fetchWithAuth('/recharge/package', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showToast.success(`Membership "${form.name}" created successfully`);
        setMemberships((prev) => [created, ...prev]);
      }

      setIsFormOpen(false);
    } catch (err: any) {
      showToast.error(err.message || 'Failed to save membership plan');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete / Safe Deactivate
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      setIsDeleting(true);
      const res = await fetchWithAuth(`/recharge/package/${deleteTarget.id}`, {
        method: 'DELETE',
      });

      // If backend returned updated soft-deactivated record
      if (res && res.isActive === false) {
        showToast.success(
          `Membership "${deleteTarget.name}" deactivated to protect purchase history`
        );
        setMemberships((prev) =>
          prev.map((item) =>
            item.id === deleteTarget.id ? { ...item, isActive: false } : item
          )
        );
      } else {
        showToast.success(`Membership "${deleteTarget.name}" deleted successfully`);
        setMemberships((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      }

      setDeleteTarget(null);
    } catch (err: any) {
      showToast.error(err.message || 'Failed to delete membership plan');
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) return <EdropsPageLoader fullPage />;

  return (
    <div className="space-y-4 sm:space-y-5 animate-in fade-in duration-150">
      {/* ─── PAGE HEADER & ACTIONS ────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-cyan-400 flex items-center justify-center text-white shadow-xs shrink-0 mt-0.5 sm:mt-0">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-[#16324F] leading-tight">
              Membership Management
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Create and manage prepaid customer membership plans and jar recharge packages.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          <button
            type="button"
            onClick={() => loadMemberships(true)}
            disabled={refreshing}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition cursor-pointer shadow-2xs disabled:opacity-50"
            title="Refresh memberships list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-gradient-to-r from-sky-500 to-[#087CC9] hover:from-sky-600 hover:to-[#076ba8] text-white rounded-xl text-xs font-semibold transition cursor-pointer shadow-sm hover:shadow"
          >
            <Plus className="w-4 h-4" />
            <span>Create Membership</span>
          </button>
        </div>
      </div>

      {/* ─── METRICS & FILTER ROW ────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-3.5 sm:p-4 space-y-3">
        {/* Top filter row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search membership plans by name, jars, badge..."
              className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition text-[#16324F]"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status Tabs / Chips */}
          <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-xl shrink-0 self-start md:self-auto overflow-x-auto max-w-full">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                statusFilter === 'ALL'
                  ? 'bg-white text-[#16324F] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Plans ({stats.total})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('ACTIVE')}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                statusFilter === 'ACTIVE'
                  ? 'bg-emerald-500 text-white shadow-xs'
                  : 'text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Active ({stats.active})</span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('INACTIVE')}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                statusFilter === 'INACTIVE'
                  ? 'bg-slate-700 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Inactive ({stats.inactive})</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── DESKTOP TABLE VIEW ────────────────────────────── */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Membership Plan</th>
                <th className="py-3 px-4">Jar Quantity</th>
                <th className="py-3 px-4">Pricing</th>
                <th className="py-3 px-4">Savings / Offer</th>
                <th className="py-3 px-4 text-center">Order #</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredMemberships.map((pkg) => {
                const perJar = (pkg.price / (pkg.jarCount || 1)).toFixed(1);
                const hasDiscount = pkg.originalPrice && pkg.originalPrice > pkg.price;
                const savingsAmount = hasDiscount ? pkg.originalPrice! - pkg.price : 0;
                const discountPct =
                  pkg.discountPercent ??
                  (hasDiscount
                    ? Math.round(((pkg.originalPrice! - pkg.price) / pkg.originalPrice!) * 100)
                    : 0);

                return (
                  <tr
                    key={pkg.id}
                    className="hover:bg-slate-50/60 transition-colors group"
                  >
                    {/* Name & details */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-start gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs border border-sky-100">
                          {pkg.jarCount}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-[#16324F] text-sm">
                              {pkg.name}
                            </span>
                            {pkg.packageBadge && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                                {pkg.packageBadge}
                              </span>
                            )}
                            {pkg.offerLabel && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                {pkg.offerLabel}
                              </span>
                            )}
                          </div>
                          {pkg.description ? (
                            <p className="text-slate-500 text-[11px] line-clamp-1 mt-0.5 max-w-sm">
                              {pkg.description}
                            </p>
                          ) : (
                            <p className="text-slate-400 text-[11px] italic mt-0.5">
                              No description
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Jar Quantity */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-[#16324F] font-semibold text-xs border border-slate-200/60">
                        <Droplets className="w-3.5 h-3.5 text-sky-600" />
                        <span>{pkg.jarCount} Jars</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 pl-0.5">
                        ₹{perJar}/jar
                      </div>
                    </td>

                    {/* Pricing */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-sm font-extrabold text-[#16324F]">
                          ₹{pkg.price}
                        </span>
                        {hasDiscount && (
                          <span className="text-[11px] text-slate-400 line-through">
                            MRP ₹{pkg.originalPrice}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Savings / Offer */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {hasDiscount ? (
                        <div className="inline-flex flex-col">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <TrendingDown className="w-3 h-3" />
                            <span>Save ₹{savingsAmount} ({discountPct}% OFF)</span>
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Standard Rate</span>
                      )}
                    </td>

                    {/* Display Order */}
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-slate-100 text-slate-600 font-mono text-[11px] font-semibold">
                        {pkg.displayOrder ?? 0}
                      </span>
                    </td>

                    {/* Status Toggle */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(pkg)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition cursor-pointer border ${
                          pkg.isActive
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                        }`}
                        title="Click to toggle status"
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            pkg.isActive ? 'bg-emerald-500' : 'bg-slate-400'
                          }`}
                        />
                        <span>{pkg.isActive ? 'Active' : 'Inactive'}</span>
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(pkg)}
                          className="p-1.5 text-slate-500 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition cursor-pointer"
                          title="Edit Membership Plan"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(pkg)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          title="Delete / Deactivate Plan"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredMemberships.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 text-xs">
                    <div className="max-w-xs mx-auto space-y-2">
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                        <Award className="w-5 h-5" />
                      </div>
                      <p className="font-semibold text-slate-700">No memberships found</p>
                      <p className="text-[11px] text-slate-400">
                        {search || statusFilter !== 'ALL'
                          ? 'Try adjusting your search or filter criteria.'
                          : 'Get started by creating your first customer prepaid membership plan.'}
                      </p>
                      {!search && statusFilter === 'ALL' && (
                        <button
                          type="button"
                          onClick={handleOpenCreate}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-500 text-white rounded-lg text-xs font-semibold hover:bg-sky-600 transition cursor-pointer mt-2"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Create Membership</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── MOBILE CARD VIEW ────────────────────────────── */}
      <div className="md:hidden space-y-3">
        {filteredMemberships.map((pkg) => {
          const perJar = (pkg.price / (pkg.jarCount || 1)).toFixed(1);
          const hasDiscount = pkg.originalPrice && pkg.originalPrice > pkg.price;
          const savingsAmount = hasDiscount ? pkg.originalPrice! - pkg.price : 0;
          const discountPct =
            pkg.discountPercent ??
            (hasDiscount
              ? Math.round(((pkg.originalPrice! - pkg.price) / pkg.originalPrice!) * 100)
              : 0);

          return (
            <article
              key={pkg.id}
              className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 space-y-3"
            >
              {/* Top Row: Name, Badges & Status */}
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h2 className="font-bold text-[#16324F] text-sm">
                      {pkg.name}
                    </h2>
                    {pkg.packageBadge && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                        {pkg.packageBadge}
                      </span>
                    )}
                    {pkg.offerLabel && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        {pkg.offerLabel}
                      </span>
                    )}
                  </div>
                  {pkg.description && (
                    <p className="text-slate-500 text-xs line-clamp-2">
                      {pkg.description}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleToggleStatus(pkg)}
                  className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                    pkg.isActive
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      pkg.isActive ? 'bg-emerald-500' : 'bg-slate-400'
                    }`}
                  />
                  <span>{pkg.isActive ? 'Active' : 'Inactive'}</span>
                </button>
              </div>

              {/* Jar info & Order badge */}
              <div className="flex items-center justify-between text-xs bg-slate-50/80 p-2 rounded-xl border border-slate-100">
                <div className="flex items-center gap-1.5 text-[#16324F] font-semibold">
                  <Droplets className="w-3.5 h-3.5 text-sky-600" />
                  <span>{pkg.jarCount} Jars Pack</span>
                  <span className="text-slate-400 text-[11px] font-normal">
                    (₹{perJar}/jar)
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 font-medium">
                  Order #{pkg.displayOrder ?? 0}
                </div>
              </div>

              {/* Price & Savings */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-lg font-extrabold text-[#16324F]">
                      ₹{pkg.price}
                    </span>
                    {hasDiscount && (
                      <span className="text-xs text-slate-400 line-through">
                        ₹{pkg.originalPrice}
                      </span>
                    )}
                  </div>
                  {hasDiscount && (
                    <span className="text-[10px] font-bold text-emerald-700">
                      Save ₹{savingsAmount} ({discountPct}% OFF)
                    </span>
                  )}
                </div>

                {/* Mobile actions */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(pkg)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-sky-50 text-slate-700 hover:text-sky-700 border border-slate-200 text-xs font-semibold transition"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(pkg)}
                    className="p-1.5 rounded-xl bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 transition"
                    title="Delete plan"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </article>
          );
        })}

        {filteredMemberships.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 text-xs space-y-2">
            <Award className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="font-semibold text-slate-700">No memberships found</p>
            <p className="text-[11px] text-slate-400">
              {search || statusFilter !== 'ALL'
                ? 'Try adjusting your search filters.'
                : 'Create your first membership plan to get started.'}
            </p>
            {!search && statusFilter === 'ALL' && (
              <button
                type="button"
                onClick={handleOpenCreate}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-500 text-white rounded-lg text-xs font-semibold hover:bg-sky-600 transition cursor-pointer mt-2"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Membership</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* ─── CREATE / EDIT MODAL DIALOG ────────────────────────────── */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-100">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="px-5 py-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-sky-500 text-white flex items-center justify-center">
                  <Award className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-[#16324F]">
                    {editingId ? 'Edit Membership Plan' : 'Create Membership Plan'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Configure jar quota, selling price, and customer savings.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveMembership} className="p-5 space-y-4">
              {/* Membership Name */}
              <div>
                <label className="block text-xs font-bold text-[#16324F] mb-1">
                  Membership Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => {
                    setForm({ ...form, name: e.target.value });
                    if (formErrors.name) setFormErrors({ ...formErrors, name: '' });
                  }}
                  placeholder="e.g. Starter Pack, Family Saver, Business 50"
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition text-[#16324F]"
                />
                {formErrors.name && (
                  <p className="text-rose-500 text-[11px] mt-1">{formErrors.name}</p>
                )}
              </div>

              {/* Jar Count & Display Order */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#16324F] mb-1">
                    Number of Jars <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      value={form.jarCount}
                      onChange={(e) => {
                        setForm({ ...form, jarCount: e.target.value });
                        if (formErrors.jarCount) setFormErrors({ ...formErrors, jarCount: '' });
                      }}
                      placeholder="20"
                      className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition text-[#16324F]"
                    />
                    <Droplets className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sky-400 pointer-events-none" />
                  </div>
                  {formErrors.jarCount && (
                    <p className="text-rose-500 text-[11px] mt-1">{formErrors.jarCount}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#16324F] mb-1">
                    Display Order
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.displayOrder}
                    onChange={(e) => setForm({ ...form, displayOrder: e.target.value })}
                    placeholder="0"
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition text-[#16324F]"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">Lower numbers show first</p>
                </div>
              </div>

              {/* Original MRP & Selling Price */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#16324F] mb-1">
                    Original Price / MRP (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={form.originalPrice}
                    onChange={(e) => {
                      setForm({ ...form, originalPrice: e.target.value });
                      if (formErrors.originalPrice)
                        setFormErrors({ ...formErrors, originalPrice: '' });
                    }}
                    placeholder="e.g. 1200"
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition text-[#16324F]"
                  />
                  {formErrors.originalPrice && (
                    <p className="text-rose-500 text-[11px] mt-1">{formErrors.originalPrice}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#16324F] mb-1">
                    Selling Price (₹) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={form.price}
                    onChange={(e) => {
                      setForm({ ...form, price: e.target.value });
                      if (formErrors.price) setFormErrors({ ...formErrors, price: '' });
                    }}
                    placeholder="e.g. 999"
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition font-bold text-[#16324F]"
                  />
                  {formErrors.price && (
                    <p className="text-rose-500 text-[11px] mt-1">{formErrors.price}</p>
                  )}
                </div>
              </div>

              {/* Live Savings Calculator Preview */}
              {liveSavings && (
                <div className="bg-gradient-to-r from-sky-50 to-cyan-50/60 p-3 rounded-xl border border-sky-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-sky-600 shrink-0" />
                    <div>
                      <span className="font-bold text-sky-900">
                        ₹{liveSavings.perJar}
                      </span>
                      <span className="text-sky-700 text-[11px]"> / jar rate</span>
                    </div>
                  </div>
                  {liveSavings.hasDiscount ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Save ₹{liveSavings.savings} ({liveSavings.discount}% OFF)
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-500">No discount set</span>
                  )}
                </div>
              )}

              {/* Badge & Offer Tag */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#16324F] mb-1">
                    Badge Tag (optional)
                  </label>
                  <input
                    type="text"
                    value={form.packageBadge}
                    onChange={(e) => setForm({ ...form, packageBadge: e.target.value })}
                    placeholder="e.g. POPULAR, BEST VALUE"
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition text-[#16324F]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#16324F] mb-1">
                    Offer Highlight (optional)
                  </label>
                  <input
                    type="text"
                    value={form.offerLabel}
                    onChange={(e) => setForm({ ...form, offerLabel: e.target.value })}
                    placeholder="e.g. 20% OFF, LIMITED TIME"
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition text-[#16324F]"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-[#16324F] mb-1">
                  Description (optional)
                </label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Short note about the membership benefits or customer suitability..."
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition text-[#16324F] resize-none"
                />
              </div>

              {/* Active Toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <span className="text-xs font-bold text-[#16324F] block">
                    Active for Customers
                  </span>
                  <span className="text-[11px] text-slate-500 block">
                    Active memberships appear in customer recharge and shop options.
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-gradient-to-r from-sky-500 to-[#087CC9] hover:from-sky-600 hover:to-[#076ba8] text-white rounded-xl text-xs font-semibold transition cursor-pointer shadow-sm disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{editingId ? 'Save Changes' : 'Create Membership'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── SAFE DELETE / DEACTIVATE CONFIRMATION MODAL ────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-[#16324F]">
                  Delete / Deactivate Membership?
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Are you sure you want to remove{' '}
                  <span className="font-bold text-[#16324F]">
                    &ldquo;{deleteTarget.name}&rdquo;
                  </span>{' '}
                  ({deleteTarget.jarCount} Jars)?
                </p>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-start gap-2">
              <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed">
                <strong className="text-slate-800">Historical Protection:</strong> If customers have already purchased this membership plan, it will be safely deactivated (hidden from new purchases) to preserve all customer order and recharge logs. If no customer has purchased it yet, it will be deleted permanently.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold transition cursor-pointer shadow-sm disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <span>Confirm Delete / Deactivate</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
