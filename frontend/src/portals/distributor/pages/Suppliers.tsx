import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  RefreshCw,
  Edit2,
  Trash2,
  X,
  AlertCircle,
  Building2,
  Eye,
  Phone,
  Mail,
  ArrowUpRight,
  TrendingDown,
} from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';
import { showToast } from '../../../utils/toast';
import { DistributorTopbar } from '../components/DistributorTopbar';

export interface SupplierRecord {
  id: string;
  name: string;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  companyName?: string | null;
  gstin?: string | null;
  pan?: string | null;
  supplierType?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  pinCode?: string | null;
  country?: string | null;
  openingBalance: number;
  openingBalanceType: 'PAYABLE' | 'RECEIVABLE';
  notes?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  purchaseCount: number;
  totalPurchased: number;
  totalPaid: number;
  balance: number; // Positive = Payable (we owe), Negative = Receivable
}

export default function Suppliers() {
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingSupplier, setEditingSupplier] = useState<SupplierRecord | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [deleteConfirmSupplier, setDeleteConfirmSupplier] = useState<SupplierRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Form states
  const [name, setName] = useState<string>('');
  const [contactPerson, setContactPerson] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [companyName, setCompanyName] = useState<string>('');
  const [gstin, setGstin] = useState<string>('');
  const [pan, setPan] = useState<string>('');
  const [supplierType, setSupplierType] = useState<string>('Wholesaler');
  const [addressLine1, setAddressLine1] = useState<string>('');
  const [addressLine2, setAddressLine2] = useState<string>('');
  const [city, setCity] = useState<string>('');
  const [state, setState] = useState<string>('');
  const [pinCode, setPinCode] = useState<string>('');
  const [country, setCountry] = useState<string>('India');
  const [openingBalance, setOpeningBalance] = useState<string>('0');
  const [openingBalanceType, setOpeningBalanceType] = useState<'PAYABLE' | 'RECEIVABLE'>('PAYABLE');
  const [notes, setNotes] = useState<string>('');
  const [isActive, setIsActive] = useState<boolean>(true);

  const loadSuppliers = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (search.trim()) params.append('search', search.trim());
      if (statusFilter !== 'ALL') params.append('status', statusFilter);

      const qs = params.toString() ? `?${params.toString()}` : '';
      const data = await fetchWithAuth(`/suppliers${qs}`);
      setSuppliers(Array.isArray(data) ? data : []);
    } catch (err: any) {
      showToast.error(err.message || 'Failed to load suppliers');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSuppliers();
  }, []);

  // Debounced search & filter
  useEffect(() => {
    const timer = setTimeout(() => {
      loadSuppliers();
    }, 250);
    return () => clearTimeout(timer);
  }, [search, statusFilter]);

  const openCreateModal = () => {
    setEditingSupplier(null);
    setName('');
    setContactPerson('');
    setPhone('');
    setEmail('');
    setCompanyName('');
    setGstin('');
    setPan('');
    setSupplierType('Wholesaler');
    setAddressLine1('');
    setAddressLine2('');
    setCity('');
    setState('');
    setPinCode('');
    setCountry('India');
    setOpeningBalance('0');
    setOpeningBalanceType('PAYABLE');
    setNotes('');
    setIsActive(true);
    setIsModalOpen(true);
  };

  const openEditModal = (supplier: SupplierRecord) => {
    setEditingSupplier(supplier);
    setName(supplier.name);
    setContactPerson(supplier.contactPerson || '');
    setPhone(supplier.phone || '');
    setEmail(supplier.email || '');
    setCompanyName(supplier.companyName || '');
    setGstin(supplier.gstin || '');
    setPan(supplier.pan || '');
    setSupplierType(supplier.supplierType || 'Wholesaler');
    setAddressLine1(supplier.addressLine1 || '');
    setAddressLine2(supplier.addressLine2 || '');
    setCity(supplier.city || '');
    setState(supplier.state || '');
    setPinCode(supplier.pinCode || '');
    setCountry(supplier.country || 'India');
    setOpeningBalance(String(supplier.openingBalance || 0));
    setOpeningBalanceType(supplier.openingBalanceType || 'PAYABLE');
    setNotes(supplier.notes || '');
    setIsActive(supplier.isActive);
    setIsModalOpen(true);
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast.error('Supplier Name is required');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload: any = {
        name: name.trim(),
        contactPerson: contactPerson.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        companyName: companyName.trim() || undefined,
        gstin: gstin.trim() || undefined,
        pan: pan.trim() || undefined,
        supplierType: supplierType.trim() || undefined,
        addressLine1: addressLine1.trim() || undefined,
        addressLine2: addressLine2.trim() || undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        pinCode: pinCode.trim() || undefined,
        country: country.trim() || 'India',
        notes: notes.trim() || undefined,
        isActive,
      };

      if (!editingSupplier) {
        payload.openingBalance = Math.abs(parseFloat(openingBalance) || 0);
        payload.openingBalanceType = openingBalanceType;
        await fetchWithAuth('/suppliers', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showToast.success(`Supplier ${name} created successfully!`);
      } else {
        await fetchWithAuth(`/suppliers/${editingSupplier.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        showToast.success(`Supplier ${name} updated successfully!`);
      }

      setIsModalOpen(false);
      loadSuppliers();
    } catch (err: any) {
      showToast.error(err.message || 'Failed to save supplier');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSupplier = async () => {
    if (!deleteConfirmSupplier) return;
    try {
      setIsDeleting(true);
      const res = await fetchWithAuth(`/suppliers/${deleteConfirmSupplier.id}`, {
        method: 'DELETE',
      });
      showToast.success(res.message || 'Supplier deleted');
      setDeleteConfirmSupplier(null);
      loadSuppliers();
    } catch (err: any) {
      showToast.error(err.message || 'Failed to delete supplier');
    } finally {
      setIsDeleting(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(val);
  };

  // Aggregated Summary metrics across suppliers
  const totalSuppliersCount = suppliers.length;
  const totalPurchasesSum = suppliers.reduce((sum, s) => sum + (Number(s.totalPurchased) || 0), 0);
  const totalPaidSum = suppliers.reduce((sum, s) => sum + (Number(s.totalPaid) || 0), 0);
  const totalPayablesSum = suppliers.reduce((sum, s) => (s.balance > 0 ? sum + s.balance : sum), 0);

  return (
    <div className="w-full min-h-full flex flex-col bg-[#F8FAFC] animate-in fade-in duration-150">
      {/* ─── STANDARDIZED DISTRIBUTOR TOPBAR ──────────────────────── */}
      <DistributorTopbar
        title="Suppliers"
        subtitle="Manage your suppliers, purchases, balances and payment history"
        icon={Building2}
        actions={
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-[#1677C8] hover:bg-[#125ea0] text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>New Supplier</span>
          </button>
        }
      />

      <div className="w-full p-4 sm:p-6 space-y-4 flex-1">

      {/* ─── SUMMARY CARDS ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3.5 bg-white border border-[#E2E8F0] rounded-xl shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Total Suppliers</span>
          <span className="text-lg font-extrabold text-[#16324F] mt-1 block">{totalSuppliersCount}</span>
          <span className="text-[11px] text-slate-500 mt-0.5 block">Active vendors in directory</span>
        </div>

        <div className="p-3.5 bg-white border border-[#E2E8F0] rounded-xl shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">Outstanding Payables</span>
            <span className="p-1 rounded bg-amber-50 text-amber-600">
              <ArrowUpRight className="w-3.5 h-3.5" />
            </span>
          </div>
          <span className="text-lg font-extrabold text-amber-700 mt-1 block">{formatCurrency(totalPayablesSum)}</span>
          <span className="text-[11px] text-slate-500 mt-0.5 block">Amount owed to suppliers</span>
        </div>

        <div className="p-3.5 bg-white border border-[#E2E8F0] rounded-xl shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Total Purchases</span>
          <span className="text-lg font-extrabold text-[#16324F] mt-1 block">{formatCurrency(totalPurchasesSum)}</span>
          <span className="text-[11px] text-slate-500 mt-0.5 block">All procurement orders</span>
        </div>

        <div className="p-3.5 bg-white border border-[#E2E8F0] rounded-xl shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">Paid Amount</span>
            <span className="p-1 rounded bg-emerald-50 text-emerald-600">
              <TrendingDown className="w-3.5 h-3.5" />
            </span>
          </div>
          <span className="text-lg font-extrabold text-emerald-700 mt-1 block">{formatCurrency(totalPaidSum)}</span>
          <span className="text-[11px] text-slate-500 mt-0.5 block">Settled procurement payments</span>
        </div>
      </div>

      {/* ─── FILTERS & SEARCH ROW ───────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-center gap-2.5">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search suppliers by name, company, phone, email, or GSTIN..."
            className="w-full pl-9 pr-8 py-2 bg-white border border-[#E2E8F0] rounded-lg text-xs text-[#16324F] placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#1677C8] focus:border-[#1677C8] transition-all"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full sm:w-40 px-2.5 py-2 bg-white border border-[#E2E8F0] rounded-lg text-xs font-semibold text-[#16324F] focus:outline-none focus:ring-1 focus:ring-[#1677C8]"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive / Archived</option>
            <option value="HAS_OUTSTANDING">Has Outstanding</option>
            <option value="FULLY_PAID">Fully Paid</option>
          </select>

          <button
            type="button"
            onClick={loadSuppliers}
            title="Refresh"
            className="p-2 bg-white border border-[#E2E8F0] hover:bg-slate-50 text-slate-600 rounded-lg transition-colors cursor-pointer shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#1677C8]' : ''}`} />
          </button>
        </div>
      </div>

      {/* ─── SUPPLIERS TABLE ────────────────────────────────────────── */}
      <div className="w-full bg-white border border-[#E2E8F0] rounded-xl shadow-2xs overflow-hidden">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-slate-50/80 text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                <th className="py-2.5 px-3.5 whitespace-nowrap">Supplier</th>
                <th className="py-2.5 px-3.5 whitespace-nowrap">Contact</th>
                <th className="py-2.5 px-3.5 whitespace-nowrap text-center">Purchases</th>
                <th className="py-2.5 px-3.5 whitespace-nowrap text-right">Total Purchased</th>
                <th className="py-2.5 px-3.5 whitespace-nowrap text-right">Paid</th>
                <th className="py-2.5 px-3.5 whitespace-nowrap text-right">Balance</th>
                <th className="py-2.5 px-3.5 whitespace-nowrap text-center">Status</th>
                <th className="py-2.5 px-3.5 whitespace-nowrap text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] text-xs">
              {isLoading && suppliers.length === 0 ? (
                Array.from({ length: 4 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="py-3 px-3.5"><div className="h-4 w-32 bg-slate-200 rounded" /></td>
                    <td className="py-3 px-3.5"><div className="h-4 w-28 bg-slate-200 rounded" /></td>
                    <td className="py-3 px-3.5"><div className="h-4 w-12 bg-slate-200 rounded mx-auto" /></td>
                    <td className="py-3 px-3.5"><div className="h-4 w-20 bg-slate-200 rounded ml-auto" /></td>
                    <td className="py-3 px-3.5"><div className="h-4 w-20 bg-slate-200 rounded ml-auto" /></td>
                    <td className="py-3 px-3.5"><div className="h-4 w-20 bg-slate-200 rounded ml-auto" /></td>
                    <td className="py-3 px-3.5"><div className="h-4 w-16 bg-slate-200 rounded mx-auto" /></td>
                    <td className="py-3 px-3.5"><div className="h-4 w-14 bg-slate-200 rounded ml-auto" /></td>
                  </tr>
                ))
              ) : suppliers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 px-4 text-center">
                    <div className="max-w-xs mx-auto space-y-3">
                      <div className="w-10 h-10 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <p className="text-sm font-bold text-[#16324F]">No suppliers found</p>
                      <p className="text-xs text-[#64748B]">Add your first vendor or supplier to start tracking purchases and balances.</p>
                      <button
                        type="button"
                        onClick={openCreateModal}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1677C8] hover:bg-[#125ea0] text-white rounded-lg text-xs font-bold transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>New Supplier</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                suppliers.map((supplier) => {
                  const isPayable = supplier.balance > 0;
                  const isSettled = supplier.balance === 0;

                  return (
                    <tr
                      key={supplier.id}
                      className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                      onClick={() => navigate(`/distributor/suppliers/${supplier.id}`)}
                    >
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        <div className="font-bold text-[#16324F] group-hover:text-[#1677C8] transition-colors">
                          {supplier.name}
                        </div>
                        {supplier.companyName && (
                          <div className="text-[11px] text-[#64748B]">{supplier.companyName}</div>
                        )}
                      </td>
                      <td className="py-2.5 px-3.5 text-[#64748B] whitespace-nowrap">
                        {supplier.phone && (
                          <div className="flex items-center gap-1 text-[11px]">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{supplier.phone}</span>
                          </div>
                        )}
                        {supplier.email && (
                          <div className="flex items-center gap-1 text-[11px] text-slate-500">
                            <Mail className="w-3 h-3 text-slate-400" />
                            <span>{supplier.email}</span>
                          </div>
                        )}
                        {!supplier.phone && !supplier.email && <span className="text-slate-400">—</span>}
                      </td>
                      <td className="py-2.5 px-3.5 text-center font-medium text-slate-700 whitespace-nowrap">
                        {supplier.purchaseCount}
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-medium text-slate-600 whitespace-nowrap">
                        {formatCurrency(supplier.totalPurchased)}
                      </td>
                      <td className="py-2.5 px-3.5 text-right text-emerald-700 font-medium whitespace-nowrap">
                        {formatCurrency(supplier.totalPaid)}
                      </td>
                      <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                        {isSettled ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-600">
                            ₹0 (Settled)
                          </span>
                        ) : isPayable ? (
                          <div className="font-bold text-amber-700">
                            {formatCurrency(supplier.balance)}
                            <span className="block text-[9px] font-semibold text-amber-600 uppercase">Payable</span>
                          </div>
                        ) : (
                          <div className="font-bold text-sky-700">
                            {formatCurrency(Math.abs(supplier.balance))}
                            <span className="block text-[9px] font-semibold text-sky-600 uppercase">Receivable</span>
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                        {supplier.isActive ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-600 border border-slate-200">
                            Archived
                          </span>
                        )}
                      </td>
                      <td
                        className="py-2.5 px-3.5 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => navigate(`/distributor/suppliers/${supplier.id}`)}
                            title="View Supplier Profile & Ledger"
                            className="p-1.5 text-slate-500 hover:text-[#1677C8] hover:bg-slate-100 rounded-md transition cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(supplier)}
                            title="Edit Supplier"
                            className="p-1.5 text-slate-500 hover:text-[#1677C8] hover:bg-slate-100 rounded-md transition cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmSupplier(supplier)}
                            title="Delete / Archive Supplier"
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-md transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
          {isLoading && suppliers.length === 0 ? (
            Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="p-3 animate-pulse space-y-2">
                <div className="flex justify-between">
                  <div className="h-4 w-28 bg-slate-200 rounded" />
                  <div className="h-4 w-14 bg-slate-200 rounded-full" />
                </div>
                <div className="h-3 w-40 bg-slate-100 rounded" />
              </div>
            ))
          ) : suppliers.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 font-semibold">
              No suppliers found.
            </div>
          ) : (
            suppliers.map((supplier) => {
              const isPayable = supplier.balance > 0;
              const isSettled = supplier.balance === 0;

              return (
                <div
                  key={supplier.id}
                  onClick={() => navigate(`/distributor/suppliers/${supplier.id}`)}
                  className="p-3.5 bg-white hover:bg-slate-50/80 active:bg-slate-50 transition cursor-pointer space-y-2 relative"
                >
                  {/* Top Line: Supplier Name + Status Badge */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-sm text-[#16324F] truncate">
                      {supplier.name}
                    </span>
                    <div className="shrink-0">
                      {supplier.isActive ? (
                        <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-bold uppercase bg-slate-100 text-slate-600 border border-slate-200">
                          Archived
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Company / Contact */}
                  <div className="text-xs text-[#64748B] truncate">
                    {supplier.companyName || supplier.phone || supplier.email || 'Vendor'}
                  </div>

                  {/* Purchases & Balance */}
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-slate-600 font-medium">
                      {supplier.purchaseCount} {supplier.purchaseCount === 1 ? 'purchase' : 'purchases'}
                    </span>
                    <div className="shrink-0">
                      {isSettled ? (
                        <span className="font-bold text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-[10px]">
                          ₹0 (Settled)
                        </span>
                      ) : isPayable ? (
                        <span className="font-bold text-amber-700 bg-amber-50 border border-amber-200/80 px-1.5 py-0.5 rounded text-[10px]">
                          Payable {formatCurrency(supplier.balance)}
                        </span>
                      ) : (
                        <span className="font-bold text-sky-700 bg-sky-50 border border-sky-200/80 px-1.5 py-0.5 rounded text-[10px]">
                          Receivable {formatCurrency(Math.abs(supplier.balance))}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div
                    className="flex items-center justify-end gap-1.5 pt-1.5 border-t border-slate-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => navigate(`/distributor/suppliers/${supplier.id}`)}
                      title="View Supplier Profile & Ledger"
                      className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5 text-slate-500" />
                      <span>View</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditModal(supplier)}
                      title="Edit Supplier"
                      className="p-1.5 text-slate-500 hover:text-[#1677C8] hover:bg-slate-100 rounded-lg transition cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmSupplier(supplier)}
                      title="Delete Supplier"
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ─── CREATE / EDIT SUPPLIER MODAL ───────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#1677C8]/10 text-[#1677C8] flex items-center justify-center font-bold">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#16324F]">
                    {editingSupplier ? 'Edit Supplier' : 'New Supplier'}
                  </h2>
                  <p className="text-[11px] text-[#64748B]">
                    {editingSupplier
                      ? `Update profile for ${editingSupplier.name}`
                      : 'Add a new supplier to your procurement directory'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveSupplier} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              {/* Basic Information */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-[#16324F] uppercase tracking-wider pb-1 border-b border-slate-100">
                  Basic Information
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      Supplier Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Apex Beverages Ltd."
                      required
                      className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-xs font-semibold text-[#16324F] focus:outline-none focus:ring-1 focus:ring-[#1677C8]"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Contact Person</label>
                    <input
                      type="text"
                      value={contactPerson}
                      onChange={(e) => setContactPerson(e.target.value)}
                      placeholder="e.g. Rajesh Kumar"
                      className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-xs text-[#16324F] focus:outline-none focus:ring-1 focus:ring-[#1677C8]"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Phone Number</label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. +91 9876543210"
                      className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-xs text-[#16324F] focus:outline-none focus:ring-1 focus:ring-[#1677C8]"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Email Address</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. supplier@example.com"
                      className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-xs text-[#16324F] focus:outline-none focus:ring-1 focus:ring-[#1677C8]"
                    />
                  </div>
                </div>
              </div>

              {/* Business Information */}
              <div className="space-y-3 pt-2">
                <h3 className="text-xs font-bold text-[#16324F] uppercase tracking-wider pb-1 border-b border-slate-100">
                  Business Information
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Company / Trade Name</label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="e.g. Apex Industrial Waters LLP"
                      className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-xs text-[#16324F] focus:outline-none focus:ring-1 focus:ring-[#1677C8]"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Supplier Type</label>
                    <select
                      value={supplierType}
                      onChange={(e) => setSupplierType(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-xs font-medium text-[#16324F] focus:outline-none focus:ring-1 focus:ring-[#1677C8]"
                    >
                      <option value="Manufacturer">Manufacturer</option>
                      <option value="Wholesaler">Wholesaler</option>
                      <option value="Distributor">Distributor</option>
                      <option value="Retailer">Retailer</option>
                      <option value="Packaging & Materials">Packaging & Materials</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">GSTIN</label>
                    <input
                      type="text"
                      value={gstin}
                      onChange={(e) => setGstin(e.target.value.toUpperCase())}
                      placeholder="e.g. 29ABCDE1234F1Z5"
                      className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-xs uppercase font-mono text-[#16324F] focus:outline-none focus:ring-1 focus:ring-[#1677C8]"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">PAN</label>
                    <input
                      type="text"
                      value={pan}
                      onChange={(e) => setPan(e.target.value.toUpperCase())}
                      placeholder="e.g. ABCDE1234F"
                      className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-xs uppercase font-mono text-[#16324F] focus:outline-none focus:ring-1 focus:ring-[#1677C8]"
                    />
                  </div>
                </div>
              </div>

              {/* Address Details */}
              <div className="space-y-3 pt-2">
                <h3 className="text-xs font-bold text-[#16324F] uppercase tracking-wider pb-1 border-b border-slate-100">
                  Address
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="font-semibold text-slate-700 block mb-1">Address Line 1</label>
                    <input
                      type="text"
                      value={addressLine1}
                      onChange={(e) => setAddressLine1(e.target.value)}
                      placeholder="Street address, building, premises..."
                      className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-xs text-[#16324F] focus:outline-none focus:ring-1 focus:ring-[#1677C8]"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">City</label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="City"
                      className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-xs text-[#16324F] focus:outline-none focus:ring-1 focus:ring-[#1677C8]"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">State</label>
                    <input
                      type="text"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      placeholder="State"
                      className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-xs text-[#16324F] focus:outline-none focus:ring-1 focus:ring-[#1677C8]"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">PIN Code</label>
                    <input
                      type="text"
                      value={pinCode}
                      onChange={(e) => setPinCode(e.target.value)}
                      placeholder="PIN Code"
                      className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-xs text-[#16324F] focus:outline-none focus:ring-1 focus:ring-[#1677C8]"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Country</label>
                    <input
                      type="text"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      placeholder="Country"
                      className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-xs text-[#16324F] focus:outline-none focus:ring-1 focus:ring-[#1677C8]"
                    />
                  </div>
                </div>
              </div>

              {/* Financial & Opening Balance (Create mode only) */}
              {!editingSupplier && (
                <div className="space-y-3 pt-2">
                  <h3 className="text-xs font-bold text-[#16324F] uppercase tracking-wider pb-1 border-b border-slate-100">
                    Opening Balance
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Opening Amount</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold">₹</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={openingBalance}
                          onChange={(e) => setOpeningBalance(e.target.value)}
                          placeholder="0.00"
                          className="w-full pl-7 pr-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-xs font-semibold text-[#16324F] focus:outline-none focus:ring-1 focus:ring-[#1677C8]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Balance Type</label>
                      <select
                        value={openingBalanceType}
                        onChange={(e) => setOpeningBalanceType(e.target.value as any)}
                        className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-xs font-semibold text-[#16324F] focus:outline-none focus:ring-1 focus:ring-[#1677C8]"
                      >
                        <option value="PAYABLE">We owe supplier (Payable)</option>
                        <option value="RECEIVABLE">Supplier owes us (Receivable)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Notes & Status */}
              <div className="space-y-3 pt-2">
                <h3 className="text-xs font-bold text-[#16324F] uppercase tracking-wider pb-1 border-b border-slate-100">
                  Additional Notes
                </h3>
                <div>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Payment terms, delivery schedules, bank details..."
                    className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-xs text-[#16324F] focus:outline-none focus:ring-1 focus:ring-[#1677C8]"
                  />
                </div>

                {editingSupplier && (
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="isActiveCheckbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="w-4 h-4 text-[#1677C8] border-slate-300 rounded focus:ring-[#1677C8]"
                    />
                    <label htmlFor="isActiveCheckbox" className="font-semibold text-slate-700 cursor-pointer">
                      Supplier is Active (Uncheck to archive)
                    </label>
                  </div>
                )}
              </div>

              {/* Modal Footer Buttons */}
              <div className="pt-4 border-t border-[#E2E8F0] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 border border-slate-300 bg-white hover:bg-slate-50 rounded-lg text-xs font-bold text-[#16324F] transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-[#1677C8] hover:bg-[#125ea0] disabled:opacity-50 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{editingSupplier ? 'Update Supplier' : 'Create Supplier'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── DELETE / ARCHIVE CONFIRMATION MODAL ─────────────────────── */}
      {deleteConfirmSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#16324F]">Delete or Archive Supplier?</h3>
                <p className="text-xs text-slate-500">{deleteConfirmSupplier.name}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              If this supplier has existing purchases or ledger transactions, it will be safely archived without deleting any historical records.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteConfirmSupplier(null)}
                disabled={isDeleting}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteSupplier}
                disabled={isDeleting}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {isDeleting ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
