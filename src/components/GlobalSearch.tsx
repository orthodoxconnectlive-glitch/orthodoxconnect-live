import React, { useState, useEffect, useRef } from 'react';
import { Search, Users, FileText, Church as ChurchIcon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { profilesApi, postsApi, churchesApi } from '../lib/api';
import type { Post, Church } from '../types';

// Shape of a row returned by GET /api/profiles (see worker.ts).
export interface SearchProfile {
  id: string;
  email?: string;
  full_name: string;
  parish?: string;
  bio?: string;
  avatar_url?: string;
  role?: string;
}

export interface SearchResults {
  people: SearchProfile[];
  posts: Post[];
  churches: Church[];
}

const EMPTY: SearchResults = { people: [], posts: [], churches: [] };
const MAX_PER_SECTION = 6;
const CACHE_TTL_MS = 120_000;

// Module-level caches shared by the desktop + mobile search boxes so we
// never refetch the same lists twice for one page load.
let profilesCache: { data: SearchProfile[]; ts: number } | null = null;
let postsCache: { data: Post[]; ts: number } | null = null;

async function getCachedProfiles(): Promise<SearchProfile[]> {
  const now = Date.now();
  if (profilesCache && now - profilesCache.ts < CACHE_TTL_MS) return profilesCache.data;
  try {
    const rows = (await profilesApi.getAll()) as unknown as SearchProfile[];
    profilesCache = { data: rows || [], ts: now };
  } catch {
    profilesCache = { data: [], ts: now };
  }
  return profilesCache.data;
}

async function getCachedPosts(): Promise<Post[]> {
  const now = Date.now();
  if (postsCache && now - postsCache.ts < CACHE_TTL_MS) return postsCache.data;
  try {
    const rows = await postsApi.getAll({ limit: 100 });
    postsCache = { data: rows || [], ts: now };
  } catch {
    postsCache = { data: [], ts: now };
  }
  return postsCache.data;
}

function postText(p: Post): string {
  return p.content || p.text || '';
}

function postAuthor(p: Post): string {
  return p.author_name || p.authorName || '';
}

interface GlobalSearchBoxProps {
  autoFocus?: boolean;
  inputClassName?: string;
  /** 'absolute' floats the results under the input (desktop); 'static' stacks them below (mobile panel). */
  panelPosition?: 'absolute' | 'static';
  onSelectPerson: (p: SearchProfile) => void;
  onSelectPost: (p: Post) => void;
  onSelectChurch: (c: Church) => void;
  /** Called after any result is tapped (e.g. to close the mobile panel). */
  onNavigateAway?: () => void;
}

export const GlobalSearchBox: React.FC<GlobalSearchBoxProps> = ({
  autoFocus,
  inputClassName,
  panelPosition = 'absolute',
  onSelectPerson,
  onSelectPost,
  onSelectChurch,
  onNavigateAway,
}) => {
  const { t, language } = useTheme();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = setTimeout(() => setDebounced(query.trim()), 400);
    return () => clearTimeout(h);
  }, [query ]);

  useEffect(() => {
    if (debounced.length < 2) {
      setResults(EMPTY);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    (async () => {
      try {
        const [profiles, posts, churches] = await Promise.all([
          getCachedProfiles(),
          getCachedPosts(),
          churchesApi.list(debounced).catch(() => [] as Church[]),
        ]);
        if (cancelled) return;
        const q = debounced.toLowerCase();
        setResults({
          people: profiles
            .filter((p) =>
              `${p.full_name || ''} ${p.parish || ''}`.toLowerCase().includes(q)
            )
            .slice(0, MAX_PER_SECTION),
          posts: posts
            .filter((p) =>
              `${postText(p)} ${postAuthor(p)}`.toLowerCase().includes(q)
            )
            .slice(0, MAX_PER_SECTION),
          churches: (churches || []).slice(0, MAX_PER_SECTION),
        });
      } catch {
        if (!cancelled) setResults(EMPTY);
      } finally {
        if (!cancelled) setSearching(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  // Close the results when tapping outside, or on Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open ]);

  const showPanel = open && (debounced.length >= 2 || searching);
  const total =
    results.people.length + results.posts.length + results.churches.length;

  const pick = (fn: () => void) => () => {
    fn();
    setOpen(false);
    setQuery('');
    setDebounced('');
    setResults(EMPTY);
    onNavigateAway?.();
  };

  const sectionHeader = (Icon: any, label: string) => (
    <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-1 text-[10px] font-serif font-bold uppercase tracking-[0.15em] text-(--tx-mute) dark:text-[#a89379]">
      <Icon className="w-3.5 h-3.5 text-(--ac-bronze-tx)" />
      <span>{label}</span>
    </div>
  );

  const panel = (
    <div
      className={
        panelPosition === 'absolute'
          ? 'absolute top-full mt-2 left-0 rtl:left-auto rtl:right-0 w-80 max-w-[85vw] z-50'
          : 'mt-2 w-full'
      }
    >
      <div className="rounded-2xl bg-(--bg-card) dark:bg-[#1c1611] border-2 border-(--ln-gold) dark:border-[#8b6b4a] shadow-2xl overflow-hidden max-h-[60vh] overflow-y-auto">
        {searching && total === 0 ? (
          <div className="px-4 py-6 text-center text-xs font-serif text-(--tx-mute) dark:text-[#a89379]">
            {t('searching')}
          </div>
        ) : total === 0 ? (
          <div className="px-4 py-6 text-center text-xs font-serif text-(--tx-mute) dark:text-[#a89379]">
            {t('searchNoResults')}
          </div>
        ) : (
          <>
            {results.people.length > 0 && (
              <div>
                {sectionHeader(Users, t('searchPeople'))}
                {results.people.map((p) => (
                  <button
                    key={p.id}
                    onClick={pick(() => onSelectPerson(p))}
                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-(--ac-gold)/10 transition-colors text-left rtl:text-right cursor-pointer"
                  >
                    <img
                      src={p.avatar_url || 'https://orthodoxconnect.live/launchericon-512x512.png'}
                      alt={p.full_name}
                      className="w-9 h-9 rounded-full object-cover border border-(--ln-gold) shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-bold font-serif text-(--tx-strong) dark:text-[#f5ebd9] truncate">
                        {p.full_name}
                      </div>
                      {p.parish ? (
                        <div className="text-[10px] font-serif text-(--tx-mute) dark:text-[#a89379] truncate">
                          {p.parish}
                        </div>
                      ) : null}
                    </div>
                  </button>
                ))}
              </div>
            )}
            {results.posts.length > 0 && (
              <div>
                {sectionHeader(FileText, t('searchPosts'))}
                {results.posts.map((p) => {
                  const text = postText(p);
                  const snippet = text.length > 90 ? text.slice(0, 90) + '…' : text;
                  return (
                    <button
                      key={p.id}
                      onClick={pick(() => onSelectPost(p))}
                      className="w-full flex items-start gap-2.5 px-3 py-2 hover:bg-(--ac-gold)/10 transition-colors text-left rtl:text-right cursor-pointer"
                    >
                      <FileText className="w-4 h-4 mt-0.5 text-(--ac-bronze-tx) shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs font-serif text-(--tx-strong) dark:text-[#f5ebd9] leading-snug line-clamp-2">
                          {snippet || (language === 'ar' ? 'منشور' : 'Post')}
                        </div>
                        {postAuthor(p) ? (
                          <div className="text-[10px] font-serif font-bold text-(--tx-mute) dark:text-[#a89379] truncate mt-0.5">
                            {postAuthor(p)}
                          </div>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            {results.churches.length > 0 && (
              <div className="pb-2">
                {sectionHeader(ChurchIcon, t('searchChurches'))}
                {results.churches.map((c) => (
                  <button
                    key={c.id}
                    onClick={pick(() => onSelectChurch(c))}
                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-(--ac-gold)/10 transition-colors text-left rtl:text-right cursor-pointer"
                  >
                    {c.avatar ? (
                      <img
                        src={c.avatar}
                        alt={c.name}
                        className="w-9 h-9 rounded-full object-cover border border-(--ln-gold) shrink-0"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-(--bg-deep) dark:bg-[#282019] border border-(--ln-gold) flex items-center justify-center shrink-0">
                        <ChurchIcon className="w-4 h-4 text-(--ac-bronze-tx)" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-xs font-bold font-serif text-(--tx-strong) dark:text-[#f5ebd9] truncate">
                        {c.name}
                      </div>
                      {c.city ? (
                        <div className="text-[10px] font-serif text-(--tx-mute) dark:text-[#a89379] truncate">
                          {c.city}
                        </div>
                      ) : null}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  return (
    <div ref={wrapRef} className="relative w-full">
      <Search className="w-4 h-4 absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 text-(--tx-mute) dark:text-[#a89379] pointer-events-none" />
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={t('searchParish')}
        autoFocus={autoFocus}
        className={
          inputClassName ||
          'w-full pl-9 rtl:pl-3 rtl:pr-9 pr-3 py-1.5 text-[11px] font-serif uppercase tracking-wider rounded-full bg-(--bg-card) dark:bg-[#1c1611] border border-(--ln-gold) dark:border-[#8b6b4a] text-(--tx-strong) dark:text-[#f5ebd9] placeholder-(--tx-mute)/60 focus:outline-none focus:border-(--ln-bronze)'
        }
      />
      {showPanel ? panel : null}
    </div>
  );
};
