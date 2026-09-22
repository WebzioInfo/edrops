import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Plus,
  Search,
  RefreshCw,
  Edit2,
  Trash2,
  X,
  CheckCircle2,
  Clock,
  AlertCircle,
  Package,
  ShoppingCart,
  Eye,
  Building2,
  ChevronDown,
} from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';
import { toast } from 'react-hot-toast';

export interface PurchaseItem {
  productId?: string;
  productName: string;
  quantity: number;
  rate: number;
  taxPercent?: number;
  amount: number;
}

export interface PaymentRecord {
  id: string;
  amount: number;
  date: string;
  notes?: string;
}

export interface PurchaseRecord {
  id: string;
  purchaseNumber: string;
  purchaseDate: string;
  supplierName: string;
  supplierId?: string | null;
  supplier?: { id: string; name: string; companyName?: string } | null;
  referenceNumber?: string | null;
  items: PurchaseItem[];
  subtotal: number;
  tax: number;
  total: number;
  paymentStatus: 'PAID' | 'PENDING' | 'PARTIAL' | 'CANCELLED';
  amountPaid?: number | null;
  payments?: PaymentRecord[];
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CatalogProduct {
  id: string;
  name: string;
  price: number;
}

export default function Purchases() {
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingPurchase, setEditingPurchase] = useState<PurchaseRecord | null>(null);
  const [viewingPurchase, setViewingPurchase] = useState<PurchaseRecord | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [deleteConfirmPurchase, setDeleteConfirmPurchase] = useState<PurchaseRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Payment collection modal states
  const [collectingPurchase, setCollectingPurchase] = useState<PurchaseRecord | null>(null);
  const [collectAmount, setCollectAmount] = useState<string>('');
  const [collectNotes, setCollectNotes] = useState<string>('');
  const [collectError, setCollectError] = useState<string>('');
  const [isCollecting, setIsCollecting] = useState<boolean>(false);

  // Form states
  const location = useLocation();
  const [suppliersList, setSuppliersList] = useState<Array<{ id: string; name: string; companyName?: string | null }>>([]);
  const [supplierId, setSupplierId] = useState<string>('');
  const [supplierName, setSupplierName] = useState<string>('');
  const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = useState<boolean>(false);
  const [isQuickSupplierModalOpen, setIsQuickSupplierModalOpen] = useState<boolean>(false);
  const [quickSupplierName, setQuickSupplierName] = useState<string>('');
  const [quickSupplierContactPerson, setQuickSupplierContactPerson] = useState<string>('');
  const [quickSupplierPhone, setQuickSupplierPhone] = useState<string>('');
  const [quickSupplierEmail, setQuickSupplierEmail] = useState<string>('');
  const [quickSupplierGstin, setQuickSupplierGstin] = useState<string>('');
  const [quickSupplierAddress, setQuickSupplierAddress] = useState<string>('');
  const [quickSupplierNotes, setQuickSupplierNotes] = useState<string>('');
  const [isCreatingQuickSupplier, setIsCreatingQuickSupplier] = useState<boolean>(false);

  const [purchaseDate, setPurchaseDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [paymentStatus, setPaymentStatus] = useState<'PAID' | 'PENDING' | 'PARTIAL' | 'CANCELLED'>('PAID');
  const [amountPaid, setAmountPaid] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [activeDropdownIndex, setActiveDropdownIndex] = useState<number | null>(null);
  const [formItems, setFormItems] = useState<PurchaseItem[]>([
    { productName: '', quantity: 1, rate: 0, taxPercent: 5, amount: 0 },
  ]);

  const loadPurchases = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (search.trim()) params.append('search', search.trim());
      if (statusFilter !== 'ALL') params.append('status', statusFilter);

      const qs = params.toString() ? `?${params.toString()}` : '';
      const data = await fetchWithAuth(`/purchases${qs}`);
      if (Array.isArray(data)) {
        const sorted = [...data].sort((a, b) => {
          const dateA = new Date(a.purchaseDate).getTime();
          const dateB = new Date(b.purchaseDate).getTime();
          if (dateB !== dateA) return dateB - dateA;
          const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return createdB - createdA;
        });
        setPurchases(sorted);
      } else {
        setPurchases([]);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load purchases');
    } finally {
      setIsLoading(false);
    }
  };

  const loadSuppliersList = async () => {
    try {
      const data = await fetchWithAuth('/suppliers');
      if (Array.isArray(data)) {
        setSuppliersList(
          data.map((s: any) => ({
            id: s.id,
            name: s.name,
            companyName: s.companyName,
          }))
        );
      }
    } catch {
      // Non-critical
    }
  };

  const loadCatalogProducts = async () => {
    try {
      const data = await fetchWithAuth('/catalog/products');
      if (Array.isArray(data)) {
        setCatalogProducts(
          data.map((p: any) => ({
            id: p.id,
            name: p.name,
            price: Number(p.price) || 0,
          }))
        );
      }
    } catch {
      // Non-critical, fallback to manual entry
    }
  };

  useEffect(() => {
    loadPurchases();
    loadSuppliersList();
    loadCatalogProducts();
  }, []);

