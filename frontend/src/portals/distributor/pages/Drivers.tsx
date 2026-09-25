import React, { useState, useEffect } from 'react';
import {
  Truck,
  Plus,
  Search,
  RefreshCw,
  Edit2,
  Trash2,
  X,
  AlertCircle,
  Eye,
  Phone,
  MapPin,
  Power,
  PackageCheck,
} from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';
import { showToast } from '../../../utils/toast';
import { DistributorTopbar } from '../components/DistributorTopbar';
import { EdropsPageLoader } from '../../../components/common/EdropsPageLoader';

export interface DriverRecord {
  id: string;
  distributorId: string;
  name: string;
  phone: string;
  alternatePhone?: string | null;
  routeOrArea?: string | null;
  pincode: string;
  vehicleType: string;
  vehicleNumber: string;
  notes?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    orders: number;
  };
}

export interface DriverDetailRecord extends DriverRecord {
  orders?: {
    id: string;
    status: string;
    totalAmount: number;
    scheduledDate?: string | null;
    createdAt: string;
    paymentStatus?: string;
    customer?: {
      id: string;
      user?: {
        firstName: string;
        lastName: string;
        phone: string;
      };
    };
    address?: {
      street?: string;
      city?: string;
      zipCode?: string;
      area?: string;
    };
  }[];
}

const VEHICLE_TYPES = ['2 Wheeler', '3 Wheeler', '4 Wheeler', 'Other'];

