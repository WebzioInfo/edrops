import { useState, useEffect, useCallback } from 'react';
import { 
  Phone, 
  Mail, 
  Shield, 
  CheckCircle2, 
  Lock, 
  LogOut, 
  Edit3, 
  RotateCw, 
  AlertCircle,
  Hash,
  Activity
} from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';
import { useAuth } from '../../../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import EditProfileModal from '../components/EditProfileModal';
import ChangePasswordModal from '../components/ChangePasswordModal';
import LoadingSpinner from '../../../components/LoadingSpinner';

export default function Profile() {
  const { user: authUser, updateUser, logout } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchWithAuth('/auth/me');
      setProfile(data);
      if (data) {
        updateUser(data);
      }
    } catch (err: any) {
      console.error('Error fetching profile:', err);
      const msg = err.message || 'Unable to load your profile.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [updateUser]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const activeUser = profile || authUser;

  const firstName = activeUser?.firstName || '';
  const lastName = activeUser?.lastName || '';
  const fullName = `${firstName} ${lastName}`.trim() || 'Delivery Partner';
  const initials = `${firstName[0] || 'D'}${lastName[0] || 'P'}`.toUpperCase();
  const phone = activeUser?.phone || '—';
  const email = activeUser?.email || '—';
  const partnerId = activeUser?.id ? `DP-${activeUser.id.slice(0, 8).toUpperCase()}` : 'DP-00000';
  const isActive = activeUser?.isActive !== false;

  const handleProfileUpdated = (updated: any) => {
    setProfile((prev: any) => ({ ...prev, ...updated }));
    updateUser(updated);
  };

  if (loading && !profile && !authUser) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" label="Loading driver profile..." />
      </div>
    );
  }

  if (error && !profile && !authUser) {
    return (
      <div className="bg-white border border-red-200 rounded-2xl p-8 sm:p-10 text-center shadow-2xs max-w-lg mx-auto my-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-50 text-red-600 mb-3">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-[#16324F] mb-1">Unable to load your profile</h3>
        <p className="text-xs text-[#64748B] mb-5">{error}</p>
        <button
          onClick={loadProfile}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-[#1677C8] hover:bg-[#1362a4] rounded-xl transition cursor-pointer shadow-2xs"
        >
          <RotateCw className="w-3.5 h-3.5" />
          <span>Try Again</span>
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-10 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#16324F] tracking-tight">Profile</h1>
          <p className="text-xs text-[#64748B] mt-0.5">
            Manage your delivery partner account and personal information.
          </p>
        </div>
        <button
          onClick={loadProfile}
          disabled={loading}
          className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#64748B] hover:text-[#16324F] bg-white border border-[#E2E8F0] rounded-xl hover:bg-gray-50 transition cursor-pointer disabled:opacity-50"
          title="Refresh Profile"
        >
          <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#1677C8]' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* ─── HERO PROFILE CARD ──────────────────────────────────── */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Initials Avatar */}
            <div className="h-16 w-16 sm:h-18 sm:w-18 rounded-2xl bg-gradient-to-br from-[#1677C8]/15 to-[#1677C8]/5 text-[#1677C8] border border-[#1677C8]/20 flex items-center justify-center font-black text-xl sm:text-2xl tracking-tight shadow-xs shrink-0">
              {initials}
            </div>

            {/* Identity Info */}
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-bold text-[#16324F] tracking-tight truncate">
                  {fullName}
                </h2>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-[#1677C8] border border-blue-100 shrink-0">
                  <Shield className="w-3 h-3" />
                  <span>Delivery Partner</span>
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <div className="inline-flex items-center gap-1.5 text-emerald-600 font-semibold">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>Online</span>
                </div>
                <span className="text-gray-300">•</span>
                <span className="text-[#64748B] font-mono text-[11px]">{partnerId}</span>
              </div>
            </div>
          </div>

          {/* Edit Profile CTA */}
          <button
            onClick={() => setEditModalOpen(true)}
            className="self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-[#1677C8] hover:bg-[#1362a4] rounded-xl shadow-2xs transition cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit Profile</span>
          </button>
        </div>
      </div>

      {/* ─── SECTION 1: ACCOUNT INFORMATION ──────────────────────── */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold tracking-wider text-[#94A3B8] uppercase px-1">
          Account Information
        </h3>
        <div className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden shadow-2xs divide-y divide-gray-100">
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
            {/* Full Name */}
            <div className="p-4 sm:p-5 space-y-1">
              <span className="text-[11px] font-medium text-[#64748B] uppercase tracking-wider block">
                Full Name
              </span>
              <p className="text-sm font-bold text-[#16324F]">{fullName}</p>
            </div>

            {/* Phone Number */}
            <div className="p-4 sm:p-5 space-y-1">
              <span className="text-[11px] font-medium text-[#64748B] uppercase tracking-wider block">
                Phone Number
              </span>
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <p className="text-sm font-bold text-[#16324F]">{phone}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
            {/* Email Address */}
            <div className="p-4 sm:p-5 space-y-1">
              <span className="text-[11px] font-medium text-[#64748B] uppercase tracking-wider block">
                Email Address
              </span>
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-[#1677C8] shrink-0" />
                <p className="text-sm font-semibold text-[#16324F] truncate">{email}</p>
              </div>
            </div>

            {/* Partner ID */}
            <div className="p-4 sm:p-5 space-y-1">
              <span className="text-[11px] font-medium text-[#64748B] uppercase tracking-wider block">
                Partner ID
              </span>
              <div className="flex items-center gap-2">
                <Hash className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <p className="text-sm font-mono font-bold text-[#16324F]">{partnerId}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── SECTION 2: DELIVERY PARTNER STATUS ───────────────────── */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold tracking-wider text-[#94A3B8] uppercase px-1">
          Delivery Partner Status
        </h3>
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-5 shadow-2xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
            {/* Account Status */}
            <div className="space-y-1 sm:pr-4">
              <span className="text-[11px] font-medium text-[#64748B] uppercase tracking-wider block">
                Account Status
              </span>
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{isActive ? 'Active' : 'Inactive'}</span>
              </div>
            </div>

            {/* Availability */}
            <div className="pt-3 sm:pt-0 sm:px-4 space-y-1">
              <span className="text-[11px] font-medium text-[#64748B] uppercase tracking-wider block">
                Availability
              </span>
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                <span>Online</span>
              </div>
            </div>

            {/* Current Shift */}
            <div className="pt-3 sm:pt-0 sm:pl-4 space-y-1">
              <span className="text-[11px] font-medium text-[#64748B] uppercase tracking-wider block">
                Current Shift
              </span>
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#16324F]">
                <Activity className="w-4 h-4 text-[#1677C8] shrink-0" />
                <span>Active</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── SECTION 3: ACCOUNT SECURITY ─────────────────────────── */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold tracking-wider text-[#94A3B8] uppercase px-1">
          Account Security
        </h3>
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-5 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#16324F]">Password</p>
                <p className="text-xs font-mono text-[#64748B] tracking-wider">••••••••••••</p>
              </div>
            </div>

            <button
              onClick={() => setPasswordModalOpen(true)}
              className="self-start sm:self-auto px-3.5 py-2 text-xs font-semibold text-[#16324F] bg-slate-50 hover:bg-slate-100 border border-[#E2E8F0] rounded-xl transition cursor-pointer"
            >
              Change Password
            </button>
          </div>
        </div>
      </div>

      {/* ─── SECTION 4: ACCOUNT ACTIONS ──────────────────────────── */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold tracking-wider text-[#94A3B8] uppercase px-1">
          Account Actions
        </h3>
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-5 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[#16324F]">Session Management</p>
            <p className="text-[11px] text-[#64748B]">Sign out of your active driver session</p>
          </div>

          <button
            onClick={logout}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-100 rounded-xl transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Log Out</span>
          </button>
        </div>
      </div>

      {/* ─── MODALS ──────────────────────────────────────────────── */}
      <EditProfileModal
        isOpen={editModalOpen}
        user={activeUser}
        onClose={() => setEditModalOpen(false)}
        onSuccess={handleProfileUpdated}
      />

      <ChangePasswordModal
        isOpen={passwordModalOpen}
        onClose={() => setPasswordModalOpen(false)}
      />
    </div>
  );
}
