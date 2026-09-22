import React, { useEffect, useState } from 'react';
import {
  Baby,
  Film,
  BookOpen,
  Users,
  Play,
  X,
  CheckCircle2,
  PlusCircle,
  Sparkles,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { loadVideos } from '../utils/posts';
import {
  getCustomGroups,
  syncGroupsFromServer,
  toggleGroupJoin,
  getJoinedGroupIds,
} from '../utils/groups';
import {
  extractYouTubeId,
  extractCleanVideoId,
  DEFAULT_POSTER,
} from '../components/VideoCard';
import { ALL_GROUPS } from './GroupRoomsView';
import type { Post, GroupRoom } from '../types';

// A video / book / group counts as kids material only when its creator
// explicitly tagged it for kids (caption, hashtag, title) — or when it is a
// built-in youth group. The general feed is never shown here.
const KIDS_RE = /kid|child|أطفال|اطفال|للأطفال|للاطفال|sunday school|مدرسة ?الأحد/i;

interface KidsBook {
  id: string;
  title_ar: string;
  title_en?: string;
  author_ar: string;
  author_en?: string;
  category: string;
  description?: string;
  cover_image_url?: string;
  file_url: string;
}

function videoRawSource(v: Post): string {
  const anyV = v as any;
  return (
    v.video_id || anyV.videoId || v.video || anyV.video_url || ''
  );
}

function videoText(v: Post): string {
  const anyV = v as any;
  return `${v.text || ''} ${anyV.content || ''}`;
}

function posterFor(v: Post): string {
  const raw = videoRawSource(v);
  const yt = extractYouTubeId(raw) || extractYouTubeId(videoText(v));
  const bunny = extractCleanVideoId(raw);
  if (bunny) return `https://vz-840ad26e-6fe.b-cdn.net/${bunny}/thumbnail.jpg`;
  if (yt) return `https://img.youtube.com/vi/${yt}/hqdefault.jpg`;
  const anyV = v as any;
  return v.image || anyV.image_url || DEFAULT_POSTER;
}

const SectionHeader: React.FC<{ icon: React.ReactNode; title: string; count: number }> = ({
  icon,
  title,
  count,
}) => (
  <div className="flex items-center gap-2 px-1">
    <span className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/40 border border-(--ln-gold) flex items-center justify-center text-amber-700 dark:text-amber-300 shrink-0">
      {icon}
    </span>
    <h3 className="font-serif-coptic font-bold text-sm text-(--tx-strong) dark:text-[#f5ebd9] uppercase tracking-wider">
      {title}
    </h3>
    <span className="text-xs text-(--tx-mute) font-serif">({count})</span>
  </div>
);

const EmptyNote: React.FC<{ text: string }> = ({ text }) => (
  <div className="p-6 text-center rounded-3xl bg-(--bg-card) dark:bg-[#1c1611] border-2 border-dashed border-(--ln-gold) text-xs font-serif text-(--tx-mute)">
    <p>{text}</p>
  </div>
);

export const KidsView: React.FC = () => {
  const { language } = useTheme();
  const ar = language === 'ar';

  const [videos, setVideos] = useState<Post[]>([]);
  const [books, setBooks] = useState<KidsBook[]>([]);
  const [groups, setGroups] = useState<GroupRoom[]>([]);
  const [joinedIds, setJoinedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [playing, setPlaying] = useState<Post | null>(null);

  const gName = (g: GroupRoom) => (ar ? g.name_ar || g.name : g.name_en || g.name);
  const gDesc = (g: GroupRoom) =>
    ar ? g.description_ar || g.description : g.description_en || g.description;

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [vids, bookRes, synced] = await Promise.all([
          loadVideos().catch(() => [] as Post[]),
          fetch('/api/books?category=all')
            .then((r) => (r.ok ? r.json() : []))
            .catch(() => [] as KidsBook[]),
          syncGroupsFromServer().catch(() => getCustomGroups()),
        ]);
        if (!alive) return;

        setVideos(
          (vids || []).filter((v) => KIDS_RE.test(videoText(v)))
        );

        const bookList: KidsBook[] = Array.isArray(bookRes) ? bookRes : [];
        setBooks(
          bookList.filter((b) =>
            KIDS_RE.test(`${b.title_en || ''} ${b.title_ar || ''} ${b.description || ''}`)
          )
        );

        const builtIn = ALL_GROUPS.filter(
          (g) => g.type === 'youth' || KIDS_RE.test(`${g.name} ${g.description}`)
        );
        const customs = (synced || []).filter((g) =>
          KIDS_RE.test(`${gName(g)} ${gDesc(g)} ${g.name} ${g.description}`)
        );
        const seen = new Set<string>();
        const merged: GroupRoom[] = [];
        for (const g of [...customs, ...builtIn]) {
          if (!seen.has(g.id)) {
            seen.add(g.id);
            merged.push(g);
          }
        }
        setGroups(merged);
        setJoinedIds(getJoinedGroupIds());
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleJoin = (id: string) => {
    toggleGroupJoin(id);
    setJoinedIds(getJoinedGroupIds());
  };

  const renderPlayer = (v: Post) => {
    const raw = videoRawSource(v);
    const yt = extractYouTubeId(raw) || extractYouTubeId(videoText(v));
    const bunny = extractCleanVideoId(raw);
    if (yt) {
      return (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&rel=0`}
          className="w-full aspect-video border-0 rounded-2xl bg-black"
          allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          title={ar ? 'فيديو أطفال' : 'Kids video'}
        />
      );
    }
    if (bunny) {
      return (
        <iframe
          src={`https://iframe.mediadelivery.net/embed/713265/${bunny}?autoplay=true`}
          className="w-full aspect-video border-0 rounded-2xl bg-black"
          allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          title={ar ? 'فيديو أطفال' : 'Kids video'}
        />
      );
    }
    if (/^https?:\/\//i.test(raw)) {
      return (
        <video src={raw} controls playsInline className="w-full max-h-[70vh] rounded-2xl bg-black" />
      );
    }
    return (
      <img
        src={posterFor(v)}
        alt={ar ? 'فيديو أطفال' : 'Kids video'}
        className="w-full aspect-video object-cover rounded-2xl"
      />
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="w-10 h-10 rounded-full border-4 border-(--ln-gold) border-t-transparent animate-spin" />
        <p className="text-xs text-(--tx-mute) font-serif">
          {ar ? 'جاري تحميل ركن الأطفال…' : 'Loading Kids Corner…'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Cheerful header */}
      <div className="relative overflow-hidden rounded-3xl border-2 border-(--ln-gold) dark:border-[#8b6b4a] bg-gradient-to-br from-amber-200 via-yellow-100 to-orange-100 dark:from-[#3a2c17] dark:via-[#2b2113] dark:to-[#211910] p-6 sm:p-8 shadow-lg">
        <div className="absolute -right-8 -top-8 w-40 h-40 bg-amber-300/30 dark:bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -left-6 -bottom-10 w-32 h-32 bg-orange-300/30 dark:bg-orange-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-16 h-16 rounded-3xl bg-(--ac-gold) dark:bg-amber-600 flex items-center justify-center shadow-md shrink-0">
            <Baby className="w-9 h-9 text-white" />
          </div>
          <div>
            <h2 className="font-serif-coptic font-bold text-2xl text-(--tx-strong) dark:text-[#f5ebd9]">
              {ar ? '🌈 ركن الأطفال' : '🌈 Kids Corner'}
            </h2>
            <p className="text-xs text-(--tx-mute) dark:text-[#c9b795] font-serif mt-1 leading-relaxed">
              {ar
                ? 'مكان آمن ومبهج لأطفالنا: قصص الكتاب المقدس، ترانيم، وكتب — فقط محتوى مخصص للأطفال.'
                : 'A safe, joyful place for our little ones: Bible stories, hymns, and books — only kids-tagged content.'}
            </p>
          </div>
        </div>
      </div>

      {/* Kids videos */}
      <div className="space-y-4">
        <SectionHeader
          icon={<Film className="w-4 h-4" />}
          title={ar ? 'فيديوهات الأطفال' : 'Kids Videos'}
          count={videos.length}
        />
        {videos.length === 0 ? (
          <EmptyNote
            text={
              ar
                ? 'لا توجد فيديوهات أطفال بعد — شارك فيديو واكتب "للأطفال" في الوصف ليظهر هنا.'
                : 'No kids videos yet — share a video and write "for kids" in the caption so it appears here.'
            }
          />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {videos.map((v) => {
              const caption = videoText(v).replace(/#\S+/g, '').trim().slice(0, 90);
              return (
                <button
                  key={v.id}
                  onClick={() => setPlaying(v)}
                  className="group relative rounded-3xl overflow-hidden border-2 border-(--ln-gold) dark:border-[#8b6b4a] bg-(--bg-card) dark:bg-[#1c1611] shadow-md text-left rtl:text-right cursor-pointer"
                >
                  <div className="relative aspect-[4/3] overflow-hidden">
                    <img
                      src={posterFor(v)}
                      alt={caption || (ar ? 'فيديو أطفال' : 'Kids video')}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-black/60 border-2 border-(--ln-gold) flex items-center justify-center text-amber-200 shadow-xl">
                        <Play className="w-6 h-6 fill-current ml-0.5" />
                      </div>
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="text-xs font-serif font-bold text-(--tx-strong) dark:text-[#f5ebd9] leading-snug line-clamp-2">
                      {caption || (ar ? 'فيديو أطفال' : 'Kids video')}
                    </p>
                    <p className="text-[10px] text-(--tx-mute) font-serif mt-1 truncate">
                      {v.authorName || (v as any).author_name || ''}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Kids books */}
      <div className="space-y-4">
        <SectionHeader
          icon={<BookOpen className="w-4 h-4" />}
          title={ar ? 'كتب الأطفال' : 'Kids Books'}
          count={books.length}
        />
        {books.length === 0 ? (
          <EmptyNote
            text={
              ar
                ? 'لا توجد كتب أطفال بعد — أضف كتاباً من المكتبة واكتب "للأطفال" في عنوانه ليظهر هنا.'
                : 'No kids books yet — add a book in the Library with "kids" in its title so it appears here.'
            }
          />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {books.map((b) => (
              <button
                key={b.id}
                onClick={() => window.open(b.file_url, '_blank', 'noopener')}
                className="rounded-3xl overflow-hidden border-2 border-(--ln-gold) dark:border-[#8b6b4a] bg-(--bg-card) dark:bg-[#1c1611] shadow-md text-left rtl:text-right cursor-pointer"
              >
                <div className="aspect-[3/4] bg-(--bg-soft) dark:bg-[#282019] flex items-center justify-center overflow-hidden">
                  {b.cover_image_url ? (
                    <img
                      src={b.cover_image_url}
                      alt={ar ? b.title_ar : b.title_en || b.title_ar}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <BookOpen className="w-10 h-10 text-(--tx-mute)" />
                  )}
                </div>
                <div className="p-3">
                  <p className="text-xs font-serif font-bold text-(--tx-strong) dark:text-[#f5ebd9] leading-snug line-clamp-2">
                    {ar ? b.title_ar || b.title_en : b.title_en || b.title_ar}
                  </p>
                  <p className="text-[10px] text-(--tx-mute) font-serif mt-1 truncate">
                    {ar ? b.author_ar || b.author_en : b.author_en || b.author_ar}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Kids groups */}
      <div className="space-y-4">
        <SectionHeader
          icon={<Users className="w-4 h-4" />}
          title={ar ? 'مجموعات الأطفال' : 'Kids Groups'}
          count={groups.length}
        />
        {groups.length === 0 ? (
          <EmptyNote
            text={
              ar
                ? 'لا توجد مجموعات أطفال بعد — أنشئ مجموعة واكتب "للأطفال" في اسمها لتظهر هنا.'
                : 'No kids groups yet — create a group with "kids" in its name so it appears here.'
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {groups.map((g) => {
              const joined = joinedIds.includes(g.id);
              return (
                <div
                  key={g.id}
                  className="rounded-3xl border-2 border-(--ln-gold) dark:border-[#8b6b4a] bg-(--bg-card) dark:bg-[#1c1611] p-5 shadow-md flex flex-col gap-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{g.icon}</span>
                    <div className="min-w-0">
                      <h4 className="font-serif-coptic font-bold text-sm text-(--tx-strong) dark:text-[#f5ebd9] truncate">
                        {gName(g)}
                      </h4>
                      <p className="text-[10px] text-(--tx-mute) font-serif uppercase tracking-wider">
                        {g.hostName || g.parish}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-(--tx-mute) font-serif leading-relaxed line-clamp-2">
                    {gDesc(g)}
                  </p>
                  <button
                    onClick={() => handleJoin(g.id)}
                    className={`mt-auto px-4 py-2 rounded-xl font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 text-xs cursor-pointer transition-all ${
                      joined
                        ? 'bg-(--bg-soft) dark:bg-[#282019] text-(--ac-bronze-tx) border border-(--ln-gold)'
                        : 'bg-(--ac-bronze) hover:bg-(--ac-bronze-dk) text-white shadow-md'
                    }`}
                  >
                    {joined ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{ar ? 'انضممت' : 'Joined'}</span>
                      </>
                    ) : (
                      <>
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>{ar ? 'انضم' : 'Join Group'}</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Safety note */}
      <div className="flex items-center justify-center gap-2 text-[10px] font-serif text-(--tx-mute) uppercase tracking-wider pb-4">
        <Sparkles className="w-3.5 h-3.5 text-(--ac-bronze-tx)" />
        <span>
          {ar
            ? 'يعرض ركن الأطفال فقط المحتوى المخصص للأطفال'
            : 'Kids Corner shows only kids-tagged content'}
        </span>
      </div>

      {/* Video player modal */}
      {playing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setPlaying(null)}
          />
          <div className="relative w-full max-w-2xl bg-(--bg-card) dark:bg-[#1c1611] border-2 border-(--ln-gold) rounded-3xl p-4 shadow-2xl">
            <button
              onClick={() => setPlaying(null)}
              className="absolute -top-3 -right-3 rtl:-right-auto rtl:-left-3 w-9 h-9 rounded-full bg-(--ac-bronze) text-white flex items-center justify-center shadow-lg cursor-pointer z-10"
              aria-label={ar ? 'إغلاق' : 'Close'}
            >
              <X className="w-5 h-5" />
            </button>
            {renderPlayer(playing)}
            <p className="text-xs font-serif text-(--tx-strong) dark:text-[#f5ebd9] mt-3 leading-relaxed line-clamp-3">
              {videoText(playing).slice(0, 200)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
