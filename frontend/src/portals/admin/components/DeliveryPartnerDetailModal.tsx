import { 
  X, 
  Truck, 
  Phone, 
  Mail, 
  Calendar, 
  Edit3, 
  Hash, 
  Activity,
  Coins
} from 'lucide-react';
import type { UserRecord } from './UserFormModal';

interface DeliveryPartnerDetailModalProps {
  partner: any | null;
  onClose: () => void;
  onEdit: (partner: UserRecord) => void;
  onEditPrice?: (partner: any) => void;
}

export default function DeliveryPartnerDetailModal({
  partner,
  onClose,
  onEdit,
  onEditPrice,
}: DeliveryPartnerDetailModalProps) {
  if (!partner) return null;

  const firstName = partner.firstName || 'Delivery';
  const lastName = partner.lastName || 'Partner';
  const fullName = `${firstName} ${lastName}`.trim();
  const initials = `${firstName[0] || 'D'}${lastName[0] || 'P'}`.toUpperCase();
  const partnerId = partner.id ? `DP-${partner.id.slice(0, 8).toUpperCase()}` : 'DP-00000';
  const phone = partner.phone || '—';
  const email = partner.email || '—';
  const isActive = partner.isActive !== false;
  const vehicleType = partner.deliveryPartner?.vehicleType || 'Standard Vehicle';
  const vehiclePlate = partner.deliveryPartner?.vehiclePlate || '—';
  const rawJarPrice = partner.deliveryPartner?.jarUnitPrice ?? partner.jarUnitPrice ?? 0;
  const jarUnitPrice = Number(rawJarPrice).toFixed(2);
  const totalDeliveries = partner.deliveryPartner?.totalDeliveries ?? 0;
  const completedDeliveries = partner.deliveryPartner?.completedDeliveries ?? 0;
  const todayDeliveries = partner.deliveryPartner?.todayDeliveries ?? 0;
  const joinedDate = partner.createdAt
    ? new Date(partner.createdAt).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '—';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-gray-100 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95">
        {/* Header Hero */}
        <div className="p-5 border-b border-gray-100 bg-slate-50/80 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-[#1677C8]/15 to-[#1677C8]/5 text-[#1677C8] border border-[#1677C8]/20 flex items-center justify-center font-bold text-base shadow-xs shrink-0">
              {initials}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-[#16324F]">{fullName}</h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-50 text-[#1677C8] border border-blue-100">
                  <Truck className="w-3 h-3" />
                  <span>Partner</span>
                </span>
              </div>
              <p className="text-xs font-mono text-[#64748B] mt-0.5">{partnerId}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-200/60 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Operational Metrics Grid */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 text-center space-y-0.5">
              <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Today</span>
              <p className="text-lg font-black text-[#1677C8]">{todayDeliveries}</p>
              <span className="text-[10px] text-[#64748B]">deliveries</span>
            </div>
            <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100 text-center space-y-0.5">
              <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Completed</span>
              <p className="text-lg font-black text-emerald-700">{completedDeliveries}</p>
              <span className="text-[10px] text-[#64748B]">successful</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center space-y-0.5">
              <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Total</span>
              <p className="text-lg font-black text-[#16324F]">{totalDeliveries}</p>
              <span className="text-[10px] text-[#64748B]">all time</span>
            </div>
          </div>

          {/* Compensation / Jar Rate Card */}
          <div className="p-4 bg-gradient-to-r from-blue-50/80 to-slate-50 rounded-2xl border border-blue-100/90 flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                <Coins className="w-3.5 h-3.5 text-[#1677C8]" />
                <span>COMPENSATION / JAR RATE</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-black text-[#16324F] tracking-tight">
                  ₹{jarUnitPrice}
                </span>
                <span className="text-xs font-semibold text-[#64748B]">/ jar</span>
              </div>
              <p className="text-[11px] text-[#64748B]">
                Amount assigned by Edrops for each jar handled by this delivery partner.
              </p>
            </div>

            {onEditPrice && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEditPrice(partner);
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-blue-50 text-[#1677C8] border border-blue-200 rounded-xl text-xs font-bold shadow-2xs transition cursor-pointer shrink-0 ml-3"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Price</span>
              </button>
            )}
          </div>

          {/* Operational Status */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Account Status</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                {isActive ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Active Account</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-600">
                    <span className="h-2 w-2 rounded-full bg-rose-500"></span>
                    <span>Inactive / Suspended</span>
                  </span>
                )}
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Availability</span>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 mt-0.5">
                <Activity className="w-3.5 h-3.5" />
                <span>Online</span>
              </span>
            </div>
          </div>

          {/* Contact Details */}
          <div className="space-y-1.5">
            <h4 className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider px-1">Contact Info</h4>
            <div className="p-3.5 bg-white border border-[#E2E8F0] rounded-xl space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#64748B]">Phone:</span>
                <div className="flex items-center gap-1.5 font-bold text-[#16324F]">
                  <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <a href={`tel:${phone}`} className="hover:underline">{phone}</a>
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <span className="text-[#64748B]">Email:</span>
                <div className="flex items-center gap-1.5 font-medium text-[#16324F]">
                  <Mail className="w-3.5 h-3.5 text-[#1677C8] shrink-0" />
                  <a href={`mailto:${email}`} className="hover:underline truncate max-w-[200px]">{email}</a>
                </div>
              </div>
            </div>
          </div>

          {/* Vehicle Information */}
          <div className="space-y-1.5">
            <h4 className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider px-1">Assigned Vehicle</h4>
            <div className="p-3.5 bg-white border border-[#E2E8F0] rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-slate-100 rounded-lg text-[#16324F]">
                  <Truck className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-[#16324F]">{vehicleType}</p>
                  <p className="text-[11px] text-[#64748B]">Delivery Fleet</p>
                </div>
              </div>
              <div className="text-right font-mono font-bold text-xs bg-slate-100 px-2.5 py-1 rounded-lg text-[#16324F]">
                {vehiclePlate}
              </div>
            </div>
          </div>

          {/* Metadata */}
          <div className="flex items-center justify-between text-[11px] text-[#64748B] px-1 pt-1">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>Joined on {joinedDate}</span>
            </span>
            <span className="flex items-center gap-1">
              <Hash className="w-3.5 h-3.5" />
              <span>UUID: {partner.id?.slice(0, 13)}...</span>
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-100 flex items-center justify-end gap-2.5 bg-slate-50/50 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:text-[#16324F] bg-white border border-[#E2E8F0] rounded-xl hover:bg-gray-50 transition cursor-pointer"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onEdit(partner);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#1677C8] hover:bg-[#1362a4] rounded-xl shadow-2xs transition cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit Profile</span>
          </button>
        </div>
      </div>
    </div>
  );
}
