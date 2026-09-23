import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, Check } from 'lucide-react';

export type DatePreset = 'today' | 'yesterday' | '7d' | '30d' | 'this_month' | 'prev_month' | 'custom';

export interface DateRange {
  preset: DatePreset;
  start: Date;
  end: Date;
  label: string;
}

export interface ReportDateFilterProps {
  datePreset: DatePreset;
  customStart: string; // YYYY-MM-DD
  customEnd: string;   // YYYY-MM-DD
  onChangePreset: (preset: DatePreset) => void;
  onChangeCustomRange: (start: string, end: string) => void;
  className?: string;
}

export const PRESET_CONFIG: Record<DatePreset, { label: string; description: string }> = {
  today: { label: 'Today', description: 'Since 12:00 AM today' },
  yesterday: { label: 'Yesterday', description: 'Full previous day' },
  '7d': { label: 'Last 7 Days', description: 'Past 7 consecutive days' },
  '30d': { label: 'Last 30 Days', description: 'Past 30 consecutive days' },
  this_month: { label: 'This Month', description: '1st of current month to today' },
  prev_month: { label: 'Previous Month', description: 'Full previous calendar month' },
  custom: { label: 'Custom Range', description: 'Choose specific start and end dates' },
};

/**
 * Calculates start and end Date objects in the user's local timezone.
 */
export function calculateDateRange(preset: DatePreset, customStartStr?: string, customEndStr?: string): { start: Date; end: Date; label: string } {
  const now = new Date();
  const startOfDay = (d: Date) => {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  };
  const endOfDay = (d: Date) => {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  };

  const formatShort = (d: Date) =>
    d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  if (preset === 'today') {
    const s = startOfDay(now);
    const e = endOfDay(now);
    return { start: s, end: e, label: `Today (${formatShort(s)})` };
  }

  if (preset === 'yesterday') {
    const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const s = startOfDay(y);
    const e = endOfDay(y);
    return { start: s, end: e, label: `Yesterday (${formatShort(s)})` };
  }

  if (preset === '7d') {
    const s = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    const start = startOfDay(s);
    const end = endOfDay(now);
    return { start, end, label: `Last 7 Days (${formatShort(start)} – ${formatShort(end)})` };
  }

  if (preset === '30d') {
    const s = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
    const start = startOfDay(s);
    const end = endOfDay(now);
    return { start, end, label: `Last 30 Days (${formatShort(start)} – ${formatShort(end)})` };
  }

  if (preset === 'this_month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = endOfDay(now);
    return { start, end, label: `This Month (${formatShort(start)} – ${formatShort(end)})` };
  }

  if (preset === 'prev_month') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
    // Day 0 of current month is the last day of previous month
    const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    return { start, end, label: `Previous Month (${formatShort(start)} – ${formatShort(end)})` };
  }

  if (preset === 'custom' && customStartStr && customEndStr) {
    const [sy, sm, sd] = customStartStr.split('-').map(Number);
    const [ey, em, ed] = customEndStr.split('-').map(Number);
    if (sy && sm && sd && ey && em && ed) {
      const s = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
      const e = new Date(ey, em - 1, ed, 23, 59, 59, 999);
      if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
        return { start: s, end: e, label: `Custom (${formatShort(s)} – ${formatShort(e)})` };
      }
    }
  }

  // Fallback to Last 7 Days
  const s = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
  const start = startOfDay(s);
  const end = endOfDay(now);
  return { start, end, label: `Last 7 Days (${formatShort(start)} – ${formatShort(end)})` };
}

export function isDateWithinRange(dateInput: string | Date | null | undefined, range: { start: Date; end: Date }): boolean {
  if (!dateInput) return false;
  const t = typeof dateInput === 'string' ? new Date(dateInput).getTime() : dateInput.getTime();
  if (isNaN(t)) return false;
  return t >= range.start.getTime() && t <= range.end.getTime();
}

