import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Package,
  Search,
  RefreshCw,
  AlertTriangle,
  Building2,
  Clock,
  CheckCircle2,
  ChevronDown,
  BarChart3,
  Boxes,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  AlertOctagon,
  Plus,
  SlidersHorizontal,
  X,
  TrendingDown,
  Equal,
  Check,
  Edit3,
} from 'lucide-react';
import {
  fetchBiodropsTenants,
  fetchTenantInventory,
  adjustTenantStock,
} from '../../../api/aquzio';
import type {
  BiodropsTenant,
  TenantInventoryResponse,
  RawMaterialItem,
} from '../../../api/aquzio';
import { PageHeader } from '../../../components/common/PageHeader';
import { DataErrorState } from '../../../components/common/DataErrorState';
import { toast } from '../../../utils/toast';

type SortField =
  | 'name'
  | 'sku'
  | 'category'
  | 'availableQuantity'
  | 'usedQuantity'
  | 'wastedQuantity'
  | 'reorderLevel'
  | 'status';
type SortDirection = 'asc' | 'desc';

export const TenantInventory: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [tenants, setTenants] = useState<BiodropsTenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>(
    searchParams.get('tenantId') || '',
  );

  const [inventory, setInventory] = useState<TenantInventoryResponse | null>(null);
  const [loadingTenants, setLoadingTenants] = useState(true);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search & category filter for raw materials
  const [materialSearch, setMaterialSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Frontend-only sorting for raw materials
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Stock Adjustment Modal State
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustItem, setAdjustItem] = useState<{
    sku: string;
    name: string;
    unit: string;
    currentQuantity: number;
    itemType: 'RAW_MATERIAL' | 'FINISHED_PRODUCT';
  } | null>(null);
  const [adjustAction, setAdjustAction] = useState<'ADD' | 'SET' | 'DEDUCT'>('ADD');
  const [adjustQuantity, setAdjustQuantity] = useState<string>('');
  const [adjustReason, setAdjustReason] = useState<string>('Supplier Inward / Delivery');
  const [adjustNotes, setAdjustNotes] = useState<string>('');
  const [submittingAdjustment, setSubmittingAdjustment] = useState(false);

  // Load available tenants first
  useEffect(() => {
    let isMounted = true;
    async function loadTenantsList() {
      try {
        setLoadingTenants(true);
        const list = await fetchBiodropsTenants();
        if (!isMounted) return;
        setTenants(list || []);

        // If no tenant selected or selected not in list, select first available
        if (list && list.length > 0) {
          const paramId = searchParams.get('tenantId');
          const exists = list.find((t) => t.id === paramId);
          const initialId = exists ? exists.id : list[0].id;
          setSelectedTenantId(initialId);
          setSearchParams({ tenantId: initialId }, { replace: true });
        }
      } catch (err: any) {
        if (!isMounted) return;
        setError(err.message || 'Failed to load Biodrops tenants list');
      } finally {
        if (isMounted) setLoadingTenants(false);
      }
    }

    loadTenantsList();
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch inventory whenever selected tenant changes
  const loadInventory = async (tenantId: string, isManualRefresh = false) => {
    if (!tenantId) return;
    try {
      if (isManualRefresh) setRefreshing(true);
      else setLoadingInventory(true);
      setError(null);

      const data = await fetchTenantInventory(tenantId);
      setInventory(data);
      if (isManualRefresh) {
        toast.success('Inventory refreshed successfully');
      }
    } catch (err: any) {
      const msg = err.message || 'Failed to retrieve plant inventory';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoadingInventory(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (selectedTenantId) {
      loadInventory(selectedTenantId);
    }
  }, [selectedTenantId]);

  const handleTenantChange = (newTenantId: string) => {
    setSelectedTenantId(newTenantId);
    setSearchParams({ tenantId: newTenantId });
  };

  const handleModalTenantChange = async (newTenantId: string) => {
    handleTenantChange(newTenantId);
    try {
      const data = await fetchTenantInventory(newTenantId);
      setInventory(data);
      const newItems: Array<{
        sku: string;
        name: string;
        unit: string;
        currentQuantity: number;
        itemType: 'RAW_MATERIAL' | 'FINISHED_PRODUCT';
      }> = [];

      (data.finishedProducts || []).forEach((p) => {
        newItems.push({
          sku: p.sku,
          name: p.name,
          unit: p.unit || 'Jar',
          currentQuantity: p.availableStock,
          itemType: 'FINISHED_PRODUCT',
        });
      });

      (data.rawMaterials || []).forEach((m) => {
        newItems.push({
          sku: m.sku,
          name: m.name,
          unit: m.unit,
          currentQuantity: m.availableQuantity,
          itemType: 'RAW_MATERIAL',
        });
      });

      if (newItems.length > 0) {
        setAdjustItem(newItems[0]);
      } else {
        setAdjustItem({
          sku: '',
          name: 'No items available',
          unit: 'Unit',
          currentQuantity: 0,
          itemType: 'RAW_MATERIAL',
        });
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to switch plant inventory');
    }
  };

  const selectedTenant = useMemo(() => {
    return tenants.find((t) => t.id === selectedTenantId);
  }, [tenants, selectedTenantId]);

  // Extract unique categories from raw materials
  const categories = useMemo(() => {
    if (!inventory?.rawMaterials) return ['ALL'];
    const cats = new Set(inventory.rawMaterials.map((m) => m.category || 'General'));
    return ['ALL', ...Array.from(cats)];
  }, [inventory]);

  // Filtered raw materials
  const filteredMaterials = useMemo(() => {
    if (!inventory?.rawMaterials) return [];
    return inventory.rawMaterials.filter((m) => {
      const matchCat =
        selectedCategory === 'ALL' ||
        (m.category || 'General').toLowerCase() === selectedCategory.toLowerCase();
      const matchSearch =
        !materialSearch ||
        m.name.toLowerCase().includes(materialSearch.toLowerCase()) ||
        m.sku.toLowerCase().includes(materialSearch.toLowerCase()) ||
        m.category.toLowerCase().includes(materialSearch.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [inventory, selectedCategory, materialSearch]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedMaterials = useMemo(() => {
    const list = [...filteredMaterials];
    list.sort((a, b) => {
      let valA: any = a[sortField as keyof RawMaterialItem];
      let valB: any = b[sortField as keyof RawMaterialItem];

      if (sortField === 'status') {
        const isLowA = a.isLowStock ?? a.availableQuantity <= a.reorderLevel;
        const isLowB = b.isLowStock ?? b.availableQuantity <= b.reorderLevel;
        valA = isLowA ? 1 : 0;
        valB = isLowB ? 1 : 0;
      }

      if (typeof valA === 'string') {
        const cmp = valA.localeCompare(String(valB || ''));
        return sortDirection === 'asc' ? cmp : -cmp;
      }
      if (typeof valA === 'number') {
        const numA = Number(valA) || 0;
        const numB = Number(valB) || 0;
        return sortDirection === 'asc' ? numA - numB : numB - numA;
      }
      return 0;
    });
    return list;
  }, [filteredMaterials, sortField, sortDirection]);

  const finishedProducts = inventory?.finishedProducts || [];

  // KPI summary metrics computed strictly from current state
  const summaryMetrics = useMemo(() => {
    const rawList = inventory?.rawMaterials || [];
    const totalFinishedJars = finishedProducts.reduce(
      (sum, p) => sum + (p.availableStock || 0),
      0,
    );
    const totalSkus = finishedProducts.length + rawList.length;

    let lowStockCount = 0;
    let outOfStockCount = 0;

    for (const m of rawList) {
      if (m.availableQuantity === 0) {
        outOfStockCount++;
      } else if (m.isLowStock ?? m.availableQuantity <= m.reorderLevel) {
        lowStockCount++;
      }
    }

    return {
      totalSkus,
      totalFinishedJars,
      lowStockCount,
      outOfStockCount,
    };
  }, [finishedProducts, inventory]);

  // List of all items (finished products + raw materials) available for selection
  const selectableItems = useMemo(() => {
    const list: Array<{
      sku: string;
      name: string;
      unit: string;
      currentQuantity: number;
      itemType: 'RAW_MATERIAL' | 'FINISHED_PRODUCT';
      category: string;
    }> = [];

    (inventory?.finishedProducts || []).forEach((p) => {
      list.push({
        sku: p.sku,
        name: p.name,
        unit: p.unit || 'Jar',
        currentQuantity: p.availableStock,
        itemType: 'FINISHED_PRODUCT',
        category: 'Finished Product',
      });
    });

    (inventory?.rawMaterials || []).forEach((m) => {
      list.push({
        sku: m.sku,
        name: m.name,
        unit: m.unit,
        currentQuantity: m.availableQuantity,
        itemType: 'RAW_MATERIAL',
        category: m.category || 'Raw Material',
      });
    });

    return list;
  }, [inventory]);

  const openAdjustModal = (item?: {
    sku: string;
    name: string;
    unit: string;
    currentQuantity: number;
    itemType: 'RAW_MATERIAL' | 'FINISHED_PRODUCT';
  }) => {
    if (item) {
      setAdjustItem(item);
    } else if (selectableItems.length > 0) {
      const first = selectableItems[0];
      setAdjustItem({
        sku: first.sku,
        name: first.name,
        unit: first.unit,
        currentQuantity: first.currentQuantity,
        itemType: first.itemType,
      });
    } else {
      setAdjustItem({
        sku: '20L_WATER_JAR',
        name: 'Finished 20L Water Jar',
        unit: 'Jar',
        currentQuantity: 0,
        itemType: 'FINISHED_PRODUCT',
      });
    }
    setAdjustAction('ADD');
    setAdjustQuantity('');
    setAdjustReason('Supplier Inward / Delivery');
    setAdjustNotes('');
    setIsAdjustModalOpen(true);
  };

  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenantId) {
      toast.error('No plant selected');
      return;
    }
    if (!adjustItem || !adjustItem.sku) {
      toast.error('Please select an item to adjust');
      return;
    }
    const qty = Number(adjustQuantity);
    if (!adjustQuantity || isNaN(qty) || qty <= 0) {
      toast.error('Please enter a valid positive quantity');
      return;
    }

    if (adjustAction === 'DEDUCT' && qty > adjustItem.currentQuantity) {
      toast.error(
        `Cannot deduct ${qty} ${adjustItem.unit}. Maximum available is ${adjustItem.currentQuantity} ${adjustItem.unit}.`,
      );
      return;
    }

    try {
      setSubmittingAdjustment(true);
      const res = await adjustTenantStock(selectedTenantId, {
        sku: adjustItem.sku,
        itemType: adjustItem.itemType,
        action: adjustAction,
        quantity: qty,
        reason: adjustReason,
        notes: adjustNotes.trim() || undefined,
      });

      toast.success(res.message || 'Plant stock updated successfully!');
      setIsAdjustModalOpen(false);
      await loadInventory(selectedTenantId, false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update plant stock');
    } finally {
      setSubmittingAdjustment(false);
    }
  };

  // Projected stock preview calculation
  const projectedQuantity = useMemo(() => {
    if (!adjustItem) return 0;
    const qty = Number(adjustQuantity) || 0;
    if (adjustAction === 'ADD') {
      return adjustItem.currentQuantity + qty;
    } else if (adjustAction === 'DEDUCT') {
      return Math.max(0, adjustItem.currentQuantity - qty);
    } else {
      return qty;
    }
  }, [adjustItem, adjustAction, adjustQuantity]);

  return (
    <div className="space-y-5">
      {/* ─── PAGE HEADER ────────────────────────────────────────── */}
      <PageHeader
        title="Plant Inventory"
        subtitle="Real-time stock of 20L jars and manufacturing raw materials with dynamic unit tracking."
        badge={
          selectedTenant ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-[#1677C8] border border-blue-200">
              <Building2 className="w-3.5 h-3.5" />
              {selectedTenant.companyName}
            </span>
          ) : undefined
        }
        backLink={{ to: '/aquzio-integration/biodrops-tenants', label: 'Tenants' }}
        secondaryActions={[
          {
            label: 'Adjust Stock',
            icon: Plus,
            onClick: () => openAdjustModal(),
          },
          {
            label: 'Stock Overview',
            icon: BarChart3,
            onClick: () =>
              navigate(
                `/aquzio-integration/stock-overview?tenantId=${encodeURIComponent(selectedTenantId)}`,
              ),
          },
          {
            label: 'Refresh',
            icon: RefreshCw,
            onClick: () => loadInventory(selectedTenantId, true),
            loading: refreshing,
          },
        ]}
      />

      {/* ─── COMPACT PLANT TOOLBAR & FEED STATUS ───────────────── */}
      <div className="bg-white px-4 py-3 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#1677C8]/10 text-[#1677C8] flex items-center justify-center shrink-0">
            <Building2 className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-2">
            <label
              htmlFor="tenant-select"
              className="text-xs font-bold text-slate-700 whitespace-nowrap"
            >
              Plant:
            </label>
            <div className="relative min-w-[220px] sm:min-w-[260px]">
              <select
                id="tenant-select"
                value={selectedTenantId}
                onChange={(e) => handleTenantChange(e.target.value)}
                disabled={loadingTenants || tenants.length === 0}
                className="w-full appearance-none bg-slate-50 border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg pl-3 pr-8 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#1677C8]/20 focus:border-[#1677C8] transition-all cursor-pointer"
              >
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.companyName} ({t.code})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {inventory && (
          <div className="flex items-center gap-3 text-xs text-slate-600 font-medium self-end md:self-center">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>
                Retrieved:{' '}
                <strong className="text-slate-800">
                  {new Date(inventory.retrievedAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </strong>
              </span>
            </div>
            <span className="text-slate-300">|</span>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-300">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Verified Feed
            </span>
          </div>
        )}
      </div>

      {/* ─── ERROR STATE ────────────────────────────────────────── */}
      {error && (
        <DataErrorState
          title="Unable to Retrieve Plant Inventory"
          message={error}
          onRetry={() => loadInventory(selectedTenantId, true)}
        />
      )}

      {/* ─── LOADING SKELETON ───────────────────────────────────── */}
      {(loadingTenants || loadingInventory) && !error && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-24 bg-white rounded-2xl border border-slate-200 p-4 animate-pulse" />
            ))}
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs animate-pulse">
            <div className="h-4 bg-slate-200 rounded w-1/4 mb-4" />
            <div className="h-32 bg-slate-100 rounded-xl" />
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs animate-pulse">
            <div className="h-4 bg-slate-200 rounded w-1/3 mb-4" />
            <div className="h-48 bg-slate-100 rounded-xl" />
          </div>
        </div>
      )}

      {/* ─── INVENTORY DATA VIEWS ───────────────────────────────── */}
      {!loadingTenants && !loadingInventory && !error && (
        <div className="space-y-6">
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#1677C8] flex items-center justify-center shrink-0">
                <Boxes className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-600">Total SKUs</p>
                <p className="text-xl font-extrabold text-[#16324F] mt-0.5">{summaryMetrics.totalSkus}</p>
                <p className="text-xs text-slate-600 truncate mt-0.5">
                  {finishedProducts.length} finished, {inventory?.rawMaterials?.length || 0} materials
                </p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <Package className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-600">Finished Stock</p>
                <p className="text-xl font-extrabold text-emerald-700 mt-0.5">
                  {summaryMetrics.totalFinishedJars.toLocaleString()}{' '}
                  <span className="text-xs font-semibold text-slate-600">Jars</span>
                </p>
                <p className="text-xs text-slate-600 truncate mt-0.5">Ready for dispatch</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-600">Low Stock</p>
                <p className="text-xl font-extrabold text-amber-700 mt-0.5">{summaryMetrics.lowStockCount}</p>
                <p className="text-xs text-slate-600 truncate mt-0.5">At or below reorder level</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <AlertOctagon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-600">Out of Stock</p>
                <p className="text-xl font-extrabold text-rose-700 mt-0.5">{summaryMetrics.outOfStockCount}</p>
                <p className="text-xs text-slate-600 truncate mt-0.5">0 balance available</p>
              </div>
            </div>
          </div>

          {/* 1. FINISHED PRODUCTS – 20L JAR ──────────────────────── */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-[#16324F]">
                    Finished Products – 20L Jar
                  </h2>
                  <p className="text-xs text-slate-600 font-medium">
                    Commercial ready-to-dispatch water jar stock
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg">
                {finishedProducts.length} Product SKU{finishedProducts.length === 1 ? '' : 's'}
              </span>
            </div>

            {finishedProducts.length === 0 ? (
              <div className="py-8 px-4 text-center">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-slate-100 text-slate-500 mb-2">
                  <Package className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-slate-700">No Finished 20L Water Jars Reported</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Commercial finished stock will appear here when ready batches are logged.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    openAdjustModal({
                      sku: '20L_WATER_JAR',
                      name: 'Finished 20L Water Jar',
                      unit: 'Jar',
                      currentQuantity: 0,
                      itemType: 'FINISHED_PRODUCT',
                    })
                  }
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[#1677C8] hover:bg-[#1363a8] rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Finished Stock
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-xs">
                      <th className="py-3 px-4 sm:px-6">Product Name</th>
                      <th className="py-3 px-4">SKU</th>
                      <th className="py-3 px-4 text-right">Available Stock</th>
                      <th className="py-3 px-4 text-right">Reserved Stock</th>
                      <th className="py-3 px-4 text-right">Damaged Stock</th>
                      <th className="py-3 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {finishedProducts.map((p, idx) => (
                      <tr key={p.id || idx} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 sm:px-6">
                          <span className="font-bold text-[#16324F] block">{p.name}</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-mono text-xs text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded shadow-2xs">
                            {p.sku}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <span className="text-sm font-extrabold text-emerald-700">
                            {p.availableStock.toLocaleString()}{' '}
                            <span className="text-xs font-semibold text-slate-600">{p.unit}</span>
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <span className="font-bold text-sky-700">
                            {p.reservedStock.toLocaleString()}{' '}
                            <span className="text-xs font-normal text-slate-600">{p.unit}</span>
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <span className="font-bold text-rose-700">
                            {p.damagedStock.toLocaleString()}{' '}
                            <span className="text-xs font-normal text-slate-600">{p.unit}</span>
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={() =>
                              openAdjustModal({
                                sku: p.sku,
                                name: p.name,
                                unit: p.unit || 'Jar',
                                currentQuantity: p.availableStock,
                                itemType: 'FINISHED_PRODUCT',
                              })
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#1677C8] bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors cursor-pointer"
                          >
                            <SlidersHorizontal className="w-3 h-3" />
                            Adjust
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* 2. RAW MATERIALS ────────────────────────────────────── */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                  <Boxes className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-[#16324F]">
                    Raw Materials & Packaging
                  </h2>
                  <p className="text-xs text-slate-600 font-medium">
                    Preforms, caps, labels, shrink film, and treatment supplies with dynamic units
                  </p>
                </div>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={materialSearch}
                    onChange={(e) => setMaterialSearch(e.target.value)}
                    placeholder="Search materials..."
                    className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1677C8]/20 focus:border-[#1677C8] w-40 sm:w-48"
                  />
                </div>

                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="py-1.5 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1677C8]/20"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c === 'ALL' ? 'All Categories' : c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {sortedMaterials.length === 0 ? (
              <div className="py-10 px-4 text-center">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-slate-100 text-slate-500 mb-2">
                  <Boxes className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-slate-700">
                  {materialSearch || selectedCategory !== 'ALL'
                    ? 'No raw materials matched your search criteria.'
                    : 'No raw materials reported for this plant.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-xs">
                      <th
                        onClick={() => handleSort('name')}
                        className="py-3 px-4 sm:px-6 cursor-pointer hover:bg-slate-100 transition-colors select-none"
                      >
                        <div className="inline-flex items-center gap-1.5">
                          <span>Material Name</span>
                          {sortField === 'name' ? (
                            sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-[#1677C8]" /> : <ArrowDown className="w-3.5 h-3.5 text-[#1677C8]" />
                          ) : (
                            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('sku')}
                        className="py-3 px-4 cursor-pointer hover:bg-slate-100 transition-colors select-none"
                      >
                        <div className="inline-flex items-center gap-1.5">
                          <span>SKU</span>
                          {sortField === 'sku' ? (
                            sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-[#1677C8]" /> : <ArrowDown className="w-3.5 h-3.5 text-[#1677C8]" />
                          ) : (
                            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('category')}
                        className="py-3 px-4 cursor-pointer hover:bg-slate-100 transition-colors select-none"
                      >
                        <div className="inline-flex items-center gap-1.5">
                          <span>Category</span>
                          {sortField === 'category' ? (
                            sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-[#1677C8]" /> : <ArrowDown className="w-3.5 h-3.5 text-[#1677C8]" />
                          ) : (
                            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('availableQuantity')}
                        className="py-3 px-4 text-right cursor-pointer hover:bg-slate-100 transition-colors select-none"
                      >
                        <div className="inline-flex items-center gap-1.5 justify-end w-full">
                          <span>Available Qty</span>
                          {sortField === 'availableQuantity' ? (
                            sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-[#1677C8]" /> : <ArrowDown className="w-3.5 h-3.5 text-[#1677C8]" />
                          ) : (
                            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('usedQuantity')}
                        className="py-3 px-4 text-right cursor-pointer hover:bg-slate-100 transition-colors select-none"
                      >
                        <div className="inline-flex items-center gap-1.5 justify-end w-full">
                          <span>Used Qty</span>
                          {sortField === 'usedQuantity' ? (
                            sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-[#1677C8]" /> : <ArrowDown className="w-3.5 h-3.5 text-[#1677C8]" />
                          ) : (
                            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('wastedQuantity')}
                        className="py-3 px-4 text-right cursor-pointer hover:bg-slate-100 transition-colors select-none"
                      >
                        <div className="inline-flex items-center gap-1.5 justify-end w-full">
                          <span>Wasted Qty</span>
                          {sortField === 'wastedQuantity' ? (
                            sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-[#1677C8]" /> : <ArrowDown className="w-3.5 h-3.5 text-[#1677C8]" />
                          ) : (
                            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('reorderLevel')}
                        className="py-3 px-4 text-right cursor-pointer hover:bg-slate-100 transition-colors select-none"
                      >
                        <div className="inline-flex items-center gap-1.5 justify-end w-full">
                          <span>Reorder Level</span>
                          {sortField === 'reorderLevel' ? (
                            sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-[#1677C8]" /> : <ArrowDown className="w-3.5 h-3.5 text-[#1677C8]" />
                          ) : (
                            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('status')}
                        className="py-3 px-4 text-center cursor-pointer hover:bg-slate-100 transition-colors select-none"
                      >
                        <div className="inline-flex items-center gap-1.5 justify-center">
                          <span>Status</span>
                          {sortField === 'status' ? (
                            sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-[#1677C8]" /> : <ArrowDown className="w-3.5 h-3.5 text-[#1677C8]" />
                          ) : (
                            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                          )}
                        </div>
                      </th>
                      <th className="py-3 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {sortedMaterials.map((m, idx) => {
                      const isOutOfStock = m.availableQuantity === 0;
                      const isLow = m.isLowStock ?? m.availableQuantity <= m.reorderLevel;

                      const rowHighlightClass = isOutOfStock
                        ? 'border-l-4 border-l-rose-500 bg-rose-50/30 hover:bg-rose-50/50'
                        : isLow
                        ? 'border-l-4 border-l-amber-500 bg-amber-50/30 hover:bg-amber-50/50'
                        : 'border-l-4 border-l-transparent hover:bg-slate-50/70';

                      return (
                        <tr
                          key={m.id || idx}
                          className={`transition-colors ${rowHighlightClass}`}
                        >
                          <td className="py-3.5 px-4 sm:px-6">
                            <span className="font-bold text-[#16324F] block">{m.name}</span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-mono text-xs text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded shadow-2xs">
                              {m.sku}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200/60 px-2.5 py-1 rounded-md">
                              {m.category}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <span
                              className={`text-sm font-extrabold ${
                                isOutOfStock
                                  ? 'text-rose-600'
                                  : isLow
                                  ? 'text-amber-700'
                                  : 'text-[#16324F]'
                              }`}
                            >
                              {m.availableQuantity.toLocaleString()}{' '}
                              <span className="text-xs font-semibold text-slate-600">{m.unit}</span>
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-medium">
                            {m.usedQuantity === 0 ? (
                              <span className="text-xs font-normal text-slate-300">0</span>
                            ) : (
                              <span className="font-semibold text-slate-700">
                                {m.usedQuantity.toLocaleString()}{' '}
                                <span className="text-xs font-normal text-slate-500">{m.unit}</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right font-medium">
                            {m.wastedQuantity === 0 ? (
                              <span className="text-xs font-normal text-slate-300">0</span>
                            ) : (
                              <span className="font-semibold text-rose-700">
                                {m.wastedQuantity.toLocaleString()}{' '}
                                <span className="text-xs font-normal text-slate-500">{m.unit}</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right font-medium text-slate-700">
                            {m.reorderLevel.toLocaleString()}{' '}
                            <span className="text-xs font-normal text-slate-500">{m.unit}</span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {isLow ? (
                              <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-300">
                                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                                Reorder
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-300">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                Optimal
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <button
                              type="button"
                              onClick={() =>
                                openAdjustModal({
                                  sku: m.sku,
                                  name: m.name,
                                  unit: m.unit,
                                  currentQuantity: m.availableQuantity,
                                  itemType: 'RAW_MATERIAL',
                                })
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#1677C8] bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors cursor-pointer"
                            >
                              <Edit3 className="w-3 h-3" />
                              Adjust
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {/* ─── STOCK ADJUSTMENT MODAL ────────────────────────────── */}
      {isAdjustModalOpen && adjustItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#1677C8]/10 text-[#1677C8] flex items-center justify-center">
                  <SlidersHorizontal className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#16324F]">Adjust Plant Stock</h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Plant: {selectedTenant?.companyName || 'Unknown Plant'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAdjustModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveAdjustment} className="p-5 space-y-4">
              {/* Plant / Manufacturing Tenant Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Plant / Manufacturing Tenant:
                </label>
                <select
                  value={selectedTenantId}
                  onChange={(e) => handleModalTenantChange(e.target.value)}
                  className="w-full text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1677C8]/20 focus:border-[#1677C8] cursor-pointer"
                >
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.companyName} ({t.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Item Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Select Item / SKU:
                </label>
                <select
                  value={adjustItem.sku}
                  onChange={(e) => {
                    const picked = selectableItems.find((it) => it.sku === e.target.value);
                    if (picked) {
                      setAdjustItem({
                        sku: picked.sku,
                        name: picked.name,
                        unit: picked.unit,
                        currentQuantity: picked.currentQuantity,
                        itemType: picked.itemType,
                      });
                    }
                  }}
                  className="w-full text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1677C8]/20 focus:border-[#1677C8] cursor-pointer"
                >
                  {selectableItems.map((it) => (
                    <option key={`${it.itemType}:${it.sku}`} value={it.sku}>
                      [{it.category}] {it.name} ({it.sku}) — Available: {it.currentQuantity.toLocaleString()} {it.unit}
                    </option>
                  ))}
                </select>
              </div>

              {/* Action Type: ADD / SET / DEDUCT */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Adjustment Action:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustAction('ADD')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border cursor-pointer ${
                      adjustAction === 'ADD'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300 shadow-2xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Stock
                  </button>

                  <button
                    type="button"
                    onClick={() => setAdjustAction('SET')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border cursor-pointer ${
                      adjustAction === 'SET'
                        ? 'bg-blue-50 text-[#1677C8] border-blue-300 shadow-2xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Equal className="w-3.5 h-3.5" />
                    Set Exact
                  </button>

                  <button
                    type="button"
                    onClick={() => setAdjustAction('DEDUCT')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border cursor-pointer ${
                      adjustAction === 'DEDUCT'
                        ? 'bg-rose-50 text-rose-800 border-rose-300 shadow-2xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <TrendingDown className="w-3.5 h-3.5" />
                    Deduct
                  </button>
                </div>
              </div>

              {/* Quantity Input with live calculation preview */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">
                    {adjustAction === 'SET' ? 'New Exact Quantity:' : 'Adjustment Quantity:'}
                  </label>
                  <span className="text-[11px] font-semibold text-slate-500">
                    Current: <strong className="text-slate-800">{adjustItem.currentQuantity.toLocaleString()} {adjustItem.unit}</strong>
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min="0.001"
                    step="any"
                    value={adjustQuantity}
                    onChange={(e) => setAdjustQuantity(e.target.value)}
                    placeholder="Enter quantity..."
                    required
                    className="w-full text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 pr-16 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1677C8]/20 focus:border-[#1677C8]"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 pointer-events-none">
                    {adjustItem.unit}
                  </span>
                </div>
              </div>

              {/* Calculation Preview Banner */}
              {adjustQuantity && Number(adjustQuantity) > 0 && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                  <span className="text-slate-600 font-medium">Resulting Stock:</span>
                  <div className="flex items-center gap-2 font-bold">
                    <span className="text-slate-500 line-through">
                      {adjustItem.currentQuantity} {adjustItem.unit}
                    </span>
                    <span>→</span>
                    <span className={`text-sm ${
                      adjustAction === 'DEDUCT' && Number(adjustQuantity) > adjustItem.currentQuantity
                        ? 'text-rose-600'
                        : 'text-emerald-700'
                    }`}>
                      {projectedQuantity.toLocaleString()} {adjustItem.unit}
                    </span>
                  </div>
                </div>
              )}

              {/* Reason Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Reason for Adjustment:
                </label>
                <select
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1677C8]/20 focus:border-[#1677C8] cursor-pointer"
                >
                  <option value="Supplier Inward / Delivery">Supplier Inward / Delivery</option>
                  <option value="Production Batch Output">Production Batch Output</option>
                  <option value="Physical Inventory Reconciliation">Physical Inventory Reconciliation</option>
                  <option value="Damaged / Defect Write-off">Damaged / Defect Write-off</option>
                  <option value="Customer Return Stock">Customer Return Stock</option>
                  <option value="Other Adjustment">Other Adjustment</option>
                </select>
              </div>

              {/* Notes / Reference */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Notes / Reference (Optional):
                </label>
                <input
                  type="text"
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  placeholder="e.g. PO-8891, Batch #12, or inspection note"
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1677C8]/20 focus:border-[#1677C8]"
                />
              </div>

              {/* Modal Actions */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  disabled={submittingAdjustment}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAdjustment || (adjustAction === 'DEDUCT' && Number(adjustQuantity) > adjustItem.currentQuantity)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#1677C8] hover:bg-[#1363a8] rounded-xl shadow-xs disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  {submittingAdjustment ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Confirm Adjustment
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TenantInventory;
