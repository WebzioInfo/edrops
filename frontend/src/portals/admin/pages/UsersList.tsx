import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Users, 
  Plus, 
  Search, 
  X, 
  Phone, 
  Mail, 
  ChevronRight, 
  RotateCw,
  Edit2,
  Edit3,
  Shield,
  Truck,
  UserCheck,
  UserX,
  User
} from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';
import LoadingSpinner from '../../../components/LoadingSpinner';
import UserFormModal, { type UserRecord } from '../components/UserFormModal';
import UserDetailModal from '../components/UserDetailModal';
import QuickJarPriceEditModal from '../components/QuickJarPriceEditModal';
import { toast } from 'react-hot-toast';

export default function UsersList() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Modals state
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<UserRecord | null>(null);
  const [detailUser, setDetailUser] = useState<any | null>(null);
  const [priceEditUser, setPriceEditUser] = useState<any | null>(null);

  const { data: users = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ['adminUsers'],
    queryFn: () => fetchWithAuth('/admin/users'),
  });

  const filteredUsers = useMemo(() => {
    const term = search.toLowerCase().trim();

    return users.filter((u: any) => {
      const fullName = (u.fullName || `${u.firstName || ''} ${u.lastName || ''}`).toLowerCase();
      const phone = u.phone || '';
      const email = (u.email || '').toLowerCase();
      const id = (u.id || '').toLowerCase();
      const role = u.role || '';

      const matchesSearch = 
        !term ||
        fullName.includes(term) ||
        phone.includes(term) ||
        email.includes(term) ||
        id.includes(term);

      if (!matchesSearch) return false;

      // Role filter
      if (roleFilter !== 'ALL' && role !== roleFilter) return false;

      // Status filter
      if (statusFilter === 'ACTIVE' && u.isActive === false) return false;
      if (statusFilter === 'INACTIVE' && u.isActive !== false) return false;

      return true;
    });
  }, [users, search, roleFilter, statusFilter]);

  const handleOpenCreate = () => {
    setUserToEdit(null);
    setFormModalOpen(true);
  };

  const handleOpenEdit = (user: any) => {
    setUserToEdit(user);
    setFormModalOpen(true);
  };

  const handleToggleStatus = async (e: React.MouseEvent, user: any) => {
    e.stopPropagation();
    try {
      const newStatus = !user.isActive;
      await fetchWithAuth(`/admin/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: newStatus }),
      });
      toast.success(`User ${newStatus ? 'activated' : 'deactivated'} successfully`);
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update user status');
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-purple-50 text-purple-700 border border-purple-200">
            <Shield className="w-3 h-3" />
            <span>Admin</span>
          </span>
        );
      case 'DELIVERY_PARTNER':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-50 text-[#1677C8] border border-blue-200">
            <Truck className="w-3 h-3" />
            <span>Delivery Partner</span>
          </span>
        );
      case 'MANAGER':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200">
            <Shield className="w-3 h-3" />
            <span>Manager</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-[#64748B] border border-slate-200">
            <User className="w-3 h-3" />
            <span>Staff</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      
      {/* ─── PAGE HEADER ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#16324F] tracking-tight">
            Users & Staff
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5">
            Manage application user accounts, system roles, permissions and staff operational access.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2 text-[#64748B] hover:text-[#1677C8] bg-white hover:bg-slate-50 border border-[#E2E8F0] rounded-xl transition cursor-pointer disabled:opacity-50"
            title="Refresh Users"
          >
            <RotateCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-[#1677C8]' : ''}`} />
          </button>

          {/* Add User CTA */}
          <button 
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 bg-[#1677C8] hover:bg-[#1362a4] text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-2xs transition-all active:scale-[0.98] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add User</span>
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
              placeholder="Search by name, email or phone..."
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

          {/* Role & Status Filter Pills */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {/* Role Filter Segment */}
            <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200/60 overflow-x-auto">
              {[
                { key: 'ALL', label: 'All' },
                { key: 'ADMIN', label: 'Admin' },
                { key: 'STAFF', label: 'Staff' },
                { key: 'DELIVERY_PARTNER', label: 'Delivery' },
                { key: 'MANAGER', label: 'Manager' },
              ].map((rf) => (
                <button
                  key={rf.key}
                  type="button"
                  onClick={() => setRoleFilter(rf.key)}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer text-[11px] whitespace-nowrap ${
                    roleFilter === rf.key
                      ? 'bg-white text-[#1677C8] shadow-2xs font-bold'
                      : 'text-[#64748B] hover:text-[#16324F]'
                  }`}
                >
                  {rf.label}
                </button>
              ))}
            </div>

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

            {/* Results Count Badge */}
            <span className="text-[11px] font-semibold text-[#64748B] ml-auto md:ml-2">
              Showing <span className="font-bold text-[#16324F]">{filteredUsers.length}</span> of {users.length}
            </span>
          </div>

        </div>
      </div>

      {/* ─── DATA TABLE & LIST ──────────────────────────────────── */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-2xs overflow-hidden">
        {isLoading ? (
          <div className="text-center py-20 flex flex-col items-center justify-center">
            <LoadingSpinner size="md" label="Loading application users..." />
          </div>
        ) : filteredUsers.length === 0 ? (
          /* Empty State */
          <div className="text-center py-16 px-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-50 text-[#1677C8] mb-3">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-[#16324F]">No Application Users Found</h3>
            <p className="text-xs text-[#64748B] max-w-sm mx-auto mt-1 mb-4 leading-relaxed">
              {search || roleFilter !== 'ALL' || statusFilter !== 'ALL'
                ? 'No users match your active search or filters. Try adjusting your query.'
                : 'No users found in the system. Click below to add your first user.'}
            </p>
            {search || roleFilter !== 'ALL' || statusFilter !== 'ALL' ? (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setRoleFilter('ALL');
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
                <span>Add First User</span>
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
                    <th className="py-3 px-5">USER</th>
                    <th className="py-3 px-5">EMAIL / CONTACT</th>
                    <th className="py-3 px-5">ROLE</th>
                    <th className="py-3 px-5">JAR UNIT PRICE</th>
                    <th className="py-3 px-5">STATUS</th>
                    <th className="py-3 px-5">JOINED</th>
                    <th className="py-3 px-5 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredUsers.map((u: any) => {
                    const firstName = u.firstName || 'Staff';
                    const lastName = u.lastName || 'User';
                    const fullName = `${firstName} ${lastName}`.trim();
                    const initials = `${firstName[0] || 'U'}${lastName[0] || ''}`.toUpperCase();
                    const shortId = u.id ? `#USR-${u.id.slice(0, 8).toUpperCase()}` : '#USR-0000';
                    const phone = u.phone || '—';
                    const email = u.email || '—';
                    const isActive = u.isActive !== false;
                    const isDeliveryPartner = u.role === 'DELIVERY_PARTNER';
                    const rawJarPrice = u.deliveryPartner?.jarUnitPrice ?? u.jarUnitPrice ?? 0;
                    const hasJarPrice = Number(rawJarPrice) > 0;
                    const jarUnitPrice = hasJarPrice ? Number(rawJarPrice).toFixed(2) : '0.00';
                    const joinedDate = u.createdAt
                      ? new Date(u.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : '—';

                    return (
                      <tr 
                        key={u.id} 
                        onClick={() => setDetailUser(u)}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                      >
                        {/* User Identity */}
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
                                {shortId}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Contact */}
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

                        {/* Role Badge */}
                        <td className="py-3.5 px-5 whitespace-nowrap">
                          {getRoleBadge(u.role)}
                        </td>

                        {/* Jar Unit Price Column with Quick Edit (Delivery Partners only) */}
                        <td className="py-3.5 px-5 whitespace-nowrap">
                          {isDeliveryPartner ? (
                            hasJarPrice ? (
                              <div className="inline-flex items-center gap-2 bg-slate-50/80 hover:bg-blue-50/80 px-2.5 py-1 rounded-xl border border-slate-200/60 transition group/price">
                                <span className="font-black text-[#16324F] text-xs">
                                  ₹{jarUnitPrice} <span className="text-[10px] font-normal text-[#64748B]">/ jar</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPriceEditUser(u);
                                  }}
                                  aria-label="Edit jar unit price"
                                  title="Edit jar unit price"
                                  className="p-1 text-gray-400 hover:text-[#1677C8] rounded-md transition cursor-pointer"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1.5">
                                <span className="text-gray-400 font-medium text-xs">Not Set</span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPriceEditUser(u);
                                  }}
                                  aria-label="Set jar unit price"
                                  title="Set jar unit price"
                                  className="p-1 text-[#1677C8] hover:bg-blue-50 rounded-md transition cursor-pointer"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )
                          ) : (
                            <span className="text-gray-400 text-xs font-semibold pl-2">—</span>
                          )}
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
                                setDetailUser(u);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-[#1677C8] bg-blue-50/60 hover:bg-[#1677C8] hover:text-white transition-all cursor-pointer"
                              title="View Details"
                            >
                              <span>View</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEdit(u);
                              }}
                              className="p-1.5 text-gray-400 hover:text-[#1677C8] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                              title="Edit User"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleToggleStatus(e, u)}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                isActive 
                                  ? 'text-gray-400 hover:text-rose-600 hover:bg-rose-50' 
                                  : 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50'
                              }`}
                              title={isActive ? 'Deactivate User' : 'Activate User'}
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
              {filteredUsers.map((u: any) => {
                const firstName = u.firstName || 'Staff';
                const lastName = u.lastName || 'User';
                const fullName = `${firstName} ${lastName}`.trim();
                const initials = `${firstName[0] || 'U'}${lastName[0] || ''}`.toUpperCase();
                const shortId = u.id ? `#USR-${u.id.slice(0, 8).toUpperCase()}` : '#USR-0000';
                const phone = u.phone || '—';
                const email = u.email || '—';
                const isActive = u.isActive !== false;
                const isDeliveryPartner = u.role === 'DELIVERY_PARTNER';
                const rawJarPrice = u.deliveryPartner?.jarUnitPrice ?? u.jarUnitPrice ?? 0;
                const hasJarPrice = Number(rawJarPrice) > 0;
                const jarUnitPrice = hasJarPrice ? Number(rawJarPrice).toFixed(2) : '0.00';

                return (
                  <div
                    key={u.id}
                    onClick={() => setDetailUser(u)}
                    className="p-4 space-y-3 hover:bg-slate-50 transition cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#1677C8]/15 to-[#1677C8]/5 text-[#1677C8] border border-[#1677C8]/20 flex items-center justify-center font-bold text-xs shrink-0">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-[#16324F] truncate">{fullName}</p>
                          <p className="text-[10px] font-mono text-[#64748B]">{shortId}</p>
                        </div>
                      </div>

                      {getRoleBadge(u.role)}
                    </div>

                    {/* Jar Unit Rate in Mobile Card for Delivery Partners */}
                    {isDeliveryPartner && (
                      <div className="flex items-center justify-between text-xs bg-blue-50/40 px-3 py-2 rounded-xl border border-blue-100/60">
                        <span className="text-[#64748B] text-[11px] font-medium">Jar Unit Rate:</span>
                        <div className="flex items-center gap-1.5">
                          {hasJarPrice ? (
                            <span className="font-black text-[#16324F] text-xs">₹{jarUnitPrice} / jar</span>
                          ) : (
                            <span className="text-gray-400 font-medium text-xs">Not Set</span>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPriceEditUser(u);
                            }}
                            aria-label="Edit jar unit price"
                            className="p-1 text-[#1677C8] hover:bg-blue-100/60 rounded-md transition"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )}

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
                      {isActive ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                          <span>Active</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
                          <span>Inactive</span>
                        </span>
                      )}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEdit(u);
                          }}
                          className="p-1 text-gray-500 hover:text-[#1677C8]"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-[#1677C8] font-bold text-xs flex items-center gap-1">
                          <span>View</span>
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
        defaultRole="STAFF"
        onClose={() => setFormModalOpen(false)}
        onSuccess={() => refetch()}
      />

      <UserDetailModal
        user={detailUser}
        onClose={() => setDetailUser(null)}
        onEdit={(usr) => {
          setDetailUser(null);
          handleOpenEdit(usr);
        }}
        onEditPrice={(usr) => {
          setPriceEditUser(usr);
        }}
      />

      <QuickJarPriceEditModal
        isOpen={Boolean(priceEditUser)}
        partner={priceEditUser}
        onClose={() => setPriceEditUser(null)}
        onSuccess={() => refetch()}
      />

    </div>
  );
}
