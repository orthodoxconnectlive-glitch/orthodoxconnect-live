import { supabase } from '../lib/supabase';
import { NotificationItem, NotificationPreferences } from '../types';
import { soundSynth, triggerBrowserNotification } from './ringtone';

const DEFAULT_PREFERENCES: NotificationPreferences = {
  messages: true,
  mentions: true,
  groupInvites: true,
  eventInvites: true,
  moderationAlerts: true,
  emailAlerts: false,
};

const LOCAL_NOTIFS_STORAGE_KEY = 'orthodox_notifications_cache_v4';
const READ_NOTIF_IDS_KEY = 'orthodox_read_notif_ids_v4';
const DELETED_NOTIF_IDS_KEY = 'orthodox_deleted_notif_ids_v4';

// Cross-tab broadcast channel for instant real-time sync across tabs
let notifChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    notifChannel = new BroadcastChannel('orthodox_notifications_channel');
    notifChannel.onmessage = (event) => {
      if (event.data?.type === 'NEW_NOTIFICATION') {
        window.dispatchEvent(new CustomEvent('orthodox:new_notification', { detail: event.data.item }));
        window.dispatchEvent(new CustomEvent('orthodox:notifications_updated'));
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

// Initial default seed notifications for fresh profiles
const DEFAULT_INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif-welcome-1',
    userId: 'all',
    type: 'system',
    title: 'Welcome to OrthodoxConnect',
    body: 'Christ is in our midst! Connect with parishioners, share reflections, and join live liturgical broadcasts.',
    link: 'feed',
    isRead: false,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    senderName: 'Parish Council',
    senderAvatar: 'https://images.unsplash.com/photo-1548625361-1959779df5ff?auto=format&fit=crop&q=80&w=200',
  },
  {
    id: 'notif-event-1',
    userId: 'all',
    type: 'event_invite',
    title: 'Feast Day Liturgy & Agaipe Meal',
    body: 'Join the Divine Liturgy tomorrow at 9:00 AM followed by our community fellowship lunch.',
    link: 'calendar',
    isRead: false,
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    senderName: 'Father Spyridon',
    senderAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
  },
];

export function getLocalNotifications(): NotificationItem[] {
  const readIds = getReadNotifIds();
  const deletedIds = getDeletedNotifIds();

  try {
    const raw = localStorage.getItem(LOCAL_NOTIFS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
          .filter((item) => !deletedIds.has(item.id))
          .map((item) => ({
            ...item,
            isRead: readIds.has(item.id) ? true : Boolean(item.isRead),
          }));
      }
    }
  } catch (e) {
    console.warn('Error reading local notifications:', e);
  }

  return DEFAULT_INITIAL_NOTIFICATIONS.filter((item) => !deletedIds.has(item.id)).map((item) => ({
    ...item,
    isRead: readIds.has(item.id) ? true : Boolean(item.isRead),
  }));
}

export function saveLocalNotifications(list: NotificationItem[]): void {
  try {
    const deletedIds = getDeletedNotifIds();
    const filtered = list.filter((n) => !deletedIds.has(n.id));
    localStorage.setItem(LOCAL_NOTIFS_STORAGE_KEY, JSON.stringify(filtered.slice(0, 100)));
    // Dispatch local and cross-tab update events
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

  try {
    let query = supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(40);

    if (isValidUuid(userId)) {
      query = query.or(`user_id.eq.${userId},user_id.is.null`);
    } else if (userId && userId !== 'all') {
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

      // Merge local items and remote items by ID
      const map = new Map<string, NotificationItem>();
      remoteItems.forEach((r) => map.set(r.id, r));
      localItems.forEach((l) => {
        if (!deletedIds.has(l.id)) {
          if (!map.has(l.id)) {
            map.set(l.id, l);
          } else {
            // Keep read status if locally read
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
  notif: Partial<NotificationItem>
): Promise<NotificationItem> {
  const targetUserId = isValidUuid(notif.userId) ? notif.userId : null;

  const item: NotificationItem = {
    id: notif.id || 'notif-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
    userId: notif.userId || 'all',
    type: notif.type || 'system',
    title: notif.title || 'Notification',
    body: notif.body || '',
    link: notif.link,
    isRead: false,
    createdAt: new Date().toISOString(),
    senderName: notif.senderName,
    senderAvatar: notif.senderAvatar,
  };

  // 1. Immediately save to local cache so it appears without delay
  const existing = getLocalNotifications();
  const updated = [item, ...existing.filter((n) => n.id !== item.id)];
  saveLocalNotifications(updated);

  // 2. Play acoustic chime alert
  soundSynth.playNotificationChime();

  // 3. Trigger native browser OS notification (e.g. background/minimized tab alert)
  triggerBrowserNotification(item.title, {
    body: item.body,
    icon: item.senderAvatar || 'https://images.unsplash.com/photo-1548625361-1959779df5ff?auto=format&fit=crop&q=80&w=192',
    tag: `notif-${item.type}-${item.id}`,
  });

  // 4. Dispatch in-app toast event & broadcast to all tabs
  window.dispatchEvent(new CustomEvent('orthodox:new_notification', { detail: item }));
  if (notifChannel) {
    notifChannel.postMessage({ type: 'NEW_NOTIFICATION', item });
  }

  // 5. Try syncing to Supabase if available
  try {
    const row: any = {
      user_id: targetUserId,
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
    // Non-blocking: local notification was already created
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
