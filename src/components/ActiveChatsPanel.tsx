import React, { useState, useEffect } from 'react';
import { MessageSquare, Circle, ChevronRight, User } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
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
  const { t } = useTheme();
  const { profile: currentProfile } = useAuth();
  const [users, setUsers] = useState<ActiveChatUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRealUsers() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, username, parish, avatar_url, is_ai, email')
          .neq('id', currentProfile?.id || '')
          .order('created_at', { ascending: false })
          .limit(10);

        if (!error && data) {
          // Filter out any AI accounts
          const realProfiles = data.filter((p) => !p.is_ai);

          const mappedUsers: ActiveChatUser[] = realProfiles.map((p) => ({
            id: p.id,
            name: p.full_name || p.username || 'Parish Member',
            parish: p.parish || 'Orthodox Church',
            avatar:
              p.avatar_url ||
              'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
            isOnline: true,
            lastMessage: 'Tap to open chat',
          }));

          setUsers(mappedUsers);
        }
      } catch (err) {
        console.warn('Error fetching real active users for panel:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchRealUsers();
  }, [currentProfile?.id]);

  return (
    <aside className="w-full space-y-6">
      <div className="bg-[#f6ebd6] dark:bg-[#1c1611] border-2 border-[#c5a059] dark:border-[#8b6b4a] rounded-3xl p-4 shadow-lg">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#c5a059]/30">
          <h3 className="font-serif-coptic font-bold text-xs text-[#3d2b18] dark:text-[#f5ebd9] uppercase tracking-wider flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[#a8833c]" />
            <span>{t('activeChats')}</span>
          </h3>
          <span className="px-2 py-0.5 rounded-full text-[9px] font-serif font-bold uppercase tracking-wider bg-[#eedcb5] dark:bg-[#32251a] text-[#3d2b18] dark:text-[#f5ebd9] border border-[#c5a059]">
            {t('onlineNow')}
          </span>
        </div>

        {loading ? (
          <div className="py-6 text-center text-xs text-[#7c5f3d] dark:text-[#a89379] font-serif">
            Loading active members...
          </div>
        ) : users.length === 0 ? (
          <div className="py-6 px-3 text-center space-y-2 rounded-2xl bg-[#eedcb5]/40 dark:bg-[#282019]/40 border border-[#c5a059]/30">
            <User className="w-6 h-6 text-[#a8833c] mx-auto opacity-70" />
            <p className="text-xs font-serif font-bold text-[#3d2b18] dark:text-[#f5ebd9]">
              No members online
            </p>
            <p className="text-[11px] text-[#7c5f3d] dark:text-[#a89379] font-serif">
              Invite parish friends or check back when other members join!
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {users.map((user) => (
              <div
                key={user.id}
                className="w-full flex items-center justify-between p-2.5 rounded-2xl bg-[#eedcb5]/60 dark:bg-[#282019]/60 hover:bg-[#eedcb5] dark:hover:bg-[#282019] transition-all text-left group border border-[#c5a059]/40"
              >
                <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0">
                  <div
                    className="relative shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                    title="View Profile"
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
                      className="w-9 h-9 rounded-full object-cover border-2 border-[#c5a059]"
                    />
                    {user.isOnline && (
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-600 rounded-full border-2 border-[#f6ebd6]" />
                    )}
                  </div>

                  <div
                    className="overflow-hidden flex-1 cursor-pointer"
                    onClick={() => onOpenMessenger(user.id)}
                  >
                    <p
                      className="text-xs font-serif-coptic font-bold text-[#3d2b18] dark:text-[#f5ebd9] uppercase tracking-wider truncate hover:underline hover:text-[#a8833c] transition-colors"
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
                    <p className="text-[10px] text-[#7c5f3d] dark:text-[#a89379] font-serif truncate">
                      {user.lastMessage}
                    </p>
                  </div>
                </div>

                <ChevronRight className="w-3.5 h-3.5 text-[#7c5f3d] group-hover:text-[#a8833c] transition-colors shrink-0" />
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => onOpenMessenger()}
          className="w-full mt-4 py-2.5 rounded-2xl bg-[#eedcb5] dark:bg-[#282019] hover:bg-[#c5a059] hover:text-white text-[#3d2b18] dark:text-[#f5ebd9] font-serif font-bold text-xs uppercase tracking-wider border border-[#c5a059] transition-all text-center cursor-pointer shadow-sm"
        >
          View All Messages
        </button>
      </div>
    </aside>
  );
};

