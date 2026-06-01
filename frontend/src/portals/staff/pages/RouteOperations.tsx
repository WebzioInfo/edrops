import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  CheckCircle2, Droplets, Truck, UserPlus, FileSignature, RefreshCw, Clock
} from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';
import { toast } from 'react-hot-toast';

const StaffLoader = () => (
  <div className="flex min-h-[60vh] items-center justify-center">
    <div className="relative h-16 w-16 rounded-full water-gradient shadow-2xl shadow-edrops-aqua/30">
      <div className="absolute inset-2 animate-ping rounded-full bg-white/40" />
    </div>
  </div>
);

export default function RouteOperations() {
  const [stops, setStops] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Confirmation Modal state
  const [activeConfirmId, setActiveConfirmId] = useState<string | null>(null);
  const [deliveredQty, setDeliveredQty] = useState(0);
  const [emptyCollected, setEmptyCollected] = useState(0);
  const [damagedQty, setDamagedQty] = useState(0);
  const [staffNotes, setStaffNotes] = useState('');
  const [submittingConfirm, setSubmittingConfirm] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [deliveriesData, partnersData] = await Promise.all([
        fetchWithAuth('/delivery/today'),
        fetchWithAuth('/staff/delivery-partners')
      ]);
      setStops(deliveriesData || []);
      setPartners(partnersData || []);
    } catch (err: any) {
      toast.error('Failed to load operational data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAssign = async (deliveryId: string, partnerId: string) => {
    if (!partnerId) return;
    try {
      await fetchWithAuth(`/delivery/${deliveryId}/assign`, {
        method: 'POST',
        body: JSON.stringify({ deliveryPartnerId: partnerId })
      });
      toast.success('Assigned delivery partner successfully!');
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to assign partner');
    }
  };

  const handleGenerateToday = async () => {
    try {
      const res = await fetchWithAuth('/delivery/generate', { method: 'POST' });
      toast.success(`Today's route generated! ${res.generatedCount} stops added.`);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate today\'s route');
    }
  };

  const openConfirmModal = (stop: any) => {
    setActiveConfirmId(stop.id);
    setDeliveredQty(stop.report?.partnerDeliveredQty ?? stop.requiredQuantity);
    setEmptyCollected(stop.report?.partnerEmptyCollected ?? stop.requiredQuantity);
    setDamagedQty(0);
    setStaffNotes(stop.report?.partnerNotes ?? '');
  };

  const handleConfirmFinal = async () => {
    if (!activeConfirmId) return;
    setSubmittingConfirm(true);
    try {
      await fetchWithAuth(`/delivery/${activeConfirmId}/confirm`, {
        method: 'POST',
        body: JSON.stringify({
          deliveredQty,
          emptyCollected,
          damagedQty,
          notes: staffNotes
        })
      });
      toast.success('Delivery confirmed! Balances updated.');
      setActiveConfirmId(null);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to confirm delivery');
    } finally {
      setSubmittingConfirm(false);
    }
  };

  if (loading) return <StaffLoader />;

  const stats = [
    [stops.length.toString(), 'Stops'],
    [stops.reduce((acc, s) => acc + s.requiredQuantity, 0).toString(), 'Jars'],
    [stops.filter(s => s.status === 'DELIVERED').length.toString(), 'Done']
  ];

  return (
    <main className="min-h-screen px-4 py-5 text-foreground sm:px-6 lg:px-10 space-y-6">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-[-12rem] top-[-12rem] h-[30rem] w-[30rem] rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute bottom-[-12rem] right-[-10rem] h-[28rem] w-[28rem] rounded-full bg-secondary/30 blur-3xl" />
      </div>

      <section className="clay-card overflow-hidden rounded-[2.5rem] p-6 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-background px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-primary">
              <Truck className="h-4 w-4" />
              Daily Operations
            </span>
            <h1 className="mt-5 max-w-2xl text-4xl font-black tracking-tight sm:text-6xl text-[#245361]">
              Today's Route Board
            </h1>
            <p className="mt-4 max-w-xl text-base font-medium leading-8 text-muted-foreground">
              Manually assign drivers to generated stops, monitor partner feedback, and confirm final quantities.
            </p>
          </div>
          <div className="flex flex-col gap-4 items-center">
            <div className="grid grid-cols-3 gap-3 rounded-[2rem] bg-background/50 p-3 w-full">
              {stats.map(([value, label]) => (
                <div key={label} className="rounded-[1.35rem] bg-background p-4 text-center min-w-[70px]">
                  <p className="text-2xl font-black">{value}</p>
                  <p className="mt-1 text-[0.65rem] font-black uppercase tracking-[0.18em] text-muted-foreground/80">{label}</p>
                </div>
              ))}
            </div>
            <button
              onClick={handleGenerateToday}
              className="w-full py-4 rounded-full bg-primary text-sm font-black text-primary-foreground shadow-lg hover:shadow-primary/20 transition active:scale-98 cursor-pointer flex items-center justify-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Generate Today's Deliveries
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="grid gap-4">
          {stops.map((stop, index) => {
            const hasReport = !!stop.report;
            const isConfirmed = stop.status === 'DELIVERED';
            const assignedPartnerId = stop.assignment?.deliveryPartnerId || '';

            return (
              <motion.article
                key={stop.id}
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.06 }}
                className="clay-card p-5 space-y-4"
              >
                <div className="flex items-start gap-4">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${isConfirmed ? 'bg-emerald-50 text-emerald-600' : 'bg-primary text-primary-foreground'}`}>
                    {isConfirmed ? <CheckCircle2 className="h-6 w-6" /> : <Droplets className="h-6 w-6" />}
                  </div>
                  
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h2 className="text-xl font-black text-[#245361]">{stop.customer?.user?.firstName} {stop.customer?.user?.lastName}</h2>
                        <p className="mt-1 text-sm font-semibold text-slate-700">{stop.address?.street}, {stop.address?.city}</p>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">
                          Jar balance: {stop.customer?.jarBalance?.availableJars} Available
                        </p>
                      </div>
                      <span className={`w-fit rounded-full px-3.5 py-1 text-xs font-black uppercase tracking-[0.16em] ${
                        isConfirmed 
                          ? 'bg-emerald-50 text-emerald-700'
                          : hasReport
                          ? 'bg-amber-50 text-amber-700 animate-pulse'
                          : 'bg-primary/10 text-primary'
                      }`}>
                        {isConfirmed ? 'CONFIRMED & DEDUCTED' : hasReport ? 'PARTNER REPORTED' : stop.status}
                      </span>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-4 items-center justify-between border-t border-border/40 pt-4">
                      <div className="flex items-center gap-2">
                        <UserPlus className="h-4 w-4 text-primary" />
                        <select
                          disabled={isConfirmed}
                          value={assignedPartnerId}
                          onChange={(e) => handleAssign(stop.id, e.target.value)}
                          className="bg-secondary/15 border-transparent text-sm font-bold text-[#245361] py-2 px-3.5 rounded-xl outline-none"
                        >
                          <option value="">Unassigned</option>
                          {partners.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.user?.firstName} {p.user?.lastName} ({p.vehiclePlate})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex gap-2">
                        <span className="text-sm font-black text-[#245361] bg-secondary/10 px-3.5 py-2 rounded-xl">
                          Required: {stop.requiredQuantity} Jars
                        </span>
                        
                        {hasReport && !isConfirmed && (
                          <button
                            onClick={() => openConfirmModal(stop)}
                            className="clay-btn bg-emerald-600 text-white hover:bg-emerald-700 px-4.5 py-2 flex items-center gap-1.5 cursor-pointer text-xs font-black uppercase tracking-wider"
                          >
                            <FileSignature className="h-4 w-4" />
                            Verify & Confirm
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {hasReport && (
                  <div className="bg-secondary/10 border border-secondary/20 rounded-2xl p-4.5 text-xs font-semibold text-slate-800 space-y-2 mt-2">
                    <p className="font-black text-[#245361] uppercase tracking-wider">Driver Submission:</p>
                    <div className="grid grid-cols-2 gap-2 text-slate-700">
                      <p>Delivered Qty: <span className="font-black text-foreground">{stop.report.partnerDeliveredQty}</span></p>
                      <p>Empties Collected: <span className="font-black text-foreground">{stop.report.partnerEmptyCollected}</span></p>
                    </div>
                    {stop.report.partnerNotes && (
                      <p className="italic text-slate-600">Notes: "{stop.report.partnerNotes}"</p>
                    )}
                  </div>
                )}
              </motion.article>
            );
          })}
          {stops.length === 0 && (
            <div className="clay-card p-10 text-center space-y-2">
              <Clock className="h-10 w-10 text-primary mx-auto" />
              <h3 className="text-lg font-black">No stops generated for today yet</h3>
              <p className="text-sm text-slate-600">Click the 'Generate' button above to build today's hydration routes.</p>
            </div>
          )}
        </div>

        <aside className="space-y-6">
          <div className="clay-card bg-primary text-primary-foreground">
            <Droplets className="h-8 w-8 text-white" />
            <h2 className="mt-5 text-2xl font-black text-white">Route Pulse</h2>
            <p className="mt-3 text-xs font-semibold leading-6 text-white/85">
              Confirm driver reports to decrease customer prepaid jar balances instantly. Be sure to log damaged jars to update inventory audits.
            </p>
          </div>
        </aside>
      </section>

      {/* Verification / Confirmation Modal */}
      {activeConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-border space-y-6"
          >
            <div>
              <h3 className="text-2xl font-black text-[#245361]">Final Confirmation</h3>
              <p className="text-xs text-slate-600 mt-1">Review jar exchanges. Submitting will decrement the customer's prepaid jar balance.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase text-slate-700 mb-1.5">Delivered Jars Qty</label>
                <input
                  type="number"
                  value={deliveredQty}
                  onChange={(e) => setDeliveredQty(parseInt(e.target.value) || 0)}
                  className="w-full clay-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase text-slate-700 mb-1.5">Empty Jars Collected</label>
                  <input
                    type="number"
                    value={emptyCollected}
                    onChange={(e) => setEmptyCollected(parseInt(e.target.value) || 0)}
                    className="w-full clay-input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase text-slate-700 mb-1.5">Damaged Jars</label>
                  <input
                    type="number"
                    value={damagedQty}
                    onChange={(e) => setDamagedQty(parseInt(e.target.value) || 0)}
                    className="w-full clay-input"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-slate-700 mb-1.5">Staff Audit Notes</label>
                <textarea
                  value={staffNotes}
                  onChange={(e) => setStaffNotes(e.target.value)}
                  className="w-full clay-input min-h-[70px] resize-none"
                  placeholder="Review observations..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                disabled={submittingConfirm}
                onClick={() => setActiveConfirmId(null)}
                className="px-5 py-2.5 rounded-full text-xs font-black uppercase bg-secondary/15 text-[#2D79A8] transition hover:bg-secondary/35 cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={submittingConfirm}
                onClick={handleConfirmFinal}
                className="px-6 py-2.5 rounded-full text-xs font-black uppercase bg-primary text-white shadow-md hover:bg-primary/80 transition cursor-pointer"
              >
                {submittingConfirm ? 'Confirming...' : 'Approve & Deduct'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </main>
  );
}
