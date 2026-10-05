import { useState, type FormEvent } from 'react';
import { Lock, KeyRound, RefreshCw, X, Eye, EyeOff } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { fetchWithAuth } from '../../api/client';

interface SecurityCardProps {
  email?: string | null;
}

export default function SecurityCard({ email }: SecurityCardProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [step, setStep] = useState<'REQUEST' | 'VERIFY'>('REQUEST');

  const [requestingOtp, setRequestingOtp] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleOpenModal = () => {
    setStep('REQUEST');
    setOtp('');
    setNewPassword('');
    setConfirmPassword('');
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setStep('REQUEST');
    setOtp('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleSendOtp = async () => {
    setRequestingOtp(true);
    try {
      await fetchWithAuth('/auth/request-password-otp', { method: 'POST' });
      toast.success('Verification code sent to your registered email.');
      setStep('VERIFY');
    } catch (err: any) {
      toast.error(err.message || 'Failed to send verification code');
    } finally {
      setRequestingOtp(false);
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();

    if (!otp.trim()) {
      toast.error('Please enter the 6-digit verification code.');
      return;
    }

    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    setUpdatingPassword(true);
    try {
      await fetchWithAuth('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ otp: otp.trim(), newPassword }),
      });
      toast.success('Password updated successfully!');
      handleCloseModal();
    } catch (err: any) {
      toast.error(err.message || 'Failed to change password');
    } finally {
      setUpdatingPassword(false);
    }
  };

  return (
    <>
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#1677C8]/10 text-[#1677C8]">
              <Lock className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              Security
            </h2>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="space-y-0.5">
            <p className="font-bold text-slate-800">Account Password</p>
            <p className="text-slate-500">
              Secured with standard encryption. Verified via email OTP before change.
            </p>
          </div>

          <button
            type="button"
            onClick={handleOpenModal}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer shrink-0"
          >
            <KeyRound className="w-3.5 h-3.5 text-[#1677C8]" />
            <span>Change Password</span>
          </button>
        </div>
      </div>

      {/* Compact Password Change Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xl max-w-sm w-full p-5 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-[#1677C8]/10 text-[#1677C8]">
                  <KeyRound className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">Change Password</h3>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {step === 'REQUEST' ? (
              <div className="space-y-4 text-xs">
                <p className="text-slate-600 leading-relaxed">
                  We will send a 6-digit verification code to your registered email{' '}
                  <strong className="text-slate-800">{email || 'on file'}</strong> to confirm your identity.
                </p>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={requestingOtp}
                    onClick={handleSendOtp}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#1677C8] hover:bg-[#125ea0] text-white text-xs font-bold rounded-xl transition shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {requestingOtp ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Sending...</span>
                      </>
                    ) : (
                      <span>Send Code</span>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleChangePassword} className="space-y-3 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    6-Digit Verification Code
                  </label>
                  <input
                    required
                    type="text"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="Enter 6-digit OTP"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 tracking-widest text-center outline-none focus:border-[#1677C8] focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    New Password (min 8 chars)
                  </label>
                  <div className="relative">
                    <input
                      required
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full px-3 py-2 pr-9 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-[#1677C8] focus:bg-white transition"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Confirm New Password
                  </label>
                  <input
                    required
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-[#1677C8] focus:bg-white transition"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setStep('REQUEST')}
                    className="text-[11px] font-bold text-slate-500 hover:underline mr-auto cursor-pointer"
                  >
                    Resend Code
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updatingPassword}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#1677C8] hover:bg-[#125ea0] text-white text-xs font-bold rounded-xl transition shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {updatingPassword ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Updating...</span>
                      </>
                    ) : (
                      <span>Update Password</span>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
