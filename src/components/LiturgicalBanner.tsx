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
  const [cardShared, setCardShared] = useState(false);
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

  // Render the whole daily card as a PNG image so it can be shared to
  // WhatsApp / groups as a picture (not just text).
  const renderCardImage = async (): Promise<Blob | null> => {
    if (!todayData) return null;
    try {
      const ct = getCopticDate(new Date());
      const tt = todayData.synaxariumTitles ?? [];
      const W = 1200;
      const pad = 72;
      const maxW = W - pad * 2;
      const meas = document.createElement('canvas').getContext('2d');
      if (!meas) return null;
      const wrap = (text: string, font: string, width: number): string[] => {
        meas.font = font;
        const words = String(text).split(/\s+/);
        const lines: string[] = [];
        let line = '';
        for (const w of words) {
          const test = line ? line + ' ' + w : w;
          if (meas.measureText(test).width > width && line) { lines.push(line); line = w; }
          else line = test;
        }
        if (line) lines.push(line);
        return lines.length ? lines : [''];
      };
      const F = {
        brand: '700 40px Georgia, serif',
        date: '700 42px Georgia, serif',
        sub: '600 38px Georgia, serif',
        head: '700 34px Georgia, serif',
        title: '700 46px Georgia, serif',
        verse: 'italic 46px Georgia, serif',
        ref: '700 36px Georgia, serif',
        foot: '700 44px Georgia, serif',
      };
      const synaxHead = language === 'ar' ? 'سنكسار اليوم' : "TODAY'S SYNAXARIUM";
      const titleLines = tt.slice(0, 3).flatMap((x) => wrap(x, F.title, maxW));
      const verseLines = wrap(`"${todayData.scriptureText}"`, F.verse, maxW);
      const img = await new Promise<HTMLImageElement | null>((res) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = () => res(null);
        i.src = '/launchericon-512x512.png';
      });
      const imgSize = 210;
      let H = 84 + (img ? imgSize + 34 : 130) + 62 + 54 + 54 + 58 + 46
        + (titleLines.length ? 66 + titleLines.length * 60 : 0)
        + verseLines.length * 62 + 8 + 78 + 84;
      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#13264e'); grad.addColorStop(0.5, '#0e1c40'); grad.addColorStop(1, '#0a142e');
      ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = '#c9a227'; ctx.lineWidth = 5;
      ctx.strokeRect(26, 26, W - 52, H - 52);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      let y = 84;
      if (img) {
        ctx.save();
        ctx.beginPath(); ctx.arc(W / 2, y + imgSize / 2, imgSize / 2, 0, Math.PI * 2); ctx.clip();
        ctx.drawImage(img, W / 2 - imgSize / 2, y, imgSize, imgSize);
        ctx.restore();
        y += imgSize + 34;
      } else {
        ctx.fillStyle = '#e8c25a'; ctx.font = '110px Georgia, serif';
        ctx.fillText('†', W / 2, y + 40); y += 130;
      }
      ctx.fillStyle = '#e8c25a'; ctx.font = F.brand;
      ctx.fillText('O R T H O D O X C O N N E C T', W / 2, y); y += 62;
      ctx.fillStyle = '#f2e3b3'; ctx.font = F.date;
      ctx.fillText(String(todayData.date).toUpperCase(), W / 2, y); y += 54;
      ctx.font = F.sub;
      ctx.fillText(formatCopticDate(ct, language), W / 2, y); y += 54;
      ctx.fillStyle = '#6ee7b7'; ctx.font = F.sub;
      ctx.fillText(todayData.fastingInfo, W / 2, y); y += 58;
      ctx.strokeStyle = 'rgba(201,162,39,0.6)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(W / 2 - 190, y); ctx.lineTo(W / 2 + 190, y); ctx.stroke(); y += 46;
      if (titleLines.length) {
        ctx.fillStyle = '#e8c25a'; ctx.font = F.head;
        ctx.fillText(synaxHead, W / 2, y); y += 50;
        ctx.fillStyle = '#fdf6e3'; ctx.font = F.title;
        for (const ln of titleLines) { ctx.fillText(ln, W / 2, y); y += 60; }
        y += 16;
      }
      ctx.fillStyle = '#fdf6e3'; ctx.font = F.verse;
      for (const ln of verseLines) { ctx.fillText(ln, W / 2, y); y += 62; }
      y += 8;
      ctx.fillStyle = '#c9a227'; ctx.font = F.ref;
      ctx.fillText(`— ${todayData.scriptureRef}`, W / 2, y); y += 78;
      ctx.fillStyle = '#e8c25a'; ctx.font = F.foot;
      ctx.fillText('orthodoxconnect.live', W / 2, y);
      return await new Promise<Blob | null>((res) => canvas.toBlob((b) => res(b), 'image/png'));
    } catch (e) {
      return null;
    }
  };

  const handleShareCard = async () => {
    if (!todayData) return;
    const ct = getCopticDate(new Date());
    const tt = todayData.synaxariumTitles ?? [];
    const mm = String(ct.month).padStart(2, '0');
    const dd = String(ct.day).padStart(2, '0');
    const url = `https://orthodoxconnect.live/?synax=${mm}-${dd}`;
    const synaxLine = tt.length
      ? `\n\n${language === 'ar' ? 'سنكسار اليوم' : "Today's Synaxarium"}:\n${tt.slice(0, 3).join('\n')}`
      : '';
    const text = `✝ OrthodoxConnect\n${todayData.date} • ${formatCopticDate(ct, language)}\n${todayData.fastingInfo}${synaxLine}\n\n"${todayData.scriptureText}"\n— ${todayData.scriptureRef}\n\n${url}`;
    const done = () => { setCardShared(true); setTimeout(() => setCardShared(false), 2000); };
    try {
      const blob = await renderCardImage();
      if (blob) {
        const file = new File([blob], 'orthodoxconnect-daily-card.png', { type: 'image/png' });
        const nav: any = navigator;
        if (nav.canShare && nav.canShare({ files: [file] })) {
          await nav.share({ files: [file], text });
          done();
          return;
        }
      }
    } catch (e) { /* fall through to text share */ }
    const nav: any = navigator;
    if (nav.share) {
      try { await nav.share({ title: 'OrthodoxConnect', text, url }); done(); return; } catch (e) { /* fall through */ }
    }
    try { await navigator.clipboard.writeText(text); done(); } catch (e) { /* nothing left to try */ }
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

          {/* Open Full Liturgical Calendar View + Share the whole card */}
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <button
              onClick={onOpenCalendar}
              className="px-8 py-3 rounded-full bg-gradient-to-b from-[#ffe27a] to-[#f5b81f] hover:brightness-110 text-[#1a2340] font-serif font-black text-sm uppercase tracking-wider flex items-center gap-2 shadow-[0_4px_20px_rgba(245,184,31,0.45)] transition-all cursor-pointer"
            >
              <Calendar className="w-4 h-4" />
              <span>{t('calendar')}</span>
            </button>
            <button
              onClick={handleShareCard}
              title="Share today's card"
              className="px-6 py-3 rounded-full bg-white/5 hover:bg-white/10 border border-[#e8c25a]/70 text-[#f2e3b3] font-serif font-black text-sm uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer"
            >
              {cardShared ? <Check className="w-4 h-4 text-emerald-300" /> : <Share2 className="w-4 h-4" />}
              <span>{isAr ? 'مشاركة' : 'Share'}</span>
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
