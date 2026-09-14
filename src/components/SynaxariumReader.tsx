import React, { useEffect, useState } from 'react';
import { X, BookOpen, Loader2, AlertCircle } from 'lucide-react';
import { getSynaxariumDay, type SynaxariumDay } from '../data/synaxarium';
import { formatCopticDate, type CopticDate } from '../utils/liturgicalEngine';
import { useTheme } from '../context/ThemeContext';

interface SynaxariumReaderProps {
  copticDate: CopticDate;
  onClose: () => void;
}

/**
 * Full-day Synaxarium reader. Opens on the exact Coptic day passed in —
 * shows the day's titles and the complete text, in the user's language.
 * Arabic users get the full Arabic body text; English users get English.
 */
export const SynaxariumReader: React.FC<SynaxariumReaderProps> = ({ copticDate, onClose }) => {
  const { language } = useTheme();
  const isAr = language === 'ar';
  const [day, setDay] = useState<SynaxariumDay | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setDay(null);
    setError(false);
    getSynaxariumDay(copticDate)
      .then((d) => {
        if (!cancelled) setDay(d);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [copticDate]);

  const titles = day ? (isAr ? day.ar : day.en) : [];
  // Body text: Arabic body for Arabic users (falls back to English while
  // a day's translation is still pending), English body otherwise.
  const bodyText = day ? (isAr && day.ar_text ? day.ar_text : day.text) : '';
  const showingArBody = isAr && !!day?.ar_text;
  // Body paragraphs: split on blank lines, drop the repeated title head.
  const paragraphs = React.useMemo(() => {
    if (!day) return [];
    const parts = bodyText.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    // First paragraph is usually the title repeated — drop it if it matches a title.
    if (parts.length > 1) {
      const first = parts[0].replace(/^\d+\.\s*/, '').trim().toLowerCase();
      const refTitles = showingArBody ? day.ar : day.en;
      const isTitle = refTitles.some((t) => t.toLowerCase().includes(first.slice(0, 40)) || first.includes(t.toLowerCase().slice(0, 40)));
      if (isTitle) return parts.slice(1);
    }
    return parts;
  }, [day, bodyText, showingArBody]);

  const gregorian = new Date().toLocaleDateString(isAr ? 'ar-EG' : 'en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        dir={isAr ? 'rtl' : 'ltr'}
        className="relative w-full sm:max-w-2xl max-h-[92vh] sm:max-h-[85vh] sm:rounded-3xl rounded-t-3xl bg-(--bg-card) dark:bg-[#1c1611] border-2 border-(--ln-gold) dark:border-[#8b6b4a] shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="shrink-0 px-5 py-4 border-b border-(--ln-gold) dark:border-[#8b6b4a] bg-(--bg-soft)/60 dark:bg-[#282019]/60">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-(--ac-gold)/15 border border-(--ln-gold)">
                <BookOpen className="w-5 h-5 text-(--ac-bronze-tx)" />
              </span>
              <div>
                <h2 className="font-serif-coptic font-bold text-lg text-(--tx-strong) dark:text-[#f5ebd9]">
                  {isAr ? 'السنكسار اليومي' : 'Daily Synaxarium'}
                </h2>
                <p className="text-xs text-(--tx-mute) dark:text-[#a89379] font-serif">
                  {formatCopticDate(copticDate, language)} • {gregorian}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-(--bg-deep) dark:bg-[#32251a] hover:bg-(--ac-gold) hover:text-white border border-(--ln-gold) text-(--tx-strong) dark:text-[#f5ebd9] transition-colors cursor-pointer"
              aria-label={isAr ? 'إغلاق' : 'Close'}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!day && !error && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-(--tx-mute)">
              <Loader2 className="w-8 h-8 animate-spin text-(--ac-bronze-tx)" />
              <p className="text-sm font-serif">{isAr ? 'جاري تحميل السنكسار...' : 'Loading Synaxarium...'}</p>
            </div>
          )}
          {error && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-(--tx-mute)">
              <AlertCircle className="w-8 h-8 text-red-500" />
              <p className="text-sm font-serif">
                {isAr ? 'تعذر تحميل السنكسار. حاول مرة أخرى.' : 'Could not load the Synaxarium. Please try again.'}
              </p>
            </div>
          )}
          {day && (
            <div className="space-y-5">
              {/* Titles */}
              <div className="space-y-2">
                {titles.map((title, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-2xl bg-(--bg-soft)/80 dark:bg-[#282019]/80 border border-(--ln-gold)"
                  >
                    <p className="font-serif-coptic font-bold text-sm text-(--tx-strong) dark:text-[#f5ebd9] leading-relaxed">
                      {title}
                    </p>
                  </div>
                ))}
              </div>
              {/* Full text — Arabic body for Arabic users, English otherwise */}
              <div>
                <p className="text-[10px] uppercase tracking-wider font-serif font-bold text-(--tx-mute) dark:text-[#a89379] mb-2">
                  {isAr ? (showingArBody ? 'النص الكامل' : 'النص الكامل (بالإنجليزية)') : 'Full text'}
                </p>
                <div dir={showingArBody ? 'rtl' : 'ltr'} className="space-y-3">
                  {paragraphs.map((p, i) => (
                    <p key={i} className="text-sm font-serif leading-relaxed text-(--tx-strong) dark:text-[#f5ebd9]">
                      {p}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
