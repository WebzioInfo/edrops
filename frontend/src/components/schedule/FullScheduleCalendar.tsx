import { useState, useMemo, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Droplets,
  Sparkles,
  Minus,
  Plus,
  Power,
  Save,
  Sliders,
  CalendarDays,
  ListFilter,
} from 'lucide-react';
import { toast } from 'react-hot-toast';

export interface ScheduleRule {
  id?: string;
  type: 'WEEKLY' | 'INTERVAL' | 'CUSTOM';
  dayOfWeek?: number;
  quantity?: number;
  intervalDays?: number;
  startDate?: string | Date;
  customNotes?: string;
}

export interface Schedule {
  id: string;
  isActive: boolean;
  rules: ScheduleRule[];
}

interface FullScheduleCalendarProps {
  schedule: Schedule | null;
  onSaveSchedule: (rules: ScheduleRule[], isActive: boolean) => Promise<void>;
  saving?: boolean;
}

// Preset definitions for easy one-click selection
interface CadencePreset {
  id: string;
  label: string;
  jars: number;
  gapDays: number; // 1-day gap means interval of 2 days
  description: string;
  badge?: string;
}

const CADENCE_PRESETS: CadencePreset[] = [
  {
    id: '1-jar-1-gap',
    label: '1 Jar • 1-Day Gap',
    jars: 1,
    gapDays: 1,
    description: '1 jar every alternate day (Every 2 days)',
    badge: 'Popular',
  },
  {
    id: '2-jar-2-gap',
    label: '2 Jars • 2-Day Gap',
    jars: 2,
    gapDays: 2,
    description: '2 jars every 3 days (2 rest days between deliveries)',
    badge: 'Families',
  },
  {
    id: '1-jar-2-gap',
    label: '1 Jar • 2-Day Gap',
    jars: 1,
    gapDays: 2,
    description: '1 jar every 3 days (Light consumption)',
  },
  {
    id: '2-jar-1-gap',
    label: '2 Jars • 1-Day Gap',
    jars: 2,
    gapDays: 1,
    description: '2 jars every alternate day (Heavy consumption)',
  },
  {
    id: '1-jar-daily',
    label: '1 Jar • Daily',
    jars: 1,
    gapDays: 0,
    description: '1 jar delivered every single day',
  },
];

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const FULL_WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export default function FullScheduleCalendar({
  schedule,
  onSaveSchedule,
  saving = false,
}: FullScheduleCalendarProps) {
  // Calendar viewing month/year state
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth()); // 0-indexed

  // View mode: 'CALENDAR' | 'WEEKLY'
  const [viewMode, setViewMode] = useState<'CALENDAR' | 'WEEKLY'>('CALENDAR');

  // Selected preset state
  const [activePresetId, setActivePresetId] = useState<string>('1-jar-1-gap');

  // Custom Interval settings
  const [showCustomInterval, setShowCustomInterval] = useState(false);
  const [customJars, setCustomJars] = useState(1);
  const [customGapDays, setCustomGapDays] = useState(1);

  // Interval Rule state
  const [intervalRule, setIntervalRule] = useState<{
    enabled: boolean;
    jars: number;
    gapDays: number;
    startDate: Date;
  }>({
    enabled: true,
    jars: 1,
    gapDays: 1,
    startDate: today,
  });

  // Per-date custom overrides: key is YYYY-MM-DD -> quantity
  const [dateOverrides, setDateOverrides] = useState<Record<string, number>>({});

  // Weekly fallback quantities: dayOfWeek (0-6) -> quantity
  const [weeklyQtys, setWeeklyQtys] = useState<Record<number, number>>({
    0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0,
  });

  const [isActive, setIsActive] = useState(true);
  const [isDirty, setIsDirty] = useState(false);

  // Parse incoming schedule
  useEffect(() => {
    if (schedule) {
      setIsActive(schedule.isActive ?? true);
      const rules = schedule.rules || [];

      // Check if there is an INTERVAL rule
      const intRule = rules.find((r) => r.type === 'INTERVAL');
      if (intRule) {
        const interval = intRule.intervalDays || 2;
        const gap = Math.max(0, interval - 1);
        const jars = intRule.quantity || 1;
        const sDate = intRule.startDate ? new Date(intRule.startDate) : today;
        sDate.setHours(0, 0, 0, 0);

        setIntervalRule({
          enabled: true,
          jars,
          gapDays: gap,
          startDate: sDate,
        });

        // Find matching preset if any
        const match = CADENCE_PRESETS.find(
          (p) => p.jars === jars && p.gapDays === gap
        );
        if (match) {
          setActivePresetId(match.id);
        } else {
          setActivePresetId('custom');
          setCustomJars(jars);
          setCustomGapDays(gap);
          setShowCustomInterval(true);
        }
      } else {
        // Parse WEEKLY rules
        const qtys: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
        rules.forEach((r) => {
          if (r.type === 'WEEKLY' && r.dayOfWeek !== undefined && r.dayOfWeek !== null) {
            qtys[r.dayOfWeek] = r.quantity || 0;
          }
        });
        setWeeklyQtys(qtys);
        setIntervalRule((prev) => ({ ...prev, enabled: false }));
        setActivePresetId('');
      }
      setIsDirty(false);
    }
  }, [schedule, today]);

  // Apply a Cadence Preset
  const handleApplyPreset = (preset: CadencePreset) => {
    setActivePresetId(preset.id);
    setShowCustomInterval(false);
    setIntervalRule({
      enabled: true,
      jars: preset.jars,
      gapDays: preset.gapDays,
      startDate: today,
    });
    // Clear manual overrides to let preset pattern shine
    setDateOverrides({});
    setIsDirty(true);
    toast.success(`Applied ${preset.label}`);
  };

  // Apply Custom Interval
  const handleApplyCustomInterval = () => {
    setActivePresetId('custom');
    setIntervalRule({
      enabled: true,
      jars: customJars,
      gapDays: customGapDays,
      startDate: today,
    });
    setDateOverrides({});
    setIsDirty(true);
    toast.success(`Applied ${customJars} Jar(s) with ${customGapDays}-Day Gap`);
  };

  // Month navigation
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleGoToday = () => {
    setCurrentMonth(today.getMonth());
    setCurrentYear(today.getFullYear());
  };

  // Helper to compute jar quantity on any target date
  const getQtyForDate = (date: Date): number => {
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    
    // Check manual override first
    if (dateOverrides[key] !== undefined) {
      return dateOverrides[key];
    }

    if (intervalRule.enabled) {
      const start = new Date(intervalRule.startDate);
      start.setHours(0, 0, 0, 0);
      const target = new Date(date);
      target.setHours(0, 0, 0, 0);

      if (target.getTime() < start.getTime()) return 0;

      const diffTime = target.getTime() - start.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      const interval = intervalRule.gapDays + 1; // 1-day gap = every 2 days

      if (diffDays % interval === 0) {
        return intervalRule.jars;
      }
      return 0;
    }

    // Weekly rules fallback
    const day = date.getDay();
    return weeklyQtys[day] || 0;
  };

  // Click on a calendar day to adjust quantity
  const handleDayClick = (date: Date) => {
    // Only allow editing for today and future days
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);
    if (target.getTime() < today.getTime()) return;

    const key = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`;
    const currentQty = getQtyForDate(target);

    // Cycle: 0 -> 1 -> 2 -> 3 -> 0
    const nextQty = currentQty === 0 ? (intervalRule.jars || 1) : currentQty >= 3 ? 0 : currentQty + 1;

    setDateOverrides((prev) => ({
      ...prev,
      [key]: nextQty,
    }));
    setIsDirty(true);
  };

  // Stepper on weekly day
  const handleWeeklyQtyChange = (dayIndex: number, delta: number) => {
    setWeeklyQtys((prev) => ({
      ...prev,
      [dayIndex]: Math.max(0, Math.min(10, (prev[dayIndex] || 0) + delta)),
    }));
    setIntervalRule((prev) => ({ ...prev, enabled: false }));
    setActivePresetId('');
    setIsDirty(true);
  };

  // Construct final rules and save
  const handleSave = async () => {
    let rules: ScheduleRule[] = [];

    if (intervalRule.enabled) {
      // Save INTERVAL rule with start date
      rules.push({
        type: 'INTERVAL',
        intervalDays: intervalRule.gapDays + 1,
        quantity: intervalRule.jars,
        startDate: intervalRule.startDate,
      });

      // Also save any specific day-of-week anchors or active days as mirror WEEKLY rules for legacy schedulers
      // Calculate active days in the pattern
      const sampleDays: Record<number, number> = {};
      for (let i = 0; i < 14; i++) {
        const d = new Date(intervalRule.startDate);
        d.setDate(d.getDate() + i);
        const q = getQtyForDate(d);
        if (q > 0) {
          sampleDays[d.getDay()] = Math.max(sampleDays[d.getDay()] || 0, q);
        }
      }
      Object.entries(sampleDays).forEach(([dayStr, q]) => {
        rules.push({
          type: 'WEEKLY',
          dayOfWeek: parseInt(dayStr, 10),
          quantity: q,
        });
      });
    } else {
      // Pure WEEKLY rules
      Object.entries(weeklyQtys).forEach(([dayKey, qty]) => {
        if (qty > 0) {
          rules.push({
            type: 'WEEKLY',
            dayOfWeek: parseInt(dayKey, 10),
            quantity: qty,
          });
        }
      });
    }

    try {
      await onSaveSchedule(rules, isActive);
      setIsDirty(false);
      toast.success('Schedule saved successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save schedule');
    }
  };

  const handleToggleActive = async () => {
    const nextActive = !isActive;
    setIsActive(nextActive);
    setIsDirty(true);
  };

  // Month Calendar Grid Calculation
  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const startWeekday = firstDay.getDay(); // 0 = Sun
    const totalDays = lastDay.getDate();

    const days: {
      date: Date;
      isCurrentMonth: boolean;
      isToday: boolean;
      isPast: boolean;
      qty: number;
    }[] = [];

    // Preceding month padding
    const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = startWeekday - 1; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - 1, prevMonthLastDay - i);
      d.setHours(0, 0, 0, 0);
      days.push({
        date: d,
        isCurrentMonth: false,
        isToday: d.getTime() === today.getTime(),
        isPast: d.getTime() < today.getTime(),
        qty: getQtyForDate(d),
      });
    }

    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      const d = new Date(currentYear, currentMonth, i);
      d.setHours(0, 0, 0, 0);
      days.push({
        date: d,
        isCurrentMonth: true,
        isToday: d.getTime() === today.getTime(),
        isPast: d.getTime() < today.getTime(),
        qty: getQtyForDate(d),
      });
    }

    // Trailing month padding (fill out to 35 or 42 cells)
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(currentYear, currentMonth + 1, i);
      d.setHours(0, 0, 0, 0);
      days.push({
        date: d,
        isCurrentMonth: false,
        isToday: d.getTime() === today.getTime(),
        isPast: d.getTime() < today.getTime(),
        qty: getQtyForDate(d),
      });
    }

    return days;
  }, [currentYear, currentMonth, today, intervalRule, dateOverrides, weeklyQtys]);

  // Current Month Stats
  const currentMonthStats = useMemo(() => {
    const monthDays = calendarDays.filter((d) => d.isCurrentMonth);
    const deliveryDaysCount = monthDays.filter((d) => d.qty > 0).length;
    const totalJars = monthDays.reduce((sum, d) => sum + d.qty, 0);

    // Find next upcoming delivery from today onwards
    const nextDelivery = calendarDays.find(
      (d) => d.date.getTime() >= today.getTime() && d.qty > 0
    );

    return {
      deliveryDaysCount,
      totalJars,
      nextDeliveryDate: nextDelivery ? nextDelivery.date : null,
      nextDeliveryQty: nextDelivery ? nextDelivery.qty : 0,
    };
  }, [calendarDays, today]);

  const monthTitle = new Date(currentYear, currentMonth, 1).toLocaleDateString(
    'en-US',
    { month: 'long', year: 'numeric' }
  );

  return (
    <div className="space-y-4">
      {/* ── 1. CADENCE & GAP PRESET SELECTOR (TOP) ── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-3 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#1E88E5]" />
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                Choose Delivery Cadence & Gap
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Select your preferred jar frequency — the full calendar will automatically update.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={handleToggleActive}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                isActive
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100/80'
                  : 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100/80'
              }`}
              title={
                isActive
                  ? 'Auto-deliveries are currently running. Click to pause if you are away or on vacation.'
                  : 'Auto-deliveries are currently paused. Click to resume regular deliveries.'
              }
            >
              <span className="relative flex h-2 w-2 shrink-0">
                {isActive && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                )}
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    isActive ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                />
              </span>
              <div className="text-left leading-tight">
                <div className="flex items-center gap-1">
                  <Power className="w-3 h-3 text-current" />
                  <span>Auto-Deliveries:</span>
                  <span className="underline decoration-dotted">{isActive ? 'Active' : 'Paused'}</span>
                </div>
                <span className="text-[10px] font-normal text-slate-500 block">
                  {isActive ? 'Tap to pause (vacation mode)' : 'Tap to resume deliveries'}
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* Cadence Preset Pills */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-2.5 pt-3">
          {CADENCE_PRESETS.map((p) => {
            const isSelected = activePresetId === p.id && !showCustomInterval;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handleApplyPreset(p)}
                className={`relative text-left p-2.5 sm:p-3 rounded-xl border transition-all cursor-pointer group ${
                  isSelected
                    ? 'bg-[#1E88E5]/5 border-[#1E88E5] shadow-xs ring-2 ring-[#1E88E5]/20'
                    : 'bg-slate-50/70 hover:bg-slate-100/80 border-slate-200/80 text-slate-700'
                }`}
              >
                {p.badge && (
                  <span className="absolute top-2.5 right-2.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wide bg-blue-100 text-blue-800 border border-blue-200">
                    {p.badge}
                  </span>
                )}
                <div className="flex items-center gap-1.5">
                  <Droplets
                    className={`w-3.5 h-3.5 ${
                      isSelected ? 'text-[#1E88E5]' : 'text-slate-400 group-hover:text-slate-600'
                    }`}
                  />
                  <span className="text-xs sm:text-sm font-bold text-slate-900">
                    {p.label}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                  {p.description}
                </p>
              </button>
            );
          })}

          {/* Custom Cadence Button */}
          <button
            type="button"
            onClick={() => {
              setShowCustomInterval(!showCustomInterval);
              if (!showCustomInterval) {
                setActivePresetId('custom');
              }
            }}
            className={`text-left p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
              activePresetId === 'custom' || showCustomInterval
                ? 'bg-[#1E88E5]/5 border-[#1E88E5] shadow-xs ring-2 ring-[#1E88E5]/20'
                : 'bg-slate-50/70 hover:bg-slate-100/80 border-slate-200/80 text-slate-700'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-[#1E88E5]" />
              <span className="text-xs sm:text-sm font-bold text-slate-900">
                Custom Interval
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Choose your exact jars and gap days
            </p>
          </button>
        </div>

        {/* Custom Interval Expandable Controls */}
        {showCustomInterval && (
          <div className="mt-3.5 p-3.5 bg-sky-50/60 border border-sky-200 rounded-xl animate-in fade-in space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <span className="font-bold text-slate-800">Jars per delivery:</span>
                <div className="flex items-center bg-white border border-slate-300 rounded-lg shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setCustomJars((j) => Math.max(1, j - 1))}
                    className="w-7 h-7 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded-l-lg cursor-pointer"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-8 text-center font-bold text-slate-900">
                    {customJars}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCustomJars((j) => Math.min(10, j + 1))}
                    className="w-7 h-7 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded-r-lg cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="font-bold text-slate-800">Gap between deliveries:</span>
                <select
                  value={customGapDays}
                  onChange={(e) => setCustomGapDays(Number(e.target.value))}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-medium text-slate-800 outline-none focus:border-[#1E88E5]"
                >
                  <option value={0}>0 Days (Daily delivery)</option>
                  <option value={1}>1-Day Gap (Every 2 days)</option>
                  <option value={2}>2-Day Gap (Every 3 days)</option>
                  <option value={3}>3-Day Gap (Every 4 days)</option>
                  <option value={4}>4-Day Gap (Every 5 days)</option>
                  <option value={5}>5-Day Gap (Every 6 days)</option>
                  <option value={6}>6-Day Gap (Every 7 days / Weekly)</option>
                </select>
              </div>

              <button
                type="button"
                onClick={handleApplyCustomInterval}
                className="px-3.5 py-1.5 rounded-lg bg-[#1E88E5] hover:bg-[#1976D2] text-white font-bold text-xs shadow-2xs transition-all cursor-pointer"
              >
                Apply to Calendar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── 2. FULL CALENDAR & SCHEDULING INTERACTION CARD ── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Calendar Card Header with Month Navigation & View Toggle */}
        <div className="px-2.5 py-2.5 sm:px-4 sm:py-3.5 border-b border-slate-200/80 bg-slate-50/50 flex flex-wrap items-center justify-between gap-2 sm:gap-3">
          {/* Month Navigation */}
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={handlePrevMonth}
              aria-label="Previous Month"
              className="p-1 sm:p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
            <span className="text-xs sm:text-base font-extrabold text-slate-900 min-w-[110px] sm:min-w-[150px] text-center">
              {monthTitle}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              aria-label="Next Month"
              className="p-1 sm:p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
            <button
              type="button"
              onClick={handleGoToday}
              className="ml-0.5 sm:ml-1 text-[10px] sm:text-[11px] font-bold px-2 py-0.5 sm:py-1 rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Today
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-200/80 p-0.5 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setViewMode('CALENDAR')}
              className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg flex items-center gap-1 sm:gap-1.5 transition-all cursor-pointer ${
                viewMode === 'CALENDAR'
                  ? 'bg-white text-[#1E88E5] shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span className="text-xs">Calendar</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('WEEKLY')}
              className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg flex items-center gap-1 sm:gap-1.5 transition-all cursor-pointer ${
                viewMode === 'WEEKLY'
                  ? 'bg-white text-[#1E88E5] shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ListFilter className="w-3.5 h-3.5" />
              <span className="text-xs">Days of Week</span>
            </button>
          </div>
        </div>

        {/* ── VIEW 1: FULL MONTH CALENDAR VIEW ── */}
        {viewMode === 'CALENDAR' && (
          <div className="p-1.5 sm:p-5">
            {/* Weekday Column Headers */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-1.5 sm:mb-2 text-center">
              {WEEKDAY_NAMES.map((name, i) => (
                <div
                  key={name}
                  className={`text-[10px] sm:text-xs font-bold tracking-wider uppercase py-0.5 sm:py-1 ${
                    i === 0 || i === 6 ? 'text-slate-400' : 'text-slate-600'
                  }`}
                >
                  <span className="sm:hidden">{WEEKDAY_SHORT[i]}</span>
                  <span className="hidden sm:inline">{name}</span>
                </div>
              ))}
            </div>

            {/* Calendar Day Grid */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {calendarDays.map((cell, index) => {
                const dayNum = cell.date.getDate();
                const hasDelivery = cell.qty > 0;
                const isClickable = !cell.isPast && cell.isCurrentMonth;

                return (
                  <div
                    key={index}
                    onClick={() => isClickable && handleDayClick(cell.date)}
                    className={`min-h-[54px] sm:min-h-[82px] p-1 sm:p-2 rounded-lg sm:rounded-2xl border transition-all flex flex-col justify-between overflow-hidden ${
                      !cell.isCurrentMonth
                        ? 'opacity-30 bg-slate-50/50 border-slate-100 cursor-default'
                        : cell.isPast
                        ? 'bg-slate-50/60 border-slate-200/60 text-slate-400 cursor-default'
                        : hasDelivery
                        ? 'bg-gradient-to-b from-sky-50/90 to-blue-50/40 border-sky-300 shadow-2xs hover:border-[#1E88E5] cursor-pointer'
                        : 'bg-white hover:bg-slate-50 border-slate-200/80 cursor-pointer'
                    } ${
                      cell.isToday
                        ? 'ring-2 ring-[#1E88E5] ring-offset-1 font-bold'
                        : ''
                    }`}
                  >
                    {/* Top Row: Date Number & Badges */}
                    <div className="flex items-center justify-between">
                      {cell.isToday ? (
                        <div className="flex items-center justify-center w-4.5 h-4.5 sm:w-auto sm:h-auto rounded-full bg-[#1E88E5] text-white text-[10px] sm:text-sm font-black sm:bg-transparent sm:text-[#1E88E5]">
                          {dayNum}
                        </div>
                      ) : (
                        <span
                          className={`text-[11px] sm:text-sm font-bold ${
                            cell.isCurrentMonth
                              ? 'text-slate-800'
                              : 'text-slate-400'
                          }`}
                        >
                          {dayNum}
                        </span>
                      )}
                      {cell.isToday && (
                        <span className="hidden sm:inline text-[9px] font-extrabold px-1.5 py-0.2 rounded-full bg-[#1E88E5] text-white">
                          Today
                        </span>
                      )}
                    </div>

                    {/* Bottom Row: Jar Delivery Badge */}
                    <div className="mt-0.5 sm:mt-1 flex justify-center sm:justify-start">
                      {hasDelivery ? (
                        <div className="inline-flex items-center justify-center gap-0.5 sm:gap-1 px-1 sm:px-2 py-0.5 rounded-md sm:rounded-lg bg-[#1E88E5] text-white shadow-2xs max-w-full">
                          <Droplets className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-sky-200 shrink-0" />
                          <span className="text-[10px] font-black leading-none sm:hidden">
                            {cell.qty}
                          </span>
                          <span className="hidden sm:inline text-xs font-extrabold whitespace-nowrap">
                            {cell.qty} {cell.qty === 1 ? 'Jar' : 'Jars'}
                          </span>
                        </div>
                      ) : cell.isCurrentMonth && !cell.isPast ? (
                        <span className="text-[10px] text-slate-400 hidden sm:block">
                          Off day
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Helper Instructions Under Calendar */}
            <div className="mt-3.5 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1 font-medium text-[11px] sm:text-xs">
                  <span className="w-2.5 h-2.5 rounded-md bg-[#1E88E5] inline-block" />
                  Delivery ({intervalRule.enabled ? `${intervalRule.jars} Jar${intervalRule.jars === 1 ? '' : 's'}` : 'Scheduled'})
                </span>
                <span className="inline-flex items-center gap-1 font-medium text-[11px] sm:text-xs">
                  <span className="w-2.5 h-2.5 rounded-md bg-white border border-slate-300 inline-block" />
                  Gap / Off Day
                </span>
              </div>
              <span className="text-slate-400 text-[10px] sm:text-[11px]">
                Tip: Click any upcoming date on the calendar to toggle or adjust jars.
              </span>
            </div>
          </div>
        )}

        {/* ── VIEW 2: WEEKLY BREAKDOWN VIEW ── */}
        {viewMode === 'WEEKLY' && (
          <div className="divide-y divide-slate-100">
            {FULL_WEEKDAY_NAMES.map((name, dayIndex) => {
              const qty = weeklyQtys[dayIndex] || 0;
              const isDelivery = qty > 0;
              return (
                <div
                  key={name}
                  className={`px-4 sm:px-5 py-3 flex items-center justify-between gap-3 transition-colors ${
                    isDelivery ? 'bg-sky-50/30' : 'bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                        isDelivery
                          ? 'bg-[#1E88E5] text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {WEEKDAY_NAMES[dayIndex]}
                    </div>
                    <div>
                      <span className="text-sm font-bold text-slate-900 block">
                        {name}
                      </span>
                      <span className="text-xs text-slate-500">
                        {isDelivery ? `${qty} Jar(s) scheduled every ${name}` : 'No recurring delivery'}
                      </span>
                    </div>
                  </div>

                  {/* Stepper */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center bg-white border border-slate-200 rounded-xl shadow-2xs p-0.5">
                      <button
                        type="button"
                        onClick={() => handleWeeklyQtyChange(dayIndex, -1)}
                        disabled={qty === 0}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-8 text-center font-bold text-sm text-slate-900">
                        {qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleWeeklyQtyChange(dayIndex, 1)}
                        disabled={qty >= 10}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── CARD FOOTER: MONTH SUMMARY & SAVE BUTTON ── */}
        <div className="px-3 sm:px-5 py-3 sm:py-3.5 bg-slate-50 border-t border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Monthly stats badges */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-3 text-xs">
            <div className="bg-white border border-slate-200 px-2.5 sm:px-3 py-1.5 rounded-xl shadow-2xs">
              <span className="text-slate-400 text-[9px] sm:text-[10px] uppercase font-bold block">
                Deliveries this month
              </span>
              <span className="text-slate-900 font-extrabold text-xs sm:text-sm">
                {currentMonthStats.deliveryDaysCount} Days
              </span>
            </div>

            <div className="bg-white border border-slate-200 px-2.5 sm:px-3 py-1.5 rounded-xl shadow-2xs">
              <span className="text-slate-400 text-[9px] sm:text-[10px] uppercase font-bold block">
                Total Jars
              </span>
              <span className="text-[#1E88E5] font-extrabold text-xs sm:text-sm">
                {currentMonthStats.totalJars} Jars (~{currentMonthStats.totalJars * 20}L)
              </span>
            </div>

            {currentMonthStats.nextDeliveryDate && (
              <div className="col-span-2 sm:col-span-1 bg-white border border-slate-200 px-2.5 sm:px-3 py-1.5 rounded-xl shadow-2xs">
                <span className="text-slate-400 text-[9px] sm:text-[10px] uppercase font-bold block">
                  Next Delivery
                </span>
                <span className="text-emerald-700 font-extrabold text-xs sm:text-sm">
                  {currentMonthStats.nextDeliveryDate.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}{' '}
                  ({currentMonthStats.nextDeliveryQty} Jar{currentMonthStats.nextDeliveryQty === 1 ? '' : 's'})
                </span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-1 sm:pt-0">
            {isDirty && (
              <span className="text-[11px] sm:text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 sm:px-2.5 py-1 rounded-lg">
                Unsaved changes
              </span>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl bg-[#1E88E5] hover:bg-[#1976D2] active:bg-[#1565C0] text-white text-xs sm:text-sm font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              {saving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Saving Schedule...</span>
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
      </div>
    </div>
  );
}
