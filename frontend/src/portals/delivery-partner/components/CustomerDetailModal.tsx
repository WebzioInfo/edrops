import { 
  X, 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Navigation, 
  Building2, 
  Edit,
  Package,
} from 'lucide-react';
import type { CustomerRecord } from './CustomerFormModal';

interface CustomerDetailModalProps {
  customer: CustomerRecord | null;
  onClose: () => void;
  onEdit: (customer: CustomerRecord) => void;
}

export default function CustomerDetailModal({
  customer,
  onClose,
  onEdit,
}: CustomerDetailModalProps) {
  if (!customer) return null;

  const defaultAddr = customer.addresses?.find((a) => a.isDefault) || customer.addresses?.[0];
  const fullAddress = [
    defaultAddr?.houseName,
    defaultAddr?.buildingName,
    defaultAddr?.street,
    defaultAddr?.area,
    defaultAddr?.city,
    defaultAddr?.district,
    defaultAddr?.state,
    defaultAddr?.zipCode,
  ]
    .filter(Boolean)
    .join(', ');

  const googleMapsUrl =
    defaultAddr?.googleMapsUrl ||
    (defaultAddr?.latitude && defaultAddr?.longitude
      ? `https://www.google.com/maps/search/?api=1&query=${defaultAddr.latitude},${defaultAddr.longitude}`
      : fullAddress
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`
      : null);

  const customerName = `${customer.user?.firstName || ''} ${customer.user?.lastName || ''}`.trim() || customer.companyName || 'Valued Customer';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1677C8]/10 text-[#1677C8]">
              {customer.customerType === 'COMMERCIAL' || customer.customerType === 'OFFICE' ? (
                <Building2 className="w-5 h-5" />
              ) : (
                <User className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="text-base font-bold text-[#16324F]">{customerName}</h3>
              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-gray-100 text-[#64748B]">
                {customer.customerType}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Contact Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 bg-slate-50 border border-gray-100 rounded-xl space-y-1">
              <span className="text-[11px] font-semibold text-[#64748B] flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-[#1677C8]" />
                <span>Phone Number</span>
              </span>
              <p className="text-sm font-bold text-[#16324F]">{customer.user?.phone || 'Not provided'}</p>
            </div>

            <div className="p-3 bg-slate-50 border border-gray-100 rounded-xl space-y-1">
              <span className="text-[11px] font-semibold text-[#64748B] flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-[#1677C8]" />
                <span>Email Address</span>
              </span>
              <p className="text-sm font-medium text-[#16324F] truncate">{customer.user?.email || 'Not provided'}</p>
            </div>
          </div>

          {/* Company Details if applicable */}
          {customer.companyName && (
            <div className="p-3 bg-slate-50 border border-gray-100 rounded-xl space-y-1">
              <span className="text-[11px] font-semibold text-[#64748B] flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-[#1677C8]" />
                <span>Company / Business Name</span>
              </span>
              <p className="text-sm font-bold text-[#16324F]">{customer.companyName}</p>
              {customer.gstNumber && (
                <p className="text-xs text-[#64748B]">GST: {customer.gstNumber}</p>
              )}
            </div>
          )}

          {/* Customer Jar Holding Operational Balance */}
          <div className="p-3.5 bg-blue-50/50 border border-blue-200/80 rounded-xl space-y-1">
            <span className="text-[10px] font-bold text-[#1677C8] uppercase tracking-wider flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-[#1677C8]" />
              <span>Jars at Customer</span>
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-extrabold text-[#16324F]">
                {customer.jars_at_customer !== undefined
                  ? customer.jars_at_customer
                  : customer.jarsAtCustomer !== undefined
                  ? customer.jarsAtCustomer
                  : 0}
              </span>
              <span className="text-xs font-semibold text-[#64748B]">jars</span>
            </div>
            <p className="text-[11px] text-[#64748B]">
              Currently with customer
            </p>
          </div>

          {/* Delivery Location & Address */}
          <div className="p-4 bg-blue-50/40 border border-blue-100 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-[#1677C8]">
              <span className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4" />
                <span>Delivery Address & Location</span>
              </span>
              {defaultAddr?.latitude && defaultAddr?.longitude && (
                <span className="text-[10px] font-mono text-[#64748B]">
                  {defaultAddr.latitude.toFixed(4)}, {defaultAddr.longitude.toFixed(4)}
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-[#16324F] font-medium leading-relaxed">
              {fullAddress || 'No address registered on file.'}
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-[#E2E8F0] bg-slate-50">
          <button
            onClick={() => {
              onClose();
              onEdit(customer);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#1677C8] bg-white border border-blue-200 hover:bg-blue-50 rounded-xl transition cursor-pointer"
          >
            <Edit className="w-3.5 h-3.5" />
            <span>Edit Customer</span>
          </button>

          <div className="flex items-center gap-2">
            {customer.user?.phone && (
              <a
                href={`tel:${customer.user.phone}`}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100/80 rounded-xl transition"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Call</span>
              </a>
            )}

            {googleMapsUrl && (
              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1677C8] hover:bg-[#1362a4] rounded-xl shadow-2xs transition"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>Open in Maps</span>
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
