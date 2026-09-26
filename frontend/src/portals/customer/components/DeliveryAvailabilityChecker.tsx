import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  X,
  RotateCcw,
} from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';

export default function DeliveryAvailabilityChecker() {
  const [isOpen, setIsOpen] = useState(false);
  const [pincode, setPincode] = useState('');
  const [status, setStatus] = useState<
    'idle' | 'checking' | 'available' | 'unavailable' | 'error'
  >('idle');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [checkedPincode, setCheckedPincode] = useState('');
  const [locationInfo, setLocationInfo] = useState<{ city?: string; state?: string } | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setPincode(value);
    if (validationError) {
      setValidationError(null);
    }
    if (status !== 'idle' && status !== 'checking') {
      setStatus('idle');
    }
  };

  const handleCheck = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const trimmed = pincode.trim();

    // Frontend validation: must be exactly 6 digits
    if (!/^\d{6}$/.test(trimmed)) {
      setValidationError('Please enter a valid 6-digit Indian pincode.');
      return;
    }

    setValidationError(null);
    setStatus('checking');

    try {
      const response = await fetchWithAuth(
        `/address/check-delivery?pincode=${trimmed}`,
      );

      setCheckedPincode(trimmed);

      if (response && (response.deliverable === true || response.serviceable === true)) {
        setStatus('available');
        setLocationInfo({
          city: response.city,
          state: response.state,
        });
      } else {
        setStatus('unavailable');
        setLocationInfo(null);
      }
    } catch (err) {
      setStatus('error');
    }
  };

  const handleReset = () => {
    setStatus('idle');
    setPincode('');
    setValidationError(null);
    setCheckedPincode('');
    setLocationInfo(null);
  };

  return (
    <div className="w-full mb-4 sm:mb-6">
      <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xs overflow-hidden transition-all duration-200">
        
        {/* Closed / Compact Banner Header */}
        {!isOpen ? (
          <div className="p-3.5 sm:p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-[#F0F9FF] via-white to-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#EBF5FB] border border-[#BBDFF2] flex items-center justify-center shrink-0 text-[#1E88E5]">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-[15px] font-semibold text-[#0F172A] leading-tight">
                  Check Delivery Availability
                </h3>
                <p className="text-xs sm:text-[13px] text-[#64748B] mt-0.5">
                  Enter your pincode to check if we deliver to your area
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 sm:py-2.5 rounded-xl bg-[#1E88E5] hover:bg-[#1976D2] active:scale-[0.98] text-white text-xs sm:text-sm font-semibold transition-all shadow-xs cursor-pointer shrink-0 self-start sm:self-auto"
            >
              <span>Check Delivery</span>
            </button>
          </div>
        ) : (
          /* Expanded Panel */
          <div className="p-4 sm:p-5">
            {/* Top Bar with Title and Close Button */}
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#F1F5F9]">
              <div className="flex items-center gap-2 text-[#0F172A]">
                <MapPin className="w-4 h-4 text-[#1E88E5]" />
                <span className="text-sm font-bold">Check Delivery Availability</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  handleReset();
                }}
                className="p-1.5 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Input Form (Shown when not in a final result state) */}
            {status === 'idle' || status === 'checking' ? (
              <form onSubmit={handleCheck} className="flex flex-col gap-2">
                <label
                  htmlFor="delivery-pincode-input"
                  className="text-xs font-semibold text-[#475569]"
                >
                  Enter your pincode
                </label>

                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <input
                      id="delivery-pincode-input"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      autoFocus
                      placeholder="e.g. 682001"
                      value={pincode}
                      onChange={handleInputChange}
                      disabled={status === 'checking'}
                      className={`w-full h-11 px-3.5 rounded-xl border text-sm font-medium transition-all outline-none placeholder:text-[#94A3B8] ${
                        validationError
                          ? 'border-rose-400 bg-rose-50/20 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                          : 'border-[#CBD5E1] bg-white text-[#0F172A] focus:border-[#1E88E5] focus:ring-2 focus:ring-[#1E88E5]/20'
                      }`}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={status === 'checking'}
                    className="h-11 px-5 rounded-xl bg-[#1E88E5] hover:bg-[#1976D2] active:scale-[0.98] disabled:opacity-60 text-white text-sm font-semibold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer shrink-0"
                  >
                    {status === 'checking' ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Checking...</span>
                      </>
                    ) : (
                      <span>Check</span>
                    )}
                  </button>
                </div>

                {/* Validation Error Message */}
                {validationError && (
                  <p className="flex items-center gap-1.5 text-xs text-rose-600 font-medium mt-0.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{validationError}</span>
                  </p>
                )}
              </form>
            ) : null}

            {/* Result States */}
            <AnimatePresence mode="wait">
              {/* 1. Deliverable / Success State */}
              {status === 'available' && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-xl p-3.5 bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 text-emerald-700 mt-0.5 sm:mt-0">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                          Delivery Available
                        </span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          {checkedPincode}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-emerald-950 mt-0.5">
                        Great! We deliver to this area.
                      </p>
                      <p className="text-xs text-emerald-700">
                        We deliver to {checkedPincode}
                        {locationInfo?.city ? ` (${locationInfo.city}${locationInfo.state ? `, ${locationInfo.state}` : ''})` : ''}.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleReset}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:text-emerald-950 bg-white hover:bg-emerald-100/60 border border-emerald-300 rounded-lg transition-colors cursor-pointer self-start sm:self-auto shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Check another pincode</span>
                  </button>
                </motion.div>
              )}

              {/* 2. Unavailable State */}
              {status === 'unavailable' && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-xl p-3.5 bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0 text-amber-700 mt-0.5 sm:mt-0">
                      <XCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
                          Delivery Unavailable
                        </span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
                          {checkedPincode}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-amber-950 mt-0.5">
                        Sorry, we don't deliver to this area yet.
                      </p>
                      <p className="text-xs text-amber-700">
                        We are continuously expanding our service areas. Please check back soon.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleReset}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:text-amber-950 bg-white hover:bg-amber-100/60 border border-amber-300 rounded-lg transition-colors cursor-pointer self-start sm:self-auto shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Check another pincode</span>
                  </button>
                </motion.div>
              )}

              {/* 3. Network / Server Error State */}
              {status === 'error' && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-xl p-3.5 bg-rose-50 border border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center shrink-0 text-rose-700 mt-0.5 sm:mt-0">
                      <AlertCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-rose-800">
                        Check Failed
                      </span>
                      <p className="text-sm font-semibold text-rose-950 mt-0.5">
                        Unable to check delivery availability. Please try again.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleReset}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-800 hover:text-rose-950 bg-white hover:bg-rose-100/60 border border-rose-300 rounded-lg transition-colors cursor-pointer self-start sm:self-auto shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Try again</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
