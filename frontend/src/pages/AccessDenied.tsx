import React from 'react';
import { ShieldAlert, ArrowLeft, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { EdropsLogo } from '../components/Logo';

export const AccessDenied: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleReturn = () => {
    if (user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') {
      navigate('/admin/dashboard');
    } else if (user?.role === 'STAFF') {
      navigate('/staff/orders');
    } else if (user?.role === 'DISTRIBUTOR') {
      navigate('/distributor/orders');
    } else if (user?.role === 'DELIVERY_PARTNER') {
      navigate('/delivery-partner');
    } else {
      navigate('/customer/shop');
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200/80 p-8 shadow-xs text-center flex flex-col items-center">
        {/* Brand Header */}
        <div className="mb-6">
          <EdropsLogo variant="blue" className="h-7 w-auto mx-auto" />
        </div>

        {/* Warning Icon Badge */}
        <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-5 border border-rose-100 shadow-2xs">
          <ShieldAlert className="w-8 h-8" />
        </div>

        {/* Status & Title */}
        <span className="text-[11px] font-black uppercase tracking-widest text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full mb-2">
          HTTP 403 • Access Denied
        </span>

        <h1 className="text-xl font-extrabold text-[#16324F] mb-2 tracking-tight">
          Restricted Resource
        </h1>

        <p className="text-xs text-[#64748B] leading-relaxed mb-6 font-medium">
          The Aquora Biodrops Integration module is strictly accessible to{' '}
          <strong className="text-[#16324F]">Upper Admin</strong>,{' '}
          <strong className="text-[#16324F]">Admin</strong>, and{' '}
          <strong className="text-[#16324F]">Staff</strong> roles. Your account (
          <span className="font-semibold text-slate-700">{user?.role || 'Guest'}</span>) does not have authorization to view this integration.
        </p>

        {/* Actions */}
        <div className="w-full flex flex-col sm:flex-row gap-2.5">
          <button
            type="button"
            onClick={handleReturn}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1677C8] hover:bg-[#125fa0] text-white rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer active:scale-98"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Portal</span>
          </button>

          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AccessDenied;

