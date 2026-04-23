import { useEffect } from "react"
import { ShoppingCart, Search, Filter, Calendar, MapPin, AlertCircle } from "lucide-react"
import { ClayCard, ClayButton, ClayInput } from "../../components/ui/ClayComponents"
import { useDashboardOrders } from "../../lib/api"
import { formatDistanceToNow } from "date-fns"

export default function Orders() {
  const { data: ords, loading, error, refetch } = useDashboardOrders();

  useEffect(() => {
    refetch();
  }, []);

  if (loading) return <div className="p-8 text-center opacity-50 font-bold animate-pulse">Fetching orders...</div>;
  if (error) return <div className="p-8 text-rose-500 bg-rose-50 rounded-3xl flex items-center gap-3 font-bold"><AlertCircle /> {error}</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-4xl font-extrabold tracking-tight">Order Manifest</h1>
          <p className="text-slate-500 dark:text-slate-400">Global ledger of all system transactions and dispatches.</p>
        </div>
        <div className="flex gap-3">
          <ClayButton variant="ghost" onClick={() => refetch()} className="gap-2 bg-white/50 text-slate-600 font-bold">
            <Calendar size={18} /> Refresh
          </ClayButton>
        </div>
      </div>

      <ClayCard className="border-none p-6">
        <div className="flex flex-col md:flex-row gap-4 mb-6 border-b border-slate-100 dark:border-slate-800 pb-6">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <ClayInput placeholder="Search order ID, customer, or route..." className="pl-12 w-full" />
          </div>
          <ClayButton variant="secondary" className="gap-2 font-bold px-8">
            <Filter size={18} /> Filter Status
          </ClayButton>
        </div>

        <div className="space-y-4">
          {!ords || ords.length === 0 ? (
            <div className="p-12 text-center text-slate-400 font-medium italic bg-slate-50 rounded-3xl">No orders found in the system.</div>
          ) : (
            ords.map((o: any) => (
              <div key={o.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-slate-50/50 dark:bg-slate-900/50 rounded-4xl hover:shadow-md transition-shadow border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-4 mb-4 md:mb-0">
                  <div className={`h-12 w-12 rounded-2xl flex shrink-0 items-center justify-center ${
                    o.status === 'DELIVERED' ? 'bg-emerald-100 text-emerald-600' : 
                    o.status === 'OUT_FOR_DELIVERY' ? 'bg-blue-100 text-blue-600' : 'bg-amber-100 text-amber-600'
                  }`}>
                    <ShoppingCart size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white leading-tight">{o.user?.name || 'Unknown User'}</h3>
                    <p className="text-xs text-slate-500 font-medium flex items-center gap-1 mt-1">
                      <MapPin size={12} /> {o.address?.line1}, {o.address?.city}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between md:gap-12 pl-16 md:pl-0">
                  <div className="text-left md:text-center">
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">ID & Time</p>
                    <p className="text-sm font-bold">ORD-{o.id.slice(-6).toUpperCase()}</p>
                    <p className="text-xs text-slate-500">{formatDistanceToNow(new Date(o.createdAt))} ago</p>
                  </div>
                  
                  <div className="text-left md:text-center">
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">Items</p>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                      {o.items?.length} sku(s)
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-xl font-extrabold text-blue-600">₹ {Number(o.payableAmount).toLocaleString()}</p>
                    <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      o.status === 'DELIVERED' ? 'bg-emerald-100 text-emerald-600' : 
                      o.status === 'OUT_FOR_DELIVERY' ? 'bg-blue-100 text-blue-600' : 'bg-amber-100 text-amber-600'
                    }`}>
                      {o.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </ClayCard>
    </div>
  )
}
