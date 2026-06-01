import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Award, Copy, Share2, Award as AwardIcon, Users, CheckCircle } from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';
import { toast } from 'react-hot-toast';

interface ReferralRecord {
  id: string;
  name: string;
  joinedAt: string;
  status: 'PENDING' | 'REWARDED';
}

export default function ReferPage() {
  const [referralCode, setReferralCode] = useState<string>('EDROPS-JOIN');
  const [referredFriends, setReferredFriends] = useState<ReferralRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadReferralData() {
      try {
        const data = await fetchWithAuth('/auth/me');
        if (data?.customer?.referralCode) {
          setReferralCode(data.customer.referralCode);
        }
        setReferredFriends(data?.customer?.referrals || []);
      } catch (err: any) {
        toast.error('Failed to load referral information');
      } finally {
        setLoading(false);
      }
    }
    loadReferralData();
  }, []);

  const handleCopyLink = () => {
    const link = `https://edrops.in/join?ref=${referralCode}`;
    navigator.clipboard.writeText(link);
    toast.success('Referral link copied to clipboard!');
  };

  const handleShareWhatsApp = () => {
    const message = `Get pure water jars delivered instantly! Join Edrops using my code "${referralCode}" and get 2 free jars on your first recharge: https://edrops.in/join?ref=${referralCode}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`, '_blank');
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="relative h-16 w-16 rounded-full water-gradient shadow-2xl shadow-edrops-aqua/30">
          <div className="absolute inset-2 animate-ping rounded-full bg-white/40" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8 space-y-6">
      
      {/* 1. Header */}
      <div>
        <h1 className="text-3xl font-black text-[#245361]">Refer & Earn Free Jars</h1>
        <p className="text-sm font-semibold text-[#245361]/80 mt-1">Invite friends and unlock rewards for every successful signup</p>
      </div>

      {/* 2. Referral Code Dashboard */}
      <div className="grid gap-6 md:grid-cols-[1.1fr_0.9fr]">
        
        {/* Large Invite Card */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="water-shell rounded-[2.5rem] p-6 sm:p-10 relative overflow-hidden flex flex-col justify-between min-h-[220px]"
        >
          <div className="absolute inset-x-0 bottom-0 h-28 wave-mask opacity-50" />
          
          <div className="relative">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1 text-xs font-black uppercase tracking-wider text-[#2D79A8] shadow-sm">
              <Award className="h-3.5 w-3.5" /> Refer Program
            </span>
            <h3 className="text-2xl font-black text-[#245361] mt-4">Give 2 jars, Get 2 jars</h3>
            <p className="text-sm font-semibold text-slate-700/80 mt-1">
              Invite friends to Edrops. When they recharge their first wallet package, you both receive 2 free jars in your accounts!
            </p>
          </div>

          <div className="relative mt-6 flex flex-col sm:flex-row gap-3">
            <div className="bg-white/80 rounded-2xl px-5 py-3.5 flex items-center justify-between border border-[#BBDFF2] flex-1">
              <span className="text-base font-black tracking-widest text-[#245361]">{referralCode}</span>
              <button onClick={handleCopyLink} className="text-[#2D79A8] hover:text-[#245361] transition">
                <Copy className="h-5 w-5" />
              </button>
            </div>
            <button
              onClick={handleShareWhatsApp}
              className="py-3.5 px-6 rounded-2xl sun-gradient text-sm font-black text-white shadow-md flex items-center justify-center gap-2"
            >
              <Share2 className="h-4 w-4" /> Share link
            </button>
          </div>
        </motion.div>

        {/* Campaign Metrics / Rules */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="clay-card p-6 flex flex-col justify-between"
        >
          <div className="space-y-4">
            <h3 className="text-lg font-black text-[#245361] flex items-center gap-2">
              <AwardIcon className="h-5 w-5 text-[#2D79A8]" />
              Referral Reward Rules
            </h3>
            <ol className="list-decimal pl-4.5 space-y-2.5 text-sm font-semibold text-slate-800">
              <li>Share your unique referral link or code.</li>
              <li>Friends sign up using your code.</li>
              <li>Once they purchase any Quick Pack recharge, the bonus jars automatically credit to both accounts.</li>
            </ol>
          </div>
          <div className="bg-[#BBDFF2]/20 border border-[#BBDFF2]/40 rounded-2xl p-4 mt-4 text-center">
            <p className="text-sm font-black text-[#245361]">Active referrals multiplier is active! Get double rewards.</p>
          </div>
        </motion.div>
      </div>

      {/* 3. Referrals List */}
      <motion.section
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="clay-card p-6"
      >
        <div className="flex items-center gap-3 border-b border-border pb-4 mb-4">
          <Users className="h-6 w-6 text-[#2D79A8]" />
          <h2 className="text-xl font-black text-[#245361]">Referred Friends</h2>
        </div>

        <div className="divide-y divide-border/60">
          {referredFriends.map((friend) => (
            <div key={friend.id} className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${friend.status === 'REWARDED' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                  {friend.status === 'REWARDED' ? <CheckCircle className="h-5 w-5" /> : <Users className="h-5 w-5" />}
                </span>
                <div>
                  <p className="text-base font-black text-[#245361]">{friend.name}</p>
                  <p className="text-xs font-semibold text-slate-700 mt-0.5">Joined on {new Date(friend.joinedAt).toLocaleDateString()}</p>
                </div>
              </div>
              <div>
                <span className={`rounded-full border px-3.5 py-1 text-xs font-black uppercase tracking-wider ${
                  friend.status === 'REWARDED' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'
                }`}>
                  {friend.status.toLowerCase()}
                </span>
              </div>
            </div>
          ))}
          {referredFriends.length === 0 && (
            <p className="text-center text-sm font-semibold text-slate-700 py-6">No referrals recorded yet.</p>
          )}
        </div>
      </motion.section>

    </div>
  );
}
