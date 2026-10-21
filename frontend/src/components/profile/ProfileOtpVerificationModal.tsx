import { useState, useRef, useEffect, type ClipboardEvent, type KeyboardEvent } from 'react';
import { X, ShieldCheck, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';

interface ProfileOtpVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  maskedEmail?: string;
  verificationId: string;
  onVerify: (otp: string) => Promise<void>;
  onResend: () => Promise<string | void>;
}

export default function ProfileOtpVerificationModal({
  isOpen,
  onClose,
  maskedEmail,
  verificationId,
  onVerify,
  onResend,
}: ProfileOtpVerificationModalProps) {
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(60);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Reset state when opened or verificationId changes
  useEffect(() => {
    if (isOpen) {
      setDigits(['', '', '', '', '', '']);
      setError(null);
      setLoading(false);
      setCountdown(60);
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    }
  }, [isOpen, verificationId]);

  // Countdown timer for resend
  useEffect(() => {
    if (!isOpen || countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen, countdown]);

  if (!isOpen) return null;

  const handleDigitChange = (index: number, val: string) => {
    setError(null);
    const cleaned = val.replace(/\D/g, '');

    if (!cleaned) {
      const updated = [...digits];
      updated[index] = '';
      setDigits(updated);
      return;
    }

    if (cleaned.length === 1) {
      const updated = [...digits];
      updated[index] = cleaned;
      setDigits(updated);
      if (index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
    } else {
      // If user typed or auto-filled multiple characters into one box
      const chars = cleaned.slice(0, 6).split('');
      const updated = [...digits];
      chars.forEach((ch, idx) => {
        if (index + idx < 6) {
          updated[index + idx] = ch;
        }
      });
      setDigits(updated);
      const nextFocus = Math.min(index + chars.length, 5);
      inputRefs.current[nextFocus]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    setError(null);
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    const chars = pasted.split('');
    const updated = ['', '', '', '', '', ''];
    chars.forEach((ch, idx) => {
      if (idx < 6) updated[idx] = ch;
    });
    setDigits(updated);

    const focusIdx = Math.min(chars.length, 5);
    inputRefs.current[focusIdx]?.focus();
  };

  const otpValue = digits.join('');
  const isComplete = otpValue.length === 6 && /^\d{6}$/.test(otpValue);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (loading || !isComplete) return;

    setError(null);
    setLoading(true);

    try {
      await onVerify(otpValue);
    } catch (err: any) {
      const msg = err.message || 'Verification failed. Please check the code and try again.';
      setError(msg);
      // Clear digits on error and refocus first box
      setDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResendClick = async () => {
    if (countdown > 0 || resending || loading) return;
    setResending(true);
    setError(null);
    try {
      await onResend();
      setCountdown(60);
      setDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch (err: any) {
      setError(err.message || 'Failed to resend code. Please try again later.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) {
          onClose();
        }
      }}
    >
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#1677C8]/10 text-[#1677C8] flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Security Verification</h3>
              <p className="text-[11px] text-slate-500">Authorize profile updates</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label="Close verification dialog"
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="text-center space-y-1.5">
            <p className="text-xs text-slate-600 leading-relaxed">
              We sent a 6-digit verification code to your registered email
              {maskedEmail && (
                <span className="block font-bold text-slate-800 mt-0.5">
                  {maskedEmail}
                </span>
              )}
            </p>
            <p className="text-[11px] text-slate-400">
              Enter the code below to confirm and apply your profile changes.
            </p>
          </div>

          {/* OTP Digit Inputs */}
          <div className="flex items-center justify-center gap-2 sm:gap-2.5 my-4" onPaste={handlePaste}>
            {digits.map((digit, index) => (
              <input
                key={index}
                ref={(el) => {
                  inputRefs.current[index] = el;
                }}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={1}
                value={digit}
                disabled={loading}
                onChange={(e) => handleDigitChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className={`w-11 h-12 sm:w-12 sm:h-14 text-center font-mono font-bold text-lg sm:text-xl rounded-xl border transition-all outline-none ${
                  digit
                    ? 'border-[#1677C8] bg-[#1677C8]/5 text-[#1677C8]'
                    : 'border-slate-200 bg-slate-50 text-slate-800'
                } focus:border-[#1677C8] focus:bg-white focus:ring-2 focus:ring-[#1677C8]/20 disabled:opacity-50 disabled:cursor-not-allowed`}
              />
            ))}
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50/80 border border-red-200/70 rounded-xl text-red-700 text-xs animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
              <span className="leading-tight">{error}</span>
            </div>
          )}

          {/* Resend and Actions */}
          <div className="flex items-center justify-between text-xs pt-1">
            <span className="text-slate-500">Didn't receive the code?</span>
            {countdown > 0 ? (
              <span className="font-semibold text-slate-400 font-mono text-[11px]">
                Resend in {countdown}s
              </span>
            ) : (
              <button
                type="button"
                onClick={handleResendClick}
                disabled={resending || loading}
                className="font-bold text-[#1677C8] hover:underline inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                {resending && <RefreshCw className="w-3 h-3 animate-spin" />}
                Resend code
              </button>
            )}
          </div>

          {/* Buttons */}
          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isComplete || loading}
              className="flex-1 py-2.5 rounded-xl bg-[#1677C8] hover:bg-[#125ea0] text-white text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Verify & Save
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
