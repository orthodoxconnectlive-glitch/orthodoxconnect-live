import React, { useState, useEffect } from 'react';
import {
  Search,
  MessageSquare,
  Menu,
  X,
  Bell,
  Rss,
  Film,
  Users,
  Calendar,
  ShieldAlert,
  Video,
  User as UserIcon,
  Globe,
  Sparkles,
  QrCode,
  LogOut,
  Radio,
  Sun,
  Moon,
  Utensils,
  BookOpen,
  Church,
  Store,
  Baby,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { NotificationItem } from '../types';
import { NotificationDropdown } from './NotificationDropdown';
import { GlobalSearchBox } from './GlobalSearch';
import type { SearchProfile } from './GlobalSearch';
import type { UserProfileData } from '../views/ProfileView';
import { loadNotifications, markNotificationAsRead, markAllNotificationsAsRead, markNotificationIdsAsRead } from '../utils/notifications';
import { getTodayLiturgicalDay } from '../data/liturgical';

interface NavbarProps {
  onOpenInvite: () => void;
  onOpenEditProfile: () => void;
  onNavigate: (view: string, postId?: string) => void;
  currentView: string;
  onSelectUser?: (user: UserProfileData) => void;
  onOpenChurch?: (churchId: string) => void;
}

// "K" kids tab icon: a friendly Baby glyph with a gold K badge.
const KidsTabIcon: React.FC<{ className?: string }> = ({ className }) => (
  <span className={`relative inline-flex items-center justify-center ${className ?? ''}`}>
    <Baby className="w-full h-full" />
    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-(--ac-gold) text-white text-[9px] font-black flex items-center justify-center ring-2 ring-[#f3e3be] dark:ring-[#18120e] leading-none">
      K
    </span>
  </span>
);

export const Navbar: React.FC<NavbarProps> = ({
  onOpenInvite,
  onOpenEditProfile,
  onNavigate,
  currentView,
  onSelectUser,
  onOpenChurch,
}) => {
  const { profile, signOut, openAuthModal } = useAuth();
  const { theme, setTheme, language, setLanguage, t } = useTheme();

  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const todayData = getTodayLiturgicalDay(language);

  const fetchNotifs = async () => {
    const data = await loadNotifications(profile?.id);
    setNotifications(data);
  };

  useEffect(() => {
    fetchNotifs();

    const handleLocalUpdate = () => {
      fetchNotifs();
    };

    window.addEventListener('orthodox:notifications_updated', handleLocalUpdate);
    window.addEventListener('orthodox:new_notification', handleLocalUpdate);
    window.addEventListener('storage', handleLocalUpdate);

    const pollInterval = setInterval(() => {
      fetchNotifs();
    }, 10000);

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('orthodox:notifications_updated', handleLocalUpdate);
      window.removeEventListener('orthodox:new_notification', handleLocalUpdate);
      window.removeEventListener('storage', handleLocalUpdate);
    };
  }, [profile?.id]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleMarkRead = async (id: string) => {
    await markNotificationAsRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  };

  const handleMarkAllRead = async () => {
    // Mark all as read: update UI immediately, then persist locally and on server.
    // Use a functional update so it works even if the notifications state is stale.
    setNotifications((prev) => {
      const ids = prev.map((n) => n.id).filter(Boolean);
      try {
        if (ids.length > 0) markNotificationIdsAsRead(ids);
      } catch (e) {}
      // Also mark every ID we know about from localStorage
      try {
        const local = JSON.parse(localStorage.getItem('oc_notifications') || '[]');
        const localIds = local.map((n: any) => n.id).filter(Boolean);
        if (localIds.length > 0) markNotificationIdsAsRead(localIds);
      } catch (e) {}
      return prev.map((n) => ({ ...n, isRead: true }));
    });
    try {
      await markAllNotificationsAsRead(profile?.id);
    } catch (e) {}
    // Force a refresh so the badge count updates
    try {
      window.dispatchEvent(new Event('orthodox:notifications_updated'));
    } catch (e) {}
  };

  const unreadMessageCount = notifications.filter((n) => n.type === 'message' && !n.isRead).length;

  const subTabs = [
    { id: 'feed', icon: Rss, label: t('feed') },
    { id: 'videos', icon: Film, label: t('videos') },
    { id: 'library', icon: BookOpen, label: language === 'ar' ? 'المكتبة' : 'Library' },
    { id: 'myNetwork', icon: Users, label: t('myNetwork') },
    { id: 'calendar', icon: Calendar, label: t('calendar') },
    { id: 'kids', icon: KidsTabIcon, label: language === 'ar' ? 'أطفال' : 'Kids' },
    { id: 'marketplace', icon: Store, label: language === 'ar' ? 'السوق' : 'Marketplace' },
  ];

  // Sidebar only holds what ISN'T already on the main bars (tab row + top
  // icon row), so no button ever appears twice.
  const drawerMenuItems = [
    { id: 'live', label: t('goLive'), icon: Radio, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30', isLive: true },
    { id: 'candle', label: language === 'ar' ? 'أضئ شمعة' : 'Light a Candle', emoji: '🕯', color: 'text-amber-600 dark:text-amber-300', bg: 'bg-amber-100 dark:bg-amber-900/30', isCandle: true },
    { id: 'profile', label: t('profile'), icon: UserIcon, color: 'text-stone-700 dark:text-amber-200', bg: 'bg-stone-200 dark:bg-stone-800' },
    { id: 'churches', label: language === 'ar' ? 'الكنائس' : 'Churches', icon: Church, color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-100 dark:bg-amber-900/30' },
  ];

  const isSuperAdmin = profile?.role === 'super_admin' || profile?.email === 'orthodoxconnect.live@gmail.com';
  const isAdminOrOwner = isSuperAdmin || profile?.role === 'admin' || profile?.role === 'owner';

  if (isAdminOrOwner) {
    drawerMenuItems.push({
      id: 'admin',
      label: t('adminPanel'),
      icon: ShieldAlert,
      color: 'text-red-700 dark:text-red-300',
      bg: 'bg-red-200 dark:bg-red-950/60',
      isAdmin: true,
    } as any);
  }

  const handlePickPerson = (p: SearchProfile) => {
    onSelectUser?.({
      id: p.id,
      name: p.full_name,
      avatar: p.avatar_url,
      parish: p.parish,
      role: p.role,
      bio: p.bio,
    });
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-(--bg-soft) dark:bg-[#120e0b] border-b-2 border-(--ln-gold) dark:border-[#8b6b4a] text-(--tx-strong) dark:text-[#f5ebd9] shadow-md">
        <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
          {/* Left: Brand & Menu */}
          <div className="flex items-center gap-2 shrink min-w-0">
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="lg:hidden w-11 h-11 rounded-full bg-(--bg-deep)/80 dark:bg-[#282019] border border-(--ln-gold) dark:border-[#8b6b4a] text-(--tx-strong) dark:text-[#f5ebd9] hover:bg-(--ac-gold)/20 transition-all cursor-pointer shrink-0 flex items-center justify-center"
              title="Open Navigation Menu"
            >
              <Menu className="w-6 h-6" />
            </button>

            <div className="flex items-center gap-2 min-w-0">
              {/* User avatar -> profile */}
              <button
                onClick={() => onNavigate('profile')}
                className="w-11 h-11 rounded-full bg-(--ac-gold) dark:bg-(--ac-bright) p-0.5 shadow-md flex items-center justify-center shrink-0 cursor-pointer"
                title={t('profile')}
              >
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.full_name || 'Profile'}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-(--chip-dark) dark:bg-[#120e0b] rounded-full flex items-center justify-center text-(--ac-gold-tx) font-bold text-base">
                    ☨
                  </div>
                )}
              </button>
              <button
                onClick={() => onNavigate('feed')}
                className="min-w-0 text-left rtl:text-right cursor-pointer"
              >
                <h1 className="font-serif-coptic font-bold text-xs sm:lg text-(--tx-strong) dark:text-[#f5ebd9] tracking-tight leading-none truncate">
                  {t('appName')}
                </h1>
                <p className="text-[7px] sm:text-[9px] text-(--tx-mute) dark:text-[#a89379] tracking-[0.15em] sm:tracking-[0.2em] uppercase font-serif mt-0.5 font-semibold truncate">
                  {language === 'ar' ? 'إيمان · شركة مقدسة' : 'FAITH · FELLOWSHIP'}
                </p>
              </button>
            </div>
          </div>

          {/* Desktop Search Bar */}
          <div className="hidden lg:flex items-center flex-1 max-w-xs mx-4">
            <GlobalSearchBox
              panelPosition="absolute"
              onSelectPerson={handlePickPerson}
              onSelectPost={(p) => onNavigate('feed', p.id)}
              onSelectChurch={(c) => onOpenChurch?.(c.id)}
            />
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {/* Coptic Date Badge */}
            <div className="hidden md:flex items-center gap-1.5 h-8 sm:h-9 px-3 rounded-full bg-(--bg-card) dark:bg-[#1c1611] border border-(--ln-gold) dark:border-[#8b6b4a] text-[11px] font-serif font-bold text-(--tx-strong) dark:text-[#f5ebd9] shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-(--ac-gold) animate-pulse" />
              <span>{todayData.date}</span>
            </div>

            {/* Language Switcher */}
            <button
              onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
              className="h-11 px-3.5 rounded-full bg-(--bg-card) dark:bg-[#1c1611] border border-(--ln-gold) dark:border-[#8b6b4a] text-(--tx-strong) dark:text-[#f5ebd9] hover:bg-(--ac-gold) hover:text-white transition-all flex items-center gap-1.5 text-sm font-bold font-serif shadow-sm cursor-pointer shrink-0"
              title={language === 'en' ? 'التحويل إلى اللغة العربية' : 'Switch to English'}
            >
              <Globe className="w-4 h-4 text-(--ac-bronze-tx) dark:text-(--ac-bright-tx)" />
              <span>{language === 'en' ? 'عربي' : 'EN'}</span>
            </button>

            {/* Mobile Search Toggle */}
            <button
              onClick={() => setIsMobileSearchOpen(!isMobileSearchOpen)}
              className={`lg:hidden w-11 h-11 rounded-full border border-(--ln-gold) dark:border-[#8b6b4a] flex items-center justify-center transition-all cursor-pointer shadow-sm shrink-0 ${
                isMobileSearchOpen
                  ? 'bg-(--ac-gold) text-white'
                  : 'bg-(--bg-card) dark:bg-[#1c1611] text-(--tx-strong) dark:text-[#f5ebd9] hover:bg-(--ac-gold) hover:text-white'
              }`}
              title="Search"
            >
              <Search className="w-6 h-6" />
            </button>

            {/* Messages Button */}
            <button
              onClick={() => onNavigate('messages')}
              className={`w-11 h-11 rounded-full border border-(--ln-gold) dark:border-[#8b6b4a] flex items-center justify-center transition-all cursor-pointer relative shadow-sm shrink-0 ${
                currentView === 'messages'
                  ? 'bg-(--ac-gold) text-white'
                  : 'bg-(--bg-card) dark:bg-[#1c1611] text-(--tx-strong) dark:text-[#f5ebd9] hover:bg-(--ac-gold) hover:text-white'
              }`}
              title={t('messages')}
            >
              <MessageSquare className="w-6 h-6 text-emerald-700 dark:text-emerald-400" />
              {unreadMessageCount > 0 && (
                <span className="absolute -top-1 -right-1 px-1 min-w-[16px] h-4 rounded-full bg-emerald-600 text-white text-[9px] font-bold flex items-center justify-center shadow-sm ring-2 ring-(--bg-soft) dark:ring-[#120e0b]">
                  {unreadMessageCount}
                </span>
              )}
            </button>

            {/* Notifications Bell */}
            <div className="relative shrink-0">
              <button
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                className={`w-11 h-11 rounded-full border border-(--ln-gold) dark:border-[#8b6b4a] flex items-center justify-center transition-all cursor-pointer relative shadow-sm ${
                  isNotifOpen || currentView === 'notifications'
                    ? 'bg-(--ac-gold) text-white'
                    : 'bg-(--bg-card) dark:bg-[#1c1611] text-(--tx-strong) dark:text-[#f5ebd9] hover:bg-(--ac-gold) hover:text-white'
                }`}
                title={t('notifications')}
              >
                <Bell className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-600 text-white text-[9px] font-bold flex items-center justify-center shadow-md animate-pulse ring-2 ring-(--bg-soft) dark:ring-[#120e0b]">
                    {unreadCount}
                  </span>
                )}
              </button>

              <NotificationDropdown
                notifications={notifications}
                isOpen={isNotifOpen}
                onClose={() => setIsNotifOpen(false)}
                onMarkRead={handleMarkRead}
                onMarkAllRead={handleMarkAllRead}
                onNavigateToNotifications={(link, postId) => onNavigate(link || 'notifications', postId)}
              />
            </div>
          </div>
        </div>

        {/* Mobile Search Dropdown Panel */}
        {isMobileSearchOpen && (
          <div className="lg:hidden px-4 py-2 bg-(--bg-card) dark:bg-[#1c1611] border-t border-(--ln-gold)/40">
            <GlobalSearchBox
              autoFocus
              panelPosition="static"
              inputClassName="w-full pl-10 rtl:pl-4 rtl:pr-10 pr-4 py-2 text-xs font-serif uppercase tracking-wider rounded-full bg-(--bg-page) dark:bg-[#282019] border border-(--ln-gold) dark:border-[#8b6b4a] text-(--tx-strong) dark:text-[#f5ebd9] placeholder-(--tx-mute)/60 focus:outline-none focus:border-(--ln-bronze)"
              onSelectPerson={handlePickPerson}
              onSelectPost={(p) => onNavigate('feed', p.id)}
              onSelectChurch={(c) => onOpenChurch?.(c.id)}
              onNavigateAway={() => setIsMobileSearchOpen(false)}
            />
          </div>
        )}

        {/* Sub-Navigation Tabs (all screens — desktop included) */}
        <div className="border-t border-(--ln-gold)/40 bg-[#f3e3be]/90 dark:bg-[#18120e]/90 px-4">
          <div className="max-w-2xl mx-auto flex items-center justify-around h-13">
            {subTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = currentView === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onNavigate(tab.id)}
                  className={`relative h-full px-2 sm:px-5 flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                    isActive
                      ? 'text-(--ac-bronze-tx) dark:text-(--ac-bright-tx) font-bold'
                      : 'text-(--tx-mute) dark:text-[#a89379] hover:text-(--tx-strong)'
                  }`}
                  title={tab.label}
                >
                  <Icon className="w-6 h-6 sm:w-7 sm:h-7" />
                  {isActive && (
                    <span className="absolute bottom-0 inset-x-0 h-1 bg-(--ac-bronze) dark:bg-(--ac-bright) rounded-t-md shadow-sm" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Slide-out Navigation Drawer */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div
            onClick={() => setIsDrawerOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
          />

          <div className="relative w-80 max-w-[85vw] bg-(--bg-page) dark:bg-[#18120e] h-full shadow-2xl p-4 sm:p-5 flex flex-col justify-between overflow-y-auto border-r-2 rtl:border-r-0 rtl:border-l-2 border-(--ln-gold) dark:border-[#8b6b4a] z-50">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-(--ln-gold)/40">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-(--ac-gold) dark:bg-(--ac-bright) p-0.5 shadow-md flex items-center justify-center shrink-0">
                    <div className="w-full h-full bg-(--chip-dark) dark:bg-[#120e0b] rounded-[10px] flex items-center justify-center text-(--ac-gold-tx) font-bold text-base">
                      ☨
                    </div>
                  </div>
                  <div>
                    <h2 className="font-serif-coptic font-bold text-base text-(--tx-strong) dark:text-[#f5ebd9]">
                      {t('appName')}
                    </h2>
                    <p className="text-[8px] text-(--tx-mute) dark:text-[#a89379] tracking-[0.2em] font-serif uppercase">
                      {language === 'ar' ? 'إيمان · شركة مقدسة' : 'FAITH · FELLOWSHIP'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="w-8 h-8 rounded-xl bg-(--bg-card) dark:bg-[#282019] border border-(--ln-gold) text-(--tx-strong) dark:text-[#f5ebd9] flex items-center justify-center hover:bg-(--ac-gold) hover:text-white transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {profile ? (
                <button
                  onClick={() => {
                    onNavigate('profile');
                    setIsDrawerOpen(false);
                  }}
                  className="w-full flex items-center gap-3 p-2.5 rounded-2xl bg-(--bg-card) dark:bg-[#282019] hover:bg-(--bg-deep) transition-all text-left rtl:text-right group cursor-pointer border-2 border-(--ln-gold) dark:border-[#8b6b4a] shadow-md"
                >
                  <img
                    src={profile.avatar_url || 'https://orthodoxconnect.live/launchericon-512x512.png'}
                    alt={profile.full_name}
                    className="w-10 h-10 rounded-full object-cover border-2 border-(--ln-gold) shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-serif-coptic font-bold text-xs text-(--tx-strong) dark:text-[#f5ebd9] uppercase tracking-wider truncate group-hover:text-(--ac-bronze-tx) transition-colors">
                      {profile.full_name}
                    </h3>
                    <p className="text-[10px] text-(--tx-mute) dark:text-[#a89379] font-serif uppercase tracking-wider truncate">
                      {profile.parish || (language === 'ar' ? 'كنيسة مارمرقس' : 'ST. MARK')}
                    </p>
                  </div>
                  {profile.role && (
                    <span className="px-2 py-0.5 rounded-full bg-(--bg-deep) dark:bg-[#382b20] border border-(--ln-gold) text-[9px] font-serif font-bold text-(--ac-bronze-tx) uppercase shrink-0">
                      {profile.role.toUpperCase()}
                    </span>
                  )}
                </button>
              ) : (
                <button
                  onClick={() => {
                    openAuthModal();
                    setIsDrawerOpen(false);
                  }}
                  className="w-full py-2.5 rounded-2xl bg-(--ac-gold) text-white font-serif font-bold text-xs tracking-wider uppercase shadow-md cursor-pointer"
                >
                  {t('signInRegister')}
                </button>
              )}

              <button
                onClick={() => {
                  onNavigate('live');
                  setIsDrawerOpen(false);
                }}
                className="w-full p-3 rounded-2xl bg-(--bg-card) dark:bg-[#241c15] border-2 border-(--ln-gold) dark:border-[#8b6b4a] shadow-md flex items-center gap-3 text-left rtl:text-right group cursor-pointer hover:border-(--ln-bronze) transition-all"
              >
                <div className="w-9 h-9 rounded-xl bg-(--bg-deep) dark:bg-[#32251a] flex items-center justify-center text-(--ac-bronze-tx) shrink-0 border border-(--ln-gold)/50">
                  <Video className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-serif-coptic font-bold text-xs text-(--tx-strong) dark:text-[#f5ebd9] tracking-wide">
                    {language === 'ar' ? 'بدء اجتماع صلاة مباشر' : 'START PRAYER MEETING'}
                  </h3>
                  <p className="text-[9px] text-(--tx-mute) dark:text-[#a89379] tracking-wider uppercase font-serif">
                    {language === 'ar' ? 'الصلاة معاً عبر الفيديو' : 'PRAY TOGETHER OVER VIDEO'}
                  </p>
                </div>
              </button>

              <nav className="space-y-1.5 pt-1">
                {drawerMenuItems.map((item: any) => {
                  const Icon = item.icon;
                  const isActive = currentView === item.id;
                  if (item.isAdmin && !isAdminOrOwner) return null;

                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        if (item.isCandle) {
                          window.dispatchEvent(new CustomEvent('oc:open-candle'));
                        } else {
                          onNavigate(item.id);
                        }
                        setIsDrawerOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl font-serif text-xs uppercase tracking-wider transition-all cursor-pointer ${
                        isActive
                          ? 'bg-(--ac-gold) text-white shadow-md font-bold'
                          : 'text-(--tx-strong) dark:text-[#f5ebd9] hover:bg-(--bg-card)/80'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-1.5 rounded-xl ${isActive ? 'bg-white/20 text-white' : `${item.bg} ${item.color}`}`}>
                          {item.emoji ? (
                            <span className="text-lg leading-none">{item.emoji}</span>
                          ) : (
                            <Icon className="w-4 h-4" />
                          )}
                        </div>
                        <span className="font-semibold">{item.label}</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {item.isLive && (
                          <span className="flex h-2 w-2 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                          </span>
                        )}

                        {item.count ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-(--bg-soft) dark:bg-[#32251a] text-(--tx-strong) dark:text-[#f5ebd9] border border-(--ln-gold)">
                            {item.count}
                          </span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}

                <button
                  onClick={() => {
                    onOpenInvite();
                    setIsDrawerOpen(false);
                  }}
                  className="w-full p-3 rounded-2xl bg-(--bg-card) dark:bg-[#282019] border border-(--ln-gold) dark:border-[#8b6b4a] hover:border-(--ln-bronze) transition-all text-left rtl:text-right group cursor-pointer shadow-sm mt-2"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <QrCode className="w-4 h-4 text-(--ac-bronze-tx) group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-serif font-bold uppercase tracking-wider text-(--tx-strong) dark:text-[#f5ebd9]">
                      {t('inviteFriends')}
                    </span>
                  </div>
                  <p className="text-[10px] text-(--tx-mute) dark:text-[#a89379] leading-tight font-serif uppercase">
                    {t('referralSub')}
                  </p>
                </button>
              </nav>

              <div className="bg-(--bg-card) dark:bg-[#1c1611] border-2 border-(--ln-gold) dark:border-[#8b6b4a] rounded-3xl p-3.5 shadow-lg text-xs space-y-2.5">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-(--bg-soft) dark:bg-[#282019] border border-(--ln-gold) text-(--tx-strong) dark:text-[#f5ebd9] font-serif font-bold text-[9px] uppercase tracking-wider">
                  <Sparkles className="w-3 h-3 text-(--ac-bronze-tx)" />
                  <span>{todayData.date}</span>
                </div>

                <div className="block p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-400 text-emerald-900 dark:text-emerald-200 font-serif font-bold text-[10px] uppercase tracking-wider text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Utensils className="w-3 h-3 text-emerald-700 dark:text-emerald-400 shrink-0" />
                    <span>{todayData.fastingInfo}</span>
                  </div>
                </div>

                <div>
                  <h4 className="font-serif-coptic font-bold text-xs text-(--tx-strong) dark:text-[#f5ebd9] uppercase tracking-wider">
                    ⛪ {todayData.saintName}
                  </h4>
                  <p className="text-[10px] text-(--tx-mute) dark:text-[#a89379] italic font-serif">
                    {todayData.saintTitle}
                  </p>
                </div>

                <div className="p-2.5 rounded-xl bg-(--bg-soft)/80 dark:bg-[#282019]/80 border border-(--ln-gold) space-y-1">
                  <div className="flex items-center gap-1.5 text-(--ac-bronze-tx) font-bold text-[10px] uppercase tracking-wider">
                    <BookOpen className="w-3 h-3" />
                    <span>{t('dailyScripture')}</span>
                  </div>
                  <p className="text-[10px] text-(--tx-strong) dark:text-[#f5ebd9] italic font-serif leading-relaxed">
                    "{todayData.scriptureText}"
                  </p>
                  <span className="text-[9px] text-(--tx-mute) dark:text-[#a89379] font-serif font-bold uppercase block text-right rtl:text-left">
                    — {todayData.scriptureRef}
                  </span>
                </div>
              </div>

              <div className="bg-(--bg-card) dark:bg-[#1c1611] border-2 border-(--ln-gold) dark:border-[#8b6b4a] rounded-3xl p-3 shadow-lg space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1">
                    <Globe className="w-4 h-4 text-(--ac-bronze-tx)" />
                    <span className="font-serif text-[10px] font-bold uppercase tracking-wider text-(--tx-strong) dark:text-[#f5ebd9]">
                      {language === 'ar' ? 'اللغة' : 'LANGUAGE'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setLanguage('en')}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-lg transition-colors cursor-pointer ${
                        language === 'en' ? 'bg-(--ac-gold) text-white' : 'text-(--tx-mute)'
                      }`}
                    >
                      EN
                    </button>
                    <button
                      onClick={() => setLanguage('ar')}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-lg transition-colors cursor-pointer ${
                        language === 'ar' ? 'bg-(--ac-gold) text-white' : 'text-(--tx-mute)'
                      }`}
                    >
                      عربي
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-(--ln-gold)/30">
                  <span className="font-serif text-[10px] font-bold uppercase tracking-wider text-(--tx-strong) dark:text-[#f5ebd9]">
                    {language === 'ar' ? 'المظهر' : 'THEME'}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setTheme('ancient')}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                        theme === 'ancient' ? 'bg-(--ac-gold) text-white' : 'text-(--tx-mute)'
                      }`}
                      title={t('ancientGold')}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setTheme('dark')}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                        theme === 'dark' ? 'bg-(--ac-gold) text-white' : 'text-(--tx-mute)'
                      }`}
                      title={t('dark')}
                    >
                      <Moon className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setTheme('light')}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                        theme === 'light' ? 'bg-(--ac-gold) text-white' : 'text-(--tx-mute)'
                      }`}
                      title={t('light')}
                    >
                      <Sun className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {profile && (
              <div className="pt-3 border-t border-(--ln-gold)/40 flex items-center justify-between">
                <span className="text-[10px] font-serif text-(--tx-mute) dark:text-[#a89379] uppercase">
                  {language === 'ar' ? `تسجيل الدخول باسم ${profile.full_name}` : `Logged in as ${profile.full_name}`}
                </span>
                <button
                  onClick={() => {
                    signOut();
                    setIsDrawerOpen(false);
                  }}
                  className="p-1.5 rounded-lg text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950 transition-colors flex items-center gap-1 text-xs font-serif font-bold cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{t('signOut')}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
