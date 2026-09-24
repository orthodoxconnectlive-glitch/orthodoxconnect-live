import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Bookmark,
  CalendarDays,
  Church,
  Clock,
  Flame,
  Headphones,
  Languages,
  Music,
  Pause,
  Play,
  Search,
  Share2,
  Square,
  Type,
  Users,
  X,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { loadCopticReaderLibrary } from '../data/copticReader';
import { useSpeech, detectSpeechLang, type SpeechItem } from '../hooks/useSpeech';
import type {
  CRBlock,
  CRBook,
  CRDocument,
  CRLibrary,
  CRSection,
  CRText,
} from '../data/copticReader/types';

const ICONS: Record<string, React.ReactNode> = {
  Clock: <Clock size={22} />,
  Music: <Music size={22} />,
  BookOpen: <BookOpen size={22} />,
  Church: <Church size={22} />,
  CalendarDays: <CalendarDays size={22} />,
  Users: <Users size={22} />,
  Flame: <Flame size={22} />,
};

type ContentLang = 'en' | 'ar' | 'both';

/** Budded Coptic cross — each arm ends in three points, for the Holy Trinity. */
const CopticCross: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 48 48"
    fill="none"
    stroke="currentColor"
    strokeWidth={3}
    strokeLinecap="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M24 11v26" />
    <path d="M13 22h22" />
    <g fill="currentColor" stroke="none">
      <circle cx="24" cy="6.5" r="2" />
      <circle cx="20.3" cy="8.3" r="2" />
      <circle cx="27.7" cy="8.3" r="2" />
      <circle cx="24" cy="41.5" r="2" />
      <circle cx="20.3" cy="39.7" r="2" />
      <circle cx="27.7" cy="39.7" r="2" />
      <circle cx="8.5" cy="22" r="2" />
      <circle cx="10.3" cy="18.3" r="2" />
      <circle cx="10.3" cy="25.7" r="2" />
      <circle cx="39.5" cy="22" r="2" />
      <circle cx="37.7" cy="18.3" r="2" />
      <circle cx="37.7" cy="25.7" r="2" />
    </g>
  </svg>
);

type Nav =
  | { level: 'shelf' }
  | { level: 'book'; book: CRBook }
  | { level: 'section'; book: CRBook; section: CRSection; docs: CRDocument[] }
  | { level: 'reader'; book: CRBook; section: CRSection; doc: CRDocument };

const BOOKMARK_KEY = 'cr-bookmarks-v1';
const LANG_KEY = 'cr-content-lang-v1';
const FONT_KEY = 'cr-font-v1';

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

const label = (text: CRText, uiLang: 'en' | 'ar') =>
  uiLang === 'ar' ? text.ar || text.en : text.en;

const loadingText = (lang: 'en' | 'ar') =>
  lang === 'ar' ? 'جاري التحميل...' : 'Loading...';

/**
 * Flatten a document into speakable items, honoring the content-language
 * mode: 'en' reads English, 'ar' reads Arabic, 'both' reads English then
 * Arabic block by block. Each item carries its block index so the reader
 * can highlight the line being spoken.
 */
function buildSpeechItems(doc: CRDocument, clang: ContentLang): SpeechItem[] {
  const items: SpeechItem[] = [];
  const push = (text: string | undefined, blockIndex: number) => {
    const t = (text || '').trim();
    if (t) items.push({ text: t, lang: detectSpeechLang(t), ref: blockIndex });
  };
  if (clang !== 'ar') push(doc.title.en, -1);
  if (clang !== 'en') push(doc.title.ar, -1);
  doc.blocks.forEach((b, bi) => {
    const langs: ('en' | 'ar')[] = clang === 'both' ? ['en', 'ar'] : [clang];
    for (const L of langs) {
      const lbl = b.label ? (L === 'ar' ? b.label.ar || b.label.en : b.label.en) : '';
      const txt = L === 'ar' ? b.text.ar || b.text.en : b.text.en;
      push([lbl, txt].filter(Boolean).join(' — '), bi);
    }
  });
  return items;
}

