import React from 'react';
import { Award, TrendingUp } from 'lucide-react';

export interface InsightItem {
  id: string;
  category: 'orders' | 'payments' | 'suppliers';
  title: string;
  entityName: string;
  value: string;
  subtext?: string;
  badge?: string;
  type?: 'positive' | 'warning' | 'info' | 'neutral';
  icon?: React.ComponentType<{ className?: string }>;
}

export interface InsightCardProps {
  insights: InsightItem[];
  title?: string;
  subtitle?: string;
  className?: string;
}

const TYPE_CONFIG = {
  positive: {
    bg: 'bg-emerald-50/70',
    border: 'border-emerald-200',
    badge: 'bg-emerald-100 text-emerald-800',
    iconBg: 'bg-emerald-500 text-white',
    valueColor: 'text-emerald-700',
  },
  warning: {
    bg: 'bg-amber-50/70',
    border: 'border-amber-200',
    badge: 'bg-amber-100 text-amber-800',
    iconBg: 'bg-amber-500 text-white',
    valueColor: 'text-amber-800',
  },
  info: {
    bg: 'bg-blue-50/70',
    border: 'border-blue-200',
    badge: 'bg-blue-100 text-blue-800',
    iconBg: 'bg-[#1677C8] text-white',
    valueColor: 'text-[#1677C8]',
  },
  neutral: {
    bg: 'bg-slate-50/70',
    border: 'border-slate-200',
    badge: 'bg-slate-100 text-slate-700',
    iconBg: 'bg-slate-600 text-white',
    valueColor: 'text-[#16324F]',
  },
};

export const InsightCard: React.FC<InsightCardProps> = ({
  insights,
  title = 'Performance & Key Insights',
  subtitle = 'Dynamic business highlights calculated from live transactions in this period',
  className = '',
}) => {
  if (insights.length === 0) return null;

  return (
    <div className={`bg-white rounded-xl border border-[#E2E8F0] p-4 sm:p-5 ${className}`}>
      <div className="flex items-center justify-between mb-3.5">
        <div>
          <h3 className="text-sm font-bold text-[#16324F] flex items-center gap-2">
            <Award className="w-4 h-4 text-[#1677C8]" />
            {title}
          </h3>
          {subtitle && <p className="text-[11px] text-[#64748B] mt-0.5">{subtitle}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {insights.map((item) => {
          const cfg = TYPE_CONFIG[item.type || 'info'];
          const IconComponent = item.icon || TrendingUp;

          return (
            <div
              key={item.id}
              className={`rounded-xl border ${cfg.border} ${cfg.bg} p-3.5 flex flex-col justify-between transition-all hover:shadow-xs`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                    {item.title}
                  </span>
                  {item.badge && (
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.badge}`}>
                      {item.badge}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2.5 my-1">
                  <div className={`w-7 h-7 rounded-lg ${cfg.iconBg} flex items-center justify-center shrink-0 shadow-2xs`}>
                    <IconComponent className="w-3.5 h-3.5" />
                  </div>
                  <p className="text-sm font-bold text-[#16324F] truncate" title={item.entityName}>
                    {item.entityName}
                  </p>
                </div>
              </div>

              <div className="mt-2 pt-2 border-t border-black/5 flex items-baseline justify-between">
                <span className="text-[11px] text-[#64748B]">{item.subtext}</span>
                <span className={`text-xs font-bold font-mono ${cfg.valueColor}`}>
                  {item.value}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
