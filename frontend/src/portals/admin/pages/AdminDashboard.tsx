import { useQuery } from '@tanstack/react-query';
import { 
  Users, Droplets, DollarSign, AlertTriangle, Activity, TrendingUp 
} from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';

const AdminLoader = () => (
  <div className="flex min-h-[60vh] items-center justify-center">
    <div className="relative h-16 w-16 rounded-full water-gradient shadow-2xl shadow-edrops-aqua/30">
      <div className="absolute inset-2 animate-ping rounded-full bg-white/40" />
    </div>
  </div>
);

export default function AdminDashboard() {
  const { data, isLoading: loading } = useQuery({
    queryKey: ['adminDashboardMetrics'],
    queryFn: async () => {
      const [analytics, customers] = await Promise.all([
        fetchWithAuth('/analytics/snapshot'),
        fetchWithAuth('/customer')
      ]);
      return { analytics, customers };
    },
    refetchInterval: 10000,
  });

  const analytics = data?.analytics;
  const customers = data?.customers;

  const metrics = [
    { label: 'Total Customers', value: customers?.length || 0, detail: 'Registered users in system', icon: Users, color: 'blue' },
    { label: 'Hydration Deliveries', value: analytics?.totalJarsDelivered ?? 0, detail: 'Jars delivered all-time', icon: Droplets, color: 'emerald' },
    { label: 'ERP Sales Revenue', value: `Rs ${analytics?.totalRevenue ?? 0}`, detail: 'Total package revenue', icon: DollarSign, color: 'amber' }
  ];

  const watchlist = (customers || []).filter((c: any) => (c.jarBalance?.availableJars ?? 0) <= 5);

  if (loading) return <AdminLoader />;

  return (
    <main className="space-y-6">
      {/* Welcome Banner */}
      <section className="clay-card overflow-hidden rounded-[2.5rem] p-6 sm:p-8">
        <span className="inline-flex items-center gap-2 rounded-full bg-background px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-primary">
          <Activity className="h-4 w-4" /> Live Intelligence
        </span>
        <h1 className="mt-5 text-4xl font-black sm:text-6xl text-[#245361]">Admin Control Center</h1>
        <p className="mt-3 text-[#245361]/80 max-w-xl text-sm leading-6">
          Realtime business diagnostics: configure pricing, manage prepaid catalogs, monitor drivers, and track inventory audits.
        </p>
      </section>

      {/* Metrics Cards */}
      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((metric, i) => {
          const Icon = metric.icon;
          return (
            <div key={i} className="clay-card p-6 flex flex-col justify-between space-y-4">
              <div className="flex justify-between items-start">
                <span className={`h-11 w-11 rounded-2xl flex items-center justify-center bg-secondary/15`}>
                  <Icon className="h-6 w-6 text-primary" />
                </span>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active</span>
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-slate-400">{metric.label}</p>
                <h3 className="text-3xl font-black text-slate-800 mt-1">{metric.value}</h3>
                <p className="text-xs font-semibold text-slate-500 mt-1">{metric.detail}</p>
              </div>
            </div>
          );
        })}
      </section>

      {/* Watchlist Section */}
      <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="clay-card p-6 space-y-4">
          <h2 className="text-xl font-black text-[#245361] flex items-center gap-1.5">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            {"Low Balance Watchlist (<= 5 Jars)"}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm font-semibold border-collapse">
              <thead>
                <tr className="border-b border-border/50 text-[#245361] uppercase tracking-wider text-[10px] font-black">
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3">Registered Phone</th>
                  <th className="py-2.5 px-3">Prepaid Balance</th>
                  <th className="py-2.5 px-3">Deposit Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {watchlist.map((cust: any) => (
                  <tr key={cust.id} className="border-b border-border/30 hover:bg-slate-50 font-medium">
                    <td className="py-3 px-3 font-bold text-slate-800">
                      {cust.user?.firstName} {cust.user?.lastName}
                    </td>
                    <td className="py-3 px-3 text-slate-600">{cust.user?.phone}</td>
                    <td className="py-3 px-3">
                      <span className="bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full text-xs font-black uppercase">
                        {cust.jarBalance?.availableJars ?? 0} Jars
                      </span>
                    </td>
                    <td className="py-3 px-3 font-bold text-red-500">₹{cust.jarDeposit?.depositDue ?? 0}</td>
                  </tr>
                ))}
                {watchlist.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center text-xs text-slate-400 italic py-6">
                      No customer is currently below the low balance threshold.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="clay-card bg-primary text-primary-foreground p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <TrendingUp className="h-10 w-10 text-white" />
            <h3 className="text-2xl font-black text-white">Promotional Growth</h3>
            <p className="text-xs text-white/80 leading-5">
              Launch limited-time coupons, referral cashbacks, and percentage discounts to drive recharges during festivals. Connect promotions seamlessly to wallet balances.
            </p>
          </div>
          <div className="bg-white/10 rounded-2xl p-4.5 text-center mt-6">
            <p className="text-4xl font-black text-white">0%</p>
            <p className="text-[10px] font-black uppercase tracking-wider text-white/60 mt-1">active churn rates</p>
          </div>
        </div>
      </section>
    </main>
  );
}
