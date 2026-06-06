import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Truck, CheckCircle2, Clock3, AlertCircle, XCircle, CalendarDays, ChevronDown, ChevronUp, FilterX } from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';

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
    if (!window.confirm(`Are you sure you want to change this delivery status to ${status}?`)) {
      return;
    }
    try {
      await fetchWithAuth(`/delivery/${deliveryId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      await loadData(false);
    } catch (e) {
      console.error('Failed to update status', e);
      alert('Failed to update status. Please try again.');
    }
  };

  const getStatusIcon = (status: Delivery['status']) => {
    switch (status) {
      case 'DELIVERED':
        return <CheckCircle2 className="h-5 w-5 text-emerald-600" />;
      case 'PENDING':
      case 'ASSIGNED':
      case 'IN_TRANSIT':
        return <Clock3 className="h-5 w-5 text-[#2D79A8]" />;
      case 'SKIPPED':
      case 'CANCELLED':
        return <AlertCircle className="h-5 w-5 text-amber-600" />;
      case 'FAILED':
        return <XCircle className="h-5 w-5 text-rose-600" />;
      default:
        return <Clock3 className="h-5 w-5 text-slate-400" />;
    }
  };



  const formatShortDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8 space-y-8">
      
      {/* Header & Filters */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-semibold text-[#245361]">Delivery History</h1>
          <p className="text-sm font-semibold text-[#245361]/80 mt-1">Track your past deliveries and weekly hydration schedule</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-[#245361]/70 ml-1">Year</label>
            <select 
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
              className="rounded-xl border border-border bg-white px-4 py-2 text-sm font-bold text-[#245361] shadow-sm focus:border-[#2D79A8] focus:ring-1 focus:ring-[#2D79A8]"
            >
              {[currentDate.getFullYear() - 1, currentDate.getFullYear(), currentDate.getFullYear() + 1].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-[#245361]/70 ml-1">Month</label>
            <select 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
              className="rounded-xl border border-border bg-white px-4 py-2 text-sm font-bold text-[#245361] shadow-sm focus:border-[#2D79A8] focus:ring-1 focus:ring-[#2D79A8]"
            >
              {Array.from({length: 12}, (_, i) => i + 1).map(m => {
                const date = new Date(2000, m - 1, 1);
                return <option key={m} value={m}>{date.toLocaleString('en-US', { month: 'long' })}</option>;
              })}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-[#245361]/70 ml-1">Status</label>
            <select 
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="rounded-xl border border-border bg-white px-4 py-2 text-sm font-bold text-[#245361] shadow-sm focus:border-[#2D79A8] focus:ring-1 focus:ring-[#2D79A8]"
            >
              <option value="ALL">All Status</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="DELIVERED">Delivered</option>
              <option value="MISSED">Missed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Global Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="enterprise-card p-5 border border-border bg-white flex flex-col justify-center">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Total Deliveries</p>
            <h2 className="text-3xl font-semibold text-[#245361] mt-1">{summary.totalDeliveries}</h2>
          </div>
          <div className="enterprise-card p-5 border border-emerald-100 bg-emerald-50/50 flex flex-col justify-center">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-600/70">Delivered</p>
            <h2 className="text-3xl font-semibold text-emerald-600 mt-1">{summary.deliveredCount}</h2>
          </div>
          <div className="enterprise-card p-5 border border-rose-100 bg-rose-50/50 flex flex-col justify-center">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-rose-600/70">Missed</p>
            <h2 className="text-3xl font-semibold text-rose-600 mt-1">{summary.missedCount}</h2>
          </div>
          <div className="enterprise-card p-5 border border-[#BBDFF2] bg-[#BBDFF2]/10 flex flex-col justify-center relative overflow-hidden">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#2D79A8]/70">Success Rate</p>
            <h2 className="text-3xl font-semibold text-[#2D79A8] mt-1">{summary.successRate}%</h2>
            <div className="absolute right-0 bottom-0 top-0 w-2 bg-[#2D79A8]/10">
              <div 
                className="absolute bottom-0 w-full bg-[#2D79A8]" 
                style={{ height: `${summary.successRate}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="relative h-16 w-16 rounded-full water-gradient shadow-2xl shadow-edrops-aqua/30">
            <div className="absolute inset-2 animate-ping rounded-full bg-white/40" />
          </div>
        </div>
      ) : weeks.length === 0 ? (
        /* Empty State */
        <div className="enterprise-card p-12 border border-border border-dashed text-center flex flex-col items-center justify-center bg-slate-50/50">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-4 shadow-sm">
            <FilterX className="h-8 w-8" />
          </div>
          <h3 className="text-xl font-semibold text-[#245361]">No Deliveries Found</h3>
          <p className="text-sm font-medium text-slate-500 mt-2 max-w-sm">
            We couldn't find any deliveries matching your selected filters ({selectedMonth}/{selectedYear} - {selectedStatus}). Try adjusting the filters or visit the Planner to schedule deliveries.
          </p>
        </div>
      ) : (
        /* Content Body */
        <div className="space-y-8">
          
          {/* Today's Delivery Card */}
          {todayDelivery ? (
            <div className="enterprise-card overflow-hidden bg-gradient-to-br from-[#2D79A8] to-[#245361] text-white">
              <div className="p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-5">
                  <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-white/10 shadow-inner shrink-0">
                    <Truck className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <span className="rounded-full bg-white/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-white shadow-sm mb-2 inline-block">
                      Today's Delivery
                    </span>
                    <h3 className="text-2xl font-semibold text-white">
                      {todayDelivery.requiredQuantity} {todayDelivery.requiredQuantity === 1 ? 'Jar' : 'Jars'}
                    </h3>
                    <p className="text-sm font-semibold text-white/80 mt-1">
                      {formatShortDate(todayDelivery.scheduledFor)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col items-start md:items-end gap-2">
                  <span className={`rounded-xl px-4 py-2 text-sm font-semibold uppercase tracking-widest shadow-sm ${
                    todayDelivery.status === 'DELIVERED' ? 'bg-emerald-500 text-white' :
                    ['FAILED', 'SKIPPED', 'CANCELLED'].includes(todayDelivery.status) ? 'bg-rose-500 text-white' :
                    'bg-white text-[#2D79A8]'
                  }`}>
                    Status: {todayDelivery.status}
                  </span>
                  {todayDelivery.timeSlot && (
                    <p className="text-xs font-bold text-white/70 tracking-widest uppercase">
                      Est: {todayDelivery.timeSlot}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="enterprise-card overflow-hidden bg-slate-50 border border-border/60">
              <div className="p-6 flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-200 text-slate-400 shadow-inner shrink-0">
                  <Truck className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-600">No delivery scheduled today</h3>
                  <p className="text-sm font-semibold text-slate-400 mt-0.5">Check your upcoming weekly schedule below</p>
                </div>
              </div>
            </div>
          )}

          {/* Weekly Accordion List */}
          <div className="space-y-6">
          {weeks.map((week, index) => {
            const isExpanded = expandedWeek === week.startDate;

            return (
              <motion.div 
                key={week.startDate}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="enterprise-card overflow-hidden"
              >
                {/* Week Header / Summary Card */}
                <div 
                  onClick={() => setExpandedWeek(isExpanded ? null : week.startDate)}
                  className={`p-5 cursor-pointer transition flex flex-col md:flex-row md:items-center justify-between gap-4 ${isExpanded ? 'bg-[#BBDFF2]/10 border-b border-[#BBDFF2]/30' : 'hover:bg-slate-50'}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#2D79A8] text-white shadow-sm shrink-0">
                      <CalendarDays className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold text-[#245361]">{week.label}</h3>
                        {new Date() >= new Date(week.startDate) && new Date() <= new Date(week.endDate) && (
                          <span className="rounded-full bg-[#BBDFF2] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-[#2D79A8]">
                            Current Week
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                        {formatShortDate(week.startDate)} <span className="text-slate-300 mx-1">→</span> {formatShortDate(week.endDate)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 justify-between md:justify-end w-full md:w-auto mt-2 md:mt-0">
                    <div className="flex gap-4 md:gap-6 text-center">
                      <div>
                        <p className="text-[10px] font-semibold uppercase text-slate-400 tracking-widest">Scheduled</p>
                        <p className="text-base font-semibold text-slate-700">{week.stats.scheduled}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase text-slate-400 tracking-widest">Delivered</p>
                        <p className="text-base font-semibold text-emerald-600">{week.stats.delivered}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase text-slate-400 tracking-widest">Missed</p>
                        <p className="text-base font-semibold text-rose-600">{week.stats.missed}</p>
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
                  </div>
                </div>

                {/* Delivery Rows Accordion Body */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="bg-white/50"
                    >
                      <div className="p-0 divide-y divide-border/60">
                        {week.deliveries.length === 0 ? (
                          <div className="p-6 text-center text-sm font-semibold text-slate-500">
                            No matching deliveries for this week.
                          </div>
                        ) : (
                          week.deliveries.map((delivery) => (
                            <div key={delivery.id} className="p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4 hover:bg-white transition">
                              <div className="flex items-center gap-4">
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-background border border-border shadow-sm">
                                  {getStatusIcon(delivery.status)}
                                </span>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h4 className="text-base font-semibold text-[#245361]">
                                      {new Date(delivery.scheduledFor).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}
                                    </h4>
                                  </div>
                                  <p className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-wider flex items-center gap-1.5">
                                    <Truck className="h-3.5 w-3.5" />
                                    {new Date(delivery.scheduledFor).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })}
                                    <span className="text-slate-300 mx-1">•</span>
                                    {delivery.requiredQuantity} {delivery.requiredQuantity === 1 ? 'Jar' : 'Jars'}
                                  </p>
                                </div>
                              </div>
                              
                              <div className="flex bg-slate-100/80 p-1 rounded-xl w-full xl:w-auto mt-3 xl:mt-0">
                                  {[{label: 'Pending', val: 'PENDING'}, {label: 'Delivered', val: 'DELIVERED'}, {label: 'Missed', val: 'FAILED'}, {label: 'Cancelled', val: 'CANCELLED'}].map((statusOption) => {
                                    const isActive = delivery.status === statusOption.val || (statusOption.val === 'FAILED' && delivery.status === 'SKIPPED');
                                    return (
                                      <button
                                        key={statusOption.val}
                                        onClick={() => updateStatus(delivery.id, statusOption.val)}
                                        className={`px-3 py-2 text-[10px] sm:text-xs font-semibold uppercase tracking-wider rounded-lg transition-all flex-1 xl:flex-none text-center ${
                                          isActive
                                            ? 'bg-white shadow-sm text-[#2D79A8] border border-slate-200/60'
                                            : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 border border-transparent'
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
                      </div>
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
