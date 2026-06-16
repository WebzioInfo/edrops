import React, { useState } from 'react';
import { Mail, Phone, Shield, Award, Edit2 } from 'lucide-react';
import { fetchWithAuth } from '../../api/client';
import { toast } from 'react-hot-toast';

interface ProfileData {
  id: string;
  email: string | null;
  phone: string;
  firstName: string;
  lastName: string;
  role: 'CUSTOMER' | 'STAFF' | 'ADMIN' | 'DELIVERY_PARTNER';
}

interface AccountDetailsFormProps {
  profile: ProfileData;
  onRefresh: () => void;
}

export default function AccountDetailsForm({ profile, onRefresh }: AccountDetailsFormProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  const [email, setEmail] = useState(profile.email || '');
  const [phone, setPhone] = useState(profile.phone);
  const [updating, setUpdating] = useState(false);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName || !phone) {
      toast.error('First Name, Last Name, and Phone are required.');
      return;
    }
    setUpdating(true);
    try {
      await fetchWithAuth('/auth/update-profile', {
        method: 'POST',
        body: JSON.stringify({ firstName, lastName, email, phone }),
      });
      toast.success('Profile updated successfully!');
      setIsEditing(false);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setUpdating(false);
    }
  };

  const inputClass = "w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 outline-none transition-all placeholder:text-slate-400 focus:border-[#0F6E8C] focus:ring-1 focus:ring-[#0F6E8C] text-[14px] text-[#0F172A] font-medium";

  return (
    <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200/85 shadow-sm space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <h2 className="text-xl font-bold text-[#0F172A]">Account Details</h2>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#0F6E8C] hover:text-[#0F6E8C]/80 transition cursor-pointer"
          >
            <Edit2 className="h-4 w-4" /> Edit Profile
          </button>
        )}
      </div>

      {isEditing ? (
        <form onSubmit={handleUpdate} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">First Name</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Last Name</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={() => {
                setIsEditing(false);
                setFirstName(profile.firstName);
                setLastName(profile.lastName);
                setEmail(profile.email || '');
                setPhone(profile.phone);
              }}
              className="px-5 py-2.5 rounded-xl text-xs font-bold uppercase bg-slate-100 text-slate-700 transition hover:bg-slate-200 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updating}
              className="px-5 py-2.5 rounded-xl text-xs font-bold uppercase bg-[#0F6E8C] hover:bg-[#0F6E8C]/90 text-white transition cursor-pointer disabled:opacity-50"
            >
              {updating ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-start gap-3 p-3.5 sm:p-4 rounded-xl bg-slate-50 border border-slate-100/60">
            <Mail className="h-5 w-5 text-[#0F6E8C] shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Email</p>
              <p className="text-sm sm:text-base font-semibold text-[#0F172A] mt-0.5 break-all sm:break-normal">{profile.email ?? 'Not set'}</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3.5 sm:p-4 rounded-xl bg-slate-50 border border-slate-100/60">
            <Phone className="h-5 w-5 text-[#0F6E8C] shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Phone</p>
              <p className="text-sm sm:text-base font-semibold text-[#0F172A] mt-0.5 break-all">{profile.phone}</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3.5 sm:p-4 rounded-xl bg-slate-50 border border-slate-100/60">
            <Shield className="h-5 w-5 text-[#0F6E8C] shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#0F6E8C]">Access Role</p>
              <p className="text-sm sm:text-base font-semibold text-[#0F172A] mt-0.5">{profile.role.replace('_', ' ')}</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3.5 sm:p-4 rounded-xl bg-slate-50 border border-slate-100/60">
            <Award className="h-5 w-5 text-[#0F6E8C] shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">User ID</p>
              <p className="text-xs sm:text-sm font-semibold text-[#0F172A] mt-0.5 break-all">{profile.id}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
