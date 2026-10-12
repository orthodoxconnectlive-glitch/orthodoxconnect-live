import React, { useState, useEffect } from 'react';
import { MessagesSquare, RefreshCw, Image as ImageIcon, Video as VideoIcon, Mic } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { authHeader } from '../lib/api';

interface GroupInfo {
  id: string;
  name: string;
  name_ar?: string;
}

interface GroupMsg {
  id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  image_url?: string | null;
  video_url?: string | null;
  audio_url?: string | null;
  created_at: string;
}

function fmtTime(iso: string, ar: boolean): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(ar ? 'ar-EG' : 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export const AdminGroupMessages: React.FC = () => {
  const { language } = useTheme();
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [groupId, setGroupId] = useState('');
  const [messages, setMessages] = useState<GroupMsg[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ar = language === 'ar';
  const PAGE = 50;

  useEffect(() => {
    let cancelled = false;
    fetch('/api/groups')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        const list: GroupInfo[] = Array.isArray(d?.groups) ? d.groups : [];
        setGroups(list);
        if (list.length > 0 && !groupId) setGroupId(list[0].id);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMessages = async (gid: string, before?: string, append = false) => {
    if (!gid) return;
    if (append) setLoadingMore(true);
    else {
      setLoading(true);
      setError(null);
    }
    try {
      let url = `/api/admin/group-messages?group_id=${encodeURIComponent(gid)}&limit=${PAGE}`;
      if (before) url += `&before=${encodeURIComponent(before)}`;
      const r = await fetch(url, { headers: authHeader() });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d?.success) {
        throw new Error(d?.error || (ar ? 'فشل تحميل الرسائل.' : 'Failed to load messages.'));
      }
      const list: GroupMsg[] = Array.isArray(d.messages) ? d.messages : [];
      setHasMore(list.length >= PAGE);
      setMessages((prev) => (append ? [...list, ...prev] : list));
    } catch (e: any) {
      if (!append) setError(e?.message || (ar ? 'فشل تحميل الرسائل.' : 'Failed to load messages.'));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (groupId) {
      setMessages([]);
      setHasMore(false);
      loadMessages(groupId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  const groupName = (g: GroupInfo) => (ar && g.name_ar ? g.name_ar : g.name) || g.id;

  return (
    <div className="p-4 rounded-3xl bg-(--bg-card) dark:bg-[#1c1611] border-2 border-(--ln-gold) dark:border-[#8b6b4a] shadow-lg">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-12 h-12 rounded-2xl bg-(--ac-gold)/15 flex items-center justify-center shrink-0">
          <MessagesSquare className="w-6 h-6 text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-serif font-bold text-base text-(--tx-head)">
            {ar ? 'رسائل المجموعات' : 'Group Messages'}
          </p>
          <p className="text-xs text-(--tx-soft) mt-0.5">
            {ar ? 'عرض رسائل مجموعات الزمالة (للمشرفين فقط)' : 'View fellowship group messages (admins only)'}
          </p>
        </div>
        <button
          onClick={() => groupId && loadMessages(groupId)}
          disabled={loading || !groupId}
          className="p-2 rounded-xl border-2 border-(--ln-bright)/30 text-(--tx-head) hover:bg-(--bg-inset) transition-all cursor-pointer disabled:opacity-50"
          aria-label={ar ? 'تحديث' : 'Refresh'}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <select
        value={groupId}
        onChange={(e) => setGroupId(e.target.value)}
        className="w-full mb-3 px-4 py-2.5 rounded-xl border-2 border-(--ln-bright)/30 bg-(--bg-inset) text-sm text-(--tx-head) focus:outline-none focus:border-(--ac-bright) cursor-pointer"
      >
        {groups.length === 0 && <option value="">{ar ? 'لا توجد مجموعات' : 'No groups'}</option>}
        {groups.map((g) => (
          <option key={g.id} value={g.id}>
            {groupName(g)}
          </option>
        ))}
      </select>

      {error && (
        <p className="text-xs font-bold text-red-600 dark:text-red-400 mb-2">{error}</p>
      )}

      <div className="max-h-96 overflow-y-auto space-y-2 rounded-xl">
        {loading && messages.length === 0 && (
          <p className="text-xs text-(--tx-soft) text-center py-6">{ar ? 'جارٍ التحميل...' : 'Loading...'}</p>
        )}
        {!loading && messages.length === 0 && !error && (
          <p className="text-xs text-(--tx-soft) text-center py-6">
            {ar ? 'لا توجد رسائل في هذه المجموعة.' : 'No messages in this group yet.'}
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className="px-3 py-2 rounded-xl bg-(--bg-inset) border border-(--ln-bright)/20">
            <div className="flex items-baseline justify-between gap-2 mb-0.5">
              <span className="text-xs font-bold text-(--ac-bright-tx) truncate">
                {m.sender_name || (ar ? 'عضو' : 'Member')}
              </span>
              <span className="text-[10px] text-(--tx-soft) shrink-0">{fmtTime(m.created_at, ar)}</span>
            </div>
            {m.content ? (
              <p className="text-xs text-(--tx-head) leading-relaxed break-words">{m.content}</p>
            ) : null}
            {!m.content && (
              <p className="text-xs text-(--tx-soft) italic flex items-center gap-1.5">
                {m.image_url ? (
                  <><ImageIcon className="w-3.5 h-3.5" /> {ar ? 'صورة' : 'Photo'}</>
                ) : m.video_url ? (
                  <><VideoIcon className="w-3.5 h-3.5" /> {ar ? 'فيديو' : 'Video'}</>
                ) : m.audio_url ? (
                  <><Mic className="w-3.5 h-3.5" /> {ar ? 'رسالة صوتية' : 'Voice message'}</>
                ) : (
                  ar ? '(بدون نص)' : '(no text)'
                )}
              </p>
            )}
          </div>
        ))}
      </div>

      {hasMore && messages.length > 0 && (
        <button
          onClick={() => loadMessages(groupId, messages[0]?.created_at, true)}
          disabled={loadingMore}
          className="w-full mt-2 px-4 py-2 rounded-xl border-2 border-(--ln-bright)/30 text-xs font-bold text-(--tx-head) hover:bg-(--bg-inset) transition-all cursor-pointer disabled:opacity-50"
        >
          {loadingMore ? (ar ? 'جارٍ التحميل...' : 'Loading...') : (ar ? 'عرض رسائل أقدم' : 'Load older messages')}
        </button>
      )}
    </div>
  );
};
