import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CalendarDays, 
  Truck, 
  CheckCircle2, 
  Clock3, 
  AlertCircle, 
  XCircle, 
  Minus, 
  Plus, 
  Save, 
  Power, 
  Droplets, 
  Calendar, 
  Sparkles, 
  ChevronDown, 
  ChevronUp, 
  FilterX, 
  RefreshCw 
} from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';
import { useDialog } from '../../../hooks/useDialog';
import { useRegisterRefreshHandler } from '../../../components/pwa/PullToRefresh';
import LoadingSpinner from '../../../components/LoadingSpinner';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ScheduleRule {
  id?: string;
  type: 'WEEKLY';
  dayOfWeek?: number;
  quantity?: number;
}

interface Schedule {
  id: string;
  isActive: boolean;
  rules: ScheduleRule[];
}

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

const DAYS_OF_WEEK = [
  { label: 'Sunday', short: 'Sun', value: 0 },
  { label: 'Monday', short: 'Mon', value: 1 },
  { label: 'Tuesday', short: 'Tue', value: 2 },
  { label: 'Wednesday', short: 'Wed', value: 3 },
  { label: 'Thursday', short: 'Thu', value: 4 },
  { label: 'Friday', short: 'Fri', value: 5 },
  { label: 'Saturday', short: 'Sat', value: 6 },
];

function formatDeliveryStatus(status: string): string {
  switch (status?.toUpperCase()) {
    case 'PENDING':
    case 'ORDER_PLACED':
      return 'Order Placed';
    case 'ASSIGNED':
      return 'Assigned';
    case 'CONFIRMED':
      return 'Confirmed';
    case 'PROCESSING':
      return 'Processing';
    case 'OUT_FOR_DELIVERY':
    case 'IN_TRANSIT':
      return 'Out for Delivery';
    case 'DELIVERED':
      return 'Delivered';
    case 'SKIPPED':
      return 'Skipped';
    case 'FAILED':
      return 'Missed';
    case 'CANCELLED':
      return 'Cancelled';
    default:
      return status ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase().replace(/_/g, ' ') : 'Pending';
  }
}

