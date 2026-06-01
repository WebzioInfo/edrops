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

  return (
    <div className="clay-card space-y-6">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <h2 className="text-2xl font-black text-[#245361]">Account Details</h2>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-primary hover:text-primary/80 transition cursor-pointer"
          >
            <Edit2 className="h-4 w-4" /> Edit Profile
          </button>
        )}
      </div>

      {isEditing ? (
        <form onSubmit={handleUpdate} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">First Name</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full clay-input"
              />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">Last Name</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full clay-input"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full clay-input"
              />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full clay-input"
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
              className="px-6 py-2.5 rounded-full text-xs font-black uppercase bg-secondary/15 text-[#2D79A8] transition hover:bg-secondary/35 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updating}
              className="px-6 py-2.5 rounded-full text-xs font-black uppercase bg-primary text-white transition hover:bg-primary/80 cursor-pointer disabled:opacity-50"
            >
              Save Changes
            </button>
          </div>
        </form>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-secondary/10">
            <Mail className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Email</p>
              <p className="text-base font-semibold text-[#245361]">{profile.email ?? 'Not set'}</p>
            </div>
          </div>

          <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-secondary/10">
            <Phone className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Phone</p>
              <p className="text-base font-semibold text-[#245361]">{profile.phone}</p>
            </div>
          </div>

          <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-secondary/10">
            <Shield className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Access Role</p>
              <p className="text-base font-semibold text-[#245361]">{profile.role}</p>
            </div>
          </div>

          <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-secondary/10">
            <Award className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">User ID</p>
              <p className="text-xs font-semibold truncate max-w-[170px] text-[#245361]">{profile.id}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
