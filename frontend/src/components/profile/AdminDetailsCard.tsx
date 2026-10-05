import { Shield, KeyRound, Server } from 'lucide-react';

interface AdminDetailsCardProps {
  profile: any;
}

export default function AdminDetailsCard({ profile }: AdminDetailsCardProps) {
  const admin = profile.admin || {};
  const level = admin.level || 'Super Admin';

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 sm:p-6 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#1677C8]/10 text-[#1677C8]">
            <Shield className="w-4 h-4" />
          </div>
          <h2 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wider">
            System Administration & Security
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
        <div className="space-y-1">
          <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Administrative Level
          </p>
          <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
            <KeyRound className="w-3.5 h-3.5 text-[#1677C8] shrink-0" />
            <span>{level}</span>
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">
            System Access
          </p>
          <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
            <Server className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Full System & Financial Controls</span>
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Permissions
          </p>
          <p className="text-sm font-semibold text-slate-700">
            Read / Write / Delete / POS
          </p>
        </div>
      </div>
    </div>
  );
}
