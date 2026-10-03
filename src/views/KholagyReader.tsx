import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Search, Bookmark, BookmarkCheck, Type, X, ChevronRight, Church } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { apiFetch } from '../lib/api';

// Types
interface KholagyBlock {
  kind: 'heading' | 'text' | 'rubric';
  en: string;
  coptic: string;
  ar: string;
}

interface KholagyPartMeta {
  name: string;
  slug: string;
  nblocks: number;
}

interface KholagyLiturgy {
  liturgy: string;
  parts: KholagyPartMeta[];
  data: Record<string, KholagyBlock[]>;
}

interface SearchDoc {
  lit: string;
  part: string;
  slug: string;
  idx: number;
  kind: string;
  en: string;
  coptic: string;
  ar: string;
}

const LITURGIES = [
  { id: 'basil', en: 'St. Basil', ar: 'القديس باسيليوس', color: '#8b6b4a' },
  { id: 'gregory', en: 'St. Gregory', ar: 'القديس غريغوريوس', color: '#6b7a8b' },
  { id: 'cyril', en: 'St. Cyril', ar: 'القديس كيرلس', color: '#8b4a4a' },
];

const FONT_SIZES = {
  normal: { base: 'text-[15px]', heading: 'text-xl' },
  large: { base: 'text-[18px]', heading: 'text-2xl' },
  xlarge: { base: 'text-[21px]', heading: 'text-[28px]' },
};

type FontSizeKey = keyof typeof FONT_SIZES;

