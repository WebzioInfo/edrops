import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users,
  Search,
  RefreshCw,
  Phone,
  Mail,
  MapPin,
  Building2,
  User,
  Sparkles,
  Share2,
  Copy,
  Check,
  Wallet,
  MessageCircle,
  ExternalLink,
  X,
  Package,
  Send,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';
import { showToast } from '../../../utils/toast';
import { DistributorTopbar } from '../components/DistributorTopbar';
import { useDistributor } from '../context/DistributorContext';
import { EdropsPageLoader } from '../../../components/common/EdropsPageLoader';

export interface CustomerRecord {
  id: string;
  userId: string;
  referralCode?: string | null;
  source?: string | null;
  createdById?: string | null;
  customerType?: string | null;
  companyName?: string | null;
  gstNumber?: string | null;
  contactPerson?: string | null;
  jarsAtCustomer?: number;
  jars_at_customer?: number;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    createdAt?: string;
  };
  addresses?: Array<{
    id: string;
    houseName?: string;
    buildingName?: string;
    street?: string;
    area?: string;
    city?: string;
    district?: string;
    state?: string;
    zipCode?: string;
    isDefault?: boolean;
    latitude?: number | null;
    longitude?: number | null;
    googleMapsUrl?: string | null;
  }>;
  wallet?: {
    id: string;
    balance: number | string;
  } | null;
  jarBalances?: Array<{
    id: string;
    balance: number;
  }>;
  deliverySchedule?: {
    id: string;
    isActive: boolean;
    frequency?: string;
    rules?: Array<{
      dayOfWeek: number;
      jarQuantity: number;
    }>;
  } | null;
  acquisitionType?: 'REFERRAL_CODE' | 'DIRECT_ONBOARD' | 'ORGANIC' | 'OTHER_REFERRAL';
  isReferralMatch?: boolean;
  isDirectOnboard?: boolean;
  referredByDistributorName?: string | null;
  referralInfo?: {
    code: string;
    distributorName: string;
  } | null;
}

