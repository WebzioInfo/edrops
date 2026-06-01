import { motion } from 'framer-motion';
import { ChevronRight, Clock3, Package, Award, Truck, Sparkles, Route, HeartHandshake } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AnimatedWaterJar from '../components/AnimatedWaterJar';
import { fetchWithAuth } from '../../../api/client';
import { toast } from 'react-hot-toast';

export default function Dashboard() {
  const queryClient = useQueryClient();

  const { data: userProfile, isLoading } = useQuery({
    queryKey: ['userProfile'],
    queryFn: () => fetchWithAuth('/auth/me'),
    refetchInterval: 10000,
  });

  const ownJarMutation = useMutation({
    mutationFn: () => fetchWithAuth('/wallet/own-jar', { method: 'POST' }),
    onSuccess: () => {
      toast.success('Successfully purchased jar ownership! Deposit due decreased.');
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to purchase jar ownership. Check wallet balance.');
    }
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="relative h-16 w-16 rounded-full water-gradient shadow-2xl shadow-edrops-aqua/30">
          <div className="absolute inset-2 animate-ping rounded-full bg-white/40" />
        </div>
      </div>
    );
  }

  const customer = userProfile?.customer;
  const jarBalance = customer?.jarBalance || { availableJars: 0, totalPurchased: 10 };
  const jarDeposit = customer?.jarDeposit || { maxActiveJars: 0, depositPaid: 0, depositDue: 0 };
  const jarOwnership = customer?.jarOwnership || { companyJarsHeld: 0, ownedJars: 0 };

  const availableJars = jarBalance.availableJars;
  const totalPurchased = jarBalance.totalPurchased || 10;

  // Determine Jar Indicator color status
  // 0-5 = Red, 6-15 = Orange, 16-29 = Blue, 30+ = Green
  let balanceTone = 'text-[#2D79A8]'; // default blue
  let balanceBg = 'bg-[#BBDFF2]/30 border-[#BBDFF2]';
  let balanceLabel = 'Good Balance';

  if (availableJars <= 5) {
    balanceTone = 'text-rose-600';
    balanceBg = 'bg-rose-50 border-rose-200';
    balanceLabel = 'Critical Low Balance';
  } else if (availableJars <= 15) {
    balanceTone = 'text-amber-600';
    balanceBg = 'bg-amber-50 border-amber-200';
    balanceLabel = 'Low Balance Warning';
  } else if (availableJars >= 30) {
    balanceTone = 'text-emerald-600';
    balanceBg = 'bg-emerald-50 border-emerald-200';
    balanceLabel = 'Full Reserve';
  }

  const deliverySteps = [
    { label: 'Out for delivery', time: '08:30 AM', done: false },
    { label: 'Expected arrival', time: '11:00 AM', done: false },
  ];

  const handleOwnJar = () => {
    if (jarDeposit.depositDue <= 0) {
      toast.error('No outstanding deposits due to convert!');
      return;
    }
    ownJarMutation.mutate();
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8 space-y-6">

      {/* 1. TOP: Greeting & Summary */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="clay-card p-5 sm:p-8 flex flex-col gap-4"
      >
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-2 rounded-full bg-background px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-primary">
            <Sparkles className="h-4 w-4" />
            Prepaid Hydration
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-[#245361]/80 uppercase tracking-wider">Account Status</p>
            <p className="text-lg font-black text-foreground">Verified</p>
          </div>
        </div>

        <div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground">
            Hi {userProfile?.firstName || 'Jasmine'},
          </h1>
          <p className="mt-2 text-base font-medium text-[#245361]/90">
            Prepaid water supply is active. Manage your jars, schedule, and ownership status.
          </p>
        </div>
      </motion.section>

      {/* 2. CENTER: Water Jar & Balances */}
      <div className="grid gap-6 md:grid-cols-[1.1fr_0.9fr]">
        
        {/* Animated Water Jar visual container */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="clay-card flex flex-col items-center justify-center p-6 sm:p-10 relative overflow-hidden min-h-[340px]"
        >
          <AnimatedWaterJar currentBalance={availableJars} maxBalance={totalPurchased} />
          
          <div className={`mt-6 w-full max-w-xs border rounded-2xl p-3 text-center ${balanceBg}`}>
            <span className="text-xs font-black uppercase tracking-wider block">Status</span>
            <span className={`text-base font-black ${balanceTone}`}>{balanceLabel} ({availableJars} / {totalPurchased} Jars)</span>
          </div>
        </motion.div>

        {/* Jar Ownership & Deposit Card */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="clay-card p-6 flex flex-col justify-between"
        >
          <div className="space-y-5">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <Award className="h-6 w-6 text-primary" />
              <h3 className="text-xl font-black text-[#245361]">Jar Ownership</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-secondary/15 rounded-2xl p-4 text-center">
                <p className="text-sm font-bold text-slate-700">Company Jars Held</p>
                <p className="text-3xl font-black text-[#245361] mt-1">{jarOwnership.companyJarsHeld}</p>
              </div>
              <div className="bg-secondary/15 rounded-2xl p-4 text-center">
                <p className="text-sm font-bold text-slate-700">Owned Jars</p>
                <p className="text-3xl font-black text-emerald-600 mt-1">{jarOwnership.ownedJars}</p>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <div className="flex justify-between text-sm font-semibold">
                <span className="text-slate-700">Outstanding Deposit:</span>
                <span className="font-black text-rose-600">₹{jarDeposit.depositDue.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-semibold">
                <span className="text-slate-700">Deposit Paid:</span>
                <span className="font-black text-emerald-600">₹{jarDeposit.depositPaid.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <span>Maximum Active Jars:</span>
                <span>{jarDeposit.maxActiveJars} Jars</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleOwnJar}
            disabled={jarDeposit.depositDue <= 0 || ownJarMutation.isPending}
            className="w-full mt-6 py-4 rounded-full sun-gradient text-sm font-black text-white shadow-lg hover:shadow-orange-300/20 active:scale-98 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <HeartHandshake className="h-4 w-4" />
            Own This Jar (Pay Deposit ₹200)
          </button>
        </motion.div>
      </div>

      {/* 3. BOTTOM: Actions & Timelines */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Quick Actions List */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid gap-3"
        >
          {[
            { label: 'Recharge Jars', detail: 'Purchase prepaid jar pack', icon: Package, link: '/customer/recharge' },
            { label: 'Delivery Schedule', detail: 'Customize your delivery days', icon: Route, link: '/customer/schedule' },
            { label: 'Wallet Settings', detail: 'View history & load money', icon: ChevronRight, link: '/customer/wallet' },
          ].map((action) => {
            const Icon = action.icon;
            return (
              <a
                key={action.label}
                href={action.link}
                className="flex items-center gap-4 rounded-[1.75rem] p-5 text-left transition hover:-translate-y-0.5 clay-card bg-white hover:bg-slate-50/50"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Icon className="h-6 w-6" />
                </span>
                <span className="flex-1">
                  <span className="block text-base font-black text-[#245361]">{action.label}</span>
                  <span className="mt-1 block text-sm font-semibold text-slate-700/80">{action.detail}</span>
                </span>
                <ChevronRight className="h-5 w-5 text-slate-700/60" />
              </a>
            );
          })}
        </motion.div>

        {/* Live Delivery Status */}
        <motion.aside
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="clay-card p-6 sm:p-7"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-[#245361]/85">Next Scheduled</p>
              <h2 className="mt-2 text-3xl font-black text-foreground">Pending route</h2>
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <Truck className="h-7 w-7" />
            </div>
          </div>

          <div className="mt-8 space-y-4">
            {deliverySteps.map((step) => (
              <div key={step.label} className="flex items-center gap-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-background text-primary">
                  <Clock3 className="h-5 w-5" />
                </span>
                <div className="flex-1">
                  <p className="font-black text-foreground">{step.label}</p>
                  <p className="text-sm font-semibold text-slate-700">{step.time}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-[1.75rem] bg-background p-5">
            <div className="flex items-center gap-3">
              <Route className="h-5 w-5 text-primary" />
              <p className="text-sm font-black uppercase tracking-[0.18em] text-primary">Route note</p>
            </div>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-800">
              Deliveries will arrive automatically according to your custom schedule rules. Maintain positive balance to keep routes active.
            </p>
          </div>
        </motion.aside>
      </div>

    </div>
  );
}
