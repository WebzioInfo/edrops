import { useState, useEffect } from 'react';
import { fetchWithAuth } from '../api/client';
import { motion } from 'framer-motion';
import { User, Shield, Wallet, ShoppingBag, Truck } from 'lucide-react';
import { toast } from 'react-hot-toast';
import AccountDetailsForm from './profile/AccountDetailsForm';
import ChangePasswordForm from './profile/ChangePasswordForm';

interface ProfileData {
  id: string;
  email: string | null;
  phone: string;
  firstName: string;
  lastName: string;
  role: 'CUSTOMER' | 'STAFF' | 'ADMIN' | 'DELIVERY_PARTNER';
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
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

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
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="relative h-16 w-16 rounded-full water-gradient shadow-2xl shadow-edrops-aqua/30">
          <div className="absolute inset-2 animate-ping rounded-full bg-white/40" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <p className="text-xl font-bold text-destructive">Profile not found</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-6"
    >
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-[-10rem] top-[-10rem] h-[28rem] w-[28rem] rounded-full bg-primary/14 blur-3xl" />
        <div className="absolute right-[-8rem] bottom-[-10rem] h-[26rem] w-[26rem] rounded-full bg-edrops-aqua/12 blur-3xl" />
      </div>

      {/* Main Profile Info Header */}
      <section className="water-shell relative overflow-hidden rounded-[2.5rem] p-6 sm:p-10">
        <div className="absolute inset-x-0 bottom-0 h-32 wave-mask opacity-40" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-background text-primary shadow-xl shadow-primary/20">
              <User className="h-10 w-10 text-primary" />
            </div>
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-background px-3.5 py-1 text-xs font-black uppercase tracking-[0.2em] text-[#245361]">
                <Shield className="h-3.5 w-3.5" />
                {profile.role}
              </span>
              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl text-[#245361]">
                {profile.firstName} {profile.lastName}
              </h1>
              <p className="mt-1 text-sm font-semibold text-[#245361]">
                Manage your personal hydrated profile
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <AccountDetailsForm profile={profile} onRefresh={loadProfile} />
          <ChangePasswordForm email={profile.email} />
        </div>

        {/* Dynamic Context Panel */}
        <div className="space-y-6">
          {/* CUSTOMER PORTAL SPECIFIC DETAILS */}
          {profile.role === 'CUSTOMER' && profile.customer && (
            <>
              <div className="clay-card !bg-primary text-white space-y-4">
                <Wallet className="h-8 w-8 text-white" />
                <div>
                  <h3 className="text-xl text-white font-black">Wallet Balance</h3>
                  <p className="text-4xl font-black mt-2 text-white">
                    ₹{profile.customer.wallet?.balance.toFixed(2) ?? '0.00'}
                  </p>
                  <p className="text-xs font-bold text-white/90 uppercase tracking-widest mt-1">
                    INR AVAILABLE
                  </p>
                </div>
              </div>

              <div className="clay-card space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <h3 className="text-lg font-black flex items-center gap-2">
                    <ShoppingBag className="h-5 w-5 text-primary" />
                    Hydration stats
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="bg-secondary/15 rounded-2xl p-4">
                    <p className="text-2xl font-black">{profile.customer.jarBalance?.availableJars ?? 0}</p>
                    <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mt-1">
                      Jars Held
                    </p>
                  </div>
                  <div className="bg-secondary/15 rounded-2xl p-4">
                    <p className="text-2xl font-black">{profile.customer.jarBalance?.totalPurchased ?? 0}</p>
                    <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mt-1">
                      Total Bought
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* STAFF PORTAL SPECIFIC DETAILS */}
          {profile.role === 'STAFF' && profile.staff && (
            <div className="clay-card space-y-5">
              <h3 className="text-lg font-black flex items-center gap-2 border-b border-border pb-3">
                <Truck className="h-5 w-5 text-primary" />
                Staff Operations
              </h3>

              <div className="space-y-3.5">
                {profile.staff.branch && (
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Branch</p>
                    <p className="text-sm font-semibold">{profile.staff.branch.name} ({profile.staff.branch.location})</p>
                  </div>
                )}
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Vehicle Type</p>
                  <p className="text-sm font-semibold">{profile.staff.vehicleType ?? 'Not Assigned'}</p>
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Plate Number</p>
                  <p className="text-sm font-semibold">{profile.staff.vehiclePlate ?? 'Not Assigned'}</p>
                </div>
              </div>
            </div>
          )}

          {/* DELIVERY PARTNER SPECIFIC DETAILS */}
          {profile.role === 'DELIVERY_PARTNER' && profile.deliveryPartner && (
            <div className="clay-card space-y-5">
              <h3 className="text-lg font-black flex items-center gap-2 border-b border-border pb-3">
                <Truck className="h-5 w-5 text-primary" />
                Partner Operations
              </h3>

              <div className="space-y-3.5">
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Assigned Vehicle</p>
                  <p className="text-sm font-semibold">{profile.deliveryPartner.vehicleType ?? 'Not Assigned'}</p>
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Vehicle Plate</p>
                  <p className="text-sm font-semibold">{profile.deliveryPartner.vehiclePlate ?? 'Not Assigned'}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
