import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Users, 
  Search, 
  Phone, 
  MapPin, 
  Plus, 
  Eye, 
  Edit, 
  Trash2, 
  Building2, 
  User, 
  RotateCw, 
  Loader2,
  Pencil
} from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';
import { toast } from 'react-hot-toast';
import CustomerFormModal, { type CustomerRecord } from '../components/CustomerFormModal';
import CustomerDetailModal from '../components/CustomerDetailModal';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import QuickJarEditModal from '../components/QuickJarEditModal';
import type { DeliveryTask } from './Overview';

interface CustomersProps {
  tasks?: DeliveryTask[];
  loading?: boolean;
}

export default function Customers({ tasks = [] }: CustomersProps) {
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [customerToEdit, setCustomerToEdit] = useState<CustomerRecord | null>(null);
  const [detailCustomer, setDetailCustomer] = useState<CustomerRecord | null>(null);
  const [customerToDelete, setCustomerToDelete] = useState<CustomerRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Quick Jar Edit state
  const [quickJarCustomer, setQuickJarCustomer] = useState<CustomerRecord | null>(null);
  const [quickJarModalOpen, setQuickJarModalOpen] = useState(false);

  const loadCustomers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchWithAuth('/customer');
      if (Array.isArray(data)) {
        setCustomers(data);
      } else {
        // Fallback: build customer records from assigned tasks if direct endpoint returns empty/different structure
        const taskCustomerMap = new Map<string, CustomerRecord>();
        tasks.forEach((t) => {
          if (t.customer) {
            const custId = t.customer.id || t.id;
            if (!taskCustomerMap.has(custId)) {
              taskCustomerMap.set(custId, {
                id: custId,
                customerType: t.customer.customerType || 'RESIDENTIAL',
                companyName: t.customer.companyName,
                user: {
                  firstName: t.customer.user?.firstName || 'Valued',
                  lastName: t.customer.user?.lastName || 'Customer',
                  phone: t.customer.user?.phone || '',
                  email: t.customer.user?.email,
                },
                addresses: t.address
                  ? [
                      {
                        ...t.address,
                        street: t.address.street || '',
                        city: t.address.city || '',
                        state: t.address.state || '',
                        zipCode: t.address.zipCode || '',
                        isDefault: true,
                      },
                    ]
                  : [],
              });
            }
          }
        });
        setCustomers(Array.from(taskCustomerMap.values()));
      }
    } catch (err: any) {
      console.error('Error fetching customers:', err);
      toast.error('Failed to load customers list');
    } finally {
      setLoading(false);
    }
  }, [tasks]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  // Search filter
  const filteredCustomers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return customers;

    return customers.filter((c) => {
      const name = `${c.user?.firstName || ''} ${c.user?.lastName || ''}`.toLowerCase();
      const phone = c.user?.phone || '';
      const email = (c.user?.email || '').toLowerCase();
      const company = (c.companyName || '').toLowerCase();
      const defaultAddr = c.addresses?.find((a) => a.isDefault) || c.addresses?.[0];
      const address = [defaultAddr?.street, defaultAddr?.city, defaultAddr?.area].filter(Boolean).join(' ').toLowerCase();

      return (
        name.includes(q) ||
        phone.includes(q) ||
        email.includes(q) ||
        company.includes(q) ||
        address.includes(q)
      );
    });
  }, [customers, searchQuery]);

  // Open Create
  const handleOpenCreate = () => {
    setCustomerToEdit(null);
    setFormModalOpen(true);
  };

  // Open Edit
  const handleOpenEdit = (customer: CustomerRecord) => {
    setCustomerToEdit(customer);
    setFormModalOpen(true);
  };

  // Open View
  const handleOpenView = (customer: CustomerRecord) => {
    setDetailCustomer(customer);
  };

  // Open Delete
  const handleOpenDelete = (customer: CustomerRecord) => {
    setCustomerToDelete(customer);
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!customerToDelete) return;
    setDeleting(true);
    try {
      await fetchWithAuth(`/customer/${customerToDelete.id}`, {
        method: 'DELETE',
      });
      toast.success('Customer deleted successfully');
      setCustomerToDelete(null);
      loadCustomers();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete customer');
    } finally {
      setDeleting(false);
    }
  };

  // Quick Jar Count Edit
  const handleOpenQuickJarEdit = (customer: CustomerRecord) => {
    setQuickJarCustomer(customer);
    setQuickJarModalOpen(true);
  };

  const handleQuickJarSuccess = (updatedCustomer: CustomerRecord) => {
    setCustomers((prev) =>
      prev.map((c) =>
        c.id === updatedCustomer.id
          ? {
              ...c,
              ...updatedCustomer,
              jars_at_customer: updatedCustomer.jars_at_customer,
              jarsAtCustomer: updatedCustomer.jarsAtCustomer,
            }
          : c,
      ),
    );
    setQuickJarModalOpen(false);
    setQuickJarCustomer(null);
  };

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#16324F]">Customers</h1>
          <p className="text-xs sm:text-sm text-[#64748B]">Manage customers connected to your delivery routes</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadCustomers}
            disabled={loading}
            title="Refresh customers"
            className="p-2.5 text-[#64748B] hover:text-[#1677C8] hover:bg-blue-50/70 border border-[#E2E8F0] rounded-xl transition cursor-pointer disabled:opacity-50"
          >
            <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white bg-[#1677C8] hover:bg-[#1362a4] rounded-xl shadow-2xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Customer</span>
          </button>
        </div>
      </div>

      {/* Search & Stats Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by customer name, phone, address, or company..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm bg-white border border-[#E2E8F0] rounded-xl outline-none focus:border-[#1677C8] focus:ring-2 focus:ring-[#1677C8]/10 transition text-[#16324F] placeholder:text-gray-400 shadow-2xs"
          />
        </div>

        <div className="text-xs text-[#64748B] font-medium">
          Showing <span className="font-bold text-[#16324F]">{filteredCustomers.length}</span> of {customers.length} customers
        </div>
      </div>

      {/* Customer Directory Table / Cards (Natural Height - No Internal Scrollbar) */}
      {loading ? (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-12 text-center text-[#64748B]">
          <Loader2 className="w-6 h-6 animate-spin text-[#1677C8] mx-auto mb-2" />
          <p className="text-xs font-medium">Loading customers directory...</p>
        </div>
      ) : filteredCustomers.length > 0 ? (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-2xs">
          
          {/* Desktop Table View (>= 768px) */}
          <div className="hidden md:block">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-[#E2E8F0] text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                  <th className="px-5 py-3.5 min-w-[200px]">Customer</th>
                  <th className="px-5 py-3.5 min-w-[130px]">Phone</th>
                  <th className="px-5 py-3.5 min-w-[150px]">Email</th>
                  <th className="px-5 py-3.5 min-w-[130px]">Location</th>
                  <th className="px-5 py-3.5 min-w-[140px]">Jars at Customer</th>
                  <th className="px-5 py-3.5 text-right w-[110px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]/70 text-xs sm:text-sm text-[#16324F]">
                {filteredCustomers.map((customer) => {
                  const customerName = `${customer.user?.firstName || ''} ${customer.user?.lastName || ''}`.trim() || 'Customer';
                  const defaultAddr = customer.addresses?.find((a) => a.isDefault) || customer.addresses?.[0];
                  const locationTag = defaultAddr?.city || defaultAddr?.area || 'Location set';
                  const jarsCount = customer.jars_at_customer !== undefined
                    ? customer.jars_at_customer
                    : customer.jarsAtCustomer !== undefined
                    ? customer.jarsAtCustomer
                    : 0;

                  return (
                    <tr key={customer.id} className="hover:bg-blue-50/30 transition-colors h-15">
                      {/* Customer Info */}
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1677C8]/10 text-[#1677C8] font-bold text-xs">
                            {customer.customerType === 'COMMERCIAL' || customer.customerType === 'OFFICE' ? (
                              <Building2 className="w-4 h-4" />
                            ) : (
                              <User className="w-4 h-4" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-[#16324F] block truncate">{customerName}</span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-[#64748B]">
                                {customer.customerType}
                              </span>
                              {customer.companyName && (
                                <span className="text-xs text-[#64748B] truncate">({customer.companyName})</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Phone */}
                      <td className="px-5 py-3 font-medium whitespace-nowrap">
                        {customer.user?.phone ? (
                          <a
                            href={`tel:${customer.user.phone}`}
                            className="text-[#16324F] hover:text-[#1677C8] inline-flex items-center gap-1 transition-colors"
                          >
                            <Phone className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{customer.user.phone}</span>
                          </a>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>

                      {/* Email */}
                      <td className="px-5 py-3 text-[#64748B] truncate max-w-[180px]">
                        {customer.user?.email || '—'}
                      </td>

                      {/* Location Badge */}
                      <td className="px-5 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-[#1677C8] border border-blue-100">
                          <MapPin className="w-3 h-3 text-[#1677C8]" />
                          <span>{locationTag}</span>
                        </span>
                      </td>

                      {/* Jars at Customer */}
                      <td className="px-5 py-3 whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <span className="text-sm font-bold text-[#16324F]">{jarsCount}</span>
                          <span className="text-[11px] font-medium text-[#64748B]">jars</span>
                          <button
                            type="button"
                            onClick={() => handleOpenQuickJarEdit(customer)}
                            title="Edit Jars at Customer"
                            className="p-1 text-gray-400 hover:text-[#1677C8] hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* Direct Inline Row Actions (No Dropdown Menu) */}
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenView(customer)}
                            title="View Details"
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-[#64748B] hover:text-[#1677C8] hover:bg-blue-50 transition cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(customer)}
                            title="Edit Customer"
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-[#64748B] hover:text-[#1677C8] hover:bg-blue-50 transition cursor-pointer"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenDelete(customer)}
                            title="Delete Customer"
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-[#64748B] hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List View (< 768px) - Responsive and Natural Scrolling */}
          <div className="md:hidden divide-y divide-gray-100">
            {filteredCustomers.map((customer) => {
              const customerName = `${customer.user?.firstName || ''} ${customer.user?.lastName || ''}`.trim() || 'Customer';
              const defaultAddr = customer.addresses?.find((a) => a.isDefault) || customer.addresses?.[0];
              const addressParts = [
                defaultAddr?.street,
                defaultAddr?.city,
                defaultAddr?.district,
                defaultAddr?.state
              ].filter(Boolean);
              const addressStr = addressParts.join(', ');
              const locationTag = defaultAddr?.city || defaultAddr?.area || 'Location set';
              const jarsCount = customer.jars_at_customer !== undefined
                ? customer.jars_at_customer
                : customer.jarsAtCustomer !== undefined
                ? customer.jarsAtCustomer
                : 0;

              return (
                <div key={customer.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#1677C8]/10 text-[#1677C8] font-bold text-xs">
                        {customer.customerType === 'COMMERCIAL' || customer.customerType === 'OFFICE' ? (
                          <Building2 className="w-4 h-4" />
                        ) : (
                          <User className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-[#16324F] truncate">{customerName}</h3>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] uppercase font-semibold px-1.5 py-0.2 rounded bg-gray-100 text-[#64748B]">
                            {customer.customerType}
                          </span>
                          {customer.companyName && (
                            <span className="text-xs text-[#64748B] truncate">({customer.companyName})</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-[#1677C8] border border-blue-100 shrink-0">
                      <MapPin className="w-3 h-3" />
                      <span>{locationTag}</span>
                    </span>
                  </div>

                  <div className="text-xs text-[#64748B] space-y-1.5">
                    {customer.user?.phone && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <a href={`tel:${customer.user.phone}`} className="text-[#16324F] font-medium">
                          {customer.user.phone}
                        </a>
                      </div>
                    )}
                    {addressStr && (
                      <p className="text-xs text-gray-500 line-clamp-1">{addressStr}</p>
                    )}
                    <div className="flex items-center justify-between pt-1 text-xs border-t border-gray-100">
                      <span className="text-[#64748B] font-medium">Jars at Customer:</span>
                      <div className="inline-flex items-center gap-1.5">
                        <span className="font-bold text-[#16324F]">{jarsCount} jars</span>
                        <button
                          type="button"
                          onClick={() => handleOpenQuickJarEdit(customer)}
                          title="Edit Jars at Customer"
                          className="p-1 text-gray-400 hover:text-[#1677C8] hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Mobile Inline Actions */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => handleOpenView(customer)}
                      title="View Details"
                      className="px-3 py-1.5 text-xs font-semibold text-[#1677C8] bg-blue-50 hover:bg-blue-100 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(customer)}
                      title="Edit Customer"
                      className="px-3 py-1.5 text-xs font-semibold text-[#64748B] hover:text-[#16324F] bg-gray-50 hover:bg-gray-100 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenDelete(customer)}
                      title="Delete Customer"
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      ) : (
        /* Empty State */
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-8 sm:p-10 text-center shadow-2xs">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-50 text-[#1677C8] mb-3">
            <Users className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-[#16324F] mb-1">
            {searchQuery ? 'No matching customers found' : 'No customers yet'}
          </h3>
          <p className="text-xs text-[#64748B] max-w-sm mx-auto mb-4 leading-relaxed">
            {searchQuery
              ? `No customer matched "${searchQuery}". Try searching with a different phone or name.`
              : 'Customers associated with your delivery routes will appear here. Add new customer profiles with exact map coordinates.'}
          </p>
          {searchQuery ? (
            <button
              onClick={() => setSearchQuery('')}
              className="px-4 py-2 text-xs font-semibold text-[#1677C8] bg-blue-50 rounded-xl hover:bg-blue-100 transition cursor-pointer"
            >
              Clear Search
            </button>
          ) : (
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1677C8] hover:bg-[#1362a4] rounded-xl shadow-2xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Customer</span>
            </button>
          )}
        </div>
      )}

      {/* ─── MODALS ──────────────────────────────────────────────── */}
      
      {/* Customer Form Modal (Create / Edit) */}
      <CustomerFormModal
        isOpen={formModalOpen}
        onClose={() => setFormModalOpen(false)}
        onSuccess={loadCustomers}
        customerToEdit={customerToEdit}
      />

      {/* Customer Detail View Modal */}
      <CustomerDetailModal
        customer={detailCustomer}
        onClose={() => setDetailCustomer(null)}
        onEdit={(c) => {
          setDetailCustomer(null);
          handleOpenEdit(c);
        }}
      />

      {/* Quick Jar Edit Modal */}
      <QuickJarEditModal
        isOpen={quickJarModalOpen}
        customer={quickJarCustomer}
        onClose={() => {
          setQuickJarModalOpen(false);
          setQuickJarCustomer(null);
        }}
        onSuccess={handleQuickJarSuccess}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={!!customerToDelete}
        customer={customerToDelete}
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setCustomerToDelete(null)}
      />
    </div>
  );
}
