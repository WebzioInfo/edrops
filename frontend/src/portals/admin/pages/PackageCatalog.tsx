import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Layers, Plus, Trash2, Copy } from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';
import { toast } from 'react-hot-toast';

const AdminLoader = () => (
  <div className="flex min-h-[60vh] items-center justify-center">
    <div className="relative h-16 w-16 rounded-full water-gradient shadow-2xl shadow-edrops-aqua/30">
      <div className="absolute inset-2 animate-ping rounded-full bg-white/40" />
    </div>
  </div>
);

export default function PackageCatalog() {
  const [packages, setPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [formOpen, setFormOpen] = useState(false);
  const [isEditingId, setIsEditingId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [jarCount, setJarCount] = useState(10);
  const [price, setPrice] = useState(800);
  const [originalPrice, setOriginalPrice] = useState(1000);
  const [discountPercent, setDiscountPercent] = useState(20);
  const [offerLabel, setOfferLabel] = useState('');
  const [packageColor, setPackageColor] = useState('blue');
  const [packageBadge, setPackageBadge] = useState('');
  const [displayOrder, setDisplayOrder] = useState(1);
  const [isActive, setIsActive] = useState(true);

  const loadPackages = async () => {
    try {
      setLoading(true);
      const data = await fetchWithAuth('/recharge/packages/all');
      setPackages(data || []);
    } catch (err) {
      toast.error('Failed to load packages');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPackages();
  }, []);

  const handlePriceChange = (val: number) => {
    setPrice(val);
    if (originalPrice > 0) {
      const pct = Math.round(((originalPrice - val) / originalPrice) * 100);
      setDiscountPercent(pct);
    }
  };

  const handleOriginalPriceChange = (val: number) => {
    setOriginalPrice(val);
    if (val > 0) {
      const pct = Math.round(((val - price) / val) * 100);
      setDiscountPercent(pct);
    }
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setJarCount(10);
    setPrice(800);
    setOriginalPrice(1000);
    setDiscountPercent(20);
    setOfferLabel('Save 20%');
    setPackageColor('blue');
    setPackageBadge('');
    setDisplayOrder(1);
    setIsActive(true);
    setIsEditingId(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || jarCount <= 0 || price <= 0) {
      toast.error('Please input valid package values.');
      return;
    }

    const payload = {
      name,
      description,
      jarCount,
      price,
      originalPrice,
      discountPercent,
      offerLabel,
      packageColor,
      packageBadge,
      displayOrder,
      isActive
    };

    try {
      if (isEditingId) {
        await fetchWithAuth(`/recharge/package/${isEditingId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload)
        });
        toast.success('Prepaid package modified successfully!');
      } else {
        await fetchWithAuth('/recharge/package', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        toast.success('Prepaid package added successfully!');
      }
      setFormOpen(false);
      resetForm();
      loadPackages();
    } catch (err: any) {
      toast.error(err.message || 'Action failed');
    }
  };

  const handleEdit = (pkg: any) => {
    setIsEditingId(pkg.id);
    setName(pkg.name);
    setDescription(pkg.description || '');
    setJarCount(pkg.jarCount);
    setPrice(pkg.price);
    setOriginalPrice(pkg.originalPrice || pkg.price);
    setDiscountPercent(pkg.discountPercent || 0);
    setOfferLabel(pkg.offerLabel || '');
    setPackageColor(pkg.packageColor || 'blue');
    setPackageBadge(pkg.packageBadge || '');
    setDisplayOrder(pkg.displayOrder || 1);
    setIsActive(pkg.isActive);
    setFormOpen(true);
  };

  const handleDuplicate = (pkg: any) => {
    setName(`${pkg.name} Copy`);
    setDescription(pkg.description || '');
    setJarCount(pkg.jarCount);
    setPrice(pkg.price);
    setOriginalPrice(pkg.originalPrice || pkg.price);
    setDiscountPercent(pkg.discountPercent || 0);
    setOfferLabel(pkg.offerLabel || '');
    setPackageColor(pkg.packageColor || 'blue');
    setPackageBadge(pkg.packageBadge || '');
    setDisplayOrder((pkg.displayOrder || 1) + 1);
    setIsActive(pkg.isActive);
    setIsEditingId(null);
    setFormOpen(true);
  };

  const handleDelete = async (pkgId: string) => {
    if (!confirm('Are you sure you want to delete this package?')) return;
    try {
      await fetchWithAuth(`/recharge/package/${pkgId}`, { method: 'DELETE' });
      toast.success('Prepaid package deleted.');
      loadPackages();
    } catch (err: any) {
      toast.error(err.message || 'Delete failed.');
    }
  };

  if (loading) return <AdminLoader />;

  return (
    <main className="space-y-6">
      <section className="clay-card p-6 sm:p-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-background px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-[#10B981]">
            <Layers className="h-4 w-4" /> Package Management
          </span>
          <h1 className="mt-5 text-4xl font-black sm:text-5xl text-[#245361]">Prepaid Catalog Catalog</h1>
          <p className="mt-2 text-muted-foreground text-sm">Add, clone, edit, or delete prepaid jar water package bundles.</p>
        </div>
        <button
          onClick={() => { resetForm(); setFormOpen(true); }}
          className="clay-btn bg-emerald-600 text-white hover:bg-emerald-700 font-black text-sm uppercase px-5 py-3.5 flex items-center gap-2 cursor-pointer self-start sm:self-center"
        >
          <Plus className="h-4.5 w-4.5" /> Create Package
        </button>
      </section>

      {/* Package grid */}
      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {packages.map((pkg) => (
          <article key={pkg.id} className={`clay-card p-6 flex flex-col justify-between space-y-6 border-l-4 ${
            pkg.packageColor === 'emerald' ? 'border-l-emerald-500' :
            pkg.packageColor === 'amber' ? 'border-l-amber-500' :
            pkg.packageColor === 'indigo' ? 'border-l-indigo-500' :
            'border-l-blue-500'
          }`}>
            <div>
              <div className="flex items-center justify-between">
                <span className="px-3.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700">
                  {pkg.jarCount} Jars
                </span>
                <div className="flex gap-2.5">
                  <button onClick={() => handleEdit(pkg)} className="text-primary hover:underline font-bold text-xs">Edit</button>
                  <button onClick={() => handleDuplicate(pkg)} className="text-amber-600 hover:underline font-bold text-xs flex items-center gap-0.5"><Copy className="h-3 w-3" /> Clone</button>
                  <button onClick={() => handleDelete(pkg.id)} className="text-red-500 hover:text-red-700"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>

              {pkg.packageBadge && (
                <span className="inline-block mt-3 px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-[9px] font-black uppercase tracking-widest">
                  {pkg.packageBadge}
                </span>
              )}

              <h2 className="text-2xl font-black text-[#245361] mt-4">{pkg.name}</h2>
              <p className="text-sm font-semibold text-slate-600 mt-2">{pkg.description || 'No description.'}</p>
              
              {pkg.offerLabel && (
                <p className="text-xs font-black text-emerald-600 mt-3">{pkg.offerLabel}</p>
              )}
            </div>

            <div className="border-t border-border/40 pt-4 flex justify-between items-baseline font-semibold">
              <div>
                {pkg.originalPrice && pkg.originalPrice > pkg.price && (
                  <p className="text-xs text-slate-400 line-through">₹{pkg.originalPrice}</p>
                )}
                <p className="text-xs text-slate-500 uppercase tracking-widest">Pricing</p>
              </div>
              <span className="text-3xl font-black text-[#245361]">₹{pkg.price}</span>
            </div>
          </article>
        ))}
      </section>

      {/* Package Form Modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-border space-y-6 font-semibold"
          >
            <div>
              <h3 className="text-2xl font-black text-[#245361]">
                {isEditingId ? 'Edit Package Specs' : 'Create Prepaid Package'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">Configure name, jar counts, and coupon marketing options.</p>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase text-slate-700 mb-1">Package Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Festival 50 Pack"
                    className="w-full clay-input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase text-slate-700 mb-1">Jars Quantity</label>
                  <input
                    type="number"
                    value={jarCount}
                    onChange={(e) => setJarCount(parseInt(e.target.value) || 0)}
                    className="w-full clay-input"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-slate-700 mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe savings or duration limits..."
                  className="w-full clay-input min-h-[60px] resize-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase text-slate-700 mb-1">Original Price (₹)</label>
                  <input
                    type="number"
                    value={originalPrice}
                    onChange={(e) => handleOriginalPriceChange(parseInt(e.target.value) || 0)}
                    className="w-full clay-input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase text-slate-700 mb-1">Selling Price (₹)</label>
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => handlePriceChange(parseInt(e.target.value) || 0)}
                    className="w-full clay-input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase text-slate-700 mb-1">Discount %</label>
                  <input
                    type="number"
                    readOnly
                    value={discountPercent}
                    className="w-full clay-input bg-slate-100 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase text-slate-700 mb-1">Badge Text</label>
                  <input
                    type="text"
                    value={packageBadge}
                    onChange={(e) => setPackageBadge(e.target.value)}
                    placeholder="e.g. Festival Special"
                    className="w-full clay-input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase text-slate-700 mb-1">Offer Label</label>
                  <input
                    type="text"
                    value={offerLabel}
                    onChange={(e) => setOfferLabel(e.target.value)}
                    placeholder="e.g. Save ₹250"
                    className="w-full clay-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase text-slate-700 mb-1">Theme Color</label>
                  <select
                    value={packageColor}
                    onChange={(e) => setPackageColor(e.target.value)}
                    className="w-full clay-input"
                  >
                    <option value="blue">Blue</option>
                    <option value="emerald">Emerald</option>
                    <option value="amber">Amber</option>
                    <option value="indigo">Indigo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black uppercase text-slate-700 mb-1">Display Order</label>
                  <input
                    type="number"
                    value={displayOrder}
                    onChange={(e) => setDisplayOrder(parseInt(e.target.value) || 1)}
                    className="w-full clay-input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase text-slate-700 mb-1">Active Status</label>
                  <button
                    type="button"
                    onClick={() => setIsActive(!isActive)}
                    className={`w-full py-2.5 rounded-xl border font-bold text-xs uppercase tracking-wider text-center ${isActive ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}
                  >
                    {isActive ? 'Active' : 'Disabled'}
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="px-5 py-2.5 rounded-full text-xs font-black uppercase bg-secondary/15 text-[#2D79A8] transition hover:bg-secondary/35 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-full text-xs font-black uppercase bg-primary text-white shadow-md hover:bg-primary/80 transition cursor-pointer"
                >
                  Save Package
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </main>
  );
}
