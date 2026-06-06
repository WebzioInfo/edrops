import { motion } from 'framer-motion';
import { Package, Award, Truck, Route, CreditCard, CheckCircle2, History, Plus, Calendar, Clock, MapPin, Zap } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PremiumWaterJar from '../components/PremiumWaterJar';
import { fetchWithAuth } from '../../../api/client';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

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
      toast.error(err.message || 'Failed to purchase jar ownership.');
    }
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7FAFC]">
        <div className="w-10 h-10 border-4 border-[#1E88E5]/20 border-t-[#1E88E5] rounded-full animate-spin" />
      </div>
    );
  }

  const customer = userProfile?.customer;
  const jarBalance = customer?.jarBalance || { availableJars: 0, totalPurchased: 10 };
  const jarDeposit = customer?.jarDeposit || { maxActiveJars: 0, depositPaid: 0, depositDue: 0 };
  const jarOwnership = customer?.jarOwnership || { companyJarsHeld: 0, ownedJars: 0 };

  const handleOwnJar = () => {
    if (jarDeposit.depositDue <= 0) {
      toast.error('No outstanding deposits due to convert!');
      return;
    }
    ownJarMutation.mutate();
  };

  // Mocked recent activity since no endpoint exists yet
  const recentActivities = [
    { title: 'Delivery Completed', time: 'Today, 08:30 AM', icon: CheckCircle2, color: 'text-[#10B981]', bg: 'bg-[#10B981]/10' },
    { title: 'Wallet Recharged (₹500)', time: 'Yesterday, 04:15 PM', icon: Zap, color: 'text-[#1E88E5]', bg: 'bg-[#1E88E5]/10' },
    { title: 'Schedule Updated', time: 'Mon, 10:00 AM', icon: Calendar, color: 'text-[#8B5CF6]', bg: 'bg-[#8B5CF6]/10' },
  ];

  return (
    <div className="min-h-screen bg-[#F7FAFC] pb-24">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 space-y-8">
        
        {/* SECTION 1: WELCOME HEADER */}
        <motion.section 
          initial={{ opacity: 0, y: -10 }} 
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6"
        >
          <div>
            <h1 className="text-[24px] md:text-[28px] font-bold text-[#0F172A] tracking-tight">
              Good Morning, {userProfile?.firstName || 'User'} 👋
            </h1>
            <p className="text-[#64748B] text-[14px] mt-1 font-medium">Your hydration plan is active.</p>
            <div className="flex flex-wrap gap-3 mt-4">
              <span className="flex items-center gap-1.5 text-[12px] font-bold text-[#10B981] bg-[#10B981]/10 px-3 py-1.5 rounded-full border border-[#10B981]/20">
                <CheckCircle2 className="w-3.5 h-3.5" /> Verified Customer
              </span>
              <span className="flex items-center gap-1.5 text-[12px] font-medium text-[#64748B] bg-white border border-[#E2E8F0] shadow-sm px-3 py-1.5 rounded-full">
                <Clock className="w-3.5 h-3.5 text-[#1E88E5]" /> Next Delivery: Tomorrow • Morning Slot
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <button onClick={() => navigate('/customer/shop')} className="flex items-center justify-center gap-2 h-11 px-5 bg-white border border-[#E2E8F0] shadow-sm hover:bg-[#F8FAFC] text-[#0F172A] text-[14px] font-semibold rounded-[12px] transition-colors">
              <Plus className="w-4 h-4 text-[#1E88E5]" /> Order Water
            </button>
            <button onClick={() => navigate('/customer/recharge')} className="flex items-center justify-center gap-2 h-11 px-5 bg-white border border-[#E2E8F0] shadow-sm hover:bg-[#F8FAFC] text-[#0F172A] text-[14px] font-semibold rounded-[12px] transition-colors">
              <CreditCard className="w-4 h-4 text-[#1E88E5]" /> Recharge Wallet
            </button>
            <button onClick={() => navigate('/customer/schedule')} className="flex items-center justify-center gap-2 h-11 px-5 bg-[#1E88E5] hover:bg-[#1976D2] text-white shadow-[0_4px_12px_rgba(30,136,229,0.25)] text-[14px] font-semibold rounded-[12px] transition-colors">
              <Calendar className="w-4 h-4" /> Manage Schedule
            </button>
          </div>
        </motion.section>

        {/* SECTION 2: HYDRATION OVERVIEW (4 Stat Cards) */}
        <motion.section 
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4"
        >
          <div className="bg-white rounded-[20px] p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-[#E2E8F0]/60 hover:shadow-[0_8px_20px_rgba(0,0,0,0.04)] transition-shadow">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-[#1E88E5]/10 flex items-center justify-center">
                <Package className="w-5 h-5 text-[#1E88E5]" />
              </div>
              <p className="text-[13px] font-semibold text-[#64748B] uppercase tracking-wider">Active Jars</p>
            </div>
            <p className="text-[32px] font-bold text-[#0F172A] leading-none">{jarBalance.availableJars}</p>
          </div>

          <div className="bg-white rounded-[20px] p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-[#E2E8F0]/60 hover:shadow-[0_8px_20px_rgba(0,0,0,0.04)] transition-shadow">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <Award className="w-5 h-5 text-emerald-500" />
              </div>
              <p className="text-[13px] font-semibold text-[#64748B] uppercase tracking-wider">Owned Jars</p>
            </div>
            <p className="text-[32px] font-bold text-[#0F172A] leading-none">{jarOwnership.ownedJars}</p>
          </div>

          <div className="bg-white rounded-[20px] p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-[#E2E8F0]/60 hover:shadow-[0_8px_20px_rgba(0,0,0,0.04)] transition-shadow">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-amber-500" />
              </div>
              <p className="text-[13px] font-semibold text-[#64748B] uppercase tracking-wider">Deposit Due</p>
            </div>
            <p className="text-[32px] font-bold text-[#0F172A] leading-none">₹{jarDeposit.depositDue}</p>
          </div>

          <div className="bg-white rounded-[20px] p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-[#E2E8F0]/60 hover:shadow-[0_8px_20px_rgba(0,0,0,0.04)] transition-shadow">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center">
                <Route className="w-5 h-5 text-indigo-500" />
              </div>
              <p className="text-[13px] font-semibold text-[#64748B] uppercase tracking-wider">Next Delivery</p>
            </div>
            <p className="text-[32px] font-bold text-[#0F172A] leading-none">2 <span className="text-[16px] text-[#64748B] font-medium">Jars</span></p>
          </div>
        </motion.section>

        {/* SECTION 3: SMART JAR VISUALIZATION & KPI CARD */}
        <motion.section 
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="grid lg:grid-cols-[1fr_1fr] gap-6"
        >
          {/* Smart Jar Canvas */}
          <div className="bg-white rounded-[24px] p-8 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-[#E2E8F0]/50 relative overflow-hidden flex flex-col items-center justify-center min-h-[400px]">
            <div className="absolute top-6 left-6">
              <h2 className="text-[18px] font-bold text-[#0F172A]">Hydration Meter</h2>
              <p className="text-[13px] text-[#64748B]">Real-time jar tracking</p>
            </div>
            <PremiumWaterJar currentBalance={jarBalance.availableJars} maxBalance={jarBalance.totalPurchased || 10} />
          </div>

          {/* Jar Ownership KPI Card */}
          <div className="bg-white rounded-[24px] p-6 md:p-8 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-[#E2E8F0]/50 flex flex-col justify-between">
            <div>
              <h2 className="text-[20px] font-bold text-[#0F172A] mb-6 flex items-center gap-2">
                <Award className="w-6 h-6 text-[#1E88E5]" /> Jar Ownership Portfolio
              </h2>
              
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-[#F8FAFC] rounded-[16px] p-4 border border-[#E2E8F0]/60">
                  <p className="text-[13px] font-semibold text-[#64748B]">Company Jars</p>
                  <p className="text-[28px] font-bold text-[#0F172A] mt-1">{jarOwnership.companyJarsHeld}</p>
                </div>
                <div className="bg-[#10B981]/5 rounded-[16px] p-4 border border-[#10B981]/10">
                  <p className="text-[13px] font-semibold text-[#10B981]">Owned Jars</p>
                  <p className="text-[28px] font-bold text-[#10B981] mt-1">{jarOwnership.ownedJars}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center pb-4 border-b border-[#E2E8F0]">
                  <span className="text-[14px] font-medium text-[#64748B]">Outstanding Deposit</span>
                  <span className="text-[16px] font-bold text-[#0F172A]">₹{jarDeposit.depositDue}</span>
                </div>
                <div className="flex justify-between items-center pb-4 border-b border-[#E2E8F0]">
                  <span className="text-[14px] font-medium text-[#64748B]">Deposit Paid</span>
                  <span className="text-[16px] font-bold text-[#10B981]">₹{jarDeposit.depositPaid}</span>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="text-[14px] font-medium text-[#64748B]">Max Active Jars Limit</span>
                  <span className="text-[14px] font-bold text-[#0F172A] bg-[#F1F5F9] px-3 py-1 rounded-full">{jarDeposit.maxActiveJars} Jars</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleOwnJar}
              disabled={jarDeposit.depositDue <= 0 || ownJarMutation.isPending}
              className="w-full mt-8 h-14 rounded-[16px] bg-gradient-to-r from-[#1E88E5] to-[#1565C0] text-white font-bold text-[15px] shadow-[0_8px_20px_rgba(30,136,229,0.25)] hover:shadow-[0_12px_24px_rgba(30,136,229,0.35)] hover:-translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              Own This Jar (Pay Deposit ₹200)
            </button>
          </div>
        </motion.section>

        {/* SECTION 4 & 6: NEXT DELIVERY & RECENT ACTIVITY */}
        <motion.section 
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="grid lg:grid-cols-[1fr_1fr] gap-6"
        >
          {/* Next Delivery Card */}
          <div className="bg-white rounded-[24px] p-6 md:p-8 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-[#E2E8F0]/50">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-[18px] font-bold text-[#0F172A] flex items-center gap-2">
                <Truck className="w-5 h-5 text-[#1E88E5]" /> Next Delivery
              </h2>
              <span className="text-[12px] font-bold uppercase tracking-wider text-[#1E88E5] bg-[#1E88E5]/10 px-3 py-1.5 rounded-full">
                Confirmed
              </span>
            </div>

            <div className="grid grid-cols-2 gap-y-8 gap-x-4">
              <div>
                <p className="text-[13px] font-medium text-[#64748B] mb-1">Date</p>
                <p className="text-[16px] font-bold text-[#0F172A]">Tomorrow, 12th Aug</p>
              </div>
              <div>
                <p className="text-[13px] font-medium text-[#64748B] mb-1">Time Slot</p>
                <p className="text-[16px] font-bold text-[#0F172A]">08:00 AM - 10:00 AM</p>
              </div>
              <div>
                <p className="text-[13px] font-medium text-[#64748B] mb-1">Quantity</p>
                <p className="text-[16px] font-bold text-[#0F172A]">2 x 20L Jars</p>
              </div>
              <div>
                <p className="text-[13px] font-medium text-[#64748B] mb-1">Delivery Location</p>
                <p className="text-[16px] font-bold text-[#0F172A] flex items-center gap-1">
                  <MapPin className="w-4 h-4 text-[#1E88E5]" /> Home
                </p>
              </div>
            </div>
          </div>

          {/* Recent Activity Timeline */}
          <div className="bg-white rounded-[24px] p-6 md:p-8 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-[#E2E8F0]/50">
            <h2 className="text-[18px] font-bold text-[#0F172A] mb-8 flex items-center gap-2">
              <History className="w-5 h-5 text-[#64748B]" /> Recent Activity
            </h2>

            <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:ml-6 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-[#E2E8F0] before:to-transparent">
              {recentActivities.map((item, index) => (
                <div key={index} className="relative flex items-center gap-4 md:gap-6">
                  <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full ${item.bg} flex items-center justify-center shrink-0 z-10 border-4 border-white shadow-sm`}>
                    <item.icon className={`w-4 h-4 md:w-5 md:h-5 ${item.color}`} />
                  </div>
                  <div>
                    <h4 className="text-[15px] font-bold text-[#0F172A]">{item.title}</h4>
                    <p className="text-[13px] font-medium text-[#64748B] mt-0.5">{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* SECTION 5: QUICK ACTIONS GRID */}
        <motion.section 
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
        >
          <h2 className="text-[18px] font-bold text-[#0F172A] mb-4 pl-2">Quick Actions</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <button onClick={() => navigate('/customer/shop')} className="bg-white p-5 rounded-[20px] shadow-sm border border-[#E2E8F0]/60 hover:shadow-md hover:-translate-y-1 transition-all text-left flex flex-col justify-between min-h-[140px] group">
              <div className="w-12 h-12 bg-[#1E88E5]/10 rounded-full flex items-center justify-center text-[#1E88E5] group-hover:scale-110 transition-transform">
                <Package className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-[#0F172A] text-[15px]">Order Water</h3>
                <p className="text-[12px] text-[#64748B] mt-1 font-medium">Buy jars or accessories</p>
              </div>
            </button>
            <button onClick={() => navigate('/customer/recharge')} className="bg-white p-5 rounded-[20px] shadow-sm border border-[#E2E8F0]/60 hover:shadow-md hover:-translate-y-1 transition-all text-left flex flex-col justify-between min-h-[140px] group">
              <div className="w-12 h-12 bg-[#1E88E5]/10 rounded-full flex items-center justify-center text-[#1E88E5] group-hover:scale-110 transition-transform">
                <CreditCard className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-[#0F172A] text-[15px]">Recharge Wallet</h3>
                <p className="text-[12px] text-[#64748B] mt-1 font-medium">Add prepaid balance</p>
              </div>
            </button>
            <button onClick={() => navigate('/customer/schedule')} className="bg-white p-5 rounded-[20px] shadow-sm border border-[#E2E8F0]/60 hover:shadow-md hover:-translate-y-1 transition-all text-left flex flex-col justify-between min-h-[140px] group">
              <div className="w-12 h-12 bg-[#1E88E5]/10 rounded-full flex items-center justify-center text-[#1E88E5] group-hover:scale-110 transition-transform">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-[#0F172A] text-[15px]">Manage Schedule</h3>
                <p className="text-[12px] text-[#64748B] mt-1 font-medium">Set weekly routines</p>
              </div>
            </button>
            <button onClick={() => navigate('/customer/track')} className="bg-white p-5 rounded-[20px] shadow-sm border border-[#E2E8F0]/60 hover:shadow-md hover:-translate-y-1 transition-all text-left flex flex-col justify-between min-h-[140px] group">
              <div className="w-12 h-12 bg-[#1E88E5]/10 rounded-full flex items-center justify-center text-[#1E88E5] group-hover:scale-110 transition-transform">
                <Truck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-[#0F172A] text-[15px]">Track Deliveries</h3>
                <p className="text-[12px] text-[#64748B] mt-1 font-medium">View live status</p>
              </div>
            </button>
          </div>
        </motion.section>

      </div>
    </div>
  );
}
