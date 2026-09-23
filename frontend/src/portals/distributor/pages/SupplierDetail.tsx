import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  Phone,
  Mail,
  CreditCard,
  Plus,
  RefreshCw,
  Edit2,
  ShoppingCart,
  Receipt,
  AlertCircle,
  CheckCircle2,
  X,
  Eye,
  Clock,
  TrendingDown,
  ArrowUpRight,
  Package,
  SlidersHorizontal,
  Loader2,
} from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';
import { showToast } from '../../../utils/toast';
import { DistributorTopbar } from '../components/DistributorTopbar';

export interface PurchaseItem {
  productId?: string;
  productName: string;
  quantity: number;
  rate: number;
  taxPercent?: number;
  amount: number;
}

export interface PurchaseRecord {
  id: string;
  purchaseNumber: string;
  purchaseDate: string;
  supplierName: string;
  referenceNumber?: string | null;
  items: PurchaseItem[];
  subtotal: number;
  tax: number;
  total: number;
  paymentStatus: 'PAID' | 'PENDING' | 'PARTIAL' | 'CANCELLED';
  amountPaid?: number | null;
  payments?: Array<{ id: string; amount: number; date: string; notes?: string }>;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierTransaction {
  id: string;
  date: string;
  type: string; // "OPENING_BALANCE", "PURCHASE", "PAYMENT", "BALANCE_ADJUSTMENT"
  reference?: string | null;
  description?: string | null;
  total?: number;
  paid?: number;
  pending?: number;
  status?: string;
  debit?: number;
  credit?: number;
  balance?: number;
  runningBalance: number;
  purchaseId?: string | null;
  createdAt: string;
  payments?: any[];
  items?: any;
}

export interface SupplierDetailData {
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
  totalPurchased: number;
  totalPaid: number;
  outstandingBalance: number;
  purchases: PurchaseRecord[];
  transactions: SupplierTransaction[];
}

export default function SupplierDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [supplier, setSupplier] = useState<SupplierDetailData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'purchases' | 'ledger'>('purchases');
  const [ledgerFilter, setLedgerFilter] = useState<string>('ALL');

  // Payment recording modal
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<string>('Bank Transfer');
  const [paymentReference, setPaymentReference] = useState<string>('');
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [isRecordingPayment, setIsRecordingPayment] = useState<boolean>(false);
  const [paymentError, setPaymentError] = useState<string>('');

  // Edit Supplier Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [editName, setEditName] = useState<string>('');
  const [editContactPerson, setEditContactPerson] = useState<string>('');
  const [editPhone, setEditPhone] = useState<string>('');
  const [editEmail, setEditEmail] = useState<string>('');
  const [editCompanyName, setEditCompanyName] = useState<string>('');
  const [editGstin, setEditGstin] = useState<string>('');
  const [editPan, setEditPan] = useState<string>('');
  const [editSupplierType, setEditSupplierType] = useState<string>('Wholesaler');
  const [editAddressLine1, setEditAddressLine1] = useState<string>('');
  const [editAddressLine2, setEditAddressLine2] = useState<string>('');
  const [editCity, setEditCity] = useState<string>('');
  const [editState, setEditState] = useState<string>('');
  const [editPinCode, setEditPinCode] = useState<string>('');
  const [editCountry, setEditCountry] = useState<string>('India');
  const [editNotes, setEditNotes] = useState<string>('');
  const [editIsActive, setEditIsActive] = useState<boolean>(true);
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  // Adjust balance modal
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState<boolean>(false);
  const [adjustNewBalance, setAdjustNewBalance] = useState<string>('');
  const [adjustReason, setAdjustReason] = useState<string>('');
  const [adjustReference, setAdjustReference] = useState<string>('');
  const [isSavingAdjust, setIsSavingAdjust] = useState<boolean>(false);
  const [adjustError, setAdjustError] = useState<string>('');

  // View purchase modal
  const [viewingPurchase, setViewingPurchase] = useState<PurchaseRecord | null>(null);

  // Collect Purchase Payment modal
  const [collectingPurchase, setCollectingPurchase] = useState<any>(null);
  const [collectionAmount, setCollectionAmount] = useState<string>('');
  const [collectionNotes, setCollectionNotes] = useState<string>('');
  const [isCollecting, setIsCollecting] = useState<boolean>(false);
  const [collectionError, setCollectionError] = useState<string>('');

