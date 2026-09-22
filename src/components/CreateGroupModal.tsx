import React, { useState, useEffect } from 'react';
import { X, Users, Plus, Save } from 'lucide-react';
import { GroupRoom } from '../types';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { createCustomGroup, updateServerBackedGroup } from '../utils/groups';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGroupCreated: (newGroup: GroupRoom) => void;
  editGroup?: GroupRoom | null;
  onGroupUpdated?: (updated: GroupRoom) => void;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  isOpen,
  onClose,
  onGroupCreated,
  editGroup = null,
  onGroupUpdated,
}) => {
  const { profile } = useAuth();
  const { t, language } = useTheme();

  const isEdit = Boolean(editGroup);

  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [type, setType] = useState<GroupRoom['type']>('bible_study');
  const [descAr, setDescAr] = useState('');
  const [descEn, setDescEn] = useState('');
  const [icon, setIcon] = useState('☦️');
  const [parish, setParish] = useState('');
  const [saving, setSaving] = useState(false);

  // Reset / prefill whenever the modal opens or the edited group changes.
  useEffect(() => {
    if (!isOpen) return;
    setNameAr(editGroup?.name_ar || (language === 'ar' ? editGroup?.name || '' : ''));
    setNameEn(editGroup?.name_en || (language !== 'ar' ? editGroup?.name || '' : ''));
    setType(editGroup?.type || 'bible_study');
    setDescAr(editGroup?.description_ar || (language === 'ar' ? editGroup?.description || '' : ''));
    setDescEn(editGroup?.description_en || (language !== 'ar' ? editGroup?.description || '' : ''));
    setIcon(editGroup?.icon || '☦️');
    setParish(editGroup?.parish || profile?.parish || (language === 'ar' ? 'رعية مار جرجس' : 'St. George Parish'));
  }, [isOpen, editGroup]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const nAr = nameAr.trim();
    const nEn = nameEn.trim();
    if (!nAr && !nEn) return;

    setSaving(true);
    try {
      if (isEdit && editGroup) {
        const patch: Partial<GroupRoom> = {
          name: nAr || nEn,
          name_ar: nAr,
          name_en: nEn,
          type,
          description: nAr ? descAr.trim() || descEn.trim() : descEn.trim(),
          description_ar: descAr.trim(),
          description_en: descEn.trim(),
          icon,
          parish: parish.trim(),
        };
        const updated = await updateServerBackedGroup(editGroup.id, patch);
        onGroupUpdated?.(updated || { ...editGroup, ...patch });
      } else {
        const group = await createCustomGroup({
          name: nAr || nEn,
          name_ar: nAr,
          name_en: nEn,
          type,
          description: nAr ? descAr.trim() || descEn.trim() : descEn.trim(),
          description_ar: descAr.trim(),
          description_en: descEn.trim(),
          icon,
          hostName: profile?.full_name || (language === 'ar' ? 'مسؤول الرعية' : 'Parish Admin'),
          parish: parish.trim(),
        });
        onGroupCreated(group);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const ICON_OPTIONS = ['☦️', '📖', '🎶', '🌹', '🕊️', '⛪', '🕯️', '🍇', '✨'];

  const inputCls =
    'w-full p-3 rounded-2xl bg-(--bg-soft) dark:bg-[#282019] border border-(--ln-gold) text-xs text-(--tx-strong) dark:text-[#f5ebd9] focus:outline-none focus:ring-2 focus:ring-(--ac-gold)';
  const labelCls =
    'block text-xs font-serif font-bold uppercase tracking-wider text-(--tx-strong) dark:text-[#f5ebd9] mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-(--bg-card) dark:bg-[#1c1611] border-2 border-(--ln-gold) dark:border-[#8b6b4a] rounded-3xl p-6 shadow-2xl text-(--tx-strong) dark:text-[#f5ebd9] text-left rtl:text-right max-h-[92vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 rtl:right-auto rtl:left-4 p-1.5 rounded-full text-(--tx-mute) dark:text-[#a89379] hover:text-(--tx-strong) hover:bg-(--bg-soft) transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5 pb-3 border-b border-(--ln-gold)/30">
          <div className="p-2.5 rounded-2xl bg-(--ac-gold) text-white shadow-md">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-serif-coptic font-bold text-lg uppercase tracking-wider text-(--tx-strong) dark:text-[#f5ebd9]">
              {isEdit ? (language === 'ar' ? 'تعديل المجموعة' : 'Edit Group') : t('createCustomGroup')}
            </h3>
            <p className="text-xs font-serif text-(--tx-mute) dark:text-[#a89379]">
              {language === 'ar'
                ? 'اكتب الاسم والوصف بالعربية والإنجليزية ليظهرا حسب لغة التطبيق.'
                : 'Write the name and description in Arabic and English so they follow the app language.'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelCls}>{language === 'ar' ? 'اسم المجموعة (عربي)' : 'Group name (Arabic)'}</label>
            <input
              type="text"
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
              placeholder="مثال: قصص من الكتاب المقدس للأطفال"
              className={inputCls}
              dir="rtl"
            />
          </div>

          <div>
            <label className={labelCls}>{language === 'ar' ? 'اسم المجموعة (إنجليزي)' : 'Group name (English)'}</label>
            <input
              type="text"
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              placeholder="e.g. Bible Stories for Kids"
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{t('groupType')}</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as GroupRoom['type'])}
                className="w-full p-3 rounded-2xl bg-(--bg-soft) dark:bg-[#282019] border border-(--ln-gold) text-xs text-(--tx-strong) dark:text-[#f5ebd9] focus:outline-none"
              >
                <option value="bible_study">{language === 'ar' ? '📖 دراسة الكتاب المقدس' : '📖 Bible Study'}</option>
                <option value="youth">{language === 'ar' ? '☦️ زمالة الشبيبة' : '☦️ Youth Fellowship'}</option>
                <option value="choir">{language === 'ar' ? '🎶 تمارين الخورس الكنسي' : '🎶 Choral Rehearsal'}</option>
                <option value="women_prayer">{language === 'ar' ? '🌹 حلقة صلاة السيدات' : '🌹 Women Prayer Circle'}</option>
                <option value="parish_live">{language === 'ar' ? '⛪ خدمة وأنشطة الرعية' : '⛪ Parish Ministry'}</option>
                <option value="philanthropy">{language === 'ar' ? '🕊️ أعمال البر والرحمة' : '🕊️ Philanthropy & Charity'}</option>
                <option value="general">{language === 'ar' ? '✨ زمالة روحية عامة' : '✨ General Fellowship'}</option>
              </select>
            </div>

            <div>
              <label className={labelCls}>{t('groupIcon')}</label>
              <div className="flex gap-1 overflow-x-auto p-1.5 bg-(--bg-soft) dark:bg-[#282019] rounded-2xl border border-(--ln-gold)">
                {ICON_OPTIONS.map((i) => (
                  <button
                    type="button"
                    key={i}
                    onClick={() => setIcon(i)}
                    className={`p-1.5 rounded-xl text-sm transition-transform cursor-pointer ${
                      icon === i ? 'bg-(--ac-gold) scale-110 shadow-sm' : 'hover:bg-(--ac-gold)/30'
                    }`}
                  >
                    {i}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className={labelCls}>{language === 'ar' ? 'وصف المجموعة (عربي)' : 'Group description (Arabic)'}</label>
            <textarea
              rows={2}
              value={descAr}
              onChange={(e) => setDescAr(e.target.value)}
              placeholder="اكتب هدف المجموعة ومواعيد اللقاءات..."
              className={inputCls}
              dir="rtl"
            />
          </div>

          <div>
            <label className={labelCls}>{language === 'ar' ? 'وصف المجموعة (إنجليزي)' : 'Group description (English)'}</label>
            <textarea
              rows={2}
              value={descEn}
              onChange={(e) => setDescEn(e.target.value)}
              placeholder="Describe the purpose and meeting schedule..."
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>{language === 'ar' ? 'التبعية الكنسية / الدير' : 'Parish / Monastery Affiliation'}</label>
            <input
              type="text"
              value={parish}
              onChange={(e) => setParish(e.target.value)}
              placeholder={language === 'ar' ? 'مثال: كنيسة القديس جاورجيوس الأنطاكية' : 'e.g. St. George Antiochian Church'}
              className={inputCls}
            />
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-2xl bg-(--bg-soft) dark:bg-[#282019] text-(--tx-strong) dark:text-[#f5ebd9] font-serif font-bold text-xs uppercase tracking-wider border border-(--ln-gold)"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-2xl bg-(--ac-gold) hover:bg-(--ac-bronze) text-white font-serif font-bold text-xs uppercase tracking-wider shadow-lg transition-all cursor-pointer flex items-center gap-2 disabled:opacity-60"
            >
              {isEdit ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              <span>
                {saving
                  ? (language === 'ar' ? 'جارٍ الحفظ...' : 'Saving...')
                  : isEdit
                    ? (language === 'ar' ? 'حفظ' : 'Save')
                    : t('createCustomGroup')}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
