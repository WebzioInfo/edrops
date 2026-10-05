import { DistributorTopbar } from '../../../portals/distributor/components/DistributorTopbar';
import ProfileHeader from '../ProfileHeader';
import DistributorInformationCard from '../DistributorInformationCard';
import DistributorOperationsCard from '../DistributorOperationsCard';
import AccountInformationCard from '../AccountInformationCard';
import SecurityCard from '../SecurityCard';

interface DistributorProfileViewProps {
  profile: any;
  onAvatarUpdated: (url: string | null) => void;
  onOpenEditModal: () => void;
}

export default function DistributorProfileView({
  profile,
  onAvatarUpdated,
  onOpenEditModal,
}: DistributorProfileViewProps) {
  return (
    <>
      {/* ─── STANDARDIZED MANAGEMENT TOPBAR ─────────────────────── */}
      <DistributorTopbar
        title="Profile"
        subtitle="Manage your account and role information."
      />

      {/* ─── FULL-WIDTH MANAGEMENT CONTENT AREA ─────────────────── */}
      <div className="w-full max-w-[1600px] mx-auto p-3.5 sm:p-6 lg:p-8 space-y-5 sm:space-y-6 animate-in fade-in duration-150">
        {/* 1. Profile Header with Avatar, Role & Status Badges */}
        <ProfileHeader
          profile={profile}
          onAvatarUpdated={onAvatarUpdated}
          onEditProfileClick={onOpenEditModal}
        />

        {/* 2. Distributor Agency Details */}
        <DistributorInformationCard
          profile={profile}
          onEditClick={onOpenEditModal}
        />

        {/* 3. Operational Information & Service Areas */}
        <DistributorOperationsCard profile={profile} />

        {/* 4. Balanced 2-Column Row: Account Information & Security */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6 items-stretch">
          <AccountInformationCard profile={profile} />
          <SecurityCard email={profile.email} />
        </div>
      </div>
    </>
  );
}
