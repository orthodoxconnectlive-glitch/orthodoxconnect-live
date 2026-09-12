import React, { useState, useEffect, useCallback } from 'react';
import {
  BookOpen, ChevronDown, ChevronLeft, ChevronRight,
  ExternalLink, Loader2, MoonStar, Sunrise, Church, ScrollText, Sparkles,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Types (shape returned by https://api.coptic.io/api/readings/:date)   */
/* ------------------------------------------------------------------ */
interface Verse { num: number; text: string; }
interface Chapter { chapterNum: number; verses: Verse[]; }
interface ReadingBlock { bookName: string; chapters: Chapter[]; }
interface SynaxariumEntry { url: string; name: string; id: string; }

interface KatamerosDay {
  Prophecies?: ReadingBlock[] | null;
  VPsalm?: ReadingBlock[] | null;
  VGospel?: ReadingBlock[] | null;
  MPsalm?: ReadingBlock[] | null;
  MGospel?: ReadingBlock[] | null;
  Pauline?: ReadingBlock[] | null;
  Catholic?: ReadingBlock[] | null;
  Acts?: ReadingBlock[] | null;
  LPsalm?: ReadingBlock[] | null;
  LGospel?: ReadingBlock[] | null;
  Synaxarium?: SynaxariumEntry[];
  celebrations?: { name: string; type: string }[];
  season?: string;
  seasonDay?: string;
  seasonAr?: string;
  seasonDayAr?: string;
}

/* ------------------------------------------------------------------ */
/* Arabic book names (Van Dyck)                                         */
/* ------------------------------------------------------------------ */
const AR_BOOKS: Record<string, string> = {
  'Genesis': 'التكوين', 'Exodus': 'الخروج', 'Leviticus': 'اللاويين', 'Numbers': 'العدد',
  'Deuteronomy': 'التثنية', 'Joshua': 'يشوع', 'Judges': 'القضاة', 'Ruth': 'راعوث',
  '1 Samuel': 'صموئيل الأول', '2 Samuel': 'صموئيل الثاني',
  '1 Kings': 'الملوك الأول', '2 Kings': 'الملوك الثاني',
  '1 Chronicles': 'أخبار الأيام الأول', '2 Chronicles': 'أخبار الأيام الثاني',
  'Ezra': 'عزرا', 'Nehemiah': 'نحميا', 'Esther': 'أستير', 'Job': 'أيوب',
  'Psalms': 'المزامير', 'Psalm': 'المزامير', 'Proverbs': 'الأمثال', 'Ecclesiastes': 'الجامعة',
  'Song of Solomon': 'نشيد الأنشاد', 'Song of Songs': 'نشيد الأنشاد',
  'Isaiah': 'إشعياء', 'Jeremiah': 'إرميا', 'Lamentations': 'مراثي إرميا',
  'Ezekiel': 'حزقيال', 'Daniel': 'دانيال', 'Hosea': 'هوشع', 'Joel': 'يوئيل',
  'Amos': 'عاموس', 'Obadiah': 'عوبديا', 'Jonah': 'يونان', 'Micah': 'ميخا',
  'Nahum': 'ناحوم', 'Habakkuk': 'حبقوق', 'Zephaniah': 'صفنيا', 'Haggai': 'حجي',
  'Zechariah': 'زكريا', 'Malachi': 'ملاخي',
  'Matthew': 'متى', 'Mark': 'مرقس', 'Luke': 'لوقا', 'John': 'يوحنا',
  'Acts': 'أعمال الرسل', 'Romans': 'رومية',
  '1 Corinthians': 'كورنثوس الأولى', '2 Corinthians': 'كورنثوس الثانية',
  'Galatians': 'غلاطية', 'Ephesians': 'أفسس', 'Philippians': 'فيلبي',
  'Colossians': 'كولوسي', '1 Thessalonians': 'تسالونيكي الأولى',
  '2 Thessalonians': 'تسالونيكي الثانية', '1 Timothy': 'تيموثاوس الأولى',
  '2 Timothy': 'تيموثاوس الثانية', 'Titus': 'تيطس', 'Philemon': 'فليمون',
  'Hebrews': 'العبرانيين', 'James': 'يعقوب',
  '1 Peter': 'بطرس الأولى', '2 Peter': 'بطرس الثانية',
  '1 John': 'يوحنا الأولى', '2 John': 'يوحنا الثانية', '3 John': 'يوحنا الثالثة',
  'Jude': 'يهوذا', 'Revelation': 'الرؤيا',
};

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const toArDigits = (n: number | string) =>
  String(n).replace(/[0-9]/g, (d) => AR_DIGITS[Number(d)]);

/* ------------------------------------------------------------------ */
/* Section / reading labels                                            */
/* ------------------------------------------------------------------ */
type Lang = 'ar' | 'en';

const SECTION_META: {
  key: string;
  ar: string; en: string;
  icon: 'prophecies' | 'vespers' | 'matins' | 'liturgy';
  readings: { field: keyof KatamerosDay; ar: string; en: string }[];
}[] = [
  {
    key: 'prophecies', ar: 'النبوات', en: 'Prophecies', icon: 'prophecies',
    readings: [{ field: 'Prophecies', ar: 'النبوات', en: 'Prophecies' }],
  },
  {
    key: 'vespers', ar: 'صلاة العشية', en: 'Vespers', icon: 'vespers',
    readings: [
      { field: 'VPsalm', ar: 'مزمور العشية', en: 'Vespers Psalm' },
      { field: 'VGospel', ar: 'إنجيل العشية', en: 'Vespers Gospel' },
    ],
  },
  {
    key: 'matins', ar: 'صلاة باكر', en: 'Matins', icon: 'matins',
    readings: [
      { field: 'MPsalm', ar: 'مزمور باكر', en: 'Matins Psalm' },
      { field: 'MGospel', ar: 'إنجيل باكر', en: 'Matins Gospel' },
    ],
  },
  {
    key: 'liturgy', ar: 'القداس الإلهي', en: 'Divine Liturgy', icon: 'liturgy',
    readings: [
      { field: 'Pauline', ar: 'البولس', en: 'Pauline Epistle' },
      { field: 'Catholic', ar: 'الكاثوليكون', en: 'Catholic Epistle' },
      { field: 'Acts', ar: 'الإبركسيس', en: 'Acts' },
      { field: 'LPsalm', ar: 'مزمور القداس', en: 'Liturgy Psalm' },
      { field: 'LGospel', ar: 'إنجيل القداس', en: 'Liturgy Gospel' },
    ],
  },
];

const SEASON_AR: Record<string, string> = {
  'Great Lent': 'الصوم الكبير',
  'Holy Week': 'أسبوع الآلام',
  'Holy Fifty Days': 'الخمسين المقدسة',
  'Holy 50 Days': 'الخمسين المقدسة',
  'Nativity Fast': 'صوم الميلاد',
  'Apostles Fast': "صوم الرسل",
  'St. Mary Fast': 'صوم السيدة العذراء',
  "St. Mary's Fast": 'صوم السيدة العذراء',
  "Jonah's Fast": 'صوم يونان',
};

function formatRef(blocks: ReadingBlock[], lang: Lang): string {
  const parts = blocks.map((b) => {
    const book = lang === 'ar' ? (AR_BOOKS[b.bookName] || b.bookName) : b.bookName;
    const chParts = b.chapters.map((c) => {
      const nums = c.verses.map((v) => v.num);
      const verseStr = nums.length > 1
        ? `${Math.min(...nums)}-${Math.max(...nums)}`
        : `${nums[0]}`;
      const ch = lang === 'ar' ? toArDigits(c.chapterNum) : c.chapterNum;
      const vs = lang === 'ar' ? toArDigits(verseStr) : verseStr;
      return `${ch}:${vs}`;
    });
    return `${book} ${chParts.join('، ')}`;
  });
  return parts.join(lang === 'ar' ? '؛ ' : '; ');
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/* ------------------------------------------------------------------ */
/* Single reading accordion                                            */
/* ------------------------------------------------------------------ */
const ReadingCard: React.FC<{ label: string; blocks: ReadingBlock[]; lang: Lang; defaultOpen?: boolean }> = ({
  label, blocks, lang, defaultOpen,
}) => {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="rounded-xl border border-[#d4af37]/25 bg-white/60 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 cursor-pointer hover:bg-[#f1ebd7]/60 transition-colors"
      >
        <span className="flex items-center gap-2 min-w-0">
          <BookOpen className="w-4 h-4 text-[#d4af37] shrink-0" />
          <span className="font-bold text-xs text-[#5a4632] truncate">{label}</span>
        </span>
        <span className="flex items-center gap-1.5 shrink-0">
          <span className="text-[11px] text-[#8b6b4a] font-serif">{formatRef(blocks, lang)}</span>
          <ChevronDown className={`w-4 h-4 text-[#8b6b4a] transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {open && (
        <div className="px-4 pb-3.5 pt-1 space-y-3 border-t border-[#d4af37]/15">
          {blocks.map((b, bi) => (
            <div key={bi} className="space-y-1.5">
              {blocks.length > 1 && (
                <p className="text-[11px] font-bold text-[#8b6b4a]">
                  {lang === 'ar' ? (AR_BOOKS[b.bookName] || b.bookName) : b.bookName}
                </p>
              )}
              {b.chapters.map((c, ci) => (
                <p
                  key={ci}
                  className={`text-[13px] leading-7 text-[#2c2c2c] ${lang === 'ar' ? 'font-serif text-right' : 'text-left'}`}
                  dir={lang === 'ar' ? 'rtl' : 'ltr'}
                >
                  {c.verses.map((v) => (
                    <span key={v.num}>
                      <sup className="text-[10px] text-[#b89528] font-bold mx-0.5">
                        {lang === 'ar' ? toArDigits(v.num) : v.num}
                      </sup>
                      {v.text}{' '}
                    </span>
                  ))}
                </p>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */
export const DailyReadings: React.FC<{ language: Lang }> = ({ language }) => {
  const [dayOffset, setDayOffset] = useState(0);
  const [data, setData] = useState<KatamerosDay | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ liturgy: true });

  const lang: Lang = language === 'ar' ? 'ar' : 'en';

  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + dayOffset);
  const iso = toISODate(targetDate);

  const stTaklaUrl =
    `https://st-takla.org/zJ/index.php/ar-readings-katamares` +
    `?view=${lang === 'ar' ? 'reading-arabic' : 'reading-english'}` +
    `&iday=${targetDate.getDate()}&imonth=${targetDate.getMonth() + 1}&iyear=${targetDate.getFullYear()}` +
    `&dbl=${lang}`;

  const fetchDay = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    const cacheKey = `oc-katameros-${iso}-${lang}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        setData(JSON.parse(cached));
        setLoading(false);
        return;
      }
    } catch { /* ignore */ }

    try {
      const res = await fetch(
        `https://api.coptic.io/api/readings/${iso}?detailed=true&lang=${lang}`,
        { headers: { Accept: 'application/json' } },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: KatamerosDay = await res.json();
      setData(json);
      try { localStorage.setItem(cacheKey, JSON.stringify(json)); } catch { /* ignore */ }
    } catch {
      setFailed(true);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [iso, lang]);

  useEffect(() => {
    fetchDay();
  }, [fetchDay]);

  const toggleSection = (key: string) =>
    setOpenSections((p) => ({ ...p, [key]: !p[key] }));

  const sectionIcon = (icon: string) => {
    const cls = 'w-4 h-4 text-[#d4af37] shrink-0';
    switch (icon) {
      case 'prophecies': return <ScrollText className={cls} />;
      case 'vespers': return <MoonStar className={cls} />;
      case 'matins': return <Sunrise className={cls} />;
      default: return <Church className={cls} />;
    }
  };

  const dayLabel = dayOffset === 0
    ? (lang === 'ar' ? 'اليوم' : 'Today')
    : targetDate.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', {
        weekday: 'long', day: 'numeric', month: 'long',
      });

  const seasonLabel = data?.season
    ? (lang === 'ar' ? (SEASON_AR[data.season] || data.season) : data.season)
    : null;

  return (
    <div className="p-5 sm:p-6 rounded-2xl bg-[#fdfaf5] border-2 border-[#d4af37]/60 shadow-xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-[#d4af37] text-white flex items-center justify-center shadow-md shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-serif font-bold text-lg text-[#5a4632]">
              {lang === 'ar' ? 'قراءات اليوم — القطمارس' : "Today's Readings — Katameros"}
            </h3>
            <p className="text-[11px] text-[#8b6b4a]">
              {dayLabel}
              {seasonLabel && (
                <span className="ms-2 px-2 py-0.5 rounded-full bg-[#d4af37]/15 text-[#7c5f3d] font-bold">
                  {seasonLabel}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Day navigation */}
        <div className="flex items-center gap-1 bg-[#f1ebd7] rounded-xl p-1 border border-[#d4af37]/20">
          <button
            onClick={() => setDayOffset((o) => o - 1)}
            className="p-1.5 rounded-lg hover:bg-white text-[#8b6b4a] transition-colors cursor-pointer"
            aria-label={lang === 'ar' ? 'اليوم السابق' : 'Previous day'}
          >
            <ChevronRight className="w-4 h-4 rtl:rotate-0" />
          </button>
          {dayOffset !== 0 && (
            <button
              onClick={() => setDayOffset(0)}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-[#5a4632] hover:bg-white transition-colors cursor-pointer"
            >
              {lang === 'ar' ? 'اليوم' : 'Today'}
            </button>
          )}
          <button
            onClick={() => setDayOffset((o) => o + 1)}
            className="p-1.5 rounded-lg hover:bg-white text-[#8b6b4a] transition-colors cursor-pointer"
            aria-label={lang === 'ar' ? 'اليوم التالي' : 'Next day'}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      {loading && (
        <div className="flex items-center justify-center gap-2 py-10 text-[#8b6b4a]">
          <Loader2 className="w-5 h-5 animate-spin text-[#d4af37]" />
          <span className="text-xs font-bold">
            {lang === 'ar' ? 'جاري تحميل قراءات اليوم...' : 'Loading today\u2019s readings...'}
          </span>
        </div>
      )}

      {!loading && failed && (
        <div className="p-5 rounded-xl bg-[#f1ebd7] border border-[#d4af37]/25 text-center space-y-3">
          <p className="text-xs text-[#5a4632] font-semibold">
            {lang === 'ar'
              ? 'تعذر تحميل القراءات حالياً. يمكنك قراءتها من موقع الأنبا تكلا:'
              : 'Could not load the readings right now. You can read them at St. Takla\u2019s site:'}
          </p>
          <a
            href={stTaklaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#d4af37] text-white text-xs font-bold shadow-md hover:bg-[#b89528] transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            {lang === 'ar' ? 'قراءات اليوم على st-takla.org' : 'Today\u2019s readings on st-takla.org'}
          </a>
          <div>
            <button
              onClick={fetchDay}
              className="text-[11px] font-bold text-[#8b6b4a] underline cursor-pointer"
            >
              {lang === 'ar' ? 'إعادة المحاولة' : 'Try again'}
            </button>
          </div>
        </div>
      )}

      {!loading && !failed && data && (
        <div className="space-y-3">
          {SECTION_META.map((section) => {
            const present = section.readings.filter((r) => {
              const v = data[r.field];
              return Array.isArray(v) && v.length > 0;
            });
            if (present.length === 0) return null;
            const isOpen = !!openSections[section.key];
            return (
              <div key={section.key} className="rounded-2xl border border-[#d4af37]/30 bg-[#fbf7ee] overflow-hidden">
                <button
                  onClick={() => toggleSection(section.key)}
                  className="w-full flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-[#f1ebd7]/50 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    {sectionIcon(section.icon)}
                    <span className="font-serif font-bold text-sm text-[#5a4632]">
                      {lang === 'ar' ? section.ar : section.en}
                    </span>
                  </span>
                  <ChevronDown className={`w-4 h-4 text-[#8b6b4a] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                  <div className="px-3 pb-3 space-y-2">
                    {present.map((r) => (
                      <ReadingCard
                        key={r.field}
                        label={lang === 'ar' ? r.ar : r.en}
                        blocks={data[r.field] as ReadingBlock[]}
                        lang={lang}
                        defaultOpen={r.field === 'LGospel'}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Synaxarium links */}
          {data.Synaxarium && data.Synaxarium.length > 0 && (
            <div className="rounded-2xl border border-[#d4af37]/30 bg-[#fbf7ee] p-4 space-y-2">
              <p className="flex items-center gap-2 font-serif font-bold text-sm text-[#5a4632]">
                <Sparkles className="w-4 h-4 text-[#d4af37]" />
                {lang === 'ar' ? 'السنكسار' : 'Synaxarium'}
              </p>
              <ul className="space-y-1.5">
                {data.Synaxarium.map((s) => (
                  <li key={s.id}>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-[#7c5f3d] hover:text-[#d4af37] transition-colors"
                    >
                      <ExternalLink className="w-3 h-3 shrink-0" />
                      <span className="underline decoration-dotted underline-offset-2">{s.name}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
