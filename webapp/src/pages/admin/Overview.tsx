import { useEffect } from "react"
import { 
  Users, 
  Package, 
  ShoppingCart, 
  TrendingUp,
  AlertCircle
} from "lucide-react"
import { ClayCard, ClayStatCard } from "../../components/ui/ClayComponents"
import { useDashboardStats } from "../../lib/api"

export default function Overview() {
  const { data: stats, loading, error, refetch } = useDashboardStats();

  useEffect(() => {
    refetch();
  }, []);

  if (loading) return <div className="p-8 text-center opacity-50 font-bold animate-pulse">Loading global stats...</div>;
  if (error) return <div className="p-8 text-rose-500 bg-rose-50 rounded-3xl flex items-center gap-3 font-bold"><AlertCircle /> {error}</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1">
        <h1 className="text-4xl font-extrabold tracking-tight">Operations Overview</h1>
        <p className="text-slate-500 dark:text-slate-400">Real-time status of Kerala water distribution network.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <ClayStatCard 
          title="REVENUE TODAY" 
          value={`₹ ${stats?.todayRevenue || 0}`} 
          icon={<TrendingUp size={20} />} 
          trend="Gross collection today"
        />
        <ClayStatCard 
          title="PENDING ORDERS" 
          value={stats?.pendingOrders || 0} 
          icon={<ShoppingCart size={20} />} 
          trend="Awaiting assignment"
        />
        <ClayStatCard 
          title="DELIVERED TODAY" 
          value={stats?.deliveredToday || 0} 
          icon={<Package size={20} />} 
          trend="Successful dispatches"
        />
        <ClayStatCard 
          title="ACTIVE SUBS" 
          value={stats?.activeSubscriptions || 0} 
          icon={<Users size={20} />} 
          trend="Recurring fulfillment"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <ClayCard className="col-span-4 bg-linear-to-br from-primary/5 to-transparent flex flex-col justify-center items-center h-[300px]">
          <h2 className="text-xl font-bold w-full text-left mb-auto">Revenue Growth</h2>
          <div className="text-center space-y-2 opacity-50 my-auto">
            <TrendingUp size={48} className="mx-auto text-primary" />
            <p className="font-bold text-slate-400">Total System Revenue: ₹ {stats?.totalRevenue || 0}</p>
          </div>
        </ClayCard>
        
        <ClayCard className="col-span-3">
          <h2 className="text-xl font-bold mb-6">User Base Growth</h2>
          <div className="space-y-6">
            <div className="flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 border border-primary/20 rounded-xl bg-white flex items-center justify-center font-bold text-primary dark:bg-slate-900 shadow-sm">
                  {stats?.totalCustomers || 0}
                </div>
                <div>
                  <p className="text-sm font-bold">Total Customers</p>
                  <p className="text-xs text-muted-foreground">Registered on platform</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 border border-primary/20 rounded-xl bg-white flex items-center justify-center font-bold text-primary dark:bg-slate-900 shadow-sm">
                  {stats?.totalOrders || 0}
                </div>
                <div>
                  <p className="text-sm font-bold">Total Orders</p>
                  <p className="text-xs text-muted-foreground">Processed to date</p>
                </div>
              </div>
            </div>
          </div>
        </ClayCard>
      </div>
    </div>
  )
}
