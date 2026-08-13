import React, { useState } from 'react';
import { X, Users, Plus, Shield, Sparkles, Image as ImageIcon } from 'lucide-react';
import { GroupRoom } from '../types';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { createCustomGroup } from '../utils/groups';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGroupCreated: (newGroup: GroupRoom) => void;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  isOpen,
  onClose,
  onGroupCreated,
}) => {
  const { profile } = useAuth();
  const { t } = useTheme();

  const [name, setName] = useState('');
  const [type, setType] = useState<GroupRoom['type']>('bible_study');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('☦️');
  const [parish, setParish] = useState(profile?.parish || 'St. George Parish');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !description.trim()) return;

    const group = createCustomGroup({
      name: name.trim(),
      type,
      description: description.trim(),
      icon,
      hostName: profile?.full_name || 'Parish Admin',
      parish: parish.trim(),
    });

    onGroupCreated(group);
    onClose();
    setName('');
    setDescription('');
  };

  const ICON_OPTIONS = ['☦️', '📖', '🎶', '🌹', '🕊️', '⛪', '🕯️', '🍇', '✨'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-[#f6ebd6] dark:bg-[#1c1611] border-2 border-[#c5a059] dark:border-[#8b6b4a] rounded-3xl p-6 shadow-2xl text-[#3d2b18] dark:text-[#f5ebd9]">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 rtl:left-4 rtl:right-auto p-1.5 rounded-full text-[#7c5f3d] dark:text-[#a89379] hover:text-[#3d2b18] hover:bg-[#eedcb5] transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5 pb-3 border-b border-[#c5a059]/30">
          <div className="p-2.5 rounded-2xl bg-[#c5a059] text-white shadow-md">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-serif-coptic font-bold text-lg uppercase tracking-wider text-[#3d2b18] dark:text-[#f5ebd9]">
              {t('createCustomGroup')}
            </h3>
            <p className="text-xs font-serif text-[#7c5f3d] dark:text-[#a89379]">
              Form an Orthodox fellowship circle or ministry group.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-serif font-bold uppercase tracking-wider text-[#3d2b18] dark:text-[#f5ebd9] mb-1">
              {t('groupName')}
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. St. Nektarios Healing Ministry"
              className="w-full p-3 rounded-2xl bg-[#eedcb5] dark:bg-[#282019] border border-[#c5a059] text-xs text-[#3d2b18] dark:text-[#f5ebd9] focus:outline-none focus:ring-2 focus:ring-[#c5a059]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-serif font-bold uppercase tracking-wider text-[#3d2b18] dark:text-[#f5ebd9] mb-1">
                {t('groupType')}
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as GroupRoom['type'])}
                className="w-full p-3 rounded-2xl bg-[#eedcb5] dark:bg-[#282019] border border-[#c5a059] text-xs text-[#3d2b18] dark:text-[#f5ebd9] focus:outline-none"
              >
                <option value="bible_study">📖 Bible Study</option>
                <option value="youth">☦️ Youth Fellowship</option>
                <option value="choir">🎶 Choral Rehearsal</option>
                <option value="women_prayer">🌹 Women Prayer Circle</option>
                <option value="parish_live">⛪ Parish Ministry</option>
                <option value="philanthropy">🕊️ Philanthropy & Charity</option>
                <option value="general">✨ General Fellowship</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-serif font-bold uppercase tracking-wider text-[#3d2b18] dark:text-[#f5ebd9] mb-1">
                {t('groupIcon')}
              </label>
              <div className="flex gap-1 overflow-x-auto p-1.5 bg-[#eedcb5] dark:bg-[#282019] rounded-2xl border border-[#c5a059]">
                {ICON_OPTIONS.map((i) => (
                  <button
                    type="button"
                    key={i}
                    onClick={() => setIcon(i)}
                    className={`p-1.5 rounded-xl text-sm transition-transform cursor-pointer ${
                      icon === i ? 'bg-[#c5a059] scale-110 shadow-sm' : 'hover:bg-[#c5a059]/30'
                    }`}
                  >
                    {i}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-serif font-bold uppercase tracking-wider text-[#3d2b18] dark:text-[#f5ebd9] mb-1">
              {t('groupDescription')}
            </label>
            <textarea
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the purpose, meeting schedule, and Patristic study goals..."
              className="w-full p-3 rounded-2xl bg-[#eedcb5] dark:bg-[#282019] border border-[#c5a059] text-xs text-[#3d2b18] dark:text-[#f5ebd9] focus:outline-none focus:ring-2 focus:ring-[#c5a059]"
            />
          </div>

          <div>
            <label className="block text-xs font-serif font-bold uppercase tracking-wider text-[#3d2b18] dark:text-[#f5ebd9] mb-1">
              Parish / Monastery Affiliation
            </label>
            <input
              type="text"
              value={parish}
              onChange={(e) => setParish(e.target.value)}
              placeholder="e.g. St. George Antiochian Church"
              className="w-full p-3 rounded-2xl bg-[#eedcb5] dark:bg-[#282019] border border-[#c5a059] text-xs text-[#3d2b18] dark:text-[#f5ebd9] focus:outline-none"
            />
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-2xl bg-[#eedcb5] dark:bg-[#282019] text-[#3d2b18] dark:text-[#f5ebd9] font-serif font-bold text-xs uppercase tracking-wider border border-[#c5a059]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-2xl bg-[#c5a059] hover:bg-[#a8833c] text-white font-serif font-bold text-xs uppercase tracking-wider shadow-lg transition-all cursor-pointer flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>{t('createCustomGroup')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
