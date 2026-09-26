import React, { useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export interface AdminTopbarProps {
  title: string | React.ReactNode;
  subtitle?: string | React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  iconVariant?: 'blue' | 'amber' | 'emerald' | 'slate' | 'rose' | 'indigo' | 'cyan';
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
  cyan: 'bg-cyan-500/10 text-cyan-600',
};

const TopbarContent: React.FC<AdminTopbarProps> = ({
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
    <header className={`w-full bg-white border-b border-[#E2E8F0] px-3.5 sm:px-6 shrink-0 select-none z-10 ${className}`}>
      {/* Primary Header Row: compact on mobile, 56px on desktop */}
      <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 py-2 sm:py-2.5 min-h-[48px] sm:min-h-[56px] max-w-[1600px] mx-auto">
        {/* Left Side: Back button (if any) + Icon (desktop/tablet) + Title + Subtitle */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
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
              className={`hidden sm:flex h-9 w-9 items-center justify-center rounded-xl shrink-0 font-bold ${
                ICON_VARIANTS[iconVariant] || ICON_VARIANTS.blue
              }`}
            >
              <Icon className="w-4 h-4" />
            </div>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h1 className="text-base sm:text-lg font-bold text-[#16324F] leading-tight tracking-tight truncate">
                {title}
              </h1>
              {badge && <div className="shrink-0">{badge}</div>}
            </div>
            {subtitle && (
              <div className="text-[11px] sm:text-xs text-[#64748B] leading-normal truncate hidden sm:block">
                {subtitle}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Page-Specific Actions */}
        {actions && (
          <div className="flex items-center justify-end gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap ml-auto shrink-0">
            {actions}
          </div>
        )}
      </div>

      {/* Optional Secondary Row */}
      {secondaryRow && (
        <div className="pb-2.5 sm:pb-3 border-t border-[#F1F5F9] pt-2 sm:pt-2.5 max-w-[1600px] mx-auto">
          {secondaryRow}
        </div>
      )}
    </header>
  );
};

export const AdminTopbar: React.FC<AdminTopbarProps> = (props) => {
  const [mountNode, setMountNode] = useState<HTMLElement | null>(() => {
    if (typeof document !== 'undefined') {
      return document.getElementById('admin-topbar-mount');
    }
    return null;
  });

  useLayoutEffect(() => {
    if (!mountNode) {
      const node = document.getElementById('admin-topbar-mount');
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

export default AdminTopbar;
