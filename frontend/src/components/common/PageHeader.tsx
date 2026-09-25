import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export interface ActionItem {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
  to?: string;
  disabled?: boolean;
  loading?: boolean;
  title?: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
}

export interface PageHeaderProps {
  title: string | React.ReactNode;
  subtitle?: string | React.ReactNode;
  badge?: React.ReactNode;
  backLink?: { to: string; label?: string };
  primaryAction?: ActionItem;
  secondaryActions?: ActionItem[];
  children?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  badge,
  backLink,
  primaryAction,
  secondaryActions = [],
  children,
  className = '',
}) => {
  return (
    <div
      className={`w-full bg-white rounded-2xl border border-slate-200/80 p-3 sm:p-4 shadow-xs select-none transition-all ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left Side: Back button + Title + Subtitle */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {backLink && (
            <Link
              to={backLink.to}
              className="p-1.5 -ml-1 text-slate-500 hover:text-[#1677C8] hover:bg-slate-100 rounded-xl transition-colors shrink-0"
              title={backLink.label || 'Go back'}
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-lg font-bold text-[#16324F] leading-tight tracking-tight">
                {title}
              </h1>
              {badge && <div className="shrink-0">{badge}</div>}
            </div>
            {subtitle && (
              <p className="text-[11px] sm:text-xs text-[#64748B] leading-normal mt-0.5 truncate sm:whitespace-normal">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Right Side Actions: Responsive hierarchy */}
        <div className="flex items-center justify-end gap-1.5 sm:gap-2 shrink-0 flex-wrap">
          {/* Secondary Actions: Compact Icon buttons on mobile, labeled on desktop */}
          {secondaryActions.map((action, idx) => {
            const Icon = action.icon;
            const content = (
              <>
                {Icon && (
                  <Icon
                    className={`w-3.5 h-3.5 ${
                      action.loading ? 'animate-spin text-[#1677C8]' : ''
                    }`}
                  />
                )}
                <span className="hidden sm:inline text-xs font-bold">{action.label}</span>
              </>
            );

            if (action.to) {
              return (
                <Link
                  key={idx}
                  to={action.to}
                  title={action.title || action.label}
                  className="p-2 sm:px-3 sm:py-2 text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  {content}
                </Link>
              );
            }

            return (
              <button
                key={idx}
                type="button"
                onClick={action.onClick}
                disabled={action.disabled || action.loading}
                title={action.title || action.label}
                className="p-2 sm:px-3 sm:py-2 text-slate-700 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200 rounded-xl transition-colors inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-2xs"
              >
                {content}
              </button>
            );
          })}

          {/* Primary Action Button: Edrops Blue with prominent text & icon */}
          {primaryAction && (
            primaryAction.to ? (
              <Link
                to={primaryAction.to}
                title={primaryAction.title || primaryAction.label}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2 bg-[#1677C8] hover:bg-[#125ea0] active:scale-95 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer shrink-0"
              >
                {primaryAction.icon && <primaryAction.icon className="w-3.5 h-3.5" />}
                <span>{primaryAction.label}</span>
              </Link>
            ) : (
              <button
                type="button"
                onClick={primaryAction.onClick}
                disabled={primaryAction.disabled}
                title={primaryAction.title || primaryAction.label}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2 bg-[#1677C8] hover:bg-[#125ea0] active:scale-95 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer shrink-0 disabled:opacity-50"
              >
                {primaryAction.icon && <primaryAction.icon className="w-3.5 h-3.5" />}
                <span>{primaryAction.label}</span>
              </button>
            )
          )}

          {children}
        </div>
      </div>
    </div>
  );
};
