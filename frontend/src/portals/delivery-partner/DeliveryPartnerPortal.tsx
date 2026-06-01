import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Droplets, Navigation, Phone, CheckCircle, Clock, Save, FileText, MapPin } from 'lucide-react';
import { fetchWithAuth } from '../../api/client';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';

export default function DeliveryPartnerPortal() {
  const { logout } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Submission form state
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [deliveredQty, setDeliveredQty] = useState(0);
  const [emptyCollected, setEmptyCollected] = useState(0);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadTasks = async () => {
    try {
      setLoading(true);
      const data = await fetchWithAuth('/delivery/partner/my-tasks');
      setTasks(data || []);
    } catch (err: any) {
      toast.error('Failed to load assigned tasks');
    } finally {
      setLoading(false);
    }
  };

  const syncOfflineQueue = async () => {
    const queue = JSON.parse(localStorage.getItem('offline_delivery_reports') || '[]');
    if (queue.length === 0) return;

    toast.loading('Syncing offline reports...', { id: 'sync-status' });
    let successCount = 0;
    const remainingQueue = [];

    for (const report of queue) {
      try {
        await fetchWithAuth(`/delivery/${report.deliveryId}/report`, {
          method: 'POST',
          body: JSON.stringify({
            deliveredQty: report.deliveredQty,
            emptyCollected: report.emptyCollected,
            notes: report.notes
          })
        });
        successCount++;
      } catch (err) {
        remainingQueue.push(report);
      }
    }

    localStorage.setItem('offline_delivery_reports', JSON.stringify(remainingQueue));
    toast.dismiss('sync-status');
    if (successCount > 0) {
      toast.success(`Synced ${successCount} offline reports!`);
      loadTasks();
    }
  };

  useEffect(() => {
    loadTasks();
    window.addEventListener('online', syncOfflineQueue);
    syncOfflineQueue();
    return () => {
      window.removeEventListener('online', syncOfflineQueue);
    };
  }, []);

  const openSubmitModal = (task: any) => {
    setActiveTaskId(task.id);
    setDeliveredQty(task.requiredQuantity);
    setEmptyCollected(task.requiredQuantity);
    setNotes('');
  };

  const handleSubmit = async () => {
    if (!activeTaskId) return;
    const reportData = {
      deliveryId: activeTaskId,
      deliveredQty,
      emptyCollected,
      notes
    };

    setSubmitting(true);
    try {
      await fetchWithAuth(`/delivery/${activeTaskId}/report`, {
        method: 'POST',
        body: JSON.stringify({
          deliveredQty,
          emptyCollected,
          notes
        })
      });
      toast.success('Delivery report submitted to staff!');
      setActiveTaskId(null);
      loadTasks();
    } catch (err: any) {
      // Offline support: queue the report if network is down
      if (!window.navigator.onLine || err.message === 'Failed to fetch' || err.status === 0) {
        const queue = JSON.parse(localStorage.getItem('offline_delivery_reports') || '[]');
        queue.push(reportData);
        localStorage.setItem('offline_delivery_reports', JSON.stringify(queue));
        toast.success('Offline: Report queued for sync!');
        setActiveTaskId(null);
        // Optimistic update of local UI
        setTasks(prev => prev.map(t => t.id === activeTaskId ? { ...t, report: { partnerDeliveredQty: deliveredQty, partnerEmptyCollected: emptyCollected, partnerNotes: notes } } : t));
      } else {
        toast.error(err.message || 'Failed to submit report');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="relative h-16 w-16 rounded-full water-gradient shadow-2xl shadow-edrops-aqua/30">
          <div className="absolute inset-2 animate-ping rounded-full bg-white/40" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-foreground pb-12">
      {/* Mobile-first Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-4.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white shadow-md shadow-primary/10">
            <Droplets className="h-5 w-5" />
          </span>
          <span className="text-lg font-black tracking-tight text-[#245361]">Driver Run</span>
        </div>
        <button
          onClick={logout}
          className="text-xs font-black uppercase text-rose-600 bg-rose-50 px-4 py-2.5 rounded-full hover:bg-rose-100 transition cursor-pointer"
        >
          Logout
        </button>
      </header>

      {/* Task List Container */}
      <main className="max-w-md mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-black text-[#245361]">Assigned Stops ({tasks.length})</h2>
          <button onClick={loadTasks} className="text-xs font-black text-primary uppercase tracking-wider">
            Refresh
          </button>
        </div>

        {tasks.map((task, index) => {
          const isDelivered = task.status === 'DELIVERED';
          const hasReport = !!task.report;
          
          return (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-black text-[#245361]">{task.customer?.user?.firstName} {task.customer?.user?.lastName}</h3>
                  <div className="flex gap-1.5 items-start text-xs font-semibold text-slate-700 mt-1">
                    <MapPin className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                    <span>{task.address?.street}, {task.address?.city}</span>
                  </div>
                </div>
                
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${
                  isDelivered 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                    : 'bg-primary/5 text-primary border border-primary/10'
                }`}>
                  {isDelivered ? <CheckCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                  {task.status}
                </span>
              </div>

              {/* Contact and navigation buttons */}
              <div className="grid grid-cols-2 gap-2">
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(task.address?.street + ', ' + task.address?.city)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-slate-100 text-slate-800 text-xs font-black uppercase tracking-wider py-3.5 rounded-2xl flex items-center justify-center gap-2 hover:bg-slate-200 transition"
                >
                  <Navigation className="h-4 w-4 text-primary" /> Navigate
                </a>
                <a
                  href={`tel:${task.customer?.user?.phone}`}
                  className="bg-slate-100 text-slate-800 text-xs font-black uppercase tracking-wider py-3.5 rounded-2xl flex items-center justify-center gap-2 hover:bg-slate-200 transition"
                >
                  <Phone className="h-4 w-4 text-emerald-600" /> Call Customer
                </a>
              </div>

              <div className="border-t border-slate-100 pt-4 flex items-center justify-between">
                <span className="text-sm font-black text-slate-700 bg-secondary/10 px-3.5 py-1.5 rounded-xl">
                  Qty Required: {task.requiredQuantity}
                </span>

                {!hasReport ? (
                  <button
                    onClick={() => openSubmitModal(task)}
                    className="bg-primary text-white text-xs font-black uppercase tracking-wider px-5 py-3 rounded-2xl shadow-md hover:bg-primary/95 transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Save className="h-3.5 w-3.5" /> Submit Log
                  </button>
                ) : (
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5" /> Submitted to Staff
                  </span>
                )}
              </div>
            </motion.div>
          );
        })}

        {tasks.length === 0 && (
          <div className="text-center py-10 space-y-2">
            <Clock className="h-10 w-10 text-slate-400 mx-auto" />
            <h3 className="text-base font-black text-slate-700">No assigned runs today</h3>
            <p className="text-xs text-slate-500">Check back later when staff assigns your route.</p>
          </div>
        )}
      </main>

      {/* Driver Report Modal */}
      {activeTaskId && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-white rounded-t-[2rem] sm:rounded-[2rem] p-6 max-w-sm w-full shadow-2xl space-y-6"
          >
            <div>
              <h3 className="text-xl font-black text-[#245361]">Submit Delivery Log</h3>
              <p className="text-xs text-slate-500 mt-1">Enter details of the exchange at customer location.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase text-slate-700 mb-1.5">Delivered Quantity</label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setDeliveredQty(prev => Math.max(0, prev - 1))}
                    className="h-11 w-11 rounded-xl bg-slate-100 font-black text-lg"
                  >
                    -
                  </button>
                  <span className="w-12 text-center text-lg font-black">{deliveredQty}</span>
                  <button
                    onClick={() => setDeliveredQty(prev => prev + 1)}
                    className="h-11 w-11 rounded-xl bg-slate-100 font-black text-lg"
                  >
                    +
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-slate-700 mb-1.5">Empty Jars Collected</label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setEmptyCollected(prev => Math.max(0, prev - 1))}
                    className="h-11 w-11 rounded-xl bg-slate-100 font-black text-lg"
                  >
                    -
                  </button>
                  <span className="w-12 text-center text-lg font-black">{emptyCollected}</span>
                  <button
                    onClick={() => setEmptyCollected(prev => prev + 1)}
                    className="h-11 w-11 rounded-xl bg-slate-100 font-black text-lg"
                  >
                    +
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-slate-700 mb-1.5">Delivery Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full clay-input min-h-[60px] resize-none"
                  placeholder="Leave customer feedback..."
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                disabled={submitting}
                onClick={() => setActiveTaskId(null)}
                className="flex-1 py-3.5 rounded-full text-xs font-black uppercase bg-slate-100 text-slate-700 transition"
              >
                Cancel
              </button>
              <button
                disabled={submitting}
                onClick={handleSubmit}
                className="flex-1 py-3.5 rounded-full text-xs font-black uppercase bg-primary text-white shadow-md hover:bg-primary/95 transition"
              >
                {submitting ? 'Sending...' : 'Submit Report'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
