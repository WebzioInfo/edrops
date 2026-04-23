import { 
  MapPin, 
  Truck, 
  Clock
} from "lucide-react"
import { ClayCard, ClayButton } from "../../components/ui/ClayComponents"

export default function DistributorDashboard() {
  const pendingOrders = [
    { id: "ORD-101", customer: "Rahul K.", address: "Kakkanad, Kochi", items: "20L Jar x 2", amount: "₹160" },
    { id: "ORD-102", customer: "Anjali S.", address: "Edappally, Kochi", items: "1L Bottle Case x 1", amount: "₹200" },
  ]

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1">
        <h1 className="text-4xl font-extrabold tracking-tight">Distributor Portal</h1>
        <p className="text-slate-500 dark:text-slate-400">Manage your route deliveries and inventory efficiently.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <ClayCard className="bg-blue-600 text-white border-none">
          <h2 className="text-lg opacity-90 font-bold uppercase mb-2">Today's Route</h2>
          <div className="text-3xl font-extrabold">Cochin East</div>
          <p className="text-sm opacity-80 mt-1">Kakkanad & Infopark area</p>
        </ClayCard>
        
        <ClayCard className="border-none">
          <h2 className="text-lg text-slate-500 font-bold uppercase mb-2">Inventory Status</h2>
          <div className="text-3xl font-extrabold">124 Jars</div>
          <p className="text-xs text-amber-600 font-bold mt-1">Low Stock Alert: <span className="underline cursor-pointer">Request More</span></p>
        </ClayCard>

        <ClayCard className="border-none">
          <h2 className="text-lg text-slate-500 font-bold uppercase mb-2">Performance</h2>
          <div className="text-3xl font-extrabold">98%</div>
          <p className="text-xs text-emerald-600 font-bold mt-1">On-time delivery this week</p>
        </ClayCard>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Pending Orders Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Clock className="text-blue-600" /> Pending Acceptance
            </h2>
            <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold">2 NEW</span>
          </div>
          
          <div className="space-y-4">
            {pendingOrders.map((order) => (
              <ClayCard key={order.id} className="border-none hover:translate-x-1 transition-transform p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-lg">{order.id}</h3>
                    <p className="text-slate-500 text-sm flex items-center gap-1"><MapPin size={14} /> {order.address}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-extrabold text-blue-600">{order.amount}</p>
                    <p className="text-xs text-slate-400">{order.items}</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <ClayButton className="flex-1 w-full text-xs">Accept</ClayButton>
                  <ClayButton variant="ghost" className="flex-1 text-rose-600 border border-stone-200">Reject</ClayButton>
                </div>
              </ClayCard>
            ))}
          </div>
        </div>

        {/* Assigned Partners Section */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Truck className="text-indigo-600" /> Delivery Partners
          </h2>
          
          <ClayCard className="border-none p-0 overflow-hidden">
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {[
                { name: "Suresh Babu", status: "Out for Delivery", load: "12 Jars", color: "text-emerald-500" },
                { name: "Vinod Kumar", status: "Idle", load: "0 Jars", color: "text-slate-400" },
                { name: "Ashraf ali", status: "Returning", load: "5 Empties", color: "text-blue-500" },
              ].map((partner, i) => (
                <div key={i} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800" />
                    <div>
                      <p className="font-bold text-sm">{partner.name}</p>
                      <p className={`text-xs font-semibold ${partner.color}`}>{partner.status}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{partner.load}</p>
                  </div>
                </div>
              ))}
            </div>
          </ClayCard>

          <ClayButton variant="ghost" className="w-full border-2 border-dashed border-slate-300 text-slate-500">
            + Assign Freelance Partner
          </ClayButton>
        </div>
      </div>
    </div>
  )
}
