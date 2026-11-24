import { useState, useMemo, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Droplets,
  Minus,
  Plus,
  Save,
  CalendarDays,
  ListFilter,
  AlertTriangle,
  AlertCircle,
  X,
  Check,
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
  overrides?: Array<{ id?: string; targetDate: string; quantity: number; reason?: string }>;
  createdAt?: string | Date;
}

interface FullScheduleCalendarProps {
  schedule: Schedule | null;
  onSaveSchedule: (
    rules: ScheduleRule[],
    isActive: boolean,
    overrides?: Array<{ targetDate: string; quantity: number }>,
  ) => Promise<void>;
  saving?: boolean;
  availableJarBalance?: number;
  walletBalance?: number;
  onRechargeClick?: () => void;
  deliveries?: Array<{
    id?: string;
    scheduledFor: string;
    status: string;
    quantity?: number;
    requiredQuantity?: number;
  }>;
  accountStartDate?: Date | string | null;
  onMonthChange?: (year: number, month: number) => void;
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
    id: '1-jar-daily',
    label: '1 Jar • Daily',
    jars: 1,
    gapDays: 0,
    description: '1 jar delivered every single day',
    badge: 'Popular',
  },
  {
    id: '2-jar-daily',
    label: '2 Jars • Daily',
    jars: 2,
    gapDays: 0,
    description: '2 jars delivered every single day',
    badge: 'Families',
  },
  {
    id: '1-jar-1-gap',
    label: '1 Jar • 1-Day Gap',
    jars: 1,
    gapDays: 1,
    description: '1 jar every alternate day (Every 2 days)',
  },
  {
    id: '2-jar-1-gap',
    label: '2 Jars • 1-Day Gap',
    jars: 2,
    gapDays: 1,
    description: '2 jars every alternate day (Heavy consumption)',
  },
  {
    id: '1-jar-2-gap',
    label: '1 Jar • 2-Day Gap',
    jars: 1,
    gapDays: 2,
    description: '1 jar every 3 days (Light consumption)',
  },
  {
    id: '2-jar-2-gap',
    label: '2 Jars • 2-Day Gap',
    jars: 2,
    gapDays: 2,
    description: '2 jars every 3 days (2 rest days between deliveries)',
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
  availableJarBalance = 0,
  walletBalance = 0,
  onRechargeClick,
  deliveries = [],
  accountStartDate,
  onMonthChange,
}: FullScheduleCalendarProps) {
  // Calendar viewing month/year state
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const effectiveStartDate = useMemo(() => {
    const candidate =
      accountStartDate ||
      schedule?.rules?.[0]?.startDate ||
      (deliveries?.length > 0 ? deliveries[0].scheduledFor : null);
    if (!candidate) return null;
    const d = new Date(candidate);
    d.setHours(0, 0, 0, 0);
    return isNaN(d.getTime()) ? null : d;
  }, [accountStartDate, schedule, deliveries]);

  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth()); // 0-indexed

  // View mode: 'CALENDAR' | 'WEEKLY'
  const [viewMode, setViewMode] = useState<'CALENDAR' | 'WEEKLY'>('WEEKLY');

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
  const [isBannerDismissed, setIsBannerDismissed] = useState(false);
  const [isCadenceExpanded, setIsCadenceExpanded] = useState(false);

  // Helper to project weekly quantities from an interval cadence pattern
  const calculateWeeklyQtysFromInterval = (
    jars: number,
    gapDays: number,
    startDate: Date,
  ): Record<number, number> => {
    const qtys: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    if (gapDays === 0) {
      for (let i = 0; i < 7; i++) {
        qtys[i] = jars;
      }
      return qtys;
    }

    const interval = gapDays + 1;
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    for (let offset = 0; offset < 7; offset++) {
      const cur = new Date(start);
      cur.setDate(start.getDate() + offset);
      const diffTime = cur.getTime() - start.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      const dayIndex = cur.getDay();
      if (diffDays % interval === 0) {
        qtys[dayIndex] = jars;
      } else {
        qtys[dayIndex] = 0;
      }
    }
    return qtys;
  };

  const currentCadenceLabel = useMemo(() => {
    if (activePresetId === 'custom' || showCustomInterval) {
      if (customGapDays === 0) {
        return `${customJars} Jar(s) • Daily`;
      }
      return `${customJars} Jar(s) • ${customGapDays}-Day Gap`;
    }
    const found = CADENCE_PRESETS.find((p) => p.id === activePresetId);
    if (found) return found.label;

    if (intervalRule.enabled && intervalRule.gapDays === 0) {
      return `${intervalRule.jars} Jar(s) • Daily`;
    }
    if (intervalRule.enabled) {
      return `${intervalRule.jars} Jar(s) • ${intervalRule.gapDays}-Day Gap`;
    }

    const vals = Object.values(weeklyQtys);
    if (vals.length === 7 && vals.every((v) => v === vals[0]) && vals[0] > 0) {
      return `${vals[0]} Jar(s) • Daily`;
    }

    return 'Custom Weekly';
  }, [activePresetId, showCustomInterval, customJars, customGapDays, intervalRule, weeklyQtys]);

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

        // Initialize weeklyQtys to match the interval rule
        setWeeklyQtys(calculateWeeklyQtysFromInterval(jars, gap, sDate));
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

        const vals = Object.values(qtys);
        if (vals.length === 7 && vals.every((v) => v === vals[0]) && vals[0] > 0) {
          const match = CADENCE_PRESETS.find((p) => p.jars === vals[0] && p.gapDays === 0);
          if (match) {
            setActivePresetId(match.id);
          } else {
            setActivePresetId('custom');
            setCustomJars(vals[0]);
            setCustomGapDays(0);
          }
        } else {
          setActivePresetId('');
        }
      }

      // Load saved date overrides from schedule
      if (schedule.overrides && schedule.overrides.length > 0) {
        const loaded: Record<string, number> = {};
        schedule.overrides.forEach((ov) => {
          const key = new Date(ov.targetDate).toISOString().split('T')[0];
          loaded[key] = ov.quantity;
        });
        setDateOverrides(loaded);
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
    // Immediately sync weeklyQtys so "Days of Week" matches this cadence
    const updatedWeekly = calculateWeeklyQtysFromInterval(preset.jars, preset.gapDays, today);
    setWeeklyQtys(updatedWeekly);
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
    // Immediately sync weeklyQtys so "Days of Week" matches this interval
    const updatedWeekly = calculateWeeklyQtysFromInterval(customJars, customGapDays, today);
    setWeeklyQtys(updatedWeekly);
    setDateOverrides({});
    setIsDirty(true);
    toast.success(`Applied ${customJars} Jar(s) with ${customGapDays === 0 ? 'Daily' : `${customGapDays}-Day Gap`}`);
  };

  // Month navigation
  const handlePrevMonth = () => {
    let newM = currentMonth - 1;
    let newY = currentYear;
    if (currentMonth === 0) {
      newM = 11;
      newY = currentYear - 1;
      setCurrentMonth(11);
      setCurrentYear(newY);
    } else {
      setCurrentMonth(newM);
    }
    onMonthChange?.(newY, newM + 1);
  };

  const handleNextMonth = () => {
    let newM = currentMonth + 1;
    let newY = currentYear;
    if (currentMonth === 11) {
      newM = 0;
      newY = currentYear + 1;
      setCurrentMonth(0);
      setCurrentYear(newY);
    } else {
      setCurrentMonth(newM);
    }
    onMonthChange?.(newY, newM + 1);
  };

  const handleGoToday = () => {
    setCurrentMonth(today.getMonth());
    setCurrentYear(today.getFullYear());
    onMonthChange?.(today.getFullYear(), today.getMonth() + 1);
  };

  // Helper to compute jar quantity on any target date
  const getQtyForDate = (date: Date): number => {
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);

    // Never project recurring subscription jars before the account or subscription was created
    if (effectiveStartDate && target.getTime() < effectiveStartDate.getTime()) {
      return 0;
    }

    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    
    // Check manual override first
    if (dateOverrides[key] !== undefined) {
      return dateOverrides[key];
    }

    // If auto-deliveries are paused, do not project recurring intervals or weekly days
    if (!isActive) {
      return 0;
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
    const updatedQty = Math.max(0, Math.min(10, (weeklyQtys[dayIndex] || 0) + delta));
    const nextQtys = {
      ...weeklyQtys,
      [dayIndex]: updatedQty,
    };
    setWeeklyQtys(nextQtys);
    setIntervalRule((prev) => ({ ...prev, enabled: false }));

    const vals = Object.values(nextQtys);
    if (vals.length === 7 && vals.every((v) => v === vals[0]) && vals[0] > 0) {
      const match = CADENCE_PRESETS.find((p) => p.jars === vals[0] && p.gapDays === 0);
      if (match) {
        setActivePresetId(match.id);
      } else {
        setActivePresetId('custom');
        setCustomJars(vals[0]);
        setCustomGapDays(0);
      }
    } else {
      setActivePresetId('');
    }

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

    const overridesList = Object.entries(dateOverrides).map(([dt, qty]) => ({
      targetDate: dt,
      quantity: qty,
    }));

    try {
      await onSaveSchedule(rules, isActive, overridesList);
      setIsDirty(false);
      if (currentMonthStats.hasDeficit) {
        toast(
          `Schedule saved! Note: ${currentMonthStats.deficitJars} upcoming jar(s) exceed your prepaid balance of ${availableJarBalance} jars. Deliveries marked in orange will require a recharge.`,
          {
            icon: '⚠️',
            duration: 6000,
          }
        );
      } else {
        toast.success('Schedule saved successfully!');
      }
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

    // Calculate running upcoming jars chronologically from today onwards.
    // If the month view starts AFTER today (e.g. browsing future months like December or January),
    // seed runningUpcomingJars with the upcoming jars between today and days[0].date so deficit carries over seamlessly!
    let runningUpcomingJars = 0;
    if (days.length > 0 && days[0].date.getTime() > today.getTime()) {
      const cursor = new Date(today);
      while (cursor.getTime() < days[0].date.getTime()) {
        const cursorStr = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
        const match = deliveries?.find((d) => {
          if (!d.scheduledFor) return false;
          const dDate = new Date(d.scheduledFor);
          const dStr = `${dDate.getFullYear()}-${String(dDate.getMonth() + 1).padStart(2, '0')}-${String(dDate.getDate()).padStart(2, '0')}`;
          return dStr === cursorStr;
        });

        if (match && (match.status === 'DELIVERED' || (match.status as string) === 'COMPLETED')) {
          // Delivered jars already fulfilled, do not count against remaining balance
        } else if (dateOverrides[cursorStr] !== undefined) {
          runningUpcomingJars += dateOverrides[cursorStr];
        } else if (match) {
          runningUpcomingJars += match.requiredQuantity || match.quantity || 0;
        } else {
          runningUpcomingJars += getQtyForDate(cursor);
        }

        cursor.setDate(cursor.getDate() + 1);
      }
    }

    return days.map((cell) => {
      let isExceedingBalance = false;
      let cumulativeAtCell = 0;

      const cellDateStr = `${cell.date.getFullYear()}-${String(cell.date.getMonth() + 1).padStart(2, '0')}-${String(cell.date.getDate()).padStart(2, '0')}`;
      const matchingDelivery = deliveries?.find((d) => {
        if (!d.scheduledFor) return false;
        const dDate = new Date(d.scheduledFor);
        const dStr = `${dDate.getFullYear()}-${String(dDate.getMonth() + 1).padStart(2, '0')}-${String(dDate.getDate()).padStart(2, '0')}`;
        return dStr === cellDateStr;
      });

      let cellQty = cell.qty;
      let isDelivered = false;

      // ── RULE 1: Any delivery with status DELIVERED (past, today, or advance delivery like 21 or 22) is GREEN ──
      if (matchingDelivery && (matchingDelivery.status === 'DELIVERED' || (matchingDelivery.status as string) === 'COMPLETED')) {
        isDelivered = true;
        cellQty = matchingDelivery.requiredQuantity || matchingDelivery.quantity || cell.qty || 1;
      } else if (cell.isPast && !cell.isToday) {
        // ── RULE 2: Past dates without a completed delivery record are clean off days (no ghost jars) ──
        cellQty = 0;
        isDelivered = false;
      } else {
        // ── RULE 3: Today or upcoming future delivery needing fulfillment ──
        if (dateOverrides[cellDateStr] !== undefined) {
          cellQty = dateOverrides[cellDateStr];
        } else if (matchingDelivery) {
          cellQty = matchingDelivery.requiredQuantity || matchingDelivery.quantity || cell.qty;
        }
        if (cellQty > 0) {
          runningUpcomingJars += cellQty;
          cumulativeAtCell = runningUpcomingJars;
          if (runningUpcomingJars > availableJarBalance) {
            isExceedingBalance = true;
          }
        }
      }

      return {
        ...cell,
        qty: cellQty,
        isDelivered,
        isExceedingBalance,
        cumulativeAtCell,
      };
    });
  }, [currentYear, currentMonth, today, intervalRule, dateOverrides, weeklyQtys, availableJarBalance, deliveries, effectiveStartDate, isActive]);

  // Current Month Stats
  const currentMonthStats = useMemo(() => {
    const monthDays = calendarDays.filter((d) => d.isCurrentMonth);
    const deliveryDaysCount = monthDays.filter((d) => d.qty > 0).length;
    const totalJars = monthDays.reduce((sum, d) => sum + d.qty, 0);

    const upcomingDays = calendarDays.filter((d) => !d.isPast && d.qty > 0);
    const totalUpcomingJars = upcomingDays.reduce((sum, d) => sum + d.qty, 0);
    const coveredUpcomingJars = Math.min(totalUpcomingJars, availableJarBalance);
    const deficitJars = Math.max(0, totalUpcomingJars - availableJarBalance);

    // Find the first upcoming delivery day that exceeds the prepaid balance
    const firstDeficitDay = calendarDays.find(
      (d) => !d.isPast && d.qty > 0 && (d as any).isExceedingBalance
    );

    let daysUntilDeficit: number | null = null;
    let isWithinOneWeek = false;

    if (firstDeficitDay) {
      const diffTime = firstDeficitDay.date.getTime() - today.getTime();
      daysUntilDeficit = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
      // Only trigger the alert notice within 7 days (1 week) before balance runs out
      if (daysUntilDeficit <= 7) {
        isWithinOneWeek = true;
      }
    } else if (availableJarBalance <= 0 && upcomingDays.length > 0) {
      // Customer has 0 jars right now and has deliveries scheduled
      daysUntilDeficit = 0;
      isWithinOneWeek = true;
    }

    // Find next upcoming delivery from today onwards
    const nextDelivery = calendarDays.find(
      (d) => d.date.getTime() >= today.getTime() && d.qty > 0
    );

    return {
      deliveryDaysCount,
      totalJars,
      totalUpcomingJars,
      coveredUpcomingJars,
      deficitJars,
      hasDeficit: deficitJars > 0,
      isWithinOneWeek,
      daysUntilDeficit,
      firstDeficitDate: firstDeficitDay ? firstDeficitDay.date : null,
      nextDeliveryDate: nextDelivery ? nextDelivery.date : null,
      nextDeliveryQty: nextDelivery ? nextDelivery.qty : 0,
    };
  }, [calendarDays, today, availableJarBalance]);

  const monthTitle = new Date(currentYear, currentMonth, 1).toLocaleDateString(
    'en-US',
    { month: 'long', year: 'numeric' }
  );

  return (
    <div className="space-y-4">
      {/* ── 1. CADENCE & GAP PRESET SELECTOR (COMPACT & MINIMAL) ── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-3 sm:p-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-800">Frequency:</span>
            <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-[#1E88E5] border border-blue-100">
              {currentCadenceLabel}
            </span>
            <button
              type="button"
              onClick={() => setIsCadenceExpanded(!isCadenceExpanded)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer ml-1"
            >
              <span>{isCadenceExpanded ? 'Hide' : 'Change'}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isCadenceExpanded ? 'rotate-180' : ''}`} />
            </button>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={handleToggleActive}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                isActive
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100/80'
                  : 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100/80'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <span>{isActive ? 'Auto-Deliveries Active' : 'Deliveries Paused'}</span>
            </button>
          </div>
        </div>

        {/* Collapsible Presets: Only shown when customer clicks 'Change' */}
        {isCadenceExpanded && (
          <div className="mt-3 pt-3 border-t border-slate-100 animate-in fade-in">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CADENCE_PRESETS.map((p) => {
                const isSelected = activePresetId === p.id && !showCustomInterval;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      handleApplyPreset(p);
                      setIsCadenceExpanded(false);
                    }}
                    className={`text-left p-2.5 rounded-xl border transition-all cursor-pointer group ${
                      isSelected
                        ? 'bg-[#1E88E5]/5 border-[#1E88E5] shadow-xs ring-1 ring-[#1E88E5]/30'
                        : 'bg-slate-50/70 hover:bg-slate-100 border-slate-200 text-slate-700'
                    }`}
                  >
                    <span className="text-xs font-bold text-slate-900 block truncate">{p.label}</span>
                    <span className="text-[10px] text-slate-500 truncate block mt-0.5">{p.description}</span>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => {
                  setShowCustomInterval(!showCustomInterval);
                  if (!showCustomInterval) setActivePresetId('custom');
                }}
                className={`text-left p-2.5 rounded-xl border transition-all cursor-pointer ${
                  activePresetId === 'custom' || showCustomInterval
                    ? 'bg-[#1E88E5]/5 border-[#1E88E5] ring-1 ring-[#1E88E5]/30'
                    : 'bg-slate-50/70 hover:bg-slate-100 border-slate-200 text-slate-700'
                }`}
              >
                <span className="text-xs font-bold text-slate-900 block">Custom Interval</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">Choose jars & gap days</span>
              </button>
            </div>

            {/* Custom Interval Expandable Controls */}
            {showCustomInterval && (
              <div className="mt-3 p-3 bg-sky-50/60 border border-sky-200 rounded-xl space-y-2.5 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800">Jars:</span>
                    <div className="flex items-center bg-white border border-slate-300 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setCustomJars((j) => Math.max(1, j - 1))}
                        className="w-6 h-6 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded-l-lg cursor-pointer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-6 text-center font-bold text-slate-900">{customJars}</span>
                      <button
                        type="button"
                        onClick={() => setCustomJars((j) => Math.min(10, j + 1))}
                        className="w-6 h-6 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded-r-lg cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800">Gap:</span>
                    <select
                      value={customGapDays}
                      onChange={(e) => setCustomGapDays(Number(e.target.value))}
                      className="px-2 py-1 rounded-lg border border-slate-300 bg-white font-medium text-slate-800"
                    >
                      <option value={0}>0 Days (Daily)</option>
                      <option value={1}>1-Day Gap (Every 2 days)</option>
                      <option value={2}>2-Day Gap (Every 3 days)</option>
                      <option value={3}>3-Day Gap (Every 4 days)</option>
                      <option value={4}>4-Day Gap (Every 5 days)</option>
                      <option value={6}>Weekly</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      handleApplyCustomInterval();
                      setIsCadenceExpanded(false);
                    }}
                    className="px-3 py-1 rounded-lg bg-[#1E88E5] hover:bg-[#1976D2] text-white font-bold text-xs cursor-pointer"
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 1.5. PREPAID BALANCE & COD FALLBACK NOTICE (CLEAR & REASSURING) ── */}
      {currentMonthStats.hasDeficit && currentMonthStats.isWithinOneWeek && !isBannerDismissed && (
        <div className="bg-amber-50/90 border border-amber-200/90 rounded-2xl p-3 sm:p-3.5 flex items-center justify-between gap-3 shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              {availableJarBalance === 0 && (!walletBalance || walletBalance <= 0) ? (
                <>
                  <p className="text-xs font-bold text-amber-950 truncate">
                    No prepaid jars or wallet balance remaining (Cash on Delivery active)
                  </p>
                  <p className="text-[11px] text-amber-900/80 truncate">
                    Scheduled deliveries will be fulfilled via Cash on Delivery (COD) upon handover. Recharge to enjoy automatic cashless deliveries.
                  </p>
                </>
              ) : availableJarBalance === 0 && walletBalance && walletBalance > 0 ? (
                <>
                  <p className="text-xs font-bold text-amber-950 truncate">
                    Prepaid jars depleted (₹{walletBalance.toFixed(2)} active in wallet)
                  </p>
                  <p className="text-[11px] text-amber-900/80 truncate">
                    Upcoming deliveries will automatically deduct from your available wallet balance.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xs font-bold text-amber-950 truncate">
                    Prepaid balance running low ({availableJarBalance} jar{availableJarBalance === 1 ? '' : 's'} remaining)
                  </p>
                  <p className="text-[11px] text-amber-900/80 truncate">
                    Recharge your water pack or wallet to avoid fallback to Cash on Delivery.
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onRechargeClick && (
              <button
                type="button"
                onClick={onRechargeClick}
                className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all cursor-pointer shadow-2xs"
              >
                Recharge
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsBannerDismissed(true)}
              className="p-1 rounded-lg text-amber-700 hover:text-amber-950 hover:bg-amber-100 transition-colors cursor-pointer"
              title="Dismiss notice"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

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

          {/* View Mode Toggle: Days of Week (Default) / Calendar */}
          <div className="flex items-center bg-slate-200/80 p-0.5 rounded-xl text-xs font-semibold">
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
                const isExceeding = (cell as any).isExceedingBalance;

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
                        ? isExceeding
                          ? 'bg-gradient-to-b from-amber-50/90 to-orange-50/40 border-amber-300 shadow-2xs hover:border-amber-500 cursor-pointer'
                          : 'bg-gradient-to-b from-sky-50/90 to-blue-50/40 border-sky-300 shadow-2xs hover:border-[#1E88E5] cursor-pointer'
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
                        <div
                          className={`inline-flex items-center justify-center gap-0.5 sm:gap-1 px-1 sm:px-2 py-0.5 rounded-md sm:rounded-lg text-white shadow-2xs max-w-full ${
                            (cell as any).isDelivered
                              ? 'bg-emerald-600 hover:bg-emerald-700'
                              : isExceeding
                              ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                              : 'bg-[#1E88E5] hover:bg-blue-600'
                          }`}
                          title={
                            (cell as any).isDelivered
                              ? `Delivered: ${cell.qty} jar(s) completed`
                              : isExceeding
                              ? `Delivery of ${cell.qty} jar(s) exceeds prepaid balance (${availableJarBalance} available). Recharge needed.`
                              : `Covered by prepaid balance (Cumulative: ${(cell as any).cumulativeAtCell}/${availableJarBalance})`
                          }
                        >
                          {(cell as any).isDelivered ? (
                            <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-100 shrink-0" />
                          ) : isExceeding ? (
                            <AlertCircle className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-100 shrink-0" />
                          ) : (
                            <Droplets className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-sky-200 shrink-0" />
                          )}
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

            {/* Clean Legend Under Calendar */}
            <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5 font-medium text-xs text-slate-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block shrink-0" />
                  Delivered (Completed)
                </span>
                <span className="inline-flex items-center gap-1.5 font-medium text-xs text-slate-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#1E88E5] inline-block shrink-0" />
                  Scheduled ({currentMonthStats.coveredUpcomingJars} Jars Covered)
                </span>
                {currentMonthStats.hasDeficit && (
                  <span className="inline-flex items-center gap-1.5 font-medium text-xs text-amber-800 font-semibold">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block shrink-0" />
                    Needs Recharge ({currentMonthStats.deficitJars} Jars)
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 font-medium text-xs text-slate-400">
                  <span className="w-2.5 h-2.5 rounded-full border border-slate-300 inline-block shrink-0" />
                  Off Day
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── VIEW 2: WEEKLY BREAKDOWN VIEW ── */}
        {viewMode === 'WEEKLY' && (() => {
          // Calculate upcoming weekday deficit chronologically starting from today
          const todayDayIndex = today.getDay();
          const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
          const isTodayDelivered = deliveries?.some((d) => {
            if (!d.scheduledFor) return false;
            const dDate = new Date(d.scheduledFor);
            const dStr = `${dDate.getFullYear()}-${String(dDate.getMonth() + 1).padStart(2, '0')}-${String(dDate.getDate()).padStart(2, '0')}`;
            return dStr === todayStr && (d.status === 'DELIVERED' || (d.status as string) === 'COMPLETED');
          });

          let cumJars = 0;
          const weekdayDeficitMap: Record<number, boolean> = {};

          for (let offset = 0; offset < 7; offset++) {
            const dIndex = (todayDayIndex + offset) % 7;
            // If today's delivery has already been fulfilled and delivered, its jars were already deducted from available balance
            if (offset === 0 && isTodayDelivered) {
              continue;
            }
            const dayQty = weeklyQtys[dIndex] || 0;
            if (dayQty > 0) {
              cumJars += dayQty;
              if (cumJars > availableJarBalance) {
                weekdayDeficitMap[dIndex] = true;
              }
            }
          }

          return (
            <div className="divide-y divide-slate-100">
              {FULL_WEEKDAY_NAMES.map((name, dayIndex) => {
                const qty = weeklyQtys[dayIndex] || 0;
                const isDelivery = qty > 0;
                const isDeficit = isDelivery && !!weekdayDeficitMap[dayIndex];

                return (
                  <div
                    key={name}
                    className={`px-4 sm:px-5 py-3 flex items-center justify-between gap-3 transition-colors ${
                      !isDelivery
                        ? 'bg-white'
                        : isDeficit
                        ? 'bg-amber-50/40 border-l-4 border-l-amber-500'
                        : 'bg-sky-50/30 border-l-4 border-l-[#1E88E5]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                          !isDelivery
                            ? 'bg-slate-100 text-slate-400'
                            : isDeficit
                            ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-2xs'
                            : 'bg-[#1E88E5] text-white shadow-2xs'
                        }`}
                      >
                        {WEEKDAY_NAMES[dayIndex]}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900 block">
                            {name}
                          </span>
                          {isDelivery && (
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                isDeficit
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-blue-100 text-[#1677C8]'
                              }`}
                            >
                              {isDeficit ? 'Needs Recharge' : 'Prepaid Covered'}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                          {isDelivery ? (
                            isDeficit ? (
                              <span className="text-amber-700 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
                                {qty} Jar(s) scheduled • Exceeds prepaid balance (COD fallback)
                              </span>
                            ) : (
                              <span className="text-sky-700 flex items-center gap-1">
                                <Droplets className="w-3 h-3 text-[#1E88E5] shrink-0" />
                                {qty} Jar(s) scheduled • Covered by prepaid balance
                              </span>
                            )
                          ) : (
                            'No recurring delivery (Off day)'
                          )}
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
          );
        })()}

        {/* ── CARD FOOTER: MINIMAL SUMMARY & SAVE ACTION ── */}
        <div className="px-3 sm:px-5 py-3 sm:py-3.5 bg-slate-50 border-t border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-slate-600">
            <span>
              Scheduled this month: <strong className="text-slate-900 font-bold">{currentMonthStats.totalJars} Jars</strong>
            </span>
            <span className="text-slate-300 hidden sm:inline">•</span>
            <span>
              Prepaid Balance: <strong className="text-[#1E88E5] font-bold">{availableJarBalance} Jars</strong>
            </span>
            {currentMonthStats.hasDeficit && (
              <>
                <span className="text-slate-300 hidden sm:inline">•</span>
                <span className="text-amber-800 font-bold bg-amber-100 px-2 py-0.5 rounded-md">
                  +{currentMonthStats.deficitJars} Jars needed
                </span>
              </>
            )}
          </div>

          <div className="flex items-center justify-end gap-2.5">
            {isDirty && (
              <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg">
                Unsaved changes
              </span>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2 rounded-xl bg-[#1E88E5] hover:bg-[#1976D2] active:bg-[#1565C0] text-white text-xs sm:text-sm font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              {saving ? (
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
      </div>
    </div>
  );
}
