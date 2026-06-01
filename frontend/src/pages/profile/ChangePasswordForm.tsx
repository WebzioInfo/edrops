import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { fetchWithAuth } from '../../api/client';
import { toast } from 'react-hot-toast';

interface ChangePasswordFormProps {
  email: string | null;
}

export default function ChangePasswordForm({ email }: ChangePasswordFormProps) {
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [requestingOtp, setRequestingOtp] = useState(false);

  const handleRequestOtp = async () => {
    setRequestingOtp(true);
    try {
      await fetchWithAuth('/auth/request-password-otp', { method: 'POST' });
      toast.success('Verification OTP code sent to your registered email!');
      setOtpSent(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to request OTP');
    } finally {
      setRequestingOtp(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || !newPassword || !confirmPassword) {
      toast.error('Verification code and new passwords are required.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    setChangingPassword(true);
    try {
      await fetchWithAuth('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ otp, newPassword }),
      });
      toast.success('Password changed successfully!');
      setOtp('');
      setNewPassword('');
      setConfirmPassword('');
      setOtpSent(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="clay-card space-y-6">
      <h2 className="text-2xl font-black border-b border-border pb-3 text-[#245361] flex items-center gap-2">
        <Lock className="h-5 w-5 text-primary" /> Change Password
      </h2>

      {!otpSent ? (
        <div className="space-y-4 max-w-lg">
          <p className="text-sm font-semibold text-slate-600">
            To update your password, we will send a 6-digit verification code (OTP) to your registered email address <strong>{email || 'associated with your account'}</strong>.
          </p>
          <button
            type="button"
            disabled={requestingOtp}
            onClick={handleRequestOtp}
            className="px-6 py-3 rounded-full bg-primary text-xs font-black uppercase text-white shadow-md hover:shadow-primary/20 transition cursor-pointer disabled:opacity-50"
          >
            {requestingOtp ? 'Sending code...' : 'Request Verification OTP'}
          </button>
        </div>
      ) : (
        <form onSubmit={handleChangePassword} className="space-y-4 max-w-lg">
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">Verification Code (OTP)</label>
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="Enter 6-digit OTP code"
              className="w-full clay-input font-bold tracking-widest text-[#245361] text-center"
              maxLength={6}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full clay-input"
              />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full clay-input"
              />
            </div>
          </div>
          <div className="flex justify-between items-center pt-2">
            <button
              type="button"
              onClick={() => setOtpSent(false)}
              className="text-xs font-black uppercase text-slate-500 hover:underline cursor-pointer"
            >
              Back / Resend OTP
            </button>
            <button
              type="submit"
              disabled={changingPassword}
              className="px-8 py-3 rounded-full bg-primary text-xs font-black uppercase text-white shadow-md hover:shadow-primary/20 transition active:scale-98 cursor-pointer disabled:opacity-50 flex items-center gap-2"
            >
              Confirm & Update Password
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
