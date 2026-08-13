import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  Users,
  Church,
  MessageSquare,
  UserCheck,
  UserPlus,
  ArrowRight,
  Sparkles,
  Search,
  CheckCircle2,
  PlusCircle,
  Radio,
  BookOpen,
  Music,
  Heart,
  Shield,
  Volume2,
} from 'lucide-react';
import { GroupRoom } from '../types';
import { GroupRoomModal } from '../components/GroupRoomModal';
import { CreateGroupModal } from '../components/CreateGroupModal';
import { useTheme } from '../context/ThemeContext';
import { getFollowedAuthors, toggleFollow, getFollowersCount } from '../utils/follows';
import { getJoinedGroupIds, toggleGroupJoin, getCustomGroups } from '../utils/groups';
import { UserProfileData } from './ProfileView';

interface ParishMember {
  id: string;
  name: string;
  title: string;
  parish: string;
  avatar: string;
  bio: string;
  isOnline: boolean;
}

const ALL_MEMBERS_DEFAULT: ParishMember[] = [];

const ALL_GROUPS: GroupRoom[] = [
  {
    id: 'room-bible',
    name: 'Orthodox Bible Study & Scripture Commentary',
    type: 'bible_study',
    description: 'Weekly parish commentary on the Gospel of St. John with Patristic insights.',
    activeCount: 18,
    icon: '📖',
    hostName: 'Parish Clergy',
    parish: 'Holy Trinity Cathedral',
  },
  {
    id: 'room-choir',
    name: 'Divine Liturgy Choir & Hymnography Rehearsal',
    type: 'choir',
    description: 'Practicing Byzantine and Slavonic liturgical hymns for Sunday vespers.',
    activeCount: 24,
    icon: '🎶',
    hostName: 'Choir Director',
    parish: 'Holy Trinity Cathedral',
  },
  {
    id: 'room-youth',
    name: 'Orthodox Youth Fellowship & Pilgrimage Circle',
    type: 'youth',
    description: 'Monthly youth fellowship discussion on faith, careers, and spiritual life.',
    activeCount: 32,
    icon: '☦️',
    hostName: 'Youth Ministry Lead',
    parish: 'St. George Antiochian',
  },
  {
    id: 'room-women',
    name: "St. Elizabeth Women's Prayer & Intercession Circle",
    type: 'women_prayer',
    description: 'Gathering for Akathist prayers and parish charitable ministry projects.',
    activeCount: 15,
    icon: '🌹',
    hostName: "Women's Ministry Lead",
    parish: 'St. Nicholas Church',
  },
];

interface GroupRoomsViewProps {
  onSelectUser?: (userData: UserProfileData) => void;
  onOpenMessengerWithUser?: (contactId?: string) => void;
}

