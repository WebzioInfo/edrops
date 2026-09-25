import { useState, useEffect } from 'react';
import {
  X,
  Building2,
  Phone,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Tag,
  MapPin,
  Truck,
  Package,
  AlertCircle,
  RotateCw,
} from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';
import { toast } from 'react-hot-toast';

export interface DistributorRecord {
  id?: string;
  userId?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  phone?: string;
  email?: string;
  role?: string;
  isActive?: boolean;
  referralCode?: string;
  agencyName?: string;
  address?: string;
  routeOrArea?: string;
  vehicleType?: string;
  vehiclePlate?: string;
  jarOwnership?: string;
  companyOwnedJars?: number;
  distributorOwnedJars?: number;
}

interface DistributorFormModalProps {
  isOpen: boolean;
  distributorToEdit: DistributorRecord | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function DistributorFormModal({
  isOpen,
  distributorToEdit,
  onClose,
  onSuccess,
}: DistributorFormModalProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [agencyName, setAgencyName] = useState('');
  const [address, setAddress] = useState('');
  const [routeOrArea, setRouteOrArea] = useState('');
  const [vehicleType, setVehicleType] = useState('Three-Wheeler');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [jarOwnership, setJarOwnership] = useState('COMPANY_OWNED');
  const [companyOwnedJars, setCompanyOwnedJars] = useState(0);
  const [distributorOwnedJars, setDistributorOwnedJars] = useState(0);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isActive, setIsActive] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = Boolean(distributorToEdit?.id || distributorToEdit?.userId);

  useEffect(() => {
    if (isOpen) {
      if (distributorToEdit) {
        setFirstName(distributorToEdit.firstName || '');
        setLastName(distributorToEdit.lastName || '');
        setPhone(distributorToEdit.phone || '');
        setEmail(distributorToEdit.email || '');
        setReferralCode(distributorToEdit.referralCode || '');
        setAgencyName(distributorToEdit.agencyName || '');
        setAddress(distributorToEdit.address || '');
        setRouteOrArea(distributorToEdit.routeOrArea || '');
        setVehicleType(distributorToEdit.vehicleType || 'Three-Wheeler');
        setVehiclePlate(distributorToEdit.vehiclePlate || '');
        setJarOwnership(distributorToEdit.jarOwnership || 'COMPANY_OWNED');
        setCompanyOwnedJars(distributorToEdit.companyOwnedJars || 0);
        setDistributorOwnedJars(distributorToEdit.distributorOwnedJars || 0);
        setPassword('');
        setIsActive(distributorToEdit.isActive !== false);
      } else {
        setFirstName('');
        setLastName('');
        setPhone('');
        setEmail('');
        const randomSuffix = Math.floor(1000 + Math.random() * 9000);
        setReferralCode(`EDR-${randomSuffix}`);
        setAgencyName('');
        setAddress('');
        setRouteOrArea('');
        setVehicleType('Three-Wheeler');
        setVehiclePlate('');
        setJarOwnership('COMPANY_OWNED');
        setCompanyOwnedJars(0);
        setDistributorOwnedJars(0);
        setPassword('');
        setIsActive(true);
      }
      setError(null);
      setLoading(false);
    }
  }, [isOpen, distributorToEdit]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!firstName.trim() || !lastName.trim()) {
      setError('First and last name are required');
      return;
    }
    if (!phone.trim()) {
      setError('Phone number is required');
      return;
    }
    const cleanRefCode = referralCode.trim().toUpperCase();
    if (!cleanRefCode) {
      setError('Referral code is required for every distributor');
      return;
    }
    if (!/^[A-Za-z0-9-_]+$/.test(cleanRefCode)) {
      setError('Referral code must contain only letters, numbers, hyphens, and underscores');
      return;
    }

    try {
      setLoading(true);
      const payload: any = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        referralCode: cleanRefCode,
        agencyName: agencyName.trim() || undefined,
        address: address.trim() || undefined,
        routeOrArea: routeOrArea.trim() || undefined,
        vehicleType: vehicleType.trim() || undefined,
        vehiclePlate: vehiclePlate.trim() || undefined,
        jarOwnership,
        companyOwnedJars: Number(companyOwnedJars) || 0,
        distributorOwnedJars: Number(distributorOwnedJars) || 0,
        isActive,
      };

      if (password.trim()) {
        payload.password = password.trim();
      }

