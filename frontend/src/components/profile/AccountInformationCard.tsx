import { Calendar, Clock, ShieldCheck, Wallet, Tag } from 'lucide-react';
import { Link } from 'react-router-dom';

interface AccountInformationCardProps {
  profile: any;
}

export default function AccountInformationCard({ profile }: AccountInformationCardProps) {
  const formatDate = (isoString?: string) => {
    if (!isoString) return '—';
    try {
      const date = new Date(isoString);
      return new Intl.DateTimeFormat('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(date);
    } catch {
      return isoString;
    }
  };

  const isCustomer = profile.role === 'CUSTOMER';
  const isDistributor = profile.role === 'DISTRIBUTOR';
  const walletBalance = profile.customer?.wallet?.balance ?? null;
  const jarsHeld = profile.customer?.jarBalances?.[0]?.availableJars ?? profile.customer?.jarsAtCustomer ?? null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 sm:p-6 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#1677C8]/10 text-[#1677C8]">
            <Clock className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
            Account Information
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
        {/* Account Created */}
        <div className="space-y-0.5">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Account Created
          </span>
          <span className="font-semibold text-slate-700 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            {formatDate(profile.createdAt)}
          </span>
        </div>

        {/* Last Updated */}
        <div className="space-y-0.5">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Last Updated
          </span>
          <span className="font-semibold text-slate-700 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            {formatDate(profile.updatedAt)}
          </span>
        </div>

        {/* Account Status */}
        <div className="space-y-0.5">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Account Status
          </span>
          <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
            <ShieldCheck className="w-3.5 h-3.5" />
            {profile.accountStatus || 'Active'}
          </span>
        </div>

        {/* Role */}
        <div className="space-y-0.5">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Assigned Role
          </span>
          <span className="font-semibold text-slate-700 uppercase">
            {(profile.role || 'USER').replace(/_/g, ' ')}
          </span>
        </div>
      </div>

      {/* Role-Specific Compact Quick Summaries */}
      {(isCustomer || isDistributor) && (
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-4 text-xs">
          {/* Customer Wallet Summary */}
          {isCustomer && walletBalance !== null && (
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/60">
              <Wallet className="w-4 h-4 text-[#1677C8]" />
              <span className="text-slate-500 font-medium">Wallet:</span>
              <span className="font-bold text-slate-800">₹{Number(walletBalance).toFixed(2)}</span>
              <Link
                to="/customer/wallet"
                className="text-[11px] font-bold text-[#1677C8] hover:underline ml-1"
              >
                View Wallet
              </Link>
            </div>
          )}

          {/* Customer Jars Held Summary */}
          {isCustomer && jarsHeld !== null && (
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/60">
              <span className="text-slate-500 font-medium">Jars on Deposit:</span>
              <span className="font-bold text-slate-800">{jarsHeld}</span>
            </div>
          )}

          {/* Referral Code (Customer / Distributor) */}
          {(profile.customer?.referralCode || profile.distributor?.referralCode) && (
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/60 font-mono">
              <Tag className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-500 font-sans font-medium text-[11px]">Referral Code:</span>
              <span className="font-bold text-slate-800">
                {profile.distributor?.referralCode || profile.customer?.referralCode}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
