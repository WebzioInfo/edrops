import { useState, useEffect, type FormEvent } from 'react';
import { X, User, Check, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { fetchWithAuth } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: any;
  onSuccess: () => void;
}

export default function EditProfileModal({
  isOpen,
  onClose,
  profile,
  onSuccess,
}: EditProfileModalProps) {
  const { updateUser } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [customerType, setCustomerType] = useState('RESIDENTIAL');
  const [companyName, setCompanyName] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [agencyName, setAgencyName] = useState('');
  const [distributorAddress, setDistributorAddress] = useState('');
  const [routeOrArea, setRouteOrArea] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setFirstName(profile.firstName || '');
      setLastName(profile.lastName || '');
      setEmail(profile.email || '');
      setPhone(profile.phone || '');
      setCustomerType(profile.customer?.customerType || 'RESIDENTIAL');
      setCompanyName(profile.customer?.companyName || '');
      setGstNumber(profile.customer?.gstNumber || '');
      setAgencyName(profile.distributor?.agencyName || '');
      setDistributorAddress(profile.distributor?.address || '');
      setRouteOrArea(profile.distributor?.routeOrArea || '');
      setVehicleType(profile.distributor?.vehicleType || profile.staff?.vehicleType || '');
      setVehiclePlate(profile.distributor?.vehiclePlate || profile.staff?.vehiclePlate || '');
    }
  }, [profile, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!firstName.trim() || !lastName.trim()) {
      toast.error('First and last name are required.');
      return;
    }

    if (!phone.trim()) {
      toast.error('Phone number is required.');
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim() || undefined,
        phone: phone.trim(),
      };

      if (profile.role === 'CUSTOMER') {
        payload.customerType = customerType;
        payload.companyName = companyName.trim() || undefined;
        payload.gstNumber = gstNumber.trim() || undefined;
      } else if (profile.role === 'DISTRIBUTOR') {
        payload.agencyName = agencyName.trim() || undefined;
        payload.address = distributorAddress.trim() || undefined;
        payload.routeOrArea = routeOrArea.trim() || undefined;
        payload.vehicleType = vehicleType.trim() || undefined;
        payload.vehiclePlate = vehiclePlate.trim() || undefined;
      }

      const updated = await fetchWithAuth('/profile', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      updateUser({
        firstName: updated.firstName,
        lastName: updated.lastName,
        email: updated.email,
        phone: updated.phone,
      });

      toast.success('Profile updated successfully!');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    'w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-[#1677C8] focus:bg-white transition-all';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#1677C8]/10 text-[#1677C8]">
              <User className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Edit Profile Details</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                First Name <span className="text-rose-500">*</span>
              </label>
              <input
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Last Name <span className="text-rose-500">*</span>
              </label>
              <input
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Phone Number <span className="text-rose-500">*</span>
            </label>
            <input
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="10-digit mobile number"
              className={`${inputClass} font-mono`}
            />
          </div>

          {/* Customer Specific Fields */}
          {profile.role === 'CUSTOMER' && (
            <>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Customer Type
                </label>
                <select
                  value={customerType}
                  onChange={(e) => setCustomerType(e.target.value)}
                  className={inputClass}
                >
                  <option value="RESIDENTIAL">Residential</option>
                  <option value="COMMERCIAL">Commercial</option>
                  <option value="OFFICE">Office</option>
                  <option value="APARTMENT">Apartment</option>
                </select>
              </div>

              {customerType !== 'RESIDENTIAL' && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Company Name
                    </label>
                    <input
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Company / Business Name"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      GST Number
                    </label>
                    <input
                      value={gstNumber}
                      onChange={(e) => setGstNumber(e.target.value)}
                      placeholder="GSTIN"
                      className={`${inputClass} font-mono uppercase`}
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {/* Distributor Specific Fields */}
          {profile.role === 'DISTRIBUTOR' && (
            <>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Agency Name
                </label>
                <input
                  value={agencyName}
                  onChange={(e) => setAgencyName(e.target.value)}
                  placeholder="e.g. Kondotty Water Supplies"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Registered Agency Address
                </label>
                <textarea
                  rows={2}
                  value={distributorAddress}
                  onChange={(e) => setDistributorAddress(e.target.value)}
                  placeholder="Official office or warehouse address"
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Route / Area
                  </label>
                  <input
                    value={routeOrArea}
                    onChange={(e) => setRouteOrArea(e.target.value)}
                    placeholder="Route or Area"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Vehicle Type
                  </label>
                  <input
                    value={vehicleType}
                    onChange={(e) => setVehicleType(e.target.value)}
                    placeholder="e.g. Pickup Truck / Mini Van"
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Vehicle Plate
                </label>
                <input
                  value={vehiclePlate}
                  onChange={(e) => setVehiclePlate(e.target.value)}
                  placeholder="Plate Number (e.g. KL 10 AZ 4500)"
                  className={`${inputClass} font-mono uppercase`}
                />
              </div>
            </>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#1677C8] hover:bg-[#125ea0] text-white text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
