import { AdminTopbar } from '../../../portals/admin/components/AdminTopbar';
import { Shield } from 'lucide-react';
import ProfileHeader from '../ProfileHeader';
import PersonalInformationCard from '../PersonalInformationCard';
import AdminDetailsCard from '../AdminDetailsCard';
import AccountInformationCard from '../AccountInformationCard';
import SecurityCard from '../SecurityCard';

interface AdminProfileViewProps {
  profile: any;
  onAvatarUpdated: (url: string | null) => void;
  onOpenEditModal: () => void;
}

export default function AdminProfileView({
  profile,
  onAvatarUpdated,
  onOpenEditModal,
}: AdminProfileViewProps) {
  return (
    <>
      <AdminTopbar
        title="Profile"
        subtitle="Manage your administrator account and credentials."
        icon={Shield}
        iconVariant="blue"
      />

      <div className="w-full max-w-[1600px] mx-auto p-3.5 sm:p-6 lg:p-8 space-y-5 sm:space-y-6 animate-in fade-in duration-150">
        {/* 1. Profile Header */}
        <ProfileHeader
          profile={profile}
          onAvatarUpdated={onAvatarUpdated}
          onEditProfileClick={onOpenEditModal}
        />

        {/* 2. Personal Information */}
        <PersonalInformationCard
          profile={profile}
          onEditClick={onOpenEditModal}
        />

        {/* 3. Admin Security & System Permissions */}
        <AdminDetailsCard profile={profile} />

        {/* 4. Balanced 2-Column Row: Account Information & Security */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6 items-stretch">
          <AccountInformationCard profile={profile} />
          <SecurityCard email={profile.email} />
        </div>
      </div>
    </>
  );
}
