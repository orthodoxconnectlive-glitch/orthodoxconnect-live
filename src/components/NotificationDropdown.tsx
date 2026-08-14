import React, { useEffect, useRef } from 'react';
import { Bell, CheckCheck, MessageSquare, AtSign, Calendar, Users, ShieldAlert, ChevronRight, X } from 'lucide-react';
import { NotificationItem } from '../types';
import { TimeAgo } from './TimeAgo';

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
      case 'message':
        return <MessageSquare className="w-4 h-4 text-amber-600" />;
      case 'mention':
        return <AtSign className="w-4 h-4 text-emerald-600" />;
      case 'event_invite':
        return <Calendar className="w-4 h-4 text-[#d4af37]" />;
      case 'group_invite':
        return <Users className="w-4 h-4 text-blue-600" />;
      case 'moderation_alert':
        return <ShieldAlert className="w-4 h-4 text-red-600" />;
      default:
        return <Bell className="w-4 h-4 text-[#8b6b4a]" />;
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
      {/* Invisible backdrop for mobile touch devices */}
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px] sm:hidden"
        onClick={onClose}
      />

      <div
        ref={dropdownRef}
        className="absolute right-0 top-12 w-80 sm:w-96 bg-[#fdfaf5] border border-[#d4af37]/30 rounded-2xl shadow-2xl z-50 overflow-hidden animate-fadeIn"
      >
        {/* Header */}
        <div className="p-4 border-b border-[#d4af37]/20 bg-[#f1ebd7] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#d4af37]" />
            <h3 className="font-serif font-bold text-sm text-[#5a4632]">Notifications</h3>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-bold">
                {unreadCount} new
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAllRead}
                className="text-[11px] font-bold text-[#8b6b4a] hover:text-[#5a4632] flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-[#d4af37]/10 transition-colors cursor-pointer"
                title="Mark all as read"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Read all</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-[#8b6b4a] hover:text-[#5a4632] rounded-lg hover:bg-[#d4af37]/10 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="max-h-80 overflow-y-auto divide-y divide-[#d4af37]/15">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#8b6b4a]">
              No notifications yet.
            </div>
          ) : (
            notifications.slice(0, 8).map((notif) => (
              <div
                key={notif.id}
                onClick={() => handleItemClick(notif)}
                className={`p-3.5 flex items-start gap-3 transition-colors cursor-pointer ${
                  notif.isRead ? 'bg-[#fdfaf5] opacity-80' : 'bg-[#f1ebd7]/50 font-medium'
                } hover:bg-[#f1ebd7]`}
              >
                <div className="w-8 h-8 rounded-full bg-[#f5f2ed] border border-[#d4af37]/30 flex items-center justify-center shrink-0 mt-0.5">
                  {getIcon(notif.type)}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-[#5a4632] truncate">{notif.title}</p>
                  <p className="text-[11px] text-[#4a3e31] leading-snug line-clamp-2 mt-0.5">
                    {notif.body}
                  </p>
                  <TimeAgo date={notif.createdAt} className="text-[9px] text-[#8b6b4a] block mt-1 uppercase font-bold" />
                </div>

                {!notif.isRead && (
                  <span className="w-2 h-2 rounded-full bg-red-500 shrink-0 mt-1.5" />
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#d4af37]/20 bg-[#f1ebd7] text-center">
          <button
            type="button"
            onClick={() => {
              onClose();
              onNavigateToNotifications('notifications');
            }}
            className="text-xs font-bold text-[#8b6b4a] hover:text-[#5a4632] flex items-center justify-center gap-1 w-full transition-colors cursor-pointer"
          >
            <span>View All Notifications</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </>
  );
};
