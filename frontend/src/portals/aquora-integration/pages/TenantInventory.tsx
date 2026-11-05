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
} from 'lucide-react';
import {
  fetchBiodropsTenants,
  fetchTenantInventory,
} from '../../../api/aquzio';
import type {
  BiodropsTenant,
  TenantInventoryResponse,
} from '../../../api/aquzio';
import { PageHeader } from '../../../components/common/PageHeader';
import { DataErrorState } from '../../../components/common/DataErrorState';
import { toast } from '../../../utils/toast';

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
      const msg = err.message || 'Failed to retrieve tenant inventory';
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

  const finishedProducts = inventory?.finishedProducts || [];

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

      {/* ─── TENANT SELECTION CONTROLLER ────────────────────────── */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="w-10 h-10 rounded-xl bg-[#1677C8]/10 text-[#1677C8] flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <label
              htmlFor="tenant-select"
              className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block"
            >
              Selected Production Plant
            </label>
            <div className="relative mt-0.5 min-w-[240px]">
              <select
                id="tenant-select"
                value={selectedTenantId}
                onChange={(e) => handleTenantChange(e.target.value)}
                disabled={loadingTenants || tenants.length === 0}
                className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-xl px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-[#1677C8]/20 focus:border-[#1677C8] transition-all cursor-pointer"
              >
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.companyName} ({t.code})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {inventory && (
          <div className="flex items-center gap-4 text-xs text-slate-500 self-end sm:self-center font-medium">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>
                Retrieved:{' '}
                <strong className="text-slate-700">
                  {new Date(inventory.retrievedAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </strong>
              </span>
            </div>
            <span className="text-slate-300">|</span>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              <CheckCircle2 className="w-3 h-3" />
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
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs animate-pulse">
            <div className="h-4 bg-slate-200 rounded w-1/4 mb-4" />
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="h-20 bg-slate-100 rounded-xl" />
              ))}
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs animate-pulse">
            <div className="h-4 bg-slate-200 rounded w-1/3 mb-4" />
            <div className="h-40 bg-slate-100 rounded-xl" />
          </div>
        </div>
      )}

      {/* ─── INVENTORY DATA VIEWS ───────────────────────────────── */}
      {!loadingTenants && !loadingInventory && !error && (
        <div className="space-y-6">
          {/* 1. FINISHED PRODUCTS – 20L JAR ──────────────────────── */}
          <section className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-[#16324F]">
                    Finished Products – 20L Jar
                  </h2>
                  <p className="text-[11px] text-slate-400 font-medium">
                    Commercial ready-to-dispatch water jar stock
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                {finishedProducts.length} Product SKU{finishedProducts.length === 1 ? '' : 's'}
              </span>
            </div>

            {finishedProducts.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 font-medium">
                No finished product stock reported for this tenant.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4 sm:px-6">Product Name</th>
                      <th className="py-3 px-4">SKU</th>
                      <th className="py-3 px-4 text-right">Available Stock</th>
                      <th className="py-3 px-4 text-right">Reserved Stock</th>
                      <th className="py-3 px-4 text-right">Damaged Stock</th>
                      <th className="py-3 px-4 text-center">Unit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {finishedProducts.map((p, idx) => (
                      <tr key={p.id || idx} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3.5 px-4 sm:px-6">
                          <span className="font-bold text-[#16324F] block">{p.name}</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-mono text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                            {p.sku}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <span className="text-sm font-extrabold text-emerald-600">
                            {p.availableStock.toLocaleString()}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <span className="font-bold text-sky-600">
                            {p.reservedStock.toLocaleString()}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <span className="font-bold text-rose-600">
                            {p.damagedStock.toLocaleString()}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                            {p.unit}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* 2. RAW MATERIALS ────────────────────────────────────── */}
          <section className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                  <Boxes className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-[#16324F]">
                    Raw Materials & Packaging
                  </h2>
                  <p className="text-[11px] text-slate-400 font-medium">
                    Preforms, caps, labels, shrink film, and treatment supplies with dynamic units
                  </p>
                </div>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={materialSearch}
                    onChange={(e) => setMaterialSearch(e.target.value)}
                    placeholder="Search materials..."
                    className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1677C8]/20 focus:border-[#1677C8] w-40 sm:w-48"
                  />
                </div>

                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1677C8]/20"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c === 'ALL' ? 'All Categories' : c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {filteredMaterials.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-400 font-medium">
                {materialSearch || selectedCategory !== 'ALL'
                  ? 'No raw materials matched your search criteria.'
                  : 'No raw materials reported for this tenant.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4 sm:px-6">Material Name</th>
                      <th className="py-3 px-4">SKU</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4 text-right">Available Qty</th>
                      <th className="py-3 px-4 text-right">Used Qty</th>
                      <th className="py-3 px-4 text-right">Wasted Qty</th>
                      <th className="py-3 px-4 text-center">Unit</th>
                      <th className="py-3 px-4 text-right">Reorder Level</th>
                      <th className="py-3 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {filteredMaterials.map((m, idx) => {
                      const isLow =
                        m.isLowStock ?? m.availableQuantity <= m.reorderLevel;

                      return (
                        <tr
                          key={m.id || idx}
                          className={`hover:bg-slate-50/50 transition-colors ${
                            isLow ? 'bg-rose-50/30' : ''
                          }`}
                        >
                          <td className="py-3.5 px-4 sm:px-6">
                            <span className="font-bold text-[#16324F] block">{m.name}</span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-mono text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                              {m.sku}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                              {m.category}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <span
                              className={`text-sm font-extrabold ${
                                isLow ? 'text-rose-600' : 'text-[#16324F]'
                              }`}
                            >
                              {m.availableQuantity.toLocaleString()}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-medium text-slate-600">
                            {m.usedQuantity.toLocaleString()}
                          </td>
                          <td className="py-3.5 px-4 text-right font-medium text-slate-500">
                            {m.wastedQuantity.toLocaleString()}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className="text-[11px] font-bold text-[#1677C8] bg-sky-50 px-2 py-0.5 rounded border border-sky-100">
                              {m.unit}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-medium text-slate-600">
                            {m.reorderLevel.toLocaleString()} {m.unit}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {isLow ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                                <AlertTriangle className="w-3 h-3 text-rose-600" />
                                Reorder
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Optimal
                              </span>
                            )}
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
    </div>
  );
};

export default TenantInventory;
