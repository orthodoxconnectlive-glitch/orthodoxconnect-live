import React, { useState, useEffect } from 'react';
import { Church, Edit, UserPlus, UserCheck, MessageSquare, ArrowLeft, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Post, PostComment } from '../types';
import { loadPostsByAuthor, togglePostLike, fetchPostComments, addPostComment, deletePostComment, deletePost } from '../utils/posts';
import { PostCard } from '../components/PostCard';
import { ReshareModal } from '../components/ReshareModal';
import { ReportContentModal } from '../components/ReportContentModal';
import { addNotification } from '../utils/notifications';
import { getFollowingCount, isFollowing, toggleFollow } from '../utils/follows';
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

export const ProfileView: React.FC<ProfileViewProps> = ({
  onOpenEditProfile,
  viewedUser,
  onBack,
  onOpenMessengerWithUser,
}) => {
  const { profile, signOut, loading: authLoading } = useAuth();
  const { t, language } = useTheme();
  const isSelf =
    !viewedUser ||
    !viewedUser.name ||
    (profile?.full_name && profile.full_name.toLowerCase() === viewedUser.name.toLowerCase());

  const targetName = isSelf ? profile?.full_name || 'My Profile' : viewedUser!.name;
  const targetAvatar = isSelf
    ? profile?.avatar_url || 'https://orthodoxconnect.live/launchericon-512x512.png'
    : viewedUser?.avatar || 'https://orthodoxconnect.live/launchericon-512x512.png';
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
  const [commentsMap, setCommentsMap] = useState<Record<string, PostComment[]>>({});
  const [activeCommentPostId, setActiveCommentPostId] = useState<string | null>(null);
  const [reshareTargetPost, setReshareTargetPost] = useState<Post | null>(null);
  const [reportModalData, setReportModalData] = useState<{
    isOpen: boolean;
    contentType: 'post' | 'comment';
    contentId: string;
    targetAuthorName: string;
    snippet: string;
  }>({
    isOpen: false,
    contentType: 'post',
    contentId: '',
    targetAuthorName: '',
    snippet: '',
  });

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

  // Like / comment / delete on this profile's posts — same behavior as the feed.
  const handleToggleLike = async (postId: string) => {
    try {
      const targetPost: any = userPosts.find((p) => p.id === postId) || null;
      const res = await togglePostLike(postId, profile);
      if (res.success) {
        setUserPosts((prev) =>
          prev.map((p) => {
            if (p.id === postId) {
              const updatedCount =
                typeof res.likes_count === 'number'
                  ? res.likes_count
                  : res.liked
                  ? (p.likesCount || 0) + 1
                  : Math.max(0, (p.likesCount || 1) - 1);
              return {
                ...p,
                isLiked: res.liked,
                is_liked: res.liked,
                likesCount: updatedCount,
                likes_count: updatedCount,
                likers: res.likers && res.likers.length > 0 ? res.likers : p.likers,
              };
            }
            return p;
          })
        );
        if (res.liked) {
          const ownerId = targetPost ? String(targetPost.authorId || targetPost.author_id || '') : '';
          const actorId = profile?.id ? String(profile.id) : '';
          if (ownerId && actorId && ownerId !== actorId) {
            addNotification(
              {
                userId: ownerId,
                type: 'like',
                title: language === 'ar' ? 'بركة جديدة' : 'New blessing',
                body:
                  language === 'ar'
                    ? `${profile?.full_name || 'عضو الرعية'} بارك منشورك`
                    : `${profile?.full_name || 'A parishioner'} blessed your post`,
                link: 'feed',
                senderName: profile?.full_name,
                senderAvatar: profile?.avatar_url,
              },
              actorId
            ).catch((notifErr) => {
              console.warn('[ProfileView] Like notification failed:', notifErr);
            });
          }
        }
      }
    } catch (err) {
      console.warn('[ProfileView] Error syncing like:', err);
    }
  };

  const handleToggleComments = async (postId: string) => {
    const isOpening = activeCommentPostId !== postId;
    setActiveCommentPostId(isOpening ? postId : null);
    if (isOpening && !commentsMap[postId]) {
      try {
        const fetched = await fetchPostComments(postId);
        if (fetched) {
          setCommentsMap((prev) => ({ ...prev, [postId]: fetched }));
        }
      } catch (err) {
        console.warn('Error fetching comments:', err);
      }
    }
  };

  const handleAddComment = async (postId: string, commentText: string) => {
    const text = commentText.trim();
    if (!text) return;
    const tempId = `temp-${Date.now()}`;
    const optimisticComment: PostComment = {
      id: tempId,
      postId,
      post_id: postId,
      userId: profile?.id,
      user_id: profile?.id,
      authorName: profile?.full_name || (language === 'ar' ? 'عضو الرعية' : 'Orthodox Parishioner'),
      author_name: profile?.full_name || (language === 'ar' ? 'عضو الرعية' : 'Orthodox Parishioner'),
      authorAvatar:
        profile?.avatar_url ||
        'https://orthodoxconnect.live/launchericon-512x512.png',
      author_avatar:
        profile?.avatar_url ||
        'https://orthodoxconnect.live/launchericon-512x512.png',
      content: text,
      createdAt: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    setCommentsMap((prev) => ({
      ...prev,
      [postId]: [...(prev[postId] || []), optimisticComment],
    }));
    setUserPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, commentsCount: (p.commentsCount || 0) + 1 } : p))
    );
    await addPostComment(postId, text, profile);
  };

  const handleDeleteComment = async (postId: string, commentId: string) => {
    setCommentsMap((prev) => ({
      ...prev,
      [postId]: (prev[postId] || []).filter((c) => c.id !== commentId),
    }));
    setUserPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, commentsCount: Math.max(0, (p.commentsCount || 1) - 1) } : p
      )
    );
    await deletePostComment(postId, commentId, profile);
  };

  const handleDeletePost = async (postId: string) => {
    const res = await deletePost(postId, profile);
    if (res.success) {
      setUserPosts((prev) => prev.filter((p) => p.id !== postId));
    }
  };

  const handleOpenReport = (
    contentType: 'post' | 'comment',
    contentId: string,
    targetAuthorName: string,
    snippet: string
  ) => {
    setReportModalData({
      isOpen: true,
      contentType,
      contentId,
      targetAuthorName,
      snippet,
    });
  };

  const followingCount = getFollowingCount();

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
                {isSelf && (
                <div>
                  <span className="text-(--ac-bronze-tx) font-serif-coptic text-sm mr-1">{followingCount}</span>
                  <span className="text-[10px] text-(--tx-mute) dark:text-[#a89379]">Following</span>
                </div>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          {isSelf ? (
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
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
            <PostCard
              key={post.id}
              post={post}
              currentProfile={
                profile
                  ? {
                      id: profile.id,
                      email: profile.email || '',
                      full_name: profile.full_name || '',
                      parish: profile.parish || '',
                      bio: profile.bio,
                      avatar_url: profile.avatar_url,
                      role: (profile.role as any) || 'user',
                      created_at: profile.created_at,
                    }
                  : null
              }
              onOpenMessengerWithUser={onOpenMessengerWithUser}
              onToggleFollow={isSelf ? undefined : () => handleToggleFollowUser()}
              isFollowed={followingState}
              onToggleLike={handleToggleLike}
              onDeletePost={handleDeletePost}
              onOpenReport={handleOpenReport}
              onReshare={(p) => setReshareTargetPost(p)}
              comments={commentsMap[post.id] || []}
              isCommentsOpen={activeCommentPostId === post.id}
              onToggleComments={() => handleToggleComments(post.id)}
              onAddComment={handleAddComment}
              onDeleteComment={handleDeleteComment}
            />
          ))
        )}
      </div>

      <ReshareModal
        post={reshareTargetPost}
        isOpen={Boolean(reshareTargetPost)}
        onClose={() => setReshareTargetPost(null)}
        onReshareCreated={(newPost) => setUserPosts([newPost, ...userPosts])}
      />

      <ReportContentModal
        isOpen={reportModalData.isOpen}
        onClose={() => setReportModalData((prev) => ({ ...prev, isOpen: false }))}
        contentType={reportModalData.contentType}
        contentId={reportModalData.contentId}
        targetAuthorName={reportModalData.targetAuthorName}
        contentSnippet={reportModalData.snippet}
      />
    </div>
  );
};
