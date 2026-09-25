import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Plus, RefreshCw, AlertOctagon } from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';
import { toast } from 'react-hot-toast';
import { EdropsPageLoader } from '../../../components/common/EdropsPageLoader';

export default function InventoryAudit() {
  const [status, setStatus] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Adjustments states
  const [adjusting, setAdjusting] = useState<string | null>(null); // "PRODUCTION", "REPLENISH", "DAMAGE"
  const [qty, setQty] = useState(10);
  const [damageType, setDamageType] = useState<'FILLED' | 'EMPTY'>('FILLED');
  const [submitting, setSubmitting] = useState(false);

  const loadInventory = async () => {
    try {
      setLoading(true);
      const [statusData, logsData] = await Promise.all([
        fetchWithAuth('/inventory/status'),
        fetchWithAuth('/inventory/logs')
      ]);
      setStatus(statusData);
      setLogs(logsData || []);
    } catch (err) {
      toast.error('Failed to load inventory audits');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInventory();
  }, []);

  const handleAdjust = async () => {
    if (qty <= 0) {
      toast.error('Please input a positive quantity.');
      return;
    }
    setSubmitting(true);
    try {
      if (adjusting === 'PRODUCTION') {
        await fetchWithAuth('/inventory/production', {
          method: 'POST',
          body: JSON.stringify({ qty })
        });
        toast.success(`Production logged! Manufactured ${qty} filled jars.`);
      } else if (adjusting === 'REPLENISH') {
        await fetchWithAuth('/inventory/replenish', {
          method: 'POST',
          body: JSON.stringify({ qty })
        });
        toast.success(`Warehouse restocked with ${qty} jars.`);
      } else if (adjusting === 'DAMAGE') {
        await fetchWithAuth('/inventory/damage', {
          method: 'POST',
          body: JSON.stringify({ qty, type: damageType })
        });
        toast.success(`Logged ${qty} damaged ${damageType.toLowerCase()} jars.`);
      }
      setAdjusting(null);
      setQty(10);
      loadInventory();
    } catch (err: any) {
      toast.error(err.message || 'Action failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <EdropsPageLoader fullPage />;

  return (
    <div className="space-y-3.5 sm:space-y-4 animate-in fade-in duration-150">
      {/* ─── COMPACT ACTION TOOLBAR ──────────────────────── */}
      <div className="bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-700">
            Plant & Warehouse Stock
          </span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => { setAdjusting('DAMAGE'); setQty(1); }}
            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold transition cursor-pointer"
            title="Report Damaged Jars"
          >
            <AlertOctagon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Report Damage</span>
            <span className="sm:hidden">Damage</span>
          </button>

          <button
            type="button"
            onClick={() => { setAdjusting('REPLENISH'); setQty(50); }}
            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition cursor-pointer"
            title="Replenish Empty Jars Pool"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Replenish</span>
            <span className="sm:hidden">Replenish</span>
          </button>

          <button
            type="button"
            onClick={() => { setAdjusting('PRODUCTION'); setQty(10); }}
            className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 bg-[#1677C8] hover:bg-[#125ea0] text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
            title="Log Plant Production"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Log Production</span>
          </button>
        </div>
      </div>

      {/* Stock Cards */}
      <section className="grid gap-2.5 sm:gap-3 grid-cols-1 sm:grid-cols-3">
        <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-[#E2E8F0] shadow-2xs text-center flex flex-col justify-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 block">Filled Jars Available</span>
          <span className="text-2xl sm:text-3xl font-extrabold text-emerald-700 mt-1 block">{status?.filledJars ?? 0}</span>
        </div>
        <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-[#E2E8F0] shadow-2xs text-center flex flex-col justify-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600 block">Empty Jars Return Pool</span>
          <span className="text-2xl sm:text-3xl font-extrabold text-[#1677C8] mt-1 block">{status?.emptyJars ?? 0}</span>
        </div>
        <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-[#E2E8F0] shadow-2xs text-center flex flex-col justify-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 block">Damaged / Discarded</span>
          <span className="text-2xl sm:text-3xl font-extrabold text-rose-700 mt-1 block">{status?.damagedJars ?? 0}</span>
        </div>
      </section>

      {/* Inventory Logs Audit Feed */}
      <section className="bg-white rounded-xl border border-[#E2E8F0] shadow-2xs p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <h3 className="text-xs sm:text-sm font-bold text-[#16324F] uppercase tracking-wider flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Warehouse Audit Trail
          </h3>
          <span className="text-xs text-slate-400 font-medium">{logs.length} entries</span>
        </div>
        <div className="divide-y divide-slate-100 max-h-[380px] overflow-y-auto pr-1">
          {logs.map((log) => (
            <div key={log.id} className="py-2.5 sm:py-3 flex flex-col sm:flex-row justify-between sm:items-center text-xs font-semibold gap-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  log.action === 'PRODUCTION' ? 'bg-blue-50 text-[#1677C8] border border-blue-200' :
                  log.action === 'DELIVERY' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}>
                  {log.action}
                </span>
                <span className="text-[#16324F]">{log.description}</span>
              </div>
              <span className="text-[11px] text-slate-400 shrink-0">{new Date(log.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</span>
            </div>
          ))}
          {logs.length === 0 && (
            <p className="text-xs text-slate-400 py-6 text-center">No inventory logs available</p>
          )}
        </div>
      </section>

      {/* Adjustments Modals */}
      {adjusting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl p-5 sm:p-6 max-w-md w-full shadow-xl border border-slate-200 space-y-5"
          >
            <div>
              <h3 className="text-lg font-bold text-[#16324F]">
                {adjusting === 'PRODUCTION' ? 'Log Plant Production' :
                 adjusting === 'REPLENISH' ? 'Direct Stock Replenishment' : 'Report Damaged Jars'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {adjusting === 'PRODUCTION' ? 'Converts warehouse empty jars into filled product.' :
                 adjusting === 'REPLENISH' ? 'Instantly increases filled jar inventory stock.' : 'Deducts from warehouse stock and writes to damaged pool.'}
              </p>
            </div>

            <div className="space-y-4">
              {adjusting === 'DAMAGE' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Damage Type</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setDamageType('FILLED')}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-colors ${damageType === 'FILLED' ? 'bg-red-50 border-red-500 text-red-700' : 'bg-white border-slate-200 text-slate-600'}`}
                    >
                      Filled Jar
                    </button>
                    <button
                      type="button"
                      onClick={() => setDamageType('EMPTY')}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-colors ${damageType === 'EMPTY' ? 'bg-red-50 border-red-500 text-red-700' : 'bg-white border-slate-200 text-slate-600'}`}
                    >
                      Empty Jar
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Jars Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={qty}
                  onChange={(e) => setQty(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-[#16324F] focus:outline-none focus:ring-1 focus:ring-[#1677C8]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setAdjusting(null)}
                className="px-4 py-2 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleAdjust}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-[#1677C8] hover:bg-[#125ea0] text-white shadow-xs transition cursor-pointer"
              >
                {submitting ? 'Submitting...' : 'Submit Update'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
