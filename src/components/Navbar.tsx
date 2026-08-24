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
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { NotificationItem } from '../types';
import { NotificationDropdown } from './NotificationDropdown';
import { loadNotifications, markNotificationAsRead, markAllNotificationsAsRead } from '../utils/notifications';
import { getTodayLiturgicalDay } from '../data/liturgical';
import { gregorianToCoptic } from '../utils/copticDate';

interface NavbarProps {
  onOpenInvite: () => void;
  onOpenEditProfile: () => void;
  onNavigate: (view: string) => void;
  currentView: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenInvite,
  onOpenEditProfile,
  onNavigate,
  currentView,
}) => {
  const { profile, signOut, openAuthModal } = useAuth();
  const { theme, setTheme, language, setLanguage, t } = useTheme();

  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const todayData = getTodayLiturgicalDay(language);
  const copticDate = gregorianToCoptic(new Date());

  const formattedCopticDate =
    language === 'ar'
      ? `${copticDate.day} ${copticDate.monthNameAr} ${copticDate.year} ش`
      : `${copticDate.day} ${copticDate.monthNameEn} ${copticDate.year} AM`;

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

    // Periodic poll every 10 seconds for real-time notification synchronization
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
    await markAllNotificationsAsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const unreadMessageCount = notifications.filter((n) => n.type === 'message' && !n.isRead).length;

  const subTabs = [
    { id: 'feed', icon: Rss, label: t('feed') },
    { id: 'videos', icon: Film, label: t('videos') },
    { id: 'myNetwork', icon: Users, label: t('myNetwork') },
    { id: 'calendar', icon: Calendar, label: t('calendar') },
  ];

  const drawerMenuItems = [
    { id: 'feed', label: t('feed'), icon: Rss, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30' },
    { id: 'videos', label: t('videos'), icon: Film, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-900/30' },
    { id: 'live', label: t('goLive'), icon: Radio, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30', isLive: true },
    { id: 'myNetwork', label: t('myNetwork'), icon: Users, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30' },
    { id: 'messages', label: t('messages'), icon: MessageSquare, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/30', count: unreadMessageCount },
    { id: 'notifications', label: t('notifications'), icon: Bell, color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-100 dark:bg-yellow-900/30', count: unreadCount },
    { id: 'calendar', label: t('calendar'), icon: Calendar, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-100 dark:bg-indigo-900/30' },
    { id: 'profile', label: t('profile'), icon: UserIcon, color: 'text-stone-700 dark:text-amber-200', bg: 'bg-stone-200 dark:bg-stone-800' },
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

  return (
    <>
      <header className="sticky top-0 z-40 bg-[#eedcb5] dark:bg-[#120e0b] border-b-2 border-[#c5a059] dark:border-[#8b6b4a] text-[#3d2b18] dark:text-[#f5ebd9] shadow-md">
        {/* Top Header Bar */}
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
          {/* Left: Hamburger Menu (Mobile/Tablet <lg:), Coptic Cross Icon, Brand Title */}
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="lg:hidden p-2 rounded-xl bg-[#e6d3ab]/80 dark:bg-[#282019] border border-[#c5a059] dark:border-[#8b6b4a] text-[#3d2b18] dark:text-[#f5ebd9] hover:bg-[#c5a059]/20 transition-all cursor-pointer shrink-0"
              title="Open Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <button
              onClick={() => onNavigate('feed')}
              className="flex items-center gap-2 cursor-pointer group min-w-0 text-left rtl:text-right"
            >
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#c5a059] dark:bg-[#d4af37] p-0.5 shadow-md flex items-center justify-center shrink-0">
                <div className="w-full h-full bg-[#3d2b18] dark:bg-[#120e0b] rounded-[10px] flex items-center justify-center text-[#c5a059] font-bold text-sm sm:text-base">
                  ☨
                </div>
              </div>
              <div className="min-w-0">
                <h1 className="font-serif-coptic font-bold text-sm sm:text-lg text-[#3d2b18] dark:text-[#f5ebd9] tracking-tight leading-none truncate">
                  {t('appName')}
                </h1>
                <p className="text-[7px] sm:text-[9px] text-[#7c5f3d] dark:text-[#a89379] tracking-[0.18em] sm:tracking-[0.2em] uppercase font-serif mt-0.5 font-semibold truncate">
                  {language === 'ar' ? 'إيمان · شركة مقدسة' : 'FAITH · FELLOWSHIP'}
                </p>
              </div>
            </button>
          </div>

          {/* Center Search Bar (Desktop lg: and up) */}
          <div className="hidden lg:flex items-center flex-1 max-w-xs mx-4">
            <div className="relative w-full">
              <Search className="w-4 h-4 absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 text-[#7c5f3d] dark:text-[#a89379]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('searchParish')}
                className="w-full pl-9 rtl:pl-3 rtl:pr-9 pr-3 py-1.5 text-[11px] font-serif uppercase tracking-wider rounded-full bg-[#f6ebd6] dark:bg-[#1c1611] border border-[#c5a059] dark:border-[#8b6b4a] text-[#3d2b18] dark:text-[#f5ebd9] placeholder-[#7c5f3d]/60 focus:outline-none focus:border-[#a8833c]"
              />
            </div>
          </div>

          {/* Right Action Circle Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Coptic Date Badge (Desktop/Tablet) */}
            <div className="hidden md:flex items-center gap-1.5 h-8 sm:h-9 px-3 rounded-full bg-[#f6ebd6] dark:bg-[#1c1611] border border-[#c5a059] dark:border-[#8b6b4a] text-[11px] font-serif font-bold text-[#3d2b18] dark:text-[#f5ebd9] shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-[#c5a059] animate-pulse" />
              <span>{formattedCopticDate}</span>
            </div>

            {/* Quick Language Switcher Button */}
            <button
              onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
              className="h-8 sm:h-9 px-2.5 rounded-full bg-[#f6ebd6] dark:bg-[#1c1611] border border-[#c5a059] dark:border-[#8b6b4a] text-[#3d2b18] dark:text-[#f5ebd9] hover:bg-[#c5a059] hover:text-white transition-all flex items-center gap-1.5 text-xs font-bold font-serif shadow-sm cursor-pointer"
              title={language === 'en' ? 'التحويل إلى اللغة العربية' : 'Switch to English'}
            >
              <Globe className="w-3.5 h-3.5 text-[#a8833c] dark:text-[#d4af37]" />
              <span>{language === 'en' ? 'عربي' : 'EN'}</span>
            </button>

            {/* Mobile Search Toggle Button (<lg:) */}
            <button
              onClick={() => setIsMobileSearchOpen(!isMobileSearchOpen)}
              className={`lg:hidden w-8 h-8 sm:w-9 sm:h-9 rounded-full border border-[#c5a059] dark:border-[#8b6b4a] flex items-center justify-center transition-all cursor-pointer shadow-sm ${
                isMobileSearchOpen
                  ? 'bg-[#c5a059] text-white'
                  : 'bg-[#f6ebd6] dark:bg-[#1c1611] text-[#3d2b18] dark:text-[#f5ebd9] hover:bg-[#c5a059] hover:text-white'
              }`}
              title="Search"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Live Broadcast button */}
            <button
              onClick={() => onNavigate('live')}
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full border border-[#c5a059] dark:border-[#8b6b4a] flex items-center justify-center transition-all cursor-pointer relative shadow-sm ${
                currentView === 'live'
                  ? 'bg-[#c5a059] text-white'
                  : 'bg-[#f6ebd6] dark:bg-[#1c1611] text-[#3d2b18] dark:text-[#f5ebd9] hover:bg-[#c5a059] hover:text-white'
              }`}
              title={t('goLive')}
            >
              <Radio className="w-4 h-4 text-red-600 dark:text-red-400" />
              <span className="absolute top-0 right-0 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 ring-2 ring-[#eedcb5] dark:ring-[#120e0b]"></span>
              </span>
            </button>

            {/* Messenger button */}
            <button
              onClick={() => onNavigate('messages')}
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full border border-[#c5a059] dark:border-[#8b6b4a] flex items-center justify-center transition-all cursor-pointer relative shadow-sm ${
                currentView === 'messages'
                  ? 'bg-[#c5a059] text-white'
                  : 'bg-[#f6ebd6] dark:bg-[#1c1611] text-[#3d2b18] dark:text-[#f5ebd9] hover:bg-[#c5a059] hover:text-white'
              }`}
              title={t('messages')}
            >
              <MessageSquare className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              {unreadMessageCount > 0 && (
                <span className="absolute -top-1 -right-1 px-1 min-w-[16px] h-4 rounded-full bg-emerald-600 text-white text-[9px] font-bold flex items-center justify-center shadow-sm ring-2 ring-[#eedcb5] dark:ring-[#120e0b]">
                  {unreadMessageCount}
                </span>
              )}
            </button>

            {/* Notifications Bell button */}
            <div className="relative">
              <button
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full border border-[#c5a059] dark:border-[#8b6b4a] flex items-center justify-center transition-all cursor-pointer relative shadow-sm ${
                  isNotifOpen || currentView === 'notifications'
                    ? 'bg-[#c5a059] text-white'
                    : 'bg-[#f6ebd6] dark:bg-[#1c1611] text-[#3d2b18] dark:text-[#f5ebd9] hover:bg-[#c5a059] hover:text-white'
                }`}
                title={t('notifications')}
              >
                <Bell className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-600 text-white text-[9px] font-bold flex items-center justify-center shadow-md animate-pulse ring-2 ring-[#eedcb5] dark:ring-[#120e0b]">
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
                onNavigateToNotifications={(link) => onNavigate(link || 'notifications')}
              />
            </div>
          </div>
        </div>

        {/* Mobile Search Dropdown Panel (<lg:) */}
        {isMobileSearchOpen && (
          <div className="lg:hidden px-4 py-2 bg-[#f6ebd6] dark:bg-[#1c1611] border-t border-[#c5a059]/40">
            <div className="relative w-full">
              <Search className="w-4 h-4 absolute left-3.5 rtl:left-auto rtl:right-3.5 top-1/2 -translate-y-1/2 text-[#7c5f3d] dark:text-[#a89379]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('searchParish')}
                autoFocus
                className="w-full pl-10 rtl:pl-4 rtl:pr-10 pr-4 py-2 text-xs font-serif uppercase tracking-wider rounded-full bg-[#eddcb9] dark:bg-[#282019] border border-[#c5a059] dark:border-[#8b6b4a] text-[#3d2b18] dark:text-[#f5ebd9] placeholder-[#7c5f3d]/60 focus:outline-none focus:border-[#a8833c]"
              />
            </div>
          </div>
        )}

        {/* Sub-Navigation Tab Bar */}
        <div className="border-t border-[#c5a059]/40 bg-[#f3e3be]/90 dark:bg-[#18120e]/90 px-4">
          <div className="max-w-2xl mx-auto flex items-center justify-around h-11">
            {subTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = currentView === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onNavigate(tab.id)}
                  className={`relative h-full px-4 flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                    isActive
                      ? 'text-[#a8833c] dark:text-[#d4af37] font-bold'
                      : 'text-[#7c5f3d] dark:text-[#a89379] hover:text-[#3d2b18]'
                  }`}
                  title={tab.label}
                >
                  <Icon className="w-5 h-5" />
                  {isActive && (
                    <span className="absolute bottom-0 inset-x-0 h-1 bg-[#a8833c] dark:bg-[#d4af37] rounded-t-md shadow-sm" />
                  )}
                </button>
              );
            })}

            {/* Coptic Cross Icon Badge in Sub-Bar */}
            <button
              onClick={() => onNavigate('myNetwork')}
              className={`relative h-full px-3 flex items-center justify-center text-[#7c5f3d] dark:text-[#a89379] hover:text-[#3d2b18] ${
                currentView === 'myNetwork' ? 'text-[#a8833c]' : ''
              }`}
              title={language === 'ar' ? 'غرف الرعايا القبطية' : 'Coptic Parish Rooms'}
            >
              <div className="w-6 h-6 rounded-full bg-[#3d2b18] text-[#c5a059] flex items-center justify-center font-bold text-xs shadow-sm">
                ☨
              </div>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile / Side Menu Drawer */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            onClick={() => setIsDrawerOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
          />

          {/* Drawer Panel */}
          <div className="relative w-80 max-w-[85vw] bg-[#eddcb9] dark:bg-[#18120e] h-full shadow-2xl p-4 sm:p-5 flex flex-col justify-between overflow-y-auto border-r-2 rtl:border-r-0 rtl:border-l-2 border-[#c5a059] dark:border-[#8b6b4a] z-50">
            <div className="space-y-4">
              {/* Top Branding & Close Button */}
              <div className="flex items-center justify-between pb-3 border-b border-[#c5a059]/40">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#c5a059] dark:bg-[#d4af37] p-0.5 shadow-md flex items-center justify-center shrink-0">
                    <div className="w-full h-full bg-[#3d2b18] dark:bg-[#120e0b] rounded-[10px] flex items-center justify-center text-[#c5a059] font-bold text-base">
                      ☨
                    </div>
                  </div>
                  <div>
                    <h2 className="font-serif-coptic font-bold text-base text-[#3d2b18] dark:text-[#f5ebd9]">
                      {t('appName')}
                    </h2>
                    <p className="text-[8px] text-[#7c5f3d] dark:text-[#a89379] tracking-[0.2em] font-serif uppercase">
                      {language === 'ar' ? 'إيمان · شركة مقدسة' : 'FAITH · FELLOWSHIP'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="w-8 h-8 rounded-xl bg-[#f6ebd6] dark:bg-[#282019] border border-[#c5a059] text-[#3d2b18] dark:text-[#f5ebd9] flex items-center justify-center hover:bg-[#c5a059] hover:text-white transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* User Profile Header Card */}
              {profile ? (
                <button
                  onClick={() => {
                    onNavigate('profile');
                    setIsDrawerOpen(false);
                  }}
                  className="w-full flex items-center gap-3 p-2.5 rounded-2xl bg-[#f6ebd6] dark:bg-[#282019] hover:bg-[#e6d3ab] transition-all text-left rtl:text-right group cursor-pointer border-2 border-[#c5a059] dark:border-[#8b6b4a] shadow-md"
                >
                  <img
                    src={profile.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200'}
                    alt={profile.full_name}
                    className="w-10 h-10 rounded-full object-cover border-2 border-[#c5a059] shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-serif-coptic font-bold text-xs text-[#3d2b18] dark:text-[#f5ebd9] uppercase tracking-wider truncate group-hover:text-[#a8833c] transition-colors">
                      {profile.full_name}
                    </h3>
                    <p className="text-[10px] text-[#7c5f3d] dark:text-[#a89379] font-serif uppercase tracking-wider truncate">
                      {profile.parish || (language === 'ar' ? 'كنيسة مارمرقس' : 'ST. MARK')}
                    </p>
                  </div>
                  {profile.role && (
                    <span className="px-2 py-0.5 rounded-full bg-[#e6d3ab] dark:bg-[#382b20] border border-[#c5a059] text-[9px] font-serif font-bold text-[#a8833c] uppercase shrink-0">
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
                  className="w-full py-2.5 rounded-2xl bg-[#c5a059] text-white font-serif font-bold text-xs tracking-wider uppercase shadow-md cursor-pointer"
                >
                  {t('signInRegister')}
                </button>
              )}

              {/* Start Prayer Meeting Callout Box */}
              <button
                onClick={() => {
                  onNavigate('live');
                  setIsDrawerOpen(false);
                }}
                className="w-full p-3 rounded-2xl bg-[#f6ebd6] dark:bg-[#241c15] border-2 border-[#c5a059] dark:border-[#8b6b4a] shadow-md flex items-center gap-3 text-left rtl:text-right group cursor-pointer hover:border-[#a8833c] transition-all"
              >
                <div className="w-9 h-9 rounded-xl bg-[#e6d3ab] dark:bg-[#32251a] flex items-center justify-center text-[#a8833c] shrink-0 border border-[#c5a059]/50">
                  <Video className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-serif-coptic font-bold text-xs text-[#3d2b18] dark:text-[#f5ebd9] tracking-wide">
                    {language === 'ar' ? 'بدء اجتماع صلاة مباشر' : 'START PRAYER MEETING'}
                  </h3>
                  <p className="text-[9px] text-[#7c5f3d] dark:text-[#a89379] tracking-wider uppercase font-serif">
                    {language === 'ar' ? 'الصلاة معاً عبر الفيديو' : 'PRAY TOGETHER OVER VIDEO'}
                  </p>
                </div>
              </button>

              {/* Drawer Menu Navigation Items */}
              <nav className="space-y-1.5 pt-1">
                {drawerMenuItems.map((item: any) => {
                  const Icon = item.icon;
                  const isActive = currentView === item.id;
                  if (item.isAdmin && !isAdminOrOwner) return null;

                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onNavigate(item.id);
                        setIsDrawerOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl font-serif text-xs uppercase tracking-wider transition-all cursor-pointer ${
                        isActive
                          ? 'bg-[#c5a059] text-white shadow-md font-bold'
                          : 'text-[#3d2b18] dark:text-[#f5ebd9] hover:bg-[#f6ebd6]/80'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-1.5 rounded-xl ${isActive ? 'bg-white/20 text-white' : `${item.bg} ${item.color}`}`}>
                          <Icon className="w-4 h-4" />
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
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#eedcb5] dark:bg-[#32251a] text-[#3d2b18] dark:text-[#f5ebd9] border border-[#c5a059]">
                            {item.count}
                          </span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}

                {/* Invite Friends Button */}
                <button
                  onClick={() => {
                    onOpenInvite();
                    setIsDrawerOpen(false);
                  }}
                  className="w-full p-3 rounded-2xl bg-[#f6ebd6] dark:bg-[#282019] border border-[#c5a059] dark:border-[#8b6b4a] hover:border-[#a8833c] transition-all text-left rtl:text-right group cursor-pointer shadow-sm mt-2"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <QrCode className="w-4 h-4 text-[#a8833c] group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-serif font-bold uppercase tracking-wider text-[#3d2b18] dark:text-[#f5ebd9]">
                      {t('inviteFriends')}
                    </span>
                  </div>
                  <p className="text-[10px] text-[#7c5f3d] dark:text-[#a89379] leading-tight font-serif uppercase">
                    {t('referralSub')}
                  </p>
                </button>
              </nav>

              {/* Liturgical Widget in Drawer */}
              <div className="bg-[#f6ebd6] dark:bg-[#1c1611] border-2 border-[#c5a059] dark:border-[#8b6b4a] rounded-3xl p-3.5 shadow-lg text-xs space-y-2.5">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#eedcb5] dark:bg-[#282019] border border-[#c5a059] text-[#3d2b18] dark:text-[#f5ebd9] font-serif font-bold text-[9px] uppercase tracking-wider">
                  <Sparkles className="w-3 h-3 text-[#a8833c]" />
                  <span>{formattedCopticDate}</span>
                </div>

                <div className="block p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-400 text-emerald-900 dark:text-emerald-200 font-serif font-bold text-[10px] uppercase tracking-wider text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Utensils className="w-3 h-3 text-emerald-700 dark:text-emerald-400 shrink-0" />
                    <span>{todayData.fastingInfo}</span>
                  </div>
                </div>

                <div>
                  <h4 className="font-serif-coptic font-bold text-xs text-[#3d2b18] dark:text-[#f5ebd9] uppercase tracking-wider">
                    ⛪ {todayData.saintName}
                  </h4>
                  <p className="text-[10px] text-[#7c5f3d] dark:text-[#a89379] italic font-serif">
                    {todayData.saintTitle}
                  </p>
                </div>

                <div className="p-2.5 rounded-xl bg-[#eedcb5]/80 dark:bg-[#282019]/80 border border-[#c5a059] space-y-1">
                  <div className="flex items-center gap-1.5 text-[#a8833c] font-bold text-[10px] uppercase tracking-wider">
                    <BookOpen className="w-3 h-3" />
                    <span>{t('dailyScripture')}</span>
                  </div>
                  <p className="text-[10px] text-[#3d2b18] dark:text-[#f5ebd9] italic font-serif leading-relaxed">
                    "{todayData.scriptureText}"
                  </p>
                  <span className="text-[9px] text-[#7c5f3d] dark:text-[#a89379] font-serif font-bold uppercase block text-right rtl:text-left">
                    — {todayData.scriptureRef}
                  </span>
                </div>
              </div>

              {/* Language & Theme Controls */}
              <div className="bg-[#f6ebd6] dark:bg-[#1c1611] border-2 border-[#c5a059] dark:border-[#8b6b4a] rounded-3xl p-3 shadow-lg space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1">
                    <Globe className="w-4 h-4 text-[#a8833c]" />
                    <span className="font-serif text-[10px] font-bold uppercase tracking-wider text-[#3d2b18] dark:text-[#f5ebd9]">
                      {language === 'ar' ? 'اللغة' : 'LANGUAGE'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setLanguage('en')}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-lg transition-colors cursor-pointer ${
                        language === 'en' ? 'bg-[#c5a059] text-white' : 'text-[#7c5f3d]'
                      }`}
                    >
                      EN
                    </button>
                    <button
                      onClick={() => setLanguage('ar')}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-lg transition-colors cursor-pointer ${
                        language === 'ar' ? 'bg-[#c5a059] text-white' : 'text-[#7c5f3d]'
                      }`}
                    >
                      عربي
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#c5a059]/30">
                  <span className="font-serif text-[10px] font-bold uppercase tracking-wider text-[#3d2b18] dark:text-[#f5ebd9]">
                    {language === 'ar' ? 'المظهر' : 'THEME'}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setTheme('ancient')}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                        theme === 'ancient' ? 'bg-[#c5a059] text-white' : 'text-[#7c5f3d]'
                      }`}
                      title={t('ancientGold')}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setTheme('dark')}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                        theme === 'dark' ? 'bg-[#c5a059] text-white' : 'text-[#7c5f3d]'
                      }`}
                      title={t('dark')}
                    >
                      <Moon className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setTheme('light')}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                        theme === 'light' ? 'bg-[#c5a059] text-white' : 'text-[#7c5f3d]'
                      }`}
                      title={t('light')}
                    >
                      <Sun className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Logout Button if signed in */}
            {profile && (
              <div className="pt-3 border-t border-[#c5a059]/40 flex items-center justify-between">
                <span className="text-[10px] font-serif text-[#7c5f3d] dark:text-[#a89379] uppercase">
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