export const GroupRoomsView: React.FC<GroupRoomsViewProps> = ({ onSelectUser, onOpenMessengerWithUser }) => {
  const { t } = useTheme();
  const [activeTab, setActiveTab] = useState<'followed' | 'groups' | 'discover'>('followed');
  const [followedNames, setFollowedNames] = useState<string[]>([]);
  const [joinedGroupIds, setJoinedGroupIds] = useState<string[]>([]);
  const [customGroups, setCustomGroups] = useState<GroupRoom[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeRoomModal, setActiveRoomModal] = useState<GroupRoom | null>(null);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);

  const [membersList, setMembersList] = useState<ParishMember[]>([]);

  useEffect(() => {
    refreshData();
    fetchRealMembers();
  }, []);

  const fetchRealMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, parish, avatar_url, bio, email')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase fetch error:', error);
      }

      if (!error && data) {
        const real = data.filter((p) => !p.email || !p.email.endsWith('@example.com'));
        const mapped: ParishMember[] = real.map((p) => ({
          id: p.id,
          name: p.full_name || 'Parish Member',
          title: 'Parishioner',
          parish: p.parish || 'Orthodox Church',
          avatar: p.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
          bio: p.bio || 'Orthodox Christian parishioner.',
          isOnline: true,
        }));
        setMembersList(mapped);
      }
    } catch (err) {
      console.error('Supabase fetch error:', err);
    }
  };

  const refreshData = () => {
    setFollowedNames(getFollowedAuthors());
    setJoinedGroupIds(getJoinedGroupIds());
    setCustomGroups(getCustomGroups());
  };

  const handleToggleFollow = (name: string) => {
    toggleFollow(name);
    refreshData();
  };

  const handleToggleGroupJoin = (groupId: string) => {
    toggleGroupJoin(groupId);
    refreshData();
  };

  const allCombinedGroups = [...customGroups, ...ALL_GROUPS];

  // Filtered lists based on follows / groups
  const followedMembersList = membersList.filter((m) =>
    followedNames.some((fn) => fn.toLowerCase() === m.name.toLowerCase())
  );

  const nonFollowedMembersList = membersList.filter(
    (m) => !followedNames.some((fn) => fn.toLowerCase() === m.name.toLowerCase())
  );

  const joinedGroupsList = allCombinedGroups.filter((g) => joinedGroupIds.includes(g.id));
  const otherGroupsList = allCombinedGroups.filter((g) => !joinedGroupIds.includes(g.id));

  // Search filtering
  const filteredFollowed = followedMembersList.filter(
    (m) =>
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.parish.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredJoinedGroups = joinedGroupsList.filter(
    (g) =>
      g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.parish.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="relative rounded-3xl bg-[#f6ebd6] dark:bg-[#1c1611] border-2 border-[#c5a059] dark:border-[#8b6b4a] p-6 shadow-xl overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-[#c5a059]/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#3d2b18] text-[#c5a059] font-bold text-xl flex items-center justify-center border-2 border-[#c5a059] shadow-md shrink-0">
              ☨
            </div>
            <div>
              <h2 className="font-serif-coptic font-bold text-xl sm:text-2xl text-[#3d2b18] dark:text-[#f5ebd9] uppercase tracking-wider">
                {t('myNetwork')}
              </h2>
              <p className="text-xs text-[#7c5f3d] dark:text-[#a89379] font-serif mt-0.5">
                View all parishioners you follow and the Orthodox fellowship groups you belong to.
              </p>
            </div>
          </div>

          {/* Search bar inside header */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#7c5f3d] dark:text-[#a89379]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter members or groups..."
              className="w-full pl-9 pr-3 py-2 text-xs font-serif rounded-2xl bg-[#eedcb5] dark:bg-[#282019] border border-[#c5a059] text-[#3d2b18] dark:text-[#f5ebd9] placeholder-[#7c5f3d]/70 focus:outline-none"
            />
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="mt-6 pt-4 border-t border-[#c5a059]/30 flex items-center gap-2 overflow-x-auto no-scrollbar font-serif text-xs">
          <button
            onClick={() => setActiveTab('followed')}
            className={`px-4 py-2.5 rounded-2xl font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'followed'
                ? 'bg-[#3d2b18] text-[#c5a059] border-2 border-[#c5a059] shadow-md'
                : 'bg-[#eedcb5] dark:bg-[#282019] text-[#7c5f3d] dark:text-[#a89379] hover:text-[#3d2b18] border border-[#c5a059]/40'
            }`}
          >
            <Users className="w-4 h-4 text-[#c5a059]" />
            <span>{t('peopleIFollow')}</span>
            <span className="px-2 py-0.5 rounded-full bg-[#c5a059] text-[#3d2b18] text-[10px] font-bold">
              {followedMembersList.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('groups')}
            className={`px-4 py-2.5 rounded-2xl font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'groups'
                ? 'bg-[#3d2b18] text-[#c5a059] border-2 border-[#c5a059] shadow-md'
                : 'bg-[#eedcb5] dark:bg-[#282019] text-[#7c5f3d] dark:text-[#a89379] hover:text-[#3d2b18] border border-[#c5a059]/40'
            }`}
          >
            <Church className="w-4 h-4 text-[#c5a059]" />
            <span>{t('myJoinedGroups')}</span>
            <span className="px-2 py-0.5 rounded-full bg-[#c5a059] text-[#3d2b18] text-[10px] font-bold">
              {joinedGroupsList.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('discover')}
            className={`px-4 py-2.5 rounded-2xl font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'discover'
                ? 'bg-[#3d2b18] text-[#c5a059] border-2 border-[#c5a059] shadow-md'
                : 'bg-[#eedcb5] dark:bg-[#282019] text-[#7c5f3d] dark:text-[#a89379] hover:text-[#3d2b18] border border-[#c5a059]/40'
            }`}
          >
            <Sparkles className="w-4 h-4 text-[#c5a059]" />
            <span>{t('discoverCommunity')}</span>
          </button>

          <button
            onClick={() => setIsCreateGroupOpen(true)}
            className="ml-auto px-4 py-2.5 rounded-2xl bg-[#c5a059] hover:bg-[#a8833c] text-white font-bold uppercase tracking-wider flex items-center gap-2 transition-all shadow-md cursor-pointer shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{t('createCustomGroup')}</span>
          </button>
        </div>
      </div>

      {/* TAB 1: PEOPLE I FOLLOW */}
      {activeTab === 'followed' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between font-serif text-xs px-1">
            <h3 className="font-serif-coptic font-bold uppercase tracking-wider text-[#3d2b18] dark:text-[#f5ebd9] flex items-center gap-2">
              <span>Parish Members You Follow</span>
              <span className="text-[#a8833c]">({filteredFollowed.length})</span>
            </h3>
            <button
              onClick={() => setActiveTab('discover')}
              className="text-[#a8833c] hover:underline font-bold uppercase tracking-wider text-[11px] flex items-center gap-1 cursor-pointer"
            >
              <span>Discover More Members</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {filteredFollowed.length === 0 ? (
            <div className="p-8 text-center bg-[#f6ebd6] dark:bg-[#1c1611] rounded-3xl border-2 border-[#c5a059] text-[#7c5f3d] text-xs font-serif space-y-3">
              <p className="font-bold text-[#3d2b18] dark:text-[#f5ebd9]">
                You are not following any parish members yet.
              </p>
              <button
                onClick={() => setActiveTab('discover')}
                className="px-4 py-2 rounded-xl bg-[#a8833c] text-white font-bold uppercase tracking-wider cursor-pointer"
              >
                Browse & Follow Parishioners
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredFollowed.map((member) => (
                <div
                  key={member.id}
                  className="bg-[#f6ebd6] dark:bg-[#1c1611] border-2 border-[#c5a059] dark:border-[#8b6b4a] rounded-3xl p-5 shadow-lg flex flex-col justify-between space-y-4"
                >
                  <div className="flex items-start gap-3.5">
                    <div
                      className="relative shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() =>
                        onSelectUser?.({
                          id: member.id,
                          name: member.name,
                          avatar: member.avatar,
                          parish: member.parish,
                          role: member.title,
                          bio: member.bio,
                        })
                      }
                    >
                      <img
                        src={member.avatar}
                        alt={member.name}
                        className="w-14 h-14 rounded-2xl object-cover border-2 border-[#c5a059]"
                      />
                      {member.isOnline && (
                        <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-[#1c1611]" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <h4
                          className="font-serif-coptic font-bold text-sm text-[#3d2b18] dark:text-[#f5ebd9] uppercase tracking-wider truncate cursor-pointer hover:underline hover:text-[#c5a059] transition-colors"
                          onClick={() =>
                            onSelectUser?.({
                              id: member.id,
                              name: member.name,
                              avatar: member.avatar,
                              parish: member.parish,
                              role: member.title,
                              bio: member.bio,
                            })
                          }
                        >
                          {member.name}
                        </h4>
                        <span className="px-2 py-0.5 rounded-full bg-[#eedcb5] dark:bg-[#282019] text-[#3d2b18] dark:text-[#f5ebd9] text-[9px] font-serif font-bold uppercase tracking-wider border border-[#c5a059]">
                          Following
                        </span>
                      </div>

                      <p className="text-[11px] text-[#a8833c] font-serif font-bold uppercase tracking-wider mt-0.5">
                        {member.title}
                      </p>

                      <p className="text-[10px] text-[#7c5f3d] dark:text-[#a89379] font-serif flex items-center gap-1 mt-1">
                        <Church className="w-3 h-3 text-[#c5a059]" /> {member.parish}
                      </p>

                      <p className="text-xs text-[#3d2b18] dark:text-[#f5ebd9] font-serif leading-relaxed mt-2 line-clamp-2">
                        "{member.bio}"
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#c5a059]/30 flex items-center justify-between gap-2 font-serif text-xs">
                    <span className="text-[10px] text-[#7c5f3d] font-bold uppercase tracking-wider">
                      {getFollowersCount(member.name)} Followers
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleFollow(member.name)}
                        className="px-3 py-1.5 rounded-xl bg-[#eedcb5] dark:bg-[#282019] text-[#7c5f3d] dark:text-[#a89379] hover:bg-red-900/20 hover:text-red-600 border border-[#c5a059] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <UserCheck className="w-3.5 h-3.5 text-[#a8833c]" />
                        <span>Unfollow</span>
                      </button>

                      {onOpenMessengerWithUser && (
                        <button
                          onClick={() => onOpenMessengerWithUser(member.id || member.name)}
                          className="px-3 py-1.5 rounded-xl bg-[#3d2b18] dark:bg-[#282019] text-[#c5a059] hover:bg-[#a8833c] hover:text-white border border-[#c5a059] font-serif font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all shadow-sm"
                          title="Direct 1-on-1 Message"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Message</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MY JOINED GROUPS */}
      {activeTab === 'groups' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between font-serif text-xs px-1">
            <h3 className="font-serif-coptic font-bold uppercase tracking-wider text-[#3d2b18] dark:text-[#f5ebd9] flex items-center gap-2">
              <span>Fellowship Groups You Are In</span>
              <span className="text-[#a8833c]">({filteredJoinedGroups.length})</span>
            </h3>
            <button
              onClick={() => setActiveTab('discover')}
              className="text-[#a8833c] hover:underline font-bold uppercase tracking-wider text-[11px] flex items-center gap-1 cursor-pointer"
            >
              <span>Explore All Groups</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {filteredJoinedGroups.length === 0 ? (
            <div className="p-8 text-center bg-[#f6ebd6] dark:bg-[#1c1611] rounded-3xl border-2 border-[#c5a059] text-[#7c5f3d] text-xs font-serif space-y-3">
              <p className="font-bold text-[#3d2b18] dark:text-[#f5ebd9]">
                You have not joined any fellowship groups yet.
              </p>
              <button
                onClick={() => setActiveTab('discover')}
                className="px-4 py-2 rounded-xl bg-[#a8833c] text-white font-bold uppercase tracking-wider cursor-pointer"
              >
                Browse & Join Groups
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredJoinedGroups.map((group) => (
                <div
                  key={group.id}
                  className="bg-[#f6ebd6] dark:bg-[#1c1611] border-2 border-[#c5a059] dark:border-[#8b6b4a] rounded-3xl p-5 shadow-lg flex flex-col justify-between space-y-4"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-12 h-12 rounded-2xl bg-[#eedcb5] dark:bg-[#282019] border border-[#c5a059] flex items-center justify-center text-2xl shadow-sm">
                        {group.icon}
                      </div>

                      <span className="px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-500/50 text-emerald-800 dark:text-emerald-300 text-[10px] font-serif font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        {group.activeCount} Active Members
                      </span>
                    </div>

                    <h4 className="font-serif-coptic font-bold text-base text-[#3d2b18] dark:text-[#f5ebd9] uppercase tracking-wider leading-snug">
                      {group.name}
                    </h4>

                    <p className="text-xs text-[#7c5f3d] dark:text-[#a89379] font-serif leading-relaxed mt-2">
                      {group.description}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-[#c5a059]/30 flex items-center justify-between gap-2 font-serif text-xs">
                    <div>
                      <span className="text-[10px] text-[#a8833c] font-bold uppercase tracking-wider block">
                        Host: {group.hostName}
                      </span>
                      <span className="text-[9px] text-[#7c5f3d] block">{group.parish}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleGroupJoin(group.id)}
                        className="px-3 py-1.5 rounded-xl bg-[#eedcb5] dark:bg-[#282019] text-[#7c5f3d] dark:text-[#a89379] hover:bg-red-900/20 hover:text-red-600 border border-[#c5a059] font-bold uppercase tracking-wider text-[10px] cursor-pointer"
                      >
                        Leave
                      </button>

                      <button
                        onClick={() => setActiveRoomModal(group)}
                        className="px-4 py-2 rounded-xl bg-[#a8833c] hover:bg-[#8f6e30] text-white font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-md cursor-pointer text-[11px]"
                      >
                        <span>Enter Room</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: DISCOVER COMMUNITY (OTHER MEMBERS & AVAILABLE GROUPS) */}
      {activeTab === 'discover' && (
        <div className="space-y-8">
          {/* Available Groups section */}
          <div className="space-y-4">
            <h3 className="font-serif-coptic font-bold text-sm text-[#3d2b18] dark:text-[#f5ebd9] uppercase tracking-wider flex items-center gap-2">
              <Church className="w-4 h-4 text-[#c5a059]" />
              <span>Available Fellowship Groups</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ALL_GROUPS.map((group) => {
                const isJoined = joinedGroupIds.includes(group.id);
                return (
                  <div
                    key={group.id}
                    className="bg-[#f6ebd6] dark:bg-[#1c1611] border-2 border-[#c5a059] dark:border-[#8b6b4a] rounded-3xl p-5 shadow-lg flex flex-col justify-between space-y-4"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-3xl">{group.icon}</span>
                        <span className="px-3 py-1 rounded-full bg-[#eedcb5] dark:bg-[#282019] border border-[#c5a059] text-[#3d2b18] dark:text-[#f5ebd9] text-[10px] font-serif font-bold uppercase tracking-wider">
                          {group.activeCount} Members
                        </span>
                      </div>

                      <h4 className="font-serif-coptic font-bold text-base text-[#3d2b18] dark:text-[#f5ebd9] uppercase tracking-wider">
                        {group.name}
                      </h4>

                      <p className="text-xs text-[#7c5f3d] dark:text-[#a89379] font-serif leading-relaxed mt-1">
                        {group.description}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-[#c5a059]/30 flex items-center justify-between gap-2 font-serif text-xs">
                      <span className="text-[10px] text-[#a8833c] font-bold uppercase tracking-wider">
                        Host: {group.hostName}
                      </span>

                      <button
                        onClick={() => handleToggleGroupJoin(group.id)}
                        className={`px-4 py-2 rounded-xl font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-md transition-all cursor-pointer text-xs ${
                          isJoined
                            ? 'bg-[#eedcb5] dark:bg-[#282019] text-[#a8833c] border border-[#c5a059]'
                            : 'bg-[#a8833c] hover:bg-[#8f6e30] text-white'
                        }`}
                      >
                        {isJoined ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Joined</span>
                          </>
                        ) : (
                          <>
                            <PlusCircle className="w-3.5 h-3.5" />
                            <span>Join Group</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Available Members section */}
          <div className="space-y-4">
            <h3 className="font-serif-coptic font-bold text-sm text-[#3d2b18] dark:text-[#f5ebd9] uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4 text-[#c5a059]" />
              <span>Discover Parishioners To Follow</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {membersList.map((member) => {
                const isFollowed = followedNames.some(
                  (fn) => fn.toLowerCase() === member.name.toLowerCase()
                );
                return (
                  <div
                    key={member.id}
                    className="bg-[#f6ebd6] dark:bg-[#1c1611] border-2 border-[#c5a059] dark:border-[#8b6b4a] rounded-3xl p-4 shadow-lg flex items-center justify-between gap-3"
                  >
                    <div
                      className="flex items-center gap-3 min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() =>
                        onSelectUser?.({
                          id: member.id,
                          name: member.name,
                          avatar: member.avatar,
                          parish: member.parish,
                          role: member.title,
                          bio: member.bio,
                        })
                      }
                    >
                      <img
                        src={member.avatar}
                        alt={member.name}
                        className="w-12 h-12 rounded-2xl object-cover border-2 border-[#c5a059] shrink-0"
                      />
                      <div className="min-w-0">
                        <h4 className="font-serif-coptic font-bold text-xs text-[#3d2b18] dark:text-[#f5ebd9] uppercase tracking-wider truncate hover:underline hover:text-[#c5a059] transition-colors">
                          {member.name}
                        </h4>
                        <p className="text-[10px] text-[#a8833c] font-serif font-bold uppercase tracking-wider truncate">
                          {member.title}
                        </p>
                        <p className="text-[9px] text-[#7c5f3d] dark:text-[#a89379] font-serif truncate">
                          {member.parish}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleToggleFollow(member.name)}
                      className={`px-3 py-1.5 rounded-xl font-serif text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer shrink-0 ${
                        isFollowed
                          ? 'bg-[#eedcb5] dark:bg-[#282019] text-[#7c5f3d] border border-[#c5a059]'
                          : 'bg-[#a8833c] hover:bg-[#8f6e30] text-white shadow-sm'
                      }`}
                    >
                      {isFollowed ? (
                        <>
                          <UserCheck className="w-3 h-3 text-[#a8833c]" />
                          <span>Following</span>
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-3 h-3" />
                          <span>Follow</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal for Group Rooms */}
      <GroupRoomModal
        room={activeRoomModal}
        isOpen={Boolean(activeRoomModal)}
        onClose={() => setActiveRoomModal(null)}
      />

      {/* Modal for Custom Group Creation */}
      <CreateGroupModal
        isOpen={isCreateGroupOpen}
        onClose={() => setIsCreateGroupOpen(false)}
        onGroupCreated={(newGroup) => {
          refreshData();
          setActiveRoomModal(newGroup);
        }}
      />
    </div>
  );
};
