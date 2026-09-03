import { 
  X, 
  Phone, 
  Mail, 
  Shield, 
  Calendar, 
  Edit3, 
  Hash, 
  Truck,
  Coins
} from 'lucide-react';
import type { UserRecord } from './UserFormModal';

interface UserDetailModalProps {
  user: any | null;
  onClose: () => void;
  onEdit: (user: UserRecord) => void;
  onEditPrice?: (user: any) => void;
}

export default function UserDetailModal({
  user,
  onClose,
  onEdit,
  onEditPrice,
}: UserDetailModalProps) {
  if (!user) return null;

  const firstName = user.firstName || 'Staff';
  const lastName = user.lastName || 'User';
  const fullName = `${firstName} ${lastName}`.trim();
  const initials = `${firstName[0] || 'U'}${lastName[0] || ''}`.toUpperCase();
  const userId = user.id ? `#USR-${user.id.slice(0, 8).toUpperCase()}` : '#USR-00000';
  const phone = user.phone || '—';
  const email = user.email || '—';
  const role = user.role || 'STAFF';
  const isActive = user.isActive !== false;
  const isDeliveryPartner = role === 'DELIVERY_PARTNER';
  const rawJarPrice = user.deliveryPartner?.jarUnitPrice ?? user.jarUnitPrice ?? 0;
  const hasJarPrice = Number(rawJarPrice) > 0;
  const jarUnitPrice = hasJarPrice ? Number(rawJarPrice).toFixed(2) : '0.00';
  const joinedDate = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-IN', {
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
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-gray-100 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95">
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
                  {isDeliveryPartner ? <Truck className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
                  <span>{role.replace('_', ' ')}</span>
                </span>
              </div>
              <p className="text-xs font-mono text-[#64748B] mt-0.5">{userId}</p>
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
          {/* Account Status */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Access Status</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                {isActive ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Active Account</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-600">
                    <span className="h-2 w-2 rounded-full bg-rose-500"></span>
                    <span>Deactivated</span>
                  </span>
                )}
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Role Type</span>
              <span className="text-xs font-bold text-[#16324F] mt-0.5 block">{role}</span>
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

          {/* Delivery Partner Summary (Vehicle & Performance) */}
          {isDeliveryPartner && user.deliveryPartner && (
            <div className="p-3.5 bg-blue-50/40 rounded-xl border border-blue-100/80 space-y-2 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-[#1677C8]">
                <Truck className="w-4 h-4" />
                <span>Delivery Partner Operational Summary</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#64748B]">Vehicle:</span>
                <span className="font-bold text-[#16324F]">{user.deliveryPartner.vehicleType}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#64748B]">Registration Plate:</span>
                <span className="font-mono font-semibold text-[#16324F]">{user.deliveryPartner.vehiclePlate || '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#64748B]">Total Completed:</span>
                <span className="font-bold text-emerald-700">{user.deliveryPartner.completedDeliveries ?? 0} deliveries</span>
              </div>
            </div>
          )}

          {/* Delivery Partner Jar Unit Price Section */}
          {isDeliveryPartner && (
            <div className="p-4 bg-gradient-to-r from-blue-50/80 to-slate-50 rounded-2xl border border-blue-100/90 flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                  <Coins className="w-3.5 h-3.5 text-[#1677C8]" />
                  <span>JAR UNIT PRICE</span>
                </div>
                <div className="flex items-baseline gap-1">
                  {hasJarPrice ? (
                    <>
                      <span className="text-xl font-black text-[#16324F] tracking-tight">
                        ₹{jarUnitPrice}
                      </span>
                      <span className="text-xs font-semibold text-[#64748B]">/ jar</span>
                    </>
                  ) : (
                    <span className="text-sm font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                      Not Set
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[#64748B]">
                  Amount assigned by Edrops per jar for this delivery partner.
                </p>
              </div>

              {onEditPrice && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onEditPrice(user);
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-blue-50 text-[#1677C8] border border-blue-200 rounded-xl text-xs font-bold shadow-2xs transition cursor-pointer shrink-0 ml-3"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>{hasJarPrice ? 'Edit Price' : 'Set Price'}</span>
                </button>
              )}
            </div>
          )}

          {/* Metadata */}
          <div className="flex items-center justify-between text-[11px] text-[#64748B] px-1 pt-1">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>Created on {joinedDate}</span>
            </span>
            <span className="flex items-center gap-1">
              <Hash className="w-3.5 h-3.5" />
              <span>ID: {user.id?.slice(0, 8)}</span>
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
              onEdit(user);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#1677C8] hover:bg-[#1362a4] rounded-xl shadow-2xs transition cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit Account</span>
          </button>
        </div>
      </div>
    </div>
  );
}
