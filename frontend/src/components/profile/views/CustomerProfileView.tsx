import ProfileHeader from '../ProfileHeader';
import PersonalInformationCard from '../PersonalInformationCard';
import AddressManagementSection from '../AddressManagementSection';
import AccountInformationCard from '../AccountInformationCard';
import SecurityCard from '../SecurityCard';

interface CustomerProfileViewProps {
  profile: any;
  onAvatarUpdated: (url: string | null) => void;
  onOpenEditModal: () => void;
  onRefresh: () => void;
}

export default function CustomerProfileView({
  profile,
  onAvatarUpdated,
  onOpenEditModal,
  onRefresh,
}: CustomerProfileViewProps) {
  const addresses = profile.addresses || profile.customer?.addresses || [];

  return (
    <div className="w-full max-w-5xl mx-auto px-3.5 sm:px-6 lg:px-8 py-5 sm:py-7 pb-24 lg:pb-8 space-y-5 sm:space-y-6 animate-in fade-in duration-150">
      {/* ─── CUSTOMER PAGE HEADER ─────────────────────────────────── */}
      <div className="pb-1 sm:pb-2 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Profile
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Manage your account information and delivery addresses.
          </p>
        </div>
      </div>

      {/* 1. Profile Header with Avatar & Status */}
      <ProfileHeader
        profile={profile}
        onAvatarUpdated={onAvatarUpdated}
        onEditProfileClick={onOpenEditModal}
      />

      {/* 2. Personal Information Card */}
      <PersonalInformationCard
        profile={profile}
        onEditClick={onOpenEditModal}
      />

      {/* 3. Delivery Addresses CRUD (Customer Only) */}
      <AddressManagementSection
        addresses={addresses}
        onRefresh={onRefresh}
      />

      {/* 4. Balanced 2-Column Row: Account Information & Security */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6 items-stretch">
        <AccountInformationCard profile={profile} />
        <SecurityCard email={profile.email} />
      </div>
    </div>
  );
}
