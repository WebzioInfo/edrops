import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Phone, ArrowRight, ShieldCheck, User } from 'lucide-react';
import { EdropsLogo } from '../../components/Logo';
import { fetchWithAuth } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-hot-toast';

export interface PhoneGateProps {
  tempToken: string;
  googleUser: {
    name: string;
    email: string;
    avatar?: string;
  };
  onSuccess: (session: { access_token: string; user: any }) => void;
}

export const PhoneGate: React.FC<PhoneGateProps> = ({
  tempToken,
  googleUser,
  onSuccess,
}) => {
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login } = useAuth();

  // Basic client-side phone validation (e.g. 10 digits)
  const cleanDigits = phone.replace(/\D/g, '');
  const isValidPhone = cleanDigits.length >= 10;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidPhone || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetchWithAuth('/auth/complete-phone', {
        method: 'POST',
        body: JSON.stringify({
          tempToken,
          phone: cleanDigits,
        }),
      });

      if (response.access_token && response.user) {
        login(response.access_token, response.user);
        toast.success(`Welcome to Edrops, ${response.user.firstName}!`);
        onSuccess(response);
      } else {
        throw new Error('Failed to complete sign in. Please try again.');
      }
    } catch (err: any) {
      const msg = err.message || 'Failed to complete registration';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-white lg:bg-gradient-to-br lg:from-[#061826] lg:via-[#0B2545] lg:to-[#13315C] flex flex-col items-center justify-start lg:justify-center p-0 lg:p-6 select-none overflow-hidden">
      {/* Desktop Ambient Glows */}
      <div className="hidden lg:block absolute -top-32 -left-32 w-[550px] h-[550px] bg-sky-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="hidden lg:block absolute -bottom-32 -right-32 w-[550px] h-[550px] bg-indigo-500/15 rounded-full blur-[140px] pointer-events-none" />

      {/* Main Container */}
      <div className="w-full h-full lg:h-[620px] lg:max-h-[92vh] lg:max-w-[460px] flex flex-col bg-white lg:rounded-[32px] lg:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.4)] overflow-hidden relative">
        
        {/* Header Banner */}
        <div className="w-full h-[20dvh] min-h-[120px] max-h-[145px] lg:h-28 bg-gradient-to-br from-[#00AEEF] via-[#0088CC] to-[#0B3B5C] relative px-6 pt-5 pb-6 flex items-start justify-between overflow-hidden shrink-0">
          <div className="absolute inset-0 opacity-[0.09] pointer-events-none">
            <svg className="w-full h-full object-cover" viewBox="0 0 800 400" preserveAspectRatio="none">
              <path d="M0,80 C200,160 400,20 600,120 C700,170 750,90 800,110 L800,400 L0,400 Z" fill="white" />
            </svg>
          </div>
          <div className="relative z-10 w-full flex items-center justify-between">
            <EdropsLogo variant="white" className="h-6 sm:h-7 w-auto drop-shadow-sm" />
            <div className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-md border border-white/25 text-[11px] font-semibold text-white">
              Google Verified
            </div>
          </div>
        </div>

        {/* Pulled-up Card */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex-1 w-full -mt-6 bg-white rounded-t-[28px] sm:rounded-t-[32px] px-6 pt-6 pb-6 flex flex-col shadow-[0_-8px_24px_rgba(0,0,0,0.04)] relative z-20 overflow-y-auto no-scrollbar"
        >
          
          {/* User Preview */}
          <div className="flex flex-col items-center text-center mt-1 mb-6">
            <div className="relative mb-3">
              {googleUser.avatar ? (
                <img
                  src={googleUser.avatar}
                  alt={googleUser.name}
                  className="w-16 h-16 rounded-full border-2 border-[#0088CC] shadow-md object-cover"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-sky-50 border-2 border-[#0088CC] flex items-center justify-center text-[#0088CC]">
                  <User className="w-8 h-8" />
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#0088CC] text-white flex items-center justify-center shadow-sm">
                <ShieldCheck className="w-3.5 h-3.5" />
              </div>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Almost there, {googleUser.name}!
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              {googleUser.email}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 justify-between">
            <div>
              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Phone Number
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 text-slate-400 pointer-events-none">
                    <Phone className="w-4 h-4" />
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="+91 98765 43210"
                    autoFocus
                    autoComplete="tel"
                    className="w-full h-12 pl-10 pr-3.5 rounded-2xl bg-white border border-slate-200 focus:border-[#0088CC] focus:ring-4 focus:ring-[#0088CC]/10 hover:border-slate-300 outline-none text-sm placeholder:text-slate-400 text-slate-900 transition-all font-medium"
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500 font-medium">
                  We need this to deliver to you
                </p>
                {error && (
                  <p className="mt-1.5 text-xs text-rose-500 font-semibold">
                    {error}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-6 mb-2">
              <button
                type="submit"
                disabled={!isValidPhone || isSubmitting}
                className="w-full h-12 rounded-2xl bg-[#0088CC] hover:bg-[#0077B3] text-white font-semibold text-base shadow-[0_4px_16px_rgba(0,136,204,0.25)] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Continue</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
};

export default PhoneGate;
