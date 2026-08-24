import React, { useState } from 'react';
import { X, Flag, AlertTriangle, Shield, CheckCircle } from 'lucide-react';
import { submitContentReport } from '../utils/moderation';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

interface ReportContentModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: 'post' | 'comment' | 'user';
  targetId: string;
  targetContentPreview?: string;
  targetAuthorName?: string;
  targetAuthorId?: string;
}

export const ReportContentModal: React.FC<ReportContentModalProps> = ({
  isOpen,
  onClose,
  targetType,
  targetId,
  targetContentPreview,
  targetAuthorName,
  targetAuthorId,
}) => {
  const { profile } = useAuth();
  const { t, language } = useTheme();

  const [reason, setReason] = useState<'inappropriate' | 'spam' | 'uncanonical_heresy' | 'harassment' | 'other'>('inappropriate');
  const [details, setDetails] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    await submitContentReport({
      targetType,
      targetId,
      targetContentPreview,
      targetAuthorName,
      targetAuthorId,
      reporterId: profile?.id || 'me',
      reporterName: profile?.full_name || (language === 'ar' ? 'عضو بالرعية' : 'Parishioner'),
      reason,
      details: details.trim(),
    });

    setIsSubmitting(false);
    setIsSubmitted(true);

    setTimeout(() => {
      setIsSubmitted(false);
      onClose();
    }, 1800);
  };

  const getTargetTitle = () => {
    if (language === 'ar') {
      if (targetType === 'post') return 'الإبلاغ عن منشور';
      if (targetType === 'comment') return 'الإبلاغ عن تعليق';
      return 'الإبلاغ عن مستخدم';
    }
    return `Report ${targetType === 'post' ? 'Post' : targetType === 'comment' ? 'Comment' : 'User'}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md bg-[#fdfaf5] dark:bg-[#1c1611] border border-[#d4af37]/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-left rtl:text-right">
        {/* Modal Header */}
        <div className="p-4 border-b border-[#d4af37]/20 bg-[#f1ebd7] dark:bg-[#282019] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flag className="w-5 h-5 text-red-600" />
            <h3 className="font-serif font-bold text-base text-[#5a4632] dark:text-[#f5ebd9]">
              {getTargetTitle()}
            </h3>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-[#8b6b4a] dark:text-[#a89379] hover:text-[#5a4632] dark:hover:text-white rounded-lg hover:bg-[#d4af37]/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isSubmitted ? (
          <div className="p-8 text-center space-y-3">
            <CheckCircle className="w-12 h-12 text-emerald-600 mx-auto animate-bounce" />
            <h4 className="font-serif font-bold text-lg text-[#5a4632] dark:text-[#f5ebd9]">
              {language === 'ar' ? 'تم إرسال البلاغ بنجاح' : 'Report Submitted'}
            </h4>
            <p className="text-xs text-[#8b6b4a] dark:text-[#a89379]">
              {language === 'ar'
                ? 'شكراً لك. تم إخطار كهنة ومشرفي الرعية لمراجعة المحتوى وفقاً للتعاليم والضوابط الكنسية.'
                : 'Thank you. Parish clergy & moderators have been notified to review this content according to Church guidelines.'}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {targetContentPreview && (
              <div className="p-3 rounded-xl bg-[#f5f2ed] dark:bg-[#282019] border border-[#d4af37]/20 text-xs text-[#4a3e31] dark:text-[#f5ebd9] italic leading-relaxed">
                "{targetContentPreview.length > 120 ? targetContentPreview.slice(0, 120) + '...' : targetContentPreview}"
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-[#8b6b4a] dark:text-[#c5a059] uppercase tracking-wider mb-2">
                {language === 'ar' ? 'سبب البلاغ' : 'Reason for Report'}
              </label>
              <div className="space-y-2 text-xs">
                <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[#f5f2ed] dark:bg-[#282019] border border-[#d4af37]/20 cursor-pointer hover:border-[#d4af37]/40">
                  <input
                    type="radio"
                    name="reportReason"
                    value="inappropriate"
                    checked={reason === 'inappropriate'}
                    onChange={() => setReason('inappropriate')}
                    className="accent-[#d4af37]"
                  />
                  <span className="font-semibold text-[#5a4632] dark:text-[#f5ebd9]">
                    {language === 'ar' ? 'محتوى غير لائق أو مسيء' : 'Inappropriate or Offensive Content'}
                  </span>
                </label>

                <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[#f5f2ed] dark:bg-[#282019] border border-[#d4af37]/20 cursor-pointer hover:border-[#d4af37]/40">
                  <input
                    type="radio"
                    name="reportReason"
                    value="uncanonical_heresy"
                    checked={reason === 'uncanonical_heresy'}
                    onChange={() => setReason('uncanonical_heresy')}
                    className="accent-[#d4af37]"
                  />
                  <span className="font-semibold text-[#5a4632] dark:text-[#f5ebd9]">
                    {language === 'ar' ? 'بدع مخالفة لقوانين الكنيسة / لاهوت مضلل' : 'Uncanonical Heresy / Misleading Theology'}
                  </span>
                </label>

                <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[#f5f2ed] dark:bg-[#282019] border border-[#d4af37]/20 cursor-pointer hover:border-[#d4af37]/40">
                  <input
                    type="radio"
                    name="reportReason"
                    value="spam"
                    checked={reason === 'spam'}
                    onChange={() => setReason('spam')}
                    className="accent-[#d4af37]"
                  />
                  <span className="font-semibold text-[#5a4632] dark:text-[#f5ebd9]">
                    {language === 'ar' ? 'محتوى مكرر (سبام) أو إعلانات تجارية' : 'Spam, Scams, or Commercial Ads'}
                  </span>
                </label>

                <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[#f5f2ed] dark:bg-[#282019] border border-[#d4af37]/20 cursor-pointer hover:border-[#d4af37]/40">
                  <input
                    type="radio"
                    name="reportReason"
                    value="harassment"
                    checked={reason === 'harassment'}
                    onChange={() => setReason('harassment')}
                    className="accent-[#d4af37]"
                  />
                  <span className="font-semibold text-[#5a4632] dark:text-[#f5ebd9]">
                    {language === 'ar' ? 'مضايقات أو تهجم شخصي' : 'Harassment or Personal Attacks'}
                  </span>
                </label>

                <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[#f5f2ed] dark:bg-[#282019] border border-[#d4af37]/20 cursor-pointer hover:border-[#d4af37]/40">
                  <input
                    type="radio"
                    name="reportReason"
                    value="other"
                    checked={reason === 'other'}
                    onChange={() => setReason('other')}
                    className="accent-[#d4af37]"
                  />
                  <span className="font-semibold text-[#5a4632] dark:text-[#f5ebd9]">
                    {language === 'ar' ? 'مشكلة أخرى' : 'Other Issue'}
                  </span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#8b6b4a] dark:text-[#c5a059] uppercase tracking-wider mb-1.5">
                {language === 'ar' ? 'تفاصيل إضافية (اختياري)' : 'Additional Details (Optional)'}
              </label>
              <textarea
                rows={2}
                placeholder={
                  language === 'ar'
                    ? 'أضف أي توضيحات لمساعدة المشرفين...'
                    : 'Provide details to assist parish moderators...'
                }
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#f5f2ed] dark:bg-[#282019] border border-[#d4af37]/30 text-xs text-[#2c2c2c] dark:text-[#f5ebd9] placeholder-[#8b6b4a]/60 focus:outline-none focus:border-[#d4af37]"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-bold text-[#8b6b4a] dark:text-[#a89379] hover:bg-[#f1ebd7] dark:hover:bg-[#282019] transition-colors cursor-pointer"
              >
                {t('cancel')}
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Flag className="w-3.5 h-3.5" />
                <span>
                  {isSubmitting
                    ? language === 'ar'
                      ? 'جارٍ الإرسال...'
                      : 'Submitting...'
                    : language === 'ar'
                    ? 'إرسال البلاغ'
                    : 'Submit Report'}
                </span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