  // Handle URL query param for preselecting supplier from suppliers page
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const qSupplierId = params.get('supplierId');
    if (qSupplierId && suppliersList.length > 0) {
      const target = suppliersList.find((s) => s.id === qSupplierId);
      if (target) {
        setSupplierId(target.id);
        setSupplierName(target.name);
        setIsModalOpen(true);
      }
    }
  }, [location.search, suppliersList]);

  // Debounced search / filter trigger
  useEffect(() => {
    const timer = setTimeout(() => {
      loadPurchases();
    }, 250);
    return () => clearTimeout(timer);
  }, [search, statusFilter]);

  // Real-time calculations for form
  const subtotal = useMemo(() => {
    return formItems.reduce((acc, item) => acc + (Number(item.quantity) || 0) * (Number(item.rate) || 0), 0);
  }, [formItems]);

  const totalTax = useMemo(() => {
    return formItems.reduce((acc, item) => {
      const base = (Number(item.quantity) || 0) * (Number(item.rate) || 0);
      const taxRate = (Number(item.taxPercent) || 0) / 100;
      return acc + base * taxRate;
    }, 0);
  }, [formItems]);

  const grandTotal = subtotal + totalTax;

  const parsedAmountPaid = useMemo(() => {
    if (paymentStatus === 'PAID') return grandTotal;
    if (paymentStatus === 'PENDING') return 0;
    const n = parseFloat(amountPaid);
    return isNaN(n) ? 0 : n;
  }, [paymentStatus, grandTotal, amountPaid]);

  const balanceDue = useMemo(() => {
    if (paymentStatus === 'PAID') return 0;
    if (paymentStatus === 'PENDING') return grandTotal;
    return Math.max(0, Number((grandTotal - parsedAmountPaid).toFixed(2)));
  }, [paymentStatus, grandTotal, parsedAmountPaid]);

  const handlePaymentStatusChange = (status: 'PAID' | 'PENDING' | 'PARTIAL') => {
    setPaymentStatus(status);
    if (status !== 'PARTIAL') {
      setAmountPaid('');
    }
  };

  const getFilteredCatalogProducts = (query: string) => {
    if (!query || !query.trim()) return catalogProducts;
    const q = query.toLowerCase().trim();
    return catalogProducts.filter((p) => p.name.toLowerCase().includes(q));
  };

  const filteredSuppliers = useMemo(() => {
    if (!supplierName || !supplierName.trim()) return suppliersList;
    const q = supplierName.toLowerCase().trim();
    return suppliersList.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.companyName && s.companyName.toLowerCase().includes(q))
    );
  }, [suppliersList, supplierName]);

  const openCreateModal = (preselectedSupplierId?: string | React.MouseEvent) => {
    setEditingPurchase(null);
    const supplierKey = typeof preselectedSupplierId === 'string' ? preselectedSupplierId : undefined;
    if (supplierKey) {
      const found = suppliersList.find((s) => s.id === supplierKey);
      if (found) {
        setSupplierId(found.id);
        setSupplierName(found.name);
      } else {
        setSupplierId(supplierKey);
        setSupplierName('');
      }
    } else {
      setSupplierId('');
      setSupplierName('');
    }
    setPurchaseDate(new Date().toISOString().split('T')[0]);
    setReferenceNumber('');
    setPaymentStatus('PAID');
    setAmountPaid('');
    setNotes('');
    setFormItems([{ productName: '', quantity: 1, rate: 0, taxPercent: 5, amount: 0 }]);
    setActiveDropdownIndex(null);
    setIsSupplierDropdownOpen(false);
    setIsModalOpen(true);
  };

  const openEditModal = (purchase: PurchaseRecord) => {
    setEditingPurchase(purchase);
    setSupplierId(purchase.supplierId || '');
    setSupplierName(purchase.supplierName);
    setPurchaseDate(new Date(purchase.purchaseDate).toISOString().split('T')[0]);
    setReferenceNumber(purchase.referenceNumber || '');
    setPaymentStatus(purchase.paymentStatus);
    setAmountPaid(
      purchase.paymentStatus === 'PARTIAL' && purchase.amountPaid !== undefined && purchase.amountPaid !== null
        ? String(purchase.amountPaid)
        : ''
    );
    setNotes(purchase.notes || '');
    setFormItems(
      Array.isArray(purchase.items) && purchase.items.length
        ? purchase.items.map((it) => {
            const q = Number(it.quantity) || 1;
            const r = Number(it.rate) || 0;
            return {
              productId: it.productId,
              productName: it.productName,
              quantity: q,
              rate: r,
              taxPercent: it.taxPercent !== undefined ? Number(it.taxPercent) : 5,
              amount: Number((q * r).toFixed(2)),
            };
          })
        : [{ productName: '', quantity: 1, rate: 0, taxPercent: 5, amount: 0 }]
    );
    setActiveDropdownIndex(null);
    setIsSupplierDropdownOpen(false);
    setIsModalOpen(true);
  };

  const openQuickSupplierModal = (initialName?: string) => {
    setQuickSupplierName(typeof initialName === 'string' ? initialName : supplierName || '');
    setQuickSupplierContactPerson('');
    setQuickSupplierPhone('');
    setQuickSupplierEmail('');
    setQuickSupplierGstin('');
    setQuickSupplierAddress('');
    setQuickSupplierNotes('');
    setIsQuickSupplierModalOpen(true);
  };

  const handleCreateQuickSupplier = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!quickSupplierName.trim()) {
      toast.error('Supplier name is required');
      return;
    }
    try {
      setIsCreatingQuickSupplier(true);
      const payload: any = {
        name: quickSupplierName.trim(),
      };
      if (quickSupplierContactPerson.trim()) payload.contactPerson = quickSupplierContactPerson.trim();
      if (quickSupplierPhone.trim()) payload.phone = quickSupplierPhone.trim();
      if (quickSupplierEmail.trim()) payload.email = quickSupplierEmail.trim();
      if (quickSupplierGstin.trim()) payload.gstin = quickSupplierGstin.trim().toUpperCase();
      if (quickSupplierAddress.trim()) payload.addressLine1 = quickSupplierAddress.trim();
      if (quickSupplierNotes.trim()) payload.notes = quickSupplierNotes.trim();

      const created = await fetchWithAuth('/suppliers', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      toast.success(`Supplier "${created.name}" created and selected!`);
      setSuppliersList((prev) => {
        const next = [...prev, { id: created.id, name: created.name, companyName: created.companyName }];
        return next.sort((a, b) => a.name.localeCompare(b.name));
      });
      setSupplierId(created.id);
      setSupplierName(created.name);
      setIsSupplierDropdownOpen(false);
      setIsQuickSupplierModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create supplier');
    } finally {
      setIsCreatingQuickSupplier(false);
    }
  };

  const handleItemChange = (index: number, field: keyof PurchaseItem, value: any) => {
    setFormItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };

      if (field === 'productName') {
        const found = catalogProducts.find(
          (p) => p.name.toLowerCase() === String(value).trim().toLowerCase()
        );
        if (found) {
          item.productId = found.id;
          if (!item.rate) item.rate = found.price;
        } else {
          item.productId = undefined;
        }
      }

      const q = Number(item.quantity) || 0;
      const r = Number(item.rate) || 0;
      item.amount = Number((q * r).toFixed(2));

      updated[index] = item;
      return updated;
    });
  };

  const handleSelectProduct = (index: number, product: CatalogProduct) => {
    setFormItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[index] };
      item.productName = product.name;
      item.productId = product.id;
      item.rate = product.price;
      const q = Number(item.quantity) || 1;
      item.amount = Number((q * product.price).toFixed(2));
      updated[index] = item;
      return updated;
    });
    setActiveDropdownIndex(null);
  };

  const addItemRow = () => {
    setFormItems((prev) => [
      ...prev,
      { productName: '', quantity: 1, rate: 0, taxPercent: 5, amount: 0 },
    ]);
  };

  const removeItemRow = (index: number) => {
    if (formItems.length <= 1) {
      toast.error('At least one item is required');
      return;
    }
    setFormItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSavePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierName.trim()) {
      toast.error('Please enter a supplier name');
      return;
    }

    const validItems = formItems.filter((it) => it.productName.trim() && it.quantity > 0);
    if (!validItems.length) {
      toast.error('Please add at least one item with a valid product name and quantity');
      return;
    }

    if (paymentStatus === 'PARTIAL') {
      const val = parseFloat(amountPaid);
      if (isNaN(val) || val <= 0) {
        toast.error('Please enter an amount paid greater than ₹0 for partial payment');
        return;
      }
      if (val > grandTotal) {
        toast.error(`Amount paid cannot exceed total amount of ${formatCurrency(grandTotal)}`);
        return;
      }
    }

    try {
      setIsSubmitting(true);
      const payload = {
        supplierName: supplierName.trim(),
        supplierId: supplierId || undefined,
        purchaseDate,
        referenceNumber: referenceNumber.trim() || undefined,
        items: validItems.map((it) => ({
          productId: it.productId,
          productName: it.productName.trim(),
          quantity: Number(it.quantity),
          rate: Number(it.rate),
          taxPercent: Number(it.taxPercent) || 0,
          amount: Number(it.amount),
        })),
        subtotal: Math.round(subtotal * 100) / 100,
        tax: Math.round(totalTax * 100) / 100,
        total: Math.round(grandTotal * 100) / 100,
        paymentStatus,
        amountPaid:
          paymentStatus === 'PARTIAL'
            ? parseFloat(amountPaid)
            : paymentStatus === 'PAID'
            ? Math.round(grandTotal * 100) / 100
            : 0,
        notes: notes.trim() || undefined,
      };

      if (editingPurchase) {
        await fetchWithAuth(`/purchases/${editingPurchase.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        toast.success(`Purchase ${editingPurchase.purchaseNumber} updated!`);
      } else {
        const created = await fetchWithAuth('/purchases', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast.success(`Purchase ${created.purchaseNumber || ''} created!`);
      }

      setIsModalOpen(false);
      await loadPurchases();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save purchase');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePurchase = async () => {
    if (!deleteConfirmPurchase) return;
    try {
      setIsDeleting(true);
      await fetchWithAuth(`/purchases/${deleteConfirmPurchase.id}`, {
        method: 'DELETE',
      });
      toast.success(`Purchase ${deleteConfirmPurchase.purchaseNumber} deleted successfully`);
      setDeleteConfirmPurchase(null);
      loadPurchases();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete purchase');
    } finally {
      setIsDeleting(false);
    }
  };

  const getPaidAmount = (p: PurchaseRecord): number => {
    if (p.amountPaid !== undefined && p.amountPaid !== null) {
      return Number(p.amountPaid) || 0;
    }
    if (p.paymentStatus === 'PAID') return p.total;
    return 0;
  };

  const getPendingAmount = (p: PurchaseRecord): number => {
    const paid = getPaidAmount(p);
    return Math.max(0, Number((p.total - paid).toFixed(2)));
  };

  const getEffectivePaymentStatus = (p: PurchaseRecord): string => {
    if (p.paymentStatus === 'CANCELLED') return 'CANCELLED';
    const pending = getPendingAmount(p);
    const paid = getPaidAmount(p);
    if (pending <= 0) return 'FULLY PAID';
    if (paid > 0) return 'PARTIAL';
    return 'PENDING';
  };

  const openCollectModal = (purchase: PurchaseRecord) => {
    setCollectingPurchase(purchase);
    setCollectAmount('');
    setCollectNotes('');
    setCollectError('');
  };

  const handleCollectPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collectingPurchase) return;

    const pending = getPendingAmount(collectingPurchase);
    const amountNum = parseFloat(collectAmount);

    if (isNaN(amountNum) || amountNum <= 0) {
      setCollectError('Amount must be greater than 0');
      return;
    }

    if (amountNum > pending + 0.001) {
      setCollectError(`Amount cannot exceed the current Pending Amount (${formatCurrency(pending)})`);
      return;
    }

    try {
      setIsCollecting(true);
      setCollectError('');

      await fetchWithAuth(`/purchases/${collectingPurchase.id}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          amount: Math.round(amountNum * 100) / 100,
          notes: collectNotes.trim() || undefined,
        }),
      });

      toast.success(`Payment of ${formatCurrency(amountNum)} collected successfully!`);
      setCollectingPurchase(null);
      await loadPurchases();
    } catch (err: any) {
      setCollectError(err.message || 'Failed to record payment collection');
      toast.error(err.message || 'Failed to record payment collection');
    } finally {
      setIsCollecting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'FULLY PAID':
      case 'PAID':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" />
            Fully Paid
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3" />
            Pending
          </span>
        );
      case 'PARTIAL':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold uppercase bg-blue-50 text-blue-700 border border-blue-200">
            <AlertCircle className="w-3 h-3" />
            Partial
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold uppercase bg-rose-50 text-rose-700 border border-rose-200">
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(val);
  };

  return (
    <div className="w-full p-4 sm:p-6 space-y-4 animate-in fade-in duration-150">
      {/* ─── COMPACT TOOLBAR & HEADER ───────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2E8F0] pb-3">
        <div>
          <h1 className="text-xl font-bold text-[#16324F] leading-tight flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-[#1677C8]" />
            Purchases
          </h1>
          <p className="text-xs text-[#64748B]">Manage distributor supplier procurement & inventory orders</p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-[#1677C8] hover:bg-[#125ea0] text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>New Purchase</span>
        </button>
      </div>

      {/* ─── FILTERS & SEARCH ROW ───────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-center gap-2.5">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search purchases by number, supplier, or reference..."
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
            className="w-full sm:w-36 px-2.5 py-2 bg-white border border-[#E2E8F0] rounded-lg text-xs font-semibold text-[#16324F] focus:outline-none focus:ring-1 focus:ring-[#1677C8]"
          >
            <option value="ALL">All Statuses</option>
            <option value="PAID">Paid</option>
            <option value="PENDING">Pending</option>
            <option value="PARTIAL">Partial</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          <button
            type="button"
            onClick={loadPurchases}
            title="Refresh"
            className="p-2 bg-white border border-[#E2E8F0] hover:bg-slate-50 text-slate-600 rounded-lg transition-colors cursor-pointer shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#1677C8]' : ''}`} />
          </button>
        </div>
      </div>

      {/* ─── DENSE FULL-WIDTH OPERATIONAL TABLE ─────────────────────── */}
      <div className="w-full bg-white border border-[#E2E8F0] rounded-xl shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-slate-50/80 text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                <th className="py-2.5 px-3.5 whitespace-nowrap">Date</th>
                <th className="py-2.5 px-3.5 whitespace-nowrap">Supplier</th>
                <th className="py-2.5 px-3.5 whitespace-nowrap">Items</th>
                <th className="py-2.5 px-3.5 whitespace-nowrap text-right">Subtotal</th>
                <th className="py-2.5 px-3.5 whitespace-nowrap text-right">Tax</th>
                <th className="py-2.5 px-3.5 whitespace-nowrap text-right">Total</th>
                <th className="py-2.5 px-3.5 whitespace-nowrap text-right">Pending Amount</th>
                <th className="py-2.5 px-3.5 whitespace-nowrap text-center">Status</th>
                <th className="py-2.5 px-3.5 whitespace-nowrap text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] text-xs">
              {isLoading && purchases.length === 0 ? (
                // Compact Skeleton Loader
                Array.from({ length: 4 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="py-3.5 px-3.5"><div className="h-4 w-20 bg-slate-200 rounded" /></td>
                    <td className="py-3.5 px-3.5"><div className="h-4 w-32 bg-slate-200 rounded" /></td>
                    <td className="py-3.5 px-3.5"><div className="h-4 w-16 bg-slate-200 rounded" /></td>
                    <td className="py-3.5 px-3.5"><div className="h-4 w-16 bg-slate-200 rounded ml-auto" /></td>
                    <td className="py-3.5 px-3.5"><div className="h-4 w-12 bg-slate-200 rounded ml-auto" /></td>
                    <td className="py-3.5 px-3.5"><div className="h-4 w-20 bg-slate-200 rounded ml-auto" /></td>
                    <td className="py-3.5 px-3.5"><div className="h-4 w-16 bg-slate-200 rounded ml-auto" /></td>
                    <td className="py-3.5 px-3.5"><div className="h-4 w-16 bg-slate-200 rounded mx-auto" /></td>
                    <td className="py-3.5 px-3.5"><div className="h-4 w-12 bg-slate-200 rounded ml-auto" /></td>
                  </tr>
                ))
              ) : purchases.length === 0 ? (
                // Compact Empty State
                <tr>
                  <td colSpan={9} className="py-12 px-4 text-center">
                    <div className="max-w-xs mx-auto space-y-3">
                      <div className="w-10 h-10 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                        <Package className="w-5 h-5" />
                      </div>
                      <p className="text-sm font-bold text-[#16324F]">No purchases yet</p>
                      <p className="text-xs text-[#64748B]">Create your first purchase to get started with supplier inventory tracking.</p>
                      <button
                        type="button"
                        onClick={openCreateModal}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1677C8] hover:bg-[#125ea0] text-white rounded-lg text-xs font-bold transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>New Purchase</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                // Data Rows
                purchases.map((purchase) => {
                  const itemsCount = Array.isArray(purchase.items) ? purchase.items.length : 0;
                  const totalUnits = Array.isArray(purchase.items)
                    ? purchase.items.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0)
                    : 0;
                  const pending = getPendingAmount(purchase);
                  const effectiveStatus = getEffectivePaymentStatus(purchase);

                  return (
                    <tr
                      key={purchase.id}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      <td className="py-2.5 px-3.5 text-slate-600 whitespace-nowrap">
                        {new Date(purchase.purchaseDate).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="py-2.5 px-3.5 font-semibold text-[#16324F] whitespace-nowrap">
                        {purchase.supplierName}
                      </td>
                      <td className="py-2.5 px-3.5 text-[#64748B] whitespace-nowrap">
                        <span className="font-semibold text-[#16324F]">{itemsCount}</span>{' '}
                        {itemsCount === 1 ? 'item' : 'items'} ({totalUnits} units)
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-medium text-slate-600 whitespace-nowrap">
                        {formatCurrency(purchase.subtotal)}
                      </td>
                      <td className="py-2.5 px-3.5 text-right text-slate-500 whitespace-nowrap">
                        {formatCurrency(purchase.tax)}
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-bold text-[#16324F] whitespace-nowrap">
                        {formatCurrency(purchase.total)}
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-semibold whitespace-nowrap">
                        {pending === 0 ? (
                          <span className="text-slate-400 font-medium">₹0</span>
                        ) : (
                          <span className="text-amber-600 font-bold">{formatCurrency(pending)}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                        {getStatusBadge(effectiveStatus)}
                      </td>
                      <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          {pending > 0 && purchase.paymentStatus !== 'CANCELLED' && (
                            <button
                              type="button"
                              onClick={() => openCollectModal(purchase)}
                              title="Collect Payment"
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-md text-[11px] font-bold transition-colors cursor-pointer mr-0.5"
                            >
                              Collect
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setViewingPurchase(purchase)}
                            title="View Purchase"
                            className="p-1.5 text-slate-500 hover:text-[#1677C8] hover:bg-slate-100 rounded-md transition cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(purchase)}
                            title="Edit Purchase"
                            className="p-1.5 text-slate-500 hover:text-[#1677C8] hover:bg-slate-100 rounded-md transition cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmPurchase(purchase)}
                            title="Delete Purchase"
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
      </div>

      {/* ─── CREATE / EDIT MODAL ────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center justify-between bg-slate-50/70">
              <div>
                <h2 className="text-base font-bold text-[#16324F]">
                  {editingPurchase ? `Edit Purchase (${editingPurchase.purchaseNumber})` : 'New Purchase'}
                </h2>
                <p className="text-xs text-[#64748B]">Procurement details and line items</p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSavePurchase} className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="relative">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                      Supplier <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => openQuickSupplierModal(supplierName)}
                      className="text-[11px] font-semibold text-[#1677C8] hover:text-[#125ea0] hover:underline cursor-pointer flex items-center gap-0.5 transition-colors"
                      title="Create a new supplier"
                    >
                      <Plus className="w-3 h-3" />
                      <span>New Supplier</span>
                    </button>
                  </div>
                  
                  {/* Searchable Select Input */}
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={supplierName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSupplierName(val);
                        const exact = suppliersList.find(
                          (s) => s.name.trim().toLowerCase() === val.trim().toLowerCase()
                        );
                        setSupplierId(exact ? exact.id : '');
                        setIsSupplierDropdownOpen(true);
                      }}
                      onFocus={() => setIsSupplierDropdownOpen(true)}
                      onClick={() => setIsSupplierDropdownOpen(true)}
                      placeholder="Search or select supplier..."
                      className="w-full pl-3 pr-8 py-2 bg-white border border-[#E2E8F0] rounded-lg text-xs font-medium text-[#16324F] placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#1677C8] focus:border-[#1677C8] transition-colors"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setIsSupplierDropdownOpen((prev) => !prev)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                      title="Toggle suppliers list"
                    >
                      <ChevronDown
                        className={`w-3.5 h-3.5 transition-transform duration-150 ${isSupplierDropdownOpen ? 'rotate-180 text-[#1677C8]' : ''}`}
                      />
                    </button>
                  </div>

                  {/* Filtered Dropdown */}
                  {isSupplierDropdownOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setIsSupplierDropdownOpen(false)}
                      />
                      <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-[#E2E8F0] rounded-xl shadow-xl max-h-56 overflow-y-auto divide-y divide-slate-100 text-xs">
                        {filteredSuppliers.length > 0 ? (
                          <>
                            {filteredSuppliers.map((s) => (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() => {
                                  setSupplierId(s.id);
                                  setSupplierName(s.name);
                                  setIsSupplierDropdownOpen(false);
                                }}
                                className={`w-full text-left px-3 py-2.5 hover:bg-sky-50/60 transition-colors cursor-pointer flex items-center justify-between group ${
                                  supplierId === s.id ? 'bg-sky-50/50' : ''
                                }`}
                              >
                                <div>
                                  <span
                                    className={`font-semibold block ${
                                      supplierId === s.id
                                        ? 'text-[#1677C8]'
                                        : 'text-[#16324F] group-hover:text-[#1677C8]'
                                    }`}
                                  >
                                    {s.name}
                                  </span>
                                  {s.companyName && (
                                    <span className="text-[10px] text-slate-500 block">
                                      {s.companyName}
                                    </span>
                                  )}
                                </div>
                                {supplierId === s.id && (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-[#1677C8] shrink-0" />
                                )}
                              </button>
                            ))}
                            <div className="p-2 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between">
                              <span className="text-[10px] text-slate-400 font-medium">
                                {filteredSuppliers.length} supplier{filteredSuppliers.length === 1 ? '' : 's'} available
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  openQuickSupplierModal(supplierName);
                                  setIsSupplierDropdownOpen(false);
                                }}
                                className="text-[11px] font-semibold text-[#1677C8] hover:underline cursor-pointer flex items-center gap-0.5"
                              >
                                <Plus className="w-3 h-3" />
                                <span>New Supplier</span>
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="p-3 text-center">
                            <p className="text-[11px] font-medium text-slate-600">
                              "{supplierName}" is not registered
                            </p>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              You can continue with this manually typed name without creating a record.
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                openQuickSupplierModal(supplierName);
                                setIsSupplierDropdownOpen(false);
                              }}
                              className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[#1677C8] hover:underline cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Create "{supplierName || 'New Supplier'}"</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Purchase Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-xs text-[#16324F] focus:outline-none focus:ring-1 focus:ring-[#1677C8]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Reference / Bill No.
                  </label>
                  <input
                    type="text"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    placeholder="e.g. INV-9021"
                    className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-xs text-[#16324F] focus:outline-none focus:ring-1 focus:ring-[#1677C8]"
                  />
                </div>
              </div>

              {/* Items Section */}
              <div className="space-y-2 pt-2 border-t border-[#E2E8F0]">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#16324F] uppercase tracking-wider">
                    Purchase Items ({formItems.length})
                  </span>
                  <button
                    type="button"
                    onClick={addItemRow}
                    className="text-xs font-bold text-[#1677C8] hover:text-[#125ea0] flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Item
                  </button>
                </div>

                <div className="space-y-2">
                  {formItems.map((item, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-12 gap-2 items-center bg-slate-50/60 p-2.5 rounded-lg border border-slate-200/60"
                    >
                      <div className="col-span-12 sm:col-span-4 relative">
                        <label className="block text-[10px] font-bold text-slate-500 mb-0.5 sm:hidden">
                          Product / Item
                        </label>
                        <input
                          type="text"
                          required
                          value={item.productName}
                          onChange={(e) => {
                            handleItemChange(index, 'productName', e.target.value);
                            setActiveDropdownIndex(index);
                          }}
                          onFocus={() => setActiveDropdownIndex(index)}
                          onBlur={() => {
                            setTimeout(() => setActiveDropdownIndex(null), 150);
                          }}
                          placeholder="Search or type item name..."
                          className="w-full px-2.5 py-1.5 bg-white border border-[#E2E8F0] rounded text-xs text-[#16324F] focus:outline-none focus:ring-1 focus:ring-[#1677C8]"
                        />

                        {/* Searchable Combobox Dropdown */}
                        {activeDropdownIndex === index && (
                          <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-48 overflow-y-auto z-30 divide-y divide-slate-100">
                            {getFilteredCatalogProducts(item.productName).map((cp) => (
                              <button
                                key={cp.id}
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  handleSelectProduct(index, cp);
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between text-xs transition cursor-pointer"
                              >
                                <span className="font-semibold text-[#16324F] truncate">{cp.name}</span>
                                <span className="font-bold text-[#1677C8] text-[11px] ml-2 shrink-0">
                                  {formatCurrency(cp.price)}
                                </span>
                              </button>
                            ))}
                            {getFilteredCatalogProducts(item.productName).length === 0 && (
                              <div className="px-3 py-2 text-slate-400 text-[11px] italic">
                                No catalog match — typing "{item.productName || '...'}" will be saved as a custom item
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="col-span-4 sm:col-span-2">
                        <label className="block text-[10px] font-bold text-slate-500 mb-0.5 sm:hidden">
                          Quantity
                        </label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={item.quantity === 0 ? '' : item.quantity}
                          onChange={(e) =>
                            handleItemChange(index, 'quantity', e.target.value === '' ? 0 : Number(e.target.value))
                          }
                          placeholder="Quantity"
                          className="w-full px-2.5 py-1.5 bg-white border border-[#E2E8F0] rounded text-xs text-[#16324F] focus:outline-none focus:ring-1 focus:ring-[#1677C8]"
                        />
                      </div>

                      <div className="col-span-4 sm:col-span-2">
                        <label className="block text-[10px] font-bold text-slate-500 mb-0.5 sm:hidden">
                          Unit Price
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          required
                          value={item.rate === 0 ? '' : item.rate}
                          onChange={(e) =>
                            handleItemChange(index, 'rate', e.target.value === '' ? 0 : Number(e.target.value))
                          }
                          placeholder="Unit price"
                          className="w-full px-2.5 py-1.5 bg-white border border-[#E2E8F0] rounded text-xs text-[#16324F] focus:outline-none focus:ring-1 focus:ring-[#1677C8]"
                        />
                      </div>

                      <div className="col-span-3 sm:col-span-2">
                        <label className="block text-[10px] font-bold text-slate-500 mb-0.5 sm:hidden">
                          Tax %
                        </label>
                        <select
                          value={item.taxPercent ?? 5}
                          onChange={(e) => handleItemChange(index, 'taxPercent', Number(e.target.value))}
                          className="w-full px-2 py-1.5 bg-white border border-[#E2E8F0] rounded text-xs text-[#16324F] focus:outline-none focus:ring-1 focus:ring-[#1677C8]"
                        >
                          <option value={0}>0%</option>
                          <option value={5}>5%</option>
                          <option value={12}>12%</option>
                          <option value={18}>18%</option>
                          <option value={28}>28%</option>
                        </select>
                      </div>

                      <div className="col-span-12 sm:col-span-2 flex items-center justify-between sm:justify-end gap-2">
                        <span className="font-bold text-xs text-[#16324F]">
                          {formatCurrency(item.amount)}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeItemRow(index)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial Totals & Payment Status */}
              <div className="pt-3 border-t border-[#E2E8F0] grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Payment Status
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { key: 'PAID', label: 'Paid' },
                        { key: 'PENDING', label: 'Pending' },
                        { key: 'PARTIAL', label: 'Partial' },
                      ].map((opt) => (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => handlePaymentStatusChange(opt.key as any)}
                          className={`py-1.5 px-2 rounded-lg text-xs font-bold transition border cursor-pointer ${
                            paymentStatus === opt.key
                              ? 'bg-[#1677C8]/10 text-[#1677C8] border-[#1677C8]'
                              : 'bg-white text-slate-600 border-[#E2E8F0] hover:bg-slate-50'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Dynamic Partial Payment Input */}
                  {paymentStatus === 'PARTIAL' && (
                    <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2 animate-in fade-in duration-150">
                      <div>
                        <label className="block text-[11px] font-bold text-amber-900 uppercase tracking-wider mb-1">
                          Amount Paid Now <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                            ₹
                          </span>
                          <input
                            type="number"
                            min="0.01"
                            max={grandTotal}
                            step="0.01"
                            required
                            value={amountPaid}
                            onChange={(e) => setAmountPaid(e.target.value)}
                            placeholder="Enter amount"
                            className="w-full pl-7 pr-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-bold text-[#16324F] focus:outline-none focus:ring-2 focus:ring-[#1677C8]"
                          />
                        </div>
                      </div>

                      {/* Display Total Amount, Paid Now, Balance Due */}
                      <div className="pt-2 border-t border-amber-200/80 space-y-1 text-xs">
                        <div className="flex justify-between text-slate-600">
                          <span>Total Amount:</span>
                          <span className="font-semibold text-[#16324F]">{formatCurrency(grandTotal)}</span>
                        </div>
                        <div className="flex justify-between text-emerald-700">
                          <span>Paid Now:</span>
                          <span className="font-bold">
                            {formatCurrency(Number(amountPaid) || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-amber-800 font-black pt-1 border-t border-amber-200">
                          <span>Balance Due:</span>
                          <span>{formatCurrency(balanceDue)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-1.5 text-right text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span className="font-medium">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Tax:</span>
                    <span className="font-medium">{formatCurrency(totalTax)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-[#16324F] pt-1 border-t border-slate-200">
                    <span>Total Amount:</span>
                    <span className="text-[#1677C8]">{formatCurrency(grandTotal)}</span>
                  </div>
                  {paymentStatus === 'PARTIAL' && (
                    <>
                      <div className="flex justify-between text-xs text-emerald-700 font-semibold pt-1 border-t border-slate-200">
                        <span>Paid Now:</span>
                        <span>{formatCurrency(Number(amountPaid) || 0)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-amber-700 font-black">
                        <span>Balance Due:</span>
                        <span>{formatCurrency(balanceDue)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Payment terms, batch tracking, or delivery instructions..."
                  className="w-full px-3 py-1.5 border border-[#E2E8F0] rounded-lg text-xs text-[#16324F] focus:outline-none focus:ring-1 focus:ring-[#1677C8]"
                />
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-2 border border-[#E2E8F0] rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-[#1677C8] hover:bg-[#125ea0] text-white rounded-lg text-xs font-bold transition shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Saving...' : editingPurchase ? 'Update Purchase' : 'Save Purchase'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── DELETE CONFIRMATION MODAL ──────────────────────────────── */}
      {deleteConfirmPurchase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#16324F]">Delete Purchase?</h3>
                <p className="text-xs text-slate-500">
                  {deleteConfirmPurchase.purchaseNumber} ({deleteConfirmPurchase.supplierName})
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              This purchase record will be permanently removed from your distributor account. This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteConfirmPurchase(null)}
                disabled={isDeleting}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeletePurchase}
                disabled={isDeleting}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
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
                    <div className="mt-1">{getStatusBadge(getEffectivePaymentStatus(viewingPurchase))}</div>
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
                          <td className="py-2.5 px-3 font-semibold text-[#16324F]">
                            {item.productName}
                          </td>
                          <td className="py-2.5 px-3 text-center text-slate-600">
                            {item.quantity}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-600">
                            {formatCurrency(item.rate)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-500">
                            {item.taxPercent ? `${item.taxPercent}%` : '0%'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-[#16324F]">
                            {formatCurrency(item.amount)}
                          </td>
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

              {/* Payment History Log */}
              {Array.isArray(viewingPurchase.payments) && viewingPurchase.payments.length > 0 && (
                <div className="border border-[#E2E8F0] rounded-xl overflow-hidden">
                  <div className="px-3.5 py-2 bg-slate-50/80 border-b border-[#E2E8F0] font-bold text-[11px] text-[#64748B] uppercase tracking-wider flex justify-between items-center">
                    <span>Payment History ({viewingPurchase.payments.length})</span>
                    <span className="text-emerald-700">Total Paid: {formatCurrency(getPaidAmount(viewingPurchase))}</span>
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
                          <td className="py-2 px-3 text-slate-700">
                            {p.notes || 'Payment recorded'}
                          </td>
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
                  <span>{formatCurrency(getPaidAmount(viewingPurchase))}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span className={getPendingAmount(viewingPurchase) > 0 ? 'text-amber-700' : 'text-slate-600'}>
                    Pending Amount:
                  </span>
                  <span className={getPendingAmount(viewingPurchase) > 0 ? 'text-amber-700' : 'text-slate-400 font-medium'}>
                    {getPendingAmount(viewingPurchase) === 0 ? '₹0' : formatCurrency(getPendingAmount(viewingPurchase))}
                  </span>
                </div>
              </div>

              {/* Notes */}
              {viewingPurchase.notes && (
                <div className="p-3 rounded-xl border border-slate-200/70 bg-slate-50/40 text-xs">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">Notes</span>
                  <p className="text-slate-700 whitespace-pre-wrap">{viewingPurchase.notes}</p>
                </div>
              )}
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

      {/* ─── COLLECT PAYMENT MODAL ────────────────────────────────────── */}
      {collectingPurchase && (() => {
        const total = collectingPurchase.total;
        const alreadyPaid = getPaidAmount(collectingPurchase);
        const currentPending = getPendingAmount(collectingPurchase);
        const enteredVal = parseFloat(collectAmount);
        const validEntered = !isNaN(enteredVal) && enteredVal > 0;
        const remainingAfter = validEntered ? Math.max(0, Number((currentPending - enteredVal).toFixed(2))) : currentPending;

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
                    <h2 className="text-sm font-bold text-[#16324F]">Collect Payment</h2>
                    <p className="text-[11px] text-[#64748B]">
                      {collectingPurchase.purchaseNumber} • {collectingPurchase.supplierName}
                    </p>
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
              <form onSubmit={handleCollectPayment} className="p-5 space-y-4 text-xs">
                {/* Metrics Breakdown */}
                <div className="grid grid-cols-3 gap-2 bg-slate-50/70 p-3 rounded-xl border border-slate-200/80">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Purchase Total</span>
                    <span className="text-xs font-bold text-[#16324F] mt-0.5 block">{formatCurrency(total)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Already Paid</span>
                    <span className="text-xs font-semibold text-emerald-700 mt-0.5 block">{formatCurrency(alreadyPaid)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Pending Amount</span>
                    <span className="text-xs font-bold text-amber-600 mt-0.5 block">{formatCurrency(currentPending)}</span>
                  </div>
                </div>

                {/* Amount Input */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-[#16324F]">
                      Amount Collected <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setCollectAmount(String(currentPending));
                        setCollectError('');
                      }}
                      className="text-[11px] font-semibold text-[#1677C8] hover:underline cursor-pointer"
                    >
                      Collect Full ({formatCurrency(currentPending)})
                    </button>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-semibold">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={currentPending}
                      value={collectAmount}
                      onChange={(e) => {
                        setCollectAmount(e.target.value);
                        setCollectError('');
                      }}
                      placeholder="Enter amount collected"
                      autoFocus
                      className="w-full pl-7 pr-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-xs font-semibold text-[#16324F] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Optional Notes */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Payment Notes / Method (Optional)</label>
                  <input
                    type="text"
                    value={collectNotes}
                    onChange={(e) => setCollectNotes(e.target.value)}
                    placeholder="e.g. Cash, Bank Transfer, UPI reference..."
                    className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-xs text-[#16324F] placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#1677C8]"
                  />
                </div>

                {/* Live Remaining Balance / Status Preview */}
                {validEntered && (
                  <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/60 flex items-center justify-between text-xs">
                    <span className="text-slate-600 font-medium">Remaining After Collection:</span>
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

                {/* Error Message */}
                {collectError && (
                  <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{collectError}</span>
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
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Collecting...</span>
                      </>
                    ) : (
                      <span>Collect Payment</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* ─── QUICK NEW SUPPLIER MODAL (FROM PURCHASES) ───────────────── */}
      {isQuickSupplierModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
            <div className="px-5 py-3.5 bg-slate-50/80 border-b border-[#E2E8F0] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#1677C8]/10 text-[#1677C8] flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#16324F]">New Supplier</h3>
                  <p className="text-[10px] text-slate-500">Quick create and auto-select for this purchase</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsQuickSupplierModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateQuickSupplier} className="p-5 space-y-3.5 overflow-y-auto text-xs">
              {/* Supplier Name * */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Supplier Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={quickSupplierName}
                  onChange={(e) => setQuickSupplierName(e.target.value)}
                  placeholder="e.g. PureStream Systems"
                  className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-xs font-semibold text-[#16324F] focus:outline-none focus:ring-1 focus:ring-[#1677C8]"
                  autoFocus
                />
              </div>

              {/* Contact Person & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Contact Person</label>
                  <input
                    type="text"
                    value={quickSupplierContactPerson}
                    onChange={(e) => setQuickSupplierContactPerson(e.target.value)}
                    placeholder="e.g. Rajesh Kumar"
                    className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-xs text-[#16324F] focus:outline-none focus:ring-1 focus:ring-[#1677C8]"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={quickSupplierPhone}
                    onChange={(e) => setQuickSupplierPhone(e.target.value)}
                    placeholder="e.g. +91 9876543210"
                    className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-xs text-[#16324F] focus:outline-none focus:ring-1 focus:ring-[#1677C8]"
                  />
                </div>
              </div>

              {/* Email & GSTIN */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Email</label>
                  <input
                    type="email"
                    value={quickSupplierEmail}
                    onChange={(e) => setQuickSupplierEmail(e.target.value)}
                    placeholder="e.g. info@supplier.com"
                    className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-xs text-[#16324F] focus:outline-none focus:ring-1 focus:ring-[#1677C8]"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">GSTIN</label>
                  <input
                    type="text"
                    value={quickSupplierGstin}
                    onChange={(e) => setQuickSupplierGstin(e.target.value.toUpperCase())}
                    placeholder="e.g. 29ABCDE1234F1Z5"
                    className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-xs font-mono uppercase text-[#16324F] focus:outline-none focus:ring-1 focus:ring-[#1677C8]"
                  />
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Address</label>
                <input
                  type="text"
                  value={quickSupplierAddress}
                  onChange={(e) => setQuickSupplierAddress(e.target.value)}
                  placeholder="Street, City, State, PIN..."
                  className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-xs text-[#16324F] focus:outline-none focus:ring-1 focus:ring-[#1677C8]"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={quickSupplierNotes}
                  onChange={(e) => setQuickSupplierNotes(e.target.value)}
                  placeholder="Payment terms, bank details, or delivery notes..."
                  className="w-full px-3 py-1.5 bg-white border border-[#E2E8F0] rounded-lg text-xs text-[#16324F] focus:outline-none focus:ring-1 focus:ring-[#1677C8] resize-none"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsQuickSupplierModalOpen(false)}
                  disabled={isCreatingQuickSupplier}
                  className="px-3.5 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingQuickSupplier || !quickSupplierName.trim()}
                  className="px-4 py-2 bg-[#1677C8] hover:bg-[#125ea0] disabled:opacity-50 text-white rounded-lg text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  {isCreatingQuickSupplier ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <span>Create & Select</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
