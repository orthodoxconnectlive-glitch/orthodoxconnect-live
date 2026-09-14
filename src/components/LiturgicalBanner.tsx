import React, { useEffect, useState } from 'react';
import { Calendar, BookOpen, Utensils, Share2, Check, Sparkles, ChevronRight } from 'lucide-react';
import { getTodayLiturgicalDayWithSynaxarium, type LiturgicalDay } from '../data/liturgical';
import { getCopticDate, formatCopticDate, COPTIC_MONTHS_EN, COPTIC_MONTHS_AR, type CopticDate } from '../utils/liturgicalEngine';
import { SynaxariumReader } from './SynaxariumReader';
import { useTheme } from '../context/ThemeContext';

interface LiturgicalBannerProps {
  onOpenCalendar?: () => void;
  /** Share-link deep link: "MM-DD" Coptic key opens the reader on that day. */
  openSynaxKey?: string | null;
  onOpenSynaxConsumed?: () => void;
}

export const LiturgicalBanner: React.FC<LiturgicalBannerProps> = ({ onOpenCalendar, openSynaxKey, onOpenSynaxConsumed }) => {
  const { t, language } = useTheme();
  const [copied, setCopied] = useState(false);
  const [todayData, setTodayData] = useState<LiturgicalDay | null>(null);
  const [readerDate, setReaderDate] = useState<CopticDate | null>(null);

  useEffect(() => {
    let cancelled = false;
    getTodayLiturgicalDayWithSynaxarium(language).then((d) => {
      if (!cancelled) setTodayData(d);
    });
    return () => {
      cancelled = true;
    };
  }, [language]);

  // Share-link deep link: ?synax=MM-DD opens the reader on that Coptic day.
  useEffect(() => {
    if (!openSynaxKey) return;
    const m = /^(\d{2})-(\d{2})$/.exec(openSynaxKey.trim());
    if (m) {
      const month = Number(m[1]);
      const day = Number(m[2]);
      const valid = month >= 1 && month <= 13 && day >= 1 && (month === 13 ? day <= 6 : day <= 30);
      if (valid) {
        const year = getCopticDate(new Date()).year;
        setReaderDate({
          year,
          month,
          day,
          monthEn: COPTIC_MONTHS_EN[month - 1],
          monthAr: COPTIC_MONTHS_AR[month - 1],
        });
      }
    }
    onOpenSynaxConsumed && onOpenSynaxConsumed();
  }, [openSynaxKey]);

  const handleShareScripture = () => {
    if (!todayData) return;
    const prefix = language === 'ar' ? 'القراءة الأرثوذكسية اليومية' : 'Daily Orthodox Scripture';
    const textToShare = `${prefix} (${todayData.scriptureRef}): "${todayData.scriptureText}" - via OrthodoxConnect.live`;
    navigator.clipboard.writeText(textToShare);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!todayData) return null;

  const titles = todayData.synaxariumTitles ?? [];
  const copticToday = getCopticDate(new Date());
  const isAr = language === 'ar';

  return (
    <>
      <div className="relative overflow-hidden rounded-3xl bg-(--bg-card) dark:bg-[#1c1611] border-2 border-(--ln-gold) dark:border-[#8b6b4a] p-5 shadow-xl mb-6">
        {/* Decorative Accent Fills */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-(--ac-gold)/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-(--ac-bronze)/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          {/* Left: Today Saint & Fasting */}
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="px-3 py-1 rounded-full bg-(--bg-soft) dark:bg-[#282019] border border-(--ln-gold) text-(--tx-strong) dark:text-[#f5ebd9] font-serif font-bold text-[10px] uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-(--ac-bronze-tx)" />
                {todayData.date}
              </span>
              <span className="px-3 py-1 rounded-full bg-(--bg-soft) dark:bg-[#282019] border border-(--ln-gold) text-(--tx-strong) dark:text-[#f5ebd9] font-serif font-bold text-[10px] uppercase tracking-wider">
                {formatCopticDate(copticToday, language)}
              </span>
              <span className="px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-400 text-emerald-900 dark:text-emerald-200 font-serif font-bold text-[10px] uppercase tracking-wider flex items-center gap-1">
                <Utensils className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />
                {todayData.fastingInfo}
              </span>
            </div>

            {/* Daily Synaxarium — tappable, opens the full day */}
            {titles.length > 0 && (
              <button
                onClick={() => setReaderDate(copticToday)}
                className="w-full text-start p-3.5 rounded-2xl bg-(--bg-soft)/80 dark:bg-[#282019]/80 border border-(--ln-gold) hover:border-(--ac-gold) transition-colors cursor-pointer group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-(--ac-bronze-tx)" />
                    <span className="text-[10px] font-serif font-bold uppercase tracking-wider text-(--ac-bronze-tx)">
                      {isAr ? 'سنكسار اليوم' : "Today's Synaxarium"}
                    </span>
                  </div>
                  <ChevronRight className={`w-4 h-4 text-(--tx-mute) group-hover:text-(--ac-bronze-tx) transition-colors shrink-0 ${isAr ? 'rotate-180' : ''}`} />
                </div>
                <div className="space-y-1">
                  {titles.slice(0, 3).map((title, i) => (
                    <p key={i} className="text-xs font-serif-coptic font-bold text-(--tx-strong) dark:text-[#f5ebd9] leading-relaxed">
                      {title}
                    </p>
                  ))}
                  {titles.length > 3 && (
                    <p className="text-[10px] font-serif text-(--tx-mute) dark:text-[#a89379] italic">
                      {isAr ? `+ ${titles.length - 3} تذكارات أخرى — اضغط للقراءة` : `+ ${titles.length - 3} more — tap to read`}
                    </p>
                  )}
                </div>
              </button>
            )}

            {/* Scripture Verse Quote */}
            <div className="mt-2 p-3.5 rounded-2xl bg-(--bg-soft)/80 dark:bg-[#282019]/80 border border-(--ln-gold) flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <BookOpen className="w-4 h-4 text-(--ac-bronze-tx) shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-(--tx-strong) dark:text-[#f5ebd9] italic font-serif leading-relaxed">
                    "{todayData.scriptureText}"
                  </p>
                  <span className="text-[10px] text-(--tx-mute) dark:text-[#a89379] font-serif font-bold uppercase tracking-wider mt-1 block">
                    — {todayData.scriptureRef}
                  </span>
                </div>
              </div>

              <button
                onClick={handleShareScripture}
                className="p-1.5 rounded-xl bg-(--bg-deep) dark:bg-[#32251a] hover:bg-(--ac-gold) hover:text-white border border-(--ln-gold) text-(--tx-strong) dark:text-[#f5ebd9] transition-colors shrink-0 cursor-pointer shadow-sm"
                title="Share Scripture Verse"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Share2 className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Right: Open Full Liturgical Calendar View */}
          <div className="shrink-0 flex items-center gap-2">
            <button
              onClick={onOpenCalendar}
              className="px-4 py-2.5 rounded-2xl bg-(--ac-bronze) hover:bg-(--ac-bronze-dk) text-white font-serif font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-md transition-all cursor-pointer"
            >
              <Calendar className="w-4 h-4" />
              <span>{t('calendar')}</span>
            </button>
          </div>
        </div>
      </div>

      {readerDate && (
        <SynaxariumReader copticDate={readerDate} onClose={() => setReaderDate(null)} />
      )}
    </>
  );
};
