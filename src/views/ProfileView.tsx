import React, { useState, useEffect } from 'react';
import { Church, Edit, UserPlus, UserCheck, MessageSquare, ArrowLeft, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Post } from '../types';
import { loadPostsByAuthor } from '../utils/posts';
import { BUNNY_LIBRARY_ID } from '../utils/posts';
import { parseVideoEmbed, extractCleanVideoId } from '../components/PostCard';
import { getFollowersCount, getFollowingCount, isFollowing, toggleFollow } from '../utils/follows';
import { testPushNotification } from '../utils/pushClient';

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

// Renders a profile post's video correctly: YouTube/Vimeo/Bunny as iframes,
// direct media files as a native <video>. The raw video_id (e.g. a youtu.be
// URL or Bunny GUID) can never be fed straight into a <video> tag.
const ProfilePostVideo: React.FC<{ post: Post }> = ({ post }) => {
  const rawSource =
    post.videoId || post.video_id || post.video || post.videoUrl || post.video_url || undefined;
  if (!rawSource) return null;
  const parsed = parseVideoEmbed(rawSource);
  const cleanId = extractCleanVideoId(rawSource);
  const libraryId = BUNNY_LIBRARY_ID || '713265';

  if (parsed && (parsed.type === 'youtube' || parsed.type === 'vimeo')) {
    return (
      <div className="relative w-full overflow-hidden rounded-2xl bg-black aspect-video mt-2 border border-(--ln-gold)">
        <iframe
          src={parsed.embedUrl}
          title="Video player"
          className="absolute inset-0 w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          loading="lazy"
        />
      </div>
    );
  }

  if ((parsed && parsed.type === 'bunny') || cleanId) {
    const embedUrl =
      parsed && parsed.type === 'bunny'
        ? parsed.embedUrl
        : `https://iframe.mediadelivery.net/embed/${libraryId}/${cleanId}?autoplay=false&preload=true&responsive=true`;
    return (
      <div className="relative w-full overflow-hidden rounded-2xl bg-black aspect-video mt-2 border border-(--ln-gold)">
        <iframe
          src={embedUrl}
          title="Video player"
          className="absolute inset-0 w-full h-full"
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
          allowFullScreen
          loading="lazy"
        />
      </div>
    );
  }

  if (parsed && parsed.type === 'direct') {
    return (
      <video
        data-media-id={`profile-post-video-${post.id}`}
        src={parsed.embedUrl}
        controls
        playsInline
        preload="none"
        muted
        onPointerDown={(e) => {
          e.currentTarget.dataset.userInitiated = 'true';
        }}
        onTouchStart={(e) => {
          e.currentTarget.dataset.userInitiated = 'true';
        }}
        className="rounded-2xl max-h-72 w-full object-cover mt-2 border border-(--ln-gold) bg-black"
      />
    );
  }

  return null;
};

