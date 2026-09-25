import { useState, useEffect, useRef } from 'react';
import {
  MapPin,
  Plus,
  Trash2,
  Search,
  CheckCircle2,
  XCircle,
  Loader2,
  X,
  AlertCircle,
  Building,
  Navigation,
  Check,
} from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';
import { showToast } from '../../../utils/toast';
import { DistributorTopbar } from '../components/DistributorTopbar';
import { EdropsPageLoader } from '../../../components/common/EdropsPageLoader';

export interface ServiceAreaRecord {
  id: string;
  distributorId: string;
  pincode: string;
  location?: string | null;
  district?: string | null;
  state?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

type LookupStatus = 'idle' | 'loading' | 'success' | 'not_found' | 'error';
type FilterTab = 'all' | 'active' | 'paused';

export default function ServiceAreas() {
  const [areas, setAreas] = useState<ServiceAreaRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  // Add Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [pincode, setPincode] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [district, setDistrict] = useState<string>('');
  const [state, setState] = useState<string>('Kerala');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Pincode Lookup States
  const [lookupStatus, setLookupStatus] = useState<LookupStatus>('idle');
  const [lookupMessage, setLookupMessage] = useState<string>('');
  const lastFetchedPinRef = useRef<string>('');

  // Delete Confirm State
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const loadAreas = async () => {
    setIsLoading(true);
    try {
      const data = await fetchWithAuth('/distributor/service-areas');
      setAreas(Array.isArray(data) ? data : []);
    } catch {
      showToast.error('Failed to load delivery areas');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAreas();
  }, []);

  const openAddModal = () => {
    setPincode('');
    setLocation('');
    setDistrict('');
    setState('Kerala');
    setLookupStatus('idle');
    setLookupMessage('');
    lastFetchedPinRef.current = '';
    setIsModalOpen(true);
  };

  const triggerLookup = async (code: string) => {
    if (lastFetchedPinRef.current === code) return;
    lastFetchedPinRef.current = code;

    setLookupStatus('loading');
    setLookupMessage('Fetching location...');

    try {
      let res: any;
      try {
        res = await fetchWithAuth(`/distributor/service-areas/lookup?pincode=${code}`);
      } catch (err) {
        console.warn('Backend lookup exception:', err);
      }

      // If backend was unreachable or returned an error, run direct browser fallback
      if (!res || (!res.found && res.error)) {
        try {
          const zippo = await fetch(`https://api.zippopotam.us/in/${code}`);
          if (zippo.ok) {
            const zd = await zippo.json();
            if (zd.places && zd.places.length > 0) {
              res = {
                found: true,
                location: (zd.places[0]['place name'] || '').replace(/ B\.O$/, ''),
                district: '',
                state: zd.places[0].state || 'Kerala',
              };
            }
          } else if (zippo.status === 404) {
            res = { found: false, notFound: true, message: 'Pincode not found.' };
          }
        } catch {}

        if (!res?.found && !res?.notFound) {
          try {
            const direct = await fetch(`https://api.postalpincode.in/pincode/${code}`);
            const d = await direct.json();
            if (Array.isArray(d) && d[0]?.Status === 'Success' && d[0]?.PostOffice?.length > 0) {
              const po =
                d[0].PostOffice.find((p: any) => p.BranchType?.includes('Sub') || p.BranchType?.includes('Head')) ||
                d[0].PostOffice[0];
              res = {
                found: true,
                location: po?.Name || '',
                district: po?.District || '',
                state: po?.State || 'Kerala',
              };
            } else if (Array.isArray(d) && d[0]?.Status === 'Error') {
              res = { found: false, notFound: true, message: 'Pincode not found.' };
            }
          } catch {}
        }
      }

      if (res?.found) {
        setLookupStatus('success');
        setLookupMessage('Location details loaded');
        // Autofill values — fully editable by user
        if (res.location) setLocation(res.location);
        if (res.district) setDistrict(res.district);
        if (res.state) setState(res.state);
      } else if (res?.notFound) {
        setLookupStatus('not_found');
        setLookupMessage('Pincode not found.');
      } else if (res?.error) {
        setLookupStatus('error');
        setLookupMessage("Location details couldn't be fetched. You can enter them manually.");
      } else {
        setLookupStatus('not_found');
        setLookupMessage('Pincode not found.');
      }
    } catch {
      setLookupStatus('error');
      setLookupMessage("Location details couldn't be fetched. You can enter them manually.");
    }
  };

  const handlePincodeChange = (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 6);
    setPincode(clean);

    if (clean.length < 6) {
      setLookupStatus('idle');
      setLookupMessage('');
      lastFetchedPinRef.current = '';
      return;
    }

    if (clean.length === 6) {
      triggerLookup(clean);
    }
  };

