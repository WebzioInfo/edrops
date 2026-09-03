import { useState, useEffect } from 'react';
import { 
  X, 
  User, 
  Loader2, 
  AlertCircle, 
  Truck, 
  Phone, 
  Mail, 
  Lock,
  Eye,
  EyeOff,
  IndianRupee
} from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';
import { toast } from 'react-hot-toast';

export interface UserRecord {
  id?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  phone?: string;
  email?: string;
  role?: string;
  isActive?: boolean;
  deliveryPartner?: {
    id?: string;
    vehicleType?: string;
    vehiclePlate?: string;
    jarUnitPrice?: number;
  } | null;
  jarUnitPrice?: number;
}

interface UserFormModalProps {
  isOpen: boolean;
  userToEdit: UserRecord | null;
  defaultRole?: 'DELIVERY_PARTNER' | 'STAFF' | 'ADMIN' | 'MANAGER';
  onClose: () => void;
  onSuccess: () => void;
}

export default function UserFormModal({
  isOpen,
  userToEdit,
  defaultRole = 'STAFF',
  onClose,
  onSuccess,
}: UserFormModalProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<string>(defaultRole);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [vehicleType, setVehicleType] = useState('Motorcycle');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [jarUnitPrice, setJarUnitPrice] = useState('12.00');
  const [isActive, setIsActive] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = Boolean(userToEdit?.id);

  useEffect(() => {
    if (isOpen) {
      if (userToEdit) {
        setFirstName(userToEdit.firstName || '');
        setLastName(userToEdit.lastName || '');
        setPhone(userToEdit.phone || '');
        setEmail(userToEdit.email || '');
        setRole(userToEdit.role || defaultRole);
        setPassword('');
        setVehicleType(userToEdit.deliveryPartner?.vehicleType || 'Motorcycle');
        setVehiclePlate(userToEdit.deliveryPartner?.vehiclePlate || '');
        const p = userToEdit.deliveryPartner?.jarUnitPrice ?? userToEdit.jarUnitPrice ?? 12;
        setJarUnitPrice(Number(p).toFixed(2));
        setIsActive(userToEdit.isActive !== false);
      } else {
        setFirstName('');
        setLastName('');
        setPhone('');
        setEmail('');
        setRole(defaultRole);
        setPassword('');
        setVehicleType('Motorcycle');
        setVehiclePlate('');
        setJarUnitPrice('12.00');
        setIsActive(true);
      }
      setError(null);
      setLoading(false);
    }
  }, [isOpen, userToEdit, defaultRole]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setError(null);

    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    const trimmedPhone = phone.trim();
    const trimmedEmail = email.trim();

    if (!trimmedFirst) {
      setError('First name is required.');
      return;
    }

    if (!trimmedPhone) {
      setError('Phone number is required.');
      return;
    }

    if (!isEdit && password && password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    let parsedPrice = 0;
    if (role === 'DELIVERY_PARTNER') {
      const p = Number(jarUnitPrice.trim());
      if (isNaN(p) || p < 0) {
        setError('Please enter a valid non-negative jar unit price.');
        return;
      }
      parsedPrice = p;
    }

    setLoading(true);
    try {
      const payload: any = {
        firstName: trimmedFirst,
        lastName: trimmedLast,
        phone: trimmedPhone,
        email: trimmedEmail || undefined,
        role,
        isActive,
      };

      if (password.trim()) {
        payload.password = password.trim();
      }

      if (role === 'DELIVERY_PARTNER') {
        payload.vehicleType = vehicleType;
        payload.vehiclePlate = vehiclePlate.trim() || undefined;
        payload.jarUnitPrice = parsedPrice;
      }

      if (isEdit && userToEdit?.id) {
        await fetchWithAuth(`/admin/users/${userToEdit.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        toast.success('User updated successfully');
      } else {
        await fetchWithAuth('/admin/users', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast.success(
          role === 'DELIVERY_PARTNER'
            ? 'Delivery Partner added successfully'
            : 'Application user created successfully'
        );
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Save user error:', err);
      const msg = err.message || 'Unable to save user. Please verify input fields.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) {
          onClose();
        }
      }}
    >
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-gray-100 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#1677C8]/10 text-[#1677C8] flex items-center justify-center">
              {role === 'DELIVERY_PARTNER' ? (
                <Truck className="w-4 h-4" />
              ) : (
                <User className="w-4 h-4" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#16324F]">
                {isEdit
                  ? `Edit ${role === 'DELIVERY_PARTNER' ? 'Delivery Partner' : 'User'}`
                  : `Add New ${role === 'DELIVERY_PARTNER' ? 'Delivery Partner' : 'User'}`}
              </h3>
              <p className="text-[11px] text-[#64748B]">
                {isEdit
                  ? 'Update account credentials, role and operational status'
                  : 'Create an authenticated application user account'}
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-200/60 transition cursor-pointer disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 text-xs bg-red-50 text-red-700 border border-red-200 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* First & Last Name */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#16324F]">
                First Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                disabled={loading}
                value={firstName}
                onChange={(e) => {
                  setFirstName(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="e.g. John"
                className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-[#E2E8F0] rounded-xl outline-none focus:border-[#1677C8] focus:ring-2 focus:ring-[#1677C8]/10 transition-all text-[#16324F]"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#16324F]">Last Name</label>
              <input
                type="text"
                disabled={loading}
                value={lastName}
                onChange={(e) => {
                  setLastName(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="e.g. Driver"
                className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-[#E2E8F0] rounded-xl outline-none focus:border-[#1677C8] focus:ring-2 focus:ring-[#1677C8]/10 transition-all text-[#16324F]"
              />
            </div>
          </div>

          {/* Phone & Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#16324F]">
                Phone Number <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="tel"
                  disabled={loading}
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="+91 98765 43210"
                  className="w-full pl-8 pr-3 py-2 text-xs sm:text-sm bg-white border border-[#E2E8F0] rounded-xl outline-none focus:border-[#1677C8] focus:ring-2 focus:ring-[#1677C8]/10 transition-all text-[#16324F]"
                />
                <Phone className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#16324F]">Email Address</label>
              <div className="relative">
                <input
                  type="email"
                  disabled={loading}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="user@edrops.in"
                  className="w-full pl-8 pr-3 py-2 text-xs sm:text-sm bg-white border border-[#E2E8F0] rounded-xl outline-none focus:border-[#1677C8] focus:ring-2 focus:ring-[#1677C8]/10 transition-all text-[#16324F]"
                />
                <Mail className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Role Selection */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#16324F]">
              Application Role <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'DELIVERY_PARTNER', label: 'Delivery Partner', desc: 'Driver portal & order fulfillment' },
                { value: 'STAFF', label: 'Staff Member', desc: 'Operations & warehouse management' },
                { value: 'ADMIN', label: 'Administrator', desc: 'Full application & settings access' },
                { value: 'MANAGER', label: 'Operations Manager', desc: 'Delivery routing & fleet oversight' },
              ].map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRole(r.value)}
                  className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                    role === r.value
                      ? 'border-[#1677C8] bg-blue-50/50 ring-1 ring-[#1677C8]'
                      : 'border-[#E2E8F0] bg-white hover:bg-slate-50'
                  }`}
                >
                  <span className={`text-xs font-bold ${role === r.value ? 'text-[#1677C8]' : 'text-[#16324F]'}`}>
                    {r.label}
                  </span>
                  <span className="text-[10px] text-[#64748B] mt-0.5 leading-tight">{r.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Delivery Partner Specific Details */}
          {role === 'DELIVERY_PARTNER' && (
            <div className="p-3.5 bg-blue-50/40 rounded-xl border border-blue-100/80 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#1677C8]">
                <Truck className="w-4 h-4" />
                <span>Delivery Partner Operational Settings</span>
              </div>

              {/* Jar Unit Price */}
              <div className="space-y-1 bg-white p-3 rounded-xl border border-blue-100">
                <label className="block text-xs font-bold text-[#16324F]">
                  Jar Unit Price (₹ / jar) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#1677C8] font-bold">
                    <IndianRupee className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="text"
                    disabled={loading}
                    value={jarUnitPrice}
                    onChange={(e) => {
                      setJarUnitPrice(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="12.00"
                    className="w-full pl-7 pr-12 py-2 text-xs sm:text-sm font-bold bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg outline-none focus:bg-white focus:border-[#1677C8] focus:ring-2 focus:ring-[#1677C8]/10 transition-all text-[#16324F]"
                  />
                  <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs font-semibold text-[#64748B] pointer-events-none">
                    / jar
                  </span>
                </div>
                <p className="text-[10px] text-[#64748B] leading-relaxed">
                  Amount assigned by Edrops to this delivery partner for each jar handled.
                </p>
              </div>

              {/* Vehicle info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-[#16324F]">Vehicle Type</label>
                  <select
                    value={vehicleType}
                    onChange={(e) => setVehicleType(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-[#E2E8F0] rounded-lg outline-none text-[#16324F] font-medium"
                  >
                    <option value="Motorcycle">Motorcycle</option>
                    <option value="Three Wheeler (Auto)">Three Wheeler (Auto)</option>
                    <option value="Van / Small Truck">Van / Small Truck</option>
                    <option value="Bicycle">Bicycle</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-[#16324F]">Vehicle Plate / Reg No</label>
                  <input
                    type="text"
                    value={vehiclePlate}
                    onChange={(e) => setVehiclePlate(e.target.value)}
                    placeholder="e.g. KL 10 AZ 4521"
                    className="w-full px-3 py-1.5 text-xs bg-white border border-[#E2E8F0] rounded-lg outline-none text-[#16324F] font-medium"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Password (Optional on edit, default generated on add) */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-[#16324F]">
              {isEdit ? 'Set New Password (Leave blank to preserve current)' : 'Account Password'}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                disabled={loading}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                placeholder={isEdit ? '••••••••' : 'Default: Edrops@2026 if blank'}
                className="w-full pl-8 pr-10 py-2 text-xs sm:text-sm bg-white border border-[#E2E8F0] rounded-xl outline-none focus:border-[#1677C8] focus:ring-2 focus:ring-[#1677C8]/10 transition-all text-[#16324F]"
              />
              <Lock className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Account Status Toggle */}
          <div className="flex items-center justify-between pt-1">
            <div>
              <p className="text-xs font-semibold text-[#16324F]">Account Active Status</p>
              <p className="text-[11px] text-[#64748B]">Active users can sign in and fulfill tasks</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#1677C8]"></div>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100 shrink-0">
            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:text-[#16324F] bg-white border border-[#E2E8F0] rounded-xl hover:bg-gray-50 transition cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-[#1677C8] hover:bg-[#1362a4] rounded-xl shadow-2xs transition cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>{isEdit ? 'Save Changes' : 'Create Account'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
