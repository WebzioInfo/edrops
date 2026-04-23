import { 
  Warehouse, 
  Package, 
  ArrowLeftRight, 
  MapPin, 
  Plus,
  RefreshCw,
  AlertTriangle
} from "lucide-react"
import { ClayCard, ClayButton } from "../../components/ui/ClayComponents"

const InventoryCard = ({ name, total, reserved, avail, status }: {
  name: string, total: number, reserved: number, avail: number, status: string
}) => (
  <div className="p-5 bg-white/40 dark:bg-slate-900/40 rounded-3xl border border-slate-100 dark:border-slate-800 backdrop-blur-sm shadow-sm hover:shadow-md transition-all">
    <div className="flex justify-between items-start mb-4">
      <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
        <Package size={20} />
      </div>
      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
        status === 'LOW' ? "bg-rose-100 text-rose-600" : "bg-emerald-100 text-emerald-600"
      }`}>
        {status} STOCK
      </span>
    </div>
    <h3 className="font-bold text-lg mb-1">{name}</h3>
    <div className="grid grid-cols-3 gap-2 mt-4 text-center">
      <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
        <p className="text-[10px] text-slate-500 uppercase font-bold">Total</p>
        <p className="font-extrabold">{total}</p>
      </div>
      <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
        <p className="text-[10px] text-slate-500 uppercase font-bold">Resrv</p>
        <p className="font-extrabold">{reserved}</p>
      </div>
      <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600">
        <p className="text-[10px] uppercase font-bold opacity-70">Avail</p>
        <p className="font-extrabold">{avail}</p>
      </div>
    </div>
  </div>
)

export default function Godown() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-4xl font-extrabold tracking-tight">Godown Management</h1>
          <p className="text-slate-500 dark:text-slate-400">Monitor stock levels, batch procurements, and jar lifecycles.</p>
        </div>
        <div className="flex gap-3">
          <ClayButton variant="ghost" className="gap-2 text-primary font-bold bg-white/50">
             <ArrowLeftRight size={18} />
             Transfer Stock
          </ClayButton>
          <ClayButton className="gap-2">
            <Plus size={18} />
            New Godown
          </ClayButton>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <ClayCard className="col-span-1 p-6 border-none">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
            <Warehouse size={24} />
          </div>
          <h2 className="font-bold text-xl mb-1">Ernakulam Main</h2>
          <p className="text-sm text-muted-foreground flex items-center gap-1 mb-6"><MapPin size={14} /> Cochin North, Bypass Rd</p>
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
              <div className="flex justify-between items-center mb-1">
                 <span className="text-sm font-medium text-slate-500">Occupancy</span>
                 <span className="text-sm font-bold">78%</span>
              </div>
              <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600 rounded-full" style={{ width: '78%' }} />
              </div>
            </div>
            <ClayButton variant="secondary" className="w-full text-blue-600 font-bold">Manage Inventory</ClayButton>
          </div>
        </ClayCard>

        {/* Real-time stock summary Grid */}
        <div className="col-span-2 grid gap-6 md:grid-cols-2">
           <InventoryCard name="20L Premium Jar" total={1450} reserved={120} avail={1330} status="GOOD" />
           <InventoryCard name="1L Bottle Case" total={85} reserved={40} avail={45} status="LOW" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <ClayCard className="lg:col-span-2 border-none p-6">
          <div className="flex justify-between items-center mb-6">
             <h2 className="font-bold text-xl">Batch Procurement History</h2>
             <ClayButton variant="ghost" className="text-primary font-bold gap-1 text-sm px-4">
               <RefreshCw size={14} /> Sync
             </ClayButton>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  <th className="pb-3 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Batch ID</th>
                  <th className="pb-3 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Source</th>
                  <th className="pb-3 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Qty</th>
                  <th className="pb-3 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Date</th>
                  <th className="pb-3 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {[
                  { id: "BTCH-001", src: "Bisleri Plant", qty: 500, date: "22 May, 2024", status: "Received" },
                  { id: "BTCH-002", src: "Aquafina Warehouse", qty: 200, date: "24 May, 2024", status: "In Transit" },
                  { id: "BTCH-003", src: "Local Jar Mfg", qty: 1000, date: "25 May, 2024", status: "Verified" },
                ].map((batch) => (
                  <tr key={batch.id} className="group hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                    <td className="py-4 font-bold text-sm">{batch.id}</td>
                    <td className="py-4 text-sm text-slate-600 dark:text-slate-400 font-medium">{batch.src}</td>
                    <td className="py-4 text-sm font-bold">{batch.qty}</td>
                    <td className="py-4 text-xs text-slate-500">{batch.date}</td>
                    <td className="py-4">
                      <span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${
                        batch.status === 'Received' ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"
                      }`}>
                        {batch.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ClayCard>

        <ClayCard className="border-none bg-rose-50/50 dark:bg-rose-900/10 p-6">
           <div className="flex items-center gap-2 text-rose-600 mb-2">
              <AlertTriangle size={20} />
              <h2 className="font-bold text-lg">Critical Alerts</h2>
           </div>
           <p className="text-sm text-muted-foreground mb-6">Actions required immediately for warehouse operations.</p>
           <div className="space-y-4">
             {[
               { title: "Low Stock: 1L Bottles", desc: "Available stock below threshold (45 cases). Purchase order recommended." },
               { title: "Damaged Jars Detected", desc: "14 jars reported as damaged by Vinod (Route 22). Move to Sanitization." },
             ].map((alert, i) => (
               <div key={i} className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-rose-100 dark:border-rose-900/30">
                  <p className="font-bold text-sm text-rose-600">{alert.title}</p>
                  <p className="text-xs text-slate-500 mt-1">{alert.desc}</p>
               </div>
             ))}
             <ClayButton variant="ghost" className="w-full text-rose-600 hover:bg-rose-50 border border-rose-200">View All Alerts</ClayButton>
           </div>
        </ClayCard>
      </div>
    </div>
  )
}
