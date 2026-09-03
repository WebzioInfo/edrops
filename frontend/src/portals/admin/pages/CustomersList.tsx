import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Building2,
  User
} from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';
import LoadingSpinner from '../../../components/LoadingSpinner';

export default function CustomersList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'RESIDENTIAL' | 'COMMERCIAL'>('ALL');

  const { data: customers = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ['adminCustomers'],
    queryFn: () => fetchWithAuth('/customer'),
  });

  const filteredCustomers = useMemo(() => {
    const term = search.toLowerCase().trim();

    return customers.filter((customer: any) => {
      const firstName = customer.user?.firstName || '';
      const lastName = customer.user?.lastName || '';
      const fullName = `${firstName} ${lastName}`.toLowerCase();
      const email = (customer.user?.email || '').toLowerCase();
      const phone = customer.user?.phone || '';
      const company = (customer.companyName || '').toLowerCase();
      const customerId = (customer.id || '').toLowerCase();

      // Search match
      const matchesSearch = 
        !term ||
        fullName.includes(term) ||
        email.includes(term) ||
        phone.includes(term) ||
        company.includes(term) ||
        customerId.includes(term);

      if (!matchesSearch) return false;

      // Status filter
      if (statusFilter === 'ACTIVE' && customer.user?.isActive === false) return false;
      if (statusFilter === 'INACTIVE' && customer.user?.isActive !== false) return false;

      // Type filter
      if (typeFilter === 'RESIDENTIAL' && customer.customerType === 'COMMERCIAL') return false;
      if (typeFilter === 'COMMERCIAL' && customer.customerType !== 'COMMERCIAL') return false;

      return true;
    });
  }, [customers, search, statusFilter, typeFilter]);

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      
      {/* ─── PAGE HEADER ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#16324F] tracking-tight">
            Customers
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5">
            Manage users, view their balances, and support tickets.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2 text-[#64748B] hover:text-[#1677C8] bg-white hover:bg-slate-50 border border-[#E2E8F0] rounded-xl transition cursor-pointer disabled:opacity-50"
            title="Refresh Customers"
          >
            <RotateCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-[#1677C8]' : ''}`} />
          </button>

          {/* Add Customer CTA */}
          <button 
            type="button"
            onClick={() => navigate('/admin/customers/add')}
            className="inline-flex items-center gap-2 bg-[#1677C8] hover:bg-[#1362a4] text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-2xs transition-all active:scale-[0.98] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Customer</span>
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
              placeholder="Search customers by name, phone or email..."
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

          {/* Status & Type Filter Pills */}
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

            {/* Results Count Badge */}
            <span className="text-[11px] font-semibold text-[#64748B] ml-auto md:ml-2">
              Showing <span className="font-bold text-[#16324F]">{filteredCustomers.length}</span> of {customers.length}
            </span>
          </div>

        </div>
      </div>

      {/* ─── CUSTOMER DATA TABLE & LIST ─────────────────────────── */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-2xs overflow-hidden">
        {isLoading ? (
          <div className="text-center py-20 flex flex-col items-center justify-center">
            <LoadingSpinner size="md" label="Loading customer directory..." />
          </div>
        ) : filteredCustomers.length === 0 ? (
          /* Empty State */
          <div className="text-center py-16 px-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-50 text-[#1677C8] mb-3">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-[#16324F]">No Customers Found</h3>
            <p className="text-xs text-[#64748B] max-w-sm mx-auto mt-1 mb-4 leading-relaxed">
              {search || statusFilter !== 'ALL' || typeFilter !== 'ALL'
                ? 'No customer matched your search or active filters. Try adjusting your search query.'
                : 'No customers are registered in the system yet. Click below to add your first customer.'}
            </p>
            {search || statusFilter !== 'ALL' ? (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setStatusFilter('ALL');
                  setTypeFilter('ALL');
                }}
                className="px-4 py-2 text-xs font-semibold text-[#1677C8] bg-blue-50 rounded-xl hover:bg-blue-100 transition cursor-pointer"
              >
                Reset Filters
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigate('/admin/customers/add')}
                className="inline-flex items-center gap-2 bg-[#1677C8] hover:bg-[#1362a4] text-white px-4 py-2 rounded-xl text-xs font-bold shadow-2xs transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add First Customer</span>
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
                    <th className="py-3 px-5">CUSTOMER</th>
                    <th className="py-3 px-5">CONTACT</th>
                    <th className="py-3 px-5">ROLE</th>
                    <th className="py-3 px-5">STATUS</th>
                    <th className="py-3 px-5 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredCustomers.map((cust: any) => {
                    const firstName = cust.user?.firstName || 'Valued';
                    const lastName = cust.user?.lastName || 'Customer';
                    const fullName = `${firstName} ${lastName}`.trim();
                    const initials = `${firstName[0] || 'C'}${lastName[0] || ''}`.toUpperCase();
                    const shortId = cust.id ? cust.id.slice(0, 8).toUpperCase() : 'CUST';
                    const phone = cust.user?.phone || '—';
                    const email = cust.user?.email || '—';
                    const role = cust.customerType || cust.user?.role || 'CUSTOMER';
                    const isActive = cust.user?.isActive !== false;

                    return (
                      <tr 
                        key={cust.id} 
                        onClick={() => navigate(`/admin/customers/${cust.id}`)}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                      >
                        {/* Customer Info */}
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
                                ID: #{shortId}
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

                        {/* Role / Type Badge */}
                        <td className="py-3.5 px-5 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-[#64748B] border border-slate-200">
                            {role === 'COMMERCIAL' ? (
                              <Building2 className="w-3 h-3" />
                            ) : (
                              <User className="w-3 h-3" />
                            )}
                            <span>{role}</span>
                          </span>
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

                        {/* Actions */}
                        <td className="py-3.5 px-5 text-right whitespace-nowrap">
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/admin/customers/${cust.id}`);
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-[#1677C8] bg-blue-50/60 hover:bg-[#1677C8] hover:text-white transition-all cursor-pointer"
                          >
                            <span>View Profile</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card Stack View (< 768px) */}
            <div className="md:hidden divide-y divide-gray-100">
              {filteredCustomers.map((cust: any) => {
                const firstName = cust.user?.firstName || 'Valued';
                const lastName = cust.user?.lastName || 'Customer';
                const fullName = `${firstName} ${lastName}`.trim();
                const initials = `${firstName[0] || 'C'}${lastName[0] || ''}`.toUpperCase();
                const shortId = cust.id ? cust.id.slice(0, 8).toUpperCase() : 'CUST';
                const phone = cust.user?.phone || '—';
                const email = cust.user?.email || '—';
                const role = cust.customerType || cust.user?.role || 'CUSTOMER';
                const isActive = cust.user?.isActive !== false;

                return (
                  <div
                    key={cust.id}
                    onClick={() => navigate(`/admin/customers/${cust.id}`)}
                    className="p-4 space-y-3 hover:bg-slate-50 transition cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#1677C8]/15 to-[#1677C8]/5 text-[#1677C8] border border-[#1677C8]/20 flex items-center justify-center font-bold text-xs shrink-0">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-[#16324F] truncate">{fullName}</p>
                          <p className="text-[10px] font-mono text-[#64748B]">ID: #{shortId}</p>
                        </div>
                      </div>

                      {isActive ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                          <span>Active</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-100">
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
                          <span>Inactive</span>
                        </span>
                      )}
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
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-[#64748B]">
                        {role}
                      </span>
                      <span className="text-[#1677C8] font-bold text-xs flex items-center gap-1">
                        <span>View Profile</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

    </div>
  );
}
