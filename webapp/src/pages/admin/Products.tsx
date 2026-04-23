import { useEffect } from "react"
import { Package, Plus, Search, Filter, Edit2, Trash2, AlertCircle } from "lucide-react"
import { ClayCard, ClayButton, ClayInput } from "../../components/ui/ClayComponents"
import { useDashboardProducts } from "../../lib/api"

export default function Products() {
  const { data: products, loading, error, refetch } = useDashboardProducts();

  useEffect(() => {
    refetch();
  }, []);

  if (loading) return <div className="p-8 text-center opacity-50 font-bold animate-pulse">Loading product master...</div>;
  if (error) return <div className="p-8 text-rose-500 bg-rose-50 rounded-3xl flex items-center gap-3 font-bold"><AlertCircle /> {error}</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-4xl font-extrabold tracking-tight">Product Master</h1>
          <p className="text-slate-500 dark:text-slate-400">Manage your SKUs, pricing boundaries, and categorizations.</p>
        </div>
        <ClayButton className="gap-2">
          <Plus size={18} />
          New Product
        </ClayButton>
      </div>

      <ClayCard className="border-none p-6">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <ClayInput placeholder="Search SKUs..." className="pl-12" />
          </div>
          <ClayButton variant="ghost" onClick={() => refetch()} className="gap-2 bg-slate-50 font-bold">
            <Filter size={18} /> Refresh
          </ClayButton>
        </div>

        <div className="overflow-x-auto">
          {!products || products.length === 0 ? (
            <div className="p-12 text-center text-slate-400 font-medium italic bg-slate-50 rounded-3xl">No products registered.</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  <th className="pb-4 pt-2 text-xs font-extrabold uppercase tracking-widest text-slate-400">Product</th>
                  <th className="pb-4 pt-2 text-xs font-extrabold uppercase tracking-widest text-slate-400">Category</th>
                  <th className="pb-4 pt-2 text-xs font-extrabold uppercase tracking-widest text-slate-400">Price</th>
                  <th className="pb-4 pt-2 text-xs font-extrabold uppercase tracking-widest text-slate-400 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {products.map((p: any) => (
                  <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors group">
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-primary/10 rounded-xl flex shrink-0 items-center justify-center text-primary overflow-hidden">
                          {p.imageUrl ? <img src={p.imageUrl} className="h-full w-full object-cover" alt="" /> : <Package size={18} />}
                        </div>
                        <div>
                          <p className="font-bold text-sm text-slate-900 dark:text-white">{p.name}</p>
                          <p className="text-xs text-slate-500 font-medium capitalize">{p.brand}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 text-sm font-semibold text-slate-600 dark:text-slate-300">{p.isJar ? 'Jar' : 'Bottle'}</td>
                    <td className="py-4 text-sm font-extrabold">₹ {Number(p.price).toLocaleString()}</td>
                    <td className="py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <ClayButton variant="ghost" className="h-8 w-8 p-0!"><Edit2 size={14} className="text-blue-500" /></ClayButton>
                        <ClayButton variant="ghost" className="h-8 w-8 p-0!"><Trash2 size={14} className="text-rose-500" /></ClayButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </ClayCard>
    </div>
  )
}