export default function DistributorDrivers() {
  const [drivers, setDrivers] = useState<DriverRecord[]>([]);
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0 });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Form modal states
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingDriver, setEditingDriver] = useState<DriverRecord | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Form field states
  const [name, setName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [alternatePhone, setAlternatePhone] = useState<string>('');
  const [routeOrArea, setRouteOrArea] = useState<string>('');
  const [pincode, setPincode] = useState<string>('');
  const [vehicleType, setVehicleType] = useState<string>('2 Wheeler');
  const [vehicleNumber, setVehicleNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isActive, setIsActive] = useState<boolean>(true);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Detail Drawer state
  const [viewingDriverId, setViewingDriverId] = useState<string | null>(null);
  const [driverDetail, setDriverDetail] = useState<DriverDetailRecord | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);

  // Deactivate/Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<DriverRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const loadDrivers = async (showLoadingSpinner = true) => {
    try {
      if (showLoadingSpinner) setIsLoading(true);
      else setIsRefreshing(true);

      const params = new URLSearchParams();
      if (search.trim()) params.append('search', search.trim());
      if (statusFilter !== 'ALL') params.append('status', statusFilter);

      const qs = params.toString() ? `?${params.toString()}` : '';
      const data = await fetchWithAuth(`/drivers${qs}`);

      if (data && Array.isArray(data.drivers)) {
        setDrivers(data.drivers);
        if (data.stats) {
          setStats(data.stats);
        }
      } else if (Array.isArray(data)) {
        setDrivers(data);
      }
    } catch (err: any) {
      showToast.error(err.message || 'Failed to load drivers');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadDrivers(true);
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      loadDrivers(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [search, statusFilter]);

  // Load single driver details with assignments
  const handleOpenDetail = async (driverId: string) => {
    setViewingDriverId(driverId);
    setIsLoadingDetail(true);
    try {
      const data = await fetchWithAuth(`/drivers/${driverId}`);
      setDriverDetail(data);
    } catch (err: any) {
      showToast.error(err.message || 'Failed to fetch driver details');
      setViewingDriverId(null);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingDriver(null);
    setName('');
    setPhone('');
    setAlternatePhone('');
    setRouteOrArea('');
    setPincode('');
    setVehicleType('2 Wheeler');
    setVehicleNumber('');
    setNotes('');
    setIsActive(true);
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (driver: DriverRecord) => {
    setEditingDriver(driver);
    setName(driver.name);
    setPhone(driver.phone);
    setAlternatePhone(driver.alternatePhone || '');
    setRouteOrArea(driver.routeOrArea || '');
    setPincode(driver.pincode || '');
    setVehicleType(driver.vehicleType || '2 Wheeler');
    setVehicleNumber(driver.vehicleNumber);
    setNotes(driver.notes || '');
    setIsActive(driver.isActive);
    setFormErrors({});
    setIsModalOpen(true);
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = 'Full name is required';
    if (!phone.trim()) {
      errors.phone = 'Phone number is required';
    } else if (!/^[0-9+\-\s]{7,15}$/.test(phone.trim())) {
      errors.phone = 'Enter a valid phone number (7-15 digits)';
    }

    if (alternatePhone.trim() && !/^[0-9+\-\s]{7,15}$/.test(alternatePhone.trim())) {
      errors.alternatePhone = 'Enter a valid alternate phone number';
    }

    if (!pincode.trim()) {
      errors.pincode = 'Pincode is required';
    } else if (!/^[0-9]{6}$/.test(pincode.trim())) {
      errors.pincode = 'Enter a valid 6-digit PIN code';
    }

    if (!vehicleType.trim()) errors.vehicleType = 'Vehicle type is required';
    if (!vehicleNumber.trim()) {
      errors.vehicleNumber = 'Vehicle number is required';
    } else if (vehicleNumber.trim().length < 4) {
      errors.vehicleNumber = 'Enter a valid registration/plate number';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setIsSubmitting(true);
      const payload = {
        name: name.trim(),
        phone: phone.trim(),
        alternatePhone: alternatePhone.trim() || undefined,
        routeOrArea: routeOrArea.trim() || undefined,
        pincode: pincode.trim(),
        vehicleType: vehicleType.trim(),
        vehicleNumber: vehicleNumber.trim().toUpperCase(),
        notes: notes.trim() || undefined,
        isActive,
      };

      if (editingDriver) {
        await fetchWithAuth(`/drivers/${editingDriver.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        showToast.success('Driver updated successfully');
      } else {
        await fetchWithAuth('/drivers', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showToast.success('Driver created successfully');
      }

      setIsModalOpen(false);
      loadDrivers(false);
    } catch (err: any) {
      showToast.error(err.message || 'Failed to save driver');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (driver: DriverRecord) => {
    try {
      const nextStatus = !driver.isActive;
      await fetchWithAuth(`/drivers/${driver.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: nextStatus }),
      });
      showToast.success(`Driver ${nextStatus ? 'activated' : 'deactivated'} successfully`);
      loadDrivers(false);
    } catch (err: any) {
      showToast.error(err.message || 'Failed to update driver status');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      setIsDeleting(true);
      const res = await fetchWithAuth(`/drivers/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      showToast.success(res?.message || 'Driver removed successfully');
      setDeleteTarget(null);
      loadDrivers(false);
    } catch (err: any) {
      showToast.error(err.message || 'Failed to remove driver');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="w-full min-h-full flex flex-col bg-[#F8FAFC]">
      {/* ─── Standard Topbar ────────────────────────────────────────── */}
      <DistributorTopbar
        title="Drivers"
        subtitle="Manage delivery fleet, routes, and vehicle assignments"
        icon={Truck}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => loadDrivers(false)}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-[#E2E8F0] hover:bg-slate-50 rounded-lg transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
              title="Refresh drivers list"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#1677C8]' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#1677C8] hover:bg-[#1263a8] rounded-lg transition-colors shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Driver</span>
            </button>
          </div>
        }
      />

      {/* ─── Main Content Container ─────────────────────────────────── */}
      <div className="w-full p-3.5 sm:p-6 space-y-3.5 sm:space-y-4 flex-1">
        {/* Controls Bar: Search & Status Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-white p-2.5 sm:p-3 rounded-xl border border-[#E2E8F0] shadow-xs">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by driver name, phone, vehicle, or route..."
              className="w-full pl-9 pr-8 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs font-medium text-[#16324F] placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#1677C8] focus:bg-white transition"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status Tabs */}
          <div className="flex items-center gap-1 p-1 bg-[#F1F5F9] rounded-lg shrink-0 self-start sm:self-auto">
            {(
              [
                { key: 'ALL', label: 'All', count: stats.total },
                { key: 'ACTIVE', label: 'Active', count: stats.active },
                { key: 'INACTIVE', label: 'Inactive', count: stats.inactive },
              ] as const
            ).map((tab) => {
              const isSelected = statusFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setStatusFilter(tab.key)}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-white text-[#1677C8] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      isSelected
                        ? 'bg-[#1677C8]/10 text-[#1677C8]'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── Drivers List Table / Cards ─────────────────────────────── */}
        {isLoading ? (
          <div className="py-12 bg-white rounded-xl border border-[#E2E8F0]">
            <EdropsPageLoader label="Loading drivers..." />
          </div>
        ) : drivers.length === 0 ? (
          /* Empty State */
          <div className="py-16 px-4 bg-white rounded-xl border border-[#E2E8F0] text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <p className="font-bold text-sm text-[#16324F]">No drivers yet</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {search || statusFilter !== 'ALL'
                  ? 'No drivers matched your search criteria. Try adjusting filters.'
                  : 'Add your first delivery driver to assign orders and manage routes.'}
              </p>
            </div>
            {!search && statusFilter === 'ALL' && (
              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1677C8] hover:bg-[#1263a8] rounded-lg transition shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Driver</span>
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs overflow-hidden">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs text-[#16324F]">
                <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] font-semibold text-slate-500 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Driver</th>
                    <th className="py-3 px-4">Phone Number</th>
                    <th className="py-3 px-4">Route / Area</th>
                    <th className="py-3 px-4">Vehicle Details</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4">Created Date</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {drivers.map((driver) => {
                    const initials = driver.name
                      .split(' ')
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase();

                    return (
                      <tr key={driver.id} className="hover:bg-slate-50/70 transition-colors">
                        {/* Driver Name & Avatar */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-[#1677C8]/10 text-[#1677C8] font-bold flex items-center justify-center text-xs shrink-0">
                              {initials || 'DR'}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-xs text-[#16324F] truncate">
                                {driver.name}
                              </p>
                              {driver._count?.orders !== undefined && driver._count.orders > 0 && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                                  <PackageCheck className="w-3 h-3 text-[#1677C8]" />
                                  {driver._count.orders} {driver._count.orders === 1 ? 'order' : 'orders'} handled
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Phone */}
                        <td className="py-3 px-4">
                          <div className="space-y-0.5">
                            <a
                              href={`tel:${driver.phone}`}
                              className="inline-flex items-center gap-1 font-semibold text-slate-700 hover:text-[#1677C8] transition-colors"
                            >
                              <Phone className="w-3 h-3 text-slate-400" />
                              {driver.phone}
                            </a>
                            {driver.alternatePhone && (
                              <p className="text-[10px] text-slate-400">
                                Alt: {driver.alternatePhone}
                              </p>
                            )}
                          </div>
                        </td>

                        {/* Route / Area & Pincode */}
                        <td className="py-3 px-4">
                          <div className="space-y-0.5">
                            {driver.routeOrArea ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700">
                                <MapPin className="w-3 h-3 text-slate-400" />
                                {driver.routeOrArea}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">—</span>
                            )}
                            {driver.pincode && (
                              <div className="text-[11px] font-mono text-slate-500">
                                PIN: <span className="font-semibold text-slate-700">{driver.pincode}</span>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Vehicle Details */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">
                              {driver.vehicleType}
                            </span>
                            <span className="font-mono text-xs font-bold text-slate-800 tracking-wider">
                              {driver.vehicleNumber}
                            </span>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4 text-center">
                          {driver.isActive ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                              Inactive
                            </span>
                          )}
                        </td>

                        {/* Created Date */}
                        <td className="py-3 px-4 text-slate-500 text-[11px]">
                          {new Date(driver.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenDetail(driver.id)}
                              className="p-1.5 text-slate-500 hover:text-[#1677C8] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                              title="View driver details & assignments"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(driver)}
                              className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                              title="Edit driver"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleStatus(driver)}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                driver.isActive
                                  ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                                  : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'
                              }`}
                              title={driver.isActive ? 'Deactivate driver' : 'Activate driver'}
                            >
                              <Power className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => setDeleteTarget(driver)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Delete / Deactivate driver"
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

            {/* Mobile Card List View */}
            <div className="md:hidden divide-y divide-[#E2E8F0]">
              {drivers.map((driver) => {
                const initials = driver.name
                  .split(' ')
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase();

                return (
                  <div key={driver.id} className="p-3.5 bg-white space-y-2.5">
                    {/* Header: Avatar, Name, Status */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-[#1677C8]/10 text-[#1677C8] font-bold flex items-center justify-center text-xs shrink-0">
                          {initials || 'DR'}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-xs text-[#16324F] truncate">
                            {driver.name}
                          </p>
                          <a
                            href={`tel:${driver.phone}`}
                            className="text-[11px] text-slate-500 font-medium hover:text-[#1677C8]"
                          >
                            {driver.phone}
                          </a>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {driver.isActive ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                            Inactive
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Vehicle & Route info */}
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span className="px-1.5 py-0.5 rounded font-mono font-semibold bg-slate-100 text-slate-800">
                        {driver.vehicleNumber}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                        {driver.vehicleType}
                      </span>
                      {driver.routeOrArea && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-[#1677C8]">
                          <MapPin className="w-3 h-3" />
                          {driver.routeOrArea}
                        </span>
                      )}
                      {driver.pincode && (
                        <span className="px-1.5 py-0.5 rounded font-mono font-medium bg-slate-100 text-slate-700">
                          PIN: {driver.pincode}
                        </span>
                      )}
                    </div>

                    {/* Actions row */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                      <span className="text-[10px] text-slate-400">
                        Added {new Date(driver.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(driver.id)}
                          className="px-2 py-1 text-slate-600 hover:text-[#1677C8] hover:bg-slate-100 rounded text-xs font-semibold cursor-pointer"
                        >
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(driver)}
                          className="px-2 py-1 text-amber-600 hover:bg-amber-50 rounded text-xs font-semibold cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(driver)}
                          className="px-2 py-1 text-slate-500 hover:bg-slate-100 rounded text-xs font-semibold cursor-pointer"
                        >
                          {driver.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(driver)}
                          className="p-1 text-rose-500 hover:bg-rose-50 rounded cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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

      {/* ─── ADD / EDIT DRIVER MODAL ─────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-[#E2E8F0] overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#1677C8]/10 text-[#1677C8] flex items-center justify-center">
                  <Truck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#16324F]">
                    {editingDriver ? 'Edit Driver' : 'Add New Driver'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {editingDriver
                      ? 'Update driver credentials and vehicle assignment'
                      : 'Register a driver under your distributor account'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Basic Information */}
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Basic Information
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Full Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        if (formErrors.name) setFormErrors((p) => ({ ...p, name: '' }));
                      }}
                      placeholder="e.g. Ramesh Kumar"
                      className={`w-full px-3 py-2 bg-white border rounded-lg text-xs font-medium text-[#16324F] focus:outline-none focus:ring-1 ${
                        formErrors.name
                          ? 'border-rose-400 focus:ring-rose-400'
                          : 'border-[#E2E8F0] focus:ring-[#1677C8]'
                      }`}
                    />
                    {formErrors.name && (
                      <p className="text-[11px] text-rose-500 mt-0.5">{formErrors.name}</p>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Phone Number <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        if (formErrors.phone) setFormErrors((p) => ({ ...p, phone: '' }));
                      }}
                      placeholder="e.g. 9876543210"
                      className={`w-full px-3 py-2 bg-white border rounded-lg text-xs font-medium text-[#16324F] focus:outline-none focus:ring-1 ${
                        formErrors.phone
                          ? 'border-rose-400 focus:ring-rose-400'
                          : 'border-[#E2E8F0] focus:ring-[#1677C8]'
                      }`}
                    />
                    {formErrors.phone && (
                      <p className="text-[11px] text-rose-500 mt-0.5">{formErrors.phone}</p>
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Alternate Phone <span className="text-slate-400 font-normal">(optional)</span>
                    </label>
                    <input
                      type="tel"
                      value={alternatePhone}
                      onChange={(e) => setAlternatePhone(e.target.value)}
                      placeholder="e.g. 9123456789"
                      className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-xs font-medium text-[#16324F] focus:outline-none focus:ring-1 focus:ring-[#1677C8]"
                    />
                    {formErrors.alternatePhone && (
                      <p className="text-[11px] text-rose-500 mt-0.5">{formErrors.alternatePhone}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Assignment & Vehicle */}
              <div className="pt-2 border-t border-slate-100">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Assignment & Vehicle
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Route / Area <span className="text-slate-400 font-normal">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={routeOrArea}
                      onChange={(e) => setRouteOrArea(e.target.value)}
                      placeholder="e.g. North Zone / Sector 4"
                      className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-xs font-medium text-[#16324F] focus:outline-none focus:ring-1 focus:ring-[#1677C8]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Pincode <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={pincode}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                        setPincode(val);
                        if (formErrors.pincode) setFormErrors((p) => ({ ...p, pincode: '' }));
                      }}
                      placeholder="e.g. 682001"
                      className={`w-full px-3 py-2 bg-white border rounded-lg text-xs font-mono font-semibold text-[#16324F] focus:outline-none focus:ring-1 ${
                        formErrors.pincode
                          ? 'border-rose-400 focus:ring-rose-400'
                          : 'border-[#E2E8F0] focus:ring-[#1677C8]'
                      }`}
                    />
                    {formErrors.pincode && (
                      <p className="text-[11px] text-rose-500 mt-0.5">{formErrors.pincode}</p>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Vehicle Type <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={vehicleType}
                      onChange={(e) => setVehicleType(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-xs font-medium text-[#16324F] focus:outline-none focus:ring-1 focus:ring-[#1677C8]"
                    >
                      {VEHICLE_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Vehicle Number <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={vehicleNumber}
                      onChange={(e) => {
                        setVehicleNumber(e.target.value.toUpperCase());
                        if (formErrors.vehicleNumber) setFormErrors((p) => ({ ...p, vehicleNumber: '' }));
                      }}
                      placeholder="e.g. KL 07 AB 1234"
                      className={`w-full px-3 py-2 bg-white border rounded-lg text-xs font-mono font-semibold uppercase text-[#16324F] focus:outline-none focus:ring-1 ${
                        formErrors.vehicleNumber
                          ? 'border-rose-400 focus:ring-rose-400'
                          : 'border-[#E2E8F0] focus:ring-[#1677C8]'
                      }`}
                    />
                    {formErrors.vehicleNumber && (
                      <p className="text-[11px] text-rose-500 mt-0.5">{formErrors.vehicleNumber}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Status & Notes */}
              <div className="pt-2 border-t border-slate-100 space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Notes <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Morning shift preferred, experienced with multi-drop"
                    className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-xs text-[#16324F] focus:outline-none focus:ring-1 focus:ring-[#1677C8]"
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-[#E2E8F0]">
                  <div>
                    <p className="text-xs font-bold text-[#16324F]">Active Status</p>
                    <p className="text-[11px] text-slate-500">
                      Inactive drivers cannot be selected for new delivery assignments.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsActive(!isActive)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      isActive ? 'bg-[#1677C8]' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        isActive ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-[#E2E8F0] hover:bg-slate-50 rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#1677C8] hover:bg-[#1263a8] rounded-lg transition shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{editingDriver ? 'Save Changes' : 'Create Driver'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── DRIVER DETAIL DRAWER / MODAL ───────────────────────────── */}
      {viewingDriverId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-[#E2E8F0] overflow-hidden flex flex-col max-h-[92vh]">
            {/* Drawer Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0] bg-[#F8FAFC]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#1677C8]/10 text-[#1677C8] flex items-center justify-center">
                  <Truck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#16324F]">Driver Details & Activity</h3>
                  <p className="text-[11px] text-slate-500">
                    Comprehensive profile and order assignments
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setViewingDriverId(null);
                  setDriverDetail(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {isLoadingDetail || !driverDetail ? (
                <div className="py-12">
                  <EdropsPageLoader label="Loading driver information..." />
                </div>
              ) : (
                <>
                  {/* Driver Profile Card */}
                  <div className="p-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-[#1677C8] text-white font-bold text-base flex items-center justify-center shadow-xs">
                          {driverDetail.name
                            .split(' ')
                            .map((p) => p[0])
                            .slice(0, 2)
                            .join('')
                            .toUpperCase()}
                        </div>
                        <div>
                          <h4 className="text-base font-bold text-[#16324F]">
                            {driverDetail.name}
                          </h4>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-400" />
                              {driverDetail.phone}
                            </span>
                            {driverDetail.alternatePhone && (
                              <span>• Alt: {driverDetail.alternatePhone}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {driverDetail.isActive ? (
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Active Driver
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                            Inactive
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-3 border-t border-[#E2E8F0] text-xs">
                      <div>
                        <span className="text-[11px] text-slate-400 block">Vehicle Type</span>
                        <span className="font-semibold text-[#16324F]">
                          {driverDetail.vehicleType}
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-400 block">Vehicle Number</span>
                        <span className="font-mono font-bold text-[#16324F]">
                          {driverDetail.vehicleNumber}
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-400 block">Route / Area</span>
                        <span className="font-semibold text-[#16324F]">
                          {driverDetail.routeOrArea || 'Not assigned'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-400 block">Pincode</span>
                        <span className="font-mono font-bold text-[#16324F]">
                          {driverDetail.pincode || '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-400 block">Registered On</span>
                        <span className="text-slate-600">
                          {new Date(driverDetail.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                      {driverDetail.notes && (
                        <div className="col-span-2">
                          <span className="text-[11px] text-slate-400 block">Notes</span>
                          <span className="text-slate-600">{driverDetail.notes}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Driver Activity / Assignments */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Assigned Orders & Deliveries
                      </h4>
                      <span className="text-xs text-slate-500 font-semibold">
                        {driverDetail.orders?.length || 0} recent assignments
                      </span>
                    </div>

                    {!driverDetail.orders || driverDetail.orders.length === 0 ? (
                      <div className="p-8 text-center rounded-xl border border-dashed border-[#E2E8F0] bg-slate-50/50">
                        <PackageCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-xs font-bold text-[#16324F]">
                          No orders currently assigned to this driver
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          When orders are assigned to this driver in Order Management, they will be listed here.
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y divide-[#E2E8F0] border border-[#E2E8F0] rounded-xl overflow-hidden bg-white">
                        {driverDetail.orders.map((ord) => (
                          <div key={ord.id} className="p-3.5 hover:bg-slate-50 transition flex items-center justify-between gap-3 text-xs">
                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-[#16324F]">
                                  #{ord.id.slice(0, 8).toUpperCase()}
                                </span>
                                <span className="px-2 py-0.2 rounded-full text-[10px] font-semibold bg-blue-50 text-[#1677C8]">
                                  {ord.status.replace(/_/g, ' ')}
                                </span>
                              </div>

                              <p className="text-xs text-slate-600 truncate">
                                Customer: <span className="font-semibold text-slate-800">
                                  {ord.customer?.user
                                    ? `${ord.customer.user.firstName} ${ord.customer.user.lastName}`
                                    : 'Guest Customer'}
                                </span>
                                {ord.customer?.user?.phone && ` (${ord.customer.user.phone})`}
                              </p>

                              {ord.address && (
                                <p className="text-[11px] text-slate-400 truncate">
                                  {ord.address.street || ord.address.area}, {ord.address.city}
                                </p>
                              )}
                            </div>

                            <div className="text-right shrink-0">
                              <p className="font-bold text-xs text-[#16324F]">
                                ₹{ord.totalAmount?.toLocaleString('en-IN') || '0'}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                {new Date(ord.createdAt).toLocaleDateString('en-IN', {
                                  day: 'numeric',
                                  month: 'short',
                                })}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Drawer Footer */}
            <div className="px-5 py-3 border-t border-[#E2E8F0] flex items-center justify-end bg-slate-50">
              <button
                type="button"
                onClick={() => {
                  setViewingDriverId(null);
                  setDriverDetail(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-[#E2E8F0] hover:bg-slate-100 rounded-lg transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── DEACTIVATE / DELETE CONFIRMATION DIALOG ──────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-[#E2E8F0] p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#16324F]">
                  Remove Driver "{deleteTarget.name}"?
                </h3>
                <p className="text-xs text-slate-500">
                  Are you sure you want to remove this driver?
                </p>
              </div>
            </div>

            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-800 space-y-1">
              <p className="font-semibold">Historical Records Protection:</p>
              <p className="text-[11px] text-amber-700 leading-relaxed">
                If this driver has past deliveries or order assignments, they will be safely deactivated so historical order audit trails remain completely intact.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-[#E2E8F0] hover:bg-slate-50 rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Removing...</span>
                  </>
                ) : (
                  <span>Confirm Removal</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