      if (isEdit) {
        const targetId = distributorToEdit?.userId || distributorToEdit?.id;
        await fetchWithAuth(`/staff/distributors/${targetId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        toast.success('Distributor updated successfully');
      } else {
        await fetchWithAuth('/staff/distributors', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast.success('Distributor created successfully');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err.message || 'Failed to save distributor';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-200/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#1677C8]/10 text-[#1677C8] flex items-center justify-center font-bold">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">
                {isEdit ? 'Edit Distributor' : 'Add New Distributor'}
              </h2>
              <p className="text-[11px] text-slate-500">
                {isEdit
                  ? 'Update distributor profile and assigned operational details.'
                  : 'Register a new distributor partner with a staff-assigned referral code.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs font-semibold text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Referral Code (Prominently Highlighted) */}
          <div className="bg-sky-50/60 p-3.5 rounded-xl border border-sky-200/80 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#1677C8] flex items-center gap-1">
                <Tag className="w-3 h-3" />
                Staff-Assigned Referral Code *
              </label>
              <span className="text-[10px] text-slate-400 font-medium">Must be unique</span>
            </div>
            <input
              type="text"
              required
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
              placeholder="e.g. EDR-8881"
              className="w-full bg-white border border-sky-300 rounded-xl px-3 py-1.5 font-mono font-bold text-sm text-slate-800 tracking-wider focus:outline-none focus:ring-1 focus:ring-[#1677C8]"
            />
            <p className="text-[10px] text-slate-500">
              Staff sets or modifies this unique identifier for customer-distributor attribution.
            </p>
          </div>

          {/* Personal Details */}
          <div className="space-y-2.5">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Personal Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  First Name *
                </label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:border-[#1677C8] outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Last Name *
                </label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:border-[#1677C8] outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Phone className="w-3 h-3 text-[#1677C8]" />
                  Phone Number *
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="10-digit mobile number"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:border-[#1677C8] outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Mail className="w-3 h-3 text-[#1677C8]" />
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="distributor@example.com"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:border-[#1677C8] outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Agency / Business Name
                </label>
                <input
                  type="text"
                  value={agencyName}
                  onChange={(e) => setAgencyName(e.target.value)}
                  placeholder="e.g. Edrops South Agency"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:border-[#1677C8] outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-[#1677C8]" />
                  Operating Address
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street / Warehouse address"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:border-[#1677C8] outline-none"
                />
              </div>
            </div>
          </div>

          {/* Operations & Vehicle */}
          <div className="space-y-2.5 pt-2 border-t border-slate-100">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Operations & Logistics
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Assigned Route
                </label>
                <input
                  type="text"
                  value={routeOrArea}
                  onChange={(e) => setRouteOrArea(e.target.value)}
                  placeholder="e.g. Zone 1 - Downtown"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:border-[#1677C8] outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Truck className="w-3 h-3 text-[#1677C8]" />
                  Vehicle Type
                </label>
                <select
                  value={vehicleType}
                  onChange={(e) => setVehicleType(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-[#1677C8]"
                >
                  <option value="Three-Wheeler">Three-Wheeler</option>
                  <option value="Mini Truck">Mini Truck / Pickup</option>
                  <option value="Motorcycle">Motorcycle</option>
                  <option value="Heavy Van">Commercial Van</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Vehicle Plate #
                </label>
                <input
                  type="text"
                  value={vehiclePlate}
                  onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())}
                  placeholder="KL-07-CD-1234"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:border-[#1677C8] outline-none font-mono"
                />
              </div>
            </div>

            {/* Jar Ownership & Counts */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Package className="w-3 h-3 text-[#1677C8]" />
                  Jar Ownership
                </label>
                <select
                  value={jarOwnership}
                  onChange={(e) => setJarOwnership(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-[#1677C8]"
                >
                  <option value="COMPANY_OWNED">Company Owned</option>
                  <option value="DISTRIBUTOR_OWNED">Distributor Owned</option>
                  <option value="MIXED">Mixed / Shared</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Company Jars
                </label>
                <input
                  type="number"
                  min="0"
                  value={companyOwnedJars}
                  onChange={(e) => setCompanyOwnedJars(parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:bg-white focus:border-[#1677C8]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Partner Jars
                </label>
                <input
                  type="number"
                  min="0"
                  value={distributorOwnedJars}
                  onChange={(e) => setDistributorOwnedJars(parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:bg-white focus:border-[#1677C8]"
                />
              </div>
            </div>
          </div>

          {/* Access & Status */}
          <div className="space-y-2.5 pt-2 border-t border-slate-100">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Access & Account Status
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-[#1677C8]" />
                  {isEdit ? 'Password (Leave blank to keep)' : 'Initial Password'}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={isEdit ? '••••••••' : 'Default: Edrops@2026'}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:bg-white focus:border-[#1677C8] pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Account Status
                </label>
                <button
                  type="button"
                  onClick={() => setIsActive(!isActive)}
                  className={`w-full py-1.5 px-3 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-2 border ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  {isActive ? 'Active Account' : 'Inactive (Suspended)'}
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-1.5 rounded-lg text-xs font-bold bg-[#1677C8] hover:bg-[#125ea0] text-white shadow-xs transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading && <RotateCw className="w-3.5 h-3.5 animate-spin" />}
              {isEdit ? 'Save Changes' : 'Create Distributor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
