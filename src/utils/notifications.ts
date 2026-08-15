import { supabase } from '../lib/supabase';
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

const LOCAL_NOTIFS_STORAGE_KEY = 'orthodox_notifications_cache_v5';
const READ_NOTIF_IDS_KEY = 'orthodox_read_notif_ids_v5';
const DELETED_NOTIF_IDS_KEY = 'orthodox_deleted_notif_ids_v5';

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

// Cross-tab broadcast channel for instant real-time sync across tabs
let notifChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    notifChannel = new BroadcastChannel('orthodox_notifications_channel');
    notifChannel.onmessage = (event) => {
      const currentId = getCurrentUserId();
      if (event.data?.type === 'NEW_NOTIFICATION') {
        const item: NotificationItem = event.data.item;
        const targetUserId = event.data.targetUserId;
        // Only process and alert if this notification is for this user or broadcast
        if (!targetUserId || targetUserId === 'all' || (currentId && targetUserId === currentId)) {
          // If the item was sent by someone else, play sound & alert
          if (item.senderName !== event.data.actorName) {
            soundSynth.playNotificationChime();
          }
          window.dispatchEvent(new CustomEvent('orthodox:new_notification', { detail: item }));
          window.dispatchEvent(new CustomEvent('orthodox:notifications_updated'));
        }
      } else if (event.data?.type === 'NOTIFICATIONS_UPDATED') {
        window.dispatchEvent(new CustomEvent('orthodox:notifications_updated'));
      }
    };
  }
} catch (e) {
  console.warn('BroadcastChannel initialization fallback:', e);
}

export function isValidUuid(id?: string | null): boolean {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function getReadNotifIds(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_NOTIF_IDS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return new Set(parsed);
    }
  } catch (e) {
    // ignore
  }
  return new Set();
}

function saveReadNotifIds(ids: Set<string>): void {
  try {
    localStorage.setItem(READ_NOTIF_IDS_KEY, JSON.stringify(Array.from(ids).slice(-200)));
  } catch (e) {
    // ignore
  }
}

function getDeletedNotifIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DELETED_NOTIF_IDS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return new Set(parsed);
    }
  } catch (e) {
    // ignore
  }
  return new Set();
}

function saveDeletedNotifIds(ids: Set<string>): void {
  try {
    localStorage.setItem(DELETED_NOTIF_IDS_KEY, JSON.stringify(Array.from(ids).slice(-200)));
  } catch (e) {
    // ignore
  }
}

export function getLocalNotifications(targetUserIdParam?: string): NotificationItem[] {
  const readIds = getReadNotifIds();
  const deletedIds = getDeletedNotifIds();
  const effectiveUserId = targetUserIdParam || getCurrentUserId();

  try {
    const raw = localStorage.getItem(LOCAL_NOTIFS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
          .filter((item) => {
            if (deletedIds.has(item.id)) return false;
            if (item.id.startsWith('notif-welcome-') || item.id.startsWith('notif-event-')) return false;
            // Strict target recipient check: only show if for 'all' or matches current user
            if (item.userId && item.userId !== 'all' && effectiveUserId && item.userId !== effectiveUserId) {
              return false;
            }
            return true;
          })
          .map((item) => ({
            ...item,
            isRead: readIds.has(item.id) ? true : Boolean(item.isRead),
          }));
      }
    }
  } catch (e) {
    console.warn('Error reading local notifications:', e);
  }

  return [];
}

export function saveLocalNotifications(list: NotificationItem[]): void {
  try {
    const deletedIds = getDeletedNotifIds();
    const filtered = list.filter((n) => !deletedIds.has(n.id) && !n.id.startsWith('notif-welcome-') && !n.id.startsWith('notif-event-'));
    localStorage.setItem(LOCAL_NOTIFS_STORAGE_KEY, JSON.stringify(filtered.slice(0, 100)));
    // Dispatch local update event
    window.dispatchEvent(new CustomEvent('orthodox:notifications_updated'));
    if (notifChannel) {
      notifChannel.postMessage({ type: 'NOTIFICATIONS_UPDATED' });
    }
  } catch (e) {
    console.warn('Error saving local notifications:', e);
  }
}

