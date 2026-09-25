import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';
import { toast } from 'react-hot-toast';
import { EdropsPageLoader } from '../../../components/common/EdropsPageLoader';

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

  if (loading) return <EdropsPageLoader fullPage />;

  return (
    <div className="space-y-3.5 sm:space-y-4 animate-in fade-in duration-150">
      {/* ─── COMPACT TOOLBAR ────────────────────────────── */}
      <div className="bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-700">
            {packages.length} {packages.length === 1 ? 'Package' : 'Packages'} Available
          </span>
          <span className="text-xs text-slate-500 hidden sm:inline">
            Upfront jar packages for customer purchase
          </span>
        </div>
        <button
          type="button"
          onClick={loadPackages}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition cursor-pointer shadow-2xs"
          title="Refresh Packages"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {packages.map((pkg) => (
          <article key={pkg.id} className="bg-white rounded-xl border border-[#E2E8F0] shadow-2xs p-4 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {pkg.jarCount} Jars Pack
                </span>
                {pkg.offerLabel && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                    {pkg.offerLabel}
                  </span>
                )}
              </div>
              <h2 className="text-sm sm:text-base font-bold text-[#16324F] mt-2">{pkg.name}</h2>
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
                <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400">Retail Price</span>
                <span className="text-xl font-extrabold text-[#16324F]">₹{pkg.price}</span>
              </div>
            </div>
          </article>
        ))}
        {packages.length === 0 && (
          <div className="col-span-full py-12 text-center bg-white rounded-xl border border-[#E2E8F0] text-slate-400 text-xs">
            No packages found.
          </div>
        )}
      </section>
    </div>
  );
}
