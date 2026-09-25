import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Building2,
  Phone,
  Mail,
  MapPin,
  Tag,
  Copy,
  Check,
  Truck,
  Edit2,
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface DistributorDetailDrawerProps {
  isOpen: boolean;
  distributor: any | null;
  onClose: () => void;
  onEdit: (distributor: any) => void;
  onToggleStatus: (distributor: any) => void;
}

export default function DistributorDetailDrawer({
  isOpen,
  distributor,
  onClose,
  onEdit,
  onToggleStatus,
}: DistributorDetailDrawerProps) {
  const [copiedCode, setCopiedCode] = useState(false);

  if (!isOpen || !distributor) return null;

  const handleCopyReferral = () => {
    if (distributor.referralCode) {
      navigator.clipboard.writeText(distributor.referralCode);
      setCopiedCode(true);
      toast.success(`Distributor code ${distributor.referralCode} copied!`);
      setTimeout(() => setCopiedCode(false), 2500);
    }
  };

  const isActive = distributor.isActive !== false;
  const fullName = distributor.fullName || `${distributor.firstName || ''} ${distributor.lastName || ''}`.trim() || 'Distributor';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-hidden">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        />

        {/* Modal / Drawer Wrapper - Full width on mobile, right-aligned drawer on tablet/desktop */}
        <div className="fixed inset-y-0 right-0 w-full max-w-full sm:max-w-none flex justify-end sm:pl-10 pointer-events-none">
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 220 }}
            className="w-full sm:w-[560px] md:w-[620px] max-w-full sm:max-w-[90vw] bg-white sm:border-l border-[#E2E8F0] shadow-2xl flex flex-col h-full rounded-none sm:rounded-l-2xl pointer-events-auto overflow-hidden"
          >
            {/* ─── COMPACT DRAWER HEADER ──────────────────────── */}
            <div className="p-4 sm:p-5 bg-slate-50/90 border-b border-[#E2E8F0] flex items-center justify-between shrink-0 gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-[#1677C8] text-white flex items-center justify-center font-bold text-base shadow-sm shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base sm:text-lg font-bold text-[#16324F] truncate">{fullName}</h2>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold shrink-0 ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-red-50 text-red-700 border border-red-200'
                      }`}
                    >
                      {isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-[#64748B] truncate mt-0.5">
                    {distributor.agencyName || 'Independent Distributor'}
                  </p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="p-2 text-[#64748B] hover:text-[#16324F] hover:bg-slate-200 rounded-xl transition cursor-pointer shrink-0"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* ─── DRAWER SCROLLABLE CONTENT ─────────────────── */}
            <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 space-y-3.5 sm:space-y-4">
              
              {/* ─── STAFF-ASSIGNED REFERRAL CODE ────────────── */}
              <div className="bg-gradient-to-br from-sky-50 to-blue-50/80 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-sky-200/80 shadow-xs relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-[#1677C8] text-white rounded-lg">
                      <Tag className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#1677C8]">
                      Staff-Assigned Referral Code
                    </span>
                  </div>
                  <span className="text-[10px] font-semibold text-sky-700 bg-sky-100/60 px-2 py-0.5 rounded-full">
                    Official Code
                  </span>
                </div>

                <div className="mt-2.5 flex items-center justify-between bg-white p-3 rounded-xl border border-sky-100 shadow-2xs">
                  <div>
                    <span className="text-[11px] text-[#64748B] block font-medium">Distributor Code</span>
                    <span className="text-xl sm:text-2xl font-mono font-extrabold text-[#16324F] tracking-wider block mt-0.5">
                      {distributor.referralCode || 'NOT_ASSIGNED'}
                    </span>
                  </div>
                  {distributor.referralCode && (
                    <button
                      onClick={handleCopyReferral}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-[#1677C8] rounded-xl text-xs font-bold transition border border-sky-200 cursor-pointer"
                    >
                      {copiedCode ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Code</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-1 text-[11px] text-[#64748B]">
                  <span>
                    Created by: <strong className="text-[#16324F]">{distributor.createdBy?.name || 'Staff Admin'}</strong>
                  </span>
                  <span>
                    Assigned:{' '}
                    <strong className="text-[#16324F]">
                      {distributor.createdAt
                        ? new Date(distributor.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                        : '—'}
                    </strong>
                  </span>
                </div>
              </div>

              {/* ─── DISTRIBUTOR CONTACT & PROFILE ────────────── */}
              <div className="bg-slate-50/80 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/80 space-y-3">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                  Distributor Contact & Profile
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5 text-xs">
                  <div>
                    <span className="text-[#94A3B8] font-medium block">Phone</span>
                    <span className="text-[#16324F] font-bold mt-1 block flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-[#1677C8] shrink-0" />
                      {distributor.phone || '—'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[#94A3B8] font-medium block">Email Address</span>
                    <span className="text-[#16324F] font-bold mt-1 block flex items-start gap-1.5 break-all">
                      <Mail className="w-3.5 h-3.5 text-[#1677C8] shrink-0 mt-0.5" />
                      {distributor.email || 'No email registered'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[#94A3B8] font-medium block">Agency / Business Name</span>
                    <span className="text-[#16324F] font-bold mt-1 block">
                      {distributor.agencyName || 'Independent Distributor'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[#94A3B8] font-medium block">Operational Status</span>
                    <span className="mt-1 block">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          isActive
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        {isActive ? 'Authorized & Active' : 'Deactivated / On Hold'}
                      </span>
                    </span>
                  </div>

                  <div className="sm:col-span-2">
                    <span className="text-[#94A3B8] font-medium block">Operating Address</span>
                    <span className="text-[#16324F] font-semibold mt-1 block flex items-start gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#1677C8] shrink-0 mt-0.5" />
                      {distributor.address || 'No physical address specified'}
                    </span>
                  </div>
                </div>
              </div>

              {/* ─── OPERATIONS & LOGISTICS ───────────────────── */}
              <div className="bg-slate-50/80 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/80 space-y-3">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                  Operational Information
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <span className="text-[#94A3B8] font-medium block text-[11px]">Assigned Route</span>
                    <span className="text-[#16324F] font-bold text-xs mt-1 block flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-[#1677C8] shrink-0" />
                      {distributor.routeOrArea || 'No route assigned'}
                    </span>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <span className="text-[#94A3B8] font-medium block text-[11px]">Vehicle Details</span>
                    <span className="text-[#16324F] font-bold text-xs mt-1 block flex items-center gap-1">
                      <Truck className="w-3.5 h-3.5 text-[#1677C8] shrink-0" />
                      {distributor.vehiclePlate ? `${distributor.vehiclePlate} (${distributor.vehicleType || 'Vehicle'})` : 'No vehicle assigned'}
                    </span>
                  </div>
                </div>

                {/* Jar Breakdown */}
                <div>
                  <span className="text-[11px] font-semibold text-[#64748B] block mb-1.5">
                    Jar Ownership & Allocation
                  </span>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-[#94A3B8] block">Ownership</span>
                      <span className="text-xs font-bold text-[#16324F] mt-0.5 block truncate">
                        {distributor.jarOwnership === 'DISTRIBUTOR_OWNED'
                          ? 'Distributor'
                          : distributor.jarOwnership === 'MIXED'
                          ? 'Mixed'
                          : 'Company'}
                      </span>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-[#94A3B8] block">Company Jars</span>
                      <span className="text-sm sm:text-base font-extrabold text-[#1677C8] mt-0.5 block">
                        {distributor.companyOwnedJars ?? 0}
                      </span>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-[#94A3B8] block">Partner Jars</span>
                      <span className="text-sm sm:text-base font-extrabold text-purple-600 mt-0.5 block">
                        {distributor.distributorOwnedJars ?? 0}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Service Pincodes */}
                {distributor.servicePincodes && distributor.servicePincodes.length > 0 && (
                  <div>
                    <span className="text-[11px] font-semibold text-[#64748B] block mb-1.5">
                      Covered Service Pincodes ({distributor.servicePincodes.length})
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {distributor.servicePincodes.map((pin: any) => (
                        <span
                          key={pin.id || pin.pincode}
                          className="px-2 py-0.5 bg-white border border-slate-200 rounded-lg text-[11px] font-mono font-bold text-[#16324F]"
                        >
                          {pin.pincode} {pin.location ? `(${pin.location})` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ─── RECENT ASSIGNMENTS / DELIVERIES ───────────── */}
              {distributor.recentAssignments && distributor.recentAssignments.length > 0 ? (
                <div className="space-y-2.5">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                    Recent Order Assignments
                  </h3>
                  <div className="space-y-1.5 max-h-[220px] overflow-y-auto">
                    {distributor.recentAssignments.map((a: any) => (
                      <div
                        key={a.id}
                        className="bg-slate-50 p-2.5 sm:p-3 rounded-xl border border-slate-200 flex justify-between items-center text-xs"
                      >
                        <div>
                          <p className="text-[#16324F] font-bold">
                            Order #{a.order?.orderNumber || (a.order?.id ? a.order.id.slice(0, 8).toUpperCase() : 'ORD')}
                          </p>
                          <p className="text-[#94A3B8] text-[11px] mt-0.5">
                            {new Date(a.acceptedAt || a.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              a.status === 'COMPLETED'
                                ? 'bg-emerald-50 text-emerald-700'
                                : a.status === 'ACCEPTED'
                                ? 'bg-sky-50 text-[#1677C8]'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {a.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-center text-xs text-[#94A3B8]">
                  No order delivery assignments recorded yet.
                </div>
              )}
            </div>

            {/* ─── DRAWER ACTIONS FOOTER (STICKY) ───────────── */}
            <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-[#E2E8F0] shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              <button
                onClick={() => onToggleStatus(distributor)}
                className={`w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer border text-center ${
                  isActive
                    ? 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200'
                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                }`}
              >
                {isActive ? 'Deactivate Account' : 'Activate Account'}
              </button>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={onClose}
                  className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs font-bold text-[#64748B] hover:bg-slate-200 transition cursor-pointer text-center"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    onClose();
                    onEdit(distributor);
                  }}
                  className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl text-xs font-bold bg-[#1677C8] hover:bg-[#1363a8] text-white shadow-md transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Edit Profile
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
}