  const isDuplicate = pincode.length === 6 && areas.some((a) => a.pincode === pincode && a.isActive);

  const handleAddArea = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPincode = pincode.trim();
    if (!/^\d{6}$/.test(cleanPincode)) {
      showToast.error('Please enter a valid 6-digit pincode');
      return;
    }

    if (isDuplicate) {
      showToast.error(`Pincode ${cleanPincode} is already configured in your active delivery areas.`);
      return;
    }

    setIsSubmitting(true);
    try {
      await fetchWithAuth('/distributor/service-areas', {
        method: 'POST',
        body: JSON.stringify({
          pincode: cleanPincode,
          location: location.trim() || undefined,
          district: district.trim() || undefined,
          state: state.trim() || undefined,
        }),
      });
      showToast.success(`Pincode ${cleanPincode} added to your delivery areas`);
      setIsModalOpen(false);
      loadAreas();
    } catch (err: any) {
      showToast.error(err.message || 'Failed to save service area');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggle = async (id: string) => {
    try {
      await fetchWithAuth(`/distributor/service-areas/${id}/toggle`, {
        method: 'PATCH',
      });
      setAreas((prev) =>
        prev.map((a) => (a.id === id ? { ...a, isActive: !a.isActive } : a))
      );
      showToast.success('Status updated');
    } catch {
      showToast.error('Failed to update area status');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetchWithAuth(`/distributor/service-areas/${id}`, {
        method: 'DELETE',
      });
      showToast.success('Pincode removed from your delivery network');
      setAreas((prev) => prev.filter((a) => a.id !== id));
      setDeleteConfirmId(null);
    } catch {
      showToast.error('Failed to delete service area');
    }
  };

  const filtered = areas.filter((a) => {
    // Filter tab
    if (activeTab === 'active' && !a.isActive) return false;
    if (activeTab === 'paused' && a.isActive) return false;

    // Search query
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      a.pincode.includes(q) ||
      (a.location && a.location.toLowerCase().includes(q)) ||
      (a.district && a.district.toLowerCase().includes(q)) ||
      (a.state && a.state.toLowerCase().includes(q))
    );
  });

  const activeCount = areas.filter((a) => a.isActive).length;
  const pausedCount = areas.length - activeCount;

