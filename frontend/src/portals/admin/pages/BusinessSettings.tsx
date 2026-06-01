import { useEffect, useState } from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';
import { toast } from 'react-hot-toast';

const AdminLoader = () => (
  <div className="flex min-h-[60vh] items-center justify-center">
    <div className="relative h-16 w-16 rounded-full water-gradient shadow-2xl shadow-edrops-aqua/30">
      <div className="absolute inset-2 animate-ping rounded-full bg-white/40" />
    </div>
  </div>
);

export default function BusinessSettings() {
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await fetchWithAuth('/settings');
      const mapping: Record<string, string> = {};
      (data || []).forEach((s: any) => {
        mapping[s.key] = s.value;
      });
      setFormValues(mapping);
    } catch (e) {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleChange = (key: string, val: string) => {
    setFormValues({ ...formValues, [key]: val });
  };

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await fetchWithAuth('/settings/bulk', {
        method: 'POST',
        body: JSON.stringify(formValues)
      });
      toast.success('Business settings updated dynamically!');
      loadSettings();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <AdminLoader />;

  return (
    <main className="space-y-6">
      <section className="clay-card p-6 sm:p-8">
        <span className="inline-flex items-center gap-2 rounded-full bg-background px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-primary">
          <SettingsIcon className="h-4 w-4" /> Operations Control
        </span>
        <h1 className="mt-5 text-4xl font-black sm:text-5xl text-[#245361]">Global Business Settings</h1>
        <p className="mt-2 text-muted-foreground text-sm">Control pricing matrix, slot availability, and security deposits without modifying code.</p>
      </section>

      <form onSubmit={handleSaveAll} className="clay-card p-6 sm:p-8 space-y-6 font-semibold">
        <div className="grid gap-6 sm:grid-cols-2">
          
          {/* Pricing parameters */}
          <div className="space-y-4">
            <h3 className="text-base font-black text-[#245361] uppercase tracking-wider border-b border-border/40 pb-2">Pricing & Jars Deposits</h3>
            
            <div>
              <label className="block text-xs font-black uppercase text-slate-700 mb-1.5">Default Jar retail Price (₹)</label>
              <input
                type="text"
                value={formValues['DEFAULT_JAR_PRICE'] || ''}
                onChange={(e) => handleChange('DEFAULT_JAR_PRICE', e.target.value)}
                className="w-full clay-input"
              />
              <p className="text-[10px] text-slate-400 mt-1 font-semibold">Price per individual water jar exchange</p>
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-slate-700 mb-1.5">Exchange Rate per Delivery (₹)</label>
              <input
                type="text"
                value={formValues['EXCHANGE_PRICE'] || ''}
                onChange={(e) => handleChange('EXCHANGE_PRICE', e.target.value)}
                className="w-full clay-input"
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-slate-700 mb-1.5">Security Deposit Amount per active Jar (₹)</label>
              <select
                value={formValues['DEPOSIT_AMOUNT_PER_JAR'] || '200'}
                onChange={(e) => handleChange('DEPOSIT_AMOUNT_PER_JAR', e.target.value)}
                className="w-full clay-input"
              >
                <option value="200">₹200 (Default)</option>
                <option value="250">₹250</option>
                <option value="300">₹300</option>
              </select>
              <p className="text-[10px] text-slate-400 mt-1 font-semibold">Security charge applied per company jar held by customer</p>
            </div>
          </div>

          {/* Delivery logistics controls */}
          <div className="space-y-4">
            <h3 className="text-base font-black text-[#245361] uppercase tracking-wider border-b border-border/40 pb-2">Logistics & Limits</h3>
            
            <div>
              <label className="block text-xs font-black uppercase text-slate-700 mb-1.5">Low Balance Warning Threshold (Jars)</label>
              <input
                type="number"
                value={formValues['LOW_BALANCE_THRESHOLD'] || '5'}
                onChange={(e) => handleChange('LOW_BALANCE_THRESHOLD', e.target.value)}
                className="w-full clay-input"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black uppercase text-slate-700 mb-1.5">Min Delivery Qty</label>
                <input
                  type="number"
                  value={formValues['MIN_DELIVERY_QTY'] || '1'}
                  onChange={(e) => handleChange('MIN_DELIVERY_QTY', e.target.value)}
                  className="w-full clay-input"
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase text-slate-700 mb-1.5">Max Delivery Qty</label>
                <input
                  type="number"
                  value={formValues['MAX_DELIVERY_QTY'] || '50'}
                  onChange={(e) => handleChange('MAX_DELIVERY_QTY', e.target.value)}
                  className="w-full clay-input"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-slate-700 mb-1.5">Allowed Delivery Days</label>
              <input
                type="text"
                value={formValues['DELIVERY_DAYS'] || '1,2,3,4,5,6'}
                onChange={(e) => handleChange('DELIVERY_DAYS', e.target.value)}
                className="w-full clay-input"
                placeholder="1=Mon, 2=Tue... 6=Sat"
              />
              <p className="text-[10px] text-slate-400 mt-1 font-semibold">Comma-separated days allowed for schedules</p>
            </div>
          </div>
        </div>

        {/* Delivery Slot parameters */}
        <div className="space-y-4 border-t border-border/40 pt-4">
          <h3 className="text-base font-black text-[#245361] uppercase tracking-wider">Time Windows</h3>
          <div>
            <label className="block text-xs font-black uppercase text-slate-700 mb-1.5">Time Slots (Comma separated)</label>
            <input
              type="text"
              value={formValues['DELIVERY_SLOTS'] || ''}
              onChange={(e) => handleChange('DELIVERY_SLOTS', e.target.value)}
              className="w-full clay-input"
              placeholder="e.g. 08:00 AM - 12:00 PM, 04:00 PM - 08:00 PM"
            />
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-border/40">
          <button
            type="submit"
            disabled={saving}
            className="clay-btn bg-emerald-600 text-white hover:bg-emerald-700 font-black text-sm uppercase py-3.5 px-8 cursor-pointer disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Apply Dynamic Settings'}
          </button>
        </div>
      </form>
    </main>
  );
}
