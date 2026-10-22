import React, { useMemo } from 'react';
import { Play, Sparkles } from 'lucide-react';
import { Post } from '../types';
import { useTheme } from '../context/ThemeContext';

// Today's Highlights (Hany 2026-10-22, after Facebook's Reels strip): a
// side-sliding rail under the Stories bar that collects the newest of each
// kind — Movie of the Day, the newest member Reel, Sermon of the Day, and
// the News — so members discover the whole app from one swipe. It derives
// everything from the feed's already-loaded posts (no extra fetch) and a
// tap scrolls to the full post in the feed. It hides itself on quiet days.

interface HighlightCard {
  key: string;
  postId: string;
  chip: string;
  title: string;
  image: string | null;
  isVideo: boolean;
  fallbackEmoji: string;
}

function firstContentLine(content: string, skipHeader: boolean): string {
  const lines = (content || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return '';
  return (skipHeader ? lines[1] || lines[0] : lines[0]) || '';
}

function newsHeadline(content: string): string {
  const lines = (content || '').split('\n').map((l) => l.trim());
  const hit = lines.find((l) => l.startsWith('1️⃣'));
  if (hit) return hit.replace(/^1️⃣\s*/, '').trim();
  return firstContentLine(content, true);
}

function videoThumb(p: any): string | null {
  const img = p.imageUrl || p.image_url || null;
  if (img) return img;
  const vid = p.videoId || p.video_id || '';
  if (typeof vid === 'string' && /^[\w-]{11}$/.test(vid)) {
    return `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`;
  }
  return null;
}

function scrollToPost(postId: string) {
  const el = document.getElementById(`post-card-${postId}`);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  try {
    el.classList.add('ring-4', 'ring-amber-400');
    window.setTimeout(() => el.classList.remove('ring-4', 'ring-amber-400'), 1600);
  } catch (e) { /* highlight is best-effort */ }
}

export const HighlightsRail: React.FC<{ posts: Post[] }> = ({ posts }) => {
  const { language } = useTheme();
  const ar = language === 'ar';

  const cards = useMemo<HighlightCard[]>(() => {
    const out: HighlightCard[] = [];
    const byAuthor = (id: string) =>
      posts.find((p: any) => (p.authorId || p.author_id) === id) as any;
    const contentOf = (p: any) => (p?.content || p?.text || '') as string;
    const photoOf = (p: any) => (p?.imageUrl || p?.image_url || null) as string | null;
    const isMember = (p: any) => {
      const authorId = p.authorId || p.author_id || '';
      return !String(authorId).startsWith('bot-') && !String(p.id).startsWith('livepost-');
    };

    // 1. Movie of the Day
    const movie = byAuthor('bot-movie-of-day');
    if (movie) {
      out.push({
        key: 'movie',
        postId: movie.id,
        chip: ar ? '🎬 فيلم اليوم' : '🎬 Movie',
        title: firstContentLine(contentOf(movie), true),
        image: videoThumb(movie),
        isVideo: true,
        fallbackEmoji: '🎬',
      });
    }

    // Member video posts (newest first, as loaded) feed both Reel slots.
    const memberVideos = posts.filter(
      (p: any) => isMember(p) && !!(p.videoId || p.video_id)
    ) as any[];

    // 2. Newest Reel
    const reel = memberVideos[0];
    if (reel) {
      out.push({
        key: 'reel',
        postId: reel.id,
        chip: ar ? '🎞 أحدث ريل' : '🎞 New Reel',
        title: firstContentLine(contentOf(reel), false) || (reel.authorName || reel.author_name || ''),
        image: videoThumb(reel),
        isVideo: true,
        fallbackEmoji: '🎞',
      });
    }

    // 3. Sermon of the Day
    const sermon = byAuthor('bot-sermon-of-day');
    if (sermon) {
      out.push({
        key: 'sermon',
        postId: sermon.id,
        chip: ar ? '🎙 عظة اليوم' : '🎙 Sermon',
        title: firstContentLine(contentOf(sermon), true),
        image: videoThumb(sermon),
        isVideo: true,
        fallbackEmoji: '🎙',
      });
    }

    // 4. News
    const news = byAuthor('bot-orthodox-news');
    if (news) {
      out.push({
        key: 'news',
        postId: news.id,
        chip: ar ? '📰 الأخبار' : '📰 News',
        title: newsHeadline(contentOf(news)),
        image: photoOf(news),
        isVideo: false,
        fallbackEmoji: '📰',
      });
    }

    // 5. Daily Verse
    const verse = byAuthor('bot-daily-verse');
    if (verse) {
      out.push({
        key: 'verse',
        postId: verse.id,
        chip: ar ? '📖 آية اليوم' : '📖 Verse',
        title: firstContentLine(contentOf(verse), true),
        image: photoOf(verse),
        isVideo: false,
        fallbackEmoji: '📖',
      });
    }

    // 6. Saint of the Day
    const saint = byAuthor('bot-saint-of-day');
    if (saint) {
      out.push({
        key: 'saint',
        postId: saint.id,
        chip: ar ? '☨ قديس اليوم' : '☨ Saint',
        title: firstContentLine(contentOf(saint), true),
        image: photoOf(saint),
        isVideo: false,
        fallbackEmoji: '☨',
      });
    }

    // 7. Church Calendar
    const calendar = byAuthor('bot-church-calendar');
    if (calendar) {
      out.push({
        key: 'calendar',
        postId: calendar.id,
        chip: ar ? '📅 السنكسار' : '📅 Calendar',
        title: firstContentLine(contentOf(calendar), true),
        image: photoOf(calendar),
        isVideo: false,
        fallbackEmoji: '📅',
      });
    }

    // 8. Job of the Day (only on days the bot actually posted)
    const job = byAuthor('bot-job-of-day');
    if (job) {
      out.push({
        key: 'job',
        postId: job.id,
        chip: ar ? '💼 وظيفة' : '💼 Job',
        title: firstContentLine(contentOf(job), true),
        image: photoOf(job),
        isVideo: false,
        fallbackEmoji: '💼',
      });
    }

    // 9. Second Reel
    const reel2 = memberVideos[1];
    if (reel2) {
      out.push({
        key: 'reel2',
        postId: reel2.id,
        chip: ar ? '🎞 ريل آخر' : '🎞 More Reels',
        title: firstContentLine(contentOf(reel2), false) || (reel2.authorName || reel2.author_name || ''),
        image: videoThumb(reel2),
        isVideo: true,
        fallbackEmoji: '🎞',
      });
    }

    // 10. Newest community photo (member photo post without video)
    const photo = posts.find(
      (p: any) => isMember(p) && !(p.videoId || p.video_id) && photoOf(p)
    ) as any;
    if (photo) {
      out.push({
        key: 'photo',
        postId: photo.id,
        chip: ar ? '📸 من المجتمع' : '📸 Community',
        title: firstContentLine(contentOf(photo), false) || (photo.authorName || photo.author_name || ''),
        image: photoOf(photo),
        isVideo: false,
        fallbackEmoji: '📸',
      });
    }

    return out.filter((c) => c.title || c.image);
  }, [posts, ar]);

  if (cards.length < 2) return null;

  return (
    <div className="mb-1" dir={ar ? 'rtl' : 'ltr'}>
      <div className="flex items-center gap-1.5 px-1 pb-1.5">
        <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        <p className="font-serif font-bold text-sm text-(--tx-strong) dark:text-[#f5ebd9]">
          {ar ? 'أبرز اليوم' : "Today's Highlights"}
        </p>
      </div>
      <div className="flex gap-3 overflow-x-auto no-scrollbar snap-x py-0.5 px-0.5">
        {cards.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => scrollToPost(c.postId)}
            className="relative w-[128px] h-[176px] shrink-0 snap-start rounded-2xl overflow-hidden shadow-md border border-black/10 dark:border-white/10 cursor-pointer text-left bg-gradient-to-b from-[#2b2118] to-[#171208]"
          >
            {c.image ? (
              <img
                src={c.image}
                alt=""
                loading="lazy"
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <span className="absolute inset-0 flex items-center justify-center text-5xl opacity-70">
                {c.fallbackEmoji}
              </span>
            )}
            <span className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
            <span className="absolute top-1.5 start-1.5 bg-black/55 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full backdrop-blur-sm">
              {c.chip}
            </span>
            {c.isVideo && (
              <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/45 rounded-full p-2 backdrop-blur-sm">
                <Play className="w-4 h-4 text-white fill-white" />
              </span>
            )}
            <span className="absolute inset-x-0 bottom-0 p-2 text-[11px] leading-snug font-bold text-white line-clamp-3">
              {c.title}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
