import React from 'react';

export interface ReportSectionProps {
  title: string;
  subtitle?: string | React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const ReportSection: React.FC<ReportSectionProps> = ({
  title,
  subtitle,
  icon: Icon,
  actions,
  children,
  className = '',
}) => {
  return (
    <section className={`bg-white rounded-xl border border-[#E2E8F0] overflow-hidden ${className}`}>
      <div className="px-4 py-3.5 sm:px-5 border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3 bg-[#F8FAFC]">
        <div className="flex items-center gap-2.5">
          {Icon && (
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1677C8]/10 text-[#1677C8] shrink-0">
              <Icon className="w-4 h-4" />
            </div>
          )}
          <div>
            <h3 className="text-sm font-bold text-[#16324F] leading-tight">{title}</h3>
            {subtitle && <p className="text-[11px] text-[#64748B] mt-0.5">{subtitle}</p>}
          </div>
        </div>

        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>

      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
};
