import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Search,
  RefreshCw,
  Package,
  Clock,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  BarChart3,
} from 'lucide-react';
import { fetchBiodropsTenants } from '../../../api/aquora';
import type { BiodropsTenant } from '../../../api/aquora';
import { PageHeader } from '../../../components/common/PageHeader';
import { DataErrorState } from '../../../components/common/DataErrorState';
import { toast } from '../../../utils/toast';

export const BiodropsTenants: React.FC = () => {
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<BiodropsTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const loadTenants = async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const data = await fetchBiodropsTenants();
      setTenants(Array.isArray(data) ? data : []);
      if (isManualRefresh) {
        toast.success('Tenant list refreshed successfully');
      }
    } catch (err: any) {
      const msg = err.message || 'Failed to fetch Biodrops production tenants';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadTenants();
  }, []);

  const filteredTenants = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return tenants;
    return tenants.filter(
      (t) =>
        t.companyName.toLowerCase().includes(q) ||
        t.code.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q) ||
        (t.subdomain && t.subdomain.toLowerCase().includes(q)),
    );
  }, [tenants, searchQuery]);

  const totalFinishedStock = useMemo(() => {
    return tenants.reduce(
      (sum, t) => sum + (t.inventorySummary?.totalFinishedJars || 0),
      0,
    );
  }, [tenants]);

  const totalActiveTenants = tenants.length;

  return (
    <div className="space-y-5">
      {/* ─── PAGE HEADER ────────────────────────────────────────── */}
      <PageHeader
        title="Biodrops Production Tenants"
        subtitle="Live multi-tenant manufacturing facilities powered by Aquora Biodrops Production API."
        badge={
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live Sync
          </span>
        }
        secondaryActions={[
          {
            label: 'Refresh',
            icon: RefreshCw,
            onClick: () => loadTenants(true),
            loading: refreshing,
          },
        ]}
      />

      {/* ─── SUMMARY KPI METRICS ─────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Active Biodrops Tenants
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-[#16324F]">
              {loading ? '—' : totalActiveTenants}
            </span>
            <span className="text-xs text-slate-400 font-semibold">Enabled Facilities</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Total 20L Available Stock
            </span>
            <div className="w-7 h-7 rounded-lg bg-[#1677C8]/10 text-[#1677C8] flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-[#1677C8]">
              {loading ? '—' : totalFinishedStock.toLocaleString()}
            </span>
            <span className="text-xs text-slate-400 font-semibold">20L Finished Jars</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Production Gateway
            </span>
            <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xs font-bold text-slate-700">eDrops Backend Proxy</span>
            <span className="text-[11px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
              RBAC Protected
            </span>
          </div>
        </div>
      </div>

      {/* ─── SEARCH & FILTER CONTROLS ───────────────────────────── */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tenant by company, code, ID or subdomain..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1677C8]/20 focus:border-[#1677C8] transition-all"
          />
        </div>

        <div className="text-xs text-slate-500 font-semibold self-end sm:self-center">
          Showing <span className="text-slate-800 font-bold">{filteredTenants.length}</span> of{' '}
          {tenants.length} tenants
        </div>
      </div>

      {/* ─── ERROR STATE ────────────────────────────────────────── */}
      {error && (
        <DataErrorState
          title="Failed to Load Biodrops Tenants"
          message={error}
          onRetry={() => loadTenants(true)}
        />
      )}

      {/* ─── LOADING SKELETON ───────────────────────────────────── */}
      {loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs animate-pulse space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="h-5 bg-slate-200 rounded-md w-3/5" />
                <div className="h-5 bg-slate-200 rounded-full w-16" />
              </div>
              <div className="h-3.5 bg-slate-100 rounded w-2/5" />
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
                <div className="h-10 bg-slate-100 rounded-xl" />
                <div className="h-10 bg-slate-100 rounded-xl" />
                <div className="h-10 bg-slate-100 rounded-xl" />
              </div>
              <div className="h-8 bg-slate-100 rounded-xl w-full" />
            </div>
          ))}
        </div>
      )}

      {/* ─── EMPTY STATE ────────────────────────────────────────── */}
      {!loading && !error && filteredTenants.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-2xs">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <Building2 className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-[#16324F] mb-1">
            {searchQuery ? 'No matching tenants found' : 'No Biodrops Tenants Available'}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4 font-medium">
            {searchQuery
              ? `No tenants match "${searchQuery}". Try a different keyword or clear the search.`
              : 'There are currently no tenants configured with Biodrops Production enabled.'}
          </p>
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Clear Search
            </button>
          )}
        </div>
      )}

      {/* ─── TENANTS GRID ───────────────────────────────────────── */}
      {!loading && !error && filteredTenants.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTenants.map((tenant) => {
            const summary = tenant.inventorySummary || {
              totalFinishedJars: 0,
              rawMaterialsCount: 0,
              lowStockAlerts: 0,
            };

            return (
              <div
                key={tenant.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs hover:shadow-md hover:border-[#1677C8]/40 transition-all flex flex-col justify-between group"
              >
                <div>
                  {/* Top Bar: Company Name & Production Status Badge */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-base font-bold text-[#16324F] group-hover:text-[#1677C8] transition-colors truncate">
                        {tenant.companyName}
                      </h2>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded tracking-wider uppercase">
                          {tenant.code}
                        </span>
                        {tenant.subdomain && (
                          <span className="text-[11px] text-slate-400 font-medium truncate flex items-center gap-1">
                            <span>{tenant.subdomain}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3" />
                      {tenant.productionStatus}
                    </span>
                  </div>

                  {/* Tenant ID display */}
                  <div className="mt-2 text-[11px] font-mono text-slate-400 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100 flex items-center justify-between">
                    <span className="text-slate-400 text-[10px] uppercase font-sans font-bold">Tenant ID</span>
                    <span className="truncate ml-2">{tenant.id}</span>
                  </div>

                  {/* Inventory Summary Cards */}
                  <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-100">
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-center">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                        Finished 20L
                      </span>
                      <span className="text-sm font-extrabold text-[#1677C8] mt-0.5 block">
                        {summary.totalFinishedJars.toLocaleString()}
                      </span>
                      <span className="text-[9px] text-slate-400 font-medium">Jars</span>
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-center">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                        Raw Materials
                      </span>
                      <span className="text-sm font-extrabold text-slate-700 mt-0.5 block">
                        {summary.rawMaterialsCount}
                      </span>
                      <span className="text-[9px] text-slate-400 font-medium">Items</span>
                    </div>

                    <div
                      className={`p-2.5 rounded-xl border text-center ${
                        summary.lowStockAlerts > 0
                          ? 'bg-rose-50 border-rose-100 text-rose-700'
                          : 'bg-slate-50 border-slate-100 text-slate-700'
                      }`}
                    >
                      <span className="text-[9px] font-bold uppercase tracking-wider block truncate">
                        Stock Alerts
                      </span>
                      <span className="text-sm font-extrabold mt-0.5 block">
                        {summary.lowStockAlerts}
                      </span>
                      <span className="text-[9px] font-medium opacity-75">
                        {summary.lowStockAlerts > 0 ? 'Deficit' : 'Optimal'}
                      </span>
                    </div>
                  </div>

                  {/* Retrieval timestamp */}
                  <div className="mt-3 flex items-center justify-between text-[10px] text-slate-400 font-medium">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      Retrieved:
                    </span>
                    <span>
                      {new Date(tenant.lastRetrievedAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                  </div>
                </div>

                {/* Actions: View Inventory & Stock Overview */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      navigate(`/aquora-integration/tenant-inventory?tenantId=${encodeURIComponent(tenant.id)}`)
                    }
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-[#1677C8] hover:bg-[#125fa0] text-white rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer active:scale-98"
                  >
                    <Package className="w-3.5 h-3.5" />
                    <span>View Inventory</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-auto" />
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      navigate(`/aquora-integration/stock-overview?tenantId=${encodeURIComponent(tenant.id)}`)
                    }
                    className="inline-flex items-center justify-center p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer"
                    title="Stock Overview"
                  >
                    <BarChart3 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BiodropsTenants;
