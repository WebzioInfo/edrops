import React from 'react';

export interface TooltipField {
  label: string;
  value: string | number;
  color?: string; // hex or tailwind class
  isCurrency?: boolean;
}

export interface ReportTooltipProps {
  visible: boolean;
  x: number;
  y: number;
  title: string;
  subtitle?: string;
  fields: TooltipField[];
}

export const ReportTooltip: React.FC<ReportTooltipProps> = ({
  visible,
  x,
  y,
  title,
  subtitle,
  fields,
}) => {
  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        left: `${x}px`,
        top: `${y}px`,
        transform: 'translate(-50%, -100%) translateY(-12px)',
        pointerEvents: 'none',
        zIndex: 9999,
      }}
      className="bg-[#1E293B] text-white rounded-lg px-3 py-2 shadow-xl border border-slate-700/60 min-w-[140px] max-w-[220px] transition-all duration-75 text-xs animate-in fade-in zoom-in-95"
    >
      <div className="border-b border-slate-700 pb-1.5 mb-1.5">
        <p className="font-bold text-white text-[11px] leading-tight truncate">{title}</p>
        {subtitle && <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{subtitle}</p>}
      </div>

      <div className="space-y-1">
        {fields.map((f, i) => (
          <div key={i} className="flex items-center justify-between gap-3 text-[11px]">
            <span className="text-slate-300 flex items-center gap-1.5">
              {f.color && (
                <span
                  className="w-2 h-2 rounded-full inline-block shrink-0"
                  style={{ backgroundColor: f.color }}
                />
              )}
              {f.label}
            </span>
            <span className="font-semibold text-white font-mono shrink-0">
              {f.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
