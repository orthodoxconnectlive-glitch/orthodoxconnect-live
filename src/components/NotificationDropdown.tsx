import React, { useEffect, useRef } from 'react';
import { Bell, CheckCheck, MessageSquare, AtSign, Calendar, Users, ShieldAlert, ChevronRight, X, Heart, MessageCircle } from 'lucide-react';
import { NotificationItem } from '../types';
import { TimeAgo } from './TimeAgo';
import { useTheme } from '../context/ThemeContext';

interface NotificationDropdownProps {
  notifications: NotificationItem[];
  isOpen: boolean;
  onClose: () => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onNavigateToNotifications: (link?: string) => void;
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({
  notifications,
  isOpen,
  onClose,
  onMarkRead,
  onMarkAllRead,
  onNavigateToNotifications,
}) => {
  const { t, language } = useTheme();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const getIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'like':
        return <Heart className="w-4 h-4 text-red-500 fill-red-500" />;
      case 'comment':
        return <MessageCircle className="w-4 h-4 text-[#c5a059]" />;
      case 'message':
        return <MessageSquare className="w-4 h-4 text-emerald-600" />;
      case 'mention':
        return <AtSign className="w-4 h-4 text-blue-600" />;
      case 'event_invite':
        return <Calendar className="w-4 h-4 text-[#c5a059]" />;
      case 'group_invite':
        return <Users className="w-4 h-4 text-amber-600" />;
      case 'moderation_alert':
        return <ShieldAlert className="w-4 h-4 text-red-600" />;
      default:
        return <Bell className="w-4 h-4 text-[#a8833c]" />;
    }
  };

  const handleItemClick = (notif: NotificationItem) => {
    onMarkRead(notif.id);
    onClose();
    if (notif.link) {
      onNavigateToNotifications(notif.link);
    } else if (notif.type === 'message') {
      onNavigateToNotifications('messages');
    } else if (notif.type === 'event_invite') {
      onNavigateToNotifications('calendar');
    } else if (notif.type === 'group_invite') {
      onNavigateToNotifications('myNetwork');
    } else {
      onNavigateToNotifications('notifications');
    }
  };

  return (
    <>
      {/* Invisible backdrop for outside click handling */}
      <div
        className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[0.5px]"
        onClick={onClose}
      />

      <div
        ref={dropdownRef}
        className="absolute right-0 rtl:right-auto rtl:left-0 top-12 w-80 sm:w-96 bg-[#fbf6ec] dark:bg-[#1a140e] border border-[#c5a059]/40 dark:border-[#8b6b4a]/60 rounded-2xl shadow-2xl z-50 overflow-hidden animate-fadeIn text-left rtl:text-right"
      >
        {/* Header */}
        <div className="p-4 border-b border-[#c5a059]/20 dark:border-[#8b6b4a]/30 bg-[#eddcb9]/60 dark:bg-[#282019] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#a8833c] dark:text-[#c5a059]" />
            <h3 className="font-serif font-bold text-sm text-[#3d2b18] dark:text-[#f5ebd9]">
              {t('notifications')}
            </h3>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-bold">
                {unreadCount} {language === 'ar' ? 'جديد' : 'new'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkAllRead();
                }}
                className="text-[11px] font-bold text-[#7c5f3d] dark:text-[#c5a059] hover:text-[#3d2b18] flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-[#c5a059]/10 transition-colors cursor-pointer"
                title={language === 'ar' ? 'تحديد الكل كمقروء' : 'Mark all as read'}
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>{language === 'ar' ? 'قراءة الكل' : 'Read all'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="p-1 text-[#7c5f3d] dark:text-[#c5a059] hover:text-[#3d2b18] rounded-lg hover:bg-[#c5a059]/10 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="max-h-80 overflow-y-auto divide-y divide-[#c5a059]/15 dark:divide-[#8b6b4a]/20">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#7c5f3d] dark:text-[#a89379] font-serif">
              {language === 'ar' ? 'لا توجد إشعارات حالياً.' : 'No notifications yet.'}
            </div>
          ) : (
            notifications.slice(0, 10).map((notif) => (
              <div
                key={notif.id}
                onClick={() => handleItemClick(notif)}
                className={`p-3.5 flex items-start gap-3 transition-colors cursor-pointer ${
                  notif.isRead
                    ? 'bg-[#fbf6ec] dark:bg-[#1a140e] opacity-75'
                    : 'bg-[#eddcb9]/40 dark:bg-[#282019]/60 font-medium'
                } hover:bg-[#eddcb9]/70 dark:hover:bg-[#282019]`}
              >
                <div className="w-8 h-8 rounded-full bg-[#f4e8cf] dark:bg-[#342a20] border border-[#c5a059]/40 flex items-center justify-center shrink-0 mt-0.5">
                  {notif.senderAvatar ? (
                    <img
                      src={notif.senderAvatar}
                      alt={notif.senderName || 'Avatar'}
                      className="w-full h-full object-cover rounded-full"
                    />
                  ) : (
                    getIcon(notif.type)
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-[#3d2b18] dark:text-[#f5ebd9] truncate">{notif.title}</p>
                  <p className="text-[11px] text-[#554029] dark:text-[#d3c2a9] leading-snug line-clamp-2 mt-0.5">
                    {notif.body}
                  </p>
                  <TimeAgo date={notif.createdAt} className="text-[9px] text-[#7c5f3d] dark:text-[#a89379] block mt-1 uppercase font-bold" />
                </div>

                {!notif.isRead && (
                  <span className="w-2 h-2 rounded-full bg-red-500 shrink-0 mt-1.5" />
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#c5a059]/20 dark:border-[#8b6b4a]/30 bg-[#eddcb9]/60 dark:bg-[#282019] text-center">
          <button
            type="button"
            onClick={() => {
              onClose();
              onNavigateToNotifications('notifications');
            }}
            className="text-xs font-bold text-[#7c5f3d] dark:text-[#c5a059] hover:text-[#3d2b18] dark:hover:text-[#f5ebd9] flex items-center justify-center gap-1 w-full transition-colors cursor-pointer"
          >
            <span>{language === 'ar' ? 'عرض جميع الإشعارات' : 'View All Notifications'}</span>
            <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
          </button>
        </div>
      </div>
    </>
  );
};
