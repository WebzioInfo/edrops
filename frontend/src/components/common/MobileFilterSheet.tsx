import React, { useEffect } from 'react';
import { X, SlidersHorizontal, RotateCcw, Check } from 'lucide-react';

interface MobileFilterSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  activeCount?: number;
  onReset?: () => void;
  onApply?: () => void;
  children: React.ReactNode;
}

export const MobileFilterSheet: React.FC<MobileFilterSheetProps> = ({
  isOpen,
  onClose,
  title = 'Filter Options',
  activeCount = 0,
  onReset,
  onApply,
  children,
}) => {
  // Lock body scroll when sheet is open on mobile
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      {/* Backdrop click dismiss */}
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      {/* Sheet Content */}
      <div
        className="relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col max-h-[85vh] sm:max-h-[80vh] z-10 animate-in slide-in-from-bottom-4 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle for visual mobile affordance */}
        <div className="sm:hidden pt-3 pb-1 flex justify-center">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>

        {/* Header */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#1677C8]/10 text-[#1677C8] flex items-center justify-center font-bold">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-800">{title}</h3>
                {activeCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-[#1677C8] text-white">
                    {activeCount} active
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">Refine the current list view</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            aria-label="Close filters"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Filter Form Controls */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs font-semibold text-slate-700">
          {children}
        </div>

        {/* Action Footer */}
        <div className="px-4 py-3 sm:px-6 sm:py-3.5 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between gap-3">
          {onReset ? (
            <button
              type="button"
              onClick={() => {
                onReset();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-[#1677C8] hover:bg-slate-200/50 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          ) : <div />}

          <button
            type="button"
            onClick={() => {
              if (onApply) onApply();
              onClose();
            }}
            className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-[#1677C8] hover:bg-[#125ea0] text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer flex-1 sm:flex-initial"
          >
            <Check className="w-4 h-4" />
            <span>Apply Filters</span>
          </button>
        </div>
      </div>
    </div>
  );
};
