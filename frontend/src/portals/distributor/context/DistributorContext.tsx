import React, { createContext, useContext, useState, useEffect } from 'react';
import { fetchWithAuth } from '../../../api/client';
import QuickCustomerModal from '../components/QuickCustomerModal';

export interface DistributorContextType {
  profile: any;
  loadingProfile: boolean;
  referralCode: string | null;
  distributorName: string | null;
  openQuickCustomerModal: () => void;
  closeQuickCustomerModal: () => void;
  reloadProfile: () => Promise<void>;
}

const DistributorContext = createContext<DistributorContextType | null>(null);

export const DistributorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profile, setProfile] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const loadProfile = async () => {
    try {
      setLoadingProfile(true);
      const data = await fetchWithAuth('/auth/me');
      setProfile(data);
    } catch {
      // ignore
    } finally {
      setLoadingProfile(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const referralCode = profile?.distributor?.referralCode || null;
  const distributorName = profile
    ? `${profile.firstName || ''} ${profile.lastName || ''}`.trim()
    : null;

  return (
    <DistributorContext.Provider
      value={{
        profile,
        loadingProfile,
        referralCode,
        distributorName,
        openQuickCustomerModal: () => setIsModalOpen(true),
        closeQuickCustomerModal: () => setIsModalOpen(false),
        reloadProfile: loadProfile,
      }}
    >
      {children}
      <QuickCustomerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        referralCode={referralCode}
        distributorName={distributorName}
      />
    </DistributorContext.Provider>
  );
};

export const useDistributor = () => {
  const context = useContext(DistributorContext);
  if (!context) {
    return {
      profile: null,
      loadingProfile: false,
      referralCode: null,
      distributorName: null,
      openQuickCustomerModal: () => {},
      closeQuickCustomerModal: () => {},
      reloadProfile: async () => {},
    };
  }
  return context;
};
