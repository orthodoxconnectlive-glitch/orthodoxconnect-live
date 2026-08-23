import { NotificationItem, NotificationPreferences } from '../types';
import { soundSynth, triggerBrowserNotification } from './ringtone';

const API_BASE_URL = typeof window !== 'undefined' ? (window.location.origin || '') : '';

const DEFAULT_PREFERENCES: NotificationPreferences = {
  messages: true,
  mentions: true,
  groupInvites: true,
  eventInvites: true,
  moderationAlerts: true,
  emailAlerts: false,
};

export function getCurrentUserId(): string | null {
  try {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('orthodox_current_user_id');
      if (stored) return stored;
      const rawProf = localStorage.getItem('orthodox_user_profile');
      if (rawProf) {
        const parsed = JSON.parse(rawProf);
        if (parsed?.id) return String(parsed.id);
      }
    }
  } catch (e) {
    // ignore
  }
  return null;
}

export function setCurrentUserId(userId?: string | null): void {
  try {
    if (typeof window !== 'undefined') {
      if (userId) {
        localStorage.setItem('orthodox_current_user_id', userId);
      } else {
        localStorage.removeItem('orthodox_current_user_id');
      }
    }
  } catch (e) {
    // ignore
  }
}

// User-scoped cache keys to prevent cross-user leakage
function getUserCacheKey(base: string, userId?: string | null): string {
  const uid = userId || getCurrentUserId() || 'guest';
  return `${base}_${uid}`;
}

function getLocalNotifications(userId?: string | null): NotificationItem[] {
  try {
    const key = getUserCacheKey('orthodox_notifications_cache_v6', userId);
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const activeUid = userId || getCurrentUserId();
        return parsed.filter((n: any) => {
          const t = (n.title || '').toLowerCase();
          const b = (n.body || '').toLowerCase();
          const isNotTest = !t.includes('test') && !b.includes('test');
          const isForUser = !activeUid || n.userId === 'all' || n.userId === activeUid;
          return isNotTest && isForUser;
        });
      }
    }
  } catch (e) {
    console.warn('Error loading cached notifications:', e);
  }
  return [];
}

function saveLocalNotifications(notifs: NotificationItem[], userId?: string | null): void {
  try {
    const key = getUserCacheKey('orthodox_notifications_cache_v6', userId);
    const activeUid = userId || getCurrentUserId();
    const cleaned = notifs.filter((n) => {
      const t = (n.title || '').toLowerCase();
      const b = (n.body || '').toLowerCase();
      const isNotTest = !t.includes('test') && !b.includes('test');
      const isForUser = !activeUid || n.userId === 'all' || n.userId === activeUid;
      return isNotTest && isForUser;
    });
    localStorage.setItem(key, JSON.stringify(cleaned));
    window.dispatchEvent(new CustomEvent('orthodox:notifications_updated'));
  } catch (e) {
    console.warn('Error saving notifications cache:', e);
  }
}

function getReadNotifIds(userId?: string | null): Set<string> {
  try {
    const key = getUserCacheKey('orthodox_read_notif_ids_v6', userId);
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return new Set(parsed);
    }
  } catch (e) {}
  return new Set();
}

function saveReadNotifIds(ids: Set<string>, userId?: string | null): void {
  try {
    const key = getUserCacheKey('orthodox_read_notif_ids_v6', userId);
    localStorage.setItem(key, JSON.stringify(Array.from(ids)));
  } catch (e) {}
}

function getDeletedNotifIds(userId?: string | null): Set<string> {
  try {
    const key = getUserCacheKey('orthodox_deleted_notif_ids_v6', userId);
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return new Set(parsed);
    }
  } catch (e) {}
  return new Set();
}

function saveDeletedNotifIds(ids: Set<string>, userId?: string | null): void {
  try {
    const key = getUserCacheKey('orthodox_deleted_notif_ids_v6', userId);
    localStorage.setItem(key, JSON.stringify(Array.from(ids)));
  } catch (e) {}
}

