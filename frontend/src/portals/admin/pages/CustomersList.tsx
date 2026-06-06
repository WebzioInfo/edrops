import { Users, UserPlus, Search, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchWithAuth } from '../../../api/client';

export default function CustomersList() {
  const [search, setSearch] = useState('');

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['adminCustomers'],
    queryFn: () => fetchWithAuth('/customer')
  });

  const filteredCustomers = customers.filter((customer: any) => {
    const term = search.toLowerCase();
    const name = `${customer.user?.firstName} ${customer.user?.lastName}`.toLowerCase();
    return name.includes(term) || customer.user?.email?.toLowerCase().includes(term) || customer.user?.phone?.includes(term);
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Customers</h1>
          <p className="text-slate-500 font-semibold mt-1">Manage users, view their balances, and support tickets.</p>
        </div>
        <button className="flex items-center gap-2 bg-[#245361] hover:bg-[#245361]/90 text-white px-5 py-2.5 rounded-full font-black shadow-lg shadow-[#245361]/20 transition-all active:scale-95">
          <UserPlus className="w-5 h-5" />
          Invite User
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex gap-4">
          <div className="relative w-full max-w-md">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Search by name, phone, or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 rounded-full border border-slate-200 bg-white shadow-sm focus:border-[#2D79A8] focus:ring-2 focus:ring-[#2D79A8]/20 transition-all font-medium text-sm"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-20">
            <div className="w-10 h-10 border-4 border-[#245361]/20 border-t-[#245361] rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-500 font-medium">Loading customers...</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="text-center py-20">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-black text-slate-700">No Customers Found</h3>
            <p className="text-slate-500 font-medium max-w-md mx-auto mt-2">
              Try adjusting your search criteria.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm font-semibold border-collapse">
              <thead>
                <tr className="border-b border-border/50 text-[#245361] uppercase tracking-wider text-[10px] font-black bg-slate-50/50">
                  <th className="py-3 px-4">Customer Details</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((cust: any) => (
                  <tr key={cust.id} className="border-b border-border/30 hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-secondary/20 flex items-center justify-center text-primary font-black uppercase shadow-sm">
                          {cust.user?.firstName?.[0]}{cust.user?.lastName?.[0]}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">{cust.user?.firstName} {cust.user?.lastName}</p>
                          <p className="text-xs text-slate-500 font-medium">ID: {cust.id.split('-')[0].toUpperCase()}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 space-y-1">
                      <p className="text-slate-700 font-medium text-xs">{cust.user?.email || 'N/A'}</p>
                      <p className="text-slate-500 font-medium text-xs">{cust.user?.phone}</p>
                    </td>
                    <td className="py-4 px-4">
                       <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border border-slate-200">
                          {cust.user?.role}
                       </span>
                    </td>
                    <td className="py-4 px-4">
                      {cust.user?.isActive ? (
                        <span className="flex items-center gap-1.5 text-emerald-600 font-bold text-xs">
                          <CheckCircle2 className="w-4 h-4" /> Active
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-rose-600 font-bold text-xs">
                          <ShieldAlert className="w-4 h-4" /> Inactive
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <button className="text-[#2D79A8] font-bold text-xs hover:underline uppercase tracking-wide">
                        View Profile
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
