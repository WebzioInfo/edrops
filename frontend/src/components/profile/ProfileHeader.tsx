import { useState, useRef, type ChangeEvent } from 'react';
import { Camera, Edit2, RotateCw, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react';
import { fetchWithAuth } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-hot-toast';

interface ProfileHeaderProps {
  profile: {
    id: string;
    avatarUrl?: string | null;
    firstName: string;
    lastName: string;
    email?: string | null;
    phone?: string;
    role: string;
    accountStatus?: string;
  };
  onAvatarUpdated: (newAvatarUrl: string | null) => void;
  onEditProfileClick: () => void;
}

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/octet-stream',
];
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'];

export default function ProfileHeader({
  profile,
  onAvatarUpdated,
  onEditProfileClick,
}: ProfileHeaderProps) {
  const { updateUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Upload & processing state
  const [uploadStatus, setUploadStatus] = useState<
    'IDLE' | 'UPLOADING' | 'PROCESSING' | 'SAVING' | 'COMPLETED' | 'ERROR'
  >('IDLE');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isRemoving, setIsRemoving] = useState<boolean>(false);

  const fullName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'User Profile';
  const initials = `${(profile.firstName || 'U')[0]}${(profile.lastName || '')[0] || ''}`.toUpperCase();

  const handleTriggerPicker = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const mime = file.type.toLowerCase();

    const isAllowedExt = ALLOWED_EXTENSIONS.includes(ext);
    const isAllowedMime = ALLOWED_MIME_TYPES.includes(mime);

    if (!isAllowedExt && !isAllowedMime) {
      toast.error('Invalid image type. Please select a JPG, PNG, WEBP, or HEIC/HEIF image.');
      return;
    }

    if (file.size > MAX_SIZE_BYTES) {
      toast.error('Image size exceeds 5MB. Please choose a smaller image.');
      return;
    }

    setPreviewFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const handleCancelPreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewFile(null);
    setPreviewUrl(null);
    setUploadStatus('IDLE');
    setStatusMessage('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const pollJobStatus = async (jobId: string, maxAttempts = 30): Promise<string> => {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      try {
        const res = await fetchWithAuth(`/profile/avatar/status/${jobId}`);
        if (res.status === 'COMPLETED' && res.avatarUrl) {
          return res.avatarUrl;
        }
        if (res.status === 'FAILED') {
          throw new Error(res.errorMessage || 'Unable to process this image. Please try another image.');
        }
        setStatusMessage('Optimizing & converting image format...');
      } catch (err: any) {
        if (err.message && err.message.includes('Unable to process')) {
          throw err;
        }
      }
    }
    throw new Error('Image processing timed out. Please try again.');
  };

  const handleUpload = async () => {
    if (!previewFile) return;

    try {
      setUploadStatus('UPLOADING');
      setStatusMessage('Uploading image...');

      const formData = new FormData();
      formData.append('file', previewFile);

      const res = await fetchWithAuth('/profile/avatar', {
        method: 'POST',
        body: formData,
      });

      let finalUrl = res.avatarUrl;

      // If asynchronous job returned, poll for completion
      if (res.jobId && res.status === 'PROCESSING') {
        setUploadStatus('PROCESSING');
        setStatusMessage('Processing & converting image (HEIC/JPEG/PNG)...');
        finalUrl = await pollJobStatus(res.jobId);
      }

      setUploadStatus('SAVING');
      setStatusMessage('Saving profile picture...');

      updateUser({ avatarUrl: finalUrl });
      onAvatarUpdated(finalUrl);

      setUploadStatus('COMPLETED');
      setStatusMessage('Profile picture updated!');
      toast.success('Profile picture updated successfully!');

      setTimeout(() => {
        handleCancelPreview();
      }, 1000);
    } catch (err: any) {
      setUploadStatus('ERROR');
      setStatusMessage(err.message || 'Unable to process this image. Please try another image.');
      toast.error(err.message || 'Failed to upload profile picture.');
    }
  };

  const handleRemoveAvatar = async () => {
    if (!profile.avatarUrl) return;
    try {
      setIsRemoving(true);
      await fetchWithAuth('/profile/avatar', {
        method: 'DELETE',
      });

      updateUser({ avatarUrl: null });
      onAvatarUpdated(null);
      toast.success('Profile picture removed.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove profile picture.');
    } finally {
      setIsRemoving(false);
    }
  };

  const roleLabel = (profile.role || 'USER').replace(/_/g, ' ');
  const statusLabel = profile.accountStatus || 'ACTIVE';
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 sm:p-6">
      <div className="flex flex-row items-start gap-3.5 sm:gap-6">
        {/* Avatar & Picture Controls */}
        <div className="flex flex-col items-center sm:items-start gap-1.5 sm:gap-2.5 shrink-0">
          <div className="relative group shrink-0">
            <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-2xl overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 border border-slate-200/90 flex items-center justify-center text-slate-600 font-bold text-xl sm:text-2xl shadow-inner relative">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Avatar preview"
                  className="w-full h-full object-cover"
                />
              ) : profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={fullName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="tracking-wider text-slate-500 font-bold text-xl sm:text-2xl">
                  {initials}
                </span>
              )}

              {/* Uploading / Processing Overlay */}
              {uploadStatus !== 'IDLE' && (
                <div className="absolute inset-0 bg-slate-900/75 backdrop-blur-[2px] flex flex-col items-center justify-center text-white p-1.5 text-center animate-in fade-in">
                  {uploadStatus === 'COMPLETED' ? (
                    <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400 mb-0.5" />
                  ) : uploadStatus === 'ERROR' ? (
                    <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6 text-rose-400 mb-0.5" />
                  ) : (
                    <RotateCw className="w-5 h-5 sm:w-6 sm:h-6 text-sky-400 animate-spin mb-0.5" />
                  )}
                  <span className="text-[9px] sm:text-[10px] font-semibold leading-tight line-clamp-2">
                    {statusMessage || 'Processing...'}
                  </span>
                </div>
              )}
            </div>

            {/* Quick Camera Action Badge */}
            {!previewFile && uploadStatus === 'IDLE' && (
              <button
                type="button"
                onClick={handleTriggerPicker}
                title="Change Picture"
                className="absolute -bottom-1 -right-1 p-1.5 sm:p-2 rounded-xl bg-[#1677C8] hover:bg-[#125ea0] text-white shadow-md transition-transform active:scale-95 cursor-pointer border-2 border-white"
              >
                <Camera className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* Desktop Picture Actions (Change / Remove) */}
          {!previewFile ? (
            <div className="hidden sm:flex flex-col items-start gap-1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTriggerPicker}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-[11px] font-bold text-slate-700 shadow-2xs transition cursor-pointer flex items-center gap-1.5"
                >
                  <Camera className="w-3 h-3 text-[#1677C8]" />
                  <span>Change</span>
                </button>

                {profile.avatarUrl && (
                  <button
                    type="button"
                    disabled={isRemoving}
                    onClick={handleRemoveAvatar}
                    className="px-2 py-1 rounded-lg border border-rose-100 hover:border-rose-200 bg-rose-50/40 hover:bg-rose-50 text-[11px] font-bold text-rose-600 transition cursor-pointer flex items-center gap-1 disabled:opacity-50"
                  >
                    <Trash2 className="w-3 h-3 text-rose-500" />
                    <span>Remove</span>
                  </button>
                )}
              </div>
              <p className="text-[10px] text-slate-400 font-medium tracking-tight">
                JPG, PNG, WEBP or HEIC · Max 5MB
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center sm:items-start gap-1.5 animate-in fade-in">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={handleUpload}
                  className="px-2.5 py-1 rounded-lg bg-[#1677C8] hover:bg-[#125ea0] text-white text-[10.5px] sm:text-[11px] font-bold transition shadow-xs cursor-pointer"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={handleCancelPreview}
                  className="px-2 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[10.5px] sm:text-[11px] font-bold text-slate-600 transition cursor-pointer"
                >
                  Cancel
                </button>
              </div>
              <p className="text-[9.5px] sm:text-[10px] text-slate-400 font-medium tracking-tight">
                Previewing
              </p>
            </div>
          )}
        </div>

        {/* User Identity Details & Action Buttons */}
        <div className="flex-1 text-left space-y-1.5 sm:space-y-3 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-3">
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight leading-tight truncate">
                {fullName}
              </h1>
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-1">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9.5px] sm:text-[10px] font-extrabold bg-[#1677C8]/10 text-[#1677C8] uppercase tracking-wider">
                  {roleLabel}
                </span>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9.5px] sm:text-[10px] font-extrabold uppercase tracking-wider ${
                    statusLabel === 'ACTIVE'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                      : 'bg-amber-50 text-amber-700 border border-amber-200/60'
                  }`}
                >
                  {statusLabel}
                </span>
              </div>
            </div>

            {/* Edit Profile Action */}
            <button
              type="button"
              onClick={onEditProfileClick}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 shadow-2xs transition active:scale-95 cursor-pointer self-start sm:self-auto"
            >
              <Edit2 className="w-3.5 h-3.5 text-[#1677C8]" />
              <span>Edit Profile</span>
            </button>
          </div>

          <div className="text-xs text-slate-600 font-medium space-y-0.5">
            {profile.email && <p className="truncate text-slate-500">{profile.email}</p>}
            {profile.phone && <p className="font-mono text-slate-700">{profile.phone}</p>}
          </div>

          {/* Mobile-only remove picture link if exists */}
          {profile.avatarUrl && !previewFile && (
            <div className="sm:hidden pt-0.5">
              <button
                type="button"
                disabled={isRemoving}
                onClick={handleRemoveAvatar}
                className="text-[11px] font-semibold text-rose-500 hover:text-rose-600 flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3 h-3 text-rose-500" />
                <span>Remove picture</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