const BlockView: React.FC<{ block: CRBlock; clang: ContentLang; fontSize: string; onShare: (b: CRBlock) => void }> = ({ block, clang, fontSize, onShare }) => {
  const showEn = clang === 'en' || clang === 'both';
  const showAr = (clang === 'ar' || clang === 'both') && block.text.ar;
  const lbl = block.label;
  const arOnly = showAr && !showEn;
  const gold = 'text-[#8a6a3b] dark:text-[#d9b978]';
  const body = 'text-[#2b2118] dark:text-[#f5ebd9]';

  if (block.kind === 'heading') {
    return (
      <div className="pt-4">
        {showEn && <h3 className={`font-serif text-xl font-bold ${gold}`}>{block.text.en}</h3>}
        {showAr && (
          <h3 dir="rtl" className={`mt-1 text-right font-serif text-xl font-bold ${gold}`}>
            {block.text.ar}
          </h3>
        )}
      </div>
    );
  }

  if (block.kind === 'rubric') {
    return (
      <div className="rounded-xl border border-red-400/30 bg-red-500/5 px-4 py-2.5">
        {showEn && <p className="text-sm italic text-red-700/80 dark:text-red-200/80">{block.text.en}</p>}
        {showAr && (
          <p dir="rtl" className="mt-1 text-right text-sm italic text-red-700/80 dark:text-red-200/80">
            {block.text.ar}
          </p>
        )}
      </div>
    );
  }

  if (block.kind === 'note') {
    return (
      <div className="rounded-xl bg-[#efe4cd] dark:bg-[#282019] px-4 py-2.5">
        {showEn && <p className="text-sm text-[#6b5a44] dark:text-[#a89379]">{block.text.en}</p>}
        {showAr && (
          <p dir="rtl" className="mt-1 text-right text-sm text-[#6b5a44] dark:text-[#a89379]">
            {block.text.ar}
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      <div dir={arOnly ? 'rtl' : 'ltr'} className="mb-1 flex items-center justify-between gap-2">
        {lbl ? (
          <div className={`min-w-0 text-[11px] font-extrabold text-black dark:text-white ${arOnly ? 'text-right' : 'text-left'}`}>
            {showEn && <span className="uppercase tracking-[0.14em]">{lbl.en || lbl.ar}</span>}
            {showEn && showAr && lbl.ar && (
              <>
                <span className="mx-1 opacity-60">·</span>
                <span dir="rtl">{lbl.ar}</span>
              </>
            )}
            {arOnly && <span>{lbl.ar}</span>}
          </div>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={() => onShare(block)}
          className="shrink-0 rounded-lg p-1.5 text-[#8a6a3b]/50 hover:text-[#8a6a3b] hover:bg-black/5 dark:text-[#d9b978]/50 dark:hover:text-[#d9b978] dark:hover:bg-white/10"
          aria-label="Share"
          title="Share"
        >
          <Share2 size={14} />
        </button>
      </div>
      {showEn && <p className={`${fontSize} leading-8 ${body}`}>{block.text.en}</p>}
      {showAr && (
        <p dir="rtl" className={`mt-2 text-right ${fontSize} leading-9 ${body}`}>
          {block.text.ar}
        </p>
      )}
    </div>
  );
};

export const CopticReader: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { language } = useTheme();
  const lang: 'en' | 'ar' = language === 'ar' ? 'ar' : 'en';
  const [library, setLibrary] = useState<CRLibrary | null>(null);
  const [nav, setNav] = useState<Nav>({ level: 'shelf' });
  const [query, setQuery] = useState('');
  const [docQuery, setDocQuery] = useState('');
  const [clang, setClang] = useState<ContentLang>(() => readJSON(LANG_KEY, 'both' as ContentLang));
  const [fontSize, setFontSize] = useState(() => readJSON(FONT_KEY, 'text-[17px]'));
  const [bookmarks, setBookmarks] = useState<string[]>(() => readJSON(BOOKMARK_KEY, []));
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [libError, setLibError] = useState(false);

  // Listen (text-to-speech) — the phone's own voice, Arabic and English.
  const speech = useSpeech();
  const speechItemsRef = useRef<SpeechItem[]>([]);
  const blockRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const startListening = () => {
    if (nav.level !== 'reader') return;
    if (!speech.supported) {
      showToast(lang === 'ar' ? 'القراءة الصوتية غير مدعومة على هذا الجهاز' : 'Text-to-speech is not supported on this device');
      return;
    }
    const items = buildSpeechItems(nav.doc, clang);
    if (!items.length) {
      showToast(lang === 'ar' ? 'لا يوجد نص للقراءة' : 'No text to read aloud');
      return;
    }
    speechItemsRef.current = items;
    speech.speak(items);
  };

  // Switching the content language mid-listen restarts reading in the new language.
  const changeClang = (c: ContentLang) => {
    setClang(c);
    if (speech.speaking && nav.level === 'reader') {
      const items = buildSpeechItems(nav.doc, c);
      speechItemsRef.current = items;
      speech.speak(items);
    }
  };

  // Leaving the reader stops the voice.
  useEffect(() => {
    if (nav.level !== 'reader') {
      speechItemsRef.current = [];
      speech.stop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav]);

  // Follow along: highlight + scroll to the block being read.
  const activeBlockIndex =
    speech.currentIndex >= 0 ? speechItemsRef.current[speech.currentIndex]?.ref ?? -1 : -1;
  useEffect(() => {
    if (activeBlockIndex < 0) return;
    blockRefs.current.get(activeBlockIndex)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [activeBlockIndex]);

  const loadLibrary = () => {
    setLibError(false);
    loadCopticReaderLibrary()
      .then(setLibrary)
      .catch(() => setLibError(true));
  };

  useEffect(() => {
    loadLibrary();
  }, []);

  useEffect(() => {
    localStorage.setItem(LANG_KEY, JSON.stringify(clang));
  }, [clang]);
  useEffect(() => {
    localStorage.setItem(FONT_KEY, JSON.stringify(fontSize));
  }, [fontSize]);
  useEffect(() => {
    localStorage.setItem(BOOKMARK_KEY, JSON.stringify(bookmarks));
  }, [bookmarks]);

  const toggleBookmark = (id: string) =>
    setBookmarks((b) => (b.includes(id) ? b.filter((x) => x !== id) : [...b, id]));

  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  };

  const doShare = async (title: string, text: string) => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text });
      } catch {
        /* user dismissed the share sheet */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch {
        /* noop */
      }
      document.body.removeChild(ta);
    }
    showToast(lang === 'ar' ? 'تم نسخ النص' : 'Text copied');
  };

  const blockShareLines = (b: CRBlock): string[] => {
    const lines: string[] = [];
    if (b.label) {
      if (clang === 'ar') lines.push(b.label.ar || b.label.en);
      else if (clang === 'en') lines.push(b.label.en);
      else lines.push([b.label.en, b.label.ar].filter(Boolean).join(' · '));
    }
    if (clang !== 'ar' && b.text.en) lines.push(b.text.en);
    if (clang !== 'en' && b.text.ar) lines.push(b.text.ar);
    return lines;
  };

  const sig = lang === 'ar' ? '— المكتبة القبطية' : '— Coptic Library';

  const shareBlock = (b: CRBlock) => {
    const title = lang === 'ar' ? 'المكتبة القبطية' : 'Coptic Library';
    void doShare(title, [...blockShareLines(b), '', sig].join('\n'));
  };

  const shareDoc = () => {
    if (nav.level !== 'reader') return;
    const doc = nav.doc;
    const title = (clang === 'ar' ? doc.title.ar : null) || doc.title.en;
    const parts: string[] = [title, ''];
    for (const b of doc.blocks) {
      parts.push(blockShareLines(b).join('\n'));
      parts.push('');
    }
    parts.push(sig);
    void doShare(title, parts.join('\n'));
  };

  const openSection = async (book: CRBook, section: CRSection) => {
    setLoadingDocs(true);
    setDocQuery('');
    try {
      const docs = Array.isArray(section.documents) ? section.documents : await section.documents();
      setNav({ level: 'section', book, section, docs });
    } finally {
      setLoadingDocs(false);
    }
  };

  const back = () => {
    if (nav.level === 'reader') {
      const { book, section } = nav;
      openSection(book, section);
    } else if (nav.level === 'section') setNav({ level: 'book', book: nav.book });
    else if (nav.level === 'book') setNav({ level: 'shelf' });
  };

  const crumbs = useMemo(() => {
    if (nav.level === 'shelf') return label(library?.title ?? { en: 'Books', ar: 'الكتب' }, lang);
    if (nav.level === 'book') return label(nav.book.title, lang);
    if (nav.level === 'section') return label(nav.section.title, lang);
    return label(nav.doc.title, lang);
  }, [nav, library, lang]);

  const filteredBooks = useMemo(() => {
    if (!library) return [];
    const q = query.trim().toLowerCase();
    if (!q) return library.books;
    return library.books.filter(
      (b) =>
        b.title.en.toLowerCase().includes(q) ||
        (b.title.ar || '').includes(query.trim()) ||
        b.description.en.toLowerCase().includes(q),
    );
  }, [library, query]);

  const card =
    'bg-(--bg-card) dark:bg-[#1c1611] border-2 border-(--ln-gold) dark:border-[#8b6b4a] rounded-3xl';
  const muted = 'text-(--tx-mute) dark:text-[#a89379]';
  const strong = 'text-(--tx-strong) dark:text-[#f5ebd9]';
  const goldTx = 'text-[#8a6a3b] dark:text-[#d9b978]';

  return (
    <div
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-[60] flex flex-col bg-[#f7f1e5] dark:bg-[#14100b] text-[#2b2118] dark:text-[#f5ebd9]"
      role="dialog"
      aria-modal="true"
      aria-label={lang === 'ar' ? 'المكتبة القبطية' : 'Coptic Library'}
    >
      {/* Header */}
      <div className="shrink-0 border-b-2 border-[#b08d57]/40 dark:border-[#8b6b4a] bg-[#efe4cd] dark:bg-[#1c1611] px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          {nav.level !== 'shelf' ? (
            <button
              type="button"
              onClick={back}
              className="p-2 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 shrink-0"
              aria-label={lang === 'ar' ? 'رجوع' : 'Back'}
            >
              <ArrowLeft className={`w-5 h-5 ${lang === 'ar' ? 'rotate-180' : ''}`} />
            </button>
          ) : (
            <div className="w-10 h-10 rounded-2xl bg-[#b08d57]/20 border border-[#b08d57] flex items-center justify-center shrink-0">
              <CopticCross className="w-5 h-5 text-[#8a6a3b] dark:text-[#d9b978]" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-lg leading-tight truncate">
              {nav.level === 'shelf' ? label(library?.title ?? { en: 'Coptic Library', ar: 'المكتبة القبطية' }, lang) : crumbs}
            </h2>
            {nav.level === 'shelf' && library && (
              <p className="text-xs opacity-70 truncate">{label(library.subtitle, lang)}</p>
            )}
          </div>
          {/* content language: EN / both / AR */}
          <div className="flex items-center gap-0.5 rounded-xl border border-[#b08d57]/50 p-0.5 shrink-0">
            {(['en', 'both', 'ar'] as ContentLang[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => changeClang(c)}
                className={`rounded-lg px-2 py-1 text-[11px] font-bold transition-colors ${
                  clang === c ? 'bg-[#b08d57] text-white shadow-sm' : 'text-[#6b5a44] dark:text-[#c9b48c] hover:bg-[#b08d57]/15'
                }`}
              >
                {c === 'en' ? 'EN' : c === 'ar' ? 'عر' : <Languages size={13} />}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 shrink-0"
            aria-label={lang === 'ar' ? 'إغلاق' : 'Close'}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {nav.level === 'shelf' && (
          <div className="relative mt-3">
            <Search size={16} className="absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 text-[#6b5a44] dark:text-[#a89379]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={lang === 'ar' ? 'ابحث في المكتبة...' : 'Search the library...'}
              className="w-full rounded-xl border border-[#b08d57]/50 bg-white/60 dark:bg-[#282019] py-2.5 pl-9 rtl:pl-3 rtl:pr-9 pr-8 text-sm text-[#2b2118] dark:text-[#f5ebd9] placeholder-[#6b5a44]/60 dark:placeholder-[#a89379]/60 focus:outline-none focus:border-[#b08d57]"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2 rtl:right-auto rtl:left-2 top-1/2 -translate-y-1/2 p-1 text-[#6b5a44] dark:text-[#a89379]"
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-3xl mx-auto flex flex-col gap-3">
          {!library ? (
            libError ? (
              <div className="text-center py-10">
                <p className="text-sm text-[#6b5a44] dark:text-[#a89379] font-serif">
                  {lang === 'ar'
                    ? 'تعذّر تحميل المكتبة. تحقق من الاتصال وحاول مجددًا.'
                    : 'Could not load the library. Check your connection and try again.'}
                </p>
                <button
                  type="button"
                  onClick={loadLibrary}
                  className="mt-4 px-6 py-2.5 rounded-full bg-[#b08d57] hover:bg-[#c09a63] text-white text-sm font-serif font-bold shadow-md transition-colors cursor-pointer"
                >
                  {lang === 'ar' ? 'حاول مجددًا' : 'Try again'}
                </button>
              </div>
            ) : (
              <p className="text-center text-sm text-[#6b5a44] dark:text-[#a89379] font-serif py-10 animate-pulse">
                {loadingText(lang)}
              </p>
            )
          ) : (
            <>
              {/* Shelf */}
              {nav.level === 'shelf' && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {filteredBooks.map((book) => (
                    <button
                      key={book.id}
                      type="button"
                      onClick={() => setNav({ level: 'book', book })}
                      className={`${card} group p-4 text-left rtl:text-right transition-all hover:shadow-lg cursor-pointer`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#b08d57]/15 text-[#8a6a3b] dark:text-[#d9b978] group-hover:bg-[#b08d57]/25">
                          {ICONS[book.icon] ?? <BookOpen size={22} />}
                        </span>
                        <div className="min-w-0">
                          <div className={`font-serif text-base font-bold ${strong} group-hover:${goldTx}`}>
                            {label(book.title, lang)}
                          </div>
                          <div className={`mt-0.5 line-clamp-2 text-xs ${muted}`}>
                            {label(book.description, lang)}
                          </div>
                          <div className={`mt-1 text-[11px] font-medium ${goldTx} opacity-70`}>
                            {book.sections.length} {lang === 'ar' ? 'أقسام' : 'sections'}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Book → sections */}
              {nav.level === 'book' && (
                <div className="flex flex-col gap-2">
                  {nav.book.sections.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => openSection(nav.book, s)}
                      className={`${card} flex items-center gap-3 p-4 text-left rtl:text-right transition-all hover:shadow-md cursor-pointer`}
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#b08d57]/15 text-[#8a6a3b] dark:text-[#d9b978]">
                        <BookOpen size={18} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate text-sm font-bold ${strong}`}>
                          {label(s.title, lang)}
                        </span>
                        {s.description && (
                          <span className={`block truncate text-xs ${muted}`}>
                            {label(s.description, lang)}
                          </span>
                        )}
                      </span>
                      <ArrowLeft size={16} className={`text-[#6b5a44] dark:text-[#a89379] ${lang === 'ar' ? '' : 'rotate-180'}`} />
                    </button>
                  ))}
                </div>
              )}

              {/* Section → documents */}
              {nav.level === 'section' && (
                <div className="flex flex-col gap-2">
                  {nav.docs.length > 8 && (
                    <div className="relative">
                      <Search size={16} className="absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 text-[#6b5a44] dark:text-[#a89379]" />
                      <input
                        value={docQuery}
                        onChange={(e) => setDocQuery(e.target.value)}
                        placeholder={lang === 'ar' ? 'ابحث في هذه القائمة...' : 'Search this list...'}
                        className="w-full rounded-xl border border-[#b08d57]/50 bg-white/60 dark:bg-[#282019] py-2 pl-9 rtl:pl-3 rtl:pr-9 pr-8 text-sm text-[#2b2118] dark:text-[#f5ebd9] placeholder-[#6b5a44]/60 dark:placeholder-[#a89379]/60 focus:outline-none focus:border-[#b08d57]"
                      />
                      {docQuery && (
                        <button
                          type="button"
                          onClick={() => setDocQuery('')}
                          className="absolute right-2 rtl:right-auto rtl:left-2 top-1/2 -translate-y-1/2 p-1 text-[#6b5a44] dark:text-[#a89379]"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  )}
                  {loadingDocs && (
                    <p className={`p-4 text-sm ${muted} animate-pulse`}>{loadingText(lang)}</p>
                  )}
                  {nav.docs
                    .filter((d) => {
                      const q = docQuery.trim().toLowerCase();
                      if (!q) return true;
                      return (
                        d.title.en.toLowerCase().includes(q) ||
                        (d.title.ar || '').includes(docQuery.trim()) ||
                        (d.subtitle?.en.toLowerCase().includes(q) ?? false) ||
                        (d.subtitle?.ar || '').includes(docQuery.trim())
                      );
                    })
                    .map((d) => {
                    const marked = bookmarks.includes(d.id);
                    return (
                      <div
                        key={d.id}
                        className={`${card} flex items-center gap-2 p-3 transition-all hover:shadow-md`}
                      >
                        <button
                          type="button"
                          onClick={() => setNav({ level: 'reader', book: nav.book, section: nav.section, doc: d })}
                          className="min-w-0 flex-1 text-left rtl:text-right cursor-pointer"
                        >
                          <span className={`block truncate text-sm font-semibold ${strong}`}>
                            {label(d.title, lang)}
                          </span>
                          {d.subtitle && (
                            <span className={`block truncate text-xs ${muted}`}>{label(d.subtitle, lang)}</span>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleBookmark(d.id)}
                          className={`p-2 shrink-0 ${marked ? goldTx : 'text-[#6b5a44] dark:text-[#a89379] hover:text-[#8a6a3b] dark:hover:text-[#d9b978]'}`}
                          aria-label="Bookmark"
                        >
                          <Bookmark size={16} fill={marked ? 'currentColor' : 'none'} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Reader */}
              {nav.level === 'reader' && (
                <div className={`${card} p-5 sm:p-7`}>
                  <div className="mb-4 flex items-start justify-between gap-3 border-b border-[#b08d57]/40 pb-4">
                    <div className="min-w-0">
                      <h2 className={`font-serif text-2xl font-bold ${goldTx}`}>
                        {(clang === 'ar' ? nav.doc.title.ar : null) || nav.doc.title.en}
                      </h2>
                      {clang === 'both' && nav.doc.title.ar && (
                        <h3 dir="rtl" className={`mt-1 text-right font-serif text-lg ${goldTx} opacity-80`}>
                          {nav.doc.title.ar}
                        </h3>
                      )}
                      {nav.doc.subtitle && (
                        <p className={`mt-1 text-xs ${muted}`}>{label(nav.doc.subtitle, lang)}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {speech.supported && (
                        <button
                          type="button"
                          onClick={() => (speech.speaking ? speech.stop() : startListening())}
                          className={`p-2 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 ${speech.speaking ? goldTx : ''}`}
                          title={lang === 'ar' ? (speech.speaking ? 'إيقاف الاستماع' : 'استمع') : speech.speaking ? 'Stop listening' : 'Listen'}
                          aria-label={lang === 'ar' ? 'استمع' : 'Listen'}
                        >
                          {speech.speaking ? <Square size={16} /> : <Headphones size={16} />}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setFontSize((f) => (f === 'text-[17px]' ? 'text-lg' : f === 'text-lg' ? 'text-xl' : 'text-[17px]'))
                        }
                        className="p-2 rounded-xl hover:bg-black/10 dark:hover:bg-white/10"
                        title="Text size"
                      >
                        <Type size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={shareDoc}
                        className="p-2 rounded-xl hover:bg-black/10 dark:hover:bg-white/10"
                        title={lang === 'ar' ? 'مشاركة' : 'Share'}
                        aria-label={lang === 'ar' ? 'مشاركة' : 'Share'}
                      >
                        <Share2 size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleBookmark(nav.doc.id)}
                        className={`p-2 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 ${bookmarks.includes(nav.doc.id) ? goldTx : ''}`}
                        title="Bookmark"
                      >
                        <Bookmark size={16} fill={bookmarks.includes(nav.doc.id) ? 'currentColor' : 'none'} />
                      </button>
                    </div>
                  </div>

                  {nav.doc.blocks.length === 0 ? (
                    <div className="rounded-xl bg-[#efe4cd] dark:bg-[#282019] p-8 text-center">
                      <BookOpen size={28} className="mx-auto text-[#b08d57]/60" />
                      <p className={`mt-3 text-sm ${strong}`}>
                        {lang === 'ar'
                          ? 'نص هذا الكتاب قيد الإضافة إلى المكتبة.'
                          : 'The text of this book is being added to the library.'}
                      </p>
                      <p className={`mt-1 text-xs ${muted}`}>
                        {lang === 'ar' ? 'تحقق مرة أخرى قريبًا.' : 'Check back soon.'}
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-5">
                      {nav.doc.blocks.map((b, i) => (
                        <div
                          key={i}
                          ref={(el) => {
                            if (el) blockRefs.current.set(i, el);
                            else blockRefs.current.delete(i);
                          }}
                          className={`-mx-2 rounded-xl px-2 py-1 transition-colors ${
                            i === activeBlockIndex ? 'bg-[#b08d57]/15 ring-1 ring-[#b08d57]/60' : ''
                          }`}
                        >
                          <BlockView block={b} clang={clang} fontSize={fontSize} onShare={shareBlock} />
                        </div>
                      ))}
                    </div>
                  )}

                  <p className={`mt-8 border-t border-[#b08d57]/40 pt-3 text-center text-[11px] ${muted}`}>
                    {label(library.attribution, lang)}
                  </p>

                  {/* Listening controls */}
                  {speech.speaking && (
                    <div className="sticky bottom-4 mt-6 flex justify-center">
                      <div className="flex items-center gap-2 rounded-full bg-black/85 px-4 py-2.5 text-white shadow-xl">
                        <Headphones size={15} className="text-[#d9b978]" />
                        <span className="text-xs font-bold">
                          {lang === 'ar' ? 'جارٍ الاستماع…' : 'Listening…'}
                        </span>
                        <button
                          type="button"
                          onClick={() => (speech.paused ? speech.resume() : speech.pause())}
                          className="p-1.5 rounded-full hover:bg-white/15"
                          aria-label={speech.paused ? (lang === 'ar' ? 'استئناف' : 'Resume') : lang === 'ar' ? 'إيقاف مؤقت' : 'Pause'}
                          title={speech.paused ? (lang === 'ar' ? 'استئناف' : 'Resume') : lang === 'ar' ? 'إيقاف مؤقت' : 'Pause'}
                        >
                          {speech.paused ? <Play size={15} /> : <Pause size={15} />}
                        </button>
                        <button
                          type="button"
                          onClick={speech.stop}
                          className="p-1.5 rounded-full hover:bg-white/15"
                          aria-label={lang === 'ar' ? 'إيقاف' : 'Stop'}
                          title={lang === 'ar' ? 'إيقاف' : 'Stop'}
                        >
                          <Square size={15} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      {toast && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-black/85 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
};

export default CopticReader;
