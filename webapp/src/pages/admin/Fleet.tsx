import { 
  Navigation, 
  Activity, 
  Clock,
  ChevronRight,
  Search,
  Fuel
} from "lucide-react"
import { ClayButton, ClayInput } from "../../components/ui/ClayComponents"

const DriverStatusCard = ({ name, status, load, speed, lastSeen }: {
  name: string, status: 'Active' | 'Idle' | 'Offline', load: string, speed: string, lastSeen: string
}) => (
  <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 hover:shadow-lg transition-all group cursor-pointer">
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 relative">
           <div className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white dark:border-slate-900 ${
             status === 'Active' ? "bg-emerald-500" : status === 'Idle' ? "bg-amber-500" : "bg-slate-400"
           }`} />
        </div>
        <div>
          <p className="font-bold text-sm tracking-tight">{name}</p>
          <p className="text-[10px] uppercase font-bold text-slate-400">{status}</p>
        </div>
      </div>
      <ChevronRight size={16} className="text-slate-300 group-hover:translate-x-1 transition-transform" />
    </div>
    
    <div className="grid grid-cols-2 gap-2 mb-4">
      <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-center">
         <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Load</p>
         <p className="text-xs font-bold">{load}</p>
      </div>
      <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-center">
         <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Speed</p>
         <p className="text-xs font-bold">{speed}</p>
      </div>
    </div>
    
    <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-widest">
      <div className="flex items-center gap-1"><Clock size={10} /> {lastSeen}</div>
      <div className="text-blue-500 hover:underline">Track Live</div>
    </div>
  </div>
)

export default function Fleet() {
  return (
    <div className="h-[calc(100vh-140px)] flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-500">
      <div className="flex items-center justify-between shrink-0">
        <div className="flex flex-col gap-1">
          <h1 className="text-4xl font-extrabold tracking-tight italic">Fleet Telemetry</h1>
          <p className="text-slate-500 dark:text-slate-400">Live monitoring of your delivery network across Kerala.</p>
        </div>
        <div className="flex gap-3 bg-white p-1 rounded-4xl border border-slate-200 shadow-sm">
           <ClayButton variant="ghost" className="bg-slate-100 font-bold">Live Map</ClayButton>
           <ClayButton variant="ghost" className="text-slate-500">Analytics</ClayButton>
        </div>
      </div>

      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Sidebar: Driver List */}
        <div className="w-80 flex flex-col gap-6 overflow-y-auto pr-2 no-scrollbar">
           <div className="relative">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
             <ClayInput
               type="text" 
               placeholder="Search partner..." 
               className="pl-12"
             />
           </div>
           
           <div className="space-y-4">
             <DriverStatusCard name="Suresh Babu" status="Active" load="12 Jars" speed="42 km/h" lastSeen="1m ago" />
             <DriverStatusCard name="Vinod Kumar" status="Idle" load="0 Jars" speed="0 km/h" lastSeen="15m ago" />
             <DriverStatusCard name="Ashraf Ali" status="Active" load="24 Cases" speed="38 km/h" lastSeen="Just now" />
             <DriverStatusCard name="Arun Das" status="Offline" load="0 Jars" speed="-" lastSeen="2h ago" />
           </div>
        </div>

        {/* Map View Area */}
        <div className="flex-1 relative rounded-[40px] overflow-hidden border-4 border-white shadow-2xl bg-slate-200 dark:bg-slate-900 dark:border-slate-800">
           {/* Mock Map Background */}
           <div className="absolute inset-0 bg-[url('https://api.mapbox.com/styles/v1/mapbox/light-v10/static/76.2711,9.9312,11,0/1200x800?access_token=pk.mock')] bg-cover opacity-50 contrast-125" />
           
           {/* Animated Pulses for Drivers */}
           <div className="absolute top-[40%] left-[30%]">
              <div className="h-4 w-4 bg-primary rounded-full animate-ping absolute" />
              <div className="h-4 w-4 bg-primary rounded-full relative border-2 border-white shadow-lg" />
              <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-white px-3 py-1 rounded-xl shadow-xl whitespace-nowrap">
                 <p className="text-[10px] font-extrabold uppercase">Suresh B. (Cochin)</p>
              </div>
           </div>

           <div className="absolute bottom-[20%] right-[40%]">
              <div className="h-4 w-4 bg-emerald-500 rounded-full animate-ping absolute" />
              <div className="h-4 w-4 bg-emerald-500 rounded-full relative border-2 border-white shadow-lg" />
              <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-white px-3 py-1 rounded-xl shadow-xl whitespace-nowrap">
                 <p className="text-[10px] font-extrabold uppercase">Ashraf (Kaloor)</p>
              </div>
           </div>

            <div className="absolute top-8 right-8 flex flex-col gap-3">
              <ClayButton variant="secondary" className="px-4 text-slate-900 bg-white"><Navigation size={20} /></ClayButton>
              <ClayButton variant="secondary" className="px-4 text-slate-900 bg-white"><Activity size={20} /></ClayButton>
              <ClayButton variant="secondary" className="px-4 text-slate-900 bg-white"><Fuel size={20} /></ClayButton>
            </div>
           
           {/* Route Highlight Mock */}
           <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-30">
              <path d="M 400 300 Q 500 400 600 500" stroke="#3b82f6" strokeWidth="8" fill="none" strokeDasharray="12 12" />
           </svg>
        </div>
      </div>
    </div>
  )
}