  const loadSupplier = async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      const data = await fetchWithAuth(`/suppliers/${id}`);
      setSupplier(data);
    } catch (err: any) {
      showToast.error(err.message || 'Failed to load supplier details');
      navigate('/distributor/suppliers');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSupplier();
  }, [id]);

  const openPaymentModal = () => {
    if (!supplier) return;
    setPaymentAmount(supplier.outstandingBalance > 0 ? String(supplier.outstandingBalance) : '');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentMethod('Bank Transfer');
    setPaymentReference('');
    setPaymentNotes('');
    setPaymentError('');
    setIsPaymentModalOpen(true);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplier) return;

    const amountNum = parseFloat(paymentAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setPaymentError('Payment amount must be greater than 0');
      return;
    }

    if (supplier.outstandingBalance <= 0) {
      setPaymentError('Supplier has no outstanding payable balance');
      return;
    }

    if (amountNum > supplier.outstandingBalance + 0.01) {
      setPaymentError(
        `Amount cannot exceed current outstanding payable balance of ${formatCurrency(supplier.outstandingBalance)}`
      );
      return;
    }

    try {
      setIsRecordingPayment(true);
      setPaymentError('');

      await fetchWithAuth(`/suppliers/${supplier.id}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          amount: Math.round(amountNum * 100) / 100,
          paymentDate,
          paymentMethod,
          reference: paymentReference.trim() || undefined,
          notes: paymentNotes.trim() || undefined,
        }),
      });

      showToast.success(`Payment of ${formatCurrency(amountNum)} recorded successfully!`);
      setIsPaymentModalOpen(false);
      loadSupplier();
    } catch (err: any) {
      setPaymentError(err.message || 'Failed to record payment');
      showToast.error(err.message || 'Failed to record payment');
    } finally {
      setIsRecordingPayment(false);
    }
  };

  const openEditModal = () => {
    if (!supplier) return;
    setEditName(supplier.name);
    setEditContactPerson(supplier.contactPerson || '');
    setEditPhone(supplier.phone || '');
    setEditEmail(supplier.email || '');
    setEditCompanyName(supplier.companyName || '');
    setEditGstin(supplier.gstin || '');
    setEditPan(supplier.pan || '');
    setEditSupplierType(supplier.supplierType || 'Wholesaler');
    setEditAddressLine1(supplier.addressLine1 || '');
    setEditAddressLine2(supplier.addressLine2 || '');
    setEditCity(supplier.city || '');
    setEditState(supplier.state || '');
    setEditPinCode(supplier.pinCode || '');
    setEditCountry(supplier.country || 'India');
    setEditNotes(supplier.notes || '');
    setEditIsActive(supplier.isActive);
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplier) return;

    if (!editName.trim()) {
      showToast.error('Supplier Name is required');
      return;
    }

    try {
      setIsSavingEdit(true);
      const payload = {
        name: editName.trim(),
        contactPerson: editContactPerson.trim() || undefined,
        phone: editPhone.trim() || undefined,
        email: editEmail.trim() || undefined,
        companyName: editCompanyName.trim() || undefined,
        gstin: editGstin.trim() || undefined,
        pan: editPan.trim() || undefined,
        supplierType: editSupplierType.trim() || undefined,
        addressLine1: editAddressLine1.trim() || undefined,
        addressLine2: editAddressLine2.trim() || undefined,
        city: editCity.trim() || undefined,
        state: editState.trim() || undefined,
        pinCode: editPinCode.trim() || undefined,
        country: editCountry.trim() || 'India',
        notes: editNotes.trim() || undefined,
        isActive: editIsActive,
      };

      await fetchWithAuth(`/suppliers/${supplier.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      showToast.success('Supplier details updated successfully');
      setIsEditModalOpen(false);
      loadSupplier();
    } catch (err: any) {
      showToast.error(err.message || 'Failed to update supplier');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const openAdjustModal = () => {
    if (!supplier) return;
    setAdjustNewBalance(String(supplier.outstandingBalance));
    setAdjustReason('');
    setAdjustReference('');
    setAdjustError('');
    setIsAdjustModalOpen(true);
  };

  const handleAdjustBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplier) return;

    const newBal = parseFloat(adjustNewBalance);
    if (isNaN(newBal)) {
      setAdjustError('Please enter a valid balance amount.');
      return;
    }

    if (!adjustReason.trim()) {
      setAdjustError('Please specify the reason for adjusting the balance.');
      return;
    }

    if (Math.round(newBal * 100) === Math.round(supplier.outstandingBalance * 100)) {
      setAdjustError('The new balance is identical to the current balance.');
      return;
    }

    try {
      setIsSavingAdjust(true);
      setAdjustError('');
      await fetchWithAuth(`/suppliers/${supplier.id}/adjust-balance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newBalance: newBal,
          reason: adjustReason.trim(),
          reference: adjustReference.trim() || undefined,
        }),
      });

      showToast.success('Supplier balance adjusted successfully');
      setIsAdjustModalOpen(false);
      await loadSupplier();
    } catch (err: any) {
      setAdjustError(err.message || 'Failed to adjust balance');
    } finally {
      setIsSavingAdjust(false);
    }
  };

  const openCollectPurchaseModal = (p: any) => {
    const pending = getPurchasePending(p);
    setCollectingPurchase(p);
    setCollectionAmount(pending > 0 ? String(pending) : '');
    setCollectionNotes('');
    setCollectionError('');
  };

  const handleCollectPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collectingPurchase) return;

    const amt = parseFloat(collectionAmount);
    if (isNaN(amt) || amt <= 0) {
      setCollectionError('Please enter a valid collection amount');
      return;
    }

    const pending = getPurchasePending(collectingPurchase);
    if (amt > pending + 0.01) {
      setCollectionError(`Collection amount cannot exceed pending amount of ${formatCurrency(pending)}`);
      return;
    }

    try {
      setIsCollecting(true);
      setCollectionError('');
      const targetId = collectingPurchase.id || collectingPurchase.purchaseId;
      await fetchWithAuth(`/purchases/${targetId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amt,
          notes: collectionNotes.trim() || undefined,
        }),
      });

      showToast.success('Payment recorded successfully');
      setCollectingPurchase(null);
      await loadSupplier();
    } catch (err: any) {
      setCollectionError(err.message || 'Failed to record payment');
    } finally {
      setIsCollecting(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(val);
  };

  const formatTransactionTimestamp = (dateStr?: string | Date) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    const dateFormatted = d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const timeFormatted = d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    return `${dateFormatted} · ${timeFormatted}`;
  };

  const getPurchasePending = (p: any) => {
    if (!p) return 0;
    if (p.pending !== undefined) return Number(p.pending);
    const paid =
      p.amountPaid !== undefined && p.amountPaid !== null
        ? Number(p.amountPaid)
        : p.paymentStatus === 'PAID'
        ? p.total
        : 0;
    return Math.max(0, Number((Number(p.total || 0) - paid).toFixed(2)));
  };

  const getEffectiveStatusBadge = (p: PurchaseRecord | any) => {
    const pending = getPurchasePending(p);
    const paid = Number(p.amountPaid ?? p.paid ?? 0);

    if (p.paymentStatus === 'CANCELLED') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-50 text-rose-700 border border-rose-200">
          Cancelled
        </span>
      );
    }

    if (pending <= 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3" />
          Fully Paid
        </span>
      );
    }

    if (paid > 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-50 text-blue-700 border border-blue-200">
          <AlertCircle className="w-3 h-3" />
          Partial
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200">
        <Clock className="w-3 h-3" />
        Pending
      </span>
    );
  };

  // The backend already returns purchase-level unified business transactions
  // sorted newest-first (createdAt DESC) with sequential running balance:
  const ledgerTransactions = useMemo(() => {
    if (!supplier || !Array.isArray(supplier.transactions)) return [];
    return supplier.transactions;
  }, [supplier]);

  // Filter transactions for ledger tab
  const filteredTransactions = useMemo(() => {
    if (ledgerFilter === 'ALL') return ledgerTransactions;
    if (ledgerFilter === 'PURCHASES')
      return ledgerTransactions.filter((tx) => tx.type === 'PURCHASE');
    if (ledgerFilter === 'ADJUSTMENTS')
      return ledgerTransactions.filter(
        (tx) => tx.type === 'BALANCE_ADJUSTMENT' || tx.type === 'ADJUSTMENT',
      );
    return ledgerTransactions;
  }, [ledgerTransactions, ledgerFilter]);

  if (isLoading || !supplier) {
    return (
      <div className="w-full p-6 space-y-4 animate-in fade-in duration-150">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Suppliers</span>
        </div>
        <div className="h-28 bg-white border border-[#E2E8F0] rounded-xl animate-pulse" />
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 bg-white border border-[#E2E8F0] rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const isPayable = supplier.outstandingBalance > 0;
  const isSettled = supplier.outstandingBalance === 0;

  return (
    <div className="w-full min-h-full flex flex-col bg-[#F8FAFC] animate-in fade-in duration-150">
      {/* ─── STANDARDIZED DISTRIBUTOR TOPBAR ──────────────────────── */}
      <DistributorTopbar
        backLink={{ label: 'Back to Suppliers', to: '/distributor/suppliers' }}
        title={supplier.name}
        subtitle={supplier.companyName || 'Supplier Profile & Ledger'}
        icon={Building2}
        badge={
          supplier.isActive ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
              Active
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-600 border border-slate-200">
              Archived
            </span>
          )
        }
        actions={
          <>
            <button
              type="button"
              onClick={openEditModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E2E8F0] hover:bg-slate-50 text-[#16324F] rounded-lg text-xs font-semibold transition cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Edit Profile</span>
            </button>

            <button
              type="button"
              onClick={openPaymentModal}
              disabled={supplier.outstandingBalance <= 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Record Payment</span>
            </button>

            <button
              type="button"
              onClick={() => navigate(`/distributor/purchases?supplierId=${supplier.id}`)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1677C8] hover:bg-[#125ea0] text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Purchase</span>
            </button>
          </>
        }
      />

      <div className="w-full p-4 sm:p-6 space-y-4 flex-1">

      {/* ─── SUPPLIER HEADER PROFILE CARD ───────────────────────────── */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-[#1677C8]/10 text-[#1677C8] flex items-center justify-center font-bold shrink-0">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-bold text-[#16324F] leading-tight">{supplier.name}</h1>
                {supplier.isActive ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Active
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-600 border border-slate-200">
                    Archived
                  </span>
                )}
                {supplier.supplierType && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-50 text-[#1677C8] border border-sky-200">
                    {supplier.supplierType}
                  </span>
                )}
              </div>

              {supplier.companyName && (
                <p className="text-xs font-medium text-slate-600 mt-0.5">{supplier.companyName}</p>
              )}

              <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 flex-wrap">
                {supplier.contactPerson && (
                  <span className="font-medium text-[#16324F]">Contact: {supplier.contactPerson}</span>
                )}
                {supplier.phone && (
                  <div className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{supplier.phone}</span>
                  </div>
                )}
                {supplier.email && (
                  <div className="flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span>{supplier.email}</span>
                  </div>
                )}
                {supplier.gstin && (
                  <span className="font-mono text-[11px] bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                    GSTIN: {supplier.gstin}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Balance Status Box */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 shrink-0 text-right">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              Outstanding Balance
            </span>
            <div className="text-xl font-extrabold mt-0.5">
              {isSettled ? (
                <span className="text-slate-600">₹0</span>
              ) : isPayable ? (
                <span className="text-amber-700">{formatCurrency(supplier.outstandingBalance)}</span>
              ) : (
                <span className="text-sky-700">{formatCurrency(Math.abs(supplier.outstandingBalance))}</span>
              )}
            </div>
            <span className="text-[10px] font-semibold uppercase text-slate-500 block">
              {isSettled ? 'Account Settled' : isPayable ? 'Payable (We owe supplier)' : 'Receivable (Supplier owes us)'}
            </span>
          </div>
        </div>
      </div>

      {/* ─── FINANCIAL SUMMARY METRICS ──────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3.5 bg-white border border-[#E2E8F0] rounded-xl shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Total Purchases</span>
          <span className="text-lg font-extrabold text-[#16324F] mt-1 block">
            {formatCurrency(supplier.totalPurchased)}
          </span>
          <span className="text-[11px] text-slate-500 mt-0.5 block">{supplier.purchases.length} total orders</span>
        </div>

        <div className="p-3.5 bg-white border border-[#E2E8F0] rounded-xl shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">Total Paid</span>
            <span className="p-1 rounded bg-emerald-50 text-emerald-600">
              <TrendingDown className="w-3.5 h-3.5" />
            </span>
          </div>
          <span className="text-lg font-extrabold text-emerald-700 mt-1 block">
            {formatCurrency(supplier.totalPaid)}
          </span>
          <span className="text-[11px] text-slate-500 mt-0.5 block">Total collections and payments</span>
        </div>

        <div className="p-3.5 bg-white border border-[#E2E8F0] rounded-xl shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">Current Balance</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={openAdjustModal}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1677C8] hover:text-[#0e5695] hover:underline cursor-pointer transition"
                title="Adjust Balance"
              >
                <Edit2 className="w-3 h-3" />
                <span>Edit</span>
              </button>
              <span className="p-1 rounded bg-amber-50 text-amber-600">
                <ArrowUpRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
          <span className="text-lg font-extrabold text-amber-700 mt-1 block">
            {formatCurrency(supplier.outstandingBalance)}
          </span>
          <span className="text-[11px] text-slate-500 mt-0.5 block">
            {supplier.outstandingBalance <= 0 ? 'Fully Paid' : 'Pending payment'}
          </span>
        </div>

        <div className="p-3.5 bg-white border border-[#E2E8F0] rounded-xl shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Opening Balance</span>
          <span className="text-lg font-extrabold text-[#16324F] mt-1 block">
            {formatCurrency(supplier.openingBalance)}
          </span>
          <span className="text-[11px] text-slate-500 mt-0.5 block">
            {supplier.openingBalanceType === 'RECEIVABLE' ? 'Receivable' : 'Payable'}
          </span>
        </div>
      </div>

      {/* ─── SUPPLIER BUSINESS DETAILS & ADDRESS ───────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-4 bg-white border border-[#E2E8F0] rounded-xl shadow-2xs text-xs space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
            Business & Tax Details
          </span>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">Company Name:</span>
              <span className="font-semibold text-[#16324F]">{supplier.companyName || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">GSTIN:</span>
              <span className="font-mono font-semibold text-[#16324F]">{supplier.gstin || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">PAN:</span>
              <span className="font-mono font-semibold text-[#16324F]">{supplier.pan || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Supplier Type:</span>
              <span className="font-semibold text-[#16324F]">{supplier.supplierType || '—'}</span>
            </div>
          </div>
        </div>

        <div className="p-4 bg-white border border-[#E2E8F0] rounded-xl shadow-2xs text-xs space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
            Address & Location
          </span>
          <div className="text-slate-700 leading-relaxed">
            {supplier.addressLine1 || supplier.city ? (
              <>
                {supplier.addressLine1 && <div>{supplier.addressLine1}</div>}
                {supplier.addressLine2 && <div>{supplier.addressLine2}</div>}
                <div>
                  {[supplier.city, supplier.state, supplier.pinCode].filter(Boolean).join(', ')}
                </div>
                <div>{supplier.country || 'India'}</div>
              </>
            ) : (
              <span className="text-slate-400">No address recorded</span>
            )}
          </div>
        </div>

        <div className="p-4 bg-white border border-[#E2E8F0] rounded-xl shadow-2xs text-xs space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Notes & Terms</span>
          <p className="text-slate-600 whitespace-pre-wrap leading-relaxed">
            {supplier.notes || 'No notes specified.'}
          </p>
          <div className="pt-2 text-[11px] text-slate-400 border-t border-slate-100">
            Registered on{' '}
            {new Date(supplier.createdAt).toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
          </div>
        </div>
      </div>

      {/* ─── TABS: PURCHASES & TRANSACTIONS / LEDGER ──────────────────── */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-2xs overflow-hidden">
        {/* Tab Headers */}
        <div className="px-4 border-b border-[#E2E8F0] bg-slate-50/70 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setActiveTab('purchases')}
              className={`py-3 text-xs font-bold transition-all relative border-b-2 cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'purchases'
                  ? 'border-[#1677C8] text-[#1677C8]'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>Purchases ({supplier.purchases.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('ledger')}
              className={`py-3 text-xs font-bold transition-all relative border-b-2 cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'ledger'
                  ? 'border-[#1677C8] text-[#1677C8]'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Transactions / Ledger ({supplier.transactions.length})</span>
            </button>
          </div>

          {activeTab === 'ledger' && (
            <div className="flex items-center gap-2 py-1.5">
              <select
                value={ledgerFilter}
                onChange={(e) => setLedgerFilter(e.target.value)}
                className="px-2.5 py-1 bg-white border border-[#E2E8F0] rounded-lg text-xs font-semibold text-[#16324F] focus:outline-none"
              >
                <option value="ALL">All Transactions</option>
                <option value="PURCHASES">Purchases Only</option>
                <option value="PAYMENTS">Payments Only</option>
                <option value="ADJUSTMENTS">Adjustments Only</option>
              </select>
            </div>
          )}
        </div>

        {/* ─── PURCHASES TABLE TAB ──────────────────────────────────── */}
        {activeTab === 'purchases' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-slate-50/40 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-2.5 px-3.5">Date</th>
                  <th className="py-2.5 px-3.5">Purchase No.</th>
                  <th className="py-2.5 px-3.5">Items</th>
                  <th className="py-2.5 px-3.5 text-right">Subtotal</th>
                  <th className="py-2.5 px-3.5 text-right">Tax</th>
                  <th className="py-2.5 px-3.5 text-right">Total</th>
                  <th className="py-2.5 px-3.5 text-right">Paid</th>
                  <th className="py-2.5 px-3.5 text-right">Pending</th>
                  <th className="py-2.5 px-3.5 text-center">Status</th>
                  <th className="py-2.5 px-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {supplier.purchases.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400">
                      No purchases recorded for this supplier yet.
                    </td>
                  </tr>
                ) : (
                  supplier.purchases.map((purchase) => {
                    const itemsCount = Array.isArray(purchase.items) ? purchase.items.length : 0;
                    const pending = getPurchasePending(purchase);
                    const paid = Number(purchase.amountPaid || 0);

                    return (
                      <tr key={purchase.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3.5 text-slate-600 whitespace-nowrap">
                          {new Date(purchase.purchaseDate).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="py-2.5 px-3.5 font-mono font-bold text-[#1677C8] whitespace-nowrap">
                          {purchase.purchaseNumber}
                        </td>
                        <td className="py-2.5 px-3.5 text-slate-600 whitespace-nowrap">
                          {itemsCount} {itemsCount === 1 ? 'item' : 'items'}
                        </td>
                        <td className="py-2.5 px-3.5 text-right text-slate-600 whitespace-nowrap">
                          {formatCurrency(purchase.subtotal)}
                        </td>
                        <td className="py-2.5 px-3.5 text-right text-slate-500 whitespace-nowrap">
                          {formatCurrency(purchase.tax)}
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-bold text-[#16324F] whitespace-nowrap">
                          {formatCurrency(purchase.total)}
                        </td>
                        <td className="py-2.5 px-3.5 text-right text-emerald-700 font-semibold whitespace-nowrap">
                          {formatCurrency(paid)}
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-semibold whitespace-nowrap">
                          {pending === 0 ? (
                            <span className="text-slate-400">₹0</span>
                          ) : (
                            <span className="text-amber-600 font-bold">{formatCurrency(pending)}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                          {getEffectiveStatusBadge(purchase)}
                        </td>
                        <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setViewingPurchase(purchase)}
                              title="View Purchase Details"
                              className="p-1.5 text-slate-500 hover:text-[#1677C8] hover:bg-slate-100 rounded-md transition cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            {pending > 0 && (
                              <button
                                type="button"
                                onClick={() => openCollectPurchaseModal(purchase)}
                                className="px-2 py-1 rounded text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition cursor-pointer"
                              >
                                Collect
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ─── TRANSACTIONS / LEDGER TAB ────────────────────────────── */}
        {activeTab === 'ledger' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-slate-50/40 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-2.5 px-3.5 whitespace-nowrap">Date & Time</th>
                  <th className="py-2.5 px-3.5 whitespace-nowrap">Type</th>
                  <th className="py-2.5 px-3.5 whitespace-nowrap">Reference</th>
                  <th className="py-2.5 px-3.5">Description</th>
                  <th className="py-2.5 px-3.5 text-right whitespace-nowrap">Total</th>
                  <th className="py-2.5 px-3.5 text-right whitespace-nowrap">Paid</th>
                  <th className="py-2.5 px-3.5 text-right whitespace-nowrap">Pending</th>
                  <th className="py-2.5 px-3.5 text-right whitespace-nowrap">Running Balance</th>
                  <th className="py-2.5 px-3.5 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      No ledger transactions found for this supplier.
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((tx) => {
                    const matchedPurchase =
                      tx.type === 'PURCHASE'
                        ? supplier.purchases.find(
                            (p) => p.id === tx.purchaseId || p.purchaseNumber === tx.reference,
                          )
                        : null;

                    const pendingVal = tx.pending !== undefined ? tx.pending : 0;
                    const hasPending = pendingVal > 0;

                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3.5 text-slate-600 whitespace-nowrap">
                          {formatTransactionTimestamp(tx.createdAt || tx.date)}
                        </td>
                        <td className="py-2.5 px-3.5 whitespace-nowrap">
                          {tx.type === 'PURCHASE' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-50 text-blue-700 border border-blue-200">
                              Purchase
                            </span>
                          ) : tx.type === 'BALANCE_ADJUSTMENT' || tx.type === 'ADJUSTMENT' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-50 text-purple-700 border border-purple-200">
                              Adjustment
                            </span>
                          ) : tx.type === 'OPENING_BALANCE' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
                              Opening
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-50 text-slate-700 border border-slate-200">
                              {tx.type}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3.5 font-mono font-bold text-[#1677C8] whitespace-nowrap">
                          {tx.reference || '—'}
                        </td>
                        <td className="py-2.5 px-3.5 text-slate-700 max-w-xs truncate" title={tx.description || ''}>
                          {tx.description || '—'}
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-bold text-[#16324F] whitespace-nowrap">
                          {formatCurrency(tx.total !== undefined ? tx.total : (tx.debit || 0))}
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-semibold text-emerald-700 whitespace-nowrap">
                          {formatCurrency(tx.paid !== undefined ? tx.paid : (tx.credit || 0))}
                        </td>
                        <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                          {hasPending ? (
                            <span className="text-amber-700 font-bold">{formatCurrency(pendingVal)}</span>
                          ) : (
                            <span className="text-slate-400">₹0</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-extrabold text-[#16324F] whitespace-nowrap">
                          {formatCurrency(tx.runningBalance !== undefined ? tx.runningBalance : (tx.balance || 0))}
                        </td>
                        <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {matchedPurchase && (
                              <button
                                type="button"
                                onClick={() => setViewingPurchase(matchedPurchase)}
                                title="View Purchase Details & Payments"
                                className="p-1.5 text-slate-500 hover:text-[#1677C8] hover:bg-slate-100 rounded-md transition cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {matchedPurchase && hasPending && (
                              <button
                                type="button"
                                onClick={() => openCollectPurchaseModal(matchedPurchase)}
                                className="px-2 py-1 rounded text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition cursor-pointer"
                              >
                                Collect
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── RECORD SUPPLIER PAYMENT MODAL ───────────────────────────── */}
      {isPaymentModalOpen && (() => {
        const enteredVal = parseFloat(paymentAmount);
        const validEntered = !isNaN(enteredVal) && enteredVal > 0;
        const remainingAfter = validEntered
          ? Math.max(0, Number((supplier.outstandingBalance - enteredVal).toFixed(2)))
          : supplier.outstandingBalance;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-100">
            <div className="bg-white border border-[#E2E8F0] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
              {/* Header */}
              <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between bg-slate-50/70">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-[#16324F]">Record Supplier Payment</h2>
                    <p className="text-[11px] text-[#64748B]">{supplier.name}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  disabled={isRecordingPayment}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <form onSubmit={handleRecordPayment} className="p-5 space-y-4 text-xs">
                {/* Balance Summary Box */}
                <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200 flex items-center justify-between">
                  <span className="text-slate-600 font-medium">Current Outstanding Balance:</span>
                  <span className="text-sm font-extrabold text-amber-700">
                    {formatCurrency(supplier.outstandingBalance)}
                  </span>
                </div>

                {/* Amount Input */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-[#16324F]">
                      Payment Amount <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentAmount(String(supplier.outstandingBalance));
                        setPaymentError('');
                      }}
                      className="text-[11px] font-semibold text-[#1677C8] hover:underline cursor-pointer"
                    >
                      Pay Full Amount ({formatCurrency(supplier.outstandingBalance)})
                    </button>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-semibold">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={supplier.outstandingBalance}
                      value={paymentAmount}
                      onChange={(e) => {
                        setPaymentAmount(e.target.value);
                        setPaymentError('');
                      }}
                      placeholder="Enter amount"
                      autoFocus
                      required
                      className="w-full pl-7 pr-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-xs font-semibold text-[#16324F] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Date & Payment Method */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Payment Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      required
                      className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-xs text-[#16324F] focus:outline-none focus:ring-1 focus:ring-[#1677C8]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Payment Method</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-xs font-medium text-[#16324F] focus:outline-none focus:ring-1 focus:ring-[#1677C8]"
                    >
                      <option value="Bank Transfer">Bank Transfer / NEFT</option>
                      <option value="UPI">UPI</option>
                      <option value="Cash">Cash</option>
                      <option value="Cheque">Cheque</option>
                      <option value="Credit / Debit Card">Credit / Debit Card</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                {/* Reference ID */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Reference / Transaction ID</label>
                  <input
                    type="text"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    placeholder="e.g. UTR / Cheque No. / Transaction ID"
                    className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-xs text-[#16324F] placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#1677C8]"
                  />
                </div>

                {/* Notes */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Notes (Optional)</label>
                  <input
                    type="text"
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    placeholder="e.g. Payment for invoice clearance"
                    className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-xs text-[#16324F] placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#1677C8]"
                  />
                </div>

                {/* Remaining Balance Preview */}
                {validEntered && (
                  <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/60 flex items-center justify-between text-xs">
                    <span className="text-slate-600 font-medium">Remaining Outstanding:</span>
                    {remainingAfter <= 0 ? (
                      <span className="font-bold text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        ₹0 (Fully Settled)
                      </span>
                    ) : (
                      <span className="font-bold text-amber-600">{formatCurrency(remainingAfter)}</span>
                    )}
                  </div>
                )}

                {/* Error */}
                {paymentError && (
                  <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{paymentError}</span>
                  </div>
                )}

                {/* Footer Buttons */}
                <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPaymentModalOpen(false)}
                    disabled={isRecordingPayment}
                    className="px-3.5 py-2 border border-slate-300 bg-white hover:bg-slate-50 rounded-lg text-xs font-bold text-[#16324F] transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isRecordingPayment}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    {isRecordingPayment ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Recording...</span>
                      </>
                    ) : (
                      <span>Save Payment</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* ─── EDIT SUPPLIER MODAL ─────────────────────────────────────── */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#1677C8]/10 text-[#1677C8] flex items-center justify-center font-bold">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#16324F]">Edit Supplier Profile</h2>
                  <p className="text-xs text-[#64748B]">Update supplier profile details, tax identifiers, and address</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              {/* Basic Information */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-[#16324F] uppercase tracking-wider pb-1 border-b border-slate-100">
                  Basic Information
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="font-semibold text-slate-700 block mb-1">
                      Supplier Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="e.g. Apex Beverages Ltd."
                      required
                      className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-xs font-semibold text-[#16324F] focus:outline-none focus:ring-1 focus:ring-[#1677C8]"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Contact Person</label>
                    <input
                      type="text"
                      value={editContactPerson}
                      onChange={(e) => setEditContactPerson(e.target.value)}
                      placeholder="e.g. Rajesh Kumar"
                      className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-xs text-[#16324F] focus:outline-none focus:ring-1 focus:ring-[#1677C8]"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Phone Number</label>
                    <input
                      type="text"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      placeholder="e.g. +91 9876543210"
                      className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-xs text-[#16324F] focus:outline-none focus:ring-1 focus:ring-[#1677C8]"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="font-semibold text-slate-700 block mb-1">Email Address</label>
                    <input
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
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
                      value={editCompanyName}
                      onChange={(e) => setEditCompanyName(e.target.value)}
                      placeholder="e.g. Apex Industrial Waters LLP"
                      className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-xs text-[#16324F] focus:outline-none focus:ring-1 focus:ring-[#1677C8]"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Supplier Type</label>
                    <select
                      value={editSupplierType}
                      onChange={(e) => setEditSupplierType(e.target.value)}
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
                      value={editGstin}
                      onChange={(e) => setEditGstin(e.target.value.toUpperCase())}
                      placeholder="e.g. 29ABCDE1234F1Z5"
                      className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-xs uppercase font-mono text-[#16324F] focus:outline-none focus:ring-1 focus:ring-[#1677C8]"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">PAN</label>
                    <input
                      type="text"
                      value={editPan}
                      onChange={(e) => setEditPan(e.target.value.toUpperCase())}
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
                      value={editAddressLine1}
                      onChange={(e) => setEditAddressLine1(e.target.value)}
                      placeholder="Street address, building, premises..."
                      className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-xs text-[#16324F] focus:outline-none focus:ring-1 focus:ring-[#1677C8]"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="font-semibold text-slate-700 block mb-1">Address Line 2</label>
                    <input
                      type="text"
                      value={editAddressLine2}
                      onChange={(e) => setEditAddressLine2(e.target.value)}
                      placeholder="Apartment, suite, unit, floor..."
                      className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-xs text-[#16324F] focus:outline-none focus:ring-1 focus:ring-[#1677C8]"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">City</label>
                    <input
                      type="text"
                      value={editCity}
                      onChange={(e) => setEditCity(e.target.value)}
                      placeholder="City"
                      className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-xs text-[#16324F] focus:outline-none focus:ring-1 focus:ring-[#1677C8]"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">State</label>
                    <input
                      type="text"
                      value={editState}
                      onChange={(e) => setEditState(e.target.value)}
                      placeholder="State"
                      className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-xs text-[#16324F] focus:outline-none focus:ring-1 focus:ring-[#1677C8]"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">PIN Code</label>
                    <input
                      type="text"
                      value={editPinCode}
                      onChange={(e) => setEditPinCode(e.target.value)}
                      placeholder="PIN Code"
                      className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-xs text-[#16324F] focus:outline-none focus:ring-1 focus:ring-[#1677C8]"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Country</label>
                    <input
                      type="text"
                      value={editCountry}
                      onChange={(e) => setEditCountry(e.target.value)}
                      placeholder="Country"
                      className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-xs text-[#16324F] focus:outline-none focus:ring-1 focus:ring-[#1677C8]"
                    />
                  </div>
                </div>
              </div>

              {/* Notes & Status */}
              <div className="space-y-3 pt-2">
                <h3 className="text-xs font-bold text-[#16324F] uppercase tracking-wider pb-1 border-b border-slate-100">
                  Notes & Status
                </h3>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Notes & Terms</label>
                  <textarea
                    rows={2}
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Payment terms, delivery preferences, or general notes..."
                    className="w-full px-3 py-1.5 bg-white border border-[#E2E8F0] rounded-lg text-xs text-[#16324F] focus:outline-none focus:ring-1 focus:ring-[#1677C8] resize-none"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="editIsActive"
                    checked={editIsActive}
                    onChange={(e) => setEditIsActive(e.target.checked)}
                    className="w-4 h-4 text-[#1677C8] rounded border-slate-300 focus:ring-[#1677C8] cursor-pointer"
                  />
                  <label htmlFor="editIsActive" className="font-semibold text-slate-700 cursor-pointer">
                    Supplier is Active
                  </label>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 bg-white hover:bg-slate-50 rounded-lg text-xs font-bold text-[#16324F] transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-5 py-2 bg-[#1677C8] hover:bg-[#125ea0] disabled:opacity-50 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  {isSavingEdit ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── READ-ONLY PURCHASE DETAILS MODAL ───────────────────────── */}
      {viewingPurchase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#1677C8]/10 text-[#1677C8] flex items-center justify-center font-bold">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-[#16324F]">Purchase Details</h2>
                    <span className="font-mono text-xs font-bold text-[#1677C8] bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                      {viewingPurchase.purchaseNumber}
                    </span>
                  </div>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Recorded on {new Date(viewingPurchase.purchaseDate).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingPurchase(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/60">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Supplier</span>
                  <span className="text-xs font-bold text-[#16324F] mt-0.5 block truncate">
                    {viewingPurchase.supplierName}
                  </span>
                </div>
                <div className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/60">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Reference / Bill</span>
                  <span className="text-xs font-semibold text-slate-700 mt-0.5 block truncate">
                    {viewingPurchase.referenceNumber || '—'}
                  </span>
                </div>
                <div className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/60 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Payment Status</span>
                    <div className="mt-1">{getEffectiveStatusBadge(viewingPurchase)}</div>
                  </div>
                </div>
              </div>

              {/* Items List */}
              <div className="border border-[#E2E8F0] rounded-xl overflow-hidden">
                <div className="px-3.5 py-2 bg-slate-50/80 border-b border-[#E2E8F0] font-bold text-[11px] text-[#64748B] uppercase tracking-wider flex justify-between">
                  <span>Purchased Items ({Array.isArray(viewingPurchase.items) ? viewingPurchase.items.length : 0})</span>
                  <span>
                    Total Units:{' '}
                    {Array.isArray(viewingPurchase.items)
                      ? viewingPurchase.items.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0)
                      : 0}
                  </span>
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/40 text-[10px] text-slate-500 uppercase font-semibold border-b border-slate-100">
                    <tr>
                      <th className="py-2 px-3">Item / Product</th>
                      <th className="py-2 px-3 text-center">Qty</th>
                      <th className="py-2 px-3 text-right">Rate</th>
                      <th className="py-2 px-3 text-right">Tax</th>
                      <th className="py-2 px-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {Array.isArray(viewingPurchase.items) && viewingPurchase.items.length > 0 ? (
                      viewingPurchase.items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 font-semibold text-[#16324F]">{item.productName}</td>
                          <td className="py-2.5 px-3 text-center text-slate-600">{item.quantity}</td>
                          <td className="py-2.5 px-3 text-right text-slate-600">{formatCurrency(item.rate)}</td>
                          <td className="py-2.5 px-3 text-right text-slate-500">
                            {item.taxPercent ? `${item.taxPercent}%` : '0%'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-[#16324F]">{formatCurrency(item.amount)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-4 text-center text-slate-400">
                          No items listed
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Payment History */}
              {Array.isArray(viewingPurchase.payments) && viewingPurchase.payments.length > 0 && (
                <div className="border border-[#E2E8F0] rounded-xl overflow-hidden">
                  <div className="px-3.5 py-2 bg-slate-50/80 border-b border-[#E2E8F0] font-bold text-[11px] text-[#64748B] uppercase tracking-wider flex justify-between items-center">
                    <span>Payment History ({viewingPurchase.payments.length})</span>
                    <span className="text-emerald-700">Total Paid: {formatCurrency(Number(viewingPurchase.amountPaid || 0))}</span>
                  </div>
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/40 text-[10px] text-slate-500 uppercase font-semibold border-b border-slate-100">
                      <tr>
                        <th className="py-2 px-3">Date</th>
                        <th className="py-2 px-3">Description / Note</th>
                        <th className="py-2 px-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {viewingPurchase.payments.map((p, pIdx) => (
                        <tr key={p.id || pIdx} className="hover:bg-slate-50/50">
                          <td className="py-2 px-3 text-slate-600 whitespace-nowrap">
                            {new Date(p.date).toLocaleString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="py-2 px-3 text-slate-700">{p.notes || 'Payment recorded'}</td>
                          <td className="py-2 px-3 text-right font-bold text-emerald-700 whitespace-nowrap">
                            +{formatCurrency(p.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Financial Totals */}
              <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/60 space-y-1.5 ml-auto max-w-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span className="font-medium text-slate-800">{formatCurrency(viewingPurchase.subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Tax:</span>
                  <span className="font-medium text-slate-800">{formatCurrency(viewingPurchase.tax)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-[#16324F] pt-1.5 border-t border-slate-200">
                  <span>Grand Total:</span>
                  <span className="text-[#1677C8]">{formatCurrency(viewingPurchase.total)}</span>
                </div>
                <div className="flex justify-between text-emerald-700 font-semibold pt-1 border-t border-slate-200">
                  <span>Already Paid:</span>
                  <span>{formatCurrency(Number(viewingPurchase.amountPaid || 0))}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span className={getPurchasePending(viewingPurchase) > 0 ? 'text-amber-700' : 'text-slate-600'}>
                    Pending Amount:
                  </span>
                  <span className={getPurchasePending(viewingPurchase) > 0 ? 'text-amber-700' : 'text-slate-400 font-medium'}>
                    {getPurchasePending(viewingPurchase) === 0 ? '₹0' : formatCurrency(getPurchasePending(viewingPurchase))}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-[#E2E8F0] flex items-center justify-end bg-slate-50/40">
              <button
                type="button"
                onClick={() => setViewingPurchase(null)}
                className="px-4 py-2 border border-slate-300 bg-white hover:bg-slate-50 rounded-lg text-xs font-bold text-[#16324F] transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── ADJUST BALANCE MODAL ────────────────────────────────────── */}
      {isAdjustModalOpen && supplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 border border-purple-200 flex items-center justify-center">
                  <SlidersHorizontal className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[#16324F]">Adjust Current Balance</h2>
                  <p className="text-[11px] text-[#64748B]">{supplier.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAdjustModalOpen(false)}
                disabled={isSavingAdjust}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleAdjustBalance} className="p-5 space-y-4 text-xs">
              {/* Balance Summary Box */}
              <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 font-medium">Current Outstanding Balance:</span>
                  <span className="text-sm font-extrabold text-[#16324F]">
                    {formatCurrency(supplier.outstandingBalance)}
                  </span>
                </div>
                {adjustNewBalance !== '' && !isNaN(parseFloat(adjustNewBalance)) && (
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/80">
                    <span className="text-slate-500 font-medium">Adjustment Delta:</span>
                    <span
                      className={`text-xs font-bold ${
                        parseFloat(adjustNewBalance) - supplier.outstandingBalance > 0
                          ? 'text-amber-700'
                          : parseFloat(adjustNewBalance) - supplier.outstandingBalance < 0
                          ? 'text-emerald-700'
                          : 'text-slate-500'
                      }`}
                    >
                      {parseFloat(adjustNewBalance) - supplier.outstandingBalance > 0 ? '+' : ''}
                      {formatCurrency(parseFloat(adjustNewBalance) - supplier.outstandingBalance)}
                    </span>
                  </div>
                )}
              </div>

              {/* New Balance Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#16324F]">
                    New Balance (Amount Owed) <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setAdjustNewBalance('0');
                      setAdjustError('');
                    }}
                    className="text-[11px] font-semibold text-[#1677C8] hover:underline cursor-pointer"
                  >
                    Set to ₹0 (Clear/Settled)
                  </button>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-semibold">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    value={adjustNewBalance}
                    onChange={(e) => {
                      setAdjustNewBalance(e.target.value);
                      setAdjustError('');
                    }}
                    placeholder="Enter new balance"
                    autoFocus
                    required
                    className="w-full pl-7 pr-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-xs font-semibold text-[#16324F] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  Creates an auditable adjustment transaction without modifying past purchases or payments.
                </p>
              </div>

              {/* Reason / Note Input (Required for auditability) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#16324F]">
                  Reason for Adjustment <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={adjustReason}
                  onChange={(e) => {
                    setAdjustReason(e.target.value);
                    setAdjustError('');
                  }}
                  placeholder="e.g., Reconciliation discrepancy, negotiated discount, opening balance correction..."
                  required
                  className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-xs font-medium text-[#16324F] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
                />
              </div>

              {/* Reference */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Reference / Memo (Optional)
                </label>
                <input
                  type="text"
                  value={adjustReference}
                  onChange={(e) => setAdjustReference(e.target.value)}
                  placeholder="e.g., ADJ-2026-001"
                  className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-xs font-medium text-[#16324F] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Error message */}
              {adjustError && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{adjustError}</span>
                </div>
              )}

              {/* Footer */}
              <div className="pt-2 border-t border-[#E2E8F0] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  disabled={isSavingAdjust}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingAdjust}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  {isSavingAdjust ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Adjustment</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── COLLECT PURCHASE PAYMENT MODAL ───────────────────────── */}
      {collectingPurchase && (() => {
        const pending = getPurchasePending(collectingPurchase);
        const enteredVal = parseFloat(collectionAmount);
        const validEntered = !isNaN(enteredVal) && enteredVal > 0;
        const remainingAfter = validEntered
          ? Math.max(0, Number((pending - enteredVal).toFixed(2)))
          : pending;
        const purchaseRef = collectingPurchase.purchaseNumber || collectingPurchase.reference || 'Purchase';

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-100">
            <div className="bg-white border border-[#E2E8F0] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
              {/* Header */}
              <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between bg-slate-50/70">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-[#16324F]">Record Purchase Payment</h2>
                    <p className="text-[11px] text-[#64748B] font-mono">{purchaseRef}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCollectingPurchase(null)}
                  disabled={isCollecting}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <form onSubmit={handleCollectPurchase} className="p-5 space-y-4 text-xs">
                {/* Summary Box */}
                <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Purchase Total:</span>
                    <span className="font-bold text-[#16324F]">
                      {formatCurrency(collectingPurchase.total)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-emerald-700">
                    <span>Already Paid:</span>
                    <span className="font-semibold">
                      {formatCurrency(
                        collectingPurchase.paid !== undefined
                          ? collectingPurchase.paid
                          : collectingPurchase.amountPaid || 0
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1.5 border-t border-slate-200 font-bold">
                    <span className="text-amber-700">Remaining Pending:</span>
                    <span className="text-sm text-amber-700">
                      {formatCurrency(pending)}
                    </span>
                  </div>
                </div>

                {/* Amount Input */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-[#16324F]">
                      Collection / Payment Amount <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setCollectionAmount(String(pending));
                        setCollectionError('');
                      }}
                      className="text-[11px] font-semibold text-[#1677C8] hover:underline cursor-pointer"
                    >
                      Pay Full ({formatCurrency(pending)})
                    </button>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-semibold">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={pending}
                      value={collectionAmount}
                      onChange={(e) => {
                        setCollectionAmount(e.target.value);
                        setCollectionError('');
                      }}
                      placeholder="Enter amount"
                      autoFocus
                      required
                      className="w-full pl-7 pr-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-xs font-semibold text-[#16324F] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Notes Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Notes / Reference (Optional)</label>
                  <input
                    type="text"
                    value={collectionNotes}
                    onChange={(e) => setCollectionNotes(e.target.value)}
                    placeholder="e.g. UPI / Cheque / Bank Transfer Ref"
                    className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-xs text-[#16324F] placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#1677C8]"
                  />
                </div>

                {/* Remaining Pending Preview */}
                {validEntered && (
                  <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/60 flex items-center justify-between text-xs">
                    <span className="text-slate-600 font-medium">Pending After Payment:</span>
                    {remainingAfter <= 0 ? (
                      <span className="font-bold text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        ₹0 (Fully Paid)
                      </span>
                    ) : (
                      <span className="font-bold text-amber-600">{formatCurrency(remainingAfter)}</span>
                    )}
                  </div>
                )}

                {/* Error */}
                {collectionError && (
                  <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{collectionError}</span>
                  </div>
                )}

                {/* Footer Buttons */}
                <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setCollectingPurchase(null)}
                    disabled={isCollecting}
                    className="px-3.5 py-2 border border-slate-300 bg-white hover:bg-slate-50 rounded-lg text-xs font-bold text-[#16324F] transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCollecting}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    {isCollecting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Recording...</span>
                      </>
                    ) : (
                      <span>Save Payment</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}
      </div>
    </div>
  );
}
