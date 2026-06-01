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
    <main className="min-h-screen px-4 py-5 text-foreground sm:px-6 lg:px-10 space-y-6">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-[-12rem] bottom-[-12rem] h-[30rem] w-[30rem] rounded-full bg-blue-500/10 blur-3xl" />
      </div>

      <section className="clay-card p-6 sm:p-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-background px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-primary">
            <ClipboardList className="h-4 w-4" />
            Inventory
          </span>
          <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl text-[#245361]">Warehouse Stock Audit</h1>
          <p className="mt-2 text-muted-foreground">Track production cycles, damaged allocations, and raw inventory.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => { setAdjusting('PRODUCTION'); setQty(10); }}
            className="p-3 bg-primary text-white rounded-2xl text-xs font-black uppercase tracking-wider cursor-pointer shadow-md hover:bg-primary/80 transition"
          >
            Log Production
          </button>
          <button
            onClick={() => { setAdjusting('REPLENISH'); setQty(50); }}
            className="p-3 bg-emerald-600 text-white rounded-2xl text-xs font-black uppercase tracking-wider cursor-pointer shadow-md hover:bg-emerald-700 transition"
          >
            Direct Replenish
          </button>
          <button
            onClick={() => { setAdjusting('DAMAGE'); setQty(1); }}
            className="p-3 bg-red-600 text-white rounded-2xl text-xs font-black uppercase tracking-wider cursor-pointer shadow-md hover:bg-red-700 transition"
          >
            Log Damage
          </button>
        </div>
      </section>

      {/* Stock Cards */}
      <section className="grid gap-6 grid-cols-3">
        <div className="clay-card p-6 text-center space-y-2 bg-emerald-50/50 border-emerald-100">
          <p className="text-xs font-black uppercase text-emerald-700 tracking-wider">Filled Jars Available</p>
          <p className="text-4xl sm:text-5xl font-black text-emerald-900">{status?.filledJars ?? 0}</p>
        </div>
        <div className="clay-card p-6 text-center space-y-2 bg-blue-50/50 border-blue-100">
          <p className="text-xs font-black uppercase text-blue-700 tracking-wider">Empty Jars Return Pool</p>
          <p className="text-4xl sm:text-5xl font-black text-blue-900">{status?.emptyJars ?? 0}</p>
        </div>
        <div className="clay-card p-6 text-center space-y-2 bg-red-50/50 border-red-100">
          <p className="text-xs font-black uppercase text-red-700 tracking-wider">Damaged/Discarded Jars</p>
          <p className="text-4xl sm:text-5xl font-black text-red-900">{status?.damagedJars ?? 0}</p>
        </div>
      </section>

      {/* Inventory Logs Audit Feed */}
      <section className="clay-card p-6 space-y-4">
        <h3 className="text-lg font-black text-[#245361] uppercase tracking-wider flex items-center gap-1.5">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          Warehouse Audit Trail
        </h3>
        <div className="divide-y divide-border/40 max-h-[350px] overflow-y-auto pr-2">
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
    </main>
  );
}
