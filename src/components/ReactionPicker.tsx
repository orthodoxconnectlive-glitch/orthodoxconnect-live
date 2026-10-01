import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';
import {
  REACTION_EMOJIS,
  REACTION_HEART,
  reactionLabel,
  totalReactions,
  topEmojis,
  setReaction,
  removeReaction,
  fetchReactors,
  type ReactionTargetType,
} from '../utils/reactions';

export type { ReactionTargetType };

/* ------------------------------------------------------------------ */
/* useReactions — shared state + API for one reactable item            */
/* ------------------------------------------------------------------ */
export function useReactions(
  targetType: ReactionTargetType,
  targetId: string,
  initialCounts?: Record<string, number> | null,
  initialMyEmoji?: string | null,
  profile?: any
) {
  const [counts, setCounts] = useState<Record<string, number>>(initialCounts || {});
  const [myEmoji, setMyEmoji] = useState<string | null>(initialMyEmoji || null);
  const [busy, setBusy] = useState(false);
  const targetRef = useRef(targetId);
  const profileRef = useRef(profile);
  targetRef.current = targetId;
  profileRef.current = profile;

  // Fresh server data for the same item (e.g. feed refresh) resyncs us.
  const sync = useCallback((nextCounts?: Record<string, number> | null, nextMyEmoji?: string | null) => {
    if (nextCounts) setCounts(nextCounts);
    if (nextMyEmoji !== undefined) setMyEmoji(nextMyEmoji || null);
  }, []);

  const toggleHeart = useCallback(async () => {
    const tid = targetRef.current;
    if (!tid || busy) return;
    const hadEmoji = myEmoji;
    const prevCounts = counts;
    // Optimistic update.
    if (hadEmoji) {
      const nc: Record<string, number> = { ...counts };
      nc[hadEmoji] = Math.max(0, (nc[hadEmoji] || 1) - 1);
      if (nc[hadEmoji] === 0) delete nc[hadEmoji];
      setCounts(nc);
      setMyEmoji(null);
    } else {
      setCounts({ ...counts, [REACTION_HEART]: (counts[REACTION_HEART] || 0) + 1 });
      setMyEmoji(REACTION_HEART);
    }
    setBusy(true);
    try {
      const data = hadEmoji
        ? await removeReaction(targetType, tid)
        : await setReaction(targetType, tid, REACTION_HEART, profileRef.current);
      if (data && data.success) {
        setCounts(data.counts || {});
        setMyEmoji(data.my_emoji || null);
      } else {
        setCounts(prevCounts);
        setMyEmoji(hadEmoji);
      }
    } catch {
      setCounts(prevCounts);
      setMyEmoji(hadEmoji);
    } finally {
      setBusy(false);
    }
  }, [targetType, myEmoji, counts, busy]);

  const pickEmoji = useCallback(
    async (emoji: string) => {
      const tid = targetRef.current;
      if (!tid || busy) return;
      const prevCounts = counts;
      const prevEmoji = myEmoji;
      const removing = prevEmoji === emoji;
      // Optimistic update.
      const nc: Record<string, number> = { ...counts };
      if (prevEmoji) {
        nc[prevEmoji] = Math.max(0, (nc[prevEmoji] || 1) - 1);
        if (nc[prevEmoji] === 0) delete nc[prevEmoji];
      }
      if (!removing) nc[emoji] = (nc[emoji] || 0) + 1;
      setCounts(nc);
      setMyEmoji(removing ? null : emoji);
      setBusy(true);
      try {
        const data = removing
          ? await removeReaction(targetType, tid)
          : await setReaction(targetType, tid, emoji, profileRef.current);
        if (data && data.success) {
          setCounts(data.counts || {});
          setMyEmoji(data.my_emoji || null);
        } else {
          setCounts(prevCounts);
          setMyEmoji(prevEmoji);
        }
      } catch {
        setCounts(prevCounts);
        setMyEmoji(prevEmoji);
      } finally {
        setBusy(false);
      }
    },
    [targetType, myEmoji, counts, busy]
  );

  return {
    counts,
    total: totalReactions(counts),
    top: topEmojis(counts, 3),
    myEmoji,
    busy,
    toggleHeart,
    pickEmoji,
    sync,
  };
}

