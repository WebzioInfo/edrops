import { Map, Navigation, Edit3, Trash2, Plus } from "lucide-react"
import { ClayCard, ClayButton, ClayInput } from "../../components/ui/ClayComponents"

export default function Routes() {
  const routes = [
    { id: "RT-01", name: "Cochin East", areas: "Kakkanad, Edappally", drivers: 2, volume: "1,200 Jars/mo" },
    { id: "RT-02", name: "Vytilla Bypass", areas: "Vytilla, Palarivattom", drivers: 1, volume: "850 Jars/mo" },
    { id: "RT-03", name: "Marine Drive Area", areas: "High Court, Marine Drive", drivers: 3, volume: "2,400 Jars/mo" },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-4xl font-extrabold tracking-tight">Route Optimization</h1>
          <p className="text-slate-500 dark:text-slate-400">Map operational territories and assign delivery zones.</p>
        </div>
        <ClayButton className="gap-2 px-6">
          <Plus size={18} /> Add Territory
        </ClayButton>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <ClayInput placeholder="Search routes..." className="mb-2" />
          
          <div className="flex flex-col gap-4">
            {routes.map((rt) => (
              <div key={rt.id} className="p-4 bg-slate-50/50 dark:bg-slate-900/50 rounded-3xl border border-slate-100 hover:border-blue-500 transition-colors cursor-pointer group">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-lg text-blue-600 flex items-center gap-2"><Map size={18} /> {rt.name}</h3>
                  <p className="text-xs font-bold text-slate-400">{rt.id}</p>
                </div>
                <p className="text-xs text-slate-500 mb-3">{rt.areas}</p>
                
                <div className="flex justify-between items-center text-xs font-bold">
                  <div className="bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl text-slate-600 dark:text-slate-300">
                    {rt.drivers} Drivers Assigned
                  </div>
                  <div className="text-slate-400">{rt.volume}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <ClayCard className="lg:col-span-2 border-none p-0 overflow-hidden relative min-h-[500px] flex items-center justify-center">
            {/* Mock Vector Map BG */}
            <div className="absolute inset-0 bg-slate-200 dark:bg-slate-900 opacity-60 pointer-events-none" style={{
              backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(0,0,0,0.1) 1px, transparent 0)',
              backgroundSize: '24px 24px'
            }} />
            
            <div className="relative text-center space-y-4">
              <div className="h-16 w-16 bg-white rounded-full flex items-center justify-center mx-auto shadow-xl text-blue-500">
                 <Navigation size={28} />
              </div>
              <h3 className="font-bold text-xl text-slate-700 dark:text-slate-200">Select a map territory to preview coordinates</h3>
              <p className="text-slate-500 text-sm max-w-sm mx-auto">Full interactive vector map implementation would load native GL boundaries here.</p>
              
              <div className="flex justify-center gap-3 mt-6">
                <ClayButton variant="secondary" className="px-8"><Edit3 size={16} className="mr-2"/> Edit Bounds</ClayButton>
                <ClayButton variant="ghost" className="text-rose-500 hover:bg-rose-50 border border-rose-100"><Trash2 size={16}/></ClayButton>
              </div>
            </div>
        </ClayCard>
      </div>
    </div>
  )
}