const NOTIF_CHANNEL_NAME = 'orthodox_notifications_cross_tab';
let notifChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    notifChannel = new BroadcastChannel(NOTIF_CHANNEL_NAME);
    notifChannel.onmessage = (event) => {
      if (event.data && event.data.type === 'NEW_NOTIFICATION') {
        const currentUserId = getCurrentUserId();
        const targetUserId = event.data.targetUserId;
        const actorName = event.data.actorName;

        const isForMe =
          !targetUserId ||
          targetUserId === 'all' ||
          (currentUserId && (currentUserId === targetUserId || targetUserId.includes(currentUserId)));

        const isSentByMe = Boolean(
          actorName === 'You' ||
          (currentUserId && event.data.actorId && event.data.actorId === currentUserId)
        );

        if (isForMe && !isSentByMe) {
          const item = event.data.item as NotificationItem;
          const existing = getLocalNotifications(currentUserId);
          const updated = [item, ...existing.filter((n) => n.id !== item.id)];
          saveLocalNotifications(updated, currentUserId);

          soundSynth.playNotificationChime();
          triggerBrowserNotification(item.title, {
            body: item.body,
            icon: item.senderAvatar || 'https://images.unsplash.com/photo-1548625361-1959779df5ff?auto=format&fit=crop&q=80&w=192',
            tag: `notif-${item.type}-${item.id}`,
          });
          window.dispatchEvent(new CustomEvent('orthodox:new_notification', { detail: item }));
        }
      }
    };
  }
} catch (e) {
  console.warn('BroadcastChannel fallback for notifications:', e);
}

export async function loadNotifications(userId?: string): Promise<NotificationItem[]> {
  const effectiveUserId = userId || getCurrentUserId() || undefined;
  const readIds = getReadNotifIds(effectiveUserId);
  const deletedIds = getDeletedNotifIds(effectiveUserId);
  const localItems = getLocalNotifications(effectiveUserId).filter((n) => !deletedIds.has(n.id));

  try {
    const queryParam = effectiveUserId ? `?recipient_id=${encodeURIComponent(effectiveUserId)}` : '';
    const res = await fetch(`${API_BASE_URL}/api/notifications${queryParam}`);
    if (res.ok) {
      const data = await res.json();
      if (data?.notifications && Array.isArray(data.notifications)) {
        const d1Items: NotificationItem[] = data.notifications
          .filter((d: any) => {
            const notifId = String(d.id);
            if (deletedIds.has(notifId)) return false;
            
            // Explicit user boundary check
            const recipient = d.recipient_id || d.user_id;
            if (effectiveUserId && recipient && recipient !== 'all' && recipient !== effectiveUserId) {
              return false;
            }

            const t = (d.title || '').toLowerCase();
            const m = (d.body || d.message || '').toLowerCase();
            return !t.includes('test') && !m.includes('test');
          })
          .map((d: any) => {
            const notifId = String(d.id);
            const isRead = readIds.has(notifId) || Boolean(d.is_read || d.read);
            return {
              id: notifId,
              userId: d.recipient_id || d.user_id || 'all',
              type: d.type || 'system',
              title: d.title || 'Parish Notification',
              body: d.body || d.message || '',
              link: d.link || (d.post_id ? 'feed' : undefined),
              isRead,
              createdAt: d.created_at || new Date().toISOString(),
              senderName: d.actor_name || d.sender_name || undefined,
              senderAvatar: d.actor_avatar || d.sender_avatar || undefined,
            };
          });

        const map = new Map<string, NotificationItem>();
        d1Items.forEach((r) => map.set(r.id, r));
        localItems.forEach((l) => {
          if (!deletedIds.has(l.id)) {
            if (!map.has(l.id)) {
              map.set(l.id, l);
            } else {
              if (l.isRead || readIds.has(l.id)) {
                const existing = map.get(l.id)!;
                map.set(l.id, { ...existing, isRead: true });
              }
            }
          }
        });

        const merged = Array.from(map.values()).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        saveLocalNotifications(merged, effectiveUserId);
        return merged;
      }
    }
  } catch (d1Err) {
    console.warn('[loadNotifications] fetch notice:', d1Err);
  }

  return localItems.map((n) => (readIds.has(n.id) ? { ...n, isRead: true } : n));
}