  return (
    <div className="w-full min-h-full flex flex-col bg-[#F8FAFC] animate-in fade-in duration-150">
      {/* ─── STANDARDIZED DISTRIBUTOR TOPBAR ──────────────────────── */}
      <DistributorTopbar
        title="Delivery Service Areas"
        subtitle="Manage the pincodes and localities your fleet delivers to. Customers in these pincodes can place orders."
        icon={MapPin}
        actions={
          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 bg-[#1677C8] hover:bg-[#125ea0] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Pincode</span>
          </button>
        }
      />

      <div className="w-full p-3.5 sm:p-6 space-y-3.5 sm:space-y-4 flex-1">
        {isLoading && areas.length === 0 ? (
          <EdropsPageLoader minHeight="min-h-[50vh]" />
        ) : (
          <>
            {/* ─── 2. SUMMARY STATS CARDS (2-COL RESPONSIVE) ──────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
              <div className="bg-white p-3 rounded-xl border border-[#E2E8F0] shadow-2xs flex flex-col justify-center">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate">Total Configured</span>
                  <Building className="w-4 h-4 text-slate-400" />
                </div>
                <p className="text-xl sm:text-2xl font-extrabold text-[#16324F] mt-1">{areas.length}</p>
              </div>

              <div className="bg-white p-3 rounded-xl border border-[#E2E8F0] shadow-2xs flex flex-col justify-center">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 truncate">Active Areas</span>
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                <p className="text-xl sm:text-2xl font-extrabold text-emerald-600 mt-1">{activeCount}</p>
              </div>

              <div className="bg-white p-3 rounded-xl border border-[#E2E8F0] shadow-2xs flex flex-col justify-center">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 truncate">Paused Areas</span>
                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                </div>
                <p className="text-xl sm:text-2xl font-extrabold text-amber-600 mt-1">{pausedCount}</p>
              </div>

              <div className="bg-white p-3 rounded-xl border border-[#E2E8F0] shadow-2xs flex flex-col justify-center">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate">Matching Rule</span>
                  <Navigation className="w-4 h-4 text-[#1677C8]" />
                </div>
                <p className="text-sm sm:text-base font-extrabold text-[#16324F] mt-1 truncate">Exact 6-Digit</p>
              </div>
            </div>

            {/* ─── 3. SEARCH & FILTER TOOLBAR ────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by pincode, locality, district..."
                  className="w-full pl-9 pr-8 py-2 text-xs font-semibold text-slate-800 outline-none bg-slate-50 placeholder:text-slate-400 rounded-xl border border-slate-200 focus:border-[#1677C8] focus:bg-white transition-all"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Segmented Filter Tabs */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl shrink-0 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setActiveTab('all')}
                  className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer text-center ${
                    activeTab === 'all'
                      ? 'bg-white text-[#16324F] shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All ({areas.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('active')}
                  className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer text-center ${
                    activeTab === 'active'
                      ? 'bg-white text-emerald-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Active ({activeCount})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('paused')}
                  className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer text-center ${
                    activeTab === 'paused'
                      ? 'bg-white text-amber-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Paused ({pausedCount})
                </button>
              </div>
            </div>

            {/* ─── 4. SERVICE AREAS LIST / TABLE (FULL WIDTH) ────────────────────── */}
            <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs overflow-hidden">
              {filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-500 space-y-2 px-4">
            <AlertCircle className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="font-semibold text-sm text-[#16324F]">No service pincodes found</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {search
                ? 'No pincodes matched your search filter.'
                : 'Add your first delivery pincode to start receiving customer orders in that area.'}
            </p>
            {!search && (
              <button
                type="button"
                onClick={openAddModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 mt-2 bg-[#1677C8] text-white rounded-lg text-xs font-bold hover:bg-[#125ea0]"
              >
                <Plus className="w-3.5 h-3.5" />
                Add First Pincode
              </button>
            )}
          </div>
        ) : (
          <div>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4">Pincode</th>
                    <th className="py-3 px-4">Locality / Area Name</th>
                    <th className="py-3 px-4">District</th>
                    <th className="py-3 px-4">State</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9] text-xs sm:text-sm">
                  {filtered.map((item) => (
                    <tr key={item.id} className="hover:bg-[#F8FAFC] transition-colors">
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center font-mono font-bold text-xs sm:text-sm px-2.5 py-1 rounded-lg bg-[#EBF5FB] text-[#1677C8] border border-blue-200">
                          {item.pincode}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-[#0F172A]">
                        {item.location || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {item.district || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {item.state || 'India'}
                      </td>
                      <td className="py-3.5 px-4">
                        {item.isActive ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                            <XCircle className="w-3 h-3 text-slate-400" />
                            Paused
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggle(item.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                              item.isActive
                                ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                            }`}
                          >
                            {item.isActive ? 'Pause' : 'Activate'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(item.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Remove pincode"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="md:hidden divide-y divide-[#F1F5F9]">
              {filtered.map((item) => (
                <div key={item.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="font-mono font-bold text-xs px-2.5 py-1 rounded-lg bg-[#EBF5FB] text-[#1677C8] border border-blue-200 shrink-0">
                        {item.pincode}
                      </span>
                      <div className="min-w-0">
                        <p className="font-bold text-xs sm:text-sm text-[#0F172A] truncate">
                          {item.location || 'Area'}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          {[item.district, item.state].filter(Boolean).join(', ') || 'India'}
                        </p>
                      </div>
                    </div>
                    {item.isActive ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 shrink-0">
                        <CheckCircle2 className="w-3 h-3" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200 shrink-0">
                        <XCircle className="w-3 h-3" />
                        Paused
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => handleToggle(item.id)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      {item.isActive ? 'Pause Delivery' : 'Activate Delivery'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(item.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                      title="Remove pincode"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
            </div>
          </>
        )}
      </div>

      {/* ─── 5. ADD PINCODE MODAL (COMPACT & PROFESSIONAL) ────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-2xl max-w-md w-full p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150 my-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1677C8]/10 text-[#1677C8]">
                  <MapPin className="w-4 h-4" />
                </div>
                <h2 className="font-bold text-base text-[#16324F]">
                  Add Serviceable Pincode
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddArea} className="space-y-3.5">
              {/* STEP 1: PINCODE FIRST */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                    PINCODE *
                  </label>
                  {pincode.length > 0 && pincode.length < 6 && (
                    <span className="text-[10px] text-slate-400">
                      {6 - pincode.length} more digits
                    </span>
                  )}
                </div>

                <div className="relative">
                  <input
                    type="text"
                    required
                    autoFocus
                    maxLength={6}
                    inputMode="numeric"
                    value={pincode}
                    onChange={(e) => handlePincodeChange(e.target.value)}
                    placeholder="Enter 6-digit pincode (e.g. 673638)"
                    className={`w-full py-2.5 px-3 rounded-xl border text-sm font-mono font-bold tracking-wider outline-none transition-colors ${
                      isDuplicate
                        ? 'border-amber-300 bg-amber-50/30 text-amber-900 focus:border-amber-500'
                        : lookupStatus === 'success'
                        ? 'border-emerald-300 bg-emerald-50/20 text-slate-900 focus:border-emerald-500'
                        : 'border-slate-200 text-slate-900 focus:border-[#1677C8]'
                    }`}
                  />
                  {lookupStatus === 'loading' && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 className="w-4 h-4 animate-spin text-[#1677C8]" />
                    </div>
                  )}
                  {lookupStatus === 'success' && !isDuplicate && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Check className="w-4 h-4 text-emerald-600" />
                    </div>
                  )}
                </div>

                {/* Inline Lookup Status Messages */}
                {lookupStatus === 'loading' && (
                  <p className="text-[11px] text-[#1677C8] font-medium mt-1 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    {lookupMessage || 'Fetching location...'}
                  </p>
                )}
                {lookupStatus === 'success' && !isDuplicate && (
                  <p className="text-[11px] text-emerald-600 font-medium mt-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    {lookupMessage || 'Location details loaded'}
                  </p>
                )}
                {lookupStatus === 'not_found' && (
                  <p className="text-[11px] text-amber-600 font-medium mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {lookupMessage || 'Location details not found for this pincode.'}
                  </p>
                )}
                {lookupStatus === 'error' && (
                  <p className="text-[11px] text-slate-500 font-medium mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 text-slate-400" />
                    {lookupMessage || "Couldn't fetch location details. You can enter the location manually."}
                  </p>
                )}
                {isDuplicate && (
                  <p className="text-[11px] text-amber-700 font-semibold mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    This pincode is already in your active delivery areas.
                  </p>
                )}
              </div>

              {/* STEP 2: LOCALITY / AREA NAME (EDITABLE) */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  LOCALITY / AREA NAME
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Kondotty"
                  className="w-full py-2 px-3 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-900 outline-none focus:border-[#1677C8] transition-colors"
                />
              </div>

              {/* STEP 3: DISTRICT & STATE (EDITABLE) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    DISTRICT
                  </label>
                  <input
                    type="text"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    placeholder="e.g. Malappuram"
                    className="w-full py-2 px-3 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-900 outline-none focus:border-[#1677C8] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    STATE
                  </label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="e.g. Kerala"
                    className="w-full py-2 px-3 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-900 outline-none focus:border-[#1677C8] transition-colors"
                  />
                </div>
              </div>

              {/* MODAL ACTIONS */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || pincode.length !== 6 || isDuplicate}
                  className="px-5 py-2.5 rounded-xl bg-[#1677C8] hover:bg-[#125ea0] text-white font-bold text-xs shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 transition-colors"
                >
                  {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  Save Pincode
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── 6. DELETE CONFIRMATION MODAL ─────────────────────────────────── */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-2xl max-w-sm w-full p-5 space-y-3 text-center animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-base text-[#0F172A]">Remove Service Pincode?</h3>
            <p className="text-xs text-slate-500">
              Customers in this pincode will no longer be serviceable unless another distributor covers it.
            </p>
            <div className="pt-2 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteConfirmId)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
