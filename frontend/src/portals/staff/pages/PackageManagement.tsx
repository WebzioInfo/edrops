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
    <main className="min-h-screen px-4 py-5 text-foreground sm:px-6 lg:px-10 space-y-6">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute right-[-12rem] bottom-[-12rem] h-[30rem] w-[30rem] rounded-full bg-[#10B981]/10 blur-3xl" />
      </div>

      <section className="clay-card p-6 sm:p-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-background px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-[#10B981]">
            <Layers className="h-4 w-4" />
            Packages
          </span>
          <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl text-[#245361]">Prepaid Jar Packages</h1>
          <p className="mt-2 text-muted-foreground">View upfront water package catalog offered to customers. Contact Admin to make updates.</p>
        </div>
      </section>

      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {packages.map((pkg) => (
          <article key={pkg.id} className="clay-card p-6 flex flex-col justify-between space-y-6">
            <div>
              <div className="flex items-center justify-between">
                <span className="px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-50 text-emerald-700">
                  {pkg.jarCount} Jars Pack
                </span>
                {pkg.offerLabel && (
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#F59E0B]/10 text-[#F59E0B]">
                    {pkg.offerLabel}
                  </span>
                )}
              </div>
              <h2 className="text-2xl font-black text-[#245361] mt-4">{pkg.name}</h2>
              <p className="text-sm font-semibold text-slate-600 mt-2">{pkg.description || 'No description provided.'}</p>
            </div>
            <div className="flex flex-col gap-2 border-t border-border/40 pt-4">
              {pkg.originalPrice && pkg.originalPrice > pkg.price && (
                <div className="flex items-baseline justify-between text-xs text-slate-400 line-through">
                  <span>Original Price</span>
                  <span>₹{pkg.originalPrice}</span>
                </div>
              )}
              <div className="flex items-baseline justify-between">
                <span className="text-xs uppercase tracking-wider font-bold text-slate-500">Retail Price</span>
                <span className="text-2xl font-black text-slate-800">₹{pkg.price}</span>
              </div>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
