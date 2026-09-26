import React, { useState, useRef } from 'react';
import { Camera, Trash2, Check, X, RotateCw, Shield, UploadCloud } from 'lucide-react';
import { fetchWithAuth } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-hot-toast';

interface ProfileAvatarSectionProps {
  currentAvatarUrl?: string | null;
  firstName?: string;
  lastName?: string;
  email?: string | null;
  role?: string;
  onAvatarUpdated?: (newAvatarUrl: string | null) => void;
}

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

export default function ProfileAvatarSection({
  currentAvatarUrl,
  firstName = '',
  lastName = '',
  email = '',
  role = 'USER',
  onAvatarUpdated,
}: ProfileAvatarSectionProps) {
  const { updateUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isRemoving, setIsRemoving] = useState<boolean>(false);

  const fullName = `${firstName} ${lastName}`.trim() || 'User Profile';
  const initials = `${firstName[0] || 'U'}${lastName[0] || ''}`.toUpperCase();

  const handleTriggerPicker = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 1. Validate type
    if (!ALLOWED_TYPES.includes(file.type.toLowerCase())) {
      toast.error('Invalid image type. Please select a JPEG, PNG, or WEBP image.');
      return;
    }

    // 2. Validate size
    if (file.size > MAX_SIZE_BYTES) {
      toast.error('Image size exceeds 5MB. Please choose a smaller image.');
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const handleCancelPreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await fetchWithAuth('/auth/avatar', {
        method: 'POST',
        body: formData,
      });

      const newAvatarUrl = res.avatarUrl || null;
      updateUser({ avatarUrl: newAvatarUrl });
      if (onAvatarUpdated) {
        onAvatarUpdated(newAvatarUrl);
      }

      toast.success('Profile picture updated successfully!');
      handleCancelPreview();
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload profile picture. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = async () => {
    try {
      setIsRemoving(true);
      await fetchWithAuth('/auth/avatar', {
        method: 'DELETE',
      });

      updateUser({ avatarUrl: null });
      if (onAvatarUpdated) {
        onAvatarUpdated(null);
      }

      toast.success('Profile picture removed.');
      handleCancelPreview();
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove profile picture.');
    } finally {
      setIsRemoving(false);
    }
  };

  const activeAvatar = previewUrl || currentAvatarUrl;

  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-5">
        {/* Left Side: Avatar Display + Identity */}
        <div className="flex items-center gap-4 min-w-0 w-full sm:w-auto">
          {/* Avatar Container */}
          <div className="relative group shrink-0">
            <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl overflow-hidden border border-slate-200/90 shadow-xs bg-slate-50 flex items-center justify-center">
              {activeAvatar ? (
                <img
                  src={activeAvatar}
                  alt={fullName}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center bg-gradient-to-tr from-[#1677C8] to-[#22C55E] text-white text-xl sm:text-2xl font-bold shadow-inner">
                  {initials}
                </div>
              )}
            </div>

            {/* Quick Change Badge on Hover */}
            <button
              type="button"
              onClick={handleTriggerPicker}
              disabled={isUploading || isRemoving}
              className="absolute -bottom-1 -right-1 p-1.5 rounded-xl bg-white border border-slate-200 shadow-sm text-slate-600 hover:text-[#1677C8] hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
              title="Change picture"
              aria-label="Change profile picture"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* User Meta Information */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-[#16324F] truncate">
                {fullName}
              </h2>
              {previewUrl && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                  <span>Preview</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5 truncate">
              {email || 'No email registered'}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              JPG, PNG, or WEBP up to 5MB
            </p>
          </div>
        </div>

        {/* Right Side: Role Pill + Action Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto shrink-0">
          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* When in preview mode: Save and Cancel */}
          {previewUrl ? (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleUpload}
                disabled={isUploading}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-[#1677C8] hover:bg-[#1262a5] shadow-2xs transition cursor-pointer disabled:opacity-50"
              >
                {isUploading ? (
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>{isUploading ? 'Saving...' : 'Save Picture'}</span>
              </button>

              <button
                type="button"
                onClick={handleCancelPreview}
                disabled={isUploading}
                className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </button>
            </div>
          ) : (
            /* Standard Mode: Upload / Change & Remove */
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleTriggerPicker}
                disabled={isUploading || isRemoving}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-[#1677C8] bg-blue-50 hover:bg-blue-100/80 border border-blue-200/60 transition cursor-pointer disabled:opacity-50"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>{currentAvatarUrl ? 'Change Picture' : 'Upload Picture'}</span>
              </button>

              {currentAvatarUrl && (
                <button
                  type="button"
                  onClick={handleRemove}
                  disabled={isUploading || isRemoving}
                  className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 transition cursor-pointer disabled:opacity-50 shrink-0"
                  title="Remove picture"
                  aria-label="Remove profile picture"
                >
                  {isRemoving ? (
                    <RotateCw className="w-3.5 h-3.5 animate-spin text-rose-600" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                </button>
              )}
            </div>
          )}

          {/* Role Badge */}
          {role && (
            <div className="hidden lg:flex items-center gap-1.5 bg-[#1677C8]/10 border border-[#1677C8]/20 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#1677C8] shrink-0 self-start sm:self-auto">
              <Shield className="h-3 w-3" />
              <span>{role.replace('_', ' ')}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
