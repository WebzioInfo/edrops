import React, { useState, useRef } from 'react';
import { BarChart3, PieChart } from 'lucide-react';
import { ReportTooltip, type TooltipField } from './ReportTooltip';

export interface TimeSeriesDataPoint {
  date: string;       // YYYY-MM-DD or readable
  label: string;      // 23 Sep
  primaryValue: number;
  secondaryValue?: number;
  meta?: {
    count?: number;
    paid?: number;
    pending?: number;
    amount?: number;
  };
}

export interface BarTimeSeriesChartProps {
  title: string;
  subtitle?: string;
  data: TimeSeriesDataPoint[];
  primaryLabel: string;
  secondaryLabel?: string;
  primaryColor?: string;   // e.g. '#1677C8'
  secondaryColor?: string; // e.g. '#10B981'
  isCurrency?: boolean;
  emptyMessage?: string;
  height?: number; // default 260
}

export const BarTimeSeriesChart: React.FC<BarTimeSeriesChartProps> = ({
  title,
  subtitle,
  data,
  primaryLabel,
  secondaryLabel,
  primaryColor = '#1677C8',
  secondaryColor = '#10B981',
  isCurrency = false,
  emptyMessage = 'No activity recorded for this period',
  height = 260,
}) => {
  const [tooltipState, setTooltipState] = useState<{
    visible: boolean;
    x: number;
    y: number;
    title: string;
    subtitle?: string;
    fields: TooltipField[];
  }>({
    visible: false,
    x: 0,
    y: 0,
    title: '',
    fields: [],
  });

  const chartRef = useRef<HTMLDivElement>(null);

  const formatVal = (v: number) => {
    if (isCurrency) {
      if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
      if (v >= 1000) return `₹${(v / 1000).toFixed(1)}k`;
      return `₹${Math.round(v)}`;
    }
    return String(v);
  };

  const formatTooltipVal = (v: number) => {
    if (isCurrency) {
      return `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
    }
    return String(v);
  };

  const maxVal = Math.max(
    ...data.map((d) => Math.max(d.primaryValue, d.secondaryValue || 0)),
    1
  );

  const hasData = data.some((d) => d.primaryValue > 0 || (d.secondaryValue || 0) > 0);

  // Grid steps (4 horizontal intervals)
  const steps = [1, 0.75, 0.5, 0.25, 0];

  const handleMouseEnterBar = (
    e: React.MouseEvent,
    d: TimeSeriesDataPoint
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const fields: TooltipField[] = [
      {
        label: primaryLabel,
        value: formatTooltipVal(d.primaryValue),
        color: primaryColor,
      },
    ];

    if (secondaryLabel && d.secondaryValue !== undefined) {
      fields.push({
        label: secondaryLabel,
        value: formatTooltipVal(d.secondaryValue),
        color: secondaryColor,
      });
    }

    if (d.meta?.count !== undefined && isCurrency) {
      fields.push({
        label: 'Transactions',
        value: String(d.meta.count),
      });
    }

    if (d.meta?.pending !== undefined && isCurrency && d.meta.pending > 0) {
      fields.push({
        label: 'Pending',
        value: `₹${d.meta.pending.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`,
        color: '#F43F5E',
      });
    }

    setTooltipState({
      visible: true,
      x: rect.left + rect.width / 2,
      y: rect.top,
      title: d.label,
      subtitle: d.date,
      fields,
    });
  };

  const handleMouseLeave = () => {
    setTooltipState((prev) => ({ ...prev, visible: false }));
  };

  return (
    <div
      ref={chartRef}
      className="bg-white rounded-xl border border-[#E2E8F0] p-4 flex flex-col justify-between"
      style={{ minHeight: `${height + 70}px` }}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h3 className="text-sm font-bold text-[#16324F] flex items-center gap-2">
            {title}
          </h3>
          {subtitle && <p className="text-[11px] text-[#64748B] mt-0.5">{subtitle}</p>}
        </div>

        {/* Legend */}
        {hasData && (
          <div className="flex items-center gap-3 text-xs text-[#64748B]">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: primaryColor }} />
              <span className="text-[11px] font-medium">{primaryLabel}</span>
            </div>
            {secondaryLabel && (
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: secondaryColor }} />
                <span className="text-[11px] font-medium">{secondaryLabel}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {!hasData ? (
        <div className="flex-1 flex flex-col items-center justify-center py-12 text-[#94A3B8]">
          <BarChart3 className="w-10 h-10 mb-2 opacity-30 stroke-1" />
          <p className="text-xs font-medium text-[#64748B]">{emptyMessage}</p>
          <p className="text-[10px] text-[#94A3B8] mt-0.5">Try selecting a different date range</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col justify-end pt-2">
          {/* Chart Graphic Area */}
          <div className="relative flex items-end w-full" style={{ height: `${height}px` }}>
            {/* Background Grid Lines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pr-2">
              {steps.map((pct, idx) => (
                <div key={idx} className="w-full flex items-center gap-2">
                  <span className="text-[10px] font-mono text-[#94A3B8] w-12 text-right shrink-0">
                    {formatVal(maxVal * pct)}
                  </span>
                  <div className="flex-1 border-b border-[#F1F5F9]" />
                </div>
              ))}
            </div>

            {/* Bars Container */}
            <div className="relative z-10 flex items-end justify-between w-full h-full pl-14 pr-2 gap-1.5 sm:gap-2">
              {data.map((d, idx) => {
                const primaryPct = maxVal > 0 ? (d.primaryValue / maxVal) * 100 : 0;
                const secondaryPct =
                  d.secondaryValue !== undefined && maxVal > 0
                    ? (d.secondaryValue / maxVal) * 100
                    : 0;

                return (
                  <div
                    key={idx}
                    className="flex-1 h-full flex flex-col justify-end items-center group cursor-pointer"
                    onMouseEnter={(e) => handleMouseEnterBar(e, d)}
                    onMouseLeave={handleMouseLeave}
                  >
                    <div className="w-full flex items-end justify-center gap-0.5 sm:gap-1 h-full pb-6">
                      {/* Primary Bar */}
                      <div
                        className="w-full max-w-[16px] rounded-t-sm transition-all duration-200 group-hover:brightness-110"
                        style={{
                          height: `${Math.max(primaryPct, primaryPct > 0 ? 3 : 0)}%`,
                          backgroundColor: primaryColor,
                        }}
                      />

                      {/* Secondary Bar if exists */}
                      {secondaryLabel && (
                        <div
                          className="w-full max-w-[16px] rounded-t-sm transition-all duration-200 group-hover:brightness-110"
                          style={{
                            height: `${Math.max(secondaryPct, secondaryPct > 0 ? 3 : 0)}%`,
                            backgroundColor: secondaryColor,
                          }}
                        />
                      )}
                    </div>

                    {/* X-axis Label */}
                    <span className="absolute bottom-0 text-[10px] text-[#64748B] font-medium group-hover:text-[#16324F] transition-colors truncate max-w-[40px] text-center">
                      {d.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Floating Tooltip */}
      <ReportTooltip
        visible={tooltipState.visible}
        x={tooltipState.x}
        y={tooltipState.y}
        title={tooltipState.title}
        subtitle={tooltipState.subtitle}
        fields={tooltipState.fields}
      />
    </div>
  );
};

export interface DistributionItem {
  label: string;
  count: number;
  value?: number;
  color: string;
}

export interface StatusDistributionChartProps {
  title: string;
  subtitle?: string;
  items: DistributionItem[];
  emptyMessage?: string;
}

export const StatusDistributionChart: React.FC<StatusDistributionChartProps> = ({
  title,
  subtitle,
  items,
  emptyMessage = 'No status data available',
}) => {
  const totalCount = items.reduce((s, it) => s + it.count, 0);

  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-bold text-[#16324F]">{title}</h3>
          <span className="text-xs font-semibold text-[#64748B]">{totalCount} total</span>
        </div>
        {subtitle && <p className="text-[11px] text-[#64748B] mb-3">{subtitle}</p>}

        {totalCount === 0 ? (
          <div className="py-8 text-center text-[#94A3B8]">
            <PieChart className="w-8 h-8 mx-auto mb-2 opacity-30 stroke-1" />
            <p className="text-xs">{emptyMessage}</p>
          </div>
        ) : (
          <div className="space-y-3 pt-2">
            {/* Segmented Progress Bar */}
            <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
              {items
                .filter((it) => it.count > 0)
                .map((it, idx) => {
                  const pct = totalCount > 0 ? (it.count / totalCount) * 100 : 0;
                  return (
                    <div
                      key={idx}
                      className="h-full transition-all duration-300 first:rounded-l-full last:rounded-r-full"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: it.color,
                      }}
                      title={`${it.label}: ${it.count} (${pct.toFixed(1)}%)`}
                    />
                  );
                })}
            </div>

            {/* List breakdown */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              {items.map((it, idx) => {
                const pct = totalCount > 0 ? (it.count / totalCount) * 100 : 0;
                return (
                  <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-[#F1F5F9]">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: it.color }}
                      />
                      <span className="text-xs font-medium text-[#374151] truncate">{it.label}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-bold text-[#16324F]">{it.count}</span>
                      <span className="text-[10px] text-[#94A3B8] ml-1">({pct.toFixed(0)}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
