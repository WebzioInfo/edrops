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
  icon: Icon,
  colorVariant = 'blue',
  trend,
  trendLabel,
  className = '',
}) => {
  const color = COLOR_MAP[colorVariant] || COLOR_MAP.blue;

  return (
    <div className={`bg-white rounded-xl border border-[#E2E8F0] p-3 sm:p-3.5 flex flex-col justify-center hover:border-[#CBD5E1] transition-shadow shadow-2xs ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] sm:text-[11px] font-bold text-[#64748B] uppercase tracking-wider truncate mb-1">
            {label}
          </p>
          <p className="text-lg sm:text-2xl font-extrabold text-[#16324F] tracking-tight leading-tight truncate">
            {value}
          </p>
        </div>
        <div className={`shrink-0 flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg sm:rounded-xl ${color.bg} ${color.text} ring-1 ${color.ring}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>

      {trend && (
        <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px] gap-2">
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
        </div>
      )}
    </div>
  );
};
