import React, { useState } from 'react';
import { Calendar, BookOpen, Utensils, Share2, Check, Sparkles } from 'lucide-react';
import { getTodayLiturgicalDay } from '../data/liturgical';
import { useTheme } from '../context/ThemeContext';

interface LiturgicalBannerProps {
  onOpenCalendar?: () => void;
}

export const LiturgicalBanner: React.FC<LiturgicalBannerProps> = ({ onOpenCalendar }) => {
  const { t, language } = useTheme();
  const [copied, setCopied] = useState(false);
  const todayData = getTodayLiturgicalDay(language);

  const handleShareScripture = () => {
    const prefix = language === 'ar' ? 'القراءة الأرثوذكسية اليومية' : 'Daily Orthodox Scripture';
    const textToShare = `${prefix} (${todayData.scriptureRef}): "${todayData.scriptureText}" - via OrthodoxConnect.live`;
    navigator.clipboard.writeText(textToShare);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative overflow-hidden rounded-3xl bg-[#f6ebd6] dark:bg-[#1c1611] border-2 border-[#c5a059] dark:border-[#8b6b4a] p-5 shadow-xl mb-6">
      {/* Decorative Accent Fills */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-[#c5a059]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-[#a8833c]/10 rounded-full blur-2xl pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {/* Left: Today Saint & Fasting */}
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="px-3 py-1 rounded-full bg-[#eedcb5] dark:bg-[#282019] border border-[#c5a059] text-[#3d2b18] dark:text-[#f5ebd9] font-serif font-bold text-[10px] uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[#a8833c]" />
              {todayData.date}
            </span>
            <span className="px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-400 text-emerald-900 dark:text-emerald-200 font-serif font-bold text-[10px] uppercase tracking-wider flex items-center gap-1">
              <Utensils className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />
              {todayData.fastingInfo}
            </span>
          </div>

          <div>
            <h2 className="text-lg md:text-xl font-serif-coptic font-bold text-[#3d2b18] dark:text-[#f5ebd9] flex items-center gap-2 uppercase tracking-wider">
              <span>⛪ {todayData.saintName}</span>
            </h2>
            <p className="text-xs text-[#7c5f3d] dark:text-[#a89379] italic font-serif">
              {todayData.saintTitle}
            </p>
          </div>

          {/* Scripture Verse Quote */}
          <div className="mt-2 p-3.5 rounded-2xl bg-[#eedcb5]/80 dark:bg-[#282019]/80 border border-[#c5a059] flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <BookOpen className="w-4 h-4 text-[#a8833c] shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-[#3d2b18] dark:text-[#f5ebd9] italic font-serif leading-relaxed">
                  "{todayData.scriptureText}"
                </p>
                <span className="text-[10px] text-[#7c5f3d] dark:text-[#a89379] font-serif font-bold uppercase tracking-wider mt-1 block">
                  — {todayData.scriptureRef}
                </span>
              </div>
            </div>

            <button
              onClick={handleShareScripture}
              className="p-1.5 rounded-xl bg-[#e6d3ab] dark:bg-[#32251a] hover:bg-[#c5a059] hover:text-white border border-[#c5a059] text-[#3d2b18] dark:text-[#f5ebd9] transition-colors shrink-0 cursor-pointer shadow-sm"
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
            className="px-4 py-2.5 rounded-2xl bg-[#a8833c] hover:bg-[#8f6e30] text-white font-serif font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-md transition-all cursor-pointer"
          >
            <Calendar className="w-4 h-4" />
            <span>{t('calendar')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};


