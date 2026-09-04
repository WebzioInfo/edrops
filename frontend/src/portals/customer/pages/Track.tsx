import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Truck, 
  CheckCircle2, 
  Clock3, 
  AlertCircle, 
  XCircle, 
  CalendarDays, 
  ChevronDown, 
  ChevronUp, 
  FilterX
} from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';
import { useDialog } from '../../../hooks/useDialog';

interface Delivery {
  id: string;
  scheduledFor: string;
  status: 'PENDING' | 'ASSIGNED' | 'IN_TRANSIT' | 'DELIVERED' | 'SKIPPED' | 'FAILED' | 'CANCELLED';
  quantity: number;
  requiredQuantity: number;
  timeSlot?: string;
  notes: string | null;
}

interface GlobalStats {
  totalDeliveries: number;
  deliveredCount: number;
  missedCount: number;
  cancelledCount: number;
  scheduledCount: number;
  successRate: number;
}

interface WeekStats {
  scheduled: number;
  delivered: number;
  missed: number;
  cancelled: number;
  total: number;
  successRate: number;
}

interface WeekData {
  startDate: string;
  endDate: string;
  label: string;
  stats: WeekStats;
  deliveries: Delivery[];
}

export default function TrackPage({ customerId }: { isAdmin?: boolean; customerId?: string }) {
  const { confirm, toast } = useDialog();
  const [weeks, setWeeks] = useState<WeekData[]>([]);
  const [summary, setSummary] = useState<GlobalStats | null>(null);
  const [todayDelivery, setTodayDelivery] = useState<Delivery | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null);

  // Filters State
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth() + 1);
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  const loadData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedYear) params.append('year', selectedYear.toString());
      if (selectedMonth) params.append('month', selectedMonth.toString());
      if (selectedStatus !== 'ALL') params.append('status', selectedStatus);

      const url = customerId 
        ? `/delivery/customer/${customerId}/weekly-summary?${params.toString()}`
        : `/delivery/weekly-summary?${params.toString()}`;
        
      const data = await fetchWithAuth(url);
      if (data) {
        setWeeks(data.weeks || []);
        setSummary(data.summary || null);

        let foundToday: Delivery | null = null;
        const nowStr = new Date().toISOString().split('T')[0];
        for (const w of (data.weeks || [])) {
          for (const d of w.deliveries) {
            if (d.scheduledFor.startsWith(nowStr)) {
              foundToday = d;
              break;
            }
          }
          if (foundToday) break;
        }
        setTodayDelivery(foundToday);

        if (data.weeks && data.weeks.length > 0 && !expandedWeek) {
          setExpandedWeek(data.weeks[0].startDate);
        } else if (data.weeks && data.weeks.length === 0) {
          setExpandedWeek(null);
        }
      }
    } catch {
      setWeeks([]);
      setSummary(null);
      setTodayDelivery(null);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    loadData(true);
  }, [selectedYear, selectedMonth, selectedStatus]);

  const updateStatus = async (deliveryId: string, status: string) => {
    const isConfirmed = await confirm({
      title: 'Update Status',
      description: `Are you sure you want to change this delivery status to ${status}?`,
      confirmText: 'Update',
      cancelText: 'Cancel',
      variant: 'primary'
    });
    
    if (!isConfirmed) return;
    
    try {
      await fetchWithAuth(`/delivery/${deliveryId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      await loadData(false);
      toast.success('Status updated successfully');
    } catch (e: any) {
      console.error('Failed to update status', e);
      toast.error('Failed to update status. Please try again.');
    }
  };

  const getStatusIcon = (status: Delivery['status']) => {
    switch (status) {
      case 'DELIVERED':
        return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
      case 'PENDING':
      case 'ASSIGNED':
      case 'IN_TRANSIT':
        return <Clock3 className="h-4 w-4 text-[#2D79A8]" />;
      case 'SKIPPED':
      case 'CANCELLED':
        return <AlertCircle className="h-4 w-4 text-amber-600" />;
      case 'FAILED':
        return <XCircle className="h-4 w-4 text-rose-600" />;
      default:
        return <Clock3 className="h-4 w-4 text-slate-400" />;
    }
  };

  const formatShortDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  };

  return (
    <div className="mx-auto max-w-6xl px-3.5 py-4 sm:px-6 sm:py-6 space-y-3.5 sm:space-y-4">
      
      {/* ─── 1. COMPACT PAGE HEADER & INLINE FILTERS (~56–64px) ───── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white border border-[#E2E8F0] rounded-2xl p-3 sm:p-4 shadow-2xs">
        {/* Left: Title & Subtitle */}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-bold text-[#16324F] tracking-tight">
              Delivery History
            </h1>
            <span className="hidden sm:inline text-xs text-[#94A3B8]">/</span>
            <span className="hidden sm:inline text-xs font-semibold text-[#64748B]">Tracking Log</span>
          </div>
          <p className="text-xs text-[#64748B] font-medium mt-0.5">
            Track past deliveries and monitor your weekly hydration schedule
          </p>
        </div>

        {/* Right: Inline Filter Dropdowns */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Year Filter */}
          <div className="flex items-center gap-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-2.5 py-1">
            <span className="text-[10px] font-bold uppercase text-[#94A3B8]">Year</span>
            <select 
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
              className="bg-transparent text-xs font-bold text-[#16324F] focus:outline-none cursor-pointer"
            >
              {[currentDate.getFullYear() - 1, currentDate.getFullYear(), currentDate.getFullYear() + 1].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Month Filter */}
          <div className="flex items-center gap-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-2.5 py-1">
            <span className="text-[10px] font-bold uppercase text-[#94A3B8]">Month</span>
            <select 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
              className="bg-transparent text-xs font-bold text-[#16324F] focus:outline-none cursor-pointer"
            >
              {Array.from({length: 12}, (_, i) => i + 1).map(m => {
                const date = new Date(2000, m - 1, 1);
                return (
                  <option key={m} value={m}>
                    {date.toLocaleString('en-US', { month: 'short' })}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-2.5 py-1">
            <span className="text-[10px] font-bold uppercase text-[#94A3B8]">Status</span>
            <select 
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-transparent text-xs font-bold text-[#16324F] focus:outline-none cursor-pointer"
            >
              <option value="ALL">All</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="DELIVERED">Delivered</option>
              <option value="MISSED">Missed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* ─── 2. COMPACT 4-COLUMN STAT STRIP (72–80px Height) ──────── */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          {/* Stat 1: Total Deliveries */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-3 sm:p-3.5 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                TOTAL DELIVERIES
              </span>
              <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                Log
              </span>
            </div>
            <div className="mt-1">
              <span className="text-xl sm:text-2xl font-bold text-[#16324F] tracking-tight">
                {summary.totalDeliveries}
              </span>
            </div>
          </div>

          {/* Stat 2: Delivered */}
          <div className="bg-white border border-emerald-100 rounded-xl p-3 sm:p-3.5 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                DELIVERED
              </span>
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
                Fulfilled
              </span>
            </div>
            <div className="mt-1">
              <span className="text-xl sm:text-2xl font-bold text-emerald-600 tracking-tight">
                {summary.deliveredCount}
              </span>
            </div>
          </div>

          {/* Stat 3: Missed */}
          <div className="bg-white border border-rose-100 rounded-xl p-3 sm:p-3.5 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-rose-700">
                MISSED
              </span>
              <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded ${summary.missedCount > 0 ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-slate-100 text-slate-500'}`}>
                {summary.missedCount > 0 ? 'Action' : '0'}
              </span>
            </div>
            <div className="mt-1">
              <span className="text-xl sm:text-2xl font-bold text-rose-600 tracking-tight">
                {summary.missedCount}
              </span>
            </div>
          </div>

          {/* Stat 4: Success Rate */}
          <div className="bg-white border border-[#BBDFF2] rounded-xl p-3 sm:p-3.5 shadow-2xs flex flex-col justify-between relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#2D79A8]">
                SUCCESS RATE
              </span>
              <span className="text-[10px] font-semibold text-[#2D79A8] bg-[#BBDFF2]/30 px-1.5 py-0.2 rounded">
                Rate
              </span>
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-xl sm:text-2xl font-bold text-[#2D79A8] tracking-tight">
                {summary.successRate}%
              </span>
              <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden self-center">
                <div 
                  className="h-full bg-[#2D79A8] rounded-full transition-all duration-500" 
                  style={{ width: `${summary.successRate}%` }} 
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── 3. LOADING / EMPTY / CONTENT ─────────────────────────── */}
      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <div className="relative h-12 w-12 rounded-full water-gradient shadow-xl shadow-edrops-aqua/30">
            <div className="absolute inset-1.5 animate-ping rounded-full bg-white/40" />
          </div>
        </div>
      ) : weeks.length === 0 ? (
        /* Empty State */
        <div className="bg-white border border-dashed border-[#E2E8F0] rounded-2xl p-8 text-center flex flex-col items-center justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 text-slate-400 mb-3 border border-slate-200/80">
            <FilterX className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-[#16324F]">No Deliveries Found</h3>
          <p className="text-xs text-[#64748B] mt-1 max-w-sm leading-relaxed">
            No deliveries found for {selectedMonth}/{selectedYear} ({selectedStatus}). Adjust filters or visit Schedule to plan new deliveries.
          </p>
        </div>
      ) : (
        <div className="space-y-3 sm:space-y-3.5">
          
          {/* ─── 4. SLIM "TODAY'S DELIVERY" HIGHLIGHT ──────────────── */}
          {todayDelivery ? (
            <div className="bg-gradient-to-r from-[#245361] to-[#2D79A8] text-white rounded-2xl p-3.5 sm:p-4 shadow-2xs border border-[#245361] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-white shrink-0">
                  <Truck className="h-5 w-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-white/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white">
                      Today's Delivery
                    </span>
                    {todayDelivery.timeSlot && (
                      <span className="text-[10px] text-white/80 font-medium">
                        • {todayDelivery.timeSlot}
                      </span>
                    )}
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-white mt-0.5">
                    {todayDelivery.requiredQuantity} {todayDelivery.requiredQuantity === 1 ? 'Jar' : 'Jars'} — {formatShortDate(todayDelivery.scheduledFor)}
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className={`rounded-lg px-3 py-1 text-xs font-bold uppercase tracking-wider shadow-2xs ${
                  todayDelivery.status === 'DELIVERED' 
                    ? 'bg-emerald-400 text-slate-900' 
                    : ['FAILED', 'SKIPPED', 'CANCELLED'].includes(todayDelivery.status) 
                      ? 'bg-rose-400 text-slate-900' 
                      : 'bg-white text-[#245361]'
                }`}>
                  {todayDelivery.status}
                </span>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-[#E2E8F0] rounded-2xl px-4 py-3 flex items-center gap-3 shadow-2xs">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-400 shrink-0">
                <Truck className="h-4 w-4" />
              </div>
              <div className="text-xs">
                <span className="font-bold text-[#16324F]">No delivery scheduled for today.</span>
                <span className="text-[#64748B] ml-1.5">Check your upcoming weekly log below.</span>
              </div>
            </div>
          )}

          {/* ─── 5. WEEKLY BREAKDOWN ACCORDION LIST ─────────────────── */}
          <div className="space-y-2.5 sm:space-y-3">
            {weeks.map((week, index) => {
              const isExpanded = expandedWeek === week.startDate;
              const isCurrentWeek = new Date() >= new Date(week.startDate) && new Date() <= new Date(week.endDate);

              return (
                <motion.div 
                  key={week.startDate}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden shadow-2xs"
                >
                  {/* Week Summary Header Row */}
                  <div 
                    onClick={() => setExpandedWeek(isExpanded ? null : week.startDate)}
                    className={`p-3 sm:p-3.5 cursor-pointer transition flex items-center justify-between gap-3 select-none ${
                      isExpanded ? 'bg-[#F8FAFC] border-b border-[#E2E8F0]' : 'hover:bg-slate-50/70'
                    }`}
                  >
                    {/* Left: Calendar Icon + Week Label + Date Range */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ${
                        isCurrentWeek ? 'bg-[#1677C8] text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        <CalendarDays className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs sm:text-sm font-bold text-[#16324F] truncate">
                            {week.label}
                          </h3>
                          {isCurrentWeek && (
                            <span className="rounded-full bg-[#1677C8]/10 text-[#1677C8] px-2 py-0.2 text-[9px] font-bold uppercase tracking-wider">
                              Current Week
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#64748B] font-medium mt-0.5">
                          {formatShortDate(week.startDate)} <span className="text-slate-300 mx-1">→</span> {formatShortDate(week.endDate)}
                        </p>
                      </div>
                    </div>

                    {/* Right: Quick Stat Badges + Chevron */}
                    <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                      <div className="flex items-center gap-2 sm:gap-3 text-center text-xs">
                        <div className="hidden sm:block">
                          <span className="text-[10px] font-bold text-[#94A3B8] uppercase block">Scheduled</span>
                          <span className="font-bold text-[#16324F] text-xs">{week.stats.scheduled}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-emerald-600 uppercase block">Delivered</span>
                          <span className="font-bold text-emerald-600 text-xs">{week.stats.delivered}</span>
                        </div>
                        {week.stats.missed > 0 && (
                          <div>
                            <span className="text-[10px] font-bold text-rose-600 uppercase block">Missed</span>
                            <span className="font-bold text-rose-600 text-xs">{week.stats.missed}</span>
                          </div>
                        )}
                      </div>

                      <div className="w-6 h-6 flex items-center justify-center text-[#94A3B8]">
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </div>
                  </div>

                  {/* Daily Rows Accordion Body */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="divide-y divide-slate-100 bg-white"
                      >
                        {week.deliveries.length === 0 ? (
                          <div className="p-4 text-center text-xs text-[#94A3B8] italic">
                            No scheduled deliveries for this week.
                          </div>
                        ) : (
                          week.deliveries.map((delivery) => (
                            <div 
                              key={delivery.id} 
                              className="p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-slate-50/60 transition-colors"
                            >
                              {/* Left: Status Icon + Date & Details */}
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                                  {getStatusIcon(delivery.status)}
                                </span>
                                <div className="min-w-0">
                                  <h4 className="text-xs sm:text-sm font-bold text-[#16324F]">
                                    {new Date(delivery.scheduledFor).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}
                                  </h4>
                                  <p className="text-[11px] text-[#64748B] font-medium flex items-center gap-1.5 mt-0.5">
                                    <span>{new Date(delivery.scheduledFor).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })}</span>
                                    <span className="text-slate-300">•</span>
                                    <span className="font-bold text-[#16324F]">{delivery.requiredQuantity} {delivery.requiredQuantity === 1 ? 'Jar' : 'Jars'}</span>
                                    {delivery.timeSlot && (
                                      <>
                                        <span className="text-slate-300">•</span>
                                        <span>{delivery.timeSlot}</span>
                                      </>
                                    )}
                                  </p>
                                </div>
                              </div>
                              
                              {/* Right: Compact Segmented-Control Status Pills */}
                              <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200/60 shrink-0 self-start sm:self-auto">
                                {[
                                  { label: 'Pending', val: 'PENDING' },
                                  { label: 'Delivered', val: 'DELIVERED' },
                                  { label: 'Missed', val: 'FAILED' },
                                  { label: 'Cancelled', val: 'CANCELLED' }
                                ].map((statusOption) => {
                                  const isActive = delivery.status === statusOption.val || (statusOption.val === 'FAILED' && delivery.status === 'SKIPPED');
                                  return (
                                    <button
                                      key={statusOption.val}
                                      type="button"
                                      onClick={() => updateStatus(delivery.id, statusOption.val)}
                                      className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                                        isActive
                                          ? 'bg-white shadow-2xs text-[#1677C8] border border-slate-200/80'
                                          : 'text-[#64748B] hover:text-[#16324F] hover:bg-slate-200/50 border border-transparent'
                                      }`}
                                    >
                                      {statusOption.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
