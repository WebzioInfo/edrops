import { Briefcase, Building, MapPin, Truck, Phone, Mail, User } from 'lucide-react';

interface DistributorInformationCardProps {
  profile: any;
  onEditClick: () => void;
}

export default function DistributorInformationCard({
  profile,
  onEditClick,
}: DistributorInformationCardProps) {
  const distributor = profile.distributor || {};

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 sm:p-6 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#1677C8]/10 text-[#1677C8]">
            <Briefcase className="w-4 h-4" />
          </div>
          <h2 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wider">
            Distributor Information
          </h2>
        </div>

        <button
          type="button"
          onClick={onEditClick}
          className="text-xs font-bold text-[#1677C8] hover:text-[#125ea0] hover:underline cursor-pointer"
        >
          Edit
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
        {/* First Name */}
        <div className="space-y-1">
          <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">
            First Name
          </p>
          <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>{profile.firstName || <span className="text-slate-400 font-normal">Not set</span>}</span>
          </div>
        </div>

        {/* Last Name */}
        <div className="space-y-1">
          <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Last Name
          </p>
          <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>{profile.lastName || <span className="text-slate-400 font-normal">Not set</span>}</span>
          </div>
        </div>

        {/* Phone */}
        <div className="space-y-1">
          <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Phone Number
          </p>
          <div className="flex items-center gap-1.5 text-sm font-semibold font-mono text-slate-800">
            <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>{profile.phone || <span className="text-slate-400 font-normal font-sans">Not set</span>}</span>
          </div>
        </div>

        {/* Email */}
        <div className="space-y-1">
          <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Email Address
          </p>
          <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 truncate" title={profile.email}>
            <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">{profile.email || <span className="text-slate-400 font-normal">Not set</span>}</span>
          </div>
        </div>

        {/* Agency Name */}
        <div className="space-y-1">
          <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Agency Name
          </p>
          <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
            <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>{distributor.agencyName || <span className="text-slate-400 font-normal">Not set</span>}</span>
          </div>
        </div>

        {/* Route / Area */}
        <div className="space-y-1">
          <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Route / Area
          </p>
          <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>{distributor.routeOrArea || <span className="text-slate-400 font-normal">Not set</span>}</span>
          </div>
        </div>

        {/* Vehicle Assigned */}
        <div className="space-y-1">
          <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Vehicle Assigned
          </p>
          <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
            <Truck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>
              {distributor.vehicleType ? (
                <>
                  {distributor.vehicleType}
                  {distributor.vehiclePlate && (
                    <span className="ml-1 text-xs font-mono text-slate-500">
                      ({distributor.vehiclePlate})
                    </span>
                  )}
                </>
              ) : (
                <span className="text-slate-400 font-normal">Not assigned</span>
              )}
            </span>
          </div>
        </div>

        {/* Registered Agency Address (if present) */}
        {distributor.address && (
          <div className="space-y-1 sm:col-span-2">
            <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Registered Agency Address
            </p>
            <p className="text-sm font-medium text-slate-700 leading-snug">
              {distributor.address}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