export async function purgeTestNotifications(): Promise<void> {
  const current = getLocalNotifications();
  const filtered = current.filter((d) => {
    const t = (d.title || '').toLowerCase();
    const m = (d.body || '').toLowerCase();
    return !t.includes('test') && !m.includes('test');
  });
  saveLocalNotifications(filtered);
}

export async function loadNotifications(userId?: string): Promise<NotificationItem[]> {
  const localItems = getLocalNotifications();
  const readIds = getReadNotifIds();
  const deletedIds = getDeletedNotifIds();
  const effectiveUserId = userId || getCurrentUserId();

  // 1. Try Cloudflare D1 / Worker backend first
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
        saveLocalNotifications(merged);
        return merged;
      }
    }
  } catch (d1Err) {
    console.warn('[loadNotifications] Cloudflare D1 fetch notice:', d1Err);
  }

  // 2. Fallback to Supabase
  try {
    let query = supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);

    if (isValidUuid(effectiveUserId)) {
      query = query.or(`user_id.eq.${effectiveUserId},user_id.is.null`);
    } else if (effectiveUserId && effectiveUserId !== 'all') {
      query = query.or(`user_id.is.null`);
    }

    const timer = new Promise<any>((_, reject) => setTimeout(() => reject(new Error('NOTIFS_TIMEOUT')), 2500));
    const { data, error } = await Promise.race([query, timer]).catch(() => ({ data: null, error: null }));

    if (!error && data && Array.isArray(data)) {
      const remoteItems: NotificationItem[] = data
        .filter((d: any) => {
          const notifId = String(d.id);
          if (deletedIds.has(notifId)) return false;
          const t = (d.title || '').toLowerCase();
          const m = (d.message || d.body || '').toLowerCase();
          return !t.includes('test') && !m.includes('test');
        })
        .map((d: any) => {
          const notifId = String(d.id);
          const isRead = readIds.has(notifId) || Boolean(d.read ?? d.is_read ?? false);
          return {
            id: notifId,
            userId: d.user_id || 'all',
            type: d.type || 'system',
            title: d.title || 'Parish Notification',
            body: d.message || d.body || '',
            link: d.link || undefined,
            isRead,
            createdAt: d.created_at || new Date().toISOString(),
            senderName: d.sender_name || undefined,
            senderAvatar: d.sender_avatar || undefined,
          };
        });

      // Filter to ensure user only sees notifications meant for them or broadcast
      const targetFiltered = remoteItems.filter((r) => {
        if (!r.userId || r.userId === 'all') return true;
        if (effectiveUserId && r.userId === effectiveUserId) return true;
        return false;
      });

      // Merge local items and remote items by ID
      const map = new Map<string, NotificationItem>();
      targetFiltered.forEach((r) => map.set(r.id, r));
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

      saveLocalNotifications(merged);
      return merged;
    }
  } catch (err) {
    console.warn('[loadNotifications] Supabase fetch fallback to local cache:', err);
  }

  return localItems;
}

