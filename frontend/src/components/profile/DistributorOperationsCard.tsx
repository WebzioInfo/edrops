import { Layers, MapPin, Package, Tag } from 'lucide-react';

interface DistributorOperationsCardProps {
  profile: any;
}

export default function DistributorOperationsCard({ profile }: DistributorOperationsCardProps) {
  const distributor = profile.distributor || {};
  const pincodes = profile.distributorPincodes || [];
  const companyOwned = Number(distributor.companyOwnedJars) || 0;
  const distributorOwned = Number(distributor.distributorOwnedJars) || 0;
  const totalJars = companyOwned + distributorOwned;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 sm:p-6 space-y-5">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#1677C8]/10 text-[#1677C8]">
            <Layers className="w-4 h-4" />
          </div>
          <h2 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wider">
            Service & Operations
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Service Areas (Assigned Pincodes) */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-[#1677C8]" />
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Assigned Service Areas
            </h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {pincodes.length}
            </span>
          </div>

          {pincodes.length > 0 ? (
            <div className="flex flex-wrap gap-2 pt-0.5">
              {pincodes.map((pin: any) => (
                <div
                  key={pin.id || pin.pincode}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 hover:border-slate-300 transition"
                >
                  <span className="font-mono font-bold text-slate-800">{pin.pincode}</span>
                  {pin.location && (
                    <span className="text-slate-500 font-medium">({pin.location})</span>
                  )}
                  {pin.district && (
                    <span className="text-[11px] text-slate-400 font-normal">· {pin.district}</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic py-1">
              No active service pincodes currently assigned.
            </p>
          )}
        </div>

        {/* Jar Inventory Ownership Breakdown */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5 text-[#1677C8]" />
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Jar Inventory Ownership
            </h3>
          </div>

          <div className="grid grid-cols-3 gap-2.5 pt-0.5">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-center">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Edrops Owned
              </span>
              <span className="text-base sm:text-lg font-bold text-slate-800 font-mono mt-0.5 block">
                {companyOwned}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-center">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Agency Owned
              </span>
              <span className="text-base sm:text-lg font-bold text-slate-800 font-mono mt-0.5 block">
                {distributorOwned}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#1677C8]/5 border border-[#1677C8]/20 text-center">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-[#1677C8]">
                Total Managed
              </span>
              <span className="text-base sm:text-lg font-bold text-[#1677C8] font-mono mt-0.5 block">
                {totalJars}
              </span>
            </div>
          </div>

          {/* Referral Code */}
          {distributor.referralCode && (
            <div className="flex items-center gap-2 pt-2 text-xs">
              <Tag className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-500 font-medium">Distributor Referral Code:</span>
              <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                {distributor.referralCode}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
