import { useEffect } from "react"
import { Users, Search, MoreHorizontal, Target, Wallet, AlertCircle } from "lucide-react"
import { ClayCard, ClayButton, ClayInput } from "../../components/ui/ClayComponents"
import { useDashboardUsers, useDashboardStats } from "../../lib/api"
import { formatDistanceToNow } from "date-fns"

export default function Customers() {
  const { data: customers, loading, error, refetch } = useDashboardUsers();
  const { data: stats } = useDashboardStats();

  useEffect(() => {
    refetch();
  }, []);

  if (loading) return <div className="p-8 text-center opacity-50 font-bold animate-pulse">Loading customer data...</div>;
  if (error) return <div className="p-8 text-rose-500 bg-rose-50 rounded-3xl flex items-center gap-3 font-bold"><AlertCircle /> {error}</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1">
        <h1 className="text-4xl font-extrabold tracking-tight">Customer Intelligence</h1>
        <p className="text-slate-500 dark:text-slate-400">Track subscribers, tier types, and wallet balances across regions.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
         <ClayCard className="border-none flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
               <Users size={24} />
            </div>
            <div>
               <p className="text-xs uppercase font-extrabold tracking-widest text-slate-400 mb-1">Total Base</p>
               <p className="text-3xl font-black">{stats?.totalCustomers || 0}</p>
            </div>
         </ClayCard>
         <ClayCard className="border-none flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
               <Target size={24} />
            </div>
            <div>
               <p className="text-xs uppercase font-extrabold tracking-widest text-slate-400 mb-1">Active Subs</p>
               <p className="text-3xl font-black">{stats?.activeSubscriptions || 0}</p>
            </div>
         </ClayCard>
         <ClayCard className="border-none flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
               <Wallet size={24} />
            </div>
            <div>
               <p className="text-xs uppercase font-extrabold tracking-widest text-slate-400 mb-1">System Wallet</p>
               <p className="text-3xl font-black">₹ {Math.round(stats?.totalRevenue / 1000) || 0}K</p>
            </div>
         </ClayCard>
      </div>

      <ClayCard className="border-none p-6">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <ClayInput placeholder="Search customers by name, ID or area..." className="pl-12" />
          </div>
          <ClayButton variant="ghost" onClick={() => refetch()} className="gap-2 bg-slate-50 font-bold">
            Refresh List
          </ClayButton>
        </div>

        <div className="overflow-x-auto">
          {!customers || customers.length === 0 ? (
            <div className="p-12 text-center text-slate-400 font-medium italic bg-slate-50 rounded-3xl">No customers registered yet.</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  <th className="pb-4 pt-2 text-xs font-extrabold uppercase tracking-widest text-slate-400">Customer</th>
                  <th className="pb-4 pt-2 text-xs font-extrabold uppercase tracking-widest text-slate-400">Contact</th>
                  <th className="pb-4 pt-2 text-xs font-extrabold uppercase tracking-widest text-slate-400">Wallet</th>
                  <th className="pb-4 pt-2 text-xs font-extrabold uppercase tracking-widest text-slate-400">Jars Held</th>
                  <th className="pb-4 pt-2 text-xs font-extrabold uppercase tracking-widest text-slate-400">Joined</th>
                  <th className="pb-4 pt-2 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {customers.map((c: any) => (
                  <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                    <td className="py-4">
                      <p className="font-bold text-sm text-slate-900 dark:text-white">{c.name}</p>
                      <p className="text-xs text-slate-500 font-medium">UID-{c.id.slice(-6).toUpperCase()}</p>
                    </td>
                    <td className="py-4 text-sm font-semibold text-slate-600 dark:text-slate-300">
                      {c.phone}
                    </td>
                    <td className="py-4 text-sm font-extrabold text-blue-600">
                      ₹ {Number(c.wallet?.balance || 0).toLocaleString()}
                    </td>
                    <td className="py-4 text-sm font-bold text-slate-700 dark:text-slate-300">
                      {c.jarsHeld || 0} Jars
                    </td>
                    <td className="py-4 text-sm font-medium text-slate-500">
                      {formatDistanceToNow(new Date(c.createdAt))} ago
                    </td>
                    <td className="py-4 text-right">
                      <ClayButton variant="ghost" className="h-8 w-8 p-0! text-slate-400"><MoreHorizontal size={18} /></ClayButton>
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
