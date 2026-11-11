import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CalendarDays, 
  Truck, 
  CheckCircle2, 
  AlertCircle, 
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
  RefreshCw,
  Loader2,
  Zap,
  ArrowRight,
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
  status: string;
  quantity: number;
  requiredQuantity: number;
  timeSlot?: string;
  notes: string | null;
  report?: {
    partnerDeliveredQty?: number;
    partnerEmptyCollected?: number;
    staffNotes?: string;
  };
  verification?: any;
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

function getLocalDateStr(dInput: string | Date): string {
  const d = new Date(dInput);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatWeekDateGap(startDateInput: string | Date, endDateInput: string | Date): string {
  const s = new Date(startDateInput);
  const e = new Date(endDateInput);

  const startDay = s.getDate();
  const endDay = e.getDate();
  const startMonth = s.toLocaleDateString('en-US', { month: 'short' });
  const endMonth = e.toLocaleDateString('en-US', { month: 'short' });
  const startYear = s.getFullYear();
  const endYear = e.getFullYear();

  if (startYear !== endYear) {
    return `${startDay} ${startMonth} ${startYear} – ${endDay} ${endMonth} ${endYear}`;
  }
  if (startMonth !== endMonth) {
    return `${startDay} ${startMonth} – ${endDay} ${endMonth} ${startYear}`;
  }
  return `${startDay} ${startMonth} – ${endDay} ${startMonth} ${startYear}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function DeliveriesPage({ customerId }: { isAdmin?: boolean; customerId?: string }) {
  const navigate = useNavigate();
  const { toast } = useDialog();

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
  const [viewTab, setViewTab] = useState<'UPCOMING' | 'HISTORY' | 'ALL'>('UPCOMING');
  const [apiPendingVerification, setApiPendingVerification] = useState<Delivery | null>(null);

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
        setWeeklyQtys({ ...qtys });
        setInitialQtys({ ...qtys });
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
        setApiPendingVerification(data.pendingVerification || null);

        let foundToday: Delivery | null = null;
        const nowStr = getLocalDateStr(new Date());
        for (const w of (data.weeks || [])) {
          for (const d of w.deliveries) {
            if (getLocalDateStr(d.scheduledFor) === nowStr) {
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

  // ── Auto-Save & Debounce References ──
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialMount = useRef(true);

  // ── Schedule Handlers ──
  const handleWeeklyQtyChange = (day: number, delta: number) => {
    setWeeklyQtys((prev) => ({
      ...prev,
      [day]: Math.max(0, Math.min(10, (prev[day] ?? 0) + delta)),
    }));
  };

  const isScheduleDirty = useMemo(() => {
    return Object.keys(weeklyQtys).some(
      (k) => weeklyQtys[Number(k)] !== initialQtys[Number(k)]
    );
  }, [weeklyQtys, initialQtys]);

  const persistSchedule = async (targetQtys: Record<number, number>, showToast = false) => {
    setSavingSchedule(true);

    const rules: ScheduleRule[] = [];
    Object.keys(targetQtys).forEach((dayKey) => {
      const day = parseInt(dayKey, 10);
      const qty = targetQtys[day] || 0;
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
          isActive: schedule ? schedule.isActive : true,
          rules,
        }),
      });
      if (updated) {
        setSchedule(updated);
      }
      setInitialQtys({ ...targetQtys });
      if (showToast) {
        toast.success('Delivery schedule saved successfully!');
      }
      // Refresh history to pick up newly planned deliveries
      loadHistory(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save schedule');
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleSaveSchedule = async () => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    await persistSchedule(weeklyQtys, true);
  };

  // ── Auto-Save Effect (Debounced 1s after last change) ──
  useEffect(() => {
    if (scheduleLoading) return;
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (!isScheduleDirty) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      persistSchedule(weeklyQtys, false);
    }, 1000);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [weeklyQtys, isScheduleDirty, scheduleLoading]);

  // ── Browser Refresh Protection (Warn if unsaved changes exist) ──
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isScheduleDirty || savingSchedule) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isScheduleDirty, savingSchedule]);

  const handleToggleScheduleActive = async () => {
    const nextActive = schedule ? !schedule.isActive : true;

    const rules: ScheduleRule[] = [];
    Object.keys(weeklyQtys).forEach((dayKey) => {
      const day = parseInt(dayKey, 10);
      const qty = weeklyQtys[day] || 0;
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
          isActive: nextActive,
          rules,
        }),
      });
      if (updated) {
        setSchedule(updated);
      }
      setInitialQtys({ ...weeklyQtys });
      toast.success(`Schedule ${nextActive ? 'activated' : 'paused'}`);
      loadHistory(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update schedule status');
    }
  };

  const getVerificationInfo = (delivery: Delivery): any => {
    if ((delivery as any).verification) return (delivery as any).verification;
    if (delivery.report?.staffNotes) {
      try {
        const parsed = JSON.parse(delivery.report.staffNotes);
        if (parsed && typeof parsed === 'object' && parsed.verificationStatus) {
          return parsed;
        }
      } catch {
        // not json
      }
    }
    return null;
  };

  const [verifyingDeliveryId, setVerifyingDeliveryId] = useState<string | null>(null);

  const handleCustomerVerify = async (deliveryId: string, verified: boolean, reason?: string) => {
    try {
      setVerifyingDeliveryId(deliveryId);
      await fetchWithAuth(`/delivery/${deliveryId}/customer-verify`, {
        method: 'POST',
        body: JSON.stringify({ verified, reason }),
      });

      if (verified) {
        toast.success('Thank you! Your water delivery has been confirmed and verified.');
      } else {
        toast.success('Your feedback was received. Staff will contact you shortly.');
      }

      await loadHistory(false);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to verify delivery');
    } finally {
      setVerifyingDeliveryId(null);
    }
  };

  // ── Date Helpers & Calculations ──
  const todayDayIndex = new Date().getDay();
  const tomorrowDayIndex = (todayDayIndex + 1) % 7;

  const todayStr = useMemo(() => getLocalDateStr(new Date()), []);

  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return getLocalDateStr(d);
  }, []);

  // ── Flattened & Sorted Deliveries ──
  const allDeliveries = useMemo(() => {
    const list: Delivery[] = [];
    weeks.forEach((w) => {
      (w.deliveries || []).forEach((d) => list.push(d));
    });
    return list.sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime());
  }, [weeks]);

  // ── Tomorrow's Delivery ──
  const tomorrowDelivery = useMemo(() => {
    return (
      allDeliveries.find(
        (d) => getLocalDateStr(d.scheduledFor) === tomorrowStr
      ) || null
    );
  }, [allDeliveries, tomorrowStr]);

  // ── Next Upcoming Delivery (Prioritize Today, then Tomorrow, then Next) ──
  const nextUpcomingDelivery = useMemo(() => {
    if (todayDelivery) return todayDelivery;
    return allDeliveries.find(
      (d) =>
        getLocalDateStr(d.scheduledFor) >= todayStr &&
        ['PENDING', 'ASSIGNED', 'IN_TRANSIT', 'CONFIRMED', 'PROCESSING', 'ORDER_PLACED', 'NEW', 'PENDING_ASSIGNMENT', 'OUT_FOR_DELIVERY'].includes(
          d.status.toUpperCase()
        )
    ) || null;
  }, [todayDelivery, allDeliveries, todayStr]);

  // ── Pending Customer Verification Delivery ──
  const pendingVerificationDelivery = useMemo(() => {
    if (apiPendingVerification && apiPendingVerification.status !== 'DELIVERED') {
      const v = getVerificationInfo(apiPendingVerification);
      if (v?.verificationStatus === 'PENDING_VERIFICATION') {
        return apiPendingVerification;
      }
    }
    return (
      allDeliveries.find((d) => {
        if (d.status === 'DELIVERED' || d.status === 'CANCELLED') return false;
        const v = getVerificationInfo(d);
        return v?.verificationStatus === 'PENDING_VERIFICATION';
      }) || null
    );
  }, [apiPendingVerification, allDeliveries]);

  // ── Delivery Counts (Upcoming vs Past History) ──
  const { upcomingCount, historyCount, totalCount } = useMemo(() => {
    let up = 0;
    let hist = 0;
    weeks.forEach((w) => {
      (w.deliveries || []).forEach((d) => {
        const dStr = getLocalDateStr(d.scheduledFor);
        const isUp = dStr >= todayStr;
        if (isUp) up++;
        else hist++;
      });
    });
    return { upcomingCount: up, historyCount: hist, totalCount: up + hist };
  }, [weeks, todayStr]);

  // ── Tab-Filtered Weeks ──
  const filteredWeeks = useMemo(() => {
    let list = weeks;
    if (viewTab !== 'ALL') {
      list = weeks
        .map((w) => {
          const filtered = (w.deliveries || []).filter((d) => {
            const dStr = getLocalDateStr(d.scheduledFor);
            const isDeliveredOrDone = ['DELIVERED', 'CANCELLED', 'FAILED'].includes(d.status.toUpperCase());
            if (viewTab === 'UPCOMING') {
              // Future deliveries for today and beyond are visible in Upcoming. Even if marked DELIVERED early, keep visible so week has no missing days.
              return dStr >= todayStr;
            } else {
              // History: past dates, or any completed/delivered delivery
              return dStr < todayStr || isDeliveredOrDone;
            }
          });
          return {
            ...w,
            deliveries: filtered,
          };
        })
        .filter((w) => w.deliveries.length > 0);
    }

    // Sort weeks & deliveries chronologically based on active tab
    return [...list]
      .sort((a, b) => {
        const timeA = new Date(a.startDate).getTime();
        const timeB = new Date(b.startDate).getTime();
        if (viewTab === 'HISTORY') {
          // Recent history on top
          return timeB - timeA;
        }
        // Upcoming & All: nearest/current week first (ascending)
        return timeA - timeB;
      })
      .map((w) => {
        const sortedDeliveries = [...w.deliveries].sort((a, b) => {
          const tA = new Date(a.scheduledFor).getTime();
          const tB = new Date(b.scheduledFor).getTime();
          return viewTab === 'HISTORY' ? tB - tA : tA - tB;
        });
        return {
          ...w,
          deliveries: sortedDeliveries,
        };
      });
  }, [weeks, viewTab, todayStr]);

  // Auto-expand the active week (prioritize current week, then top upcoming week)
  useEffect(() => {
    if (filteredWeeks.length > 0) {
      const currentWeekItem = filteredWeeks.find((w) => {
        const now = new Date();
        const start = new Date(w.startDate);
        const end = new Date(w.endDate);
        end.setHours(23, 59, 59, 999);
        return now >= start && now <= end;
      });
      const targetWeek = currentWeekItem ? currentWeekItem.startDate : filteredWeeks[0].startDate;
      if (!expandedWeek || !filteredWeeks.some((w) => w.startDate === expandedWeek)) {
        setExpandedWeek(targetWeek);
      }
    }
  }, [filteredWeeks, expandedWeek]);

  // When switching between Upcoming / History / All, auto-expand the top relevant week
  useEffect(() => {
    if (filteredWeeks.length > 0) {
      const currentWeekItem = filteredWeeks.find((w) => {
        const now = new Date();
        const start = new Date(w.startDate);
        const end = new Date(w.endDate);
        end.setHours(23, 59, 59, 999);
        return now >= start && now <= end;
      });
      setExpandedWeek(currentWeekItem ? currentWeekItem.startDate : filteredWeeks[0].startDate);
    }
  }, [viewTab]);

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

  const formatShortDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  if (scheduleLoading || (historyLoading && weeks.length === 0)) {
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

        {/* ─── 1.5. PENDING DELIVERY VERIFICATION BANNER ──────────────── */}
        {pendingVerificationDelivery && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-amber-500 via-amber-600 to-orange-500 text-white rounded-2xl p-4 sm:p-5 shadow-md border border-amber-300"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0 shadow-inner">
                  <Truck className="w-6 h-6 text-white animate-bounce" />
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/25 text-[11px] font-black uppercase tracking-wider">
                    <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                    <span>Delivery Verification Needed</span>
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-white mt-1">
                    Did you receive your water jars today?
                  </h3>
                  <p className="text-xs sm:text-sm text-amber-100 mt-0.5 leading-relaxed">
                    Staff marked{' '}
                    <strong className="text-white underline decoration-white/40">
                      {getVerificationInfo(pendingVerificationDelivery)?.deliveredQty || pendingVerificationDelivery.requiredQuantity} Jar(s)
                    </strong>{' '}
                    delivered to your location
                    {getVerificationInfo(pendingVerificationDelivery)?.emptyCollected !== undefined && (
                      <span> (and collected {getVerificationInfo(pendingVerificationDelivery).emptyCollected} empty jar(s))</span>
                    )}
                    . Please confirm receipt below.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
                <button
                  type="button"
                  onClick={() => {
                    const reason = window.prompt('Please describe the issue (e.g. jars not received, wrong quantity):');
                    if (reason) {
                      handleCustomerVerify(pendingVerificationDelivery.id, false, reason);
                    }
                  }}
                  disabled={verifyingDeliveryId === pendingVerificationDelivery.id}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white/20 hover:bg-white/30 text-white border border-white/40 transition cursor-pointer disabled:opacity-50"
                >
                  Report Issue
                </button>

                <button
                  type="button"
                  onClick={() => handleCustomerVerify(pendingVerificationDelivery.id, true)}
                  disabled={verifyingDeliveryId === pendingVerificationDelivery.id}
                  className="px-5 py-2 rounded-xl text-xs font-extrabold bg-white text-amber-900 hover:bg-amber-50 shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {verifyingDeliveryId === pendingVerificationDelivery.id ? (
                    <Loader2 className="w-4 h-4 animate-spin text-amber-900" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  )}
                  <span>Yes, Received & Verified</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}

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
                  const isToday = day.value === todayDayIndex;
                  const isTomorrow = day.value === tomorrowDayIndex;

                  const isTodayUnderwayOrDone = !!(
                    todayDelivery &&
                    ['OUT_FOR_DELIVERY', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'FAILED'].includes(todayDelivery.status)
                  );
                  const isPastTodayCutoff = new Date().getHours() >= 14;
                  const appliesNextWeek = isToday && (isTodayUnderwayOrDone || isPastTodayCutoff);

                  const isTomorrowLocked = !!(
                    tomorrowDelivery &&
                    ['OUT_FOR_DELIVERY', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED', 'ASSIGNED'].includes(
                      tomorrowDelivery.status.toUpperCase()
                    )
                  );
                  const tomorrowQtyDiffers = isTomorrow && isTomorrowLocked && tomorrowDelivery.requiredQuantity !== qty;

                  return (
                    <div 
                      key={day.value}
                      className={`px-4 py-2.5 sm:py-3 flex items-center justify-between gap-3 transition-colors ${
                        isTomorrow && isActive
                          ? 'bg-amber-50/50 border-l-4 border-l-amber-500'
                          : isToday && isActive
                          ? 'bg-blue-50/50 border-l-4 border-l-[#1E88E5]'
                          : isTomorrow
                          ? 'bg-amber-50/20 border-l-4 border-l-amber-300/80'
                          : isToday
                          ? 'bg-slate-50 border-l-4 border-l-slate-300'
                          : isActive
                          ? 'bg-[#F8FAFC]/60'
                          : 'bg-white hover:bg-slate-50/50'
                      }`}
                    >
                      {/* Left: Day & Status subtext */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs sm:text-sm font-bold ${
                            isTomorrow ? 'text-amber-950 font-extrabold' : isToday ? 'text-[#0F172A]' : isActive ? 'text-[#0F172A]' : 'text-[#64748B]'
                          }`}>
                            {day.label}
                          </span>
                          {isTomorrow && !tomorrowQtyDiffers && (
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
                              Tomorrow
                            </span>
                          )}
                          {isTomorrow && tomorrowQtyDiffers && (
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
                              Tomorrow Locked ({tomorrowDelivery.requiredQuantity} Jars) • Applies next {day.label}
                            </span>
                          )}
                          {isToday && (
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                              Today
                            </span>
                          )}
                          {appliesNextWeek && isActive && (
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-300">
                              Applies next {day.label}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-medium mt-0.5">
                          {isActive ? (
                            isTomorrow ? (
                              tomorrowQtyDiffers ? (
                                <span className="text-amber-800 font-semibold flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block animate-pulse" />
                                  Tomorrow locked: {tomorrowDelivery.requiredQuantity} {tomorrowDelivery.requiredQuantity === 1 ? 'Jar' : 'Jars'} ({formatDeliveryStatus(tomorrowDelivery.status)}) • Next week: {qty} Jars
                                </span>
                              ) : (
                                <span className="text-amber-800 font-bold flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block animate-pulse" />
                                  {qty} {qty === 1 ? 'Jar' : 'Jars'} scheduled (Arriving Tomorrow)
                                </span>
                              )
                            ) : isToday ? (
                              appliesNextWeek ? (
                                todayDelivery ? (
                                  <span className="text-slate-700 font-semibold flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                                    Today: {todayDelivery.requiredQuantity} {todayDelivery.requiredQuantity === 1 ? 'Jar' : 'Jars'} ({formatDeliveryStatus(todayDelivery.status)}) • Next week: {qty} Jars
                                  </span>
                                ) : (
                                  <span className="text-amber-800 font-semibold flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
                                    Today's cutoff passed • {qty} {qty === 1 ? 'Jar' : 'Jars'} scheduled from next {day.label}
                                  </span>
                                )
                              ) : (
                                <span className="text-blue-800 font-bold flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#1E88E5] inline-block" />
                                  {qty} {qty === 1 ? 'Jar' : 'Jars'} scheduled (Today)
                                </span>
                              )
                            ) : (
                              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                                {qty} {qty === 1 ? 'Jar' : 'Jars'} scheduled
                              </span>
                            )
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
                            disabled={scheduleLoading || qty === 0}
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
                            disabled={scheduleLoading || qty >= 10}
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
                <div className="text-xs">
                  {savingSchedule ? (
                    <span className="text-blue-700 font-semibold flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      Saving schedule...
                    </span>
                  ) : isScheduleDirty ? (
                    <span className="text-amber-700 font-semibold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                      Unsaved changes (auto-saving...)
                    </span>
                  ) : weeklyTotal > 0 ? (
                    <span className="text-emerald-700 font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      All changes saved
                    </span>
                  ) : (
                    <span className="text-slate-400 font-medium">
                      No deliveries scheduled
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleSaveSchedule}
                  disabled={savingSchedule || !isScheduleDirty}
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
            
            {/* TODAY'S / NEXT UPCOMING DELIVERY BANNER CARD */}
            {todayDelivery ? (
              <div className="bg-gradient-to-r from-[#16324F] to-[#2D79A8] text-white rounded-2xl p-4 shadow-xs border border-[#16324F]">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                      <Truck className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-emerald-400/30 border border-emerald-300/40 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-100">
                          Today's Delivery
                        </span>
                        {todayDelivery.timeSlot && (
                          <span className="text-[11px] text-white/80 font-medium">
                            • {todayDelivery.timeSlot}
                          </span>
                        )}
                      </div>
                      <h3 className="text-base sm:text-lg font-bold text-white mt-1">
                        {todayDelivery.requiredQuantity} {todayDelivery.requiredQuantity === 1 ? 'Jar' : 'Jars'} — Today ({formatShortDate(todayDelivery.scheduledFor)})
                      </h3>
                    </div>
                  </div>

                  <span className="rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider bg-white text-[#16324F] shadow-2xs shrink-0">
                    {formatDeliveryStatus(todayDelivery.status)}
                  </span>
                </div>
              </div>
            ) : nextUpcomingDelivery ? (
              <div className="bg-gradient-to-r from-[#1E3A8A] via-[#1E40AF] to-[#0284C7] text-white rounded-2xl p-4 shadow-sm border border-blue-400/30">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0 shadow-inner">
                      <Sparkles className="w-5 h-5 text-amber-300" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${
                          getLocalDateStr(nextUpcomingDelivery.scheduledFor) === tomorrowStr
                            ? 'bg-amber-400 text-amber-950 shadow-xs'
                            : 'bg-white/20 text-white'
                        }`}>
                          {getLocalDateStr(nextUpcomingDelivery.scheduledFor) === tomorrowStr ? 'Tomorrow' : 'Next Upcoming'}
                        </span>
                        <span className="text-[11px] text-blue-100 font-semibold">
                          {new Date(nextUpcomingDelivery.scheduledFor).toLocaleDateString('en-IN', { weekday: 'long', month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      <h3 className="text-base sm:text-lg font-bold text-white mt-1 flex items-center gap-2">
                        <span>{nextUpcomingDelivery.requiredQuantity} {nextUpcomingDelivery.requiredQuantity === 1 ? 'Jar' : 'Jars'} Scheduled</span>
                        {getLocalDateStr(nextUpcomingDelivery.scheduledFor) === tomorrowStr && (
                          <span className="text-xs font-semibold text-amber-200 hidden sm:inline">(Arriving Tomorrow)</span>
                        )}
                      </h3>
                    </div>
                  </div>
                  <span className="rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider bg-white/90 text-[#1E3A8A] shadow-xs shrink-0">
                    {formatDeliveryStatus(nextUpcomingDelivery.status)}
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
                      No upcoming deliveries scheduled
                    </h3>
                    <p className="text-[11px] text-[#64748B]">
                      {nextScheduledDayText ? `Next up: ${nextScheduledDayText}` : 'Set quantities on the weekly schedule to get started.'}
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50 px-2 py-1 rounded-md border border-slate-200/60 hidden sm:inline">
                  No Active Orders
                </span>
              </div>
            )}

            {/* URGENT / INSTANT DELIVERY ACTION CARD */}
            <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-amber-500/10 border border-amber-300 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white flex items-center justify-center shrink-0 shadow-xs shadow-orange-500/30">
                  <Zap className="w-5 h-5 fill-white" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-xs sm:text-sm font-extrabold text-amber-950">
                      Need Water Urgently Today?
                    </h4>
                    <span className="bg-amber-100 text-amber-900 text-[9px] font-black uppercase px-2 py-0.5 rounded-full border border-amber-300">
                      Instant Drop
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-900/80 mt-0.5 leading-relaxed">
                    Weekly schedule changes apply to upcoming cycles. Order on-demand jars for immediate priority dispatch.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate('/customer/shop')}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white shadow-sm shadow-orange-500/20 shrink-0 transition-all cursor-pointer active:scale-95"
              >
                <span>Order Instant Jars</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* DELIVERY HISTORY & TRACKING LOG CARD */}
            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xs overflow-hidden">
              
              {/* Card Header, View Tabs & Inline Filters */}
              <div className="px-4 py-3 border-b border-[#E2E8F0] bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-sm sm:text-base font-bold text-[#0F172A]">
                    Deliveries & Log
                  </h2>

                  {/* View Filter Tabs: Upcoming / History / All */}
                  <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setViewTab('UPCOMING')}
                      className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                        viewTab === 'UPCOMING'
                          ? 'bg-white text-[#1E88E5] font-bold shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span>Upcoming</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                        viewTab === 'UPCOMING' ? 'bg-blue-100 text-[#1E88E5]' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {upcomingCount}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewTab('HISTORY')}
                      className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                        viewTab === 'HISTORY'
                          ? 'bg-white text-[#1E88E5] font-bold shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span>History</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                        viewTab === 'HISTORY' ? 'bg-blue-100 text-[#1E88E5]' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {historyCount}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewTab('ALL')}
                      className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                        viewTab === 'ALL'
                          ? 'bg-white text-[#1E88E5] font-bold shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span>All</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                        viewTab === 'ALL' ? 'bg-blue-100 text-[#1E88E5]' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {totalCount}
                      </span>
                    </button>
                  </div>
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
              ) : filteredWeeks.length === 0 ? (
                <div className="p-8 text-center flex flex-col items-center justify-center">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center mb-2 border border-slate-200/80">
                    <FilterX className="w-5 h-5" />
                  </div>
                  <h4 className="text-xs sm:text-sm font-bold text-[#0F172A]">
                    {viewTab === 'UPCOMING'
                      ? 'No upcoming deliveries found'
                      : viewTab === 'HISTORY'
                      ? 'No past delivery history found'
                      : 'No deliveries found'}
                  </h4>
                  <p className="text-[11px] text-[#64748B] mt-0.5 max-w-xs leading-relaxed">
                    {viewTab === 'UPCOMING'
                      ? 'Set jar quantities on your weekly delivery schedule to generate upcoming deliveries.'
                      : 'Completed or missed orders for this period will appear here.'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[#E2E8F0] max-h-[440px] overflow-y-auto">
                  {filteredWeeks.map((week) => {
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
                              {formatWeekDateGap(week.startDate, week.endDate)}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">
                              ({week.label})
                            </span>
                            {isCurrentWeek && (
                              <span className="rounded bg-blue-50 text-[#1E88E5] border border-blue-200/60 px-1.5 py-0.2 text-[9px] font-bold uppercase">
                                Current
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] text-slate-700 font-bold bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                              {week.deliveries.length} {week.deliveries.length === 1 ? 'day' : 'days'}
                            </span>
                            {week.stats.delivered > 0 && (
                              <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                {week.stats.delivered} Delivered
                              </span>
                            )}
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
                              {isCurrentWeek && viewTab === 'UPCOMING' && week.stats.delivered > 0 && (
                                <div className="px-4 py-2 bg-slate-50/80 text-[11px] text-slate-600 flex items-center justify-between border-b border-slate-100">
                                  <span className="flex items-center gap-1.5 font-medium">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                                    {week.stats.delivered} {week.stats.delivered === 1 ? 'delivery' : 'deliveries'} completed earlier this week
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setViewTab('HISTORY');
                                    }}
                                    className="text-[#1E88E5] font-bold hover:underline cursor-pointer"
                                  >
                                    View in History →
                                  </button>
                                </div>
                              )}
                              {week.deliveries.length === 0 ? (
                                <div className="px-4 py-3 text-center text-xs text-[#94A3B8] italic">
                                  No deliveries found for this view.
                                </div>
                              ) : (
                                week.deliveries.map((delivery) => {
                                  const badge = getStatusBadgeStyle(delivery.status);
                                  const delDate = new Date(delivery.scheduledFor);
                                  const delDateStr = getLocalDateStr(delivery.scheduledFor);
                                  const isDelToday = delDateStr === todayStr;
                                  const isDelTomorrow = delDateStr === tomorrowStr;
                                  const isNextUpcoming = nextUpcomingDelivery?.id === delivery.id;
                                  const isDelTomorrowLocked =
                                    isDelTomorrow &&
                                    ['OUT_FOR_DELIVERY', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED', 'ASSIGNED'].includes(
                                      delivery.status.toUpperCase()
                                    );
                                  const tomorrowScheduleDiffers =
                                    isDelTomorrowLocked && weeklyQtys[tomorrowDayIndex] !== delivery.requiredQuantity;

                                  return (
                                    <div 
                                      key={delivery.id}
                                      className={`px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-colors ${
                                        isDelTomorrow
                                          ? 'bg-amber-50/40 border-l-4 border-l-amber-500'
                                          : isDelToday
                                          ? 'bg-emerald-50/40 border-l-4 border-l-emerald-500'
                                          : isNextUpcoming
                                          ? 'bg-blue-50/30 border-l-4 border-l-[#1E88E5]'
                                          : 'hover:bg-slate-50/60'
                                      }`}
                                    >
                                      {/* Left: Icon, Date, Day, Quantity */}
                                      <div className="flex items-center gap-2.5 min-w-0">
                                        <div className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${
                                          isDelTomorrow
                                            ? 'bg-amber-100 border-amber-300 text-amber-800'
                                            : isDelToday
                                            ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                                            : 'bg-[#F8FAFC] border-[#E2E8F0]'
                                        }`}>
                                          <Droplets className={`w-3.5 h-3.5 ${
                                            isDelTomorrow
                                              ? 'text-amber-700'
                                              : isDelToday
                                              ? 'text-emerald-700'
                                              : 'text-[#1E88E5]'
                                          }`} />
                                        </div>
                                        <div className="min-w-0">
                                          <div className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5 flex-wrap">
                                            <span>
                                              {delDate.toLocaleDateString('en-US', {
                                                day: 'numeric',
                                                month: 'short',
                                                weekday: 'short',
                                              })}
                                            </span>

                                            {isDelTomorrow && (
                                              <span className="rounded-full bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.2 text-[9px] font-black uppercase tracking-wider shadow-2xs">
                                                Tomorrow
                                              </span>
                                            )}
                                            {isDelToday && (
                                              <span className="rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 px-2 py-0.2 text-[9px] font-black uppercase tracking-wider shadow-2xs">
                                                Today
                                              </span>
                                            )}
                                            {isNextUpcoming && !isDelToday && !isDelTomorrow && (
                                              <span className="rounded-full bg-blue-100 text-[#1E88E5] border border-blue-200 px-2 py-0.2 text-[9px] font-bold uppercase tracking-wider">
                                                Next Up
                                              </span>
                                            )}

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
                                          {tomorrowScheduleDiffers && (
                                            <div className="text-[10px] text-amber-800 font-medium mt-0.5 flex items-center gap-1 bg-amber-50/60 rounded px-1.5 py-0.5 border border-amber-200/50">
                                              <span>🚚 Dispatched ({delivery.requiredQuantity} Jars). New schedule ({weeklyQtys[tomorrowDayIndex]} Jars) begins next week.</span>
                                            </div>
                                          )}
                                        </div>
                                      </div>

                                      {/* Right: Clean Read-Only Status Pill */}
                                      <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-auto">
                                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-md border ${badge.bg} ${badge.text} ${badge.border}`}>
                                          {formatDeliveryStatus(delivery.status)}
                                        </span>
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
