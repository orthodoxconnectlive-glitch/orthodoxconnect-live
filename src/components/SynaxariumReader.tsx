import React, { useEffect, useRef, useState } from 'react';
import { X, BookOpen, Loader2, AlertCircle, Heart, MessageCircle, Share2, Send, Trash2, ChevronLeft, ChevronRight, List } from 'lucide-react';
import { getSynaxariumDay, type SynaxariumDay } from '../data/synaxarium';
import { formatCopticDate, shiftCopticDay, copticToGregorian, COPTIC_MONTHS_EN, COPTIC_MONTHS_AR, type CopticDate } from '../utils/liturgicalEngine';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';

interface SynaxComment {
  id: string;
  synax_key: string;
  user_id: string;
  author_name?: string;
  author_avatar?: string;
  content: string;
  created_at: string;
}

interface SynaxariumReaderProps {
  copticDate: CopticDate;
  onClose: () => void;
}

/**
 * Full-day Synaxarium reader. Opens on the exact Coptic day passed in —
 * shows the day's titles and the complete text, in the user's language.
 * Arabic users get the full Arabic body text; English users get English.
 */
export const SynaxariumReader: React.FC<SynaxariumReaderProps> = ({ copticDate, onClose }) => {
  const { language } = useTheme();
  const isAr = language === 'ar';
  const authContext = useAuth() as any;
  const profile = authContext?.profile;
  // The day being viewed — starts on the day passed in, but the user can flip
  // to prev/next days or pick any day from the full 366-day listing.
  const [viewDate, setViewDate] = useState<CopticDate>(copticDate);
  // 'read' = the day's full text, 'list' = browsable index of all days.
  const [mode, setMode] = useState<'read' | 'list'>('read');
  const [listMonth, setListMonth] = useState<number>(copticDate.month);
  useEffect(() => {
    setViewDate(copticDate);
    setMode('read');
  }, [copticDate.year, copticDate.month, copticDate.day]);
  const bodyRef = useRef<HTMLDivElement>(null);
  // Engagement key: one per Coptic day ("MM-DD"), shared across languages
  // and years so the whole community likes/comments on the same day entry.
  const synaxKey = `${String(viewDate.month).padStart(2, '0')}-${String(viewDate.day).padStart(2, '0')}`;
  const [day, setDay] = useState<SynaxariumDay | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setDay(null);
    setError(false);
    bodyRef.current?.scrollTo({ top: 0 });
    getSynaxariumDay(viewDate)
      .then((d) => {
        if (!cancelled) setDay(d);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [viewDate]);

  const titles = day ? (isAr ? day.ar : day.en) : [];
  // Body text: Arabic body for Arabic users (falls back to English while
  // a day's translation is still pending), English body otherwise.
  const bodyText = day ? (isAr && day.ar_text ? day.ar_text : day.text) : '';
  const showingArBody = isAr && !!day?.ar_text;
  // Body paragraphs: split on blank lines, drop the repeated title head.
  const paragraphs = React.useMemo(() => {
    if (!day) return [];
    const parts = bodyText.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    // First paragraph is usually the title repeated — drop it if it matches a title.
    if (parts.length > 1) {
      const first = parts[0].replace(/^\d+\.\s*/, '').trim().toLowerCase();
      const refTitles = showingArBody ? day.ar : day.en;
      const isTitle = refTitles.some((t) => t.toLowerCase().includes(first.slice(0, 40)) || first.includes(t.toLowerCase().slice(0, 40)));
      if (isTitle) return parts.slice(1);
    }
    return parts;
  }, [day, bodyText, showingArBody]);

  // --- Like / comment / share engagement (per Coptic day) ---
  const [likesCount, setLikesCount] = useState(0);
  const [commentsCount, setCommentsCount] = useState(0);
  const [likedByMe, setLikedByMe] = useState(false);
  const [engLoading, setEngLoading] = useState(true);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<SynaxComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment] = useState('');

  // Full 366-day title index for the listing — lazy-loaded as its own chunk
  // only when the user opens the listing, so the main bundle stays lean.
  const [titlesIndex, setTitlesIndex] = useState<Record<string, { en: string[]; ar: string[] }> | null>(null);
  useEffect(() => {
    if (mode === 'list' && !titlesIndex) {
      import('../synaxTitles')
        .then((m) => setTitlesIndex(m.SYNAX_TITLES))
        .catch(() => {});
    }
  }, [mode, titlesIndex]);

  // Day flipping + listing helpers
  const prevDate = shiftCopticDay(viewDate, -1);
  const nextDate = shiftCopticDay(viewDate, 1);
  const shortDayLabel = (d: CopticDate) => formatCopticDate(d, language).split(' ').slice(0, 2).join(' ');
  const openDay = (month: number, dayNum: number) => {
    setViewDate({
      year: viewDate.year,
      month,
      day: dayNum,
      monthEn: COPTIC_MONTHS_EN[month - 1],
      monthAr: COPTIC_MONTHS_AR[month - 1],
    });
    setMode('read');
  };

  useEffect(() => {
    let cancelled = false;
    setEngLoading(true);
    setLikedByMe(false);
    setLikesCount(0);
    setCommentsCount(0);
    apiFetch<{ success: boolean; likes_count: number; comments_count: number; liked_by_me: boolean }>(
      `/api/synaxarium/engagement?key=${encodeURIComponent(synaxKey)}`
    )
      .then((res) => {
        if (cancelled || !res) return;
        setLikesCount(res.likes_count || 0);
        setCommentsCount(res.comments_count || 0);
        setLikedByMe(Boolean(res.liked_by_me));
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setEngLoading(false); });
    return () => { cancelled = true; };
  }, [synaxKey]);

  const toggleLike = async () => {
    const wasLiked = likedByMe;
    setLikedByMe(!wasLiked);
    setLikesCount((c) => Math.max(0, c + (wasLiked ? -1 : 1)));
    try {
      const res = await apiFetch<{ success: boolean; liked: boolean; likes_count: number }>(
        '/api/synaxarium/like', { method: 'POST', body: JSON.stringify({ key: synaxKey }) });
      if (res && res.success) {
        setLikedByMe(res.liked);
        setLikesCount(res.likes_count);
      }
    } catch (err) {
      console.error('Synaxarium like failed:', err);
      setLikedByMe(wasLiked);
      setLikesCount((c) => Math.max(0, c + (wasLiked ? 1 : -1)));
    }
  };

  const openComments = async () => {
    setCommentsOpen(true);
    setComments([]);
    setNewComment('');
    setCommentsLoading(true);
    try {
      const res = await apiFetch<{ success: boolean; comments: SynaxComment[] }>(
        `/api/synaxarium/comments?key=${encodeURIComponent(synaxKey)}`);
      setComments((res && res.comments) || []);
    } catch (err) {
      console.error('Error loading synaxarium comments:', err);
    }
    setCommentsLoading(false);
  };

  const submitComment = async () => {
    if (!newComment.trim()) return;
    const content = newComment.trim();
    setNewComment('');
    try {
      const res = await apiFetch<{ success: boolean; comment: SynaxComment; comments_count: number }>(
        '/api/synaxarium/comments',
        { method: 'POST', body: JSON.stringify({
            key: synaxKey,
            content,
            author_name: profile?.full_name || (isAr ? 'عضو الرعية' : 'Orthodox Parishioner'),
            author_avatar: profile?.avatar_url || 'https://orthodoxconnect.live/launchericon-512x512.png',
          }) });
      if (res && res.success && res.comment) {
        setComments((prev) => [...prev, res.comment]);
        setCommentsCount(res.comments_count);
      }
    } catch (err) {
      console.error('Error posting synaxarium comment:', err);
      setNewComment(content);
    }
  };

  const deleteComment = async (commentId: string) => {
    try {
      const res = await apiFetch<{ success: boolean; comments_count: number }>(
        `/api/synaxarium/comments/${encodeURIComponent(commentId)}`, { method: 'DELETE' });
      if (res && res.success) {
        setComments((prev) => prev.filter((c) => c.id !== commentId));
        setCommentsCount(res.comments_count);
      }
    } catch (err) {
      console.error('Error deleting synaxarium comment:', err);
    }
  };

  const shareDay = async () => {
    const url = `https://orthodoxconnect.live/synax/${synaxKey}`;
    const dayLabel = formatCopticDate(viewDate, language);
    const firstTitle = titles[0] || (isAr ? 'السنكسار اليومي' : 'Daily Synaxarium');
    // Hook: title + the story's opening lines, so people tap through to the app.
    const storyHead = paragraphs[0] || '';
    let teaser = storyHead;
    if (teaser.length > 160) {
      const cut = teaser.slice(0, 160);
      const sp = cut.lastIndexOf(' ');
      teaser = (sp > 40 ? cut.slice(0, sp) : cut) + '…';
    }
    const text = teaser ? `${firstTitle}\n${teaser}` : `${firstTitle} · ${dayLabel} | OrthodoxConnect`;
    if (typeof navigator !== 'undefined' && (navigator as any).share) {
      try {
        await (navigator as any).share({ title: firstTitle, text, url });
        return;
      } catch (e) { /* user dismissed */ }
    }
    try {
      await navigator.clipboard.writeText(url);
      alert(isAr ? 'تم نسخ رابط السنكسار — شاركه مع أحبائك' : 'Synaxarium link copied — share it with your loved ones');
    } catch (e) {
      console.error('Share failed:', e);
    }
  };

  const gregorian = copticToGregorian(viewDate).toLocaleDateString(isAr ? 'ar-EG' : 'en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        dir={isAr ? 'rtl' : 'ltr'}
        className="relative w-full sm:max-w-2xl max-h-[92vh] sm:max-h-[85vh] sm:rounded-3xl rounded-t-3xl bg-(--bg-card) dark:bg-[#1c1611] border-2 border-(--ln-gold) dark:border-[#8b6b4a] shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="shrink-0 px-5 py-4 border-b border-(--ln-gold) dark:border-[#8b6b4a] bg-(--bg-soft)/60 dark:bg-[#282019]/60">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-(--ac-gold)/15 border border-(--ln-gold)">
                <BookOpen className="w-5 h-5 text-(--ac-bronze-tx)" />
              </span>
              <div>
                <h2 className="font-serif-coptic font-bold text-lg text-(--tx-strong) dark:text-[#f5ebd9]">
                  {mode === 'list'
                    ? (isAr ? 'فهرس السنكسار' : 'Synaxarium Index')
                    : (isAr ? 'السنكسار اليومي' : 'Daily Synaxarium')}
                </h2>
                <p className="text-xs text-(--tx-mute) dark:text-[#a89379] font-serif">
                  {formatCopticDate(viewDate, language)} • {gregorian}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMode((m) => (m === 'list' ? 'read' : 'list'))}
                className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                  mode === 'list'
                    ? 'bg-(--ac-gold) text-white border-(--ac-gold)'
                    : 'bg-(--bg-deep) dark:bg-[#32251a] border-(--ln-gold) text-(--tx-strong) dark:text-[#f5ebd9] hover:bg-(--ac-gold) hover:text-white'
                }`}
                aria-label={isAr ? 'فهرس الأيام' : 'Browse all days'}
                title={isAr ? 'فهرس الأيام' : 'Browse all days'}
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-(--bg-deep) dark:bg-[#32251a] hover:bg-(--ac-gold) hover:text-white border border-(--ln-gold) text-(--tx-strong) dark:text-[#f5ebd9] transition-colors cursor-pointer"
                aria-label={isAr ? 'إغلاق' : 'Close'}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          {mode === 'read' && (
            <div className="flex items-center justify-between gap-2 mt-3">
              <button
                type="button"
                onClick={() => setViewDate((d) => shiftCopticDay(d, -1))}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-[11px] font-serif font-bold border border-(--ln-gold) text-(--tx-mute) dark:text-[#a89379] hover:text-(--ac-gold-tx) hover:border-(--ac-gold) transition-colors cursor-pointer"
              >
                {isAr ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
                <span>{shortDayLabel(prevDate)}</span>
              </button>
              <button
                type="button"
                onClick={() => setMode('list')}
                className="px-3 py-1.5 rounded-xl text-[11px] font-serif font-bold border border-(--ln-gold) text-(--tx-mute) dark:text-[#a89379] hover:text-(--ac-gold-tx) hover:border-(--ac-gold) transition-colors cursor-pointer"
              >
                {isAr ? 'كل الأيام' : 'All days'}
              </button>
              <button
                type="button"
                onClick={() => setViewDate((d) => shiftCopticDay(d, 1))}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-[11px] font-serif font-bold border border-(--ln-gold) text-(--tx-mute) dark:text-[#a89379] hover:text-(--ac-gold-tx) hover:border-(--ac-gold) transition-colors cursor-pointer"
              >
                <span>{shortDayLabel(nextDate)}</span>
                {isAr ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            </div>
          )}
        </div>

        {/* Body */}
        <div ref={bodyRef} className="flex-1 overflow-y-auto px-5 py-4">
          {mode === 'list' ? (
            <div className="space-y-4">
              {/* Month selector */}
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                {COPTIC_MONTHS_EN.map((mEn, i) => {
                  const m = i + 1;
                  const active = m === listMonth;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => { setListMonth(m); bodyRef.current?.scrollTo({ top: 0 }); }}
                      className={`shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-serif font-bold border transition-colors cursor-pointer ${
                        active
                          ? 'bg-(--ac-gold) text-white border-(--ac-gold)'
                          : 'border-(--ln-gold) text-(--tx-mute) dark:text-[#a89379] hover:text-(--ac-gold-tx)'
                      }`}
                    >
                      {isAr ? COPTIC_MONTHS_AR[i] : mEn}
                    </button>
                  );
                })}
              </div>
              {/* Day rows */}
              {!titlesIndex ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-(--tx-mute)">
                  <Loader2 className="w-8 h-8 animate-spin text-(--ac-bronze-tx)" />
                  <p className="text-sm font-serif">{isAr ? 'جاري تحميل الفهرس...' : 'Loading index...'}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {Array.from({ length: listMonth === 13 ? 6 : 30 }, (_, i) => i + 1).map((d) => {
                    const key = `${String(listMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                    const t = titlesIndex[key];
                    const dayTitles = t ? (isAr && t.ar.length ? t.ar : t.en) : [];
                    const label = dayTitles[0] || (isAr ? 'السنكسار اليومي' : 'Daily Synaxarium');
                    const extra = dayTitles.length > 1 ? ` (+${dayTitles.length - 1})` : '';
                    const isCurrent = listMonth === viewDate.month && d === viewDate.day;
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => openDay(listMonth, d)}
                        className={`w-full text-start flex items-center gap-3 p-3 rounded-2xl border transition-colors cursor-pointer ${
                          isCurrent
                            ? 'bg-(--ac-gold)/15 border-(--ac-gold)'
                            : 'bg-(--bg-soft)/80 dark:bg-[#282019]/80 border-(--ln-gold) hover:border-(--ac-gold)'
                        }`}
                      >
                        <span className="shrink-0 w-16 text-center px-2 py-1 rounded-lg bg-(--bg-deep) dark:bg-[#32251a] border border-(--ln-gold) text-[11px] font-serif font-bold text-(--ac-bronze-tx)">
                          {d} {isAr ? COPTIC_MONTHS_AR[listMonth - 1] : COPTIC_MONTHS_EN[listMonth - 1]}
                        </span>
                        <span className="flex-1 text-xs font-serif font-bold text-(--tx-strong) dark:text-[#f5ebd9] leading-relaxed line-clamp-2">
                          {label}{extra}
                        </span>
                        {isAr
                          ? <ChevronLeft className="w-4 h-4 shrink-0 text-(--tx-mute)" />
                          : <ChevronRight className="w-4 h-4 shrink-0 text-(--tx-mute)" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
          <>
          {!day && !error && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-(--tx-mute)">
              <Loader2 className="w-8 h-8 animate-spin text-(--ac-bronze-tx)" />
              <p className="text-sm font-serif">{isAr ? 'جاري تحميل السنكسار...' : 'Loading Synaxarium...'}</p>
            </div>
          )}
          {error && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-(--tx-mute)">
              <AlertCircle className="w-8 h-8 text-red-500" />
              <p className="text-sm font-serif">
                {isAr ? 'تعذر تحميل السنكسار. حاول مرة أخرى.' : 'Could not load the Synaxarium. Please try again.'}
              </p>
            </div>
          )}
          {day && (
            <div className="space-y-5">
              {/* Titles */}
              <div className="space-y-2">
                {titles.map((title, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-2xl bg-(--bg-soft)/80 dark:bg-[#282019]/80 border border-(--ln-gold)"
                  >
                    <p className="font-serif-coptic font-bold text-sm text-(--tx-strong) dark:text-[#f5ebd9] leading-relaxed">
                      {title}
                    </p>
                  </div>
                ))}
              </div>

              {/* Like / Comment / Share — one engagement thread per Coptic day */}
              <div className="flex items-center justify-around py-2 border-y border-(--ln-gold)/40">
                <button
                  type="button"
                  onClick={toggleLike}
                  disabled={engLoading}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-serif font-bold transition-colors cursor-pointer disabled:opacity-50 ${
                    likedByMe ? 'text-red-500' : 'text-(--tx-mute) dark:text-[#a89379] hover:text-red-400'
                  }`}
                  title={isAr ? 'إعجاب' : 'Like'}
                >
                  <Heart className={`w-4 h-4 ${likedByMe ? 'fill-red-500' : ''}`} />
                  <span>{likesCount}</span>
                </button>
                <button
                  type="button"
                  onClick={openComments}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-serif font-bold text-(--tx-mute) dark:text-[#a89379] hover:text-(--ac-gold-tx) transition-colors cursor-pointer"
                  title={isAr ? 'تعليق' : 'Comment'}
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>{commentsCount}</span>
                </button>
                <button
                  type="button"
                  onClick={shareDay}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-serif font-bold text-(--tx-mute) dark:text-[#a89379] hover:text-(--ac-gold-tx) transition-colors cursor-pointer"
                  title={isAr ? 'مشاركة' : 'Share'}
                >
                  <Share2 className="w-4 h-4" />
                  <span>{isAr ? 'مشاركة' : 'Share'}</span>
                </button>
              </div>

              {/* Full text — Arabic body for Arabic users, English otherwise */}
              <div>
                <p className="text-[10px] uppercase tracking-wider font-serif font-bold text-(--tx-mute) dark:text-[#a89379] mb-2">
                  {isAr ? (showingArBody ? 'النص الكامل' : 'النص الكامل (بالإنجليزية)') : 'Full text'}
                </p>
                <div dir={showingArBody ? 'rtl' : 'ltr'} className="space-y-3">
                  {paragraphs.map((p, i) => (
                    <p key={i} className="text-sm font-serif leading-relaxed text-(--tx-strong) dark:text-[#f5ebd9]">
                      {p}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}
          </>
          )}
        </div>
      </div>

      {/* Synaxarium comments modal */}
      {commentsOpen && (
        <div
          className="absolute inset-0 z-[110] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-sm"
          onClick={() => setCommentsOpen(false)}
        >
          <div
            dir={isAr ? 'rtl' : 'ltr'}
            className="bg-(--bg-soft) dark:bg-[#18120e] border-2 border-(--ln-gold) dark:border-[#8b6b4a] w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl relative text-(--tx-strong) dark:text-[#f5ebd9] max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setCommentsOpen(false)}
              className="absolute top-4 left-4 rtl:left-auto rtl:right-4 text-(--tx-mute) hover:text-(--tx-strong) dark:hover:text-white"
              aria-label={isAr ? 'إغلاق' : 'Close'}
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="font-serif-coptic font-bold text-base mb-1 text-center px-8 line-clamp-1">
              {titles[0] || (isAr ? 'السنكسار اليومي' : 'Daily Synaxarium')}
            </h2>
            <p className="text-[11px] text-(--tx-mute) dark:text-[#a89379] font-serif text-center mb-3">
              {isAr ? 'التعليقات' : 'Comments'} ({commentsCount})
            </p>
            <div className="flex-1 overflow-y-auto space-y-3 mb-3 min-h-[120px]">
              {commentsLoading ? (
                <p className="text-center text-xs text-(--tx-mute) font-serif py-8 animate-pulse">
                  {isAr ? 'جاري تحميل التعليقات...' : 'Loading comments...'}
                </p>
              ) : comments.length === 0 ? (
                <p className="text-center text-xs text-(--tx-mute) font-serif py-8">
                  {isAr ? 'لا توجد تعليقات بعد — كن أول من يعلق' : 'No comments yet — be the first to comment'}
                </p>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="flex items-start gap-2.5 bg-(--bg-card) dark:bg-[#282019] border border-(--ln-gold)/40 rounded-2xl p-2.5">
                    <img
                      src={c.author_avatar || 'https://orthodoxconnect.live/launchericon-512x512.png'}
                      alt=""
                      className="w-8 h-8 rounded-full object-cover border border-(--ln-gold) shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold font-serif">{c.author_name || (isAr ? 'عضو الرعية' : 'Orthodox Parishioner')}</p>
                      <p className="text-xs font-serif whitespace-pre-wrap break-words">{c.content}</p>
                    </div>
                    {(profile?.id === c.user_id || profile?.role === 'admin') && (
                      <button
                        onClick={() => deleteComment(c.id)}
                        className="text-(--tx-mute) hover:text-red-500 transition-colors shrink-0"
                        title={isAr ? 'حذف' : 'Delete'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
            <div className="flex items-center gap-2 border-t border-(--ln-gold)/30 pt-3">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submitComment(); }}
                placeholder={isAr ? 'اكتب تعليقاً...' : 'Write a comment...'}
                className="flex-1 p-2.5 rounded-xl bg-(--bg-card) dark:bg-[#282019] border border-(--ln-gold) outline-none text-xs text-(--tx-strong) dark:text-[#f5ebd9]"
              />
              <button
                onClick={submitComment}
                disabled={!newComment.trim()}
                className="p-2.5 rounded-xl bg-(--ac-gold) text-white hover:bg-(--ac-gold-deep) transition-colors disabled:opacity-40 cursor-pointer"
                aria-label={isAr ? 'إرسال' : 'Send'}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
