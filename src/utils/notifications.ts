import { supabase } from '../lib/supabase';
import { NotificationItem, NotificationPreferences } from '../types';

const DEFAULT_PREFERENCES: NotificationPreferences = {
  messages: true,
  mentions: true,
  groupInvites: true,
  eventInvites: true,
  moderationAlerts: true,
  emailAlerts: false,
};

export function isValidUuid(id?: string | null): boolean {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

export async function purgeTestNotifications(): Promise<void> {
  try {
    await supabase
      .from('notifications')
      .delete()
      .or('title.ilike.%test%,message.ilike.%test%');
  } catch (err) {
    console.error('Error purging test notifications:', err);
  }
}

export async function loadNotifications(userId?: string): Promise<NotificationItem[]> {
  try {
    // Proactively purge test entries from the database
    purgeTestNotifications();

    let query = supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false });

    if (isValidUuid(userId)) {
      query = query.or(`user_id.eq.${userId},user_id.is.null`);
    } else if (userId && userId !== 'all') {
      query = query.or(`user_id.is.null`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[loadNotifications] Fetch error:', error);
      return [];
    }

    if (data) {
      return data
        .filter((d: any) => {
          const t = (d.title || '').toLowerCase();
          const m = (d.message || d.body || '').toLowerCase();
          return !t.includes('test') && !m.includes('test');
        })
        .map((d: any) => ({
          id: String(d.id),
          userId: d.user_id || 'all',
          type: d.type || 'system',
          title: d.title || 'Parish Notification',
          body: d.message || d.body || '',
          link: d.link || undefined,
          isRead: d.read ?? d.is_read ?? false,
          createdAt: d.created_at || new Date().toISOString(),
          senderName: d.sender_name || undefined,
          senderAvatar: d.sender_avatar || undefined,
        }));
    }
  } catch (err) {
    console.error('[loadNotifications] Exception:', err);
  }

  return [];
}

export async function addNotification(
  notif: Partial<NotificationItem>
): Promise<NotificationItem> {
  const targetUserId = isValidUuid(notif.userId) ? notif.userId : null;

  const item: NotificationItem = {
    id: notif.id || 'notif-' + Date.now(),
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

    if (error) {
      console.error('[addNotification] Supabase error:', error);
    } else if (data && data.length > 0) {
      item.id = String(data[0].id);
    }
  } catch (err) {
    console.error('[addNotification] Exception:', err);
  }

  return item;
}

export async function markNotificationAsRead(id: string): Promise<void> {
  try {
    await supabase.from('notifications').update({ read: true, is_read: true }).eq('id', id);
  } catch (err) {
    console.error('[markNotificationAsRead] Exception:', err);
  }
}

export async function markAllNotificationsAsRead(userId?: string): Promise<void> {
  try {
    let query = supabase.from('notifications').update({ read: true, is_read: true });
    if (isValidUuid(userId)) {
      query = query.or(`user_id.eq.${userId},user_id.is.null`);
    }
    await query;
  } catch (err) {
    console.error('[markAllNotificationsAsRead] Exception:', err);
  }
}

export async function deleteNotification(id: string): Promise<void> {
  try {
    await supabase.from('notifications').delete().eq('id', id);
  } catch (err) {
    console.error('[deleteNotification] Exception:', err);
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

