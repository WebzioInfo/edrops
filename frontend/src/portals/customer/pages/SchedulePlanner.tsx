import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, Save, RefreshCw, Sparkles, AlertCircle } from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';
import { toast } from 'react-hot-toast';

interface ScheduleRule {
  id?: string;
  type: 'WEEKLY' | 'INTERVAL' | 'CUSTOM';
  dayOfWeek?: number;
  quantity?: number;
  intervalDays?: number;
  customNotes?: string;
}

interface Schedule {
  id: string;
  isActive: boolean;
  rules: ScheduleRule[];
}

const DAYS_OF_WEEK = [
  { label: 'Sunday', value: 0 },
  { label: 'Monday', value: 1 },
  { label: 'Tuesday', value: 2 },
  { label: 'Wednesday', value: 3 },
  { label: 'Thursday', value: 4 },
  { label: 'Friday', value: 5 },
  { label: 'Saturday', value: 6 },
];

export default function SchedulePlanner() {
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<'WEEKLY' | 'INTERVAL' | 'CUSTOM'>('WEEKLY');

  // Weekly local state quantities
  const [weeklyQtys, setWeeklyQtys] = useState<Record<number, number>>({
    0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0
  });

  // Interval local state
  const [intervalDays, setIntervalDays] = useState<number>(3);
  const [intervalQty, setIntervalQty] = useState<number>(1);

  // Custom local state
  const [customNotes, setCustomNotes] = useState<string>('');

  useEffect(() => {
    async function loadSchedule() {
      try {
        const data = await fetchWithAuth('/schedule');
        if (data) {
          setSchedule(data);
          
          // Parse rules into state
          const rules: ScheduleRule[] = data.rules || [];
          if (rules.length > 0) {
            const firstRuleType = rules[0].type;
            setMode(firstRuleType);

            if (firstRuleType === 'WEEKLY') {
              const qtys: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
              rules.forEach(r => {
                if (r.dayOfWeek !== undefined && r.dayOfWeek !== null) {
                  qtys[r.dayOfWeek] = r.quantity || 0;
                }
              });
              setWeeklyQtys(qtys);
            } else if (firstRuleType === 'INTERVAL') {
              const intervalRule = rules[0];
              setIntervalDays(intervalRule.intervalDays || 3);
              setIntervalQty(intervalRule.quantity || 1);
            } else if (firstRuleType === 'CUSTOM') {
              setCustomNotes(rules[0].customNotes || '');
            }
          }
        }
      } catch (err: any) {
        toast.error('Failed to load delivery schedule');
      } finally {
        setLoading(false);
      }
    }
    loadSchedule();
  }, []);

  const handleWeeklyQtyChange = (day: number, delta: number) => {
    setWeeklyQtys(prev => ({
      ...prev,
      [day]: Math.max(0, Math.min(10, prev[day] + delta))
    }));
  };

  const handleSave = async () => {
    if (!schedule) return;
    setSaving(true);
    
    // Construct rules
    const rules: ScheduleRule[] = [];
    if (mode === 'WEEKLY') {
      Object.keys(weeklyQtys).forEach(dayKey => {
        const day = parseInt(dayKey);
        const qty = weeklyQtys[day];
        if (qty > 0) {
          rules.push({
            type: 'WEEKLY',
            dayOfWeek: day,
            quantity: qty
          });
        }
      });
    } else if (mode === 'INTERVAL') {
      rules.push({
        type: 'INTERVAL',
        intervalDays: intervalDays,
        quantity: intervalQty
      });
    } else if (mode === 'CUSTOM') {
      rules.push({
        type: 'CUSTOM',
        customNotes: customNotes
      });
    }

    try {
      const updated = await fetchWithAuth('/schedule', {
        method: 'POST',
        body: JSON.stringify({
          isActive: schedule.isActive,
          rules
        })
      });
      setSchedule(updated);
      toast.success('Delivery schedule saved successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save schedule');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    if (!schedule) return;
    const nextActive = !schedule.isActive;
    setSchedule({ ...schedule, isActive: nextActive });
    
    try {
      await fetchWithAuth('/schedule', {
        method: 'POST',
        body: JSON.stringify({
          isActive: nextActive,
          rules: schedule.rules
        })
      });
      toast.success(`Schedule ${nextActive ? 'enabled' : 'paused'} successfully!`);
    } catch {
      toast.error('Failed to toggle schedule state');
      setSchedule({ ...schedule, isActive: !nextActive });
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="relative h-16 w-16 rounded-full water-gradient shadow-2xl shadow-edrops-aqua/30">
          <div className="absolute inset-2 animate-ping rounded-full bg-white/40" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8 space-y-6">
      
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-[#245361]">Delivery Schedule</h1>
          <p className="text-sm font-semibold text-[#245361]/95 mt-1">Configure your custom hydration calendar and jar supply intervals</p>
        </div>
        
        {schedule && (
          <button
            onClick={handleToggleActive}
            className={`px-6 py-2.5 rounded-full text-xs font-black uppercase tracking-wider shadow-sm transition-all ${
              schedule.isActive
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
            }`}
          >
            {schedule.isActive ? '● Schedule Active' : '○ Schedule Paused'}
          </button>
        )}
      </div>

      {/* 2. Mode Selectors */}
      <div className="grid grid-cols-3 gap-3 rounded-[2rem] bg-secondary/15 p-2 max-w-2xl">
        <button
          onClick={() => setMode('WEEKLY')}
          className={`py-3.5 rounded-full text-sm font-black transition-all ${
            mode === 'WEEKLY'
              ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Weekly Schedule
        </button>
        <button
          onClick={() => setMode('INTERVAL')}
          className={`py-3.5 rounded-full text-sm font-black transition-all ${
            mode === 'INTERVAL'
              ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Interval Deliveries
        </button>
        <button
          onClick={() => setMode('CUSTOM')}
          className={`py-3.5 rounded-full text-sm font-black transition-all ${
            mode === 'CUSTOM'
              ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Custom
        </button>
      </div>

      {/* 3. Scheduler Form Card */}
      <div className="grid gap-6 md:grid-cols-[1.4fr_0.8fr]">
        
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="clay-card p-6 sm:p-8 space-y-6"
        >
          {mode === 'WEEKLY' ? (
            <div className="space-y-4">
              <h3 className="text-lg font-black text-[#245361] flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" />
                Select Jars per Weekday
              </h3>
              <p className="text-xs font-semibold text-slate-600">Set the specific quantity of jars to deliver on each day of the week. Days set to 0 will be skipped.</p>
              
              <div className="divide-y divide-border/60">
                {DAYS_OF_WEEK.map((day) => (
                  <div key={day.value} className="flex items-center justify-between py-4.5">
                    <span className="text-base font-black text-[#245361]">{day.label}</span>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleWeeklyQtyChange(day.value, -1)}
                        className="h-10 w-10 rounded-xl bg-secondary/15 font-black text-primary hover:bg-secondary/35 active:scale-95 transition flex items-center justify-center"
                      >
                        -
                      </button>
                      <span className="w-8 text-center text-lg font-black text-[#245361]">
                        {weeklyQtys[day.value]}
                      </span>
                      <button
                        onClick={() => handleWeeklyQtyChange(day.value, 1)}
                        className="h-10 w-10 rounded-xl bg-secondary/15 font-black text-primary hover:bg-secondary/35 active:scale-95 transition flex items-center justify-center"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : mode === 'INTERVAL' ? (
            <div className="space-y-6">
              <h3 className="text-lg font-black text-[#245361] flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" />
                Interval Scheduling
              </h3>
              <p className="text-xs font-semibold text-slate-600">Configure a repeat pattern (e.g. deliver X jars every Y days starting from today).</p>
              
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-[#245361]/80 mb-2">Delivery Interval (Days)</label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setIntervalDays(prev => Math.max(1, prev - 1))}
                      className="h-12 w-12 rounded-2xl bg-secondary/15 font-black text-primary hover:bg-secondary/35 active:scale-95 transition flex items-center justify-center"
                    >
                      -
                    </button>
                    <span className="w-16 text-center text-xl font-black text-[#245361]">
                      {intervalDays} days
                    </span>
                    <button
                      onClick={() => setIntervalDays(prev => Math.min(30, prev + 1))}
                      className="h-12 w-12 rounded-2xl bg-secondary/15 font-black text-primary hover:bg-secondary/35 active:scale-95 transition flex items-center justify-center"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-[#245361]/80 mb-2">Jar Quantity</label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setIntervalQty(prev => Math.max(1, prev - 1))}
                      className="h-12 w-12 rounded-2xl bg-secondary/15 font-black text-primary hover:bg-secondary/35 active:scale-95 transition flex items-center justify-center"
                    >
                      -
                    </button>
                    <span className="w-16 text-center text-xl font-black text-[#245361]">
                      {intervalQty} Jars
                    </span>
                    <button
                      onClick={() => setIntervalQty(prev => Math.min(10, prev + 1))}
                      className="h-12 w-12 rounded-2xl bg-secondary/15 font-black text-primary hover:bg-secondary/35 active:scale-95 transition flex items-center justify-center"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <h3 className="text-lg font-black text-[#245361] flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" />
                Custom Instructions
              </h3>
              <p className="text-xs font-semibold text-slate-600">Provide exact instructions for the delivery team (e.g. "Deliver 2 jars on the 1st and 15th of each month").</p>
              
              <div className="space-y-5">
                <div>
                  <textarea
                    value={customNotes}
                    onChange={(e) => setCustomNotes(e.target.value)}
                    placeholder="Enter your custom delivery instructions here..."
                    className="w-full min-h-[150px] p-4 text-sm font-medium rounded-2xl bg-secondary/10 border border-border/60 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all resize-y"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-border/80 flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-8 py-4 rounded-full bg-primary text-sm font-black text-primary-foreground shadow-lg hover:shadow-primary/20 active:scale-98 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {saving ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" /> Save Schedule
                </>
              )}
            </button>
          </div>
        </motion.div>

        {/* Info & Alerts Column */}
        <div className="space-y-6">
          <div className="clay-card bg-primary text-primary-foreground">
            <Sparkles className="h-8 w-8 text-white" />
            <h4 className="mt-4 text-xl font-black text-white">Dynamic Routing</h4>
            <p className="mt-2 text-xs font-semibold leading-6 text-white/80">
              The schedule rules you save here drive our daily route generator automatically. Keep your prepaid jar balance recharged to ensure zero missed deliveries.
            </p>
          </div>

          <div className="bg-[#BBDFF2]/20 border border-[#BBDFF2]/40 rounded-3xl p-5 flex gap-3.5 items-start">
            <AlertCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <h5 className="text-sm font-black text-[#245361]">Prepaid Balances</h5>
              <p className="text-xs text-slate-700 leading-5 mt-1">
                Each successfully confirmed delivery will deduct jars directly from your prepaid package balance.
              </p>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
