import { useEffect, useState } from 'react';
import { Layers } from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';
import { toast } from 'react-hot-toast';

const StaffLoader = () => (
  <div className="flex min-h-[60vh] items-center justify-center">
    <div className="relative h-16 w-16 rounded-full water-gradient shadow-2xl shadow-edrops-aqua/30">
      <div className="absolute inset-2 animate-ping rounded-full bg-white/40" />
    </div>
  </div>
);

export default function PackageManagement() {
  const [packages, setPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPackages = async () => {
    try {
      setLoading(true);
      const data = await fetchWithAuth('/recharge/packages/all');
      setPackages(data || []);
    } catch (err: any) {
      toast.error('Failed to load packages');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPackages();
  }, []);

  if (loading) return <StaffLoader />;

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* ─── COMPACT TOOLBAR ────────────────────────────── */}
      <div className="bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-800">Prepaid Jar Packages</span>
            <span className="text-[11px] text-slate-400 block">Catalog of upfront water packages available for customer purchase</span>
          </div>
        </div>

        <button
          onClick={loadPackages}
          title="Refresh"
          className="p-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition cursor-pointer"
        >
          <Layers className="w-3.5 h-3.5 text-slate-500" />
        </button>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {packages.map((pkg) => (
          <article key={pkg.id} className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {pkg.jarCount} Jars Pack
                </span>
                {pkg.offerLabel && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                    {pkg.offerLabel}
                  </span>
                )}
              </div>
              <h2 className="text-base font-bold text-slate-800 mt-2">{pkg.name}</h2>
              <p className="text-xs text-slate-500 mt-1">{pkg.description || 'No description provided.'}</p>
            </div>
            <div className="flex flex-col gap-1 border-t border-slate-100 pt-3">
              {pkg.originalPrice && pkg.originalPrice > pkg.price && (
                <div className="flex items-baseline justify-between text-[11px] text-slate-400 line-through">
                  <span>Original Price</span>
                  <span>₹{pkg.originalPrice}</span>
                </div>
              )}
              <div className="flex items-baseline justify-between">
                <span className="text-xs uppercase tracking-wider font-bold text-slate-500">Retail Price</span>
                <span className="text-xl font-black text-slate-800">₹{pkg.price}</span>
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
