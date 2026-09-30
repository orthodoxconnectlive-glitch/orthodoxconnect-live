import React, { useState, useEffect } from 'react';
import { MessageSquare, ChevronRight, User } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { profilesApi } from '../lib/api';
import { isRecentlyActive, presenceLabel } from '../utils/timeAgo';
import { UserProfileData } from '../views/ProfileView';

interface ActiveChatUser {
  id: string;
  name: string;
  parish: string;
  avatar: string;
  isOnline: boolean;
  unreadCount?: number;
  lastMessage: string;
}

interface ActiveChatsPanelProps {
  onOpenMessenger: (userId?: string) => void;
  onSelectUser?: (userData: UserProfileData) => void;
}

export const ActiveChatsPanel: React.FC<ActiveChatsPanelProps> = ({ onOpenMessenger, onSelectUser }) => {
  const { t, language } = useTheme();
  const { profile: currentProfile } = useAuth();
  const [users, setUsers] = useState<ActiveChatUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchOnlineUsers() {
      try {
        const data = await profilesApi.getAll(undefined, currentProfile?.id);
        if (cancelled) return;
        const online = (data || [])
          .filter((p) => isRecentlyActive((p as any).last_seen))
          .sort((a, b) => {
            const ta = Date.parse((a as any).last_seen || '') || 0;
            const tb = Date.parse((b as any).last_seen || '') || 0;
            return tb - ta;
          })
          .slice(0, 10)
          .map((p) => ({
            id: p.id,
            name: p.full_name || (language === 'ar' ? 'عضو الرعية' : 'Parish Member'),
            parish: p.parish || (language === 'ar' ? 'كنيسة أرثوذكسية' : 'Orthodox Church'),
            avatar:
              p.avatar_url ||
              'https://orthodoxconnect.live/launchericon-512x512.png',
            isOnline: true,
            lastMessage: presenceLabel((p as any).last_seen, language),
          }));
        setUsers(online);
      } catch (err) {
        console.warn('Error fetching online users for panel:', err);
        if (!cancelled) setUsers([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchOnlineUsers();
    // Re-check every minute so the list stays honest as people come and go.
    const timer = setInterval(fetchOnlineUsers, 60000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [currentProfile?.id, language]);

  return (
    <aside className="w-full space-y-6">
      <div className="bg-(--bg-card) dark:bg-[#1c1611] border-2 border-(--ln-gold) dark:border-[#8b6b4a] rounded-3xl p-4 shadow-lg">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-(--ln-gold)/30">
          <h3 className="font-serif-coptic font-bold text-xs text-(--tx-strong) dark:text-[#f5ebd9] uppercase tracking-wider flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-(--ac-bronze-tx)" />
            <span>{t('activeChats')}</span>
          </h3>
          <span className="px-2 py-0.5 rounded-full text-[9px] font-serif font-bold uppercase tracking-wider bg-(--bg-soft) dark:bg-[#32251a] text-(--tx-strong) dark:text-[#f5ebd9] border border-(--ln-gold)">
            {t('onlineNow')}
          </span>
        </div>

        {loading ? (
          <div className="py-6 text-center text-xs text-(--tx-mute) dark:text-[#a89379] font-serif">
            {language === 'ar' ? 'جارٍ تحميل الأعضاء النشطين...' : 'Loading active members...'}
          </div>
        ) : users.length === 0 ? (
          <div className="py-6 px-3 text-center space-y-2 rounded-2xl bg-(--bg-soft)/40 dark:bg-[#282019]/40 border border-(--ln-gold)/30">
            <User className="w-6 h-6 text-(--ac-bronze-tx) mx-auto opacity-70" />
            <p className="text-xs font-serif font-bold text-(--tx-strong) dark:text-[#f5ebd9]">
              {language === 'ar' ? 'لا يوجد أعضاء متصلون حالياً' : 'No members online'}
            </p>
            <p className="text-[11px] text-(--tx-mute) dark:text-[#a89379] font-serif">
              {language === 'ar'
                ? 'قم بدعوة أصدقاء الرعية أو تحقق لاحقاً عند انضمام أعضاء آخرين!'
                : 'Invite parish friends or check back when other members join!'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {users.map((user) => (
              <div
                key={user.id}
                className="w-full flex items-center justify-between p-2.5 rounded-2xl bg-(--bg-soft)/60 dark:bg-[#282019]/60 hover:bg-(--bg-soft) dark:hover:bg-[#282019] transition-all text-left rtl:text-right group border border-(--ln-gold)/40 cursor-pointer"
              >
                <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0">
                  <div
                    className="relative shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                    title={language === 'ar' ? 'عرض الملف الشخصي' : 'View Profile'}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectUser?.({
                        id: user.id,
                        name: user.name,
                        avatar: user.avatar,
                        parish: user.parish,
                      });
                    }}
                  >
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="w-9 h-9 rounded-full object-cover border-2 border-(--ln-gold)"
                    />
                    {user.isOnline && (
                      <span className="absolute bottom-0 right-0 rtl:right-auto rtl:left-0 w-2.5 h-2.5 bg-emerald-600 rounded-full border-2 border-[#f6ebd6]" />
                    )}
                  </div>

                  <div
                    className="overflow-hidden flex-1 cursor-pointer"
                    onClick={() => onOpenMessenger(user.id)}
                  >
                    <p
                      className="text-xs font-serif-coptic font-bold text-(--tx-strong) dark:text-[#f5ebd9] uppercase tracking-wider truncate hover:underline hover:text-(--ac-bronze-tx) transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectUser?.({
                          id: user.id,
                          name: user.name,
                          avatar: user.avatar,
                          parish: user.parish,
                        });
                      }}
                    >
                      {user.name}
                    </p>
                    <p className="text-[10px] text-(--tx-mute) dark:text-[#a89379] font-serif truncate">
                      {user.lastMessage}
                    </p>
                  </div>
                </div>

                <ChevronRight className="w-3.5 h-3.5 text-(--tx-mute) group-hover:text-(--ac-bronze-tx) transition-colors shrink-0 rtl:rotate-180" />
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => onOpenMessenger()}
          className="w-full mt-4 py-2.5 rounded-2xl bg-(--bg-soft) dark:bg-[#282019] hover:bg-(--ac-gold) hover:text-white text-(--tx-strong) dark:text-[#f5ebd9] font-serif font-bold text-xs uppercase tracking-wider border border-(--ln-gold) transition-all text-center cursor-pointer shadow-sm"
        >
          {language === 'ar' ? 'عرض جميع الرسائل' : 'View All Messages'}
        </button>
      </div>
    </aside>
  );
};
