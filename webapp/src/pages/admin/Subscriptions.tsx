import { useEffect } from "react"
import { Calendar, Search, Filter, RefreshCcw, AlertCircle, Clock, CheckCircle2, PauseCircle } from "lucide-react"
import { ClayCard, ClayButton, ClayInput } from "../../components/ui/ClayComponents"
import { useDashboardSubscriptions } from "../../lib/api"
import { format } from "date-fns"

export default function Subscriptions() {
  const { data: subs, loading, error, refetch } = useDashboardSubscriptions();

  useEffect(() => {
    refetch();
  }, []);

  if (loading) return <div className="p-8 text-center opacity-50 font-bold animate-pulse">Loading subscription master...</div>;
  if (error) return <div className="p-8 text-rose-500 bg-rose-50 rounded-3xl flex items-center gap-3 font-bold"><AlertCircle /> {error}</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-4xl font-extrabold tracking-tight">Subscription Engine</h1>
          <p className="text-slate-500 dark:text-slate-400">Monitor and manage all active, paused, and pending recurring plans.</p>
        </div>
        <ClayButton variant="ghost" onClick={() => refetch()} className="gap-2 bg-white/50 text-slate-600 font-bold">
          <RefreshCcw size={18} /> Refresh
        </ClayButton>
      </div>

      <ClayCard className="border-none p-6">
        <div className="flex flex-col md:flex-row gap-4 mb-6 border-b border-slate-100 dark:border-slate-800 pb-6">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <ClayInput placeholder="Search by customer or plan ID..." className="pl-12 w-full" />
          </div>
          <ClayButton variant="secondary" className="gap-2 font-bold px-8">
            <Filter size={18} /> Status Filter
          </ClayButton>
        </div>

        <div className="space-y-4">
          {!subs || subs.length === 0 ? (
            <div className="p-12 text-center text-slate-400 font-medium italic bg-slate-50 rounded-3xl">No subscriptions found.</div>
          ) : (
            subs.map((s: any) => (
              <div key={s.id} className="flex flex-col md:flex-row md:items-center justify-between p-5 bg-slate-50/50 dark:bg-slate-900/50 rounded-4xl hover:shadow-md transition-all border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-4 mb-4 md:mb-0">
                  <div className={`h-12 w-12 rounded-2xl flex shrink-0 items-center justify-center ${
                    s.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-600' : 
                    s.status === 'PAUSED' ? 'bg-amber-100 text-amber-600' : 'bg-slate-200 text-slate-500'
                  }`}>
                    {s.status === 'ACTIVE' ? <CheckCircle2 size={24} /> : 
                     s.status === 'PAUSED' ? <PauseCircle size={24} /> : <Clock size={24} />}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white leading-tight">{s.user?.name}</h3>
                    <p className="text-xs text-slate-500 font-medium flex items-center gap-1 mt-1">
                       <Calendar size={12} /> {s.frequency} • {s.quantity} Jars
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between md:gap-14 pl-16 md:pl-0">
                  <div className="text-left md:text-center">
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">Next Delivery</p>
                    <p className="text-sm font-bold">
                        {s.nextDeliveryDate ? format(new Date(s.nextDeliveryDate), 'MMM dd, yyyy') : 'N/A'}
                    </p>
                    <p className="text-xs text-slate-500">{s.deliverySlot}</p>
                  </div>
                  
                  <div className="text-left md:text-center">
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">Period</p>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                        {format(new Date(s.startDate), 'MMM dd')} – {format(new Date(s.endDate), 'MMM dd')}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-lg font-extrabold text-blue-600">SUB-{s.id.slice(-6).toUpperCase()}</p>
                    <span className={`inline-block mt-1 px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      s.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-600' : 
                      s.status === 'PAUSED' ? 'bg-amber-100 text-amber-600' : 'bg-slate-200 text-slate-500'
                    }`}>
                      {s.status}
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
