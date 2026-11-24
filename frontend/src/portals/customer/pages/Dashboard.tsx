import { Package, Award, Truck, CreditCard, ChevronRight, Droplets, Calendar, Plus, ShoppingBag } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { fetchWithAuth } from '../../../api/client';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from '../../../components/LoadingSpinner';
import { formatOrderId } from '../../../utils/orderFormatters';
import { getOrderStatusConfig } from '../../../utils/orderStateMachine';

export default function Dashboard() {
  const navigate = useNavigate();

  const { data: userProfile, isLoading: profileLoading } = useQuery({
    queryKey: ['userProfile'],
    queryFn: () => fetchWithAuth('/auth/me'),
    refetchInterval: 15000,
  });

  const { data: ordersData } = useQuery({
    queryKey: ['customerRecentOrders'],
    queryFn: async () => {
      const res = await fetchWithAuth('/order');
      return Array.isArray(res) ? res.slice(0, 3) : [];
    },
    refetchInterval: 15000,
  });

  if (profileLoading) {
    return <LoadingSpinner fullPage label="Loading dashboard..." />;
  }

  const customer = userProfile?.customer;
  const jarBalance = customer?.jarBalances?.[0] || customer?.jarBalance || { availableJars: 0, totalPurchased: 0 };
  const jarDeposit = customer?.jarDeposits?.[0] || customer?.jarDeposit || { maxActiveJars: 0, depositPaid: 0, depositDue: 0 };
  const walletBalance = Number(customer?.wallet?.balance ?? 0);

  // Derive next scheduled delivery quantity from active rules
  const nextScheduledQty = (() => {
    const rules = customer?.deliverySchedule?.rules || [];
    if (!rules.length || !customer?.deliverySchedule?.isActive) return 0;
    const today = new Date().getDay();
    for (let i = 0; i <= 6; i++) {
      const checkDay = (today + i) % 7;
      const match = rules.find((r: any) => r.type === 'WEEKLY' && r.dayOfWeek === checkDay && r.quantity > 0);
      if (match) return match.quantity;
    }
    return rules[0]?.quantity || 0;
  })();

  const isScheduleActive = Boolean(customer?.deliverySchedule?.isActive);
  const recentOrders = ordersData || [];

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20 text-[#0F172A]">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-6 lg:px-8 space-y-5">
        
        {/* ─── 1. COMPACT TOP HEADER ────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200/80">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Welcome back{userProfile?.firstName ? `, ${userProfile.firstName}` : ''}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
              Hydration overview & quick management
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/customer/shop')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#1E88E5] hover:bg-[#1565C0] text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Order Water</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/customer/recharge')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl shadow-2xs transition-colors cursor-pointer"
            >
              <CreditCard className="w-3.5 h-3.5 text-[#1E88E5]" />
              <span>Recharge</span>
            </button>
          </div>
        </div>

        {/* ─── 2. PRIMARY SUMMARY STRIP (4 ESSENTIAL METRICS) ────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: Available Jars */}
          <div
            onClick={() => navigate('/customer/deliveries')}
            className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs hover:border-blue-300 transition-colors cursor-pointer flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Prepaid Jars
              </span>
              <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#1E88E5] flex items-center justify-center">
                <Droplets className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black text-slate-900">
                {jarBalance.availableJars}
              </span>
              <span className="text-xs font-semibold text-slate-500">Jars left</span>
            </div>
          </div>

          {/* Card 2: Wallet Balance */}
          <div
            onClick={() => navigate('/customer/wallet')}
            className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs hover:border-blue-300 transition-colors cursor-pointer flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Wallet Balance
              </span>
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CreditCard className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black text-slate-900">
                ₹{walletBalance.toFixed(0)}
              </span>
              <span className="text-xs font-semibold text-slate-500">Available</span>
            </div>
          </div>

          {/* Card 3: Next Scheduled Delivery */}
          <div
            onClick={() => navigate('/customer/deliveries')}
            className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs hover:border-blue-300 transition-colors cursor-pointer flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Delivery Schedule
              </span>
              <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                <Calendar className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black text-slate-900">
                {isScheduleActive ? `${nextScheduledQty} Jars` : 'Paused'}
              </span>
              <span className="text-xs font-semibold text-slate-500">
                {isScheduleActive ? 'Next drop' : 'Schedule'}
              </span>
            </div>
          </div>

          {/* Card 4: Security Deposit Status */}
          <div
            onClick={() => navigate('/customer/wallet?action=pay-deposit')}
            className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs hover:border-amber-300 transition-colors cursor-pointer flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Jar Deposit
              </span>
              <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <Award className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black text-slate-900">
                {jarDeposit.depositDue > 0 ? `₹${jarDeposit.depositDue}` : 'Settled'}
              </span>
              <span className="text-xs font-semibold text-slate-500">
                {jarDeposit.depositDue > 0 ? 'Due' : 'Paid'}
              </span>
            </div>
          </div>
        </div>

        {/* ─── 3. TWO-COLUMN OPERATIONAL SECTION ───────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          
          {/* Left Column: Quick Navigation & Delivery Shortcut (Cols 1-7) */}
          <div className="lg:col-span-7 space-y-4">
            
            {/* Delivery Schedule Hero Card */}
            <div className="bg-gradient-to-br from-[#0F172A] to-[#1E293B] text-white rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-bold uppercase tracking-wider">
                  <Truck className="w-3 h-3" />
                  <span>Auto-Deliveries</span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white mt-1">
                  {isScheduleActive ? 'Your recurring delivery is active' : 'Schedule is paused'}
                </h3>
                <p className="text-xs text-slate-300">
                  {isScheduleActive
                    ? 'Jars will arrive automatically according to your calendar.'
                    : 'Activate cadence to receive regular water drops without ordering manually.'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => navigate('/customer/deliveries')}
                className="px-4 py-2 bg-[#1E88E5] hover:bg-[#1565C0] text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer shrink-0 inline-flex items-center gap-1.5"
              >
                <span>Manage Schedule</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Clean 3-Card Action Row */}
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => navigate('/customer/shop')}
                className="p-3.5 bg-white border border-slate-200/80 rounded-2xl hover:border-blue-300 text-left transition-all shadow-2xs group cursor-pointer"
              >
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#1E88E5] flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-bold text-slate-900">Buy Jars</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">Browse catalog</p>
              </button>

              <button
                type="button"
                onClick={() => navigate('/customer/recharge')}
                className="p-3.5 bg-white border border-slate-200/80 rounded-2xl hover:border-blue-300 text-left transition-all shadow-2xs group cursor-pointer"
              >
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                  <CreditCard className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-bold text-slate-900">Top-Up</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">Prepaid packs</p>
              </button>

              <button
                type="button"
                onClick={() => navigate('/customer/orders')}
                className="p-3.5 bg-white border border-slate-200/80 rounded-2xl hover:border-blue-300 text-left transition-all shadow-2xs group cursor-pointer"
              >
                <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                  <Package className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-bold text-slate-900">Orders</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">Track & invoices</p>
              </button>
            </div>
          </div>

          {/* Right Column: Real Recent Orders (Cols 8-12) */}
          <div className="lg:col-span-5 space-y-3">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Recent Orders
                </h3>
                <button
                  type="button"
                  onClick={() => navigate('/customer/orders')}
                  className="text-xs font-bold text-[#1E88E5] hover:underline cursor-pointer"
                >
                  View All
                </button>
              </div>

              <div className="divide-y divide-slate-100">
                {recentOrders.length === 0 ? (
                  <div className="py-8 text-center text-slate-400">
                    <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-xs font-semibold">No recent orders yet</p>
                  </div>
                ) : (
                  recentOrders.map((order: any) => {
                    const cfg = getOrderStatusConfig(order.status);
                    const orderDate = new Date(order.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                    });
                    const primaryName = order.items?.[0]?.product?.name || 'Water Jar';
                    const qty = order.items?.reduce((s: number, i: any) => s + (i.quantity || 1), 0) || 1;

                    return (
                      <div
                        key={order.id}
                        onClick={() => navigate(`/customer/orders/${order.id}`)}
                        className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50 rounded-xl px-2 transition-colors cursor-pointer"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900 truncate">
                              #{formatOrderId(order.id)}
                            </span>
                            <span className="text-[11px] text-slate-400">• {orderDate}</span>
                          </div>
                          <p className="text-xs text-slate-500 truncate mt-0.5">
                            {qty}x {primaryName}
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg.badgeClass}`}>
                            {cfg.label}
                          </span>
                          <span className="block text-xs font-bold text-slate-900 mt-0.5">
                            ₹{order.totalAmount || 0}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