export default function DistributorCustomers() {
  const { referralCode, openQuickCustomerModal } = useDistributor();
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [search, setSearch] = useState<string>('');
  const [filterTab, setFilterTab] = useState<'ALL' | 'REFERRAL' | 'DIRECT'>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'RESIDENTIAL' | 'COMMERCIAL'>('ALL');

  // Detail Modal State
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRecord | null>(null);
  const [resendingEmail, setResendingEmail] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  const cleanMyReferralCode = useMemo(() => {
    return (referralCode && referralCode !== 'NOT_ASSIGNED') ? referralCode.trim().toUpperCase() : null;
  }, [referralCode]);

  const loadCustomers = useCallback(async (showLoadingSpinner = true) => {
    try {
      if (showLoadingSpinner) setIsLoading(true);
      else setIsRefreshing(true);

      const data = await fetchWithAuth('/customer');
      if (Array.isArray(data)) {
        setCustomers(data);
      } else {
        setCustomers([]);
      }
    } catch (err: any) {
      showToast.error(err.message || 'Failed to load customers');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadCustomers(true);
  }, [loadCustomers]);

  // Copy referral code
  const handleCopyCode = async () => {
    if (!cleanMyReferralCode) return;
    try {
      await navigator.clipboard.writeText(cleanMyReferralCode);
      setCopiedCode(true);
      showToast.success(`Referral code ${cleanMyReferralCode} copied to clipboard!`);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      showToast.error('Failed to copy code to clipboard');
    }
  };

  // Copy or share registration link
  const handleCopyShareLink = async () => {
    if (!cleanMyReferralCode) return;
    const shareUrl = `${window.location.origin}/register?ref=${cleanMyReferralCode}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Join eDrops Water Delivery',
          text: `Use my referral code ${cleanMyReferralCode} to sign up for fresh water delivery:`,
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setCopiedLink(true);
        showToast.success('Referral registration link copied to clipboard!');
        setTimeout(() => setCopiedLink(false), 2000);
      }
    } catch {
      // User cancelled share dialog or clipboard error
    }
  };

  // Resend welcome onboarding email
  const handleResendWelcome = async (customerId: string, email: string) => {
    try {
      setResendingEmail(true);
      const res = await fetchWithAuth('/customer/onboarding/resend', {
        method: 'POST',
        body: JSON.stringify({ customerId }),
      });
      if (res?.emailSent || res?.success) {
        showToast.success(`Welcome & activation email resent to ${email}`);
      } else {
        showToast.error(res?.message || 'Failed to send welcome email');
      }
    } catch (err: any) {
      showToast.error(err.message || 'Failed to send welcome email');
    } finally {
      setResendingEmail(false);
    }
  };

  // Helper to test if a customer used this distributor's referral code
  const isCustomerReferredByCode = useCallback((cust: CustomerRecord) => {
    if (cust.isReferralMatch === true) return true;
    if (cust.acquisitionType === 'REFERRAL_CODE') return true;
    if (cleanMyReferralCode && cust.source && cust.source.trim().toUpperCase() === cleanMyReferralCode) {
      return true;
    }
    return false;
  }, [cleanMyReferralCode]);

  // Helper to test if a customer was created directly by this distributor
  const isCustomerDirectOnboard = useCallback((cust: CustomerRecord) => {
    if (cust.isDirectOnboard === true) return true;
    if (cust.acquisitionType === 'DIRECT_ONBOARD') return true;
    return false;
  }, []);

  // Filtered customers
  const filteredCustomers = useMemo(() => {
    return customers.filter((cust) => {
      // Tab filter
      if (filterTab === 'REFERRAL' && !isCustomerReferredByCode(cust)) {
        return false;
      }
      if (filterTab === 'DIRECT' && !isCustomerDirectOnboard(cust)) {
        return false;
      }

      // Customer type filter
      if (typeFilter !== 'ALL') {
        const cType = (cust.customerType || 'RESIDENTIAL').toUpperCase();
        if (cType !== typeFilter) return false;
      }

      // Search term
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const fullName = `${cust.user?.firstName || ''} ${cust.user?.lastName || ''}`.toLowerCase();
        const phone = (cust.user?.phone || '').toLowerCase();
        const email = (cust.user?.email || '').toLowerCase();
        const company = (cust.companyName || '').toLowerCase();
        const sourceCode = (cust.source || '').toLowerCase();
        const address = cust.addresses?.map((a) => `${a.street || ''} ${a.area || ''} ${a.city || ''}`).join(' ').toLowerCase() || '';

        return (
          fullName.includes(q) ||
          phone.includes(q) ||
          email.includes(q) ||
          company.includes(q) ||
          sourceCode.includes(q) ||
          address.includes(q)
        );
      }

      return true;
    });
  }, [customers, filterTab, typeFilter, search, isCustomerReferredByCode, isCustomerDirectOnboard]);

  // Statistics
  const stats = useMemo(() => {
    const total = customers.length;
    let referralCount = 0;
    let directCount = 0;
    let totalJarsInField = 0;

    customers.forEach((c) => {
      if (isCustomerReferredByCode(c)) referralCount++;
      if (isCustomerDirectOnboard(c)) directCount++;
      totalJarsInField += (c.jars_at_customer || c.jarsAtCustomer || 0);
    });

    return { total, referralCount, directCount, totalJarsInField };
  }, [customers, isCustomerReferredByCode, isCustomerDirectOnboard]);

  return (
    <div className="w-full min-h-full flex flex-col bg-[#F8FAFC]">
      {/* ─── Standard Topbar ────────────────────────────────────────── */}
      <DistributorTopbar
        title="Customers & Referrals"
        subtitle="Manage customer relationships, track referral signups, and monitor field jar balances"
        icon={Users}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => loadCustomers(false)}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-[#E2E8F0] hover:bg-slate-50 rounded-lg transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
              title="Refresh customer list"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#1677C8]' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        }
      />

      <div className="p-3.5 sm:p-6 max-w-7xl w-full mx-auto space-y-4 sm:space-y-6">
        {/* ─── REFERRAL CODE SHARE HERO BANNER ──────────────────────── */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#16324F] via-[#1E3A8A] to-[#0F172A] text-white p-4 sm:p-6 shadow-md border border-slate-700/50">
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1.5 max-w-xl">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Your Distributor Referral Code</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                Share & Earn with Your Referral Network
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                When customers register with your code, they are permanently assigned to your territory. 
                You fulfill their orders, supply jars, and track their repeat deliveries right here.
              </p>
            </div>

            {/* Code Box & Actions */}
            <div className="w-full md:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 bg-white/10 backdrop-blur-md p-2.5 sm:p-3 rounded-xl border border-white/15">
              <div className="flex items-center justify-between sm:justify-start gap-3 px-3 py-2 bg-white/15 rounded-lg border border-white/20">
                <span className="text-[11px] uppercase tracking-wider text-slate-300 font-semibold">Your Code:</span>
                <span className="font-mono text-base sm:text-lg font-black tracking-wider text-amber-300">
                  {cleanMyReferralCode || 'GENERATING...'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyCode}
                  disabled={!cleanMyReferralCode}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-white text-[#16324F] hover:bg-slate-100 rounded-lg text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
                  title="Copy Referral Code"
                >
                  {copiedCode ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyShareLink}
                  disabled={!cleanMyReferralCode}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-[#1677C8] hover:bg-[#1263a8] text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
                  title="Share Registration Link"
                >
                  {copiedLink ? <Check className="w-4 h-4 text-white" /> : <Share2 className="w-4 h-4" />}
                  <span>{copiedLink ? 'Link Copied' : 'Share Link'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ─── METRIC STAT CARDS ────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-[#E2E8F0] shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#64748B]">Total Customers</span>
              <div className="p-2 rounded-lg bg-blue-50 text-[#1677C8]">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-[#16324F]">{stats.total}</span>
              <span className="text-[11px] text-[#64748B]">connected</span>
            </div>
          </div>

          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-indigo-100 shadow-xs relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-50/50 rounded-full -mr-4 -mt-4 pointer-events-none" />
            <div className="flex items-center justify-between relative">
              <span className="text-xs font-medium text-indigo-900">Referral Signups</span>
              <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                <Sparkles className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2 relative">
              <span className="text-2xl font-black text-indigo-900">{stats.referralCount}</span>
              <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                Used Your Code
              </span>
            </div>
          </div>

          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-[#E2E8F0] shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#64748B]">Direct Onboards</span>
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-[#16324F]">{stats.directCount}</span>
              <span className="text-[11px] text-[#64748B]">created by you</span>
            </div>
          </div>

          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-[#E2E8F0] shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#64748B]">Jars in Field</span>
              <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
                <Package className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-[#16324F]">{stats.totalJarsInField}</span>
              <span className="text-[11px] text-[#64748B]">with customers</span>
            </div>
          </div>
        </div>

        {/* ─── CONTROLS & FILTER BAR ───────────────────────────────── */}
        <div className="bg-white p-3 sm:p-4 rounded-xl border border-[#E2E8F0] shadow-xs space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg overflow-x-auto">
              <button
                type="button"
                onClick={() => setFilterTab('ALL')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  filterTab === 'ALL'
                    ? 'bg-white text-[#16324F] shadow-xs'
                    : 'text-[#64748B] hover:text-[#16324F]'
                }`}
              >
                All Customers ({stats.total})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('REFERRAL')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  filterTab === 'REFERRAL'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-indigo-600 hover:bg-indigo-50'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Referral Signups ({stats.referralCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('DIRECT')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  filterTab === 'DIRECT'
                    ? 'bg-white text-[#16324F] shadow-xs'
                    : 'text-[#64748B] hover:text-[#16324F]'
                }`}
              >
                Direct Onboarded ({stats.directCount})
              </button>
            </div>

            {/* Customer Type Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#64748B] font-medium hidden sm:inline">Type:</span>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                aria-label="Filter by customer type"
                className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1677C8] cursor-pointer"
              >
                <option value="ALL">All Types</option>
                <option value="RESIDENTIAL">Residential</option>
                <option value="COMMERCIAL">Commercial / Office</option>
              </select>
            </div>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by customer name, phone, email, locality, or referral code..."
              className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-slate-50 border border-[#E2E8F0] rounded-lg text-[#16324F] placeholder-[#94A3B8] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1677C8] transition-colors"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* ─── CUSTOMER LIST CONTENT ────────────────────────────────── */}
        {isLoading ? (
          <div className="p-8 bg-white rounded-xl border border-[#E2E8F0]">
            <EdropsPageLoader label="Loading your customer network..." />
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-[#CBD5E1] p-10 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-[#64748B]">
              <Users className="w-6 h-6" />
            </div>
            <div className="space-y-1 max-w-sm mx-auto">
              <h3 className="text-base font-bold text-[#16324F]">
                {search || filterTab !== 'ALL' || typeFilter !== 'ALL'
                  ? 'No matching customers found'
                  : 'No customers connected yet'}
              </h3>
              <p className="text-xs text-[#64748B]">
                {search || filterTab !== 'ALL' || typeFilter !== 'ALL'
                  ? 'Try clearing your search query or filters to see all customers.'
                  : 'Share your referral code or click Quick Add Customer above to onboard your first customer!'}
              </p>
            </div>
            {!search && filterTab === 'ALL' && (
              <button
                type="button"
                onClick={openQuickCustomerModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1677C8] hover:bg-[#1263a8] text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <User className="w-4 h-4" />
                <span>Onboard First Customer</span>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {/* Desktop Table */}
            <div className="hidden lg:block bg-white rounded-xl border border-[#E2E8F0] shadow-xs overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-slate-50/75 text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Referral / Attribution</th>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4">Delivery Area</th>
                    <th className="py-3 px-4 text-center">Jars with Cust</th>
                    <th className="py-3 px-4 text-center">Wallet</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] text-xs">
                  {filteredCustomers.map((cust) => {
                    const isReferral = isCustomerReferredByCode(cust);
                    const isDirect = isCustomerDirectOnboard(cust);
                    const defaultAddr = cust.addresses?.find((a) => a.isDefault) || cust.addresses?.[0];
                    const fullAddr = defaultAddr ? [defaultAddr.street, defaultAddr.area, defaultAddr.city].filter(Boolean).join(', ') : 'No address on file';
                    const jarsCount = cust.jars_at_customer || cust.jarsAtCustomer || 0;
                    const walletBal = cust.wallet ? Number(cust.wallet.balance) : 0;
                    const customerName = `${cust.user?.firstName || ''} ${cust.user?.lastName || ''}`.trim() || cust.companyName || 'Valued Customer';

                    return (
                      <tr key={cust.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-[#16324F] shrink-0 border border-slate-200">
                              {cust.customerType === 'COMMERCIAL' || cust.customerType === 'OFFICE' ? (
                                <Building2 className="w-4 h-4 text-[#1677C8]" />
                              ) : (
                                <User className="w-4 h-4 text-slate-600" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-[#16324F] truncate hover:text-[#1677C8] cursor-pointer" onClick={() => setSelectedCustomer(cust)}>
                                {customerName}
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[10px] font-semibold uppercase px-1.5 py-0.2 rounded bg-slate-100 text-[#64748B]">
                                  {cust.customerType || 'Residential'}
                                </span>
                                {cust.companyName && (
                                  <span className="text-[11px] text-[#64748B] truncate max-w-[140px]">
                                    {cust.companyName}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          {isReferral ? (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold text-[11px]">
                              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                              <span>Code: {cust.source || cleanMyReferralCode}</span>
                            </div>
                          ) : isDirect ? (
                            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold text-[11px]">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                              <span>Direct Onboard</span>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px]">
                              <span>Territory / Orders</span>
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                              <Phone className="w-3 h-3 text-slate-400" />
                              <a href={`tel:${cust.user?.phone}`} className="hover:text-[#1677C8] hover:underline">
                                {cust.user?.phone || 'No phone'}
                              </a>
                            </div>
                            {cust.user?.email && (
                              <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                                <Mail className="w-3 h-3 text-slate-400" />
                                <span className="truncate max-w-[150px]">{cust.user.email}</span>
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 max-w-[200px]">
                          <div className="flex items-start gap-1.5 text-slate-600">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                            <span className="truncate" title={fullAddr}>{fullAddr}</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-xs ${
                            jarsCount > 0 ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-slate-100 text-slate-600'
                          }`}>
                            <Package className="w-3 h-3" />
                            <span>{jarsCount}</span>
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <span className="font-semibold text-slate-700">
                            ₹{walletBal.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {cust.user?.phone && (
                              <a
                                href={`https://wa.me/${cust.user.phone.replace(/[^0-9]/g, '')}`}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                                title="WhatsApp Customer"
                              >
                                <MessageCircle className="w-4 h-4" />
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => setSelectedCustomer(cust)}
                              className="px-2.5 py-1 text-xs font-semibold text-[#1677C8] hover:bg-blue-50 rounded-lg transition cursor-pointer"
                            >
                              Details
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:hidden gap-3">
              {filteredCustomers.map((cust) => {
                const isReferral = isCustomerReferredByCode(cust);
                const isDirect = isCustomerDirectOnboard(cust);
                const defaultAddr = cust.addresses?.find((a) => a.isDefault) || cust.addresses?.[0];
                const fullAddr = defaultAddr ? [defaultAddr.street, defaultAddr.area, defaultAddr.city].filter(Boolean).join(', ') : 'No address on file';
                const jarsCount = cust.jars_at_customer || cust.jarsAtCustomer || 0;
                const walletBal = cust.wallet ? Number(cust.wallet.balance) : 0;
                const customerName = `${cust.user?.firstName || ''} ${cust.user?.lastName || ''}`.trim() || cust.companyName || 'Valued Customer';

                return (
                  <div
                    key={cust.id}
                    className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-[#16324F] shrink-0 border border-slate-200">
                          {cust.customerType === 'COMMERCIAL' || cust.customerType === 'OFFICE' ? (
                            <Building2 className="w-4 h-4 text-[#1677C8]" />
                          ) : (
                            <User className="w-4 h-4 text-slate-600" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4
                            className="font-bold text-sm text-[#16324F] truncate cursor-pointer hover:text-[#1677C8]"
                            onClick={() => setSelectedCustomer(cust)}
                          >
                            {customerName}
                          </h4>
                          <span className="text-[10px] font-semibold uppercase px-1.5 py-0.2 rounded bg-slate-100 text-[#64748B]">
                            {cust.customerType || 'Residential'}
                          </span>
                        </div>
                      </div>

                      {isReferral ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold text-[10px] shrink-0">
                          <Sparkles className="w-3 h-3 text-indigo-500" />
                          <span>Referral</span>
                        </span>
                      ) : isDirect ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold text-[10px] shrink-0">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          <span>Direct</span>
                        </span>
                      ) : null}
                    </div>

                    <div className="space-y-1 text-xs text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <a href={`tel:${cust.user?.phone}`} className="font-semibold text-slate-700">
                          {cust.user?.phone || 'No phone'}
                        </a>
                      </div>
                      <div className="flex items-start gap-1.5 text-slate-500 text-[11px]">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span className="truncate">{fullAddr}</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        <div>
                          <span className="text-[10px] uppercase text-slate-400 font-semibold block">Jars Held</span>
                          <span className="font-bold text-[#16324F]">{jarsCount} Jars</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase text-slate-400 font-semibold block">Wallet</span>
                          <span className="font-bold text-[#16324F]">₹{walletBal}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {cust.user?.phone && (
                          <a
                            href={`https://wa.me/${cust.user.phone.replace(/[^0-9]/g, '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                            title="WhatsApp"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => setSelectedCustomer(cust)}
                          className="px-2.5 py-1 text-xs font-semibold text-[#1677C8] bg-blue-50 hover:bg-blue-100 rounded-lg transition cursor-pointer"
                        >
                          View
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ─── CUSTOMER DETAIL MODAL ──────────────────────────────────── */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0] shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#1677C8]/10 text-[#1677C8] flex items-center justify-center font-bold">
                  {selectedCustomer.customerType === 'COMMERCIAL' || selectedCustomer.customerType === 'OFFICE' ? (
                    <Building2 className="w-5 h-5" />
                  ) : (
                    <User className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#16324F]">
                    {`${selectedCustomer.user?.firstName || ''} ${selectedCustomer.user?.lastName || ''}`.trim() || selectedCustomer.companyName || 'Customer Details'}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-slate-100 text-[#64748B]">
                      {selectedCustomer.customerType || 'Residential'}
                    </span>
                    {isCustomerReferredByCode(selectedCustomer) && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                        Referred by You
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Attribution Callout */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Attribution & Onboarding
                </div>
                <div className="text-slate-700">
                  {isCustomerReferredByCode(selectedCustomer) ? (
                    <span className="font-semibold text-indigo-700">
                      Registered using your referral code <span className="font-mono bg-indigo-100 px-1 rounded">{selectedCustomer.source || cleanMyReferralCode}</span>
                    </span>
                  ) : isCustomerDirectOnboard(selectedCustomer) ? (
                    <span className="font-semibold text-emerald-700">
                      Onboarded directly by your agency
                    </span>
                  ) : (
                    <span>Assigned to your territory</span>
                  )}
                </div>
              </div>

              {/* Contact Information */}
              <div className="space-y-2">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Contact Details</div>
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Phone</span>
                    <a href={`tel:${selectedCustomer.user?.phone}`} className="font-bold text-slate-800 hover:text-[#1677C8]">
                      {selectedCustomer.user?.phone || 'N/A'}
                    </a>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Email</span>
                    <span className="font-bold text-slate-800 break-all">
                      {selectedCustomer.user?.email || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Delivery Address */}
              <div className="space-y-2">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Delivery Address</div>
                {selectedCustomer.addresses && selectedCustomer.addresses.length > 0 ? (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                    {selectedCustomer.addresses.map((addr) => {
                      const full = [addr.houseName, addr.buildingName, addr.street, addr.area, addr.city, addr.district, addr.state, addr.zipCode].filter(Boolean).join(', ');
                      return (
                        <div key={addr.id} className="space-y-1">
                          <div className="flex items-start gap-1.5 text-slate-700 font-medium">
                            <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                            <span>{full}</span>
                          </div>
                          {addr.googleMapsUrl && (
                            <a
                              href={addr.googleMapsUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[#1677C8] hover:underline font-semibold text-[11px] ml-5"
                            >
                              <span>View on Google Maps</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-slate-400 italic">No delivery address saved.</p>
                )}
              </div>

              {/* Jars & Wallet Balances */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100">
                  <div className="flex items-center gap-1.5 text-[#1677C8] font-bold text-[11px]">
                    <Package className="w-3.5 h-3.5" />
                    <span>Jars with Customer</span>
                  </div>
                  <div className="mt-1 text-xl font-black text-[#16324F]">
                    {selectedCustomer.jars_at_customer || selectedCustomer.jarsAtCustomer || 0}
                  </div>
                </div>

                <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100">
                  <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-[11px]">
                    <Wallet className="w-3.5 h-3.5" />
                    <span>Wallet Balance</span>
                  </div>
                  <div className="mt-1 text-xl font-black text-[#16324F]">
                    ₹{selectedCustomer.wallet ? Number(selectedCustomer.wallet.balance).toLocaleString('en-IN') : '0'}
                  </div>
                </div>
              </div>

              {/* Delivery Schedule Info */}
              {selectedCustomer.deliverySchedule && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Delivery Schedule</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      selectedCustomer.deliverySchedule.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {selectedCustomer.deliverySchedule.isActive ? 'Active' : 'Paused'}
                    </span>
                  </div>
                  <p className="text-slate-700">
                    Frequency: <span className="font-semibold">{selectedCustomer.deliverySchedule.frequency || 'Custom Schedule'}</span>
                  </p>
                </div>
              )}
            </div>

            {/* Footer with Actions */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-[#E2E8F0] bg-slate-50/75 shrink-0">
              {selectedCustomer.user?.email && (
                <button
                  type="button"
                  onClick={() => handleResendWelcome(selectedCustomer.id, selectedCustomer.user.email)}
                  disabled={resendingEmail}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-[#E2E8F0] hover:bg-slate-50 rounded-lg transition shadow-xs disabled:opacity-50 cursor-pointer"
                  title="Resend account setup & activation email"
                >
                  {resendingEmail ? <Loader2 className="w-3.5 h-3.5 animate-spin text-[#1677C8]" /> : <Send className="w-3.5 h-3.5" />}
                  <span>Resend Welcome Email</span>
                </button>
              )}

              <div className="flex items-center gap-2 ml-auto">
                {selectedCustomer.user?.phone && (
                  <a
                    href={`https://wa.me/${selectedCustomer.user.phone.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-xs"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedCustomer(null)}
                  className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
