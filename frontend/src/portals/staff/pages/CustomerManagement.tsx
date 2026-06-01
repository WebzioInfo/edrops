import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Trash2, Plus, Eye } from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';
import { toast } from 'react-hot-toast';

const StaffLoader = () => (
  <div className="flex min-h-[60vh] items-center justify-center">
    <div className="relative h-16 w-16 rounded-full water-gradient shadow-2xl shadow-edrops-aqua/30">
      <div className="absolute inset-2 animate-ping rounded-full bg-white/40" />
    </div>
  </div>
);

export default function CustomerManagement() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCust, setSelectedCust] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit Schedule Modal state
  const [editingSchedule, setEditingSchedule] = useState(false);
  const [rules, setRules] = useState<any[]>([]);
  const [isScheduleActive, setIsScheduleActive] = useState(true);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const data = await fetchWithAuth('/customer');
      setCustomers(data || []);
    } catch (err: any) {
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const viewDetails = async (cust: any) => {
    try {
      const detailed = await fetchWithAuth(`/customer/${cust.id}`);
      setSelectedCust(detailed);
      setRules(detailed.deliverySchedule?.rules || []);
      setIsScheduleActive(detailed.deliverySchedule?.isActive ?? true);
    } catch (err) {
      toast.error('Failed to load customer details');
    }
  };

  const handleUpdateSchedule = async () => {
    if (!selectedCust) return;
    try {
      await fetchWithAuth(`/schedule/${selectedCust.id}`, {
        method: 'POST',
        body: JSON.stringify({
          isActive: isScheduleActive,
          rules: rules.map(r => ({
            type: r.type,
            dayOfWeek: r.dayOfWeek,
            quantity: r.quantity,
            intervalDays: r.intervalDays,
            customNotes: r.customNotes
          }))
        })
      });
      toast.success('Customer delivery schedule updated successfully');
      setEditingSchedule(false);
      viewDetails(selectedCust);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update schedule');
    }
  };

  const addRule = () => {
    setRules([...rules, { type: 'WEEKLY', dayOfWeek: 1, quantity: 2, intervalDays: 1 }]);
  };

  const removeRule = (idx: number) => {
    setRules(rules.filter((_, i) => i !== idx));
  };

  const updateRuleField = (idx: number, field: string, val: any) => {
    const updated = [...rules];
    updated[idx] = { ...updated[idx], [field]: val };
    setRules(updated);
  };

  if (loading) return <StaffLoader />;

  return (
    <main className="min-h-screen px-4 py-5 text-foreground sm:px-6 lg:px-10 space-y-6">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-[-12rem] top-[-12rem] h-[30rem] w-[30rem] rounded-full bg-[#3B82F6]/10 blur-3xl" />
      </div>

      <section className="clay-card p-6 sm:p-8">
        <span className="inline-flex items-center gap-2 rounded-full bg-background px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-[#2D79A8]">
          <Users className="h-4 w-4" />
          Customers
        </span>
        <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl text-[#245361]">Customer Operations Directory</h1>
        <p className="mt-2 text-muted-foreground">Monitor balances, deposit statements, and configure schedules.</p>
      </section>

      <div className="grid gap-6 lg:grid-cols-[2fr_1.2fr]">
        <div className="space-y-4">
          <div className="clay-card p-4 overflow-x-auto">
            <table className="w-full text-left text-sm font-semibold border-collapse">
              <thead>
                <tr className="border-b border-border/50 text-[#245361] uppercase tracking-wider text-xs font-black">
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Prepaid Balance</th>
                  <th className="py-3 px-4">Deposit Paid/Due</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((cust) => (
                  <tr key={cust.id} className="border-b border-border/30 hover:bg-secondary/5 transition">
                    <td className="py-4 px-4 font-bold text-slate-800">
                      {cust.user?.firstName} {cust.user?.lastName}
                      <span className="block text-xs text-muted-foreground font-semibold">{cust.user?.phone}</span>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                        (cust.jarBalance?.availableJars ?? 0) <= 5 ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
                      }`}>
                        {cust.jarBalance?.availableJars ?? 0} Jars
                      </span>
                    </td>
                    <td className="py-4 px-4 font-bold">
                      <span className="text-emerald-600">₹{cust.jarDeposit?.depositPaid ?? 0}</span> / <span className="text-red-500">₹{cust.jarDeposit?.depositDue ?? 0}</span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <button
                        onClick={() => viewDetails(cust)}
                        className="p-2 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition cursor-pointer inline-flex items-center gap-1 text-xs font-black uppercase"
                      >
                        <Eye className="h-4 w-4" /> View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Customer Detail panel */}
        <div>
          {selectedCust ? (
            <div className="clay-card p-6 space-y-6">
              <div className="border-b border-border/40 pb-4">
                <h2 className="text-2xl font-black text-[#245361]">{selectedCust.user?.firstName} {selectedCust.user?.lastName}</h2>
                <p className="text-sm font-semibold text-slate-600 mt-1">CustomerId: {selectedCust.id}</p>
                <p className="text-sm font-semibold text-slate-600">{selectedCust.user?.email}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-secondary/10 p-4 rounded-2xl text-center">
                  <p className="text-xs font-black uppercase text-slate-500 tracking-wider">Company Held</p>
                  <p className="text-2xl font-black text-slate-800 mt-1">{selectedCust.jarOwnership?.companyJarsHeld ?? 0}</p>
                </div>
                <div className="bg-secondary/10 p-4 rounded-2xl text-center">
                  <p className="text-xs font-black uppercase text-slate-500 tracking-wider">Owned Jars</p>
                  <p className="text-2xl font-black text-slate-800 mt-1">{selectedCust.jarOwnership?.ownedJars ?? 0}</p>
                </div>
              </div>

              {/* Delivery Schedule info card */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-700">Delivery Schedule</h3>
                  <button
                    onClick={() => {
                      setEditingSchedule(true);
                      setRules(selectedCust.deliverySchedule?.rules || []);
                      setIsScheduleActive(selectedCust.deliverySchedule?.isActive ?? true);
                    }}
                    className="text-xs font-black uppercase text-primary hover:underline cursor-pointer"
                  >
                    Edit
                  </button>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-2 text-xs font-bold text-slate-700">
                  <p>Status: <span className={selectedCust.deliverySchedule?.isActive ? "text-emerald-600" : "text-red-500"}>{selectedCust.deliverySchedule?.isActive ? "Active" : "Paused"}</span></p>
                  <div className="space-y-1">
                    {selectedCust.deliverySchedule?.rules?.map((rule: any, i: number) => (
                      <p key={i}>
                        • {rule.type === 'WEEKLY' ? `Every ${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][rule.dayOfWeek!]}` : rule.type === 'INTERVAL' ? `Every ${rule.intervalDays} Days` : 'Custom Instructions'}: <span className="font-black">{rule.type === 'CUSTOM' ? rule.customNotes : `${rule.quantity} Jars`}</span>
                      </p>
                    ))}
                    {(!selectedCust.deliverySchedule?.rules || selectedCust.deliverySchedule.rules.length === 0) && (
                      <p className="text-muted-foreground italic">No scheduling rules created</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Recent Transactions */}
              <div className="space-y-3">
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-700">Recent Transactions</h3>
                <div className="space-y-2 max-h-[160px] overflow-y-auto">
                  {selectedCust.transactions?.map((t: any) => (
                    <div key={t.id} className="text-xs border-b border-border/30 pb-2 flex justify-between items-center font-semibold">
                      <div>
                        <p className="text-slate-800 font-bold">{t.description}</p>
                        <p className="text-slate-400 mt-0.5">{new Date(t.createdAt).toLocaleDateString()}</p>
                      </div>
                      <span className={`font-black ${t.amountJars >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                        {t.amountJars >= 0 ? `+${t.amountJars}` : t.amountJars} Jars
                      </span>
                    </div>
                  ))}
                  {(!selectedCust.transactions || selectedCust.transactions.length === 0) && (
                    <p className="text-xs text-muted-foreground italic">No transactions recorded</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="clay-card p-10 text-center text-slate-600">
              <Users className="h-10 w-10 text-primary/40 mx-auto mb-3" />
              <p className="text-sm font-bold">Select a customer from the directory to view details and edit schedules.</p>
            </div>
          )}
        </div>
      </div>

      {/* Edit Schedule Modal */}
      {editingSchedule && selectedCust && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-border space-y-6"
          >
            <div>
              <h3 className="text-2xl font-black text-[#245361]">Edit Delivery Schedule</h3>
              <p className="text-xs text-slate-600 mt-1">Modify weekly or interval-based replenishment rules for {selectedCust.user?.firstName}.</p>
            </div>

            <div className="flex items-center gap-3">
              <label className="text-xs font-black uppercase text-slate-700">Schedule Status:</label>
              <button
                onClick={() => setIsScheduleActive(!isScheduleActive)}
                className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider ${isScheduleActive ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}
              >
                {isScheduleActive ? "Active" : "Paused"}
              </button>
            </div>

            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
              {rules.map((rule, idx) => (
                <div key={idx} className="bg-slate-50 border border-slate-200 p-4 rounded-2xl relative space-y-3 font-semibold">
                  <button
                    onClick={() => removeRule(idx)}
                    className="absolute top-3 right-3 text-red-500 hover:text-red-700 cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-black uppercase text-slate-700 mb-1">Rule Type</label>
                      <select
                        value={rule.type}
                        onChange={(e) => updateRuleField(idx, 'type', e.target.value)}
                        className="w-full clay-input py-2 text-xs"
                      >
                        <option value="WEEKLY">Weekly</option>
                        <option value="INTERVAL">Interval</option>
                        <option value="CUSTOM">Custom</option>
                      </select>
                    </div>

                    {rule.type !== 'CUSTOM' && (
                      <div>
                        <label className="block text-xs font-black uppercase text-slate-700 mb-1">Jars Qty</label>
                        <input
                          type="number"
                          min="1"
                          value={rule.quantity || 1}
                          onChange={(e) => updateRuleField(idx, 'quantity', parseInt(e.target.value) || 1)}
                          className="w-full clay-input py-2 text-xs"
                        />
                      </div>
                    )}
                  </div>

                  {rule.type === 'WEEKLY' ? (
                    <div>
                      <label className="block text-xs font-black uppercase text-slate-700 mb-1">Day of Week</label>
                      <select
                        value={rule.dayOfWeek || 1}
                        onChange={(e) => updateRuleField(idx, 'dayOfWeek', parseInt(e.target.value))}
                        className="w-full clay-input py-2 text-xs"
                      >
                        {['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map((day, i) => (
                          <option key={i} value={i}>{day}</option>
                        ))}
                      </select>
                    </div>
                  ) : rule.type === 'INTERVAL' ? (
                    <div>
                      <label className="block text-xs font-black uppercase text-slate-700 mb-1">Interval (Days)</label>
                      <input
                        type="number"
                        min="1"
                        value={rule.intervalDays || 1}
                        onChange={(e) => updateRuleField(idx, 'intervalDays', parseInt(e.target.value) || 1)}
                        className="w-full clay-input py-2 text-xs"
                      />
                    </div>
                  ) : (
                    <div className="col-span-2">
                      <label className="block text-xs font-black uppercase text-slate-700 mb-1">Custom Instructions</label>
                      <textarea
                        value={rule.customNotes || ''}
                        onChange={(e) => updateRuleField(idx, 'customNotes', e.target.value)}
                        placeholder="E.g. Deliver 2 jars on the 1st of every month..."
                        className="w-full clay-input py-2 text-xs min-h-[60px]"
                      />
                    </div>
                  )}
                </div>
              ))}

              <button
                onClick={addRule}
                className="w-full py-3 border-2 border-dashed border-primary/40 rounded-2xl text-xs font-black uppercase tracking-wider text-primary hover:bg-primary/5 transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="h-4 w-4" /> Add Delivery Rule
              </button>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setEditingSchedule(false)}
                className="px-5 py-2.5 rounded-full text-xs font-black uppercase bg-secondary/15 text-[#2D79A8] transition hover:bg-secondary/35 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateSchedule}
                className="px-6 py-2.5 rounded-full text-xs font-black uppercase bg-primary text-white shadow-md hover:bg-primary/80 transition cursor-pointer"
              >
                Save Schedule
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </main>
  );
}