export const ProfileView: React.FC<ProfileViewProps> = ({
  onOpenEditProfile,
  viewedUser,
  onBack,
  onOpenMessengerWithUser,
}) => {
  const { profile, signOut, loading: authLoading } = useAuth();
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
  const [pushTestMsg, setPushTestMsg] = useState<string | null>(null);
  const [pushTesting, setPushTesting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [followingState, setFollowingState] = useState<boolean>(false);

  useEffect(() => {
    // When viewing your own profile, wait for auth hydration so we filter
    // by the real user id (not just the display name).
    if (isSelf && authLoading) return;
    fetchUserPosts();
    if (!isSelf) {
      setFollowingState(isFollowing(targetName));
    }
  }, [targetName, isSelf, authLoading, profile?.id, viewedUser?.id]);

  const fetchUserPosts = async () => {
    setLoading(true);
    // Prefer the stable user id (works for your own profile and for other
    // users' profiles alike); fall back to the display name for legacy
    // posts stored without an author id.
    const authorKey = viewedUser?.id || (isSelf ? (profile as any)?.id : undefined) || targetName;
    const posts = await loadPostsByAuthor(authorKey);
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
            className="px-4 py-2 rounded-2xl bg-(--bg-soft) dark:bg-[#282019] text-(--tx-strong) dark:text-[#f5ebd9] border border-(--ln-gold) font-serif font-bold text-xs uppercase tracking-wider flex items-center gap-2 hover:bg-(--ac-gold)/20 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-(--ac-gold-tx)" />
            <span>Back</span>
          </button>
        </div>
      )}

      {/* Profile Header Banner */}
      <div className="relative rounded-3xl bg-(--bg-card) dark:bg-[#1c1611] border-2 border-(--ln-gold) dark:border-[#8b6b4a] p-6 shadow-2xl overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-(--ac-gold)/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="relative">
              <img
                src={targetAvatar}
                alt={targetName}
                className="w-20 h-20 rounded-3xl object-cover border-2 border-(--ln-gold) shadow-xl"
              />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-(--chip-dark) text-(--ac-gold-tx) flex items-center justify-center font-bold text-xs border border-(--ln-gold)">
                ☨
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-serif-coptic font-bold text-xl md:text-2xl text-(--tx-strong) dark:text-[#f5ebd9] uppercase tracking-wider">
                  {targetName}
                </h2>
                <span className="px-3 py-0.5 rounded-full bg-(--bg-soft) dark:bg-[#282019] text-(--tx-strong) dark:text-[#f5ebd9] border border-(--ln-gold) text-[10px] font-serif font-bold uppercase tracking-wider">
                  {targetRole}
                </span>
              </div>

              <p className="text-xs text-(--ac-bronze-tx) font-serif font-semibold flex items-center gap-1.5 mt-1 uppercase tracking-wider">
                <Church className="w-3.5 h-3.5" /> {targetParish}
              </p>

              <p className="text-xs text-(--tx-strong) dark:text-[#f5ebd9] mt-2 max-w-lg font-serif leading-relaxed">
                {targetBio}
              </p>

              {/* Stats Bar */}
              <div className="flex items-center gap-6 mt-4 pt-3 border-t border-(--ln-gold)/30 text-xs font-serif font-bold uppercase tracking-wider text-(--tx-strong) dark:text-[#f5ebd9]">
                <div>
                  <span className="text-(--ac-bronze-tx) font-serif-coptic text-sm mr-1">{userPosts.length}</span>
                  <span className="text-[10px] text-(--tx-mute) dark:text-[#a89379]">Posts</span>
                </div>
                <div>
                  <span className="text-(--ac-bronze-tx) font-serif-coptic text-sm mr-1">{followersCount}</span>
                  <span className="text-[10px] text-(--tx-mute) dark:text-[#a89379]">Followers</span>
                </div>
                <div>
                  <span className="text-(--ac-bronze-tx) font-serif-coptic text-sm mr-1">{followingCount}</span>
                  <span className="text-[10px] text-(--tx-mute) dark:text-[#a89379]">Following</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          {isSelf ? (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={onOpenEditProfile}
                className="px-4 py-2.5 rounded-2xl bg-(--ac-bronze) hover:bg-(--ac-bronze-dk) text-white font-serif font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-lg transition-all cursor-pointer"
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
              <button
                onClick={async () => {
                  setPushTesting(true);
                  setPushTestMsg('Resetting…');
                  const uid = (profile as any)?.id || '';
                  const res = await testPushNotification(uid);
                  setPushTesting(false);
                  setPushTestMsg(res === 'ok' ? '✅ Call notifications reset — test push sent!' : '⚠️ ' + res);
                }}
                disabled={pushTesting}
                className="px-4 py-2.5 rounded-2xl bg-(--bg-soft) dark:bg-[#282019] text-(--tx-strong) dark:text-[#f5ebd9] border border-(--ln-gold) font-serif font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-lg transition-all cursor-pointer disabled:opacity-50"
                title="Reset push notifications for calls"
              >
                <span>🔔</span>
                <span>{pushTesting ? 'Resetting…' : 'Reset Call Alerts'}</span>
              </button>
              {pushTestMsg && (
                <div className="text-xs font-serif mt-1 text-(--tx-strong) dark:text-[#f5ebd9]">{pushTestMsg}</div>
              )}
            </div>
          ) : (            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={handleToggleFollowUser}
                className={`px-5 py-2.5 rounded-2xl font-serif font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg transition-all cursor-pointer ${
                  followingState
                    ? 'bg-(--bg-soft) dark:bg-[#282019] text-(--tx-mute) dark:text-[#f5ebd9] border-2 border-(--ln-gold)'
                    : 'bg-(--ac-gold) hover:bg-(--ac-bronze) text-white'
                }`}
              >
                {followingState ? (
                  <>
                    <UserCheck className="w-4 h-4 text-(--ac-gold-tx)" />
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
                  className="px-5 py-2.5 rounded-2xl bg-(--chip-dark) dark:bg-[#2a2018] hover:bg-(--ac-bronze) text-(--ac-gold-tx) hover:text-white border border-(--ln-gold) font-serif font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg transition-all cursor-pointer"
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
        <h3 className="font-serif font-bold text-lg text-(--tx-strong) dark:text-amber-100 pb-2 border-b border-(--ln-gold)/30">
          {isSelf ? 'Your Reflections & Posts' : `${targetName}'s Reflections & Posts`} ({userPosts.length})
        </h3>

        {loading ? (
          <p className="text-xs text-(--ac-bronze-tx) text-center py-6">Loading reflections...</p>
        ) : userPosts.length === 0 ? (
          <div className="p-8 text-center bg-(--bg-card) dark:bg-[#1c1611] rounded-3xl border-2 border-(--ln-gold) text-(--tx-mute) dark:text-[#a89379] text-xs font-serif">
            {isSelf
              ? "You haven't posted any reflections yet. Share something with your parish!"
              : `${targetName} has not shared any reflections on the parish feed yet.`}
          </div>
        ) : (
          userPosts.map((post) => (
            <div
              key={post.id}
              className="p-5 rounded-3xl bg-(--bg-card) dark:bg-[#1c1611] border-2 border-(--ln-gold) dark:border-[#8b6b4a] space-y-3 shadow-lg"
            >
              <div className="flex items-center gap-3">
                <img
                  src={post.authorAvatar || targetAvatar}
                  alt={post.authorName}
                  className="w-9 h-9 rounded-full object-cover border-2 border-(--ln-gold)"
                />
                <div>
                  <span className="text-xs font-serif font-bold text-(--tx-strong) dark:text-[#f5ebd9] block">
                    {post.authorName}
                  </span>
                  <span className="text-[10px] font-serif text-(--ac-bronze-tx) block">
                    {new Date(post.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {post.text && (
                <p className="text-xs text-(--tx-strong) dark:text-[#f5ebd9] font-serif leading-relaxed">
                  {post.text}
                </p>
              )}

              {post.image && (
                <img
                  src={post.image}
                  alt="Post content"
                  className="rounded-2xl max-h-72 w-full object-cover mt-2 border border-(--ln-gold)"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              )}

              <ProfilePostVideo post={post} />
            </div>
          ))
        )}
      </div>
    </div>
  );
};
