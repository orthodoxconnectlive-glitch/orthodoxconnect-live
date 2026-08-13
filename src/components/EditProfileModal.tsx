import React, { useState, useEffect } from 'react';
import { X, User, Church, FileText, Image as ImageIcon, Lock, Check, AlertCircle, Upload, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { uploadMediaFile } from '../utils/storage';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({ isOpen, onClose }) => {
  const { user, profile, updateProfile, updatePassword } = useAuth();
  const { t } = useTheme();

  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [parish, setParish] = useState(profile?.parish || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen && profile) {
      setFullName(profile.full_name || '');
      setParish(profile.parish || '');
      setBio(profile.bio || '');
      setAvatarUrl(profile.avatar_url || '');
      setNewPassword('');
      setConfirmPassword('');
      setStatusMessage(null);
      setIsSubmitting(false);
    }
  }, [isOpen, profile]);

  const AVATAR_PRESETS = [
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=200',
    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
  ];

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setStatusMessage({ type: 'error', text: 'Image file size must be less than 10MB.' });
        return;
      }
      setStatusMessage({ type: 'success', text: 'Uploading avatar photo...' });
      const url = await uploadMediaFile(file, 'avatars');
      setAvatarUrl(url);
      setStatusMessage({ type: 'success', text: 'Profile photo updated successfully!' });
    }
    e.target.value = '';
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatusMessage(null);

    // Validate passwords if provided
    if (newPassword.trim().length > 0) {
      if (newPassword.trim().length < 6) {
        setStatusMessage({ type: 'error', text: 'Password must be at least 6 characters.' });
        setIsSubmitting(false);
        return;
      }

      if (confirmPassword.trim() && newPassword.trim() !== confirmPassword.trim()) {
        setStatusMessage({ type: 'error', text: 'Passwords do not match.' });
        setIsSubmitting(false);
        return;
      }
    }

    // 1. Update Profile Information
    const { error: profError } = await updateProfile({
      full_name: fullName,
      parish,
      bio,
      avatar_url: avatarUrl,
    });

    if (profError) {
      setStatusMessage({ type: 'error', text: profError.message });
      setIsSubmitting(false);
      return;
    }

    // 2. Update Password if provided
    if (newPassword.trim().length > 0) {
      const { error: passError } = await updatePassword(newPassword.trim());
      if (passError) {
        setStatusMessage({ type: 'error', text: passError.message });
        setIsSubmitting(false);
        return;
      }
    }

    setStatusMessage({ type: 'success', text: 'Profile & security settings updated successfully!' });
    setIsSubmitting(false);
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg bg-[#1c1611] border-2 border-[#c5a059] rounded-3xl p-6 shadow-2xl text-[#f5ebd9] max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-[#a89379] hover:text-[#f5ebd9] hover:bg-[#282019] transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6 pb-3 border-b border-[#c5a059]/30">
          <div className="w-10 h-10 rounded-2xl bg-[#c5a059]/20 border border-[#c5a059] flex items-center justify-center text-[#c5a059]">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-serif-coptic font-bold text-lg text-[#f5ebd9] uppercase tracking-wider">
              {t('editProfile')}
            </h3>
            <p className="text-xs text-[#a89379] font-serif">
              Update your OrthodoxConnect parish identity and password
            </p>
          </div>
        </div>

        {statusMessage && (
          <div
            className={`p-3 rounded-2xl mb-4 text-xs font-serif font-bold flex items-center gap-2 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-950/80 border border-emerald-500/40 text-emerald-300'
                : 'bg-red-950/80 border border-red-500/40 text-red-300'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <Check className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Avatar Preview & URL / Presets / Upload */}
          <div className="space-y-2">
            <label className="block text-[#c5a059] font-serif font-bold uppercase tracking-wider text-[11px]">
              Profile Photo / Avatar
            </label>

            <div className="flex gap-4 items-center">
              <div className="relative">
                <img
                  src={avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200'}
                  alt="Avatar Preview"
                  className="w-16 h-16 rounded-2xl border-2 border-[#c5a059] object-cover shrink-0 shadow-lg"
                />
              </div>

              <div className="flex-1 space-y-2">
                <div className="relative">
                  <ImageIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#a89379]" />
                  <input
                    type="url"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    placeholder="Paste photo URL (https://...)"
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#282019] border border-[#c5a059]/40 text-[#f5ebd9] placeholder-[#a89379]/60 focus:outline-none focus:border-[#c5a059] text-xs font-serif"
                  />
                </div>

                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#c5a059] hover:bg-[#a8833c] text-[#1c1611] text-[11px] font-serif font-bold uppercase tracking-wider rounded-xl cursor-pointer transition-colors shadow-md">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Photo from Device</span>
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>
            </div>

            {/* Presets */}
            <div className="pt-2">
              <span className="text-[10px] text-[#a89379] font-serif uppercase tracking-wider block mb-1.5">
                Or choose an Orthodox portrait preset:
              </span>
              <div className="flex gap-2.5">
                {AVATAR_PRESETS.map((url, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setAvatarUrl(url)}
                    className={`w-10 h-10 rounded-2xl overflow-hidden border-2 cursor-pointer transition-transform hover:scale-105 ${
                      avatarUrl === url ? 'border-[#c5a059] ring-2 ring-[#c5a059]' : 'border-[#282019]'
                    }`}
                  >
                    <img src={url} alt={`Preset ${i}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-[#c5a059] font-serif font-bold uppercase tracking-wider text-[11px] mb-1">
              {t('fullName')}
            </label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#a89379]" />
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#282019] border border-[#c5a059]/40 text-[#f5ebd9] focus:outline-none focus:border-[#c5a059] font-serif"
              />
            </div>
          </div>

          {/* Parish */}
          <div>
            <label className="block text-[#c5a059] font-serif font-bold uppercase tracking-wider text-[11px] mb-1">
              {t('parish')}
            </label>
            <div className="relative">
              <Church className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#a89379]" />
              <input
                type="text"
                required
                value={parish}
                onChange={(e) => setParish(e.target.value)}
                placeholder="e.g. St. Mark Coptic Orthodox Cathedral"
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#282019] border border-[#c5a059]/40 text-[#f5ebd9] placeholder-[#a89379]/60 focus:outline-none focus:border-[#c5a059] font-serif"
              />
            </div>
          </div>

          {/* Bio */}
          <div>
            <label className="block text-[#c5a059] font-serif font-bold uppercase tracking-wider text-[11px] mb-1">
              {t('bio')}
            </label>
            <div className="relative">
              <FileText className="w-4 h-4 absolute left-3 top-3 text-[#a89379]" />
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="A short reflection or parish bio..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#282019] border border-[#c5a059]/40 text-[#f5ebd9] placeholder-[#a89379]/60 focus:outline-none focus:border-[#c5a059] font-serif"
              />
            </div>
          </div>

          {/* Password Update */}
          <div className="pt-3 border-t border-[#c5a059]/30 space-y-3">
            <div className="flex items-center gap-1.5 text-[#c5a059] font-serif font-bold uppercase tracking-wider text-[11px]">
              <KeyRound className="w-4 h-4" />
              <span>Security & Change Password</span>
            </div>

            <div>
              <label className="block text-[#a89379] font-serif text-[10px] uppercase mb-1">
                New Password (at least 6 characters)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#a89379]" />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Leave blank if unchanged"
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#282019] border border-[#c5a059]/40 text-[#f5ebd9] placeholder-[#a89379]/60 focus:outline-none focus:border-[#c5a059] font-serif"
                />
              </div>
            </div>

            {newPassword.trim().length > 0 && (
              <div>
                <label className="block text-[#a89379] font-serif text-[10px] uppercase mb-1">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#a89379]" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#282019] border border-[#c5a059]/40 text-[#f5ebd9] placeholder-[#a89379]/60 focus:outline-none focus:border-[#c5a059] font-serif"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-[#282019] hover:bg-[#3d2b18] text-[#a89379] font-serif font-bold text-xs uppercase tracking-wider cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-[#c5a059] hover:bg-[#a8833c] text-[#1c1611] font-serif font-bold text-xs uppercase tracking-wider shadow-lg cursor-pointer disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? 'Saving Changes...' : t('updateProfile')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