function getStatusBadgeStyle(status: string): { bg: string; text: string; border: string } {
  switch (status?.toUpperCase()) {
    case 'DELIVERED':
      return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
    case 'IN_TRANSIT':
    case 'OUT_FOR_DELIVERY':
      return { bg: 'bg-blue-50', text: 'text-[#1E88E5]', border: 'border-blue-200' };
    case 'ASSIGNED':
    case 'CONFIRMED':
    case 'PROCESSING':
      return { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' };
    case 'PENDING':
    case 'ORDER_PLACED':
      return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' };
    case 'FAILED':
    case 'CANCELLED':
      return { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' };
    case 'SKIPPED':
      return { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' };
    default:
      return { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function DeliveriesPage({ customerId }: { isAdmin?: boolean; customerId?: string }) {
  const { confirm, toast } = useDialog();

  // ── Schedule State ──
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [weeklyQtys, setWeeklyQtys] = useState<Record<number, number>>({
    0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0,
  });
  const [initialQtys, setInitialQtys] = useState<Record<number, number>>({
    0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0,
  });
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleLoading, setScheduleLoading] = useState(true);

  // ── Delivery History State ──
  const [weeks, setWeeks] = useState<WeekData[]>([]);
  const [summary, setSummary] = useState<GlobalStats | null>(null);
  const [todayDelivery, setTodayDelivery] = useState<Delivery | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null);

  // ── History Filters State ──
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth() + 1);
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // ── Load Schedule Data ──
  const loadSchedule = async () => {
    try {
      const data = await fetchWithAuth('/schedule');
      if (data) {
        setSchedule(data);
        const rules: ScheduleRule[] = data.rules || [];
        const qtys: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
        rules.forEach((r) => {
          if (r.type === 'WEEKLY' && r.dayOfWeek !== undefined && r.dayOfWeek !== null) {
            qtys[r.dayOfWeek] = r.quantity || 0;
          }
        });
        setWeeklyQtys(qtys);
        setInitialQtys(qtys);
      }
    } catch {
      toast.error('Failed to load delivery schedule');
    } finally {
      setScheduleLoading(false);
    }
  };

  // ── Load Delivery History Data ──
  const loadHistory = async (showLoading = true) => {
    if (showLoading) setHistoryLoading(true);
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
      if (showLoading) setHistoryLoading(false);
    }
  };

  useRegisterRefreshHandler(async () => {
    await Promise.all([loadSchedule(), loadHistory(false)]);
  });

  useEffect(() => {
    loadSchedule();
  }, []);

  useEffect(() => {
    loadHistory(true);
  }, [selectedYear, selectedMonth, selectedStatus]);

  // ── Schedule Handlers ──
  const handleWeeklyQtyChange = (day: number, delta: number) => {
    setWeeklyQtys((prev) => ({
      ...prev,
      [day]: Math.max(0, Math.min(10, prev[day] + delta)),
    }));
  };

  const isScheduleDirty = useMemo(() => {
    return Object.keys(weeklyQtys).some(
      (k) => weeklyQtys[Number(k)] !== initialQtys[Number(k)]
    );
  }, [weeklyQtys, initialQtys]);

  const handleSaveSchedule = async () => {
    if (!schedule) return;
    setSavingSchedule(true);

    const rules: ScheduleRule[] = [];
    Object.keys(weeklyQtys).forEach((dayKey) => {
      const day = parseInt(dayKey, 10);
      const qty = weeklyQtys[day];
      if (qty > 0) {
        rules.push({
          type: 'WEEKLY',
          dayOfWeek: day,
          quantity: qty,
        });
      }
    });

    try {
      const updated = await fetchWithAuth('/schedule', {
        method: 'POST',
        body: JSON.stringify({
          isActive: schedule.isActive,
          rules,
        }),
      });
      setSchedule(updated);
      setInitialQtys(weeklyQtys);
      toast.success('Delivery schedule saved successfully!');
      // Refresh history to pick up newly planned deliveries
      loadHistory(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save schedule');
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleToggleScheduleActive = async () => {
    if (!schedule) return;
    const nextActive = !schedule.isActive;

    try {
      const updated = await fetchWithAuth('/schedule', {
        method: 'POST',
        body: JSON.stringify({
          isActive: nextActive,
          rules: schedule.rules,
        }),
      });
      setSchedule(updated);
      toast.success(`Schedule ${nextActive ? 'activated' : 'paused'}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update schedule status');
    }
  };

  const updateDeliveryStatus = async (deliveryId: string, status: string) => {
    const isConfirmed = await confirm({
      title: 'Update Status',
      description: `Are you sure you want to change this delivery status to ${formatDeliveryStatus(status)}?`,
      confirmText: 'Update',
      cancelText: 'Cancel',
      variant: 'primary',
    });

    if (!isConfirmed) return;

    try {
      await fetchWithAuth(`/delivery/${deliveryId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await loadHistory(false);
      toast.success('Status updated successfully');
    } catch (e: any) {
      console.error('Failed to update status', e);
      toast.error('Failed to update status. Please try again.');
    }
  };

  // ── Calculations ──
  const weeklyTotal = useMemo(() => {
    return Object.values(weeklyQtys).reduce((a, b) => a + b, 0);
  }, [weeklyQtys]);

  const monthlyEstimate = weeklyTotal * 4;
  const activeDays = useMemo(() => {
    return Object.values(weeklyQtys).filter((qty) => qty > 0).length;
  }, [weeklyQtys]);

  // Next delivery date from active weekly schedule
  const nextScheduledDayText = useMemo(() => {
    const todayDay = new Date().getDay();
    for (let offset = 1; offset <= 7; offset++) {
      const checkDay = (todayDay + offset) % 7;
      if (weeklyQtys[checkDay] > 0) {
        const dObj = DAYS_OF_WEEK.find((d) => d.value === checkDay);
        return `${dObj?.label || ''} (${weeklyQtys[checkDay]} jars)`;
      }
    }
    return null;
  }, [weeklyQtys]);

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
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  };

  if (scheduleLoading && historyLoading) {
    return <LoadingSpinner fullPage label="Loading delivery workspace..." />;
  }

  return (
    <div className="min-h-[calc(100vh-72px)] bg-[#F8FAFC] pb-20 lg:pb-12 text-[#0F172A]">
      <div className="mx-auto max-w-[1360px] px-3.5 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4">
        
        {/* ─── 1. HEADER (Title, Subtitle, Schedule Active Toggle) ───── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-5 shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#1E88E5]/10 flex items-center justify-center text-[#1E88E5]">
                <Truck className="w-4 h-4" />
              </div>
              <h1 className="text-lg sm:text-2xl font-bold text-[#0F172A] tracking-tight">
                Delivery Management
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-[#64748B] mt-1">
              Manage your weekly water schedule and track deliveries.
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {schedule && (
              <button
                type="button"
                onClick={handleToggleScheduleActive}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold border shadow-2xs transition-colors cursor-pointer ${
                  schedule.isActive
                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-700 hover:bg-emerald-100/70'
                    : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                }`}
                title={schedule.isActive ? 'Pause recurring deliveries' : 'Activate recurring deliveries'}
              >
                <Power className={`w-3.5 h-3.5 ${schedule.isActive ? 'text-emerald-600' : 'text-amber-600'}`} />
                <span>{schedule.isActive ? 'Schedule Active' : 'Schedule Paused'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                loadSchedule();
                loadHistory(true);
              }}
              className="p-2 rounded-xl border border-[#E2E8F0] bg-white text-[#64748B] hover:text-[#0F172A] hover:bg-slate-50 transition-colors cursor-pointer"
              title="Refresh data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ─── 2. TOP SUMMARY ROW (Compact Metric Strip) ─────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
          {/* Card 1: Weekly Total */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-3 sm:p-3.5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                Weekly Total
              </span>
              <div className="w-6 h-6 rounded-md bg-blue-50 text-[#1E88E5] flex items-center justify-center">
                <Droplets className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-bold text-[#0F172A] tracking-tight">
                {weeklyTotal}
              </span>
              <span className="text-xs font-semibold text-[#64748B]">Jars / wk</span>
            </div>
          </div>

          {/* Card 2: Monthly Estimate */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-3 sm:p-3.5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                Monthly Estimate
              </span>
              <div className="w-6 h-6 rounded-md bg-indigo-50 text-indigo-500 flex items-center justify-center">
                <Calendar className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-bold text-[#0F172A] tracking-tight">
                {monthlyEstimate}
              </span>
              <span className="text-xs font-semibold text-[#64748B]">Jars / mo</span>
            </div>
          </div>

          {/* Card 3: Active Days */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-3 sm:p-3.5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                Active Days
              </span>
              <div className="w-6 h-6 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-bold text-[#0F172A] tracking-tight">
                {activeDays}
              </span>
              <span className="text-xs font-semibold text-[#64748B]">/ 7 Days Active</span>
            </div>
          </div>

          {/* Card 4: Delivery Success */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-3 sm:p-3.5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                Delivery Success
              </span>
              <div className="w-6 h-6 rounded-md bg-cyan-50 text-[#0E7490] flex items-center justify-center">
                <Truck className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-1 flex items-center justify-between gap-2">
              <span className="text-xl sm:text-2xl font-bold text-[#0F172A] tracking-tight">
                {summary ? `${summary.successRate}%` : '100%'}
              </span>
              <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden self-center">
                <div 
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500" 
                  style={{ width: `${summary ? summary.successRate : 100}%` }} 
                />
              </div>
            </div>
          </div>
        </div>

        {/* ─── 3. MAIN CONTENT AREA (Responsive Two-Column Layout) ──── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          
          {/* ═════════════════════════════════════════════════════════════
              LEFT / PRIMARY COLUMN: Weekly Delivery Schedule (Cols 1–6)
             ═════════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-6 space-y-3.5">
            
            {/* WEEKLY SCHEDULE CARD */}
            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xs overflow-hidden">
              {/* Card Header */}
              <div className="px-4 py-3 border-b border-[#E2E8F0] bg-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-[#1E88E5]" />
                  <h2 className="text-sm sm:text-base font-bold text-[#0F172A]">
                    Weekly Delivery Schedule
                  </h2>
                </div>
                {activeDays > 0 ? (
                  <span className="text-[11px] font-bold text-[#1E88E5] bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                    {activeDays} Days Set
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md">
                    No Days Set
                  </span>
                )}
              </div>

              {/* 7 Days Compact List */}
              <div className="divide-y divide-[#F1F5F9]">
                {DAYS_OF_WEEK.map((day) => {
                  const qty = weeklyQtys[day.value];
                  const isActive = qty > 0;

                  return (
                    <div 
                      key={day.value}
                      className={`px-4 py-2.5 sm:py-3 flex items-center justify-between gap-3 transition-colors ${
                        isActive ? 'bg-[#F8FAFC]/60' : 'bg-white hover:bg-slate-50/50'
                      }`}
                    >
                      {/* Left: Day & Status subtext */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs sm:text-sm font-bold ${isActive ? 'text-[#0F172A]' : 'text-[#64748B]'}`}>
                            {day.label}
                          </span>
                        </div>
                        <div className="text-[11px] font-medium mt-0.5">
                          {isActive ? (
                            <span className="text-emerald-700 font-semibold flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                              {qty} {qty === 1 ? 'Jar' : 'Jars'} scheduled
                            </span>
                          ) : (
                            <span className="text-[#94A3B8]">No Delivery</span>
                          )}
                        </div>
                      </div>

                      {/* Right: Stepper Controls */}
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-bold text-[#0F172A] w-12 text-right hidden sm:inline">
                          {qty > 0 ? `${qty} ${qty === 1 ? 'Jar' : 'Jars'}` : '0'}
                        </span>

                        <div className="flex items-center bg-white border border-[#E2E8F0] rounded-xl shadow-2xs p-0.5">
                          <button
                            type="button"
                            onClick={() => handleWeeklyQtyChange(day.value, -1)}
                            disabled={qty === 0}
                            aria-label={`Decrease jars for ${day.label}`}
                            className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A] disabled:opacity-30 disabled:hover:bg-transparent active:bg-slate-100 transition-colors cursor-pointer"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>

                          <span className="w-7 sm:w-8 text-center font-bold text-xs sm:text-sm text-[#0F172A]">
                            {qty}
                          </span>

                          <button
                            type="button"
                            onClick={() => handleWeeklyQtyChange(day.value, 1)}
                            disabled={qty >= 10}
                            aria-label={`Increase jars for ${day.label}`}
                            className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A] disabled:opacity-30 disabled:hover:bg-transparent active:bg-slate-100 transition-colors cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Card Footer: Save Schedule & Status Indicator */}
              <div className="px-4 py-3 bg-[#F8FAFC] border-t border-[#E2E8F0] flex items-center justify-between gap-3">
                <div className="text-xs text-[#64748B]">
                  {isScheduleDirty ? (
                    <span className="text-amber-700 font-semibold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                      Unsaved changes
                    </span>
                  ) : (
                    <span className="text-[#64748B] flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      All changes saved
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleSaveSchedule}
                  disabled={savingSchedule || (!isScheduleDirty && weeklyTotal > 0)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1E88E5] hover:bg-[#1976D2] active:bg-[#1565C0] text-white text-xs sm:text-sm font-semibold shadow-xs disabled:opacity-50 disabled:hover:bg-[#1E88E5] transition-colors cursor-pointer"
                >
                  {savingSchedule ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Schedule</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* SMART INSIGHT CALLOUT */}
            {weeklyTotal > 0 ? (
              <div className="bg-[#1E88E5]/5 border border-[#1E88E5]/20 rounded-2xl p-3.5 sm:p-4 flex gap-3">
                <Sparkles className="w-4 h-4 text-[#1E88E5] shrink-0 mt-0.5" />
                <div className="text-xs text-[#334155] leading-relaxed">
                  <span className="font-bold text-[#0F172A] block mb-0.5">Hydration Schedule Active</span>
                  You are set to receive <strong className="text-[#1E88E5]">{weeklyTotal} jars</strong> every week across {activeDays} active delivery {activeDays === 1 ? 'day' : 'days'}. Orders are generated automatically.
                </div>
              </div>
            ) : (
              <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-3.5 sm:p-4 flex gap-3">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900 leading-relaxed">
                  <span className="font-bold block mb-0.5">No Weekly Deliveries Configured</span>
                  Use the stepper buttons above to schedule jars on your preferred days of the week, then click <strong>Save Schedule</strong>.
                </div>
              </div>
            )}

          </div>

          {/* ═════════════════════════════════════════════════════════════
              RIGHT / SECONDARY COLUMN: Today's Delivery & History (Cols 7–12)
             ═════════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-6 space-y-3.5">
            
            {/* TODAY'S / CURRENT DELIVERY CARD */}
            {todayDelivery ? (
              <div className="bg-gradient-to-r from-[#16324F] to-[#2D79A8] text-white rounded-2xl p-4 shadow-xs border border-[#16324F]">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                      <Truck className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-white/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                          Today's Delivery
                        </span>
                        {todayDelivery.timeSlot && (
                          <span className="text-[11px] text-white/80 font-medium">
                            • {todayDelivery.timeSlot}
                          </span>
                        )}
                      </div>
                      <h3 className="text-base sm:text-lg font-bold text-white mt-1">
                        {todayDelivery.requiredQuantity} {todayDelivery.requiredQuantity === 1 ? 'Jar' : 'Jars'} — {formatShortDate(todayDelivery.scheduledFor)}
                      </h3>
                    </div>
                  </div>

                  <span className="rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider bg-white text-[#16324F] shadow-2xs shrink-0">
                    {formatDeliveryStatus(todayDelivery.status)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-[#E2E8F0] rounded-2xl p-3.5 sm:p-4 flex items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                    <Truck className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-[#0F172A]">
                      No delivery scheduled for today
                    </h3>
                    <p className="text-[11px] text-[#64748B]">
                      {nextScheduledDayText ? `Next up: ${nextScheduledDayText}` : 'Set quantities on the weekly schedule to get started.'}
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50 px-2 py-1 rounded-md border border-slate-200/60 hidden sm:inline">
                  Inactive Today
                </span>
              </div>
            )}

            {/* DELIVERY HISTORY & TRACKING LOG CARD */}
            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xs overflow-hidden">
              
              {/* Card Header & Inline Filters */}
              <div className="px-4 py-3 border-b border-[#E2E8F0] bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-[#0F172A] flex items-center gap-1.5">
                    <span>Delivery History & Log</span>
                  </h2>
                </div>

                {/* Inline Compact Filters */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* Year */}
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                    aria-label="Filter deliveries by year"
                    className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-2 py-1 text-[11px] font-bold text-[#0F172A] focus:outline-none cursor-pointer"
                  >
                    {[currentDate.getFullYear() - 1, currentDate.getFullYear(), currentDate.getFullYear() + 1].map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>

                  {/* Month */}
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
                    aria-label="Filter deliveries by month"
                    className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-2 py-1 text-[11px] font-bold text-[#0F172A] focus:outline-none cursor-pointer"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                      const date = new Date(2000, m - 1, 1);
                      return (
                        <option key={m} value={m}>
                          {date.toLocaleString('en-US', { month: 'short' })}
                        </option>
                      );
                    })}
                  </select>

                  {/* Status */}
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    aria-label="Filter deliveries by status"
                    className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-2 py-1 text-[11px] font-bold text-[#0F172A] focus:outline-none cursor-pointer"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="SCHEDULED">Scheduled</option>
                    <option value="DELIVERED">Delivered</option>
                    <option value="MISSED">Missed</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>
              </div>

              {/* Stats Bar */}
              {summary && (
                <div className="px-4 py-2 bg-[#F8FAFC] border-b border-[#E2E8F0] flex items-center justify-between text-[11px] font-semibold text-[#64748B] flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <span>Total: <strong className="text-[#0F172A]">{summary.totalDeliveries}</strong></span>
                    <span>•</span>
                    <span className="text-emerald-700">Delivered: <strong>{summary.deliveredCount}</strong></span>
                    <span>•</span>
                    <span className="text-rose-600">Missed: <strong>{summary.missedCount}</strong></span>
                  </div>
                  <span className="text-[#1E88E5]">Success: <strong>{summary.successRate}%</strong></span>
                </div>
              )}

              {/* Log List / Accordion */}
              {historyLoading ? (
                <div className="p-8 text-center">
                  <div className="w-5 h-5 border-2 border-[#1E88E5]/30 border-t-[#1E88E5] rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-xs text-[#64748B]">Loading delivery log...</p>
                </div>
              ) : weeks.length === 0 ? (
                <div className="p-8 text-center flex flex-col items-center justify-center">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center mb-2 border border-slate-200/80">
                    <FilterX className="w-5 h-5" />
                  </div>
                  <h4 className="text-xs sm:text-sm font-bold text-[#0F172A]">No deliveries found</h4>
                  <p className="text-[11px] text-[#64748B] mt-0.5 max-w-xs leading-relaxed">
                    No records found for this period. Try adjusting filters or schedule new deliveries.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[#E2E8F0] max-h-[440px] overflow-y-auto">
                  {weeks.map((week) => {
                    const isExpanded = expandedWeek === week.startDate;
                    const isCurrentWeek = new Date() >= new Date(week.startDate) && new Date() <= new Date(week.endDate);

                    return (
                      <div key={week.startDate} className="bg-white">
                        {/* Week Header */}
                        <div 
                          onClick={() => setExpandedWeek(isExpanded ? null : week.startDate)}
                          className={`px-4 py-2.5 flex items-center justify-between gap-3 cursor-pointer select-none transition-colors ${
                            isExpanded ? 'bg-[#F8FAFC]' : 'hover:bg-slate-50/70'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <CalendarDays className={`w-3.5 h-3.5 shrink-0 ${isCurrentWeek ? 'text-[#1E88E5]' : 'text-slate-400'}`} />
                            <span className="text-xs font-bold text-[#0F172A] truncate">
                              {week.label}
                            </span>
                            {isCurrentWeek && (
                              <span className="rounded bg-blue-50 text-[#1E88E5] border border-blue-200/60 px-1.5 py-0.2 text-[9px] font-bold uppercase">
                                Current
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2.5 shrink-0">
                            <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">
                              {week.stats.delivered} / {week.stats.total}
                            </span>
                            <div className="w-4 h-4 text-slate-400 flex items-center justify-center">
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </div>
                          </div>
                        </div>

                        {/* Deliveries inside Week */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="divide-y divide-slate-100 bg-white"
                            >
                              {week.deliveries.length === 0 ? (
                                <div className="px-4 py-3 text-center text-xs text-[#94A3B8] italic">
                                  No scheduled deliveries in this week.
                                </div>
                              ) : (
                                week.deliveries.map((delivery) => {
                                  const badge = getStatusBadgeStyle(delivery.status);

                                  return (
                                    <div 
                                      key={delivery.id}
                                      className="px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50/60 transition-colors"
                                    >
                                      {/* Left: Icon, Date, Day, Quantity */}
                                      <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="w-7 h-7 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center shrink-0">
                                          {getStatusIcon(delivery.status)}
                                        </div>
                                        <div className="min-w-0">
                                          <div className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5">
                                            <span>
                                              {new Date(delivery.scheduledFor).toLocaleDateString('en-US', {
                                                day: 'numeric',
                                                month: 'short',
                                                weekday: 'short',
                                                timeZone: 'UTC',
                                              })}
                                            </span>
                                            <span className="text-slate-300">•</span>
                                            <span className="text-[#1E88E5]">
                                              {delivery.requiredQuantity} {delivery.requiredQuantity === 1 ? 'Jar' : 'Jars'}
                                            </span>
                                          </div>
                                          {delivery.timeSlot && (
                                            <div className="text-[10px] text-[#64748B] mt-0.5">
                                              {delivery.timeSlot}
                                            </div>
                                          )}
                                        </div>
                                      </div>

                                      {/* Right: Status Pill */}
                                      <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-auto">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${badge.bg} ${badge.text} ${badge.border}`}>
                                          {formatDeliveryStatus(delivery.status)}
                                        </span>

                                        {/* Status Update Quick Control for customer testing/updating */}
                                        <select
                                          value={delivery.status}
                                          onChange={(e) => updateDeliveryStatus(delivery.id, e.target.value)}
                                          aria-label="Change status"
                                          className="text-[10px] font-bold text-[#64748B] bg-slate-100 hover:bg-slate-200 border border-slate-200/80 rounded px-1 py-0.5 cursor-pointer focus:outline-none"
                                        >
                                          <option value="PENDING">Pending</option>
                                          <option value="DELIVERED">Delivered</option>
                                          <option value="FAILED">Missed</option>
                                          <option value="CANCELLED">Cancelled</option>
                                        </select>
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
