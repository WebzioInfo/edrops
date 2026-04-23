import { MapPin, Package, Navigation } from "lucide-react"

export default function DeliveryDashboard() {
  return (
    <div className="p-6 max-w-xl mx-auto space-y-6 pb-24">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Delivery Portal</h1>
          <p className="text-slate-500">Welcome back, Driver!</p>
        </div>
        <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center text-primary">
          <Package />
        </div>
      </header>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
          <h3 className="text-3xl font-bold text-slate-800">12</h3>
          <p className="text-sm text-slate-500">Pending Deliveries</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
          <h3 className="text-3xl font-bold text-slate-800">24</h3>
          <p className="text-sm text-slate-500">Completed Today</p>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-bold">Current Route</h2>
        <div className="bg-primary/5 p-4 rounded-xl border border-primary/10">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-full bg-primary text-white flex items-center justify-center shrink-0">
              <Navigation size={20} />
            </div>
            <div>
              <h4 className="font-semibold text-slate-800">Route A-102</h4>
              <p className="text-sm text-slate-600 mb-3">12 stops remaining • 15 km total</p>
              <button className="w-full bg-primary text-white py-2 rounded-lg font-medium shadow-md shadow-primary/20 hover:bg-primary/90 transition-colors">
                Start Route
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-bold">Upcoming Stops</h2>
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
              {i}
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-slate-800">Customer #{1000 + i}</h4>
              <div className="flex items-center text-sm text-slate-500 gap-1 mt-1">
                <MapPin size={14} />
                <span>Sector {i + 10}, City Center</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
