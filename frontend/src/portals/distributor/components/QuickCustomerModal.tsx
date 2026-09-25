import { useState } from 'react';
import {
  X,
  UserPlus,
  Lock,
  Phone,
  Mail,
  MapPin,
  Building2,
  Tag,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';
import { toast } from 'react-hot-toast';

interface QuickCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  referralCode?: string | null;
  distributorName?: string | null;
}

export default function QuickCustomerModal({
  isOpen,
  onClose,
  referralCode,
  distributorName,
}: QuickCustomerModalProps) {
  // Form fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [customerType, setCustomerType] = useState('RESIDENTIAL');
  const [companyName, setCompanyName] = useState('');

  // Address fields
  const [houseOrFlat, setHouseOrFlat] = useState('');
  const [street, setStreet] = useState('');
  const [area, setArea] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [state, setState] = useState('Kerala');
  const [pincode, setPincode] = useState('');

  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const hasValidReferral = Boolean(referralCode && referralCode !== 'NOT_ASSIGNED');

  const resetForm = () => {
    setFirstName('');
    setLastName('');
    setPhone('');
    setEmail('');
    setCustomerType('RESIDENTIAL');
    setCompanyName('');
    setHouseOrFlat('');
    setStreet('');
    setArea('');
    setCity('');
    setDistrict('');
    setState('Kerala');
    setPincode('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!hasValidReferral) {
      toast.error('Cannot onboard customer without an assigned distributor referral code.');
      return;
    }

    if (!firstName.trim() || !lastName.trim() || !phone.trim()) {
      toast.error('First Name, Last Name, and Phone Number are required.');
      return;
    }

    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      toast.error('Please enter a valid 10-digit phone number.');
      return;
    }

    if (!street.trim() || !city.trim() || !pincode.trim()) {
      toast.error('Street, City, and Pincode are required for delivery address.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: cleanPhone,
        email: email.trim() || undefined,
        customerType,
        companyName: customerType === 'COMMERCIAL' ? companyName.trim() : undefined,
        referralCode: referralCode!.trim(),
        addresses: [
          {
            houseName: houseOrFlat.trim() || undefined,
            street: street.trim(),
            area: area.trim() || undefined,
            city: city.trim(),
            district: district.trim() || city.trim(),
            state: state.trim() || 'Kerala',
            country: 'India',
            zipCode: pincode.trim(),
            isDefault: true,
          },
        ],
      };

      await fetchWithAuth('/customer', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      toast.success('Customer created successfully.');

      resetForm();
      onClose();
    } catch (err: any) {
      const msg = err.message || 'Failed to create customer.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150">
        
        {/* ─── MODAL HEADER ────────────────────────────────── */}
        <div className="px-4 py-3.5 sm:px-5 bg-slate-50/80 border-b border-slate-200/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#1677C8]/10 text-[#1677C8] flex items-center justify-center font-bold">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Quick Customer Creation</h3>
              <p className="text-[11px] text-slate-500">
                Register a new customer with your referral code for attribution
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ─── MODAL FORM BODY ─────────────────────────────── */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          
          {/* ─── 1. AUTOMATIC REFERRAL CODE (LOCKED) ───────── */}
          <div className="bg-gradient-to-br from-sky-50 to-blue-50/80 p-3.5 rounded-xl border border-sky-200/80 shadow-2xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#1677C8] flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" />
                Staff-Assigned Referral Code
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-sky-800 bg-sky-100/70 px-2 py-0.5 rounded-full">
                <Lock className="w-2.5 h-2.5" />
                Locked & Auto-Applied
              </span>
            </div>

            {hasValidReferral ? (
              <div className="relative mt-1">
                <input
                  type="text"
                  readOnly
                  disabled
                  value={referralCode!}
                  className="w-full px-3 py-2 bg-white/90 border border-sky-300/80 rounded-xl font-mono text-base font-extrabold text-[#16324F] tracking-wider cursor-not-allowed select-all"
                />
                <Lock className="w-4 h-4 text-sky-500 absolute right-3 top-1/2 -translate-y-1/2" />
              </div>
            ) : (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">No Referral Code Assigned</p>
                  <p className="text-[11px] text-amber-700 mt-0.5">
                    Your distributor account does not have an assigned code. Please contact staff administration to enable customer onboarding.
                  </p>
                </div>
              </div>
            )}
            <p className="text-[10px] text-slate-500">
              Distributor referral code{distributorName ? ` (${distributorName})` : ''} is automatically applied for referral attribution only.
            </p>
          </div>

          {/* ─── 2. CUSTOMER INFORMATION ──────────────────── */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b border-slate-100 pb-1">
              Customer Information
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  First Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Rahul"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-[#1677C8] transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Last Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Sharma"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-[#1677C8] transition-all"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Phone Number <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="9876543210"
                    maxLength={10}
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono outline-none focus:bg-white focus:border-[#1677C8] transition-all"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Email Address <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="customer@example.com"
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-[#1677C8] transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Customer Type</label>
                <select
                  value={customerType}
                  onChange={(e) => setCustomerType(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:border-[#1677C8] transition-all cursor-pointer"
                >
                  <option value="RESIDENTIAL">Residential Customer</option>
                  <option value="COMMERCIAL">Commercial / Business</option>
                </select>
              </div>

              {customerType === 'COMMERCIAL' && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Company / Trade Name <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Building2 className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="e.g. Apex Enterprises"
                      className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-[#1677C8] transition-all"
                      required={customerType === 'COMMERCIAL'}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ─── 3. DELIVERY ADDRESS ───────────────────────── */}
          <div className="space-y-3 pt-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b border-slate-100 pb-1 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#1677C8]" />
              Delivery Address
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Street / Road <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  placeholder="e.g. Marine Drive Road"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-[#1677C8] transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  House / Flat / Building No.
                </label>
                <input
                  type="text"
                  value={houseOrFlat}
                  onChange={(e) => setHouseOrFlat(e.target.value)}
                  placeholder="e.g. Flat 3B, Sky Towers"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-[#1677C8] transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Area / Landmark</label>
                <input
                  type="text"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  placeholder="Near High Court"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-[#1677C8] transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  City <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Kochi"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-[#1677C8] transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Pincode <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                  placeholder="682001"
                  maxLength={6}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono outline-none focus:bg-white focus:border-[#1677C8] transition-all"
                  required
                />
              </div>
            </div>
          </div>

          {/* ─── MODAL FOOTER ACTIONS ──────────────────────── */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !hasValidReferral}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-[#1677C8] hover:bg-[#125ea0] text-white shadow-xs transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Creating Customer...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Create Customer</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
