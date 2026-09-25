import { useState, useEffect } from 'react';
import {
  User,
  Phone,
  Mail,
  Building2,
  MapPin,
  Truck,
  Tag,
  Copy,
  Check,
  Lock,
  Shield,
  Edit2,
  Calendar,
  AlertCircle,
  Loader2,
  X,
  Eye,
  EyeOff,
} from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';
import { toast } from 'react-hot-toast';
import { DistributorTopbar } from '../components/DistributorTopbar';

export default function DistributorProfile() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Edit Profile Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAgencyName, setEditAgencyName] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editRouteOrArea, setEditRouteOrArea] = useState('');
  const [editVehicleType, setEditVehicleType] = useState('');
  const [editVehiclePlate, setEditVehiclePlate] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Change Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [changingPass, setChangingPass] = useState(false);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const data = await fetchWithAuth('/auth/me');
      setProfile(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleCopyReferral = () => {
    const code = profile?.distributor?.referralCode;
    if (code) {
      navigator.clipboard.writeText(code);
      setCopiedCode(true);
      toast.success(`Distributor referral code ${code} copied to clipboard!`);
      setTimeout(() => setCopiedCode(false), 2500);
    }
  };

  const openEditModal = () => {
    if (!profile) return;
    setEditFirstName(profile.firstName || '');
    setEditLastName(profile.lastName || '');
    setEditPhone(profile.phone || '');
    setEditEmail(profile.email || '');
    setEditAgencyName(profile.distributor?.agencyName || '');
    setEditAddress(profile.distributor?.address || '');
    setEditRouteOrArea(profile.distributor?.routeOrArea || '');
    setEditVehicleType(profile.distributor?.vehicleType || 'Three-Wheeler');
    setEditVehiclePlate(profile.distributor?.vehiclePlate || '');
    setIsEditModalOpen(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFirstName.trim() || !editLastName.trim() || !editPhone.trim()) {
      toast.error('First name, last name, and phone number are required.');
      return;
    }

    try {
      setSavingProfile(true);
      await fetchWithAuth('/auth/update-profile', {
        method: 'POST',
        body: JSON.stringify({
          firstName: editFirstName.trim(),
          lastName: editLastName.trim(),
          phone: editPhone.trim(),
          email: editEmail.trim() || undefined,
          agencyName: editAgencyName.trim() || undefined,
          address: editAddress.trim() || undefined,
          routeOrArea: editRouteOrArea.trim() || undefined,
          vehicleType: editVehicleType.trim() || undefined,
          vehiclePlate: editVehiclePlate.trim() || undefined,
        }),
      });
      toast.success('Profile details updated successfully!');
      setIsEditModalOpen(false);
      loadProfile();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      toast.error('Please enter your current password.');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New password and confirmation do not match.');
      return;
    }

    try {
      setChangingPass(true);
      await fetchWithAuth('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });
      toast.success('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to change password');
    } finally {
      setChangingPass(false);
    }
  };

  const fullName = profile ? `${profile.firstName || ''} ${profile.lastName || ''}`.trim() : 'Distributor';
  const isActive = profile?.isActive !== false;
  const referralCode = profile?.distributor?.referralCode || 'NOT_ASSIGNED';
  const pincodes = profile?.distributorPincodes || [];

  return (
    <div className="w-full min-h-full flex flex-col bg-[#F8FAFC] animate-in fade-in duration-150">
      {/* ─── GLOBAL TOPBAR (STANDARD SINGLE HEADER) ────────── */}
      <DistributorTopbar
        title="Distributor Profile"
        subtitle="Manage your personal credentials, operational logistics, and official distributor codes"
        icon={User}
        actions={
          <button
            type="button"
            onClick={openEditModal}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Edit Profile</span>
          </button>
        }
      />

      {/* ─── MAIN CONTENT AREA (FULL-WIDTH ON MOBILE) ──────── */}
      <div className="w-full p-3.5 sm:p-5 lg:p-6 space-y-4 max-w-7xl mx-auto flex-1">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Loader2 className="w-7 h-7 animate-spin text-[#1677C8]" />
            <span className="text-xs font-semibold">Loading profile information...</span>
          </div>
        ) : !profile ? (
          <div className="py-16 text-center text-slate-500 bg-white rounded-2xl border border-slate-200/80 p-6 space-y-2">
            <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
            <p className="font-bold text-sm text-[#16324F]">Profile data unavailable</p>
            <p className="text-xs text-slate-400">Unable to load distributor details. Please refresh or try again.</p>
            <button
              onClick={loadProfile}
              className="mt-2 px-4 py-1.5 bg-[#1677C8] text-white rounded-xl text-xs font-bold"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            {/* ─── 1. OVERVIEW & REFERRAL ID CARD ───────────────── */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#1677C8] to-sky-400 text-white flex items-center justify-center font-extrabold text-xl shadow-md shadow-sky-500/15 shrink-0">
                  {profile.firstName?.[0]?.toUpperCase() || 'D'}
                  {profile.lastName?.[0]?.toUpperCase() || 'P'}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg sm:text-xl font-bold text-[#16324F] truncate">{fullName}</h2>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold shrink-0 ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-red-50 text-red-700 border border-red-200'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      {isActive ? 'Authorized & Active' : 'Account Inactive'}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-[#1677C8] truncate mt-0.5">
                    {profile.distributor?.agencyName || 'Independent Distributor Partner'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>Member since {profile.createdAt ? new Date(profile.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '2026'}</span>
                  </p>
                </div>
              </div>

              {/* Prominent Referral Code Box */}
              <div className="bg-gradient-to-br from-sky-50 to-blue-50/80 p-3.5 rounded-xl border border-sky-200/80 shadow-2xs flex items-center justify-between gap-4 md:min-w-[280px]">
                <div>
                  <div className="flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-[#1677C8]" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#1677C8]">
                      Referral Code
                    </span>
                  </div>
                  <span className="text-xl font-mono font-extrabold text-[#16324F] tracking-wider block mt-1">
                    {referralCode}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyReferral}
                  className="flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-sky-50 text-[#1677C8] rounded-xl text-xs font-bold transition border border-sky-200 shadow-2xs cursor-pointer shrink-0"
                >
                  {copiedCode ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700 font-bold">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Code</span>
                    </>
                  )}
                </button>
              </div>
            </div>


            {/* ─── 2. TWO-COLUMN RESPONSIVE LAYOUT ──────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
              
              {/* ─── LEFT COLUMN: CONTACT & SERVICE PROFILE ──────── */}
              <div className="space-y-4">
                {/* Contact Information Card */}
                <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs space-y-3.5">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-sky-50 text-[#1677C8]">
                        <User className="w-4 h-4" />
                      </div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[#16324F]">
                        Contact & Agency Profile
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={openEditModal}
                      className="text-xs font-bold text-[#1677C8] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Edit</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                    <div>
                      <span className="text-slate-400 font-medium block text-[11px]">Primary Phone</span>
                      <span className="text-[#16324F] font-bold mt-1 block flex items-center gap-1.5 font-mono">
                        <Phone className="w-3.5 h-3.5 text-[#1677C8] shrink-0" />
                        {profile.phone || '—'}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 font-medium block text-[11px]">Email Address</span>
                      <span className="text-[#16324F] font-bold mt-1 block flex items-start gap-1.5 break-all">
                        <Mail className="w-3.5 h-3.5 text-[#1677C8] shrink-0 mt-0.5" />
                        {profile.email || 'No email registered'}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 font-medium block text-[11px]">Agency / Trade Name</span>
                      <span className="text-[#16324F] font-bold mt-1 block flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-[#1677C8] shrink-0" />
                        {profile.distributor?.agencyName || 'Independent Distributor'}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 font-medium block text-[11px]">Account Type</span>
                      <span className="text-[#16324F] font-bold mt-1 block flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        {profile.role || 'DISTRIBUTOR'}
                      </span>
                    </div>

                    <div className="sm:col-span-2">
                      <span className="text-slate-400 font-medium block text-[11px]">Operating Address</span>
                      <span className="text-[#16324F] font-semibold mt-1 block flex items-start gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-[#1677C8] shrink-0 mt-0.5" />
                        {profile.distributor?.address || 'No physical address specified'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Covered Service Areas */}
                <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-sky-50 text-[#1677C8]">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[#16324F]">
                        Covered Service Pincodes ({pincodes.length})
                      </h3>
                    </div>
                  </div>

                  {pincodes.length > 0 ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {pincodes.map((item: any) => (
                        <span
                          key={item.id || item.pincode}
                          className="px-2.5 py-1 bg-slate-50 border border-slate-200/80 rounded-lg text-xs font-mono font-bold text-[#16324F] flex items-center gap-1.5"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span>{item.pincode}</span>
                          {item.location && <span className="text-slate-400 font-normal">({item.location})</span>}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 py-2">
                      No specific delivery pincodes mapped yet. Service areas can be configured under the Service Areas module.
                    </p>
                  )}
                </div>
              </div>

              {/* ─── RIGHT COLUMN: OPERATIONAL & SECURITY ────────── */}
              <div className="space-y-4">
                {/* Operational Logistics Card */}
                <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs space-y-3.5">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                    <div className="p-1.5 rounded-lg bg-sky-50 text-[#1677C8]">
                      <Truck className="w-4 h-4" />
                    </div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#16324F]">
                      Operational Information
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200/80">
                      <span className="text-slate-400 font-medium block text-[11px]">Assigned Route</span>
                      <span className="text-[#16324F] font-bold text-xs mt-1 block flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-[#1677C8] shrink-0" />
                        {profile.distributor?.routeOrArea || 'Standard Delivery Route'}
                      </span>
                    </div>

                    <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200/80">
                      <span className="text-slate-400 font-medium block text-[11px]">Vehicle Details</span>
                      <span className="text-[#16324F] font-bold text-xs mt-1 block flex items-center gap-1">
                        <Truck className="w-3.5 h-3.5 text-[#1677C8] shrink-0" />
                        {profile.distributor?.vehiclePlate
                          ? `${profile.distributor.vehiclePlate} (${profile.distributor.vehicleType || 'Vehicle'})`
                          : 'No vehicle recorded'}
                      </span>
                    </div>
                  </div>

                  {/* Jar Allocation Snapshot */}
                  <div>
                    <span className="text-[11px] font-semibold text-slate-500 block mb-1.5">
                      Jar Inventory & Ownership Pool
                    </span>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/80">
                        <span className="text-[10px] text-slate-400 block font-medium">Model</span>
                        <span className="text-xs font-bold text-[#16324F] mt-0.5 block truncate">
                          {profile.distributor?.jarOwnership === 'DISTRIBUTOR_OWNED'
                            ? 'Partner Owned'
                            : profile.distributor?.jarOwnership === 'MIXED'
                            ? 'Mixed'
                            : 'Company Owned'}
                        </span>
                      </div>

                      <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/80">
                        <span className="text-[10px] text-slate-400 block font-medium">Company Jars</span>
                        <span className="text-sm font-extrabold text-[#1677C8] mt-0.5 block">
                          {profile.distributor?.companyOwnedJars ?? 0}
                        </span>
                      </div>

                      <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/80">
                        <span className="text-[10px] text-slate-400 block font-medium">Partner Jars</span>
                        <span className="text-sm font-extrabold text-purple-600 mt-0.5 block">
                          {profile.distributor?.distributorOwnedJars ?? 0}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Account Security / Change Password Card */}
                <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs space-y-3.5">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                    <div className="p-1.5 rounded-lg bg-sky-50 text-[#1677C8]">
                      <Lock className="w-4 h-4" />
                    </div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#16324F]">
                      Account Security & Credentials
                    </h3>
                  </div>

                  <form onSubmit={handleChangePassword} className="space-y-3 text-xs">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Current Password
                      </label>
                      <div className="relative">
                        <input
                          type={showCurrentPass ? 'text' : 'password'}
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full px-3 py-2 pr-9 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-[#1677C8] transition-all"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPass(!showCurrentPass)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          {showCurrentPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          New Password
                        </label>
                        <div className="relative">
                          <input
                            type={showNewPass ? 'text' : 'password'}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Min 6 characters"
                            className="w-full px-3 py-2 pr-9 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-[#1677C8] transition-all"
                            required
                            minLength={6}
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPass(!showNewPass)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          >
                            {showNewPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Confirm New Password
                        </label>
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Repeat new password"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-[#1677C8] transition-all"
                          required
                          minLength={6}
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="submit"
                        disabled={changingPass}
                        className="px-4 py-2 bg-[#1677C8] hover:bg-[#125ea0] text-white rounded-xl text-xs font-bold transition shadow-2xs disabled:opacity-50 cursor-pointer"
                      >
                        {changingPass ? 'Updating...' : 'Update Password'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>

            </div>
          </>
        )}
      </div>

      {/* ─── EDIT PROFILE MODAL (MOBILE & DESKTOP RESPONSIVE) ── */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-4 py-3.5 sm:px-5 bg-slate-50/80 border-b border-slate-200/80 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#1677C8]/10 text-[#1677C8] flex items-center justify-center font-bold">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Edit Distributor Profile</h3>
                  <p className="text-[11px] text-slate-500">Update your contact information and agency details</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveProfile} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">First Name *</label>
                  <input
                    type="text"
                    value={editFirstName}
                    onChange={(e) => setEditFirstName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-[#1677C8]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Last Name *</label>
                  <input
                    type="text"
                    value={editLastName}
                    onChange={(e) => setEditLastName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-[#1677C8]"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono outline-none focus:bg-white focus:border-[#1677C8]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-[#1677C8]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Agency / Trade Name</label>
                <input
                  type="text"
                  value={editAgencyName}
                  onChange={(e) => setEditAgencyName(e.target.value)}
                  placeholder="e.g. Acme Water Distributors"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-[#1677C8]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Operating Address</label>
                <textarea
                  rows={2}
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  placeholder="Physical warehouse or operating office address"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-[#1677C8] resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Vehicle Type</label>
                  <input
                    type="text"
                    value={editVehicleType}
                    onChange={(e) => setEditVehicleType(e.target.value)}
                    placeholder="Three-Wheeler, Van, etc."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-[#1677C8]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Vehicle Plate</label>
                  <input
                    type="text"
                    value={editVehiclePlate}
                    onChange={(e) => setEditVehiclePlate(e.target.value)}
                    placeholder="KL-07-XX-0000"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-[#1677C8]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Route / Area</label>
                  <input
                    type="text"
                    value={editRouteOrArea}
                    onChange={(e) => setEditRouteOrArea(e.target.value)}
                    placeholder="North Sector"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-[#1677C8]"
                  />
                </div>
              </div>

              <div className="p-3 bg-sky-50 rounded-xl border border-sky-100 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-sky-700 block">Referral Code</span>
                  <span className="text-xs font-mono font-bold text-[#16324F]">{referralCode}</span>
                </div>
                <span className="text-[10px] text-slate-400 italic">Permanent Identifier</span>
              </div>

              {/* Modal Actions */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-[#1677C8] hover:bg-[#125ea0] text-white shadow-xs transition disabled:opacity-50 cursor-pointer"
                >
                  {savingProfile ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
