import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { fetchWithAuth } from '../api/client';
import { motion } from 'framer-motion';
import { Shield, Wallet, ShoppingBag, Truck } from 'lucide-react';
import { toast } from 'react-hot-toast';
import AccountDetailsForm from './profile/AccountDetailsForm';
import ChangePasswordForm from './profile/ChangePasswordForm';
import LoadingSpinner from '../components/LoadingSpinner';
import { AdminTopbar } from '../portals/admin/components/AdminTopbar';
import ProfileAvatarSection from '../components/common/ProfileAvatarSection';

interface ProfileData {
  id: string;
  email: string | null;
  phone: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  role: 'CUSTOMER' | 'STAFF' | 'ADMIN' | 'DELIVERY_PARTNER' | 'DISTRIBUTOR';
  customer?: {
    id: string;
    referralCode: string | null;
    wallet?: { balance: number };
    jarBalance?: { availableJars: number; totalPurchased: number };
    jarDeposit?: { maxActiveJars: number; depositPaid: number; depositDue: number };
    jarOwnership?: { companyJarsHeld: number; ownedJars: number };
  };
  staff?: {
    id: string;
    vehicleType: string | null;
    vehiclePlate: string | null;
    branch?: { name: string; location: string };
  };
  deliveryPartner?: {
    id: string;
    vehicleType: string | null;
    vehiclePlate: string | null;
  };
}

export default function Profile() {
  const location = useLocation();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  const isAdmin = location.pathname.startsWith('/admin');

  const loadProfile = async () => {
    try {
      const data = await fetchWithAuth('/auth/me');
      setProfile(data);
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  if (loading) {
    return <LoadingSpinner fullPage label="Loading profile data..." />;
  }

  if (!profile) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <p className="text-xl font-bold text-destructive">Profile not found</p>
      </div>
    );
  }

  return (
    <>
      {isAdmin && (
        /* ─── STANDARDIZED SHARED ADMIN TOPBAR ─────────────────────── */
        <AdminTopbar
          title="Admin Profile"
          subtitle="Manage your personal details, credentials and security settings"
          icon={Shield}
          iconVariant="blue"
          badge={
            <div className="flex items-center gap-1.5 bg-[#1677C8]/10 border border-[#1677C8]/20 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#1677C8]">
              <Shield className="h-3 w-3" />
              <span>{profile.role.replace('_', ' ')}</span>
            </div>
          }
        />
      )}

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-6xl space-y-4 sm:space-y-5 bg-[#F8FAFC]"
      >
      {/* User Quick Info Summary & Profile Picture Management */}
      <ProfileAvatarSection
        currentAvatarUrl={profile.avatarUrl}
        firstName={profile.firstName}
        lastName={profile.lastName}
        email={profile.email}
        role={profile.role}
        onAvatarUpdated={(newAvatarUrl) => {
          setProfile((prev) => (prev ? { ...prev, avatarUrl: newAvatarUrl } : null));
        }}
      />

      <div className="grid gap-6 sm:gap-8 lg:grid-cols-[1.6fr_1fr] items-start pt-2">
        {/* Left Column: Forms - Order 2 on mobile (stacked), Order 1 on desktop */}
        <div className="space-y-6 sm:space-y-8 order-2 lg:order-1">
          <AccountDetailsForm profile={profile} onRefresh={loadProfile} />
          <ChangePasswordForm email={profile.email} />
        </div>

        {/* Right Column: Stats - Order 1 on mobile (stacked), Order 2 on desktop */}
        <div className="space-y-6 sm:space-y-8 order-1 lg:order-2">
          {/* CUSTOMER PORTAL SPECIFIC DETAILS */}
          {profile.role === 'CUSTOMER' && profile.customer && (
            <>
              <div className="bg-gradient-to-br from-[#0F6E8C] to-[#158CA7] text-white rounded-2xl p-6 shadow-md border border-[#0F6E8C]/20 relative overflow-hidden flex flex-col justify-between min-h-[160px]">
                <div className="absolute right-[-20px] top-[-20px] w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none" />
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-sm font-semibold text-white/80 uppercase tracking-wider">Wallet Balance</h3>
                    <p className="text-3xl font-bold mt-2 text-white">
                      ₹{profile.customer.wallet?.balance.toFixed(2) ?? '0.00'}
                    </p>
                  </div>
                  <div className="p-3 bg-white/10 rounded-xl">
                    <Wallet className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center">
                  <span className="text-xs font-medium text-white/85">INR AVAILABLE</span>
                  <a href="/customer/recharge" className="text-xs font-bold text-white bg-white/20 hover:bg-white/30 px-3.5 py-1.5 rounded-lg transition-colors">
                    Recharge Balance
                  </a>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200/85 shadow-sm space-y-5">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                  <ShoppingBag className="h-5 w-5 text-[#0F6E8C]" />
                  <h3 className="text-base font-bold text-[#0F172A]">Hydration Stats</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100/60 text-center sm:text-left">
                    <p className="text-2xl font-bold text-[#0F172A]">{profile.customer.jarBalance?.availableJars ?? 0}</p>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mt-1">
                      Jars Held
                    </p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100/60 text-center sm:text-left">
                    <p className="text-2xl font-bold text-[#0F172A]">{profile.customer.jarBalance?.totalPurchased ?? 0}</p>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mt-1">
                      Total Bought
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* STAFF PORTAL SPECIFIC DETAILS */}
          {profile.role === 'STAFF' && profile.staff && (
            <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200/85 shadow-sm space-y-5">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <Truck className="h-5 w-5 text-[#0F6E8C]" />
                <h3 className="text-base font-bold text-[#0F172A]">Staff Operations</h3>
              </div>

              <div className="space-y-4">
                {profile.staff.branch && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Branch</p>
                    <p className="text-sm font-semibold text-[#0F172A] mt-0.5">{profile.staff.branch.name} ({profile.staff.branch.location})</p>
                  </div>
                )}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Vehicle Type</p>
                  <p className="text-sm font-semibold text-[#0F172A] mt-0.5">{profile.staff.vehicleType ?? 'Not Assigned'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Plate Number</p>
                  <p className="text-sm font-semibold text-[#0F172A] mt-0.5">{profile.staff.vehiclePlate ?? 'Not Assigned'}</p>
                </div>
              </div>
            </div>
          )}

          {/* DELIVERY PARTNER SPECIFIC DETAILS */}
          {profile.role === 'DELIVERY_PARTNER' && profile.deliveryPartner && (
            <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200/85 shadow-sm space-y-5">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <Truck className="h-5 w-5 text-[#0F6E8C]" />
                <h3 className="text-base font-bold text-[#0F172A]">Partner Operations</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Assigned Vehicle</p>
                  <p className="text-sm font-semibold text-[#0F172A] mt-0.5">{profile.deliveryPartner.vehicleType ?? 'Not Assigned'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Vehicle Plate</p>
                  <p className="text-sm font-semibold text-[#0F172A] mt-0.5">{profile.deliveryPartner.vehiclePlate ?? 'Not Assigned'}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
    </>
  );
}
