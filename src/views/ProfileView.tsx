import React, { useState, useEffect } from 'react';
import { Church, Edit, UserPlus, UserCheck, MessageSquare, ArrowLeft, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Post } from '../types';
import { loadPostsByAuthor } from '../utils/posts';
import { getFollowersCount, getFollowingCount, isFollowing, toggleFollow } from '../utils/follows';

export interface UserProfileData {
  id?: string;
  name: string;
  avatar?: string;
  parish?: string;
  role?: string;
  bio?: string;
}

interface ProfileViewProps {
  onOpenEditProfile: () => void;
  viewedUser?: UserProfileData | null;
  onBack?: () => void;
  onOpenMessengerWithUser?: (contactId?: string) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  onOpenEditProfile,
  viewedUser,
  onBack,
  onOpenMessengerWithUser,
}) => {
  const { profile, signOut } = useAuth();
  const { t } = useTheme();

  const isSelf =
    !viewedUser ||
    !viewedUser.name ||
    (profile?.full_name && profile.full_name.toLowerCase() === viewedUser.name.toLowerCase());

  const targetName = isSelf ? profile?.full_name || 'My Profile' : viewedUser!.name;
  const targetAvatar = isSelf
    ? profile?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200'
    : viewedUser?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200';
  const targetRole = isSelf ? profile?.role || 'Parish Member' : viewedUser?.role || 'Orthodox Member';
  const targetParish = isSelf ? profile?.parish || 'St. George Parish' : viewedUser?.parish || 'Holy Trinity Cathedral';
  const targetBio = isSelf
    ? profile?.bio || 'Orthodox Christian seeking fellowship and spiritual growth.'
    : viewedUser?.bio || 'Orthodox Christian seeking fellowship, prayer, and spiritual growth in our holy faith.';

  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [followingState, setFollowingState] = useState<boolean>(false);

  useEffect(() => {
    fetchUserPosts();
    if (!isSelf) {
      setFollowingState(isFollowing(targetName));
    }
  }, [targetName, isSelf]);

  const fetchUserPosts = async () => {
    setLoading(true);
    const posts = await loadPostsByAuthor(viewedUser?.id || targetName);
    setUserPosts(posts);
    setLoading(false);
  };

  const handleToggleFollowUser = () => {
    const isNow = toggleFollow(targetName);
    setFollowingState(isNow);
  };

  const followersCount = getFollowersCount(targetName);
  const followingCount = isSelf ? getFollowingCount() : Math.floor(followersCount * 0.4);

  return (
    <div className="space-y-6">
      {/* Top Header Navigation if viewing another user */}
      {!isSelf && (
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="px-4 py-2 rounded-2xl bg-[#eedcb5] dark:bg-[#282019] text-[#3d2b18] dark:text-[#f5ebd9] border border-[#c5a059] font-serif font-bold text-xs uppercase tracking-wider flex items-center gap-2 hover:bg-[#c5a059]/20 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-[#c5a059]" />
            <span>Back</span>
          </button>
        </div>
      )}

      {/* Profile Header Banner */}
      <div className="relative rounded-3xl bg-[#f6ebd6] dark:bg-[#1c1611] border-2 border-[#c5a059] dark:border-[#8b6b4a] p-6 shadow-2xl overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#c5a059]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="relative">
              <img
                src={targetAvatar}
                alt={targetName}
                className="w-20 h-20 rounded-3xl object-cover border-2 border-[#c5a059] shadow-xl"
              />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#3d2b18] text-[#c5a059] flex items-center justify-center font-bold text-xs border border-[#c5a059]">
                ☨
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-serif-coptic font-bold text-xl md:text-2xl text-[#3d2b18] dark:text-[#f5ebd9] uppercase tracking-wider">
                  {targetName}
                </h2>
                <span className="px-3 py-0.5 rounded-full bg-[#eedcb5] dark:bg-[#282019] text-[#3d2b18] dark:text-[#f5ebd9] border border-[#c5a059] text-[10px] font-serif font-bold uppercase tracking-wider">
                  {targetRole}
                </span>
              </div>

              <p className="text-xs text-[#a8833c] font-serif font-semibold flex items-center gap-1.5 mt-1 uppercase tracking-wider">
                <Church className="w-3.5 h-3.5" /> {targetParish}
              </p>

              <p className="text-xs text-[#3d2b18] dark:text-[#f5ebd9] mt-2 max-w-lg font-serif leading-relaxed">
                {targetBio}
              </p>

              {/* Stats Bar */}
              <div className="flex items-center gap-6 mt-4 pt-3 border-t border-[#c5a059]/30 text-xs font-serif font-bold uppercase tracking-wider text-[#3d2b18] dark:text-[#f5ebd9]">
                <div>
                  <span className="text-[#a8833c] font-serif-coptic text-sm mr-1">{userPosts.length}</span>
                  <span className="text-[10px] text-[#7c5f3d] dark:text-[#a89379]">Posts</span>
                </div>
                <div>
                  <span className="text-[#a8833c] font-serif-coptic text-sm mr-1">{followersCount}</span>
                  <span className="text-[10px] text-[#7c5f3d] dark:text-[#a89379]">Followers</span>
                </div>
                <div>
                  <span className="text-[#a8833c] font-serif-coptic text-sm mr-1">{followingCount}</span>
                  <span className="text-[10px] text-[#7c5f3d] dark:text-[#a89379]">Following</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          {isSelf ? (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={onOpenEditProfile}
                className="px-4 py-2.5 rounded-2xl bg-[#a8833c] hover:bg-[#8f6e30] text-white font-serif font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-lg transition-all cursor-pointer"
              >
                <Edit className="w-4 h-4" />
                <span>{t('editProfile')}</span>
              </button>
              <button
                onClick={signOut}
                className="px-4 py-2.5 rounded-2xl bg-red-900/20 hover:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-500/30 font-serif font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-lg transition-all cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={handleToggleFollowUser}
                className={`px-5 py-2.5 rounded-2xl font-serif font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg transition-all cursor-pointer ${
                  followingState
                    ? 'bg-[#eedcb5] dark:bg-[#282019] text-[#7c5f3d] dark:text-[#f5ebd9] border-2 border-[#c5a059]'
                    : 'bg-[#c5a059] hover:bg-[#a8833c] text-white'
                }`}
              >
                {followingState ? (
                  <>
                    <UserCheck className="w-4 h-4 text-[#c5a059]" />
                    <span>{t('following')}</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>{t('follow')}</span>
                  </>
                )}
              </button>

              {onOpenMessengerWithUser && (
                <button
                  onClick={() => onOpenMessengerWithUser(viewedUser?.id || targetName)}
                  className="px-5 py-2.5 rounded-2xl bg-[#3d2b18] dark:bg-[#2a2018] hover:bg-[#a8833c] text-[#c5a059] hover:text-white border border-[#c5a059] font-serif font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg transition-all cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Message</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* User's Posts Section */}
      <div className="space-y-4">
        <h3 className="font-serif font-bold text-lg text-[#3d2b18] dark:text-amber-100 pb-2 border-b border-[#c5a059]/30">
          {isSelf ? 'Your Reflections & Posts' : `${targetName}'s Reflections & Posts`} ({userPosts.length})
        </h3>

        {loading ? (
          <p className="text-xs text-[#a8833c] text-center py-6">Loading reflections...</p>
        ) : userPosts.length === 0 ? (
          <div className="p-8 text-center bg-[#f6ebd6] dark:bg-[#1c1611] rounded-3xl border-2 border-[#c5a059] text-[#7c5f3d] dark:text-[#a89379] text-xs font-serif">
            {isSelf
              ? "You haven't posted any reflections yet. Share something with your parish!"
              : `${targetName} has not shared any reflections on the parish feed yet.`}
          </div>
        ) : (
          userPosts.map((post) => (
            <div
              key={post.id}
              className="p-5 rounded-3xl bg-[#f6ebd6] dark:bg-[#1c1611] border-2 border-[#c5a059] dark:border-[#8b6b4a] space-y-3 shadow-lg"
            >
              <div className="flex items-center gap-3">
                <img
                  src={post.authorAvatar || targetAvatar}
                  alt={post.authorName}
                  className="w-9 h-9 rounded-full object-cover border-2 border-[#c5a059]"
                />
                <div>
                  <span className="text-xs font-serif font-bold text-[#3d2b18] dark:text-[#f5ebd9] block">
                    {post.authorName}
                  </span>
                  <span className="text-[10px] font-serif text-[#a8833c] block">
                    {new Date(post.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {post.text && (
                <p className="text-xs text-[#3d2b18] dark:text-[#f5ebd9] font-serif leading-relaxed">
                  {post.text}
                </p>
              )}

              {post.image && (
                <img
                  src={post.image}
                  alt="Post content"
                  className="rounded-2xl max-h-72 w-full object-cover mt-2 border border-[#c5a059]"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              )}

              {post.video && (
                <video
                  data-media-id={`profile-post-video-${post.id}`}
                  src={post.video}
                  controls
                  playsInline
                  autoPlay={false}
                  preload="none"
                  muted={true}
                  onPointerDown={(e) => {
                    e.currentTarget.dataset.userInitiated = 'true';
                  }}
                  className="rounded-2xl max-h-72 w-full object-cover mt-2 border border-[#c5a059] bg-black"
                />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
