import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ClipboardList, AlertTriangle } from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';
import { toast } from 'react-hot-toast';

const StaffLoader = () => (
  <div className="flex min-h-[60vh] items-center justify-center">
    <div className="relative h-16 w-16 rounded-full water-gradient shadow-2xl shadow-edrops-aqua/30">
      <div className="absolute inset-2 animate-ping rounded-full bg-white/40" />
    </div>
  </div>
);

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

  if (loading) return <StaffLoader />;

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* ─── COMPACT TOOLBAR ────────────────────────────── */}
      <div className="bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#1677C8]/10 text-[#1677C8] flex items-center justify-center font-bold">
            <ClipboardList className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-800">Warehouse Stock Audit</span>
            <span className="text-[11px] text-slate-400 block">Track production cycles, inventory allocations, and jar pools</span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => { setAdjusting('PRODUCTION'); setQty(10); }}
            className="px-3 py-1.5 bg-[#1677C8] hover:bg-[#125ea0] text-white rounded-xl text-xs font-bold cursor-pointer shadow-xs transition"
          >
            Log Production
          </button>
          <button
            onClick={() => { setAdjusting('REPLENISH'); setQty(50); }}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-xs transition"
          >
            Direct Replenish
          </button>
          <button
            onClick={() => { setAdjusting('DAMAGE'); setQty(1); }}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-xs transition"
          >
            Log Damage
          </button>
        </div>
      </div>

      {/* Stock Cards */}
      <section className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs text-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 block">Filled Jars Available</span>
          <span className="text-2xl sm:text-3xl font-black text-emerald-800 mt-1 block">{status?.filledJars ?? 0}</span>
        </div>
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs text-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600 block">Empty Jars Return Pool</span>
          <span className="text-2xl sm:text-3xl font-black text-sky-800 mt-1 block">{status?.emptyJars ?? 0}</span>
        </div>
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs text-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 block">Damaged/Discarded Jars</span>
          <span className="text-2xl sm:text-3xl font-black text-rose-800 mt-1 block">{status?.damagedJars ?? 0}</span>
        </div>
      </section>

      {/* Inventory Logs Audit Feed */}
      <section className="clay-card p-6 space-y-4">
        <h3 className="text-lg font-black text-[#245361] uppercase tracking-wider flex items-center gap-1.5">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          Warehouse Audit Trail
        </h3>
        <div className="divide-y divide-border/40 md:max-h-[350px] md:overflow-y-auto pr-2">
          {logs.map((log) => (
            <div key={log.id} className="py-3 flex flex-col sm:flex-row justify-between sm:items-center text-sm font-semibold">
              <div>
                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider mr-2 ${
                  log.action === 'PRODUCTION' ? 'bg-blue-50 text-blue-700' :
                  log.action === 'DELIVERY' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                }`}>
                  {log.action}
                </span>
                <span className="text-slate-800">{log.description}</span>
              </div>
              <span className="text-xs text-slate-400 mt-1 sm:mt-0">{new Date(log.createdAt).toLocaleString()}</span>
            </div>
          ))}
          {logs.length === 0 && (
            <p className="text-sm text-slate-500 italic py-4 text-center">No inventory logs available</p>
          )}
        </div>
      </section>

      {/* Adjustments Modals */}
      {adjusting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-border space-y-6"
          >
            <div>
              <h3 className="text-2xl font-black text-[#245361]">
                {adjusting === 'PRODUCTION' ? 'Log Plant Production' :
                 adjusting === 'REPLENISH' ? 'Direct Stock Replenishment' : 'Report Damaged Jars'}
              </h3>
              <p className="text-xs text-slate-600 mt-1">
                {adjusting === 'PRODUCTION' ? 'Converts warehouse empty jars into filled product.' :
                 adjusting === 'REPLENISH' ? 'Instantly increases filled jar inventory stock.' : 'Deducts from warehouse stock and writes to damaged pool.'}
              </p>
            </div>

            <div className="space-y-4 font-semibold">
              {adjusting === 'DAMAGE' && (
                <div>
                  <label className="block text-xs font-black uppercase text-slate-700 mb-1.5">Damage Type</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDamageType('FILLED')}
                      className={`flex-1 py-2 text-xs font-black uppercase rounded-xl border ${damageType === 'FILLED' ? 'bg-red-50 border-red-500 text-red-700' : 'border-slate-200'}`}
                    >
                      Filled Jar
                    </button>
                    <button
                      onClick={() => setDamageType('EMPTY')}
                      className={`flex-1 py-2 text-xs font-black uppercase rounded-xl border ${damageType === 'EMPTY' ? 'bg-red-50 border-red-500 text-red-700' : 'border-slate-200'}`}
                    >
                      Empty Jar
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-black uppercase text-slate-700 mb-1">Jars Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={qty}
                  onChange={(e) => setQty(parseInt(e.target.value) || 0)}
                  className="w-full clay-input"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                disabled={submitting}
                onClick={() => setAdjusting(null)}
                className="px-5 py-2.5 rounded-full text-xs font-black uppercase bg-secondary/15 text-[#2D79A8] transition hover:bg-secondary/35 cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={submitting}
                onClick={handleAdjust}
                className="px-6 py-2.5 rounded-full text-xs font-black uppercase bg-primary text-white shadow-md hover:bg-primary/80 transition cursor-pointer"
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