export async function addNotification(
  notif: Partial<NotificationItem>,
  actorUserId?: string
): Promise<NotificationItem> {
  const currentUserId = actorUserId || getCurrentUserId();
  const targetUserId = notif.userId;
  const isForOtherUser =
    targetUserId &&
    targetUserId !== 'all' &&
    currentUserId &&
    targetUserId !== currentUserId;

  const item: NotificationItem = {
    id: notif.id || 'notif-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
    userId: targetUserId || 'all',
    type: notif.type || 'system',
    title: notif.title || 'Notification',
    body: notif.body || '',
    link: notif.link,
    isRead: false,
    createdAt: new Date().toISOString(),
    senderName: notif.senderName,
    senderAvatar: notif.senderAvatar,
  };

  // 1. Sync to Cloudflare D1 / Worker backend
  try {
    const res = await fetch(`${API_BASE_URL}/api/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: item.id,
        recipient_id: item.userId === 'all' ? null : item.userId,
        actor_id: currentUserId,
        actor_name: item.senderName || 'Orthodox Parishioner',
        actor_avatar: item.senderAvatar || null,
        type: item.type,
        title: item.title,
        body: item.body,
        link: item.link || null,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.notification?.id) {
        item.id = String(data.notification.id);
      }
    }
  } catch (d1Err) {
    console.warn('Cloudflare D1 notification insertion notice:', d1Err);
  }

  // 2. Sync to Supabase table as backup
  try {
    const row: any = {
      user_id: isValidUuid(targetUserId) ? targetUserId : null,
      type: item.type,
      title: item.title,
      message: item.body || item.title,
      read: false,
    };
    if (item.link) row.link = item.link;
    if (item.senderName) row.sender_name = item.senderName;
    if (item.senderAvatar) row.sender_avatar = item.senderAvatar;

    const { data, error } = await supabase.from('notifications').insert([row]).select();
    if (!error && data && data.length > 0) {
      item.id = String(data[0].id);
    }
  } catch (err) {
    console.warn('Supabase notification insertion notice:', err);
  }

  // 3. Cross-tab real-time broadcast
  if (notifChannel) {
    notifChannel.postMessage({
      type: 'NEW_NOTIFICATION',
      targetUserId: targetUserId || 'all',
      actorName: notif.senderName,
      item,
    });
  }

  // 4. If this notification is targeted to ANOTHER user (e.g., you liked their post or commented),
  // DO NOT add it to the sender's own local inbox and DO NOT play audio chime or toast for the sender!
  if (isForOtherUser) {
    return item;
  }

  // 5. If this is a notification for the current user or broadcast:
  const existing = getLocalNotifications();
  const updated = [item, ...existing.filter((n) => n.id !== item.id)];
  saveLocalNotifications(updated);

  // Play sound & dispatch toast only if not triggered by self
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

export async function markNotificationAsRead(id: string): Promise<void> {
  const readIds = getReadNotifIds();
  readIds.add(id);
  saveReadNotifIds(readIds);

  const existing = getLocalNotifications();
  const updated = existing.map((n) => (n.id === id ? { ...n, isRead: true } : n));
  saveLocalNotifications(updated);

  // Sync with Cloudflare D1
  try {
    await fetch(`${API_BASE_URL}/api/notifications/mark-read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
  } catch (err) {
    // Non-blocking
  }

  // Sync with Supabase
  try {
    await supabase.from('notifications').update({ read: true, is_read: true }).eq('id', id);
  } catch (err) {
    // Non-blocking
  }
}

export async function markAllNotificationsAsRead(userId?: string): Promise<void> {
  const existing = getLocalNotifications();
  const readIds = getReadNotifIds();
  existing.forEach((n) => readIds.add(n.id));
  saveReadNotifIds(readIds);

  const updated = existing.map((n) => ({ ...n, isRead: true }));
  saveLocalNotifications(updated);

  // Sync with Cloudflare D1
  try {
    await fetch(`${API_BASE_URL}/api/notifications/mark-read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true, recipient_id: userId }),
    });
  } catch (err) {
    // Non-blocking
  }

  // Sync with Supabase
  try {
    let query = supabase.from('notifications').update({ read: true, is_read: true });
    if (isValidUuid(userId)) {
      query = query.or(`user_id.eq.${userId},user_id.is.null`);
    }
    await query;
  } catch (err) {
    // Non-blocking
  }
}

export async function deleteNotification(id: string): Promise<void> {
  const deletedIds = getDeletedNotifIds();
  deletedIds.add(id);
  saveDeletedNotifIds(deletedIds);

  const existing = getLocalNotifications();
  const updated = existing.filter((n) => n.id !== id);
  saveLocalNotifications(updated);

  // Sync with Cloudflare D1
  try {
    await fetch(`${API_BASE_URL}/api/notifications/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  } catch (err) {
    // Non-blocking
  }

  // Sync with Supabase
  try {
    await supabase.from('notifications').delete().eq('id', id);
  } catch (err) {
    // Non-blocking
  }
}

export function loadNotificationPreferences(): NotificationPreferences {
  try {
    const saved = localStorage.getItem('oc_notif_prefs');
    if (saved) return JSON.parse(saved);
  } catch (e) {
    // Ignore
  }
  return DEFAULT_PREFERENCES;
}

export function saveNotificationPreferences(prefs: NotificationPreferences): void {
  try {
    localStorage.setItem('oc_notif_prefs', JSON.stringify(prefs));
  } catch (e) {
    console.warn('Failed to save preferences:', e);
  }
}

