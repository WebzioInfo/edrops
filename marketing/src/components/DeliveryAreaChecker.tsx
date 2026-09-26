import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  X,
  RotateCcw,
  ArrowRight,
} from 'lucide-react';
import { checkDeliveryPincode, type DeliveryCheckResult } from '../lib/api';

type Status = 'idle' | 'checking' | 'available' | 'unavailable' | 'error';

export default function DeliveryAreaChecker() {
  const [isOpen, setIsOpen] = useState(false);
  const [pincode, setPincode] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [resultData, setResultData] = useState<DeliveryCheckResult | null>(null);
  const [checkedPincode, setCheckedPincode] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-focus input when expanded
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Keyboard accessibility: Escape key closes the expanded widget
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow numeric digits, max 6 characters
    const cleaned = e.target.value.replace(/\D/g, '').slice(0, 6);
    setPincode(cleaned);

    if (validationError) {
      setValidationError(null);
    }

    if (status !== 'idle' && status !== 'checking') {
      setStatus('idle');
    }
  };

  const handleCheck = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (status === 'checking') return;

    const trimmed = pincode.trim();

    // Frontend validation: exactly 6 digits
    if (!/^\d{6}$/.test(trimmed)) {
      setValidationError('Enter a valid 6-digit pincode.');
      return;
    }

    setValidationError(null);
    setStatus('checking');

    try {
      const data = await checkDeliveryPincode(trimmed);
      setCheckedPincode(trimmed);
      setResultData(data);

      if (data && (data.deliverable === true || data.serviceable === true)) {
        setStatus('available');
      } else {
        setStatus('unavailable');
      }
    } catch {
      setStatus('error');
    }
  };

  const handleReset = () => {
    setStatus('idle');
    setPincode('');
    setValidationError(null);
    setResultData(null);
    setCheckedPincode('');
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const handleClose = () => {
    setIsOpen(false);
    setStatus('idle');
    setPincode('');
    setValidationError(null);
    setResultData(null);
    setCheckedPincode('');
  };

  return (
    <div
      ref={containerRef}
      className="fixed z-50 bottom-[calc(1.75rem+env(safe-area-inset-bottom,0px))] left-4 right-4 sm:left-auto sm:right-8 sm:bottom-10 sm:w-auto select-none pointer-events-auto"
      aria-live="polite"
    >
      <AnimatePresence mode="wait">
        {!isOpen ? (
          /* ═══════════════════════════════════════════════════════════════
             1. CLOSED STATE — STRIKING eDROPS BLUE GRADIENT FLOATING CARD
             ═══════════════════════════════════════════════════════════════ */
          <motion.button
            key="closed-btn"
            type="button"
            onClick={() => setIsOpen(true)}
            initial={{ opacity: 0, y: 14, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="w-full sm:w-[280px] h-[68px] flex items-center justify-between px-4 bg-gradient-to-r from-[#08A9E6] via-[#087CC9] to-[#075B9E] rounded-2xl border border-white/30 shadow-[0_10px_30px_rgba(8,124,201,0.38)] hover:shadow-[0_16px_40px_rgba(8,124,201,0.52)] hover:-translate-y-1 active:translate-y-0 transition-all duration-300 text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/60 focus:ring-offset-2 focus:ring-offset-[#087CC9] group relative overflow-hidden"
            aria-expanded="false"
            aria-label="Check Delivery Area: See if we deliver to you"
          >
            {/* Subtle top specular glass highlight */}
            <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none" />

            <div className="flex items-center gap-3 relative z-10">
              {/* White translucent icon container */}
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm text-white flex items-center justify-center shrink-0 border border-white/30 shadow-inner group-hover:scale-105 group-hover:bg-white/25 transition-all duration-300">
                <MapPin className="w-5 h-5 text-white" />
              </div>

              <div>
                <div className="text-[14px] font-bold text-white tracking-tight leading-tight drop-shadow-xs">
                  Check Delivery Area
                </div>
                <div className="text-[12px] font-medium text-white/85 mt-0.5 leading-tight flex items-center gap-1">
                  <span>See if we deliver</span>
                </div>
              </div>
            </div>

            <div className="flex items-center pl-2 text-white/90 group-hover:translate-x-1 transition-transform duration-300 relative z-10">
              <ArrowRight className="w-4 h-4 text-white" />
            </div>
          </motion.button>
        ) : (
          /* ═══════════════════════════════════════════════════════════════
             2. OPEN STATE — EXPANDED BLUE GRADIENT COMPONENT
             ═══════════════════════════════════════════════════════════════ */
          <motion.div
            key="open-card"
            role="dialog"
            aria-modal="true"
            aria-label="Check Delivery Area"
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.95 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="w-full sm:w-[330px] bg-gradient-to-br from-[#08A9E6] via-[#087CC9] to-[#075B9E] rounded-2xl border border-white/30 shadow-[0_18px_50px_rgba(7,91,158,0.48)] p-4 sm:p-5 text-white relative overflow-hidden"
          >
            {/* Ambient specular highlight */}
            <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/50 to-transparent pointer-events-none" />

            {/* Header */}
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/20">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-sm text-white flex items-center justify-center shrink-0 border border-white/30">
                  <MapPin className="w-4 h-4 text-white" />
                </div>
                <h3 className="text-[14.5px] font-bold text-white tracking-tight leading-snug drop-shadow-xs">
                  Check Delivery Area
                </h3>
              </div>

              <button
                type="button"
                onClick={handleClose}
                className="w-7 h-7 rounded-lg text-white/80 hover:text-white bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-white"
                aria-label="Close delivery area checker"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Input Form (Active when in idle or checking states) */}
            {(status === 'idle' || status === 'checking') && (
              <form onSubmit={handleCheck} className="flex flex-col gap-2.5">
                <p className="text-[12.5px] text-white/90 leading-relaxed font-medium">
                  Enter your pincode to check delivery availability.
                </p>

                <div className="flex gap-2 mt-1">
                  <div className="relative flex-1">
                    <label htmlFor="marketing-pincode-input" className="sr-only">
                      Enter 6-digit pincode
                    </label>
                    <input
                      ref={inputRef}
                      id="marketing-pincode-input"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      placeholder="Enter 6-digit pincode"
                      value={pincode}
                      onChange={handleInputChange}
                      disabled={status === 'checking'}
                      className={`w-full h-10 px-3.5 rounded-xl bg-white text-[#0f2b35] text-[13.5px] font-semibold outline-none transition-all placeholder:text-slate-400 placeholder:font-normal shadow-inner ${
                        validationError
                          ? 'ring-2 ring-amber-300 border-amber-300'
                          : 'focus:ring-2 focus:ring-white/90'
                      }`}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={status === 'checking'}
                    className="h-10 px-4 rounded-xl bg-white hover:bg-blue-50 active:scale-[0.98] disabled:opacity-75 text-[#087CC9] text-[13px] font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer shrink-0 focus:outline-none focus:ring-2 focus:ring-white"
                  >
                    {status === 'checking' ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#087CC9]" />
                        <span>Checking...</span>
                      </>
                    ) : (
                      <span>Check</span>
                    )}
                  </button>
                </div>

                {validationError && (
                  <p className="flex items-center gap-1.5 text-[12px] text-amber-200 font-semibold bg-black/20 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-amber-300/30">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-300" />
                    <span>{validationError}</span>
                  </p>
                )}
              </form>
            )}

            {/* ═══════════════════════════════════════════════════════════════
               RESULT STATES (Rendered inside the same Blue Gradient Card)
               ═══════════════════════════════════════════════════════════════ */}
            <AnimatePresence mode="wait">
              {/* 1. DELIVERABLE SUCCESS STATE */}
              {status === 'available' && (
                <motion.div
                  key="result-available"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="rounded-xl p-3.5 bg-white/15 backdrop-blur-md border border-white/30 flex flex-col gap-3"
                >
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-white text-[#087CC9] flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[13.5px] font-bold text-white leading-tight">
                          ✓ Delivery available
                        </span>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-white/25 text-white">
                          {checkedPincode}
                        </span>
                      </div>
                      <p className="text-[12px] text-white/90 mt-1 leading-normal font-medium">
                        We deliver to your area
                        {resultData?.city ? ` (${resultData.city}${resultData.state ? `, ${resultData.state}` : ''})` : ''}. You can order eDrops 20L water jars at this location.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/20">
                    <button
                      type="button"
                      onClick={handleReset}
                      className="text-[11.5px] font-semibold text-white/85 hover:text-white flex items-center gap-1 cursor-pointer transition-colors py-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Check another pincode</span>
                    </button>

                    <a
                      href="https://app.edrops.in"
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-blue-50 text-[#087CC9] rounded-lg text-[12px] font-bold transition-all shadow-sm"
                    >
                      <span>Order Now</span>
                      <ArrowRight className="w-3 h-3 text-[#087CC9]" />
                    </a>
                  </div>
                </motion.div>
              )}

              {/* 2. UNAVAILABLE STATE */}
              {status === 'unavailable' && (
                <motion.div
                  key="result-unavailable"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="rounded-xl p-3.5 bg-white/15 backdrop-blur-md border border-white/30 flex flex-col gap-3"
                >
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-white/25 text-amber-200 flex items-center justify-center shrink-0 mt-0.5">
                      <XCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[13.5px] font-bold text-white leading-tight">
                          Delivery unavailable
                        </span>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-white/20 text-white">
                          {checkedPincode}
                        </span>
                      </div>
                      <p className="text-[12px] text-white/90 mt-1 leading-normal font-medium">
                        Sorry, we don't deliver to this pincode yet. We are expanding rapidly to more areas soon!
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-white/20">
                    <button
                      type="button"
                      onClick={handleReset}
                      className="text-[11.5px] font-semibold text-white/85 hover:text-white flex items-center gap-1 cursor-pointer transition-colors py-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Check another pincode</span>
                    </button>
                  </div>
                </motion.div>
              )}

              {/* 3. API / NETWORK ERROR STATE */}
              {status === 'error' && (
                <motion.div
                  key="result-error"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="rounded-xl p-3.5 bg-white/15 backdrop-blur-md border border-white/30 flex flex-col gap-3"
                >
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-white/25 text-rose-200 flex items-center justify-center shrink-0 mt-0.5">
                      <AlertCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[13.5px] font-bold text-white leading-tight">
                        Check Failed
                      </span>
                      <p className="text-[12px] text-white/90 mt-1 leading-normal font-medium">
                        Unable to check right now. Please try again.
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-white/20">
                    <button
                      type="button"
                      onClick={handleReset}
                      className="text-[11.5px] font-semibold text-white/85 hover:text-white flex items-center gap-1 cursor-pointer transition-colors py-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Try again</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
