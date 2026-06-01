import { useEffect, useState } from 'react';
import { BarChart3, Receipt, Layers } from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';
import { toast } from 'react-hot-toast';

const AdminLoader = () => (
  <div className="flex min-h-[60vh] items-center justify-center">
    <div className="relative h-16 w-16 rounded-full water-gradient shadow-2xl shadow-edrops-aqua/30">
      <div className="absolute inset-2 animate-ping rounded-full bg-white/40" />
    </div>
  </div>
);

export default function ReportsCenter() {
  const [sales, setSales] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadReports = async () => {
    try {
      setLoading(true);
      const [purchasesData, customersData] = await Promise.all([
        fetchWithAuth('/recharge/purchases'),
        fetchWithAuth('/customer')
      ]);
      setSales(purchasesData || []);
      setCustomers(customersData || []);
    } catch (err) {
      toast.error('Failed to compile reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  if (loading) return <AdminLoader />;

  const totalPackagesSold = sales.length;
  const totalVolumeRevenue = sales.reduce((acc, s) => acc + s.amount, 0);

  return (
    <main className="space-y-6">
      <section className="clay-card p-6 sm:p-8">
        <span className="inline-flex items-center gap-2 rounded-full bg-background px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-[#A855F7]">
          <BarChart3 className="h-4 w-4" /> Audit Reports
        </span>
        <h1 className="mt-5 text-4xl font-black sm:text-5xl text-[#245361]">ERP Business Statements</h1>
        <p className="mt-2 text-muted-foreground text-sm">Downloadable audits covering package recharges, security deposits, and customer balances.</p>
      </section>

      {/* Reports Summary Metrics */}
      <section className="grid gap-6 sm:grid-cols-2">
        <div className="clay-card p-6 flex items-center justify-between bg-purple-50/50 border-purple-100 font-semibold">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-purple-700">Cumulative Sales Revenue</p>
            <p className="text-3xl font-black text-purple-900 mt-1">₹{totalVolumeRevenue}</p>
          </div>
          <Receipt className="h-8 w-8 text-purple-600" />
        </div>
        <div className="clay-card p-6 flex items-center justify-between bg-blue-50/50 border-blue-100 font-semibold">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-blue-700">Prepaid Packages Sold</p>
            <p className="text-3xl font-black text-blue-900 mt-1">{totalPackagesSold} Packs</p>
          </div>
          <Layers className="h-8 w-8 text-blue-600" />
        </div>
      </section>

      {/* Sales Report Feed */}
      <section className="clay-card p-6 space-y-4">
        <h3 className="text-lg font-black text-[#245361] uppercase tracking-wider">Package Sales Ledger</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm font-semibold border-collapse">
            <thead>
              <tr className="border-b border-border/50 text-[#245361] uppercase tracking-wider text-[10px] font-black">
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Customer</th>
                <th className="py-2.5 px-3">Package</th>
                <th className="py-2.5 px-3">Jars Volume</th>
                <th className="py-2.5 px-3">Revenue Earned</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((item) => (
                <tr key={item.id} className="border-b border-border/30 hover:bg-slate-50 font-medium">
                  <td className="py-3 px-3 text-xs text-slate-500">{new Date(item.createdAt).toLocaleDateString()}</td>
                  <td className="py-3 px-3 font-bold text-slate-800">{item.customer?.user?.firstName} {item.customer?.user?.lastName}</td>
                  <td className="py-3 px-3">{item.package?.name}</td>
                  <td className="py-3 px-3 font-bold">{item.package?.jarCount} Jars</td>
                  <td className="py-3 px-3 font-black text-[#245361]">₹{item.amount}</td>
                  <td className="py-3 px-3">
                    <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full text-[10px] font-black uppercase">
                      {item.paymentStatus}
                    </span>
                  </td>
                </tr>
              ))}
              {sales.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-xs text-slate-400 italic py-6">No purchases logged.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Customer Balance ledger */}
      <section className="clay-card p-6 space-y-4">
        <h3 className="text-lg font-black text-[#245361] uppercase tracking-wider">Customer Deposit Statement</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm font-semibold border-collapse">
            <thead>
              <tr className="border-b border-border/50 text-[#245361] uppercase tracking-wider text-[10px] font-black">
                <th className="py-2.5 px-3">Customer</th>
                <th className="py-2.5 px-3">Balance Jars</th>
                <th className="py-2.5 px-3">Deposit Paid</th>
                <th className="py-2.5 px-3">Deposit Outstanding</th>
                <th className="py-2.5 px-3">Company Jars Held</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((cust) => (
                <tr key={cust.id} className="border-b border-border/30 hover:bg-slate-50 font-medium">
                  <td className="py-3 px-3 font-bold text-slate-800">{cust.user?.firstName} {cust.user?.lastName}</td>
                  <td className="py-3 px-3 font-bold text-primary">{cust.jarBalance?.availableJars ?? 0} Jars</td>
                  <td className="py-3 px-3 font-bold text-emerald-600">₹{cust.jarDeposit?.depositPaid ?? 0}</td>
                  <td className="py-3 px-3 font-bold text-red-500">₹{cust.jarDeposit?.depositDue ?? 0}</td>
                  <td className="py-3 px-3 text-slate-700">{cust.jarOwnership?.companyJarsHeld ?? 0} Jars</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
