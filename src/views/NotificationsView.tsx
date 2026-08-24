import React, { useState, useEffect } from 'react';
import { Bell, CheckCheck, Trash2, Filter, MessageSquare, AtSign, Calendar, Users, ShieldAlert, Settings, SlidersHorizontal, Sparkles, Heart, MessageCircle } from 'lucide-react';
import { NotificationItem, NotificationPreferences } from '../types';
import { loadNotifications, markNotificationAsRead, markAllNotificationsAsRead, deleteNotification, loadNotificationPreferences, saveNotificationPreferences } from '../utils/notifications';
import { TimeAgo } from '../components/TimeAgo';
import { triggerBrowserNotification, soundSynth } from '../utils/ringtone';
import { UserProfileData } from './ProfileView';

interface NotificationsViewProps {
  onNavigate?: (view: string) => void;
  onSelectUser?: (userData: UserProfileData) => void;
  onOpenMessengerWithUser?: (contactId?: string) => void;
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({ onNavigate, onSelectUser, onOpenMessengerWithUser }) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'messages' | 'events' | 'mentions'>('all');
  const [showPreferences, setShowPreferences] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPreferences>(loadNotificationPreferences());

  const fetchNotifs = async () => {
    const data = await loadNotifications();
    setNotifications(data);
  };

