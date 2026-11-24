import { useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchWithAuth } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
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
  const userRole = user?.role;
  const queryClient = useQueryClient();

  const [editModalOpen, setEditModalOpen] = useState(false);

  const {
    data: profile,
    isLoading: loading,
    refetch,
  } = useQuery({
    queryKey: ['profile', userId, userRole],
    queryFn: async () => {
      try {
        return await fetchWithAuth('/profile');
      } catch {
        return await fetchWithAuth('/auth/me');
      }
    },
    enabled: Boolean(userId),
    staleTime: 0,
  });

  // Controlled, intentional refresh handler (passed to Address CRUD and EditProfileModal)
  const handleRefresh = useCallback(async (updatedData?: any) => {
    if (updatedData) {
      updateUser({
        firstName: updatedData.firstName,
        lastName: updatedData.lastName,
        email: updatedData.email,
        phone: updatedData.phone,
      });
    }

    // Invalidate React Query caches for Dashboard, Header, and Profile
    queryClient.invalidateQueries({ queryKey: ['profile', userId, userRole] });
    queryClient.invalidateQueries({ queryKey: ['userProfile'] });
    queryClient.invalidateQueries({ queryKey: ['customerProfile'] });
    await refetch();
  }, [userId, userRole, queryClient, updateUser, refetch]);

  // Local avatar update without unnecessary network refetch
  const handleAvatarUpdated = useCallback((newUrl: string | null) => {
    updateUser({ avatarUrl: newUrl });
    queryClient.invalidateQueries({ queryKey: ['profile', userId, userRole] });
    refetch();
  }, [userId, userRole, queryClient, updateUser, refetch]);

  if (loading) {
    return <LoadingSpinner fullPage label="Loading profile..." />;
  }

  if (!profile) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-center p-6">
        <p className="text-base font-bold text-slate-800">Profile could not be loaded</p>
        <button
          type="button"
          onClick={() => refetch()}
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
