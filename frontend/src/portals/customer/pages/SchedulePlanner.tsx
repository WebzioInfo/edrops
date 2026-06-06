import { useState, useEffect } from 'react';
import { CalendarDays, Save, Sparkles, Minus, Plus, Droplets, Calendar, CalendarClock, Power, CheckCircle2 } from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';
import { toast } from 'react-hot-toast';

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

  // Weekly local state quantities
  const [weeklyQtys, setWeeklyQtys] = useState<Record<number, number>>({
    0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0
  });

  useEffect(() => {
    async function loadSchedule() {
      try {
        const data = await fetchWithAuth('/schedule');
        if (data) {
          setSchedule(data);
          // Parse rules into state
          const rules: ScheduleRule[] = data.rules || [];
          const qtys: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
          rules.forEach(r => {
            // We ignore non-weekly rules because of the business decision to move strictly to WEEKLY
            if (r.type === 'WEEKLY' && r.dayOfWeek !== undefined && r.dayOfWeek !== null) {
              qtys[r.dayOfWeek] = r.quantity || 0;
            }
          });
          setWeeklyQtys(qtys);
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
    
    try {
      const updated = await fetchWithAuth('/schedule', {
        method: 'POST',
        body: JSON.stringify({
          isActive: nextActive,
          rules: schedule.rules // Keep backend rules intact for this toggle
        })
      });
      setSchedule(updated);
      toast.success(`Schedule ${nextActive ? 'activated' : 'paused'}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update schedule status');
    }
  };

  // Calculations
  const weeklyTotal = Object.values(weeklyQtys).reduce((a, b) => a + b, 0);
  const monthlyEstimate = weeklyTotal * 4;
  const activeDays = Object.values(weeklyQtys).filter(qty => qty > 0).length;

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="h-10 w-10 border-4 border-[#E2E8F0] border-t-[#1E88E5] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-72px)] bg-[#F8FAFC] pb-[100px] lg:pb-12 text-[#0F172A]">
      <div className="mx-auto max-w-[1200px] px-4 md:px-6 py-6 md:py-10">
        
        {/* HEADER */}
        <div className="mb-5 md:mb-8 flex flex-col sm:flex-row sm:items-start justify-between gap-3 md:gap-4">
          <div>
            <h1 className="text-[20px] md:text-[32px] font-bold text-[#0F172A] mb-1 md:mb-2">Delivery Schedule</h1>
            <p className="text-[13px] md:text-[16px] text-[#64748B]">Manage your automated weekly water deliveries.</p>
          </div>
          
          <div className="flex flex-col gap-2 md:gap-3 sm:min-w-[200px]">
            {schedule && (
              <button
                onClick={handleToggleActive}
                className={`flex items-center justify-center gap-2 px-4 py-2.5 md:py-2.5 rounded-[10px] md:rounded-[12px] font-semibold text-[13px] md:text-[14px] shadow-sm transition-colors border ${
                  schedule.isActive 
                    ? 'bg-white border-[#E2E8F0] text-[#0F172A] hover:bg-[#F8FAFC]' 
                    : 'bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100'
                }`}
              >
                <Power className={`w-3.5 h-3.5 md:w-4 md:h-4 ${schedule.isActive ? 'text-[#1E88E5]' : 'text-orange-600'}`} />
                {schedule.isActive ? 'Schedule Active' : 'Schedule Paused'}
              </button>
            )}
            
            {/* MOBILE SAVE BUTTON (Appears right below active status) */}
            <button
              onClick={handleSave}
              disabled={saving || weeklyTotal === 0}
              className="lg:hidden w-full h-[42px] md:h-[48px] rounded-[10px] md:rounded-[12px] bg-[#1E88E5] text-white font-semibold text-[13px] md:text-[15px] shadow-sm active:bg-[#1976D2] transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:active:bg-[#1E88E5]"
            >
              {saving ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Save Schedule
                </>
              )}
            </button>
          </div>
        </div>

        {/* 2-COLUMN LAYOUT */}
        <div className="flex flex-col lg:flex-row gap-6 md:gap-8">
          
          {/* LEFT COLUMN (70%) */}
          <div className="w-full lg:w-[65%] xl:w-[70%] space-y-6">
            
            {/* WEEKLY SCHEDULE CARD */}
            <div className="bg-white rounded-[16px] border border-[#E2E8F0] shadow-sm overflow-hidden">
              <div className="px-4 md:px-5 py-3 md:py-4 border-b border-[#E2E8F0] bg-white flex items-center justify-between">
                <h2 className="text-[14px] md:text-[16px] font-bold text-[#0F172A] flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 md:w-5 md:h-5 text-[#1E88E5]" />
                  Weekly Deliveries
                </h2>
                {activeDays > 0 && (
                  <span className="text-[11px] md:text-[12px] font-bold text-[#1E88E5] bg-blue-50 px-2 md:px-2.5 py-1 rounded-[6px]">
                    {activeDays} Days Active
                  </span>
                )}
              </div>
              
              <div className="divide-y divide-[#E2E8F0]">
                {DAYS_OF_WEEK.map((day) => {
                  const qty = weeklyQtys[day.value];
                  const isActive = qty > 0;
                  
                  return (
                    <div key={day.value} className={`px-4 md:px-5 py-3 md:py-4 flex items-center justify-between transition-colors ${isActive ? 'bg-[#F8FAFC]/50' : 'bg-white'}`}>
                      {/* Day Info */}
                      <div className="flex flex-col">
                        <span className={`text-[14px] md:text-[16px] font-semibold ${isActive ? 'text-[#0F172A]' : 'text-[#64748B]'}`}>
                          {day.label}
                        </span>
                        <span className="text-[11px] md:text-[13px] font-medium text-[#94A3B8] mt-0.5">
                          {isActive ? (
                            <span className="text-[#1E88E5] flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 md:w-3.5 md:h-3.5" /> Delivery Set</span>
                          ) : 'No Delivery'}
                        </span>
                      </div>
                      
                      {/* Quantity Controls */}
                      <div className="flex items-center gap-3 md:gap-4">
                        <span className="text-[13px] md:text-[14px] font-bold text-[#0F172A] min-w-[48px] text-right hidden sm:block">
                          {qty} {qty === 1 ? 'Jar' : 'Jars'}
                        </span>
                        
                        <div className="flex items-center bg-white border border-[#E2E8F0] rounded-[10px] md:rounded-[12px] shadow-sm p-1">
                          <button
                            onClick={() => handleWeeklyQtyChange(day.value, -1)}
                            disabled={qty === 0}
                            className="w-8 h-8 md:w-9 md:h-9 rounded-[6px] md:rounded-[8px] flex items-center justify-center text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A] disabled:opacity-30 disabled:hover:bg-transparent active:bg-[#E2E8F0] transition-colors"
                          >
                            <Minus className="w-4 h-4 md:w-5 md:h-5" />
                          </button>
                          
                          <span className="w-8 md:w-10 text-center font-bold text-[14px] md:text-[16px] text-[#0F172A]">
                            {qty}
                          </span>
                          
                          <button
                            onClick={() => handleWeeklyQtyChange(day.value, 1)}
                            disabled={qty >= 10}
                            className="w-8 h-8 md:w-9 md:h-9 rounded-[6px] md:rounded-[8px] flex items-center justify-center text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A] disabled:opacity-30 disabled:hover:bg-transparent active:bg-[#E2E8F0] transition-colors"
                          >
                            <Plus className="w-4 h-4 md:w-5 md:h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* EMPTY STATE WARNING */}
            {weeklyTotal === 0 && (
              <div className="bg-white rounded-[16px] border border-dashed border-[#E2E8F0] p-6 text-center">
                <div className="w-12 h-12 bg-[#F8FAFC] rounded-full flex items-center justify-center mx-auto mb-3">
                  <CalendarClock className="w-6 h-6 text-[#94A3B8]" />
                </div>
                <h3 className="text-[16px] font-bold text-[#0F172A] mb-1">No deliveries scheduled</h3>
                <p className="text-[13px] text-[#64748B] max-w-sm mx-auto">Use the controls above to configure your weekly water deliveries. Your schedule will repeat every week automatically.</p>
              </div>
            )}
            
          </div>

          {/* RIGHT COLUMN (30%) */}
          <div className="w-full lg:w-[35%] xl:w-[30%] space-y-6 relative">
            
            {/* HYDRATION SUMMARY */}
            <div className="bg-white rounded-[16px] border border-[#E2E8F0] shadow-sm p-5">
              <h3 className="text-[14px] font-bold text-[#0F172A] uppercase tracking-wider mb-5">Hydration Summary</h3>
              
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                    <Droplets className="w-5 h-5 text-[#1E88E5]" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[12px] font-semibold text-[#64748B] uppercase tracking-wide">Weekly Total</p>
                    <p className="text-[18px] font-bold text-[#0F172A]">{weeklyTotal} Jars</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center shrink-0">
                    <Calendar className="w-5 h-5 text-indigo-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[12px] font-semibold text-[#64748B] uppercase tracking-wide">Monthly Est.</p>
                    <p className="text-[18px] font-bold text-[#0F172A]">{monthlyEstimate} Jars</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[12px] font-semibold text-[#64748B] uppercase tracking-wide">Active Days</p>
                    <p className="text-[18px] font-bold text-[#0F172A]">{activeDays} / 7 Days</p>
                  </div>
                </div>
              </div>
            </div>

            {/* SMART INSIGHTS */}
            {weeklyTotal > 0 && (
              <div className="bg-[#1E88E5]/5 border border-[#1E88E5]/20 rounded-[16px] p-5">
                <div className="flex gap-3">
                  <Sparkles className="w-5 h-5 text-[#1E88E5] shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-[14px] font-bold text-[#0F172A] mb-1">Smart Insight</h4>
                    <p className="text-[13px] text-[#334155] leading-relaxed">
                      You are scheduled to receive <span className="font-bold text-[#1E88E5]">{weeklyTotal} jars</span> every week across {activeDays} days. This ensures a steady supply of fresh water without storing excess inventory.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* DESKTOP SAVE CARD (Hidden on Mobile) */}
            <div className="hidden lg:block sticky top-24 bg-white rounded-[16px] border border-[#E2E8F0] shadow-sm p-5">
              <h3 className="text-[14px] font-bold text-[#0F172A] mb-2">Save Changes</h3>
              <p className="text-[12px] text-[#64748B] mb-5">Your schedule updates will apply to all future deliveries.</p>
              
              <button
                onClick={handleSave}
                disabled={saving || weeklyTotal === 0}
                className="w-full h-[48px] rounded-[12px] bg-[#1E88E5] text-white font-semibold text-[14px] shadow-sm hover:bg-[#1976D2] transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:bg-[#1E88E5] cursor-pointer"
              >
                {saving ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Schedule
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
