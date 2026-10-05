import { Truck, IndianRupee, CheckCircle2 } from 'lucide-react';

interface DeliveryPartnerCardProps {
  profile: any;
}

export default function DeliveryPartnerCard({ profile }: DeliveryPartnerCardProps) {
  const partner = profile.deliveryPartner || {};

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 sm:p-6 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#1677C8]/10 text-[#1677C8]">
            <Truck className="w-4 h-4" />
          </div>
          <h2 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wider">
            Delivery Operations
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
        <div className="space-y-1">
          <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Assigned Vehicle
          </p>
          <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
            <Truck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>
              {partner.vehicleType ? (
                <>
                  {partner.vehicleType}
                  {partner.vehiclePlate && (
                    <span className="ml-1 text-xs font-mono text-slate-500">
                      ({partner.vehiclePlate})
                    </span>
                  )}
                </>
              ) : (
                <span className="text-slate-400 font-normal">None Assigned</span>
              )}
            </span>
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Jar Delivery Commission / Rate
          </p>
          <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
            <IndianRupee className="w-3.5 h-3.5 text-[#1677C8] shrink-0" />
            <span>
              {partner.jarUnitPrice !== undefined && partner.jarUnitPrice !== null
                ? `₹${Number(partner.jarUnitPrice).toFixed(2)} per jar`
                : <span className="text-slate-400 font-normal">Standard rate</span>}
            </span>
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Fulfillment Status
          </p>
          <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Active Partner</span>
          </div>
        </div>
      </div>
    </div>
  );
}
