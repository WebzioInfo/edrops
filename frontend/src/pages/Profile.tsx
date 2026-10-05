import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { fetchWithAuth } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';

import CustomerProfileView from '../components/profile/views/CustomerProfileView';
import DistributorProfileView from '../components/profile/views/DistributorProfileView';
import StaffProfileView from '../components/profile/views/StaffProfileView';
import AdminProfileView from '../components/profile/views/AdminProfileView';
import DeliveryPartnerProfileView from '../components/profile/views/DeliveryPartnerProfileView';
import EditProfileModal from '../components/profile/EditProfileModal';

export default function Profile() {
  const location = useLocation();
  const { user, updateUser } = useAuth();
  const userId = user?.id;

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);

  // Stable profile fetching function
  const fetchProfileData = useCallback(async (signal?: AbortSignal) => {
    try {
      let data: any;
      try {
        data = await fetchWithAuth('/profile', { signal });
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        data = await fetchWithAuth('/auth/me', { signal });
      }

      setProfile(data);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      toast.error(err.message ?? 'Failed to load profile data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Track initial fetch strictly per authenticated user ID
  const hasFetchedForUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    // If profile has already been loaded for this authenticated user, do not refetch
    if (hasFetchedForUserRef.current === userId) return;
    hasFetchedForUserRef.current = userId;

    const controller = new AbortController();
    fetchProfileData(controller.signal);

    return () => {
      controller.abort();
    };
  }, [userId, fetchProfileData]);

  // Controlled, intentional refresh handler (passed to Address CRUD and EditProfileModal)
  const handleRefresh = useCallback(async () => {
    await fetchProfileData();
  }, [fetchProfileData]);

  // Local avatar update without unnecessary network refetch
  const handleAvatarUpdated = useCallback((newUrl: string | null) => {
    setProfile((prev: any) => (prev ? { ...prev, avatarUrl: newUrl } : null));
    updateUser({ avatarUrl: newUrl });
  }, [updateUser]);

  if (loading) {
    return <LoadingSpinner fullPage label="Loading profile..." />;
  }

  if (!profile) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-center p-6">
        <p className="text-base font-bold text-slate-800">Profile could not be loaded</p>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            fetchProfileData();
          }}
          className="mt-3 px-4 py-2 rounded-xl bg-[#1677C8] text-white text-xs font-bold shadow-xs hover:bg-[#125ea0] transition cursor-pointer"
        >
          Try Again
        </button>
      </div>
    );
  }

  // Determine active role template
  const path = location.pathname.toLowerCase();
  const role = (profile.role || '').toUpperCase();

  const isDistributor = path.startsWith('/distributor') || role === 'DISTRIBUTOR';
  const isStaff = path.startsWith('/staff') || role === 'STAFF';
  const isAdmin = path.startsWith('/admin') || role === 'ADMIN' || role === 'SUPER_ADMIN';
  const isDeliveryPartner = path.startsWith('/delivery-partner') || role === 'DELIVERY_PARTNER';

  return (
    <>
      {isDistributor ? (
        <DistributorProfileView
          profile={profile}
          onAvatarUpdated={handleAvatarUpdated}
          onOpenEditModal={() => setEditModalOpen(true)}
        />
      ) : isAdmin ? (
        <AdminProfileView
          profile={profile}
          onAvatarUpdated={handleAvatarUpdated}
          onOpenEditModal={() => setEditModalOpen(true)}
        />
      ) : isStaff ? (
        <StaffProfileView
          profile={profile}
          onAvatarUpdated={handleAvatarUpdated}
          onOpenEditModal={() => setEditModalOpen(true)}
        />
      ) : isDeliveryPartner ? (
        <DeliveryPartnerProfileView
          profile={profile}
          onAvatarUpdated={handleAvatarUpdated}
          onOpenEditModal={() => setEditModalOpen(true)}
        />
      ) : (
        <CustomerProfileView
          profile={profile}
          onAvatarUpdated={handleAvatarUpdated}
          onOpenEditModal={() => setEditModalOpen(true)}
          onRefresh={handleRefresh}
        />
      )}

      {/* Edit Profile Details Modal */}
      <EditProfileModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        profile={profile}
        onSuccess={handleRefresh}
      />
    </>
  );
}