export async function addNotification(
  notif: Omit<NotificationItem, 'id' | 'createdAt' | 'isRead'> & { id?: string },
  sourceActorUserId?: string
): Promise<NotificationItem> {
  const currentUserId = getCurrentUserId();
  const targetUserId = notif.userId;

  const isForOtherUser = Boolean(
    targetUserId &&
    targetUserId !== 'all' &&
    currentUserId &&
    targetUserId !== currentUserId
  );

  const item: NotificationItem = {
    id: notif.id || `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    userId: targetUserId || 'all',
    type: notif.type,
    title: notif.title,
    body: notif.body,
    link: notif.link,
    senderName: notif.senderName,
    senderAvatar: notif.senderAvatar,
    isRead: false,
    createdAt: new Date().toISOString(),
  };

  // 1. Sync to backend
  try {
    await fetch(`${API_BASE_URL}/api/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: item.id,
        recipient_id: targetUserId,
        actor_id: sourceActorUserId || currentUserId,
        actor_name: notif.senderName || 'Orthodox Parishioner',
        actor_avatar: notif.senderAvatar,
        type: item.type,
        title: item.title,
        body: item.body,
        link: item.link,
        created_at: item.createdAt,
      }),
    });
  } catch (d1Err) {
    console.warn('[addNotification] sync notice:', d1Err);
  }

  // 2. Cross-tab real-time broadcast
  if (notifChannel) {
    notifChannel.postMessage({
      type: 'NEW_NOTIFICATION',
      targetUserId: targetUserId || 'all',
      actorName: notif.senderName,
      actorId: sourceActorUserId || currentUserId,
      item,
    });
  }

  if (isForOtherUser) {
    return item;
  }

  const existing = getLocalNotifications(currentUserId);
  const updated = [item, ...existing.filter((n) => n.id !== item.id)];
  saveLocalNotifications(updated, currentUserId);

  if (!currentUserId || item.senderName !== 'You') {
    soundSynth.playNotificationChime();
    triggerBrowserNotification(item.title, {
      body: item.body,
      icon: item.senderAvatar || 'https://images.unsplash.com/photo-1548625361-1959779df5ff?auto=format&fit=crop&q=80&w=192',
      tag: `notif-${item.type}-${item.id}`,
    });
    window.dispatchEvent(new CustomEvent('orthodox:new_notification', { detail: item }));
  }

  return item;
}

export async function markNotificationAsRead(id: string, userId?: string): Promise<void> {
  const activeUserId = userId || getCurrentUserId();
  const readIds = getReadNotifIds(activeUserId);
  readIds.add(id);
  saveReadNotifIds(readIds, activeUserId);

  const existing = getLocalNotifications(activeUserId);
  const updated = existing.map((n) => (n.id === id ? { ...n, isRead: true } : n));
  saveLocalNotifications(updated, activeUserId);

  try {
    await fetch(`${API_BASE_URL}/api/notifications/mark-read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, recipient_id: activeUserId }),
    });
  } catch (err) {}
}

export async function markAllNotificationsAsRead(userId?: string): Promise<void> {
  const activeUserId = userId || getCurrentUserId();
  const existing = getLocalNotifications(activeUserId);
  const readIds = getReadNotifIds(activeUserId);
  existing.forEach((n) => readIds.add(n.id));
  saveReadNotifIds(readIds, activeUserId);

  const updated = existing.map((n) => ({ ...n, isRead: true }));
  saveLocalNotifications(updated, activeUserId);

  try {
    await fetch(`${API_BASE_URL}/api/notifications/mark-read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true, recipient_id: activeUserId }),
    });
  } catch (err) {}
}

export async function deleteNotification(id: string, userId?: string): Promise<void> {
  const activeUserId = userId || getCurrentUserId();
  const deletedIds = getDeletedNotifIds(activeUserId);
  deletedIds.add(id);
  saveDeletedNotifIds(deletedIds, activeUserId);

  const existing = getLocalNotifications(activeUserId);
  const updated = existing.filter((n) => n.id !== id);
  saveLocalNotifications(updated, activeUserId);

  try {
    await fetch(`${API_BASE_URL}/api/notifications/${encodeURIComponent(id)}?recipient_id=${encodeURIComponent(activeUserId || '')}`, {
      method: 'DELETE',
    });
  } catch (err) {}
}

export function loadNotificationPreferences(): NotificationPreferences {
  try {
    const uid = getCurrentUserId() || 'guest';
    const saved = localStorage.getItem(`oc_notif_prefs_${uid}`);
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return DEFAULT_PREFERENCES;
}

export function saveNotificationPreferences(prefs: NotificationPreferences): void {
  try {
    const uid = getCurrentUserId() || 'guest';
    localStorage.setItem(`oc_notif_prefs_${uid}`, JSON.stringify(prefs));
  } catch (e) {}
}