  useEffect(() => {
    fetchNotifs();

    const handleUpdate = () => {
      fetchNotifs();
    };

    window.addEventListener('orthodox:notifications_updated', handleUpdate);
    window.addEventListener('orthodox:new_notification', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    const pollInterval = setInterval(() => {
      fetchNotifs();
    }, 10000);

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('orthodox:notifications_updated', handleUpdate);
      window.removeEventListener('orthodox:new_notification', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const handleNotificationClick = async (notif: NotificationItem) => {
    await markNotificationAsRead(notif.id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
    );

    if (notif.type === 'message' && onOpenMessengerWithUser) {
      onOpenMessengerWithUser(notif.senderName || 'user-1');
      return;
    }

    if (onNavigate) {
      if (notif.link) {
        onNavigate(notif.link);
      } else if (notif.type === 'message') {
        onNavigate('messages');
      } else if (notif.type === 'event_invite') {
        onNavigate('calendar');
      } else if (notif.type === 'group_invite') {
        onNavigate('myNetwork');
      } else {
        onNavigate('feed');
      }
    }
  };

  const handleRead = async (id: string) => {
    await markNotificationAsRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  };

  const handleReadAll = async () => {
    await markAllNotificationsAsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const handleDelete = async (id: string) => {
    await deleteNotification(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const handleTogglePref = (key: keyof NotificationPreferences) => {
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    saveNotificationPreferences(updated);
  };

  const filteredNotifs = notifications.filter((n) => {
    if (activeTab === 'unread') return !n.isRead;
    if (activeTab === 'messages') return n.type === 'message';
    if (activeTab === 'events') return n.type === 'event_invite';
    if (activeTab === 'mentions') return n.type === 'mention';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-[#f1ebd7] via-[#fdfaf5] to-[#f1ebd7] border border-[#d4af37]/30 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#d4af37] text-white flex items-center justify-center shadow-md">
            <Bell className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-serif font-bold text-2xl text-[#5a4632]">
              Real-Time Notifications
            </h2>
            <p className="text-xs text-[#8b6b4a]">
              Direct messages, mentions, group invitations, and parish event alerts
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReadAll}
            className="px-3.5 py-2 rounded-xl bg-white border border-[#d4af37]/30 text-[#8b6b4a] hover:text-[#5a4632] font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <CheckCheck className="w-4 h-4 text-[#d4af37]" />
            <span>Mark All Read</span>
          </button>

          <button
            onClick={() => setShowPreferences(!showPreferences)}
            className="px-3.5 py-2 rounded-xl bg-[#d4af37] hover:bg-[#b89528] text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <Settings className="w-4 h-4" />
            <span>Preferences</span>
          </button>
        </div>
      </div>

      {/* Preferences Drawer / Modal Panel */}
      {showPreferences && (
        <div className="p-5 rounded-2xl bg-[#fdfaf5] border border-[#d4af37]/30 shadow-xl space-y-4 animate-fadeIn">
          <h3 className="font-serif font-bold text-base text-[#5a4632] flex items-center gap-2 pb-2 border-b border-[#d4af37]/20">
            <SlidersHorizontal className="w-4 h-4 text-[#d4af37]" />
            <span>Notification Preferences</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            {Object.entries(prefs).map(([key, val]) => (
              <label
                key={key}
                className="flex items-center justify-between p-3 rounded-xl bg-[#f5f2ed] border border-[#d4af37]/20 cursor-pointer hover:border-[#d4af37]/40"
              >
                <span className="font-semibold text-[#5a4632] capitalize">
                  {key.replace(/([A-Z])/g, ' $1')}
                </span>
                <input
                  type="checkbox"
                  checked={val}
                  onChange={() => handleTogglePref(key as keyof NotificationPreferences)}
                  className="w-4 h-4 accent-[#d4af37]"
                />
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 pb-2 border-b border-[#d4af37]/20">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'all'
              ? 'bg-[#d4af37] text-white shadow-md'
              : 'bg-[#fdfaf5] text-[#8b6b4a] hover:bg-[#f1ebd7]'
          }`}
        >
          All ({notifications.length})
        </button>

        <button
          onClick={() => setActiveTab('unread')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'unread'
              ? 'bg-[#d4af37] text-white shadow-md'
              : 'bg-[#fdfaf5] text-[#8b6b4a] hover:bg-[#f1ebd7]'
          }`}
        >
          Unread ({notifications.filter((n) => !n.isRead).length})
        </button>

        <button
          onClick={() => setActiveTab('messages')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'messages'
              ? 'bg-[#d4af37] text-white shadow-md'
              : 'bg-[#fdfaf5] text-[#8b6b4a] hover:bg-[#f1ebd7]'
          }`}
        >
          Messages
        </button>

        <button
          onClick={() => setActiveTab('events')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'events'
              ? 'bg-[#d4af37] text-white shadow-md'
              : 'bg-[#fdfaf5] text-[#8b6b4a] hover:bg-[#f1ebd7]'
          }`}
        >
          Events
        </button>

        <button
          onClick={() => setActiveTab('mentions')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'mentions'
              ? 'bg-[#d4af37] text-white shadow-md'
              : 'bg-[#fdfaf5] text-[#8b6b4a] hover:bg-[#f1ebd7]'
          }`}
        >
          Mentions
        </button>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {filteredNotifs.length === 0 ? (
          <div className="p-8 text-center bg-[#fdfaf5] rounded-2xl border border-[#d4af37]/30 text-[#8b6b4a] text-xs">
            No notifications in this category.
          </div>
        ) : (
          filteredNotifs.map((notif) => (
            <div
              key={notif.id}
              className={`p-4 rounded-2xl border shadow-md flex items-start justify-between gap-4 transition-all ${
                notif.isRead
                  ? 'bg-[#fdfaf5] border-[#d4af37]/20 opacity-80'
                  : 'bg-[#f1ebd7] border-[#d4af37] font-medium'
              }`}
            >
              <div
                className="flex items-start gap-3.5 flex-1 cursor-pointer"
                onClick={() => handleNotificationClick(notif)}
              >
                <div className="w-10 h-10 rounded-full bg-[#f5f2ed] border border-[#d4af37]/40 flex items-center justify-center shrink-0 overflow-hidden">
                  {notif.senderAvatar ? (
                    <img src={notif.senderAvatar} alt={notif.senderName || 'Avatar'} className="w-full h-full object-cover" />
                  ) : (
                    <>
                      {notif.type === 'like' && <Heart className="w-5 h-5 text-red-500 fill-red-500" />}
                      {notif.type === 'comment' && <MessageCircle className="w-5 h-5 text-[#d4af37]" />}
                      {notif.type === 'message' && <MessageSquare className="w-5 h-5 text-amber-600" />}
                      {notif.type === 'mention' && <AtSign className="w-5 h-5 text-emerald-600" />}
                      {notif.type === 'event_invite' && <Calendar className="w-5 h-5 text-[#d4af37]" />}
                      {notif.type === 'group_invite' && <Users className="w-5 h-5 text-blue-600" />}
                      {notif.type === 'moderation_alert' && <ShieldAlert className="w-5 h-5 text-red-600" />}
                      {notif.type === 'system' && <Bell className="w-5 h-5 text-[#8b6b4a]" />}
                    </>
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-serif font-bold text-sm text-[#5a4632]">
                      {notif.title}
                    </h4>
                    {!notif.isRead && (
                      <span className="w-2 h-2 rounded-full bg-red-500" />
                    )}
                  </div>
                  <p className="text-xs text-[#4a3e31] mt-0.5 leading-relaxed">
                    {notif.body}
                  </p>
                  <TimeAgo date={notif.createdAt} className="text-[10px] text-[#8b6b4a] block mt-1.5 font-bold uppercase" />
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {onOpenMessengerWithUser && (notif.senderName || notif.type === 'message') && (
                  <button
                    onClick={() => onOpenMessengerWithUser(notif.senderName || 'user-1')}
                    className="p-2 rounded-xl text-[#8b6b4a] hover:bg-[#d4af37]/20 hover:text-[#3d2b18] transition-colors cursor-pointer"
                    title="Direct 1-on-1 Chat"
                  >
                    <MessageSquare className="w-4 h-4 text-[#a8833c]" />
                  </button>
                )}

                {!notif.isRead && (
                  <button
                    onClick={() => handleRead(notif.id)}
                    className="p-2 rounded-xl text-[#8b6b4a] hover:bg-[#d4af37]/10 hover:text-[#5a4632] transition-colors cursor-pointer"
                    title="Mark as read"
                  >
                    <CheckCheck className="w-4 h-4" />
                  </button>
                )}

                <button
                  onClick={() => handleDelete(notif.id)}
                  className="p-2 rounded-xl text-[#8b6b4a] hover:bg-red-100 hover:text-red-600 transition-colors cursor-pointer"
                  title="Delete notification"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
