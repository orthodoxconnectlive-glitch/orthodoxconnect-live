import React, { useMemo, useState } from 'react';
import { X, ChevronRight, ChevronLeft, CalendarDays } from 'lucide-react';
import { gregorianToCoptic } from '../lib/copticDate';
// Bundled content: { days: [{ month: 1..13, monthAr, monthEn, day, text }] }
// This file is created by the content pipeline (see workspace/oc-synaxarium/).
// @ts-ignore - JSON module resolved by Vite at build time
import synaxariumData from '../data/synaxarium_ar.json';

interface SynaxariumDay {
  month: number;
  monthAr: string;
  monthEn: string;
  day: number;
  text: string;
}

const MONTHS_AR = [
  'توت', 'بابه', 'هاتور', 'كيهك', 'طوبه', 'أمشير',
  'برمهات', 'برموده', 'بشنس', 'بؤونه', 'أبيب', 'مسرى', 'النسيء',
];

function daysInMonth(data: SynaxariumDay[], month: number): number {
  const days = data.filter((d) => d.month === month).map((d) => d.day);
  if (days.length === 0) return month === 13 ? 5 : 30;
  return Math.max(...days);
}

export const SynaxariumView: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const days = useMemo(
    () => ((synaxariumData as any)?.days || []) as SynaxariumDay[],
    []
  );
  const today = useMemo(() => gregorianToCoptic(new Date()), []);
  const [month, setMonth] = useState<number>(today.monthIndex);
  const [day, setDay] = useState<number>(today.day);

  const maxDay = useMemo(() => daysInMonth(days, month), [days, month]);
  const entry = useMemo(
    () => days.find((d) => d.month === month && d.day === day),
    [days, month, day]
  );
  const isToday = month === today.monthIndex && day === today.day;

  const goToDay = (m: number, d: number) => {
    const md = daysInMonth(days, m);
    setMonth(m);
    setDay(Math.min(Math.max(d, 1), md));
  };

  const stepDay = (dir: 1 | -1) => {
    let m = month;
    let d = day + dir;
    const md = daysInMonth(days, m);
    if (d < 1) {
      m = m === 1 ? 13 : m - 1;
      d = daysInMonth(days, m);
    } else if (d > md) {
      m = m === 13 ? 1 : m + 1;
      d = 1;
    }
    setMonth(m);
    setDay(d);
  };

  const monthName = MONTHS_AR[month - 1] || '';

  return (
    <div
      dir="rtl"
      lang="ar"
      className="fixed inset-0 z-[60] flex flex-col bg-[#f7f1e5] dark:bg-[#14100b] text-[#2b2118] dark:text-[#f5ebd9]"
      role="dialog"
      aria-modal="true"
      aria-label="السنكسار"
    >
      {/* Header */}
      <div className="shrink-0 border-b-2 border-[#b08d57]/40 dark:border-[#8b6b4a] bg-[#efe4cd] dark:bg-[#1c1611] px-4 pt-4 pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-[#b08d57]/20 border border-[#b08d57] flex items-center justify-center shrink-0">
              <CalendarDays className="w-5 h-5 text-[#8a6a3b] dark:text-[#d9b978]" />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-lg leading-tight">السنكسار</h2>
              <p className="text-xs opacity-70">
                {day} {monthName} {today.year} ش
                {isToday && <span className="mr-2 text-[#8a6a3b] dark:text-[#d9b978] font-bold">• اليوم</span>}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 shrink-0"
            aria-label="إغلاق"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Month picker */}
        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          {MONTHS_AR.map((name, i) => (
            <button
              key={name}
              type="button"
              onClick={() => goToDay(i + 1, 1)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-bold border transition-colors ${
                month === i + 1
                  ? 'bg-[#b08d57] text-white border-[#b08d57]'
                  : 'border-[#b08d57]/40 text-[#6b5a44] dark:text-[#c9b48c] hover:bg-[#b08d57]/15'
              }`}
            >
              {name}
            </button>
          ))}
        </div>

        {/* Day picker */}
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1" dir="ltr">
          {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDay(d)}
              className={`shrink-0 w-9 h-9 rounded-xl text-sm font-bold border transition-colors ${
                day === d
                  ? 'bg-[#8a6a3b] text-white border-[#8a6a3b]'
                  : 'border-[#b08d57]/40 text-[#6b5a44] dark:text-[#c9b48c] hover:bg-[#b08d57]/15'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Reading */}
      <div className="flex-1 overflow-y-auto px-5 py-6">
        <div className="max-w-2xl mx-auto">
          <h3 className="text-center font-bold text-xl mb-1 text-[#8a6a3b] dark:text-[#d9b978]">
            {day} {monthName}
          </h3>
          <div className="text-center text-sm opacity-60 mb-5">✦ ✦ ✦</div>
          {entry ? (
            <p className="whitespace-pre-line leading-[2.2] text-[17px] text-justify font-serif">
              {entry.text}
            </p>
          ) : (
            <p className="text-center opacity-60 py-10">لا توجد قراءة لهذا اليوم.</p>
          )}
        </div>
      </div>

      {/* Footer nav */}
      <div className="shrink-0 border-t-2 border-[#b08d57]/40 dark:border-[#8b6b4a] bg-[#efe4cd] dark:bg-[#1c1611] px-4 py-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => stepDay(-1)}
          className="flex items-center gap-1 px-4 py-2 rounded-xl bg-[#b08d57]/20 border border-[#b08d57]/50 font-bold text-sm hover:bg-[#b08d57]/35"
        >
          <ChevronRight className="w-4 h-4" />
          اليوم السابق
        </button>
        {!isToday && (
          <button
            type="button"
            onClick={() => goToDay(today.monthIndex, today.day)}
            className="px-4 py-2 rounded-xl bg-[#b08d57] text-white font-bold text-sm"
          >
            اليوم
          </button>
        )}
        <button
          type="button"
          onClick={() => stepDay(1)}
          className="flex items-center gap-1 px-4 py-2 rounded-xl bg-[#b08d57]/20 border border-[#b08d57]/50 font-bold text-sm hover:bg-[#b08d57]/35"
        >
          اليوم التالي
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default SynaxariumView;
