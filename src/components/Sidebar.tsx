import React, { useState, useEffect } from 'react';
import {
  Rss,
  Film,
  Radio,
  Users,
  MessageSquare,
  Calendar as CalendarIcon,
  User,
  ShieldAlert,
  QrCode,
  Sparkles,
  Bell,
  Sun,
  Moon,
  Globe,
  PlusCircle,
  Utensils,
  BookOpen,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getTodayLiturgicalDay } from '../data/liturgical';
import { loadNotifications } from '../utils/notifications';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  onOpenInvite: () => void;
  unreadMessagesCount?: number;
  unreadNotificationsCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  onOpenInvite,
  unreadMessagesCount,
  unreadNotificationsCount,
}) => {
  const { profile } = useAuth();
  const { theme, setTheme, language, setLanguage, t } = useTheme();
  const [realUnreadNotifs, setRealUnreadNotifs] = useState(0);
  const [realUnreadMsgs, setRealUnreadMsgs] = useState(0);

  useEffect(() => {
    async function updateCounts() {
      if (profile?.id) {
        const notifs = await loadNotifications(profile.id);
        const unreadN = notifs.filter((n) => !n.isRead).length;
        const unreadM = notifs.filter((n) => n.type === 'message' && !n.isRead).length;
        setRealUnreadNotifs(unreadN);
        setRealUnreadMsgs(unreadM);
      }
    }
    updateCounts();
  }, [profile?.id]);

  const activeUnreadNotifs = unreadNotificationsCount ?? realUnreadNotifs;
  const activeUnreadMsgs = unreadMessagesCount ?? realUnreadMsgs;

  const todayData = getTodayLiturgicalDay(language);

  const isSuperAdmin = profile?.role === 'super_admin' || profile?.email === 'orthodoxconnect.live@gmail.com';
  const isAdminOrOwner = isSuperAdmin || profile?.role === 'admin' || profile?.role === 'owner';

  const navItems = [
    { id: 'feed', label: t('feed'), icon: Rss, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30' },
    { id: 'reels', label: t('reels'), icon: Film, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-900/30', badge: 'NEW' },
    { id: 'live', label: t('goLive'), icon: Radio, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30', isLive: true },
    { id: 'myNetwork', label: t('myNetwork'), icon: Users, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30' },
    { id: 'messages', label: t('messages'), icon: MessageSquare, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/30', count: activeUnreadMsgs },
    { id: 'notifications', label: t('notifications'), icon: Bell, color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-100 dark:bg-yellow-900/30', count: activeUnreadNotifs },
    { id: 'calendar', label: t('calendar'), icon: CalendarIcon, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-100 dark:bg-indigo-900/30' },
    { id: 'profile', label: t('profile'), icon: User, color: 'text-stone-700 dark:text-amber-200', bg: 'bg-stone-200 dark:bg-stone-800' },
  ];

  if (isAdminOrOwner) {
    navItems.push({
      id: 'admin',
      label: t('adminPanel'),
      icon: ShieldAlert,
      color: 'text-red-700 dark:text-red-300',
      bg: 'bg-red-200 dark:bg-red-950/60',
    });
  }

  return (
    <aside className="w-full space-y-4">
      {/* Facebook-style Left Navigation Sidebar Card */}
      <div className="bg-[#f6ebd6] dark:bg-[#1c1611] border-2 border-[#c5a059] dark:border-[#8b6b4a] rounded-3xl p-3.5 shadow-lg">
        {/* Top Controls: Language Selector & Dark/Light Theme Toggle */}
        <div className="flex items-center justify-between p-2 mb-3 rounded-2xl bg-[#eedcb5] dark:bg-[#282019] border border-[#c5a059] dark:border-[#8b6b4a] shadow-sm text-xs">
          <div className="flex items-center gap-1">
            <Globe className="w-3.5 h-3.5 text-[#a8833c] mr-1 shrink-0" />
            <button
              onClick={() => setLanguage('en')}
              className={`px-2 py-0.5 text-[10px] font-bold rounded-xl transition-all cursor-pointer ${
                language === 'en' ? 'bg-[#c5a059] text-white shadow-sm' : 'text-[#7c5f3d] dark:text-[#a89379] hover:text-[#3d2b18]'
              }`}
            >
              EN
            </button>
            <button
              onClick={() => setLanguage('ar')}
              className={`px-2 py-0.5 text-[10px] font-bold rounded-xl transition-all cursor-pointer ${
                language === 'ar' ? 'bg-[#c5a059] text-white shadow-sm' : 'text-[#7c5f3d] dark:text-[#a89379] hover:text-[#3d2b18]'
              }`}
            >
              عربي
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setTheme('ancient')}
              className={`p-1 rounded-xl transition-all cursor-pointer ${
                theme === 'ancient' ? 'bg-[#c5a059] text-white shadow-sm' : 'text-[#7c5f3d] dark:text-[#a89379] hover:text-[#3d2b18]'
              }`}
              title={t('ancientGold')}
            >
              <Sparkles className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setTheme('dark')}
              className={`p-1 rounded-xl transition-all cursor-pointer ${
                theme === 'dark' ? 'bg-[#c5a059] text-white shadow-sm' : 'text-[#7c5f3d] dark:text-[#a89379] hover:text-[#3d2b18]'
              }`}
              title={t('dark')}
            >
              <Moon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setTheme('light')}
              className={`p-1 rounded-xl transition-all cursor-pointer ${
                theme === 'light' ? 'bg-[#c5a059] text-white shadow-sm' : 'text-[#7c5f3d] dark:text-[#a89379] hover:text-[#3d2b18]'
              }`}
              title={t('light')}
            >
              <Sun className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* User Profile Header Card */}
        {profile && (
          <button
            onClick={() => onNavigate('profile')}
            className="w-full flex items-center gap-3 p-2.5 rounded-2xl bg-[#eedcb5] dark:bg-[#282019] hover:bg-[#e6d3ab] transition-all text-left mb-3 group cursor-pointer border-2 border-[#c5a059] dark:border-[#8b6b4a] shadow-md"
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
                {profile.parish || 'ORTHODOX CHURCH'}
              </p>
            </div>
            {profile.role && (
              <span className="px-2 py-0.5 rounded-full bg-[#e6d3ab] dark:bg-[#382b20] border border-[#c5a059] text-[9px] font-serif font-bold text-[#a8833c] uppercase shrink-0">
                {profile.role.toUpperCase()}
              </span>
            )}
          </button>
        )}

        {/* Navigation Shortcuts List */}
        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl font-serif text-xs uppercase tracking-wider transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#c5a059] text-white shadow-md font-bold'
                    : 'text-[#3d2b18] dark:text-[#f5ebd9] hover:bg-[#eedcb5]/80 dark:hover:bg-[#282019]'
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

                  {item.badge && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#3d2b18] text-[#c5a059] shadow-sm">
                      {item.badge}
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
        </nav>

        {/* Invite Friends Referral Card */}
        <div className="mt-4 pt-3 border-t border-[#c5a059]/30">
          <button
            onClick={onOpenInvite}
            className="w-full p-3 rounded-2xl bg-[#eedcb5] dark:bg-[#282019] border border-[#c5a059] dark:border-[#8b6b4a] hover:border-[#a8833c] transition-all text-left group cursor-pointer shadow-sm"
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
        </div>
      </div>

      {/* Liturgical Daily Calendar & Fasting Widget (Sidebar Only) */}
      <div className="bg-[#f6ebd6] dark:bg-[#1c1611] border-2 border-[#c5a059] dark:border-[#8b6b4a] rounded-3xl p-4 shadow-lg text-xs space-y-3">
        {/* Date & Fasting Badges */}
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#eedcb5] dark:bg-[#282019] border border-[#c5a059] text-[#3d2b18] dark:text-[#f5ebd9] font-serif font-bold text-[9px] uppercase tracking-wider">
            <Sparkles className="w-3 h-3 text-[#a8833c]" />
            {todayData.date}
          </div>

          <div className="block p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-400 text-emerald-900 dark:text-emerald-200 font-serif font-bold text-[10px] uppercase tracking-wider text-center">
            <div className="flex items-center justify-center gap-1">
              <Utensils className="w-3 h-3 text-emerald-700 dark:text-emerald-400 shrink-0" />
              <span>{todayData.fastingInfo}</span>
            </div>
          </div>
        </div>

        {/* Saint of the Day */}
        <div>
          <h4 className="font-serif-coptic font-bold text-xs text-[#3d2b18] dark:text-[#f5ebd9] uppercase tracking-wider">
            ⛪ {todayData.saintName}
          </h4>
          <p className="text-[10px] text-[#7c5f3d] dark:text-[#a89379] italic font-serif">
            {todayData.saintTitle}
          </p>
        </div>

        {/* Daily Scripture Quote */}
        <div className="p-2.5 rounded-xl bg-[#eedcb5]/80 dark:bg-[#282019]/80 border border-[#c5a059] space-y-1">
          <div className="flex items-center gap-1.5 text-[#a8833c] font-bold text-[10px] uppercase tracking-wider">
            <BookOpen className="w-3 h-3" />
            <span>{t('dailyScripture')}</span>
          </div>
          <p className="text-[11px] text-[#3d2b18] dark:text-[#f5ebd9] italic font-serif leading-relaxed">
            "{todayData.scriptureText}"
          </p>
          <span className="text-[9px] text-[#7c5f3d] dark:text-[#a89379] font-serif font-bold uppercase block text-right">
            — {todayData.scriptureRef}
          </span>
        </div>

        {/* Calendar Button */}
        <button
          onClick={() => onNavigate('calendar')}
          className="w-full py-2.5 rounded-xl bg-[#a8833c] hover:bg-[#8f6e30] text-white font-serif font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
        >
          <CalendarIcon className="w-3.5 h-3.5" />
          <span>{t('calendar')}</span>
        </button>
      </div>
    </aside>
  );
};

