import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface ReportKpiCardProps {
  label: string;
  value: string | number;
  sub?: string | React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  colorVariant?: 'blue' | 'emerald' | 'amber' | 'rose' | 'violet' | 'sky' | 'slate';
  trend?: 'up' | 'down' | 'neutral';
  trendLabel?: string;
  className?: string;
}

const COLOR_MAP: Record<NonNullable<ReportKpiCardProps['colorVariant']>, { bg: string; text: string; ring: string }> = {
  blue: { bg: 'bg-[#1677C8]/10', text: 'text-[#1677C8]', ring: 'ring-[#1677C8]/20' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', ring: 'ring-emerald-200' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-600', ring: 'ring-amber-200' },
  rose: { bg: 'bg-rose-50', text: 'text-rose-600', ring: 'ring-rose-200' },
  violet: { bg: 'bg-violet-50', text: 'text-violet-600', ring: 'ring-violet-200' },
  sky: { bg: 'bg-sky-50', text: 'text-sky-600', ring: 'ring-sky-200' },
  slate: { bg: 'bg-slate-100', text: 'text-slate-600', ring: 'ring-slate-200' },
};

export const ReportKpiCard: React.FC<ReportKpiCardProps> = ({
  label,
  value,
  sub,
  icon: Icon,
  colorVariant = 'blue',
  trend,
  trendLabel,
  className = '',
}) => {
  const color = COLOR_MAP[colorVariant] || COLOR_MAP.blue;

  return (
    <div className={`bg-white rounded-xl border border-[#E2E8F0] p-4 flex flex-col justify-between hover:border-[#CBD5E1] transition-shadow shadow-2xs ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider truncate mb-1">
            {label}
          </p>
          <p className="text-xl sm:text-2xl font-bold text-[#16324F] tracking-tight leading-tight truncate">
            {value}
          </p>
        </div>
        <div className={`shrink-0 flex h-9 w-9 items-center justify-center rounded-xl ${color.bg} ${color.text} ring-1 ${color.ring}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>

      {(sub || trend) && (
        <div className="mt-2.5 pt-2 border-t border-[#F8FAFC] flex items-center justify-between text-[11px] gap-2">
          {sub && <div className="text-[#64748B] truncate font-medium">{sub}</div>}
          {trend && (
            <div
              className={`inline-flex items-center gap-1 font-semibold shrink-0 ${
                trend === 'up'
                  ? 'text-emerald-600'
                  : trend === 'down'
                  ? 'text-rose-600'
                  : 'text-slate-500'
              }`}
            >
              {trend === 'up' && <TrendingUp className="w-3.5 h-3.5" />}
              {trend === 'down' && <TrendingDown className="w-3.5 h-3.5" />}
              {trend === 'neutral' && <Minus className="w-3.5 h-3.5" />}
              {trendLabel && <span>{trendLabel}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
