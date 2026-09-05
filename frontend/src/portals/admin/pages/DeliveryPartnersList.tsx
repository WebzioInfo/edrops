import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Truck, 
  Plus, 
  Search, 
  X, 
  Phone, 
  Mail, 
  ChevronRight, 
  RotateCw,
  Edit2,
  Edit3,
  Activity,
  UserCheck,
  UserX
} from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';
import LoadingSpinner from '../../../components/LoadingSpinner';
import { DataErrorState } from '../../../components/common/DataErrorState';
import UserFormModal, { type UserRecord } from '../components/UserFormModal';
import DeliveryPartnerDetailModal from '../components/DeliveryPartnerDetailModal';
import QuickJarPriceEditModal from '../components/QuickJarPriceEditModal';
import { toast } from 'react-hot-toast';

export default function DeliveryPartnersList() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [availabilityFilter, setAvailabilityFilter] = useState<'ALL' | 'ONLINE' | 'OFFLINE'>('ALL');

  // Modals state
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<UserRecord | null>(null);
  const [detailPartner, setDetailPartner] = useState<any | null>(null);
  const [priceEditPartner, setPriceEditPartner] = useState<any | null>(null);

  const { data: partners = [], isLoading, isError, error, isFetching, refetch } = useQuery({
    queryKey: ['adminDeliveryPartners'],
    queryFn: () => fetchWithAuth('/admin/delivery-partners'),
  });

  const filteredPartners = useMemo(() => {
    const term = search.toLowerCase().trim();

    return partners.filter((p: any) => {
      const fullName = (p.fullName || `${p.firstName || ''} ${p.lastName || ''}`).toLowerCase();
      const phone = p.phone || '';
      const email = (p.email || '').toLowerCase();
      const id = (p.id || '').toLowerCase();
      const plate = (p.deliveryPartner?.vehiclePlate || '').toLowerCase();

      const matchesSearch = 
        !term ||
        fullName.includes(term) ||
        phone.includes(term) ||
        email.includes(term) ||
        id.includes(term) ||
        plate.includes(term);

      if (!matchesSearch) return false;

      // Status
      if (statusFilter === 'ACTIVE' && p.isActive === false) return false;
      if (statusFilter === 'INACTIVE' && p.isActive !== false) return false;

      // Availability
      if (availabilityFilter === 'ONLINE' && p.isActive === false) return false;
      if (availabilityFilter === 'OFFLINE' && p.isActive !== false) return false;

      return true;
    });
  }, [partners, search, statusFilter, availabilityFilter]);

  const handleOpenCreate = () => {
    setUserToEdit(null);
    setFormModalOpen(true);
  };

  const handleOpenEdit = (partner: any) => {
    setUserToEdit(partner);
    setFormModalOpen(true);
  };

  const handleToggleStatus = async (e: React.MouseEvent, partner: any) => {
    e.stopPropagation();
    try {
      const newStatus = !partner.isActive;
      await fetchWithAuth(`/admin/users/${partner.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: newStatus }),
      });
      toast.success(`Partner ${newStatus ? 'activated' : 'deactivated'} successfully`);
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update partner status');
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      
      {/* ─── PAGE HEADER ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#16324F] tracking-tight">
            Delivery Partners
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5">
            Manage drivers, delivery partners, their availability, contact information and delivery activity.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2 text-[#64748B] hover:text-[#1677C8] bg-white hover:bg-slate-50 border border-[#E2E8F0] rounded-xl transition cursor-pointer disabled:opacity-50"
            title="Refresh Delivery Partners"
          >
            <RotateCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-[#1677C8]' : ''}`} />
          </button>

          {/* Add Delivery Partner CTA */}
          <button 
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 bg-[#1677C8] hover:bg-[#1362a4] text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-2xs transition-all active:scale-[0.98] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Delivery Partner</span>
          </button>
        </div>
      </div>

      {/* ─── TOOLBAR & SEARCH / FILTERS ─────────────────────────── */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-3 sm:p-4 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          
          {/* Search Input Bar */}
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search by name, phone or partner ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-9 py-2 text-xs sm:text-sm bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl outline-none focus:bg-white focus:border-[#1677C8] focus:ring-2 focus:ring-[#1677C8]/10 transition-all text-[#16324F] placeholder:text-gray-400 font-medium"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status & Availability Filter Pills */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {/* Status Segment */}
            <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200/60">
              <button
                type="button"
                onClick={() => setStatusFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer text-[11px] ${
                  statusFilter === 'ALL'
                    ? 'bg-white text-[#1677C8] shadow-2xs font-bold'
                    : 'text-[#64748B] hover:text-[#16324F]'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('ACTIVE')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer text-[11px] ${
                  statusFilter === 'ACTIVE'
                    ? 'bg-white text-emerald-700 shadow-2xs font-bold'
                    : 'text-[#64748B] hover:text-[#16324F]'
                }`}
              >
                Active
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('INACTIVE')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer text-[11px] ${
                  statusFilter === 'INACTIVE'
                    ? 'bg-white text-rose-700 shadow-2xs font-bold'
                    : 'text-[#64748B] hover:text-[#16324F]'
                }`}
              >
                Inactive
              </button>
            </div>

            {/* Availability Segment */}
            <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200/60">
              <button
                type="button"
                onClick={() => setAvailabilityFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer text-[11px] ${
                  availabilityFilter === 'ALL'
                    ? 'bg-white text-[#1677C8] shadow-2xs font-bold'
                    : 'text-[#64748B] hover:text-[#16324F]'
                }`}
              >
                All States
              </button>
              <button
                type="button"
                onClick={() => setAvailabilityFilter('ONLINE')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer text-[11px] ${
                  availabilityFilter === 'ONLINE'
                    ? 'bg-white text-emerald-700 shadow-2xs font-bold'
                    : 'text-[#64748B] hover:text-[#16324F]'
                }`}
              >
                Online
              </button>
              <button
                type="button"
                onClick={() => setAvailabilityFilter('OFFLINE')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer text-[11px] ${
                  availabilityFilter === 'OFFLINE'
                    ? 'bg-white text-gray-700 shadow-2xs font-bold'
                    : 'text-[#64748B] hover:text-[#16324F]'
                }`}
              >
                Offline
              </button>
            </div>

            {/* Results Count Badge */}
            <span className="text-[11px] font-semibold text-[#64748B] ml-auto md:ml-2">
              Showing <span className="font-bold text-[#16324F]">{filteredPartners.length}</span> of {partners.length}
            </span>
          </div>

        </div>
      </div>

      {/* ─── DATA TABLE & LIST ──────────────────────────────────── */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-2xs overflow-hidden">
        {isLoading ? (
          <div className="text-center py-20 flex flex-col items-center justify-center">
            <LoadingSpinner size="md" label="Loading delivery partners..." />
          </div>
        ) : isError ? (
          <div className="p-6">
            <DataErrorState
              title="Unable to load delivery partners"
              message={(error as any)?.message || 'Failed to fetch delivery partners. Please check your connection.'}
              onRetry={() => refetch()}
            />
          </div>
        ) : filteredPartners.length === 0 ? (
          /* Empty State */
          <div className="text-center py-16 px-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-50 text-[#1677C8] mb-3">
              <Truck className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-[#16324F]">No Delivery Partners Found</h3>
            <p className="text-xs text-[#64748B] max-w-sm mx-auto mt-1 mb-4 leading-relaxed">
              {search || statusFilter !== 'ALL'
                ? 'No delivery partner matched your search or filters. Try adjusting your query.'
                : 'No delivery partners are registered yet. Click below to register your first delivery driver.'}
            </p>
            {search || statusFilter !== 'ALL' ? (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setStatusFilter('ALL');
                }}
                className="px-4 py-2 text-xs font-semibold text-[#1677C8] bg-blue-50 rounded-xl hover:bg-blue-100 transition cursor-pointer"
              >
                Reset Filters
              </button>
            ) : (
              <button
                type="button"
                onClick={handleOpenCreate}
                className="inline-flex items-center gap-2 bg-[#1677C8] hover:bg-[#1362a4] text-white px-4 py-2 rounded-xl text-xs font-bold shadow-2xs transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add First Delivery Partner</span>
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table View (>= 768px) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-slate-50/70 text-[#64748B] uppercase tracking-wider text-[10px] font-bold">
                    <th className="py-3 px-5">PARTNER</th>
                    <th className="py-3 px-5">CONTACT</th>
                    <th className="py-3 px-5">JAR UNIT PRICE</th>
                    <th className="py-3 px-5">STATUS</th>
                    <th className="py-3 px-5">AVAILABILITY</th>
                    <th className="py-3 px-5">DELIVERIES</th>
                    <th className="py-3 px-5">JOINED</th>
                    <th className="py-3 px-5 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredPartners.map((partner: any) => {
                    const firstName = partner.firstName || 'Delivery';
                    const lastName = partner.lastName || 'Partner';
                    const fullName = `${firstName} ${lastName}`.trim();
                    const initials = `${firstName[0] || 'D'}${lastName[0] || 'P'}`.toUpperCase();
                    const partnerId = partner.id ? `DP-${partner.id.slice(0, 8).toUpperCase()}` : 'DP-00000';
                    const phone = partner.phone || '—';
                    const email = partner.email || '—';
                    const isActive = partner.isActive !== false;
                    const rawJarPrice = partner.deliveryPartner?.jarUnitPrice ?? partner.jarUnitPrice ?? 0;
                    const jarUnitPrice = Number(rawJarPrice).toFixed(2);
                    const totalDeliveries = partner.deliveryPartner?.totalDeliveries ?? 0;
                    const completedDeliveries = partner.deliveryPartner?.completedDeliveries ?? 0;
                    const joinedDate = partner.createdAt
                      ? new Date(partner.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : '—';

                    return (
                      <tr 
                        key={partner.id} 
                        onClick={() => setDetailPartner(partner)}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                      >
                        {/* Partner Info */}
                        <td className="py-3.5 px-5 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#1677C8]/15 to-[#1677C8]/5 text-[#1677C8] border border-[#1677C8]/20 flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs group-hover:border-[#1677C8]/40 transition-colors">
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-[#16324F] group-hover:text-[#1677C8] transition-colors truncate">
                                {fullName}
                              </p>
                              <p className="text-[10px] font-mono text-[#64748B] truncate">
                                {partnerId}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Contact Info */}
                        <td className="py-3.5 px-5 whitespace-nowrap">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 text-xs text-[#16324F] font-medium">
                              <Phone className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span>{phone}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-[#64748B]">
                              <Mail className="w-3 h-3 text-[#1677C8] shrink-0" />
                              <span className="truncate max-w-[180px]">{email}</span>
                            </div>
                          </div>
                        </td>

                        {/* Jar Unit Price Column with Quick Edit */}
                        <td className="py-3.5 px-5 whitespace-nowrap">
                          <div className="inline-flex items-center gap-2 bg-slate-50/80 hover:bg-blue-50/80 px-2.5 py-1 rounded-xl border border-slate-200/60 transition group/price">
                            <span className="font-black text-[#16324F] text-xs">
                              ₹{jarUnitPrice} <span className="text-[10px] font-normal text-[#64748B]">/ jar</span>
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPriceEditPartner(partner);
                              }}
                              aria-label="Edit jar unit price"
                              title="Edit jar unit price"
                              className="p-1 text-gray-400 hover:text-[#1677C8] rounded-md transition cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-5 whitespace-nowrap">
                          {isActive ? (
                            <span className="inline-flex items-center gap-1.5 text-emerald-700 font-bold text-xs">
                              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                              <span>Active</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-rose-600 font-bold text-xs">
                              <span className="h-2 w-2 rounded-full bg-rose-500"></span>
                              <span>Inactive</span>
                            </span>
                          )}
                        </td>

                        {/* Availability */}
                        <td className="py-3.5 px-5 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isActive
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                              : 'bg-gray-100 text-gray-500 border border-gray-200'
                          }`}>
                            <Activity className="w-3 h-3" />
                            <span>{isActive ? 'Online' : 'Offline'}</span>
                          </span>
                        </td>

                        {/* Deliveries */}
                        <td className="py-3.5 px-5 whitespace-nowrap">
                          <div className="space-y-0.5">
                            <p className="font-bold text-[#16324F] text-xs">
                              {completedDeliveries} <span className="text-[10px] font-normal text-[#64748B]">completed</span>
                            </p>
                            <p className="text-[10px] text-[#64748B]">
                              {totalDeliveries} total assigned
                            </p>
                          </div>
                        </td>

                        {/* Joined Date */}
                        <td className="py-3.5 px-5 whitespace-nowrap text-[#64748B] text-[11px] font-medium">
                          {joinedDate}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button 
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDetailPartner(partner);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-[#1677C8] bg-blue-50/60 hover:bg-[#1677C8] hover:text-white transition-all cursor-pointer"
                              title="View Details"
                            >
                              <span>View Profile</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEdit(partner);
                              }}
                              className="p-1.5 text-gray-400 hover:text-[#1677C8] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                              title="Edit Partner"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleToggleStatus(e, partner)}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                isActive 
                                  ? 'text-gray-400 hover:text-rose-600 hover:bg-rose-50' 
                                  : 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50'
                              }`}
                              title={isActive ? 'Deactivate Partner' : 'Activate Partner'}
                            >
                              {isActive ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card Stack View (< 768px) */}
            <div className="md:hidden divide-y divide-gray-100">
              {filteredPartners.map((partner: any) => {
                const firstName = partner.firstName || 'Delivery';
                const lastName = partner.lastName || 'Partner';
                const fullName = `${firstName} ${lastName}`.trim();
                const initials = `${firstName[0] || 'D'}${lastName[0] || 'P'}`.toUpperCase();
                const partnerId = partner.id ? `DP-${partner.id.slice(0, 8).toUpperCase()}` : 'DP-00000';
                const phone = partner.phone || '—';
                const email = partner.email || '—';
                const isActive = partner.isActive !== false;
                const rawJarPrice = partner.deliveryPartner?.jarUnitPrice ?? partner.jarUnitPrice ?? 0;
                const jarUnitPrice = Number(rawJarPrice).toFixed(2);
                const completedDeliveries = partner.deliveryPartner?.completedDeliveries ?? 0;

                return (
                  <div
                    key={partner.id}
                    onClick={() => setDetailPartner(partner)}
                    className="p-4 space-y-3 hover:bg-slate-50 transition cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#1677C8]/15 to-[#1677C8]/5 text-[#1677C8] border border-[#1677C8]/20 flex items-center justify-center font-bold text-xs shrink-0">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-[#16324F] truncate">{fullName}</p>
                          <p className="text-[10px] font-mono text-[#64748B]">{partnerId}</p>
                        </div>
                      </div>

                      {isActive ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                          <span>Online</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-100">
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
                          <span>Inactive</span>
                        </span>
                      )}
                    </div>

                    {/* Jar Unit Rate in Mobile Card */}
                    <div className="flex items-center justify-between text-xs bg-blue-50/40 px-3 py-2 rounded-xl border border-blue-100/60">
                      <span className="text-[#64748B] text-[11px] font-medium">Jar Unit Rate:</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-[#16324F] text-xs">₹{jarUnitPrice} / jar</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPriceEditPartner(partner);
                          }}
                          aria-label="Edit jar unit price"
                          className="p-1 text-[#1677C8] hover:bg-blue-100/60 rounded-md transition"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <div className="text-xs text-[#64748B] space-y-1 pt-1 border-t border-gray-100">
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="text-[#16324F] font-medium">{phone}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-[#1677C8] shrink-0" />
                        <span className="truncate">{email}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs">
                      <span className="text-[11px] font-bold text-[#16324F]">
                        {completedDeliveries} <span className="font-normal text-[#64748B]">deliveries completed</span>
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEdit(partner);
                          }}
                          className="p-1 text-gray-500 hover:text-[#1677C8]"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-[#1677C8] font-bold text-xs flex items-center gap-1">
                          <span>View Profile</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ─── MODALS ──────────────────────────────────────────────── */}
      <UserFormModal
        isOpen={formModalOpen}
        userToEdit={userToEdit}
        defaultRole="DELIVERY_PARTNER"
        onClose={() => setFormModalOpen(false)}
        onSuccess={() => refetch()}
      />

      <DeliveryPartnerDetailModal
        partner={detailPartner}
        onClose={() => setDetailPartner(null)}
        onEdit={(p) => {
          setDetailPartner(null);
          handleOpenEdit(p);
        }}
        onEditPrice={(p) => {
          setPriceEditPartner(p);
        }}
      />

      <QuickJarPriceEditModal
        isOpen={Boolean(priceEditPartner)}
        partner={priceEditPartner}
        onClose={() => setPriceEditPartner(null)}
        onSuccess={() => refetch()}
      />

    </div>
  );
}
