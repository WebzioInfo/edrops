import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Building2,
  Package,
  AlertTriangle,
  RefreshCw,
  Clock,
  CheckCircle2,
  ChevronDown,
  Boxes,
  ShieldCheck,
} from 'lucide-react';
import {
  fetchBiodropsTenants,
  fetchTenantStockSummary,
} from '../../../api/aquora';
import type {
  BiodropsTenant,
  StockSummaryResponse,
} from '../../../api/aquora';
import { PageHeader } from '../../../components/common/PageHeader';
import { DataErrorState } from '../../../components/common/DataErrorState';
import { toast } from '../../../utils/toast';

export const StockOverview: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [tenants, setTenants] = useState<BiodropsTenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>(
    searchParams.get('tenantId') || '',
  );

  const [summary, setSummary] = useState<StockSummaryResponse | null>(null);
  const [loadingTenants, setLoadingTenants] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load tenants first
  useEffect(() => {
    let isMounted = true;
    async function loadTenantsList() {
      try {
        setLoadingTenants(true);
        const list = await fetchBiodropsTenants();
        if (!isMounted) return;
        setTenants(list || []);

        if (list && list.length > 0) {
          const paramId = searchParams.get('tenantId');
          const exists = list.find((t) => t.id === paramId);
          const initialId = exists ? exists.id : list[0].id;
          setSelectedTenantId(initialId);
          setSearchParams({ tenantId: initialId }, { replace: true });
        }
      } catch (err: any) {
        if (!isMounted) return;
        setError(err.message || 'Failed to load Biodrops tenants');
      } finally {
        if (isMounted) setLoadingTenants(false);
      }
    }

    loadTenantsList();
    return () => {
      isMounted = false;
    };
  }, []);

  const loadSummary = async (tenantId: string, isManualRefresh = false) => {
    if (!tenantId) return;
    try {
      if (isManualRefresh) setRefreshing(true);
      else setLoadingSummary(true);
      setError(null);

      const data = await fetchTenantStockSummary(tenantId);
      setSummary(data);
      if (isManualRefresh) {
        toast.success('Stock overview refreshed');
      }
    } catch (err: any) {
      const msg = err.message || 'Failed to retrieve stock summary';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoadingSummary(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (selectedTenantId) {
      loadSummary(selectedTenantId);
    }
  }, [selectedTenantId]);

  const handleTenantChange = (newTenantId: string) => {
    setSelectedTenantId(newTenantId);
    setSearchParams({ tenantId: newTenantId });
  };

  const selectedTenant = useMemo(() => {
    return tenants.find((t) => t.id === selectedTenantId);
  }, [tenants, selectedTenantId]);

  const finishedSummary = summary?.finishedProductsSummary;
  const rawGroups = summary?.rawMaterialsGroupedByUnit || [];
  const lowStockAlerts = summary?.lowStockAlerts || [];
  const individualBalances = summary?.individualMaterialBalances || [];

  return (
    <div className="space-y-5">
      {/* ─── PAGE HEADER ────────────────────────────────────────── */}
      <PageHeader
        title="Stock Overview & Raw Materials"
        subtitle="Aggregated inventory balance sheet with strict unit-grouped material accounting."
        badge={
          selectedTenant ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-[#1677C8] border border-blue-200">
              <Building2 className="w-3.5 h-3.5" />
              {selectedTenant.companyName}
            </span>
          ) : undefined
        }
        backLink={{ to: '/aquora-integration/biodrops-tenants', label: 'Tenants' }}
        secondaryActions={[
          {
            label: 'View Detailed Inventory',
            icon: Package,
            onClick: () =>
              navigate(
                `/aquora-integration/tenant-inventory?tenantId=${encodeURIComponent(selectedTenantId)}`,
              ),
          },
          {
            label: 'Refresh',
            icon: RefreshCw,
            onClick: () => loadSummary(selectedTenantId, true),
            loading: refreshing,
          },
        ]}
      />

      {/* ─── TENANT SELECTOR BAR ─────────────────────────────────── */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <label
              htmlFor="stock-tenant-select"
              className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block"
            >
              Facility Selection
            </label>
            <div className="relative mt-0.5 min-w-[240px]">
              <select
                id="stock-tenant-select"
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

        {summary && (
          <div className="flex items-center gap-3 text-xs text-slate-500 self-end sm:self-center font-medium">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>
                Snapshot:{' '}
                <strong className="text-slate-700">
                  {new Date(summary.retrievedAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </strong>
              </span>
            </div>
            <span className="text-slate-300">|</span>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
              <ShieldCheck className="w-3 h-3" />
              Strict Unit Isolation
            </span>
          </div>
        )}
      </div>

      {/* ─── ERROR STATE ────────────────────────────────────────── */}
      {error && (
        <DataErrorState
          title="Failed to Load Stock Overview"
          message={error}
          onRetry={() => loadSummary(selectedTenantId, true)}
        />
      )}

      {/* ─── LOADING SKELETON ───────────────────────────────────── */}
      {(loadingTenants || loadingSummary) && !error && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-white rounded-2xl border border-slate-200/80 p-4 animate-pulse" />
            ))}
          </div>
          <div className="h-44 bg-white rounded-2xl border border-slate-200/80 p-4 animate-pulse" />
        </div>
      )}

      {/* ─── SUMMARY DATA ───────────────────────────────────────── */}
      {!loadingTenants && !loadingSummary && !error && summary && (
        <div className="space-y-6">
          {/* 1. 20L FINISHED PRODUCTS KPI CARDS ─────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                20L Jar Finished Stock Snapshot
              </h2>
              <span className="text-xs font-semibold text-slate-400">
                Unit: {finishedSummary?.unit || 'Jars'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              {/* Total Stock */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Total 20L Jar Stock
                </span>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-2xl sm:text-3xl font-black text-[#16324F]">
                    {(finishedSummary?.totalStock ?? 0).toLocaleString()}
                  </span>
                  <span className="text-xs font-bold text-slate-400">
                    {finishedSummary?.unit || 'Jars'}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 block mt-1">Available + Reserved + Damaged</span>
              </div>

              {/* Available Stock */}
              <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 block">
                  Available for Orders
                </span>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-2xl sm:text-3xl font-black text-emerald-600">
                    {(finishedSummary?.totalAvailableStock ?? 0).toLocaleString()}
                  </span>
                  <span className="text-xs font-bold text-emerald-600/70">
                    {finishedSummary?.unit || 'Jars'}
                  </span>
                </div>
                <span className="text-[10px] text-emerald-600/80 block mt-1">Ready to dispatch</span>
              </div>

              {/* Reserved Stock */}
              <div className="bg-white p-4 rounded-2xl border border-sky-100 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600 block">
                  Reserved Stock
                </span>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-2xl sm:text-3xl font-black text-sky-600">
                    {(finishedSummary?.totalReservedStock ?? 0).toLocaleString()}
                  </span>
                  <span className="text-xs font-bold text-sky-600/70">
                    {finishedSummary?.unit || 'Jars'}
                  </span>
                </div>
                <span className="text-[10px] text-sky-600/80 block mt-1">Allocated to pending orders</span>
              </div>

              {/* Damaged Stock */}
              <div className="bg-white p-4 rounded-2xl border border-rose-100 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 block">
                  Damaged Stock
                </span>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-2xl sm:text-3xl font-black text-rose-600">
                    {(finishedSummary?.totalDamagedStock ?? 0).toLocaleString()}
                  </span>
                  <span className="text-xs font-bold text-rose-600/70">
                    {finishedSummary?.unit || 'Jars'}
                  </span>
                </div>
                <span className="text-[10px] text-rose-600/80 block mt-1">Isolated for quality inspection</span>
              </div>
            </div>
          </div>

          {/* 2. LOW-STOCK INDICATORS BANNER (if any) ──────────────── */}
          {lowStockAlerts.length > 0 && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 sm:p-5 shadow-2xs">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-rose-900">
                    Low-Stock Reorder Alerts ({lowStockAlerts.length})
                  </h3>
                  <p className="text-[11px] text-rose-700 font-medium">
                    The following raw materials are at or below their configured reorder thresholds:
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {lowStockAlerts.map((alert, idx) => (
                  <div
                    key={idx}
                    className="bg-white p-3 rounded-xl border border-rose-200/80 flex items-center justify-between"
                  >
                    <div>
                      <span className="font-bold text-xs text-[#16324F] block">
                        {alert.name}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {alert.sku} • {alert.category}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-extrabold text-rose-600 block">
                        {alert.availableQuantity.toLocaleString()} / {alert.reorderLevel.toLocaleString()}{' '}
                        {alert.unit}
                      </span>
                      <span className="text-[10px] text-rose-500 font-medium">
                        Deficit: {alert.deficit.toLocaleString()} {alert.unit}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. RAW MATERIAL STOCK GROUPED STRICTLY BY DYNAMIC UNIT ─ */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-bold text-[#16324F]">
                  Raw Material Balances Grouped by Unit
                </h2>
                <p className="text-[11px] text-slate-400 font-medium">
                  Aggregated independently per configured unit. Differing units are never combined.
                </p>
              </div>
              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                {rawGroups.length} Distinct Unit{rawGroups.length === 1 ? '' : 's'}
              </span>
            </div>

            {rawGroups.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200/80 p-8 text-center text-xs text-slate-400 font-medium">
                No raw material units reported for this facility.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {rawGroups.map((group) => (
                  <div
                    key={group.unit}
                    className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs flex flex-col justify-between"
                  >
                    <div>
                      {/* Header of Unit Card */}
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-sky-50 text-[#1677C8] flex items-center justify-center font-bold text-xs uppercase">
                            {group.unit.slice(0, 3)}
                          </div>
                          <span className="text-xs font-bold text-[#16324F] uppercase tracking-wider">
                            Unit: <span className="text-[#1677C8] font-extrabold">{group.unit}</span>
                          </span>
                        </div>

                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                          {group.itemCount} Item{group.itemCount === 1 ? '' : 's'}
                        </span>
                      </div>

                      {/* Group Totals */}
                      <div className="grid grid-cols-3 gap-2 py-3 border-b border-slate-100 text-center">
                        <div className="bg-slate-50 p-2 rounded-xl">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                            Available
                          </span>
                          <span className="text-sm font-extrabold text-[#16324F] block mt-0.5">
                            {group.totalAvailable.toLocaleString()}
                          </span>
                          <span className="text-[9px] text-slate-400">{group.unit}</span>
                        </div>

                        <div className="bg-slate-50 p-2 rounded-xl">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                            Used
                          </span>
                          <span className="text-sm font-bold text-slate-700 block mt-0.5">
                            {group.totalUsed.toLocaleString()}
                          </span>
                          <span className="text-[9px] text-slate-400">{group.unit}</span>
                        </div>

                        <div className="bg-slate-50 p-2 rounded-xl">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                            Wasted
                          </span>
                          <span className="text-sm font-bold text-slate-500 block mt-0.5">
                            {group.totalWasted.toLocaleString()}
                          </span>
                          <span className="text-[9px] text-slate-400">{group.unit}</span>
                        </div>
                      </div>

                      {/* Items list inside group */}
                      <div className="pt-3 space-y-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Materials in this unit:
                        </span>
                        {group.items.map((item, idx) => {
                          const isLow =
                            item.isLowStock ?? item.availableQuantity <= item.reorderLevel;

                          return (
                            <div
                              key={item.id || idx}
                              className={`p-2 rounded-xl border flex items-center justify-between text-xs ${
                                isLow
                                  ? 'bg-rose-50/50 border-rose-200'
                                  : 'bg-slate-50/50 border-slate-100'
                              }`}
                            >
                              <div className="min-w-0 flex-1 pr-2">
                                <span className="font-bold text-slate-800 block truncate">
                                  {item.name}
                                </span>
                                <span className="text-[10px] font-mono text-slate-400">
                                  {item.sku}
                                </span>
                              </div>

                              <div className="text-right shrink-0">
                                <span
                                  className={`font-extrabold text-xs block ${
                                    isLow ? 'text-rose-600' : 'text-[#16324F]'
                                  }`}
                                >
                                  {item.availableQuantity.toLocaleString()} {item.unit}
                                </span>
                                <span className="text-[10px] text-slate-400 font-medium">
                                  Min: {item.reorderLevel.toLocaleString()}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 4. INDIVIDUAL MATERIAL BALANCES TABLE ────────────────── */}
          <section className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                  <Boxes className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-[#16324F]">
                    Individual Material Balances & Thresholds
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium">
                    Item-by-item breakdown with low-stock status evaluated against configured reorder levels
                  </p>
                </div>
              </div>

              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                {individualBalances.length} Items Listed
              </span>
            </div>

            {individualBalances.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 font-medium">
                No individual material balances reported.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4 sm:px-6">Material Name</th>
                      <th className="py-3 px-4">SKU</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4 text-right">Balance</th>
                      <th className="py-3 px-4 text-center">Unit</th>
                      <th className="py-3 px-4 text-right">Reorder Level</th>
                      <th className="py-3 px-4 text-center">Health Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {individualBalances.map((m, idx) => {
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
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                                <AlertTriangle className="w-3 h-3 text-rose-600" />
                                Low Stock
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Healthy
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

export default StockOverview;
