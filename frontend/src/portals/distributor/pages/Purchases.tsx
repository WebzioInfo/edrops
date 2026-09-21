import React, { useState, useEffect, useMemo } from 'react';
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
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [deleteConfirmPurchase, setDeleteConfirmPurchase] = useState<PurchaseRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Form states
  const [supplierName, setSupplierName] = useState<string>('');
  const [purchaseDate, setPurchaseDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [paymentStatus, setPaymentStatus] = useState<'PAID' | 'PENDING' | 'PARTIAL' | 'CANCELLED'>('PAID');
  const [notes, setNotes] = useState<string>('');
  const [formItems, setFormItems] = useState<PurchaseItem[]>([
    { productName: '', quantity: 1, rate: 0, taxPercent: 18, amount: 0 },
  ]);

  const loadPurchases = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (search.trim()) params.append('search', search.trim());
      if (statusFilter !== 'ALL') params.append('status', statusFilter);

      const qs = params.toString() ? `?${params.toString()}` : '';
      const data = await fetchWithAuth(`/purchases${qs}`);
      setPurchases(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load purchases');
    } finally {
      setIsLoading(false);
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
    loadCatalogProducts();
  }, []);

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

  const openCreateModal = () => {
    setEditingPurchase(null);
    setSupplierName('');
    setPurchaseDate(new Date().toISOString().split('T')[0]);
    setReferenceNumber('');
    setPaymentStatus('PAID');
    setNotes('');
    setFormItems([{ productName: '', quantity: 1, rate: 0, taxPercent: 18, amount: 0 }]);
    setIsModalOpen(true);
  };

  const openEditModal = (purchase: PurchaseRecord) => {
    setEditingPurchase(purchase);
    setSupplierName(purchase.supplierName);
    setPurchaseDate(new Date(purchase.purchaseDate).toISOString().split('T')[0]);
    setReferenceNumber(purchase.referenceNumber || '');
    setPaymentStatus(purchase.paymentStatus);
    setNotes(purchase.notes || '');
    setFormItems(
      Array.isArray(purchase.items) && purchase.items.length
        ? purchase.items.map((it) => ({
            productId: it.productId,
            productName: it.productName,
            quantity: Number(it.quantity) || 1,
            rate: Number(it.rate) || 0,
            taxPercent: it.taxPercent !== undefined ? Number(it.taxPercent) : 18,
            amount: Number(it.amount) || 0,
          }))
        : [{ productName: '', quantity: 1, rate: 0, taxPercent: 18, amount: 0 }]
    );
    setIsModalOpen(true);
  };

  const handleItemChange = (index: number, field: keyof PurchaseItem, value: any) => {
    setFormItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };

      if (field === 'productName') {
        const found = catalogProducts.find((p) => p.name.toLowerCase() === String(value).toLowerCase());
        if (found) {
          item.productId = found.id;
          if (!item.rate) item.rate = found.price;
        }
      }

      const q = Number(item.quantity) || 0;
      const r = Number(item.rate) || 0;
      const t = (Number(item.taxPercent) || 0) / 100;
      item.amount = Math.round(q * r * (1 + t) * 100) / 100;

      updated[index] = item;
      return updated;
    });
  };

  const addItemRow = () => {
    setFormItems((prev) => [
      ...prev,
      { productName: '', quantity: 1, rate: 0, taxPercent: 18, amount: 0 },
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

    try {
      setIsSubmitting(true);
      const payload = {
        supplierName: supplierName.trim(),
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
      loadPurchases();
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" />
            Paid
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
                <th className="py-2.5 px-3.5 whitespace-nowrap">Purchase No.</th>
                <th className="py-2.5 px-3.5 whitespace-nowrap">Date</th>
                <th className="py-2.5 px-3.5 whitespace-nowrap">Supplier</th>
                <th className="py-2.5 px-3.5 whitespace-nowrap">Items</th>
                <th className="py-2.5 px-3.5 whitespace-nowrap text-right">Subtotal</th>
                <th className="py-2.5 px-3.5 whitespace-nowrap text-right">Tax</th>
                <th className="py-2.5 px-3.5 whitespace-nowrap text-right">Total</th>
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
                    <td className="py-3.5 px-3.5"><div className="h-4 w-20 bg-slate-200 rounded" /></td>
                    <td className="py-3.5 px-3.5"><div className="h-4 w-32 bg-slate-200 rounded" /></td>
                    <td className="py-3.5 px-3.5"><div className="h-4 w-16 bg-slate-200 rounded" /></td>
                    <td className="py-3.5 px-3.5"><div className="h-4 w-16 bg-slate-200 rounded ml-auto" /></td>
                    <td className="py-3.5 px-3.5"><div className="h-4 w-12 bg-slate-200 rounded ml-auto" /></td>
                    <td className="py-3.5 px-3.5"><div className="h-4 w-20 bg-slate-200 rounded ml-auto" /></td>
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

                  return (
                    <tr
                      key={purchase.id}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      <td className="py-2.5 px-3.5 font-mono font-bold text-[#1677C8] whitespace-nowrap">
                        {purchase.purchaseNumber}
                        {purchase.referenceNumber && (
                          <span className="block text-[10px] font-sans font-normal text-slate-400">
                            Ref: {purchase.referenceNumber}
                          </span>
                        )}
                      </td>
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
                      <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                        {getStatusBadge(purchase.paymentStatus)}
                      </td>
                      <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
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
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Supplier Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    placeholder="e.g. ABC Water Supplies"
                    className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-xs text-[#16324F] focus:outline-none focus:ring-1 focus:ring-[#1677C8]"
                  />
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
                      <div className="col-span-12 sm:col-span-4">
                        <label className="block text-[10px] font-bold text-slate-500 mb-0.5 sm:hidden">
                          Product
                        </label>
                        <input
                          type="text"
                          required
                          list="catalog-product-list"
                          value={item.productName}
                          onChange={(e) => handleItemChange(index, 'productName', e.target.value)}
                          placeholder="Select or enter item name..."
                          className="w-full px-2.5 py-1.5 bg-white border border-[#E2E8F0] rounded text-xs text-[#16324F] focus:outline-none focus:ring-1 focus:ring-[#1677C8]"
                        />
                      </div>

                      <div className="col-span-4 sm:col-span-2">
                        <label className="block text-[10px] font-bold text-slate-500 mb-0.5 sm:hidden">
                          Qty
                        </label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, 'quantity', Number(e.target.value))}
                          placeholder="Qty"
                          className="w-full px-2.5 py-1.5 bg-white border border-[#E2E8F0] rounded text-xs text-[#16324F] focus:outline-none focus:ring-1 focus:ring-[#1677C8]"
                        />
                      </div>

                      <div className="col-span-4 sm:col-span-2">
                        <label className="block text-[10px] font-bold text-slate-500 mb-0.5 sm:hidden">
                          Rate (₹)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          required
                          value={item.rate}
                          onChange={(e) => handleItemChange(index, 'rate', Number(e.target.value))}
                          placeholder="Rate"
                          className="w-full px-2.5 py-1.5 bg-white border border-[#E2E8F0] rounded text-xs text-[#16324F] focus:outline-none focus:ring-1 focus:ring-[#1677C8]"
                        />
                      </div>

                      <div className="col-span-3 sm:col-span-2">
                        <label className="block text-[10px] font-bold text-slate-500 mb-0.5 sm:hidden">
                          Tax %
                        </label>
                        <select
                          value={item.taxPercent ?? 18}
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

                <datalist id="catalog-product-list">
                  {catalogProducts.map((cp) => (
                    <option key={cp.id} value={cp.name} />
                  ))}
                </datalist>
              </div>

              {/* Financial Totals & Payment Status */}
              <div className="pt-3 border-t border-[#E2E8F0] grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
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
                        onClick={() => setPaymentStatus(opt.key as any)}
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

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-1 text-right text-xs">
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
    </div>
  );
}