export const ReportDateFilter: React.FC<ReportDateFilterProps> = ({
  datePreset,
  customStart,
  customEnd,
  onChangePreset,
  onChangeCustomRange,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [localStart, setLocalStart] = useState(customStart);
  const [localEnd, setLocalEnd] = useState(customEnd);
  const [customError, setCustomError] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalStart(customStart);
    setLocalEnd(customEnd);
  }, [customStart, customEnd]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const currentLabel = PRESET_CONFIG[datePreset]?.label || 'Select Date Range';

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!localStart || !localEnd) {
      setCustomError('Both start and end dates are required');
      return;
    }
    if (new Date(localStart) > new Date(localEnd)) {
      setCustomError('Start date cannot be after end date');
      return;
    }
    setCustomError('');
    onChangeCustomRange(localStart, localEnd);
    onChangePreset('custom');
    setIsOpen(false);
  };

  return (
    <div className={`relative inline-block ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between gap-2.5 px-3 py-1.5 text-xs font-semibold text-[#16324F] bg-white border border-[#CBD5E1] rounded-lg hover:border-[#1677C8] hover:bg-slate-50/90 transition-all shadow-2xs whitespace-nowrap cursor-pointer select-none"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-1.5">
          <div className="flex h-5 w-5 items-center justify-center rounded-md bg-[#1677C8]/10 text-[#1677C8] shrink-0">
            <Calendar className="w-3.5 h-3.5" />
          </div>
          <span className="text-[#64748B] font-medium hidden xs:inline">Period:</span>
          <span className="font-semibold text-[#16324F]">{currentLabel}</span>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-[#94A3B8] transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1.5 z-50 w-72 sm:w-80 bg-white rounded-xl border border-[#E2E8F0] shadow-xl p-2.5 animate-in fade-in zoom-in-95 duration-100">
          <div className="px-2 py-1.5 border-b border-[#F1F5F9] mb-1.5 flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">Select Date Period</p>
            <span className="text-[10px] text-[#94A3B8] font-medium">Local Timezone</span>
          </div>

          <div className="space-y-0.5 max-h-56 overflow-y-auto dropdown-scroll pr-1">
            {(Object.keys(PRESET_CONFIG) as DatePreset[]).map((key) => {
              const item = PRESET_CONFIG[key];
              const isSelected = datePreset === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    if (key !== 'custom') {
                      onChangePreset(key);
                      setIsOpen(false);
                    } else {
                      onChangePreset('custom');
                    }
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg transition-colors text-left cursor-pointer ${
                    isSelected
                      ? 'bg-[#1677C8]/10 text-[#1677C8] font-semibold'
                      : 'text-[#374151] hover:bg-slate-50'
                  }`}
                >
                  <div>
                    <span className="block">{item.label}</span>
                    <span className="block text-[10px] text-[#94A3B8] font-normal">{item.description}</span>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-[#1677C8] shrink-0 ml-2" />}
                </button>
              );
            })}
          </div>

          {/* Custom Date Range Picker form */}
          {datePreset === 'custom' && (
            <form onSubmit={handleApplyCustom} className="mt-2 pt-2 border-t border-[#E2E8F0] space-y-2 px-1">
              <div>
                <label className="block text-[10px] font-semibold text-[#64748B] mb-0.5">Start Date</label>
                <input
                  type="date"
                  value={localStart}
                  max={localEnd || undefined}
                  onChange={(e) => {
                    setLocalStart(e.target.value);
                    setCustomError('');
                  }}
                  className="w-full text-xs px-2.5 py-1.5 border border-[#E2E8F0] rounded-lg text-[#16324F] focus:outline-none focus:border-[#1677C8] focus:ring-1 focus:ring-[#1677C8]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[#64748B] mb-0.5">End Date</label>
                <input
                  type="date"
                  value={localEnd}
                  min={localStart || undefined}
                  onChange={(e) => {
                    setLocalEnd(e.target.value);
                    setCustomError('');
                  }}
                  className="w-full text-xs px-2.5 py-1.5 border border-[#E2E8F0] rounded-lg text-[#16324F] focus:outline-none focus:border-[#1677C8] focus:ring-1 focus:ring-[#1677C8]"
                />
              </div>

              {customError && (
                <p className="text-[11px] text-rose-600 font-medium">{customError}</p>
              )}

              <div className="flex items-center gap-1.5 pt-1">
                <button
                  type="submit"
                  className="flex-1 py-1.5 text-xs font-semibold text-white bg-[#1677C8] hover:bg-[#125ea0] rounded-lg transition-colors cursor-pointer text-center"
                >
                  Apply Range
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-2.5 py-1.5 text-xs font-medium text-[#64748B] hover:text-[#16324F] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
};