export const KholagyReader: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { language } = useTheme();
  const [screen, setScreen] = useState<'liturgies' | 'parts' | 'reading' | 'search'>('liturgies');
  const [liturgyId, setLiturgyId] = useState<string | null>(null);
  const [liturgyData, setLiturgyData] = useState<KholagyLiturgy | null>(null);
  const [loading, setLoading] = useState(false);
  const [partSlug, setPartSlug] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchIndex, setSearchIndex] = useState<SearchDoc[] | null>(null);
  const [fontSize, setFontSize] = useState<FontSizeKey>(() => {
    return (localStorage.getItem('kholagy-font-size') as FontSizeKey) || 'normal';
  });
  const [bookmarks, setBookmarks] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('kholagy-bookmarks') || '[]'); } catch { return []; }
  });
  const [resume, setResume] = useState<{ lit: string; slug: string; idx: number } | null>(() => {
    try { return JSON.parse(localStorage.getItem('kholagy-resume') || 'null'); } catch { return null; }
  });
  const readerRef = useRef<HTMLDivElement>(null);

  // Fire read counter on open
  useEffect(() => {
    apiFetch('/api/books/kholagy-001/read', { method: 'POST' }).catch(() => {});
  }, []);

  // Load liturgy data
  const loadLiturgy = async (id: string) => {
    setLoading(true);
    setLiturgyId(id);
    try {
      const res = await fetch(`/kholagy/${id}.json`);
      const data: KholagyLiturgy = await res.json();
      setLiturgyData(data);
      setScreen('parts');
    } catch (e) {
      console.error('Failed to load liturgy', e);
    } finally {
      setLoading(false);
    }
  };

  // Load search index
  const loadSearchIndex = async () => {
    if (searchIndex) return;
    try {
      const res = await fetch('/kholagy/search_index.json');
      setSearchIndex(await res.json());
    } catch (e) {
      console.error('Failed to load search index', e);
    }
  };

  // Search
  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || !searchIndex) return [];
    const q = searchQuery.trim().toLowerCase();
    return searchIndex.filter(doc =>
      doc.en.toLowerCase().includes(q) ||
      doc.coptic.includes(searchQuery.trim()) ||
      doc.ar.includes(searchQuery.trim())
    ).slice(0, 50);
  }, [searchQuery, searchIndex]);

  // Font size
  const cycleFontSize = () => {
    const order: FontSizeKey[] = ['normal', 'large', 'xlarge'];
    const next = order[(order.indexOf(fontSize) + 1) % order.length];
    setFontSize(next);
    localStorage.setItem('kholagy-font-size', next);
  };

  // Bookmarks
  const toggleBookmark = (lit: string, slug: string, idx: number) => {
    const key = `${lit}:${slug}:${idx}`;
    const updated = bookmarks.includes(key)
      ? bookmarks.filter(b => b !== key)
      : [...bookmarks, key];
    setBookmarks(updated);
    localStorage.setItem('kholagy-bookmarks', JSON.stringify(updated));
  };

  // Resume
  const saveResume = (lit: string, slug: string, idx: number) => {
    const r = { lit, slug, idx };
    setResume(r);
    localStorage.setItem('kholagy-resume', JSON.stringify(r));
  };

  // Open part
  const openPart = (slug: string, blockIdx = 0) => {
    setPartSlug(slug);
    setScreen('reading');
    saveResume(liturgyId!, slug, blockIdx);
    // Scroll to block after render
    setTimeout(() => {
      const el = document.getElementById(`kholagy-block-${blockIdx}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  // Navigation
  const currentPartIndex = liturgyData && partSlug
    ? liturgyData.parts.findIndex(p => p.slug === partSlug)
    : -1;
  const goToPart = (dir: 1 | -1) => {
    if (!liturgyData || currentPartIndex < 0) return;
    const next = currentPartIndex + dir;
    if (next >= 0 && next < liturgyData.parts.length) {
      const part = liturgyData.parts[next];
      setPartSlug(part.slug);
      saveResume(liturgyId!, part.slug, 0);
      readerRef.current?.scrollTo({ top: 0 });
    }
  };

  const fs = FONT_SIZES[fontSize];
  const liturgyInfo = LITURGIES.find(l => l.id === liturgyId);
  const blocks = partSlug && liturgyData ? liturgyData.data[partSlug] || [] : [];
  const partMeta = liturgyData?.parts.find(p => p.slug === partSlug);

  return (
    <div className="fixed inset-0 z-50 bg-[#f5f0e6] dark:bg-[#1a1510] flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#f5f0e6]/95 dark:bg-[#1a1510]/95 backdrop-blur border-b border-[#8b6b4a]/30 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => {
            if (screen === 'reading') setScreen('parts');
            else if (screen === 'parts' || screen === 'search') setScreen('liturgies');
            else onClose();
          }}
          className="p-2 rounded-full hover:bg-[#8b6b4a]/10 text-[#5c4a32] dark:text-[#d4c4a8]"
          aria-label="Back"
        >
          {language === 'ar' ? <ArrowRight className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
        </button>
        <div className="flex-1">
          <h1 className="font-serif font-bold text-lg text-[#3d2f1f] dark:text-[#f5ebd9]">
            {screen === 'liturgies' && (language === 'ar' ? 'الخولاجي' : 'Kholagy')}
            {screen === 'parts' && liturgyInfo && (language === 'ar' ? liturgyInfo.ar : liturgyInfo.en)}
            {screen === 'reading' && partMeta?.name}
            {screen === 'search' && (language === 'ar' ? 'بحث' : 'Search')}
          </h1>
          {screen === 'reading' && partMeta && (
            <p className="text-xs text-[#8b6b4a] font-serif">
              {currentPartIndex + 1} / {liturgyData?.parts.length}
            </p>
          )}
        </div>
        {/* Font size */}
        <button
          onClick={cycleFontSize}
          className="p-2 rounded-full hover:bg-[#8b6b4a]/10 text-[#5c4a32] dark:text-[#d4c4a8]"
          title={language === 'ar' ? 'حجم الخط' : 'Font size'}
        >
          <Type className="w-5 h-5" />
        </button>
        {/* Search */}
        <button
          onClick={() => { setScreen('search'); loadSearchIndex(); }}
          className="p-2 rounded-full hover:bg-[#8b6b4a]/10 text-[#5c4a32] dark:text-[#d4c4a8]"
          title={language === 'ar' ? 'بحث' : 'Search'}
        >
          <Search className="w-5 h-5" />
        </button>
        <button
          onClick={onClose}
          className="p-2 rounded-full hover:bg-[#8b6b4a]/10 text-[#5c4a32] dark:text-[#d4c4a8]"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div ref={readerRef} className="flex-1 overflow-y-auto">
        {screen === 'liturgies' && (
          <LiturgySelect
            onSelect={loadLiturgy}
            loading={loading}
            resume={resume}
            onResume={() => {
              if (resume) {
                loadLiturgy(resume.lit).then(() => openPart(resume.slug, resume.idx));
              }
            }}
            language={language}
          />
        )}

        {screen === 'parts' && liturgyData && (
          <PartsList
            parts={liturgyData.parts}
            onSelect={(slug) => openPart(slug)}
            language={language}
          />
        )}

        {screen === 'reading' && (
          <ReadingView
            blocks={blocks}
            fontSize={fs}
            bookmarks={bookmarks}
            liturgyId={liturgyId!}
            partSlug={partSlug!}
            onToggleBookmark={toggleBookmark}
            onPrev={() => goToPart(-1)}
            onNext={() => goToPart(1)}
            hasPrev={currentPartIndex > 0}
            hasNext={liturgyData ? currentPartIndex < liturgyData.parts.length - 1 : false}
            language={language}
          />
        )}

        {screen === 'search' && (
          <SearchView
            query={searchQuery}
            onQueryChange={setSearchQuery}
            results={searchResults}
            onSelect={(doc) => {
              loadLiturgy(doc.lit).then(() => openPart(doc.slug, doc.idx));
            }}
            language={language}
          />
        )}
      </div>
    </div>
  );
};

// Liturgy selection screen
const LiturgySelect: React.FC<{
  onSelect: (id: string) => void;
  loading: boolean;
  resume: { lit: string; slug: string; idx: number } | null;
  onResume: () => void;
  language: string;
}> = ({ onSelect, loading, resume, onResume, language }) => {
  const resumeLiturgy = LITURGIES.find(l => l.id === resume?.lit);
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <Church className="w-12 h-12 mx-auto text-[#8b6b4a] mb-3" />
        <h2 className="font-serif text-2xl font-bold text-[#3d2f1f] dark:text-[#f5ebd9] mb-2">
          {language === 'ar' ? 'الخولاجي المقدس' : 'The Holy Kholagy'}
        </h2>
        <p className="font-serif text-sm text-[#8b6b4a] dark:text-[#a89379]">
          {language === 'ar'
            ? 'القداسات الإلهية الثلاثة باللغات القبطية والإنجليزية والعربية'
            : 'The three Divine Liturgies in Coptic, English & Arabic'}
        </p>
      </div>

      {resume && resumeLiturgy && (
        <button
          onClick={onResume}
          className="w-full mb-6 p-4 rounded-2xl bg-[#8b6b4a]/10 border border-[#8b6b4a]/30 text-left hover:bg-[#8b6b4a]/15 transition-colors"
        >
          <div className="flex items-center gap-2 text-[#5c4a32] dark:text-[#d4c4a8]">
            <BookOpen className="w-4 h-4" />
            <span className="font-serif text-sm font-bold">
              {language === 'ar' ? 'استئناف القراءة' : 'Resume reading'}
            </span>
          </div>
          <p className="font-serif text-xs text-[#8b6b4a] mt-1">
            {resumeLiturgy.en} • {resume.slug.replace(/-/g, ' ')}
          </p>
        </button>
      )}

      <div className="grid gap-4">
        {LITURGIES.map(lit => (
          <button
            key={lit.id}
            onClick={() => onSelect(lit.id)}
            disabled={loading}
            className="p-6 rounded-3xl bg-white/60 dark:bg-[#241d14] border-2 border-[#8b6b4a]/20 hover:border-[#8b6b4a]/50 hover:shadow-lg transition-all text-left disabled:opacity-50"
          >
            <div className="flex items-center gap-4">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-serif font-bold text-xl"
                style={{ backgroundColor: lit.color }}
              >
                {lit.en[0]}
              </div>
              <div className="flex-1">
                <h3 className="font-serif font-bold text-lg text-[#3d2f1f] dark:text-[#f5ebd9]">
                  {language === 'ar' ? lit.ar : lit.en}
                </h3>
                <p className="font-serif text-sm text-[#8b6b4a] dark:text-[#a89379]">
                  {language === 'ar' ? lit.en : lit.ar}
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-[#8b6b4a]" />
            </div>
          </button>
        ))}
      </div>

      {loading && (
        <p className="text-center mt-6 font-serif text-sm text-[#8b6b4a] animate-pulse">
          {language === 'ar' ? 'جاري التحميل...' : 'Loading...'}
        </p>
      )}
    </div>
  );
};

// Parts list screen
const PartsList: React.FC<{
  parts: KholagyPartMeta[];
  onSelect: (slug: string) => void;
  language: string;
}> = ({ parts, onSelect, language }) => {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="space-y-2">
        {parts.map((part, i) => (
          <button
            key={part.slug}
            onClick={() => onSelect(part.slug)}
            className="w-full p-4 rounded-2xl bg-white/60 dark:bg-[#241d14] border border-[#8b6b4a]/20 hover:border-[#8b6b4a]/40 hover:bg-white/80 dark:hover:bg-[#2a2218] transition-all text-left flex items-center gap-3"
          >
            <span className="w-8 h-8 rounded-full bg-[#8b6b4a]/15 text-[#5c4a32] dark:text-[#d4c4a8] font-serif text-sm font-bold flex items-center justify-center shrink-0">
              {i + 1}
            </span>
            <span className="flex-1 font-serif text-[15px] text-[#3d2f1f] dark:text-[#f5ebd9]">
              {part.name}
            </span>
            <ChevronRight className="w-4 h-4 text-[#8b6b4a] shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
};

// Reading view
const ReadingView: React.FC<{
  blocks: KholagyBlock[];
  fontSize: { base: string; heading: string };
  bookmarks: string[];
  liturgyId: string;
  partSlug: string;
  onToggleBookmark: (lit: string, slug: string, idx: number) => void;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  language: string;
}> = ({ blocks, fontSize, bookmarks, liturgyId, partSlug, onToggleBookmark, onPrev, onNext, hasPrev, hasNext, language }) => {
  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Parchment background */}
      <div className="bg-[#faf6ec] dark:bg-[#241d14] rounded-3xl border border-[#8b6b4a]/20 shadow-inner p-4 md:p-8">
        {blocks.map((block, idx) => {
          const key = `${liturgyId}:${partSlug}:${idx}`;
          const isBookmarked = bookmarks.includes(key);
          if (block.kind === 'heading') {
            return (
              <div key={idx} id={`kholagy-block-${idx}`} className="my-6 text-center">
                <h2 className={`font-serif font-bold ${fontSize.heading} text-[#3d2f1f] dark:text-[#f5ebd9] mb-3`}>
                  {block.en}
                </h2>
                {block.coptic && (
                  <p className={`font-serif ${fontSize.heading} text-[#5c4a32] dark:text-[#d4c4a8] mb-2`} dir="ltr">
                    {block.coptic}
                  </p>
                )}
                {block.ar && (
                  <p className={`font-serif ${fontSize.heading} text-[#5c4a32] dark:text-[#d4c4a8]`} dir="rtl">
                    {block.ar}
                  </p>
                )}
              </div>
            );
          }
          return (
            <div
              key={idx}
              id={`kholagy-block-${idx}`}
              className={`mb-6 pb-6 border-b border-[#8b6b4a]/15 last:border-0 ${block.kind === 'rubric' ? 'opacity-80' : ''}`}
            >
              {/* Desktop: 3 columns | Mobile: stacked */}
              <div className="grid md:grid-cols-3 gap-4 md:gap-6">
                <div className={`font-serif ${fontSize.base} leading-relaxed text-[#2d2418] dark:text-[#e8dcc4] ${block.kind === 'rubric' ? 'italic text-[#6b5a44]' : ''}`}>
                  {block.en}
                </div>
                <div className={`font-serif ${fontSize.base} leading-loose text-[#2d2418] dark:text-[#e8dcc4] md:text-center`} dir="ltr">
                  {block.coptic}
                </div>
                <div className={`font-serif ${fontSize.base} leading-relaxed text-[#2d2418] dark:text-[#e8dcc4] md:text-right`} dir="rtl">
                  {block.ar}
                </div>
              </div>
              {/* Bookmark */}
              <div className="mt-2 flex justify-end">
                <button
                  onClick={() => onToggleBookmark(liturgyId, partSlug, idx)}
                  className={`p-1.5 rounded-full transition-colors ${isBookmarked ? 'text-[#8b6b4a]' : 'text-[#8b6b4a]/40 hover:text-[#8b6b4a]/70'}`}
                  title={language === 'ar' ? 'علامة مرجعية' : 'Bookmark'}
                >
                  {isBookmarked ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Prev/Next navigation */}
      <div className="flex justify-between mt-6 mb-8">
        <button
          onClick={onPrev}
          disabled={!hasPrev}
          className="px-5 py-2.5 rounded-full bg-[#8b6b4a]/15 text-[#5c4a32] dark:text-[#d4c4a8] font-serif text-sm font-bold disabled:opacity-30 hover:bg-[#8b6b4a]/25 transition-colors flex items-center gap-2"
        >
          {language === 'ar' ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
          {language === 'ar' ? 'السابق' : 'Previous'}
        </button>
        <button
          onClick={onNext}
          disabled={!hasNext}
          className="px-5 py-2.5 rounded-full bg-[#8b6b4a]/15 text-[#5c4a32] dark:text-[#d4c4a8] font-serif text-sm font-bold disabled:opacity-30 hover:bg-[#8b6b4a]/25 transition-colors flex items-center gap-2"
        >
          {language === 'ar' ? 'التالي' : 'Next'}
          {language === 'ar' ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};

// Search view
const SearchView: React.FC<{
  query: string;
  onQueryChange: (q: string) => void;
  results: SearchDoc[];
  onSelect: (doc: SearchDoc) => void;
  language: string;
}> = ({ query, onQueryChange, results, onSelect, language }) => {
  const litName = (id: string) => LITURGIES.find(l => l.id === id)?.en || id;
  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="relative mb-6">
        <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-[#8b6b4a]" />
        <input
          type="text"
          value={query}
          onChange={e => onQueryChange(e.target.value)}
          placeholder={language === 'ar' ? 'ابحث في الخولاجي...' : 'Search the Kholagy...'}
          className="w-full pl-12 pr-4 py-3 rounded-2xl bg-white/70 dark:bg-[#241d14] border border-[#8b6b4a]/30 font-serif text-[#3d2f1f] dark:text-[#f5ebd9] placeholder-[#8b6b4a]/50 focus:outline-none focus:border-[#8b6b4a]"
          autoFocus
        />
      </div>
      {query.trim() && (
        <p className="font-serif text-sm text-[#8b6b4a] mb-4">
          {results.length} {language === 'ar' ? 'نتيجة' : 'results'}
        </p>
      )}
      <div className="space-y-3">
        {results.map((doc, i) => (
          <button
            key={`${doc.lit}-${doc.slug}-${doc.idx}-${i}`}
            onClick={() => onSelect(doc)}
            className="w-full p-4 rounded-2xl bg-white/60 dark:bg-[#241d14] border border-[#8b6b4a]/20 hover:border-[#8b6b4a]/40 text-left transition-all"
          >
            <p className="font-serif text-xs text-[#8b6b4a] mb-1">
              {litName(doc.lit)} • {doc.part}
            </p>
            <p className="font-serif text-sm text-[#3d2f1f] dark:text-[#f5ebd9] line-clamp-2">
              {doc.en || doc.coptic || doc.ar}
            </p>
            {doc.coptic && doc.en && (
              <p className="font-serif text-sm text-[#5c4a32] dark:text-[#d4c4a8] line-clamp-1 mt-1" dir="ltr">
                {doc.coptic}
              </p>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default KholagyReader;
