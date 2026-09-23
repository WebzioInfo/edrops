import React, { useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export interface DistributorTopbarProps {
  title: string | React.ReactNode;
  subtitle?: string | React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  iconVariant?: 'blue' | 'amber' | 'emerald' | 'slate' | 'rose' | 'indigo';
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  backLink?: { label: string; to: string };
  secondaryRow?: React.ReactNode;
  className?: string;
}

const ICON_VARIANTS: Record<string, string> = {
  blue: 'bg-[#1677C8]/10 text-[#1677C8]',
  amber: 'bg-amber-500/10 text-amber-600',
  emerald: 'bg-emerald-500/10 text-emerald-600',
  slate: 'bg-slate-100 text-slate-700',
  rose: 'bg-rose-500/10 text-rose-600',
  indigo: 'bg-indigo-500/10 text-indigo-600',
};

const TopbarContent: React.FC<DistributorTopbarProps> = ({
  title,
  subtitle,
  icon: Icon,
  iconVariant = 'blue',
  badge,
  actions,
  backLink,
  secondaryRow,
  className = '',
}) => {
  return (
    <header className={`w-full bg-white border-b border-[#E2E8F0] px-4 sm:px-6 shrink-0 select-none ${className}`}>
      {/* Primary Header Row: min-h-[64px] matching brand header with responsive expansion */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 min-h-[64px]">
        {/* Left Side: Back button (if any) + Icon + Title + Subtitle */}
        <div className="flex items-center gap-3 min-w-0">
          {backLink && (
            <Link
              to={backLink.to}
              className="p-1.5 -ml-1 text-slate-500 hover:text-[#1677C8] hover:bg-slate-100 rounded-lg transition-colors shrink-0"
              title={backLink.label}
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
          )}

          {Icon && (
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl shrink-0 font-bold ${
                ICON_VARIANTS[iconVariant] || ICON_VARIANTS.blue
              }`}
            >
              <Icon className="w-5 h-5" />
            </div>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold text-[#16324F] leading-tight tracking-tight">
                {title}
              </h1>
              {badge && <div className="shrink-0">{badge}</div>}
            </div>
            {subtitle && (
              <div className="text-xs text-[#64748B] leading-normal mt-1">
                {subtitle}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Page-Specific Actions */}
        {actions && (
          <div className="flex items-center sm:justify-end gap-2 sm:gap-2.5 shrink-0">
            {actions}
          </div>
        )}
      </div>

      {/* Optional Secondary Row (e.g. Tabs in Reports) */}
      {secondaryRow && (
        <div className="pb-3 border-t border-[#F1F5F9] pt-2.5">
          {secondaryRow}
        </div>
      )}
    </header>
  );
};

export const DistributorTopbar: React.FC<DistributorTopbarProps> = (props) => {
  const [mountNode, setMountNode] = useState<HTMLElement | null>(() => {
    if (typeof document !== 'undefined') {
      return document.getElementById('distributor-topbar-mount');
    }
    return null;
  });

  useLayoutEffect(() => {
    if (!mountNode) {
      const node = document.getElementById('distributor-topbar-mount');
      if (node) setMountNode(node);
    }
  }, [mountNode]);

  const content = <TopbarContent {...props} />;

  if (mountNode) {
    return createPortal(content, mountNode);
  }

  // Fallback in case mount node isn't present
  return content;
};

export default DistributorTopbar;
