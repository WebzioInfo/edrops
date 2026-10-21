import { useState, useEffect, type FormEvent } from 'react';
import { X, User, Check, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { fetchWithAuth } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import ProfileOtpVerificationModal from './ProfileOtpVerificationModal';

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

  // OTP Verification state
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [verificationId, setVerificationId] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [pendingPayload, setPendingPayload] = useState<any>(null);

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
      setVehicleType(
        profile.distributor?.vehicleType ||
          profile.staff?.vehicleType ||
          profile.deliveryPartner?.vehicleType ||
          '',
      );
      setVehiclePlate(
        profile.distributor?.vehiclePlate ||
          profile.staff?.vehiclePlate ||
          profile.deliveryPartner?.vehiclePlate ||
          '',
      );
      setOtpModalOpen(false);
      setVerificationId('');
      setMaskedEmail('');
      setPendingPayload(null);
    }
  }, [profile, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const newFirst = firstName.trim();
    const newLast = lastName.trim();
    const newEmail = email.trim().toLowerCase();
    const newPhone = phone.trim();

    if (!newFirst || !newLast) {
      toast.error('First and last name are required.');
      return;
    }

    if (!newPhone) {
      toast.error('Phone number is required.');
      return;
    }

    const cleanPhoneDigits = newPhone.replace(/\D/g, '');
    if (cleanPhoneDigits.length < 10) {
      toast.error('Please enter a valid 10-digit mobile number.');
      return;
    }

    if (newEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      toast.error('Please enter a valid email address.');
      return;
    }

    // Compare with current saved profile values
    const currentFirst = (profile.firstName || '').trim();
    const currentLast = (profile.lastName || '').trim();
    const currentEmail = (profile.email || '').trim().toLowerCase();
    const currentPhone = (profile.phone || '').trim();
    const currentCustomerType = profile.customer?.customerType || 'RESIDENTIAL';
    const currentCompanyName = (profile.customer?.companyName || '').trim();
    const currentGst = (profile.customer?.gstNumber || '').trim();
    const currentAgency = (profile.distributor?.agencyName || '').trim();
    const currentDistAddress = (profile.distributor?.address || '').trim();
    const currentRoute = (profile.distributor?.routeOrArea || '').trim();
    const currentVehicleType = (
      profile.distributor?.vehicleType ||
      profile.staff?.vehicleType ||
      profile.deliveryPartner?.vehicleType ||
      ''
    ).trim();
    const currentVehiclePlate = (
      profile.distributor?.vehiclePlate ||
      profile.staff?.vehiclePlate ||
      profile.deliveryPartner?.vehiclePlate ||
      ''
    ).trim();

    const newCustomerType = customerType;
    const newCompanyName = companyName.trim();
    const newGst = gstNumber.trim();
    const newAgency = agencyName.trim();
    const newDistAddress = distributorAddress.trim();
    const newRoute = routeOrArea.trim();
    const newVehicleType = vehicleType.trim();
    const newVehiclePlate = vehiclePlate.trim();

    let hasChanges =
      newFirst !== currentFirst ||
      newLast !== currentLast ||
      newEmail !== currentEmail ||
      newPhone !== currentPhone;

    if (profile.role === 'CUSTOMER') {
      if (
        newCustomerType !== currentCustomerType ||
        newCompanyName !== currentCompanyName ||
        newGst !== currentGst
      ) {
        hasChanges = true;
      }
    } else if (profile.role === 'DISTRIBUTOR') {
      if (
        newAgency !== currentAgency ||
        newDistAddress !== currentDistAddress ||
        newRoute !== currentRoute ||
        newVehicleType !== currentVehicleType ||
        newVehiclePlate !== currentVehiclePlate
      ) {
        hasChanges = true;
      }
    } else if (profile.role === 'DELIVERY_PARTNER' || profile.role === 'STAFF') {
      if (
        newVehicleType !== currentVehicleType ||
        newVehiclePlate !== currentVehiclePlate
      ) {
        hasChanges = true;
      }
    }

    if (!hasChanges) {
      toast('No changes detected to save.');
      return;
    }

    const payload: any = {
      firstName: newFirst,
      lastName: newLast,
      email: newEmail || undefined,
      phone: newPhone,
    };

    if (profile.role === 'CUSTOMER') {
      payload.customerType = newCustomerType;
      payload.companyName = newCompanyName || undefined;
      payload.gstNumber = newGst || undefined;
    } else if (profile.role === 'DISTRIBUTOR') {
      payload.agencyName = newAgency || undefined;
      payload.address = newDistAddress || undefined;
      payload.routeOrArea = newRoute || undefined;
      payload.vehicleType = newVehicleType || undefined;
      payload.vehiclePlate = newVehiclePlate || undefined;
    } else if (profile.role === 'DELIVERY_PARTNER' || profile.role === 'STAFF') {
      payload.vehicleType = newVehicleType || undefined;
      payload.vehiclePlate = newVehiclePlate || undefined;
    }

    setSaving(true);
    try {
      const res = await fetchWithAuth('/profile/request-update-otp', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (res.noChanges) {
        toast('No changes detected to save.');
        return;
      }

      setPendingPayload(payload);
      setVerificationId(res.verificationId);
      setMaskedEmail(res.maskedEmail || '');
      setOtpModalOpen(true);
      toast.success('Verification code sent to your registered email.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to initiate verification');
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyOtp = async (otp: string) => {
    const updated = await fetchWithAuth('/profile/verify-update-otp', {
      method: 'POST',
      body: JSON.stringify({
        verificationId,
        otp,
      }),
    });

    updateUser({
      firstName: updated.firstName,
      lastName: updated.lastName,
      email: updated.email,
      phone: updated.phone,
    });

    toast.success('Profile updated successfully.');
    setOtpModalOpen(false);
    onSuccess();
    onClose();
  };

  const handleResendOtp = async () => {
    if (!pendingPayload) return;
    const res = await fetchWithAuth('/profile/request-update-otp', {
      method: 'POST',
      body: JSON.stringify(pendingPayload),
    });
    setVerificationId(res.verificationId);
    if (res.maskedEmail) setMaskedEmail(res.maskedEmail);
    toast.success('Verification code sent to your registered email.');
    return res.verificationId;
  };

  const inputClass =
    'w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-[#1677C8] focus:bg-white transition-all';

  return (
    <>
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
              disabled={saving}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer disabled:opacity-50"
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
                placeholder="registered or new email address"
                className={inputClass}
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Note: Updating your email requires OTP verification through your currently registered email.
              </p>
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

            {/* Delivery Partner / Staff Specific Fields */}
            {(profile.role === 'DELIVERY_PARTNER' || profile.role === 'STAFF') && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Vehicle Type
                  </label>
                  <input
                    value={vehicleType}
                    onChange={(e) => setVehicleType(e.target.value)}
                    placeholder="e.g. Scooter / Van"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Vehicle Plate
                  </label>
                  <input
                    value={vehiclePlate}
                    onChange={(e) => setVehiclePlate(e.target.value)}
                    placeholder="Plate Number"
                    className={`${inputClass} font-mono uppercase`}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
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
                    <span>Verifying...</span>
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

      {/* OTP Security Verification Dialog */}
      <ProfileOtpVerificationModal
        isOpen={otpModalOpen}
        onClose={() => setOtpModalOpen(false)}
        maskedEmail={maskedEmail}
        verificationId={verificationId}
        onVerify={handleVerifyOtp}
        onResend={handleResendOtp}
      />
    </>
  );
}
