import { User } from 'lucide-react';

interface PersonalInformationCardProps {
  profile: any;
  onEditClick: () => void;
}

export default function PersonalInformationCard({ profile, onEditClick }: PersonalInformationCardProps) {
  const isCustomer = profile.role === 'CUSTOMER';

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 sm:p-6 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#1677C8]/10 text-[#1677C8]">
            <User className="w-4 h-4" />
          </div>
          <h2 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wider">
            Personal Information
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* First Name */}
        <div className="space-y-1">
          <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">
            First Name
          </p>
          <p className="text-sm font-semibold text-slate-800">
            {profile.firstName || <span className="text-slate-400 font-normal">Not set</span>}
          </p>
        </div>

        {/* Last Name */}
        <div className="space-y-1">
          <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Last Name
          </p>
          <p className="text-sm font-semibold text-slate-800">
            {profile.lastName || <span className="text-slate-400 font-normal">Not set</span>}
          </p>
        </div>

        {/* Email Address */}
        <div className="space-y-1">
          <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Email Address
          </p>
          <p className="text-sm font-semibold text-slate-800 truncate" title={profile.email}>
            {profile.email || <span className="text-slate-400 font-normal">Not set</span>}
          </p>
        </div>

        {/* Phone Number */}
        <div className="space-y-1">
          <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Phone Number
          </p>
          <p className="text-sm font-semibold font-mono text-slate-800">
            {profile.phone || <span className="text-slate-400 font-normal font-sans">Not set</span>}
          </p>
        </div>

        {/* Customer Specific Fields */}
        {isCustomer && (
          <>
            <div className="space-y-1">
              <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Customer Type
              </p>
              <p className="text-sm font-semibold text-slate-800 capitalize">
                {(profile.customer?.customerType || 'Residential').toLowerCase()}
              </p>
            </div>

            {profile.customer?.companyName && (
              <div className="space-y-1">
                <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Company Name
                </p>
                <p className="text-sm font-semibold text-slate-800">
                  {profile.customer.companyName}
                </p>
              </div>
            )}

            {profile.customer?.gstNumber && (
              <div className="space-y-1">
                <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  GSTIN
                </p>
                <p className="text-sm font-semibold font-mono text-slate-800">
                  {profile.customer.gstNumber}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
