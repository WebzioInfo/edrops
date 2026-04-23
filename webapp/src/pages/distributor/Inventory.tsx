import { ArchiveRestore, Plus, Box, ExternalLink } from "lucide-react"
import { ClayCard, ClayButton, ClayInput } from "../../components/ui/ClayComponents"

export default function Inventory() {
  const reqs = [
    { id: "REQ-01", date: "Today, 10:00 AM", items: "20L Jars (x500)", status: "Approved", eta: "Tommorow 12PM" },
    { id: "REQ-02", date: "Yesterday", items: "1L Cases (x100)", status: "Delivered", eta: "-" },
    { id: "REQ-03", date: "2 May, 2024", items: "Jar Dispensers (x10)", status: "Pending", eta: "TBD" },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-4xl font-extrabold tracking-tight">Stock Requisitions</h1>
          <p className="text-slate-500 dark:text-slate-400">Request load transfers from Regional Godowns to your Warehouse.</p>
        </div>
        <ClayButton className="gap-2 px-6">
          <Plus size={18} /> New Request
        </ClayButton>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
         <ClayCard className="border-none flex flex-col items-center justify-center text-center p-8 space-y-4">
            <div className="p-4 bg-emerald-100 text-emerald-600 rounded-3xl">
               <Box size={40} />
            </div>
            <div>
               <p className="text-sm font-bold uppercase tracking-widest text-slate-400">Your Current Stock</p>
               <h2 className="text-5xl font-black text-slate-800 dark:text-white my-2">124</h2>
               <p className="text-xs font-bold text-slate-500">Healthy levels (12% drop expected today)</p>
            </div>
            <ClayButton variant="ghost" className="w-full mt-4 text-emerald-600 border border-emerald-200">Reconcile Stock</ClayButton>
         </ClayCard>

         <ClayCard className="lg:col-span-2 border-none p-6">
           <div className="flex items-center justify-between mb-6">
             <h2 className="font-bold text-xl flex items-center gap-2"><ArchiveRestore size={20} className="text-primary"/> Recent Requests</h2>
             <ClayInput placeholder="Search requests..." className="w-64" />
           </div>

           <div className="space-y-4">
             {reqs.map((r) => (
                <div key={r.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100">
                   <div className="mb-4 sm:mb-0">
                      <p className="font-bold text-lg">{r.items}</p>
                      <p className="text-xs text-slate-500 flex items-center gap-2 mt-1">
                         <span className="font-extrabold">{r.id}</span> • {r.date}
                      </p>
                   </div>
                   <div className="flex items-center gap-8">
                      <div className="text-right">
                         <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">Status & ETA</p>
                         <p className={`text-sm font-bold ${
                           r.status === 'Approved' ? 'text-blue-600' :
                           r.status === 'Delivered' ? 'text-emerald-600' : 'text-amber-600'
                         }`}>{r.status}</p>
                         <p className="text-xs text-slate-500">{r.eta}</p>
                      </div>
                      <ClayButton variant="ghost" className="p-2! text-slate-400 bg-white shadow-sm border border-slate-100 shrink-0 rounded-xl hover:text-primary">
                        <ExternalLink size={18} />
                      </ClayButton>
                   </div>
                </div>
             ))}
           </div>
         </ClayCard>
      </div>

    </div>
  )
}
