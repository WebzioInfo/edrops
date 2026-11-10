import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Truck,
  Calendar,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Send,
  Loader2,
  MapPin,
  Phone,
  X,
  Package,
} from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';
import { toast } from 'react-hot-toast';
import { EdropsPageLoader } from '../../../components/common/EdropsPageLoader';

interface VerificationInfo {
  verificationStatus: 'PENDING_VERIFICATION' | 'VERIFIED' | 'DISPUTED';
  deliveredQty: number;
  emptyCollected: number;
  requestedAt?: string;
  verifiedAt?: string;
  disputedAt?: string;
  customerFeedback?: string;
  disputeReason?: string;
  staffNotes?: string;
}

interface DeliveryItem {
  id: string;
  scheduledFor: string;
  requiredQuantity: number;
  status: string;
  timeSlot?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
  customer: {
    id: string;
    customerType?: string;
    user: {
      id: string;
      firstName: string;
      lastName: string;
      phone: string;
      email: string;
    };
  };
  report?: {
    partnerDeliveredQty?: number;
    partnerEmptyCollected?: number;
    staffNotes?: string;
  };
  verification?: VerificationInfo | null;
}

export default function DailyDeliveries() {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  const [deliveries, setDeliveries] = useState<DeliveryItem[]>([]);
  const [metrics, setMetrics] = useState({
    total: 0,
    delivered: 0,
    pendingVerification: 0,
    pendingDispatch: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'PENDING_VERIFICATION' | 'DELIVERED' | 'DISPUTED'>('ALL');

  // Input states per delivery row: { [deliveryId]: { deliveredQty, emptyCollected, notes } }
  const [rowInputs, setRowInputs] = useState<Record<string, { deliveredQty: number; emptyCollected: number; notes: string }>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Quick Dispatch Modal
  const [isQuickDispatchOpen, setIsQuickDispatchOpen] = useState(false);
  const [customersList, setCustomersList] = useState<any[]>([]);
  const [dispatchCustomerId, setDispatchCustomerId] = useState('');
  const [dispatchDeliveredQty, setDispatchDeliveredQty] = useState(2);
  const [dispatchEmptyCollected, setDispatchEmptyCollected] = useState(0);
  const [dispatchNotes, setDispatchNotes] = useState('');
  const [dispatchRequireVerification, setDispatchRequireVerification] = useState(true);
  const [dispatchLoading, setDispatchLoading] = useState(false);

  // Load deliveries for the selected date
  const loadDailyDeliveries = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const res = await fetchWithAuth(`/delivery/daily?date=${selectedDate}`);
      if (res) {
        setDeliveries(res.deliveries || []);
        if (res.metrics) setMetrics(res.metrics);

        // Initialize row inputs for stepper controls
        const inputs: Record<string, { deliveredQty: number; emptyCollected: number; notes: string }> = {};
        (res.deliveries || []).forEach((d: DeliveryItem) => {
          inputs[d.id] = {
            deliveredQty: d.verification?.deliveredQty ?? d.report?.partnerDeliveredQty ?? d.requiredQuantity,
            emptyCollected: d.verification?.emptyCollected ?? d.report?.partnerEmptyCollected ?? 0,
            notes: d.verification?.staffNotes ?? '',
          };
        });
        setRowInputs(inputs);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load daily deliveries');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDailyDeliveries(true);
  }, [selectedDate]);

  // Load customer list for Quick Dispatch dropdown
  const loadCustomers = async () => {
    try {
      const data = await fetchWithAuth('/customer');
      setCustomersList(data || []);
      if (data && data.length > 0 && !dispatchCustomerId) {
        setDispatchCustomerId(data[0].id);
      }
    } catch {
      // silent
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  // Date Navigation Helpers
  const handleDateShift = (deltaDays: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + deltaDays);
    const newStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    setSelectedDate(newStr);
  };

  const handleSetToday = () => {
    const d = new Date();
    setSelectedDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  };

  // Stepper input change helper
  const handleInputChange = (id: string, field: 'deliveredQty' | 'emptyCollected' | 'notes', val: any) => {
    setRowInputs((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || { deliveredQty: 1, emptyCollected: 0, notes: '' }),
        [field]: val,
      },
    }));
  };

  // Staff Action 1: Deliver & Send Verification Request to Customer
  const handleRequestVerification = async (deliveryId: string) => {
    const input = rowInputs[deliveryId] || { deliveredQty: 1, emptyCollected: 0, notes: '' };
    try {
      setProcessingId(deliveryId);
      await fetchWithAuth(`/delivery/${deliveryId}/request-verification`, {
        method: 'POST',
        body: JSON.stringify({
          deliveredQty: input.deliveredQty,
          emptyCollected: input.emptyCollected,
          notes: input.notes,
          requireVerification: true,
        }),
      });

      toast.success('Marked delivered! Verification request sent to customer.');
      await loadDailyDeliveries(false);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to send verification request');
    } finally {
      setProcessingId(null);
    }
  };

  // Staff Action 2: Force Verify (Staff Override without Customer Confirmation)
  const handleForceVerify = async (deliveryId: string) => {
    const input = rowInputs[deliveryId] || { deliveredQty: 1, emptyCollected: 0, notes: '' };
    try {
      setProcessingId(deliveryId);
      await fetchWithAuth(`/delivery/${deliveryId}/force-verify`, {
        method: 'POST',
        body: JSON.stringify({
          deliveredQty: input.deliveredQty,
          emptyCollected: input.emptyCollected,
          notes: input.notes || 'Staff verified directly',
        }),
      });

      toast.success('Delivery confirmed and verified by staff override!');
      await loadDailyDeliveries(false);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to verify delivery');
    } finally {
      setProcessingId(null);
    }
  };

  // Quick Dispatch Form Submit
  const handleQuickDispatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispatchCustomerId) {
      toast.error('Please select a customer');
      return;
    }
    try {
      setDispatchLoading(true);
      await fetchWithAuth('/delivery/quick-dispatch', {
        method: 'POST',
        body: JSON.stringify({
          customerId: dispatchCustomerId,
          scheduledFor: selectedDate,
          deliveredQty: Number(dispatchDeliveredQty),
          emptyCollected: Number(dispatchEmptyCollected),
          notes: dispatchNotes,
          requireVerification: dispatchRequireVerification,
        }),
      });

      toast.success(
        dispatchRequireVerification
          ? 'Delivery dispatched! Verification request sent to customer.'
          : 'Delivery dispatched and marked completed!'
      );
      setIsQuickDispatchOpen(false);
      setDispatchNotes('');
      await loadDailyDeliveries(false);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to dispatch delivery');
    } finally {
      setDispatchLoading(false);
    }
  };

  // Filtered Deliveries
  const filteredDeliveries = useMemo(() => {
    return deliveries.filter((item) => {
      const term = search.toLowerCase().trim();
      const name = `${item.customer?.user?.firstName || ''} ${item.customer?.user?.lastName || ''}`.toLowerCase();
      const phone = (item.customer?.user?.phone || '').toLowerCase();
      const street = (item.address?.street || '').toLowerCase();

      const matchesSearch = !term || name.includes(term) || phone.includes(term) || street.includes(term);
      if (!matchesSearch) return false;

      const isDelivered = item.status === 'DELIVERED';
      const isPendingVerif = item.verification?.verificationStatus === 'PENDING_VERIFICATION' && !isDelivered;
      const isDisputed = item.verification?.verificationStatus === 'DISPUTED' || item.status === 'FAILED';
      const isPendingDispatch = !isDelivered && !isPendingVerif && !isDisputed;

      if (statusFilter === 'DELIVERED') return isDelivered;
      if (statusFilter === 'PENDING_VERIFICATION') return isPendingVerif;
      if (statusFilter === 'DISPUTED') return isDisputed;
      if (statusFilter === 'PENDING') return isPendingDispatch;

      return true;
    });
  }, [deliveries, search, statusFilter]);

  const isToday = useMemo(() => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return selectedDate === todayStr;
  }, [selectedDate]);

  return (
    <div className="space-y-4">
      {/* ─── 1. TOP CONTROL BAR ─────────────────────────────────────── */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Date Navigator */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200">
            <button
              onClick={() => handleDateShift(-1)}
              className="p-1.5 hover:bg-white rounded-lg text-slate-600 hover:text-slate-900 transition cursor-pointer"
              title="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1.5 px-2.5">
              <Calendar className="w-4 h-4 text-[#1677C8]" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-xs sm:text-sm font-bold text-slate-800 outline-none cursor-pointer"
              />
            </div>
            <button
              onClick={() => handleDateShift(1)}
              className="p-1.5 hover:bg-white rounded-lg text-slate-600 hover:text-slate-900 transition cursor-pointer"
              title="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {!isToday && (
            <button
              onClick={handleSetToday}
              className="px-2.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-[#1677C8] border border-sky-200 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Today
            </button>
          )}

          <button
            onClick={() => loadDailyDeliveries(true)}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            title="Refresh Deliveries"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Right: Quick Dispatch Action */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsQuickDispatchOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#1677C8] hover:bg-[#125ea0] text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Quick Dispatch Delivery</span>
          </button>
        </div>
      </div>

      {/* ─── 2. METRIC STATS ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Scheduled</span>
            <Truck className="w-4 h-4 text-slate-400" />
          </div>
          <span className="text-xl sm:text-2xl font-black text-slate-800 mt-1 block">
            {metrics.total}
          </span>
          <span className="text-[10px] text-slate-400 font-medium">Deliveries for {selectedDate}</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-amber-200/80 bg-amber-50/20 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Pending Verification</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <span className="text-xl sm:text-2xl font-black text-amber-600 mt-1 block">
            {metrics.pendingVerification}
          </span>
          <span className="text-[10px] text-amber-600/80 font-medium">Awaiting customer confirmation</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-emerald-200/80 bg-emerald-50/20 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Verified Delivered</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <span className="text-xl sm:text-2xl font-black text-emerald-600 mt-1 block">
            {metrics.delivered}
          </span>
          <span className="text-[10px] text-emerald-600/80 font-medium">Customer verified receipt</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Pending Dispatch</span>
            <Package className="w-4 h-4 text-sky-500" />
          </div>
          <span className="text-xl sm:text-2xl font-black text-slate-700 mt-1 block">
            {metrics.pendingDispatch}
          </span>
          <span className="text-[10px] text-slate-400 font-medium">Waiting to be marked delivered</span>
        </div>
      </div>

      {/* ─── 3. FILTERS & SEARCH ────────────────────────────────────── */}
      <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-2.5">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customer, phone, street..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:border-[#1677C8]"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {(
            [
              { key: 'ALL', label: 'All' },
              { key: 'PENDING_VERIFICATION', label: `Pending Verif (${metrics.pendingVerification})` },
              { key: 'DELIVERED', label: `Delivered (${metrics.delivered})` },
              { key: 'PENDING', label: `Pending Dispatch (${metrics.pendingDispatch})` },
              { key: 'DISPUTED', label: 'Disputed' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                statusFilter === tab.key
                  ? 'bg-[#1677C8] text-white shadow-2xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── 4. DELIVERIES LIST ─────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12">
            <EdropsPageLoader minHeight="min-h-[220px]" />
          </div>
        ) : filteredDeliveries.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
              <Truck className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No Deliveries Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              There are no deliveries matching your filter for {selectedDate}. Use "Quick Dispatch Delivery" above to schedule jars.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredDeliveries.map((item) => {
              const input = rowInputs[item.id] || {
                deliveredQty: item.requiredQuantity,
                emptyCollected: 0,
                notes: '',
              };
              const isDelivered = item.status === 'DELIVERED';
              const isPendingVerif = item.verification?.verificationStatus === 'PENDING_VERIFICATION' && !isDelivered;
              const isDisputed = item.verification?.verificationStatus === 'DISPUTED' || item.status === 'FAILED';
              const isProcessing = processingId === item.id;

              return (
                <div
                  key={item.id}
                  className={`p-4 transition-colors ${
                    isPendingVerif
                      ? 'bg-amber-50/30'
                      : isDelivered
                      ? 'bg-emerald-50/15'
                      : isDisputed
                      ? 'bg-rose-50/30'
                      : 'hover:bg-slate-50/60'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Customer & Location Details */}
                    <div className="min-w-0 flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-sky-100 text-[#1677C8] flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">
                        {item.customer.user.firstName?.charAt(0) || 'C'}
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-slate-800 truncate">
                            {item.customer.user.firstName} {item.customer.user.lastName}
                          </h4>
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                            {item.customer.customerType || 'RESIDENTIAL'}
                          </span>

                          {/* Verification Status Badge */}
                          {isDelivered ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Customer Verified (Delivered)
                            </span>
                          ) : isPendingVerif ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                              Awaiting Customer Verification
                            </span>
                          ) : isDisputed ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                              <AlertCircle className="w-3 h-3 text-rose-600" />
                              Customer Disputed Receipt
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                              Ready for Delivery
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                          <span className="flex items-center gap-1 font-mono">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {item.customer.user.phone}
                          </span>
                          {item.address && (
                            <span className="flex items-center gap-1 truncate max-w-xs sm:max-w-md">
                              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                              {item.address.street}, {item.address.city}
                            </span>
                          )}
                        </div>

                        {item.verification?.customerFeedback && (
                          <div className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-block mt-1">
                            Customer note: "{item.verification.customerFeedback}"
                          </div>
                        )}
                        {item.verification?.disputeReason && (
                          <div className="text-[11px] text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 inline-block mt-1">
                            Dispute note: "{item.verification.disputeReason}"
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Quantity Adjustment Controls & Action Buttons */}
                    <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 self-end lg:self-center shrink-0">
                      {/* Quantity Delivered Stepper */}
                      <div className="bg-slate-50 p-1.5 rounded-xl border border-slate-200 flex flex-col items-center">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Delivered</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <button
                            type="button"
                            onClick={() => handleInputChange(item.id, 'deliveredQty', Math.max(1, input.deliveredQty - 1))}
                            disabled={isDelivered}
                            className="w-5 h-5 rounded bg-white hover:bg-slate-200 border border-slate-200 flex items-center justify-center font-bold text-slate-700 cursor-pointer disabled:opacity-50"
                          >
                            -
                          </button>
                          <span className="font-extrabold text-sm text-[#1677C8] w-6 text-center">
                            {input.deliveredQty}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleInputChange(item.id, 'deliveredQty', Math.min(20, input.deliveredQty + 1))}
                            disabled={isDelivered}
                            className="w-5 h-5 rounded bg-white hover:bg-slate-200 border border-slate-200 flex items-center justify-center font-bold text-slate-700 cursor-pointer disabled:opacity-50"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Empties Collected Stepper */}
                      <div className="bg-slate-50 p-1.5 rounded-xl border border-slate-200 flex flex-col items-center">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Empties</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <button
                            type="button"
                            onClick={() => handleInputChange(item.id, 'emptyCollected', Math.max(0, input.emptyCollected - 1))}
                            disabled={isDelivered}
                            className="w-5 h-5 rounded bg-white hover:bg-slate-200 border border-slate-200 flex items-center justify-center font-bold text-slate-700 cursor-pointer disabled:opacity-50"
                          >
                            -
                          </button>
                          <span className="font-extrabold text-sm text-slate-700 w-6 text-center">
                            {input.emptyCollected}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleInputChange(item.id, 'emptyCollected', Math.min(20, input.emptyCollected + 1))}
                            disabled={isDelivered}
                            className="w-5 h-5 rounded bg-white hover:bg-slate-200 border border-slate-200 flex items-center justify-center font-bold text-slate-700 cursor-pointer disabled:opacity-50"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-1.5">
                        {!isDelivered ? (
                          <>
                            {/* Primary Action: Deliver & Send Verification */}
                            <button
                              type="button"
                              onClick={() => handleRequestVerification(item.id)}
                              disabled={isProcessing}
                              className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50 ${
                                isPendingVerif
                                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                                  : 'bg-[#1677C8] hover:bg-[#125ea0] text-white'
                              }`}
                              title="Mark jars delivered and prompt customer to verify"
                            >
                              {isProcessing ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Send className="w-3.5 h-3.5" />
                              )}
                              <span>
                                {isPendingVerif ? 'Resend Verification' : 'Deliver & Verify'}
                              </span>
                            </button>

                            {/* Secondary Action: Force Verify (Staff Override) */}
                            <button
                              type="button"
                              onClick={() => handleForceVerify(item.id)}
                              disabled={isProcessing}
                              className="px-2.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition cursor-pointer disabled:opacity-50"
                              title="Directly mark delivered without waiting for customer confirmation"
                            >
                              Force Verify
                            </button>
                          </>
                        ) : (
                          <div className="flex items-center gap-1 text-emerald-700 font-bold text-xs bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200">
                            <ShieldCheck className="w-4 h-4 text-emerald-600" />
                            <span>Completed</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── 5. QUICK DISPATCH MODAL ───────────────────────────────── */}
      {isQuickDispatchOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl p-5 sm:p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-800">Quick Dispatch Delivery</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Send on-demand jar delivery for today.
                </p>
              </div>
              <button
                onClick={() => setIsQuickDispatchOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleQuickDispatchSubmit} className="space-y-3.5">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Customer
                </label>
                <select
                  value={dispatchCustomerId}
                  onChange={(e) => setDispatchCustomerId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-[#1677C8]"
                  required
                >
                  <option value="" disabled>Select customer...</option>
                  {customersList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.user?.firstName} {c.user?.lastName} ({c.user?.phone || 'No Phone'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    Jars to Deliver
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={dispatchDeliveredQty}
                    onChange={(e) => setDispatchDeliveredQty(parseInt(e.target.value) || 1)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-[#1677C8]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    Empties to Collect
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    value={dispatchEmptyCollected}
                    onChange={(e) => setDispatchEmptyCollected(parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-[#1677C8]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Delivery Notes (Optional)
                </label>
                <input
                  type="text"
                  value={dispatchNotes}
                  onChange={(e) => setDispatchNotes(e.target.value)}
                  placeholder="e.g. Left with reception / security"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-[#1677C8]"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="requireVerif"
                  checked={dispatchRequireVerification}
                  onChange={(e) => setDispatchRequireVerification(e.target.checked)}
                  className="rounded text-[#1677C8] cursor-pointer"
                />
                <label htmlFor="requireVerif" className="text-xs text-slate-700 font-semibold cursor-pointer">
                  Send verification request to customer
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsQuickDispatchOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={dispatchLoading}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-[#1677C8] hover:bg-[#125ea0] text-white shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {dispatchLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>Dispatch & Deliver</span>
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
