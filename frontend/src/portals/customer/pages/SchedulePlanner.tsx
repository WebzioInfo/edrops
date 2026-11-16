import { useState, useEffect } from 'react';
import { CalendarClock } from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '../../../components/LoadingSpinner';
import FullScheduleCalendar, { type Schedule, type ScheduleRule } from '../../../components/schedule/FullScheduleCalendar';

export default function SchedulePlanner() {
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadSchedule() {
      try {
        const data = await fetchWithAuth('/schedule');
        if (data) {
          setSchedule(data);
        }
      } catch {
        toast.error('Failed to load delivery schedule');
      } finally {
        setLoading(false);
      }
    }
    loadSchedule();
  }, []);

  const handleSaveSchedule = async (
    rules: ScheduleRule[],
    isActive: boolean,
    overrides?: Array<{ targetDate: string; quantity: number }>,
  ) => {
    setSaving(true);
    try {
      const updated = await fetchWithAuth('/schedule', {
        method: 'POST',
        body: JSON.stringify({
          isActive,
          rules,
          overrides,
        }),
      });
      if (updated) {
        setSchedule(updated);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to save schedule');
      throw err;
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSpinner fullPage label="Loading delivery calendar..." />;
  }

  return (
    <div className="min-h-[calc(100vh-72px)] bg-[#F8FAFC] pb-[100px] lg:pb-12 text-[#0F172A]">
      <div className="mx-auto max-w-[1200px] px-4 md:px-6 py-6 md:py-10 space-y-6">
        {/* HEADER */}
        <div>
          <h1 className="text-[20px] md:text-[32px] font-bold text-[#0F172A] mb-1 md:mb-2 flex items-center gap-2.5">
            <CalendarClock className="w-6 h-6 md:w-8 md:h-8 text-[#1E88E5]" />
            Delivery Schedule & Calendar
          </h1>
          <p className="text-[13px] md:text-[16px] text-[#64748B]">
            Set your recurring hydration cadence, configure gap days, and view scheduled delivery dates on the full calendar.
          </p>
        </div>

        {/* FULL CALENDAR & CADENCE PLANNER */}
        <FullScheduleCalendar
          schedule={schedule}
          onSaveSchedule={handleSaveSchedule}
          saving={saving}
        />
      </div>
    </div>
  );
}
