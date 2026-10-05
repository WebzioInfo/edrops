import { Building2, Truck, BadgeCheck } from 'lucide-react';

interface StaffEmployeeCardProps {
  profile: any;
}

export default function StaffEmployeeCard({ profile }: StaffEmployeeCardProps) {
  const staff = profile.staff || {};

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 sm:p-6 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#1677C8]/10 text-[#1677C8]">
            <Building2 className="w-4 h-4" />
          </div>
          <h2 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wider">
            Employee & Operations
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {/* Branch / Operating Center */}
        <div className="space-y-1">
          <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Operating Branch
          </p>
          <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>
              {staff.branch ? (
                <>
                  {staff.branch.name}
                  {staff.branch.location && (
                    <span className="text-slate-500 font-normal ml-1">
                      ({staff.branch.location})
                    </span>
                  )}
                </>
              ) : (
                'Main Operations'
              )}
            </span>
          </div>
        </div>

        {/* Assigned Vehicle */}
        <div className="space-y-1">
          <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Assigned Vehicle
          </p>
          <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
            <Truck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>
              {staff.vehicleType ? (
                <>
                  {staff.vehicleType}
                  {staff.vehiclePlate && (
                    <span className="ml-1 text-xs font-mono text-slate-500">
                      ({staff.vehiclePlate})
                    </span>
                  )}
                </>
              ) : (
                <span className="text-slate-400 font-normal">None Assigned</span>
              )}
            </span>
          </div>
        </div>

        {/* Operational Access */}
        <div className="space-y-1">
          <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Operational Access
          </p>
          <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
            <BadgeCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Staff Portal Verified</span>
          </div>
        </div>
      </div>
    </div>
  );
}
