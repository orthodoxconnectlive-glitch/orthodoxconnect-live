import React, { useEffect, useRef, useState } from 'react';
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
  Video,
  Send,
  Trash2,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { loadVideos, savePost, deletePost } from '../utils/posts';
import { uploadVideoToBunnyStream } from '../utils/storage';
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

// Kids Corner videos show ONLY posts explicitly tagged #kidsonly. Ordinary posts
// that merely mention kids stay on the main feed. Books/groups still use keyword
// matching (or the built-in youth type). The general feed is never shown here.
const KIDS_RE = /kid|child|أطفال|اطفال|للأطفال|للاطفال|sunday school|مدرسة ?الأحد/i;
// Marks a post as kids-only: hidden from the main feed, shown only in Kids Corner.
const KIDSONLY_RE = /#kidsonly/i;

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

function ytIdOf(v: Post): string | null {
  return extractYouTubeId(videoRawSource(v)) || extractYouTubeId(videoText(v)) || null;
}

function cleanCaption(v: Post): string {
  return videoText(v)
    .replace(/https?:\/\/[^\s]+/gi, '')
    .replace(/#\S+/g, '')
    .trim()
    .slice(0, 120);
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
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [ytMeta, setYtMeta] = useState<Record<string, { title: string; author: string }>>({});
  const ytMetaFetching = useRef<Set<string>>(new Set());

  // Real YouTube titles via the keyless oEmbed endpoint (no API key needed).
  useEffect(() => {
    const ids = new Set<string>();
    for (const v of videos) {
      const id = ytIdOf(v);
      if (id && !ytMeta[id] && !ytMetaFetching.current.has(id)) ids.add(id);
    }
    if (ids.size === 0) return;
    ids.forEach((id) => {
      ytMetaFetching.current.add(id);
      fetch(
        'https://www.youtube.com/oembed?url=' +
          encodeURIComponent('https://www.youtube.com/watch?v=' + id) +
          '&format=json'
      )
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (j && j.title)
            setYtMeta((m) => ({ ...m, [id]: { title: String(j.title), author: String(j.author_name || '') } }));
        })
        .catch(() => {})
        .finally(() => {
          ytMetaFetching.current.delete(id);
        });
    });
  }, [videos, ytMeta]);

  const authContext = useAuth() as any;
  const profile = authContext?.profile;

  // Kids share bar — everything shared here is automatically kids-only.
  const [shareCaption, setShareCaption] = useState('');
  const [kidsFile, setKidsFile] = useState<File | null>(null);
  const [kidsUploading, setKidsUploading] = useState(false);
  const [kidsProgress, setKidsProgress] = useState(0);
  const kidsFileRef = useRef<HTMLInputElement>(null);

  const handleKidsShare = async () => {
    const caption = shareCaption.trim();
    if ((!caption && !kidsFile) || kidsUploading) return;
    setKidsUploading(true);
    setKidsProgress(0);
    try {
      let finalVideoId: string | null = null;
      if (kidsFile) {
        const guid = await uploadVideoToBunnyStream(
          kidsFile,
          caption || kidsFile.name,
          (pct: number) => setKidsProgress(pct)
        );
        if (!guid) throw new Error('Bunny upload failed');
        finalVideoId = guid;
      } else {
        const match = caption.match(/https?:\/\/[^\s]+/i);
        if (match) finalVideoId = match[0];
      }
      let finalCaption = caption;
      if (!KIDSONLY_RE.test(finalCaption)) {
        finalCaption = (finalCaption ? finalCaption + ' ' : '') + '#kidsonly';
      }
      const created = await savePost({
        text: finalCaption,
        content: finalCaption,
        authorName: profile?.full_name || (ar ? 'عضو الرعية' : 'Orthodox Parishioner'),
        authorParish: profile?.parish || (ar ? 'كنيسة أرثوذكسية' : 'Orthodox Church'),
        authorAvatar:
          profile?.avatar_url || 'https://orthodoxconnect.live/launchericon-512x512.png',
        authorId: profile?.id,
        video_id: finalVideoId || undefined,
        video: finalVideoId || undefined,
      });
      setVideos((prev) => [created, ...prev]);
      setShareCaption('');
      setKidsFile(null);
      setKidsProgress(0);
    } catch (err) {
      console.warn('[KidsView] kids share failed:', err);
    } finally {
      setKidsUploading(false);
    }
  };

  const gName = (g: GroupRoom) => (ar ? g.name_ar || g.name : g.name_en || g.name);
  const gDesc = (g: GroupRoom) =>
    ar ? g.description_ar || g.description : g.description_en || g.description;

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [vids, bookRes, synced] = await Promise.all([
          loadVideos('only').catch(() => [] as Post[]),
          fetch('/api/books?category=all')
            .then((r) => (r.ok ? r.json() : []))
            .catch(() => [] as KidsBook[]),
          syncGroupsFromServer().catch(() => getCustomGroups()),
        ]);
        if (!alive) return;

        // Kids Corner videos: ONLY posts explicitly tagged #kidsonly (shared from
        // the Kids Corner share bar). Ordinary posts that merely mention kids
        // stay on the main feed.
        setVideos((vids || []).filter((v) => KIDSONLY_RE.test(videoText(v))));

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

  // Delete: the author can delete their own posts; an admin can delete any post.
  // Mirrors the main-feed PostCard pattern (owner-or-admin); the server's
  // DELETE /api/posts/:id enforces the same rule (auth.isAdmin || isAuthor).
  const isAdminProfile =
    profile?.role === 'admin' ||
    profile?.role === 'owner' ||
    profile?.role === 'super_admin' ||
    profile?.email === 'orthodoxconnect.live@gmail.com' ||
    profile?.id === '9e63fd72-f7c1-4748-b463-1137b469c7f5';

  const postAuthorId = (v: Post): string => (v.authorId || (v as any).author_id || '') as string;

  const canDelete = (v: Post): boolean =>
    Boolean(profile?.id) && (isAdminProfile || postAuthorId(v) === profile.id);

  const handleDeleteVideo = async (postId: string) => {
    const ok = window.confirm(ar ? 'هل تريد حذف هذا الفيديو؟' : 'Delete this video?');
    if (!ok) return;
    setDeletingId(postId);
    try {
      const res = await deletePost(postId, profile);
      if (res.success) {
        setVideos((prev) => prev.filter((pp) => pp.id !== postId));
      } else {
        window.alert(ar ? 'تعذر حذف الفيديو.' : 'Could not delete the video.');
      }
    } finally {
      setDeletingId(null);
    }
  };

  const renderVideoRow = (v: Post) => {
    const ytId = ytIdOf(v);
    const meta = ytId ? ytMeta[ytId] : undefined;
    const caption = cleanCaption(v);
    const title = meta?.title || caption || (ar ? 'فيديو أطفال' : 'Kids video');
    const author = meta?.author || v.authorName || (v as any).author_name || '';
    const active = playing?.id === v.id;
    return (
      <div
        key={v.id}
        onClick={() => setPlaying(v)}
        className={
          'group flex gap-3 px-2 py-2.5 rounded-xl transition-colors text-left rtl:text-right cursor-pointer ' +
          (active ? 'bg-amber-100/70 dark:bg-white/10' : 'hover:bg-black/5 dark:hover:bg-white/5')
        }
      >
        <div className="relative w-40 sm:w-52 shrink-0 aspect-video rounded-lg overflow-hidden bg-black/10">
          <img
            src={posterFor(v)}
            alt={title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
            <Play className="w-8 h-8 text-white fill-current opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
          </div>
          {canDelete(v) && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteVideo(v.id);
              }}
              disabled={deletingId === v.id}
              className="absolute top-1.5 right-1.5 rtl:right-auto rtl:left-1.5 w-7 h-7 rounded-full bg-black/60 border border-white/30 text-white/90 hover:text-white hover:bg-red-600 flex items-center justify-center transition-colors z-10 cursor-pointer disabled:opacity-50"
              title={ar ? 'حذف' : 'Delete'}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex-1 min-w-0 py-0.5">
          <p className="text-sm font-serif font-semibold text-(--tx-strong) dark:text-[#f5ebd9] leading-snug line-clamp-2">
            {title}
          </p>
          {author ? (
            <p className="text-xs text-(--tx-mute) font-serif mt-1 truncate">{author}</p>
          ) : null}
        </div>
      </div>
    );
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
              {ar ? 'ركن الأطفال' : 'Kids Corner'}
            </h2>
            <p className="text-xs text-(--tx-mute) dark:text-[#c9b795] font-serif mt-1 leading-relaxed">
              {ar
                ? 'مكان آمن ومبهج لأطفالنا: قصص الكتاب المقدس، ترانيم، وكتب — فقط محتوى مخصص للأطفال.'
                : 'A safe, joyful place for our little ones: Bible stories, hymns, and books — only kids-tagged content.'}
            </p>
          </div>
        </div>
      </div>

      {/* Kids share bar — everything shared here is kids-only (never on the main feed) */}
      <div className="bg-(--bg-card) dark:bg-[#1c1611] border-2 border-(--ln-gold) dark:border-[#8b6b4a] rounded-3xl p-4 shadow-lg space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-(--chip-dark) text-(--ac-gold-tx) flex items-center justify-center shrink-0 border-2 border-(--ln-gold)">
            <Baby className="w-5 h-5" />
          </div>
          <input
            type="text"
            value={shareCaption}
            onChange={(e) => setShareCaption(e.target.value)}
            placeholder={ar ? 'شارك فيديو للأطفال… الصق رابط يوتيوب أو أرفق فيديو' : 'Share a kids video… paste a YouTube link or attach a video'}
            className="flex-1 min-w-0 bg-transparent text-xs font-serif text-(--tx-strong) dark:text-[#f5ebd9] placeholder-(--tx-mute) dark:placeholder-(--tx-ph-dark) focus:outline-none"
          />
          <button
            type="button"
            onClick={() => kidsFileRef.current?.click()}
            className="p-2 rounded-xl text-(--tx-mute) hover:text-(--tx-strong) hover:bg-(--bg-soft) dark:hover:bg-[#282019] transition-colors shrink-0 cursor-pointer"
            title={ar ? 'أرفق فيديو' : 'Attach a video'}
          >
            <Video className="w-5 h-5 text-(--ac-bronze-tx)" />
          </button>
          <button
            type="button"
            onClick={handleKidsShare}
            disabled={kidsUploading || (!shareCaption.trim() && !kidsFile)}
            className="px-4 py-2 rounded-xl bg-(--ac-bronze) hover:bg-(--ac-bronze-dk) text-white font-serif uppercase tracking-wider font-bold text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer disabled:opacity-50 shrink-0"
          >
            {kidsUploading ? (
              <span>{kidsProgress > 0 ? `${kidsProgress}%` : (ar ? 'جارٍ النشر…' : 'Sharing…')}</span>
            ) : (
              <>
                <Send className="w-3.5 h-3.5 rtl:rotate-180" />
                <span>{ar ? 'مشاركة' : 'Share'}</span>
              </>
            )}
          </button>
        </div>
        {kidsFile && (
          <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-(--bg-soft) dark:bg-[#282019] border border-(--ln-gold)/40">
            <span className="text-[11px] font-serif text-(--tx-strong) dark:text-[#f5ebd9] truncate">{kidsFile.name}</span>
            <button
              type="button"
              onClick={() => setKidsFile(null)}
              className="p-1 text-(--tx-mute) hover:text-red-500 cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <input
          ref={kidsFileRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.[0]) setKidsFile(e.target.files[0]);
          }}
        />
        <p className="text-[10px] font-serif text-(--tx-mute) dark:text-[#a89379] px-1">
          {ar
            ? 'كل ما يُشارك هنا يظهر في ركن الأطفال فقط — ولن يظهر في الصفحة الرئيسية.'
            : 'Everything shared here appears only in Kids Corner — never on the main feed.'}
        </p>
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
                ? 'لا توجد فيديوهات أطفال بعد — استخدم صندوق المشاركة بالأعلى؛ كل ما يُشارك هنا يظهر في ركن الأطفال فقط.'
                : 'No kids videos yet — use the share box above; everything shared here appears only in Kids Corner.'
            }
          />
        ) : (
          <div className="flex flex-col">
            {videos.map((v) => renderVideoRow(v))}
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

      {/* Video player modal — full-screen watch page: player with the playlist beside it */}
      {playing && (
        <div className="fixed inset-0 z-50">
          <div className="relative w-full h-[100dvh] bg-(--bg-card) dark:bg-[#1c1611] flex flex-col overflow-hidden">
            <button
              onClick={() => setPlaying(null)}
              className="absolute top-3 right-3 rtl:right-auto rtl:left-3 w-9 h-9 rounded-full bg-(--ac-bronze) text-white flex items-center justify-center shadow-lg cursor-pointer z-10"
              aria-label={ar ? 'إغلاق' : 'Close'}
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden">
              <div className="flex-none md:flex-1 min-w-0 p-4 md:overflow-y-auto">
                {renderPlayer(playing)}
                <p className="text-sm font-serif font-semibold text-(--tx-strong) dark:text-[#f5ebd9] mt-3 leading-relaxed">
                  {(() => {
                    const ytId = ytIdOf(playing);
                    const meta = ytId ? ytMeta[ytId] : undefined;
                    return meta?.title || cleanCaption(playing) || (ar ? 'فيديو أطفال' : 'Kids video');
                  })()}
                </p>
              </div>
              <div className="flex-1 min-h-0 md:flex-none md:w-80 lg:w-96 border-t md:border-t-0 md:border-s border-black/10 dark:border-white/10 p-2 overflow-y-auto">
                <div className="flex flex-col">
                  {videos.map((v) => renderVideoRow(v))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