/* ------------------------------------------------------------------ */
/* useLongPress — press-and-hold opens the emoji picker                */
/* ------------------------------------------------------------------ */
export function useLongPress(onLongPress: (rect: DOMRect | null) => void, ms = 450) {
  const timer = useRef<any>(null);
  const fired = useRef(false);
  const rectRef = useRef<DOMRect | null>(null);

  const start = useCallback(
    (e?: React.MouseEvent | React.TouchEvent) => {
      fired.current = false;
      try {
        rectRef.current = (e?.currentTarget as HTMLElement)?.getBoundingClientRect() || null;
      } catch {
        rectRef.current = null;
      }
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        fired.current = true;
        onLongPress(rectRef.current);
      }, ms);
    },
    [onLongPress, ms]
  );

  const cancel = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => cancel, [cancel]);

  return {
    onMouseDown: start,
    onMouseUp: cancel,
    onMouseLeave: cancel,
    onTouchStart: start,
    onTouchEnd: cancel,
    onTouchMove: cancel,
    // If the long-press already opened the picker, swallow the click that
    // follows the release so we don't also toggle the heart.
    longPressFired: () => {
      const f = fired.current;
      fired.current = false;
      return f;
    },
  };
}

/* ------------------------------------------------------------------ */
/* ReactionPopup — the floating emoji row                              */
/* ------------------------------------------------------------------ */
export function ReactionPopup({
  myEmoji,
  onPick,
  onClose,
  language,
  anchorRect,
}: {
  myEmoji: string | null;
  onPick: (emoji: string) => void;
  onClose: () => void;
  language: string;
  anchorRect?: DOMRect | null;
}) {
  // Fixed positioning above the trigger button: immune to overflow-hidden
  // ancestors (post cards clip absolutely-positioned children).
  let style: React.CSSProperties = { left: '50%', bottom: 24 };
  if (anchorRect && typeof window !== 'undefined') {
    const cx = Math.min(
      Math.max(140, anchorRect.left + anchorRect.width / 2),
      window.innerWidth - 140
    );
    style = { left: cx, bottom: window.innerHeight - anchorRect.top + 10 };
  }
  return (
    <>
      <div className="fixed inset-0 z-40 cursor-default" onClick={onClose} onTouchStart={onClose} />
      <div
        className="fixed z-50 animate-fade-in"
        style={{ ...style, transform: 'translateX(-50%)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-0.5 bg-white dark:bg-[#282019] border border-(--ln-gold)/50 rounded-full px-1.5 py-1 shadow-2xl">
          {REACTION_EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              title={reactionLabel(e, language)}
              onClick={() => {
                onPick(e);
                onClose();
              }}
              className={`w-10 h-10 flex items-center justify-center text-2xl rounded-full transition-transform hover:scale-125 active:scale-110 cursor-pointer ${
                myEmoji === e ? 'bg-(--ac-gold)/20 ring-2 ring-(--ac-gold)' : ''
              }`}
            >
              {e}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* ReactionSummary — top emojis + total (opens the reactors modal)     */
/* ------------------------------------------------------------------ */
export function ReactionSummary({
  counts,
  total,
  myEmoji,
  language,
  onOpen,
}: {
  counts: Record<string, number>;
  total: number;
  myEmoji: string | null;
  language: string;
  onOpen: () => void;
}) {
  const top = topEmojis(counts, 3);
  if (total === 0) {
    return (
      <span className="font-medium text-(--tx-head) dark:text-[#e6d5b8]">
        {language === 'ar' ? 'كن أول من يتفاعل' : 'Be the first to react'}
      </span>
    );
  }
  let text: string;
  if (myEmoji && total === 1) {
    text = language === 'ar' ? 'أنت تفاعلت مع هذا' : 'You reacted to this';
  } else if (myEmoji) {
    text =
      language === 'ar'
        ? `أنت و ${total - 1} آخرين`
        : `You and ${total - 1} other${total - 1 === 1 ? '' : 's'}`;
  } else {
    text = `${total} ${language === 'ar' ? 'تفاعل' : total === 1 ? 'reaction' : 'reactions'}`;
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex items-center gap-1.5 hover:underline cursor-pointer group text-left rtl:text-right"
      title={language === 'ar' ? 'عرض التفاعلات' : 'See reactions'}
    >
      <div className="flex items-center -space-x-1.5 rtl:space-x-reverse">
        {top.map((e) => (
          <span
            key={e}
            className="w-5 h-5 rounded-full bg-white dark:bg-[#282019] border border-(--ln-gold)/40 flex items-center justify-center text-[11px] z-10 shadow-xs"
          >
            {e}
          </span>
        ))}
      </div>
      <span className="font-medium text-(--tx-head) dark:text-[#e6d5b8] group-hover:text-(--ac-gold-tx) transition-colors">
        {text}
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* ReactorsModal — who reacted, with their emoji                       */
/* ------------------------------------------------------------------ */
export function ReactorsModal({
  targetType,
  targetId,
  total,
  language,
  onClose,
  onSelectUser,
}: {
  targetType: ReactionTargetType;
  targetId: string;
  total: number;
  language: string;
  onClose: () => void;
  onSelectUser?: (u: any) => void;
}) {
  const [reactors, setReactors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await fetchReactors(targetType, targetId);
        if (alive) setReactors((data && data.reactors) || []);
      } catch {
        if (alive) setReactors([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [targetType, targetId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-[#fffdfa] dark:bg-[#1f1914] border border-(--ln-gold)/40 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-(--ln-gold)/20 bg-[#f5ebd9]/30 dark:bg-[#282019]">
          <div className="flex items-center gap-2">
            <span className="text-lg">💬</span>
            <h3 className="font-serif font-bold text-sm text-(--tx-strong) dark:text-[#f5ebd9]">
              {language === 'ar'
                ? `التفاعلات (${reactors.length || total})`
                : `Reactions (${reactors.length || total})`}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-(--tx-soft) hover:text-(--tx-strong) hover:bg-(--ac-gold)/15 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 max-h-80 overflow-y-auto divide-y divide-(--ln-gold)/10 space-y-2">
          {loading ? (
            <div className="py-6 text-center text-xs text-(--tx-soft) dark:text-(--ac-gold-tx) animate-pulse">
              {language === 'ar' ? 'جارٍ تحميل أبناء الرعية...' : 'Loading parishioners...'}
            </div>
          ) : reactors.length === 0 ? (
            <div className="py-6 text-center text-xs text-(--tx-soft) dark:text-[#a89379]">
              {language === 'ar' ? 'لا توجد تفاعلات بعد' : 'No reactions yet'}
            </div>
          ) : (
            reactors.map((r, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-2 pt-2 cursor-pointer hover:bg-(--ac-gold)/10 rounded-xl px-2 transition-colors"
                onClick={() => {
                  onClose();
                  onSelectUser?.({
                    id: r.userId || r.id,
                    name: r.userName || r.name || 'Parishioner',
                    avatar: r.userAvatar || r.avatar || '',
                    parish: 'Orthodox Parish',
                  });
                }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src={r.userAvatar || 'https://orthodoxconnect.live/launchericon-512x512.png'}
                    alt={r.userName || 'Member'}
                    className="w-9 h-9 rounded-full object-cover border border-(--ln-gold)/40"
                  />
                  <span className="font-serif font-semibold text-xs text-(--tx-strong) dark:text-[#f5ebd9] truncate">
                    {r.userName || 'Parishioner'}
                  </span>
                </div>
                <span className="text-xl shrink-0" title={reactionLabel(r.emoji, language)}>
                  {r.emoji}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* CommentReactions — compact inline variant for comments              */
/* ------------------------------------------------------------------ */
export function CommentReactions({
  targetId,
  initialCounts,
  initialMyEmoji,
  profile,
  language,
}: {
  targetId: string;
  initialCounts?: Record<string, number> | null;
  initialMyEmoji?: string | null;
  profile?: any;
  language: string;
}) {
  const { counts, total, top, myEmoji, pickEmoji } = useReactions(
    'comment',
    targetId,
    initialCounts,
    initialMyEmoji,
    profile
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          try {
            setAnchorRect((e.currentTarget as HTMLElement).getBoundingClientRect());
          } catch {
            setAnchorRect(null);
          }
          setPickerOpen((v) => !v);
        }}
        className={`flex items-center gap-1 transition-colors cursor-pointer font-medium ${
          myEmoji ? 'text-red-600' : 'hover:text-(--tx-head) dark:hover:text-[#e6d5b8]'
        }`}
        title={language === 'ar' ? 'تفاعل' : 'React'}
      >
        {total > 0 ? (
          <>
            <span className="flex items-center -space-x-1 rtl:space-x-reverse">
              {top.map((e) => (
                <span key={e} className="text-[11px] leading-none">
                  {e}
                </span>
              ))}
            </span>
            <span>{total}</span>
          </>
        ) : (
          <span>{language === 'ar' ? 'تفاعل' : 'React'}</span>
        )}
      </button>
      {pickerOpen && (
        <ReactionPopup
          myEmoji={myEmoji}
          language={language}
          anchorRect={anchorRect}
          onPick={pickEmoji}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </span>
  );
}
