import React, { useState, useEffect } from 'react';
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
  Package,
  AlertCircle,
  RotateCw,
  Plus,
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
  servicePincodes?: Array<string | { pincode: string; [key: string]: any }>;
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
  const [jarOwnership, setJarOwnership] = useState('COMPANY_OWNED');
  const [companyOwnedJars, setCompanyOwnedJars] = useState(0);
  const [distributorOwnedJars, setDistributorOwnedJars] = useState(0);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isActive, setIsActive] = useState(true);

  // Available Service Pincodes State
  const [pincodes, setPincodes] = useState<string[]>([]);
  const [pincodeInput, setPincodeInput] = useState('');
  const [pincodeError, setPincodeError] = useState<string | null>(null);

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
        setJarOwnership(distributorToEdit.jarOwnership || 'COMPANY_OWNED');
        setCompanyOwnedJars(distributorToEdit.companyOwnedJars || 0);
        setDistributorOwnedJars(distributorToEdit.distributorOwnedJars || 0);
        setPassword('');
        setIsActive(distributorToEdit.isActive !== false);

        // Load existing service pincodes into chips
        const initialPins: string[] = (distributorToEdit.servicePincodes || [])
          .map((p: any) => (typeof p === 'string' ? p.trim() : String(p?.pincode || '').trim()))
          .filter((p: string) => /^\d{6}$/.test(p));
        setPincodes(Array.from(new Set(initialPins)));

        // If service pincodes were not loaded, fetch fresh from backend
        const targetId = distributorToEdit.userId || distributorToEdit.id;
        if (targetId && initialPins.length === 0) {
          fetchWithAuth(`/staff/distributors/${targetId}`)
            .then((res) => {
              if (res?.servicePincodes && Array.isArray(res.servicePincodes)) {
                const fetchedPins = res.servicePincodes
                  .map((p: any) => (typeof p === 'string' ? p.trim() : String(p?.pincode || '').trim()))
                  .filter((p: string) => /^\d{6}$/.test(p));
                setPincodes((prev) => Array.from(new Set([...prev, ...fetchedPins])));
              }
            })
            .catch(() => {});
        }
      } else {
        setFirstName('');
        setLastName('');
        setPhone('');
        setEmail('');
        const randomSuffix = Math.floor(1000 + Math.random() * 9000);
        setReferralCode(`EDR-${randomSuffix}`);
        setAgencyName('');
        setAddress('');
        setJarOwnership('COMPANY_OWNED');
        setCompanyOwnedJars(0);
        setDistributorOwnedJars(0);
        setPassword('');
        setIsActive(true);
        setPincodes([]);
      }
      setPincodeInput('');
      setPincodeError(null);
      setError(null);
      setLoading(false);
    }
  }, [isOpen, distributorToEdit]);

  if (!isOpen) return null;

  const handleAddPincode = () => {
    setPincodeError(null);
    const clean = pincodeInput.trim();
    if (!clean) return;

    if (!/^\d{6}$/.test(clean)) {
      setPincodeError('Pincode must be exactly 6 digits');
      return;
    }

    if (pincodes.includes(clean)) {
      setPincodeError(`Pincode ${clean} is already added`);
      return;
    }

    setPincodes((prev) => [...prev, clean]);
    setPincodeInput('');
  };

  const handlePincodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault(); // Prevent modal form submission
      handleAddPincode();
    }
  };

  const handleRemovePincode = (pinToRemove: string) => {
    setPincodes((prev) => prev.filter((p) => p !== pinToRemove));
  };

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
        jarOwnership,
        companyOwnedJars: Number(companyOwnedJars) || 0,
        distributorOwnedJars: Number(distributorOwnedJars) || 0,
        servicePincodes: pincodes,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-200/80 flex items-center justify-between shrink-0">
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
                  ? 'Update distributor profile and service pincodes.'
                  : 'Register a new distributor partner with a staff-assigned referral code.'}
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs font-semibold text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. STAFF-ASSIGNED REFERRAL CODE */}
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

          {/* 2. PERSONAL INFORMATION */}
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

          {/* 3. JAR OWNERSHIP / INVENTORY */}
          <div className="space-y-2.5 pt-2 border-t border-slate-100">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Jar Ownership / Inventory
            </h3>
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
                  Distributor Jars
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

          {/* 4. AVAILABLE SERVICE PINCODES */}
          <div className="space-y-2.5 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-[#1677C8]" />
                Available Service Pincodes
              </label>
              <span className="text-[10px] font-semibold text-[#1677C8] bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200/60">
                {pincodes.length} {pincodes.length === 1 ? 'Pincode' : 'Pincodes'}
              </span>
            </div>

            {/* Pincode Tag/Chip Container */}
            {pincodes.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 border border-slate-200/80 rounded-xl min-h-[42px] items-center">
                {pincodes.map((pin) => (
                  <span
                    key={pin}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white text-[#16324F] border border-sky-200 rounded-lg text-xs font-mono font-bold shadow-2xs group hover:border-[#1677C8] transition-colors"
                  >
                    <span>{pin}</span>
                    <button
                      type="button"
                      onClick={() => handleRemovePincode(pin)}
                      className="text-slate-400 hover:text-rose-600 rounded p-0.5 transition cursor-pointer"
                      title={`Remove pincode ${pin}`}
                      aria-label={`Remove pincode ${pin}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <div className="p-3 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400">
                No service pincodes added yet. Add 6-digit pincodes where this distributor can deliver orders.
              </div>
            )}

            {/* Input + Add button */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  maxLength={6}
                  value={pincodeInput}
                  onChange={(e) => {
                    setPincodeError(null);
                    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setPincodeInput(val);
                  }}
                  onKeyDown={handlePincodeKeyDown}
                  placeholder="Enter 6-digit pincode (e.g. 673638)..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-mono font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:border-[#1677C8] outline-none"
                />
              </div>
              <button
                type="button"
                onClick={handleAddPincode}
                disabled={pincodeInput.trim().length !== 6}
                className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-[#1677C8] hover:bg-[#125ea0] disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer disabled:cursor-not-allowed shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>

            {pincodeError && (
              <p className="text-[11px] text-rose-500 font-semibold">{pincodeError}</p>
            )}
          </div>

          {/* 5. ACCESS & ACCOUNT STATUS */}
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
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
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
