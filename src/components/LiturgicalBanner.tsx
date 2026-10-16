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
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-[#0e1c40] via-[#13264e] to-[#0a142e] border border-[#c9a227]/40 p-5 pt-6 shadow-xl mb-6">
        {/* Night-sky decor: golden glow + twinkling stars + Orthodox cross emblem */}
        <div className="absolute inset-x-0 top-0 h-48 bg-[radial-gradient(ellipse_65%_85%_at_50%_0%,rgba(232,194,90,0.20),transparent)] pointer-events-none" />
        {[
          { l: '12%', t: '18%', d: '0s', s: 3 },
          { l: '22%', t: '8%', d: '0.7s', s: 2 },
          { l: '78%', t: '12%', d: '1.3s', s: 3 },
          { l: '88%', t: '26%', d: '0.4s', s: 2 },
          { l: '8%', t: '38%', d: '1.8s', s: 2 },
          { l: '68%', t: '34%', d: '2.2s', s: 2 },
          { l: '32%', t: '30%', d: '1.0s', s: 2 },
          { l: '55%', t: '6%', d: '2.6s', s: 3 },
        ].map((st, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-[#f5e3a8] animate-pulse pointer-events-none"
            style={{ left: st.l, top: st.t, width: st.s, height: st.s, animationDelay: st.d, opacity: 0.8 }}
          />
        ))}

        <div className="relative z-10 flex flex-col items-center text-center gap-4">
          {/* App logo: golden Coptic cross */}
          <div className="pointer-events-none" aria-hidden="true">
            <img
              src="/launchericon-512x512.png"
              alt=""
              className="w-20 h-20 rounded-full object-cover drop-shadow-[0_0_16px_rgba(232,194,90,0.85)]"
            />
          </div>

          {/* Date, Coptic date & Fasting pills */}
          <div className="flex items-center justify-center gap-2 flex-wrap text-xs">
            <span className="px-3 py-1 rounded-full bg-white/5 border border-[#c9a227]/40 text-[#f2e3b3] font-serif font-bold text-[10px] uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[#e8c25a]" />
              {todayData.date}
            </span>
            <span className="px-3 py-1 rounded-full bg-white/5 border border-[#c9a227]/40 text-[#f2e3b3] font-serif font-bold text-[10px] uppercase tracking-wider">
              {formatCopticDate(copticToday, language)}
            </span>
            <span className="px-3 py-1 rounded-full bg-emerald-400/10 border border-emerald-300/40 text-emerald-200 font-serif font-bold text-[10px] uppercase tracking-wider flex items-center gap-1">
              <Utensils className="w-3 h-3 text-emerald-300" />
              {todayData.fastingInfo}
            </span>
          </div>

          {/* Daily Synaxarium — tappable, opens the full day */}
          {titles.length > 0 && (
            <button
              onClick={() => setReaderDate(copticToday)}
              className="w-full text-center p-3.5 rounded-2xl bg-white/5 border border-[#c9a227]/30 hover:border-[#e8c25a]/70 transition-colors cursor-pointer group"
            >
              <div className="flex items-center justify-center gap-2 mb-1.5">
                <BookOpen className="w-3.5 h-3.5 text-[#e8c25a]" />
                <span className="text-[10px] font-serif font-bold uppercase tracking-wider text-[#e8c25a]">
                  {isAr ? 'سنكسار اليوم' : "Today's Synaxarium"}
                </span>
                <ChevronRight className={`w-4 h-4 text-[#c9a227]/70 group-hover:text-[#e8c25a] transition-colors shrink-0 ${isAr ? 'rotate-180' : ''}`} />
              </div>
              <div className="space-y-1">
                {titles.slice(0, 3).map((title, i) => (
                  <p key={i} className="text-xs font-serif-coptic font-bold text-[#fdf6e3] leading-relaxed">
                    {title}
                  </p>
                ))}
                {titles.length > 3 && (
                  <p className="text-[10px] font-serif text-[#c9a227]/80 italic">
                    {isAr ? `+ ${titles.length - 3} تذكارات أخرى — اضغط للقراءة` : `+ ${titles.length - 3} more — tap to read`}
                  </p>
                )}
              </div>
            </button>
          )}

          {/* Scripture Verse Quote */}
          <div className="w-full p-3.5 rounded-2xl bg-white/5 border border-[#c9a227]/30 flex items-start justify-between gap-3 text-start">
            <div className="flex items-start gap-2.5">
              <BookOpen className="w-4 h-4 text-[#e8c25a] shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-[#fdf6e3] italic font-serif leading-relaxed">
                  "{todayData.scriptureText}"
                </p>
                <span className="text-[10px] text-[#c9a227] font-serif font-bold uppercase tracking-wider mt-1 block">
                  — {todayData.scriptureRef}
                </span>
              </div>
            </div>

            <button
              onClick={handleShareScripture}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-[#e8c25a] hover:text-[#1a2340] border border-[#c9a227]/40 text-[#f2e3b3] transition-colors shrink-0 cursor-pointer shadow-sm"
              title="Share Scripture Verse"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Share2 className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Open Full Liturgical Calendar View */}
          <button
            onClick={onOpenCalendar}
            className="px-8 py-3 rounded-full bg-gradient-to-b from-[#f0cd6e] to-[#c9a227] hover:brightness-110 text-[#1a2340] font-serif font-black text-sm uppercase tracking-wider flex items-center gap-2 shadow-[0_4px_20px_rgba(201,162,39,0.45)] transition-all cursor-pointer"
          >
            <Calendar className="w-4 h-4" />
            <span>{t('calendar')}</span>
          </button>
        </div>
      </div>

      {readerDate && (
        <SynaxariumReader copticDate={readerDate} onClose={() => setReaderDate(null)} />
      )}
    </>
  );
};
