import React, { useState, useEffect } from 'react';
import { Bell, Heart, MessageSquare, AtSign, Calendar, Users, X, ChevronRight } from 'lucide-react';
import { NotificationItem } from '../types';

interface GlobalNotificationToastProps {
  onNavigate?: (view: string) => void;
  onOpenMessengerWithUser?: (contactId?: string) => void;
}

export const GlobalNotificationToast: React.FC<GlobalNotificationToastProps> = ({
  onNavigate,
  onOpenMessengerWithUser,
}) => {
  const [activeToast, setActiveToast] = useState<NotificationItem | null>(null);

  useEffect(() => {
    const handleNewNotif = (e: any) => {
      if (e.detail) {
        setActiveToast(e.detail);
      }
    };

    window.addEventListener('orthodox:new_notification', handleNewNotif);
    return () => {
      window.removeEventListener('orthodox:new_notification', handleNewNotif);
    };
  }, []);

  // Auto-dismiss after 5.5 seconds
  useEffect(() => {
    if (!activeToast) return;
    const timer = setTimeout(() => {
      setActiveToast(null);
    }, 5500);

    return () => clearTimeout(timer);
  }, [activeToast?.id]);

  if (!activeToast) return null;

  const handleClick = () => {
    if (activeToast.type === 'message' && onOpenMessengerWithUser) {
      onOpenMessengerWithUser(activeToast.senderName || 'user-1');
    } else if (onNavigate) {
      if (activeToast.link) {
        onNavigate(activeToast.link);
      } else if (activeToast.type === 'message') {
        onNavigate('messages');
      } else if (activeToast.type === 'event_invite') {
        onNavigate('calendar');
      } else {
        onNavigate('feed');
      }
    }
    setActiveToast(null);
  };

  const getIcon = () => {
    switch (activeToast.type) {
      case 'message':
        return <MessageSquare className="w-4 h-4 text-emerald-400" />;
      case 'mention':
        return <AtSign className="w-4 h-4 text-[#c5a059]" />;
      case 'event_invite':
        return <Calendar className="w-4 h-4 text-purple-400" />;
      case 'group_invite':
        return <Users className="w-4 h-4 text-blue-400" />;
      default:
        return <Bell className="w-4 h-4 text-[#c5a059]" />;
    }
  };

  return (
    <div className="fixed top-20 right-4 z-[90] max-w-sm w-full animate-bounce-short">
      <div
        onClick={handleClick}
        className="p-3.5 rounded-2xl bg-[#281c12]/95 dark:bg-[#1c130c]/95 border-2 border-[#c5a059] shadow-2xl backdrop-blur-md text-[#f5ebd9] flex items-start gap-3 cursor-pointer hover:bg-[#342417] transition-all group"
      >
        {/* Avatar or Icon */}
        <div className="relative shrink-0 mt-0.5">
          <img
            src={
              activeToast.senderAvatar ||
              'https://images.unsplash.com/photo-1548625361-1959779df5ff?auto=format&fit=crop&q=80&w=120'
            }
            alt={activeToast.senderName || 'Sender'}
            className="w-10 h-10 rounded-full object-cover border border-[#c5a059]/60 shadow-md"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#1c130c] border border-[#c5a059] flex items-center justify-center shadow">
            {getIcon()}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center justify-between gap-1">
            <h4 className="font-serif font-bold text-xs text-[#c5a059] truncate">
              {activeToast.title}
            </h4>
            <span className="text-[10px] text-[#eedcb5]/60 shrink-0 font-serif">Just now</span>
          </div>

          <p className="text-xs text-[#f5ebd9] line-clamp-2 mt-0.5 font-serif">
            {activeToast.body}
          </p>

          <div className="flex items-center gap-1 mt-1.5 text-[10px] text-[#c5a059] font-bold font-serif group-hover:underline">
            <span>View alert</span>
            <ChevronRight className="w-3 h-3" />
          </div>
        </div>

        {/* Dismiss Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setActiveToast(null);
          }}
          className="p-1 rounded-lg text-[#eedcb5]/60 hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
          title="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
