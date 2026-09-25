import React from 'react';
import { toast as hotToast, resolveValue, type Toast } from 'react-hot-toast';
import { Check, X, Info, Loader2 } from 'lucide-react';

export interface EdropsToastItemProps {
  toast: Toast;
}

export const EdropsToastItem: React.FC<EdropsToastItemProps> = ({ toast }) => {
  // Determine variant: only 'success', 'error', 'info', 'loading' (no warning)
  let variant: 'success' | 'error' | 'info' | 'loading' = 'info';

  if (toast.type === 'success') {
    variant = 'success';
  } else if (toast.type === 'error') {
    variant = 'error';
  } else if (toast.type === 'loading') {
    variant = 'loading';
  } else {
    variant = 'info';
  }

  // Resolve message content
  const resolved = resolveValue(toast.message, toast);
  let title: React.ReactNode = '';
  let description: React.ReactNode = null;

  if (React.isValidElement(resolved)) {
    title = resolved;
  } else if (typeof resolved === 'string') {
    if (resolved.includes('\n')) {
      const parts = resolved.split('\n');
      title = parts[0];
      description = parts.slice(1).join('\n');
    } else {
      title = resolved;
    }
  } else if (typeof resolved === 'object' && resolved !== null && 'title' in (resolved as any)) {
    title = (resolved as any).title;
    description = (resolved as any).description || null;
  } else {
    title = String(resolved ?? '');
  }

  // Style 5 Design treatment:
  // - SUCCESS: Edrops Blue filled pill, white circle with GREEN CHECK icon
  // - ERROR: Strong Red filled pill, white circle with RED X icon
  // - INFO: Edrops Blue filled pill, white circle with BLUE INFO icon
  // - LOADING: Edrops Blue filled pill, white circle with BLUE SPINNER icon
  const config = {
    success: {
      bg: 'bg-[#1677C8] text-white border border-[#1677C8]/20',
      shadow: 'shadow-[0_8px_24px_rgba(22,119,200,0.32)]',
      circleBg: 'bg-white text-emerald-600',
      icon: <Check className="w-3.5 h-3.5 stroke-[3]" />,
      ariaRole: 'status' as const,
      ariaLive: 'polite' as const,
    },
    error: {
      bg: 'bg-[#EF4444] text-white border border-[#EF4444]/20',
      shadow: 'shadow-[0_8px_24px_rgba(239,68,68,0.32)]',
      circleBg: 'bg-white text-rose-600',
      icon: <X className="w-3.5 h-3.5 stroke-[3]" />,
      ariaRole: 'alert' as const,
      ariaLive: 'assertive' as const,
    },
    info: {
      bg: 'bg-[#1677C8] text-white border border-[#1677C8]/20',
      shadow: 'shadow-[0_8px_24px_rgba(22,119,200,0.32)]',
      circleBg: 'bg-white text-[#1677C8]',
      icon: <Info className="w-3.5 h-3.5 stroke-[2.5]" />,
      ariaRole: 'status' as const,
      ariaLive: 'polite' as const,
    },
    loading: {
      bg: 'bg-[#1677C8] text-white border border-[#1677C8]/20',
      shadow: 'shadow-[0_8px_24px_rgba(22,119,200,0.32)]',
      circleBg: 'bg-white text-[#1677C8]',
      icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
      ariaRole: 'status' as const,
      ariaLive: 'polite' as const,
    },
  }[variant];

  return (
    <div
      role={config.ariaRole}
      aria-live={config.ariaLive}
      className={`
        pointer-events-auto flex items-center gap-3 px-4 py-2.5 sm:py-3 rounded-2xl
        ${config.bg} ${config.shadow}
        w-full max-w-[calc(100vw-32px)] sm:max-w-md sm:w-auto min-w-[280px]
        transition-all duration-200 ease-out motion-reduce:transition-none
        ${toast.visible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-2 scale-95 pointer-events-none'}
      `}
      style={{
        ...toast.style,
      }}
    >
      <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center shadow-xs ${config.circleBg}`}>
        {toast.icon ? (toast.icon as React.ReactNode) : config.icon}
      </div>

      <div className="flex-1 min-w-0 pr-1">
        <div className="text-sm font-medium leading-snug tracking-tight text-white select-text">
          {title}
        </div>
        {description && (
          <div className="text-xs text-white/85 mt-0.5 leading-relaxed font-normal whitespace-pre-line select-text">
            {description}
          </div>
        )}
      </div>

      {variant !== 'loading' && (
        <button
          type="button"
          onClick={() => hotToast.dismiss(toast.id)}
          aria-label="Close notification"
          className="shrink-0 -mr-1 p-1 rounded-md text-white/80 hover:text-white hover:bg-white/15 focus:outline-none focus:ring-1 focus:ring-white/50 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export default EdropsToastItem;
