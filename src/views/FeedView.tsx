import React, { useState, useEffect, useRef } from 'react';
import {
  Image,
  Video,
  Send,
  Heart,
  MessageCircle,
  MessageSquare,
  Repeat,
  Share2,
  Trash2,
  Church,
  Sparkles,
  Bookmark,
  Flag,
  UserPlus,
  UserCheck,
  Check,
  X,
  Upload,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { Post } from '../types';
import { addNotification } from '../utils/notifications';
import { TimeAgo } from '../components/TimeAgo';
import {
  loadPosts,
  savePost,
  deletePost,
  togglePostLike,
  addPostComment,
  loadLocalPostCommentsMap,
  loadLocalLikesMap,
} from '../utils/posts';
import { uploadMediaFile, uploadVideoToBunnyStream } from '../utils/storage';
import { isFollowing, toggleFollow } from '../utils/follows';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { BunnyPlayer } from '../components/BunnyPlayer';
import { ReshareModal } from '../components/ReshareModal';
import { ReportContentModal } from '../components/ReportContentModal';
import { StoriesBar } from '../components/StoriesBar';
import { PostCard } from '../components/PostCard';
import { LiturgicalBanner } from '../components/LiturgicalBanner';
import { UserProfileData } from './ProfileView';

interface FeedViewProps {
  onSelectUser?: (userData: UserProfileData) => void;
  onOpenMessengerWithUser?: (contactId?: string) => void;
  onOpenCalendar?: () => void;
}

/**
 * Compresses an image in the browser via HTML5 Canvas
 * Prevents SQLite / D1 "SQLITE_TOOBIG" payload errors
 */
const compressImageToDataUrl = (file: File, maxWidth = 800, quality = 0.7): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new window.Image();
      img.src = e.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
};

export const FeedView: React.FC<FeedViewProps> = ({
  onSelectUser,
  onOpenMessengerWithUser,
  onOpenCalendar,
}) => {
  const { profile } = useAuth();
  const { t } = useTheme();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [feedTab, setFeedTab] = useState<'all' | 'following'>('all');
  const [followedMap, setFollowedMap] = useState<Record<string, boolean>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // New post input state
  const [newPostText, setNewPostText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [selectedVideoFile, setSelectedVideoFile] = useState<File | null>(null);
  const [videoFileName, setVideoFileName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatusText, setSubmitStatusText] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoFileInputRef = useRef<HTMLInputElement>(null);

  // Comments drawer / modal state
  const [activeCommentPostId, setActiveCommentPostId] = useState<string | null>(null);
  const [commentInput, setCommentInput] = useState('');
  const [commentsMap, setCommentsMap] = useState<Record<string, string[]>>(() => loadLocalPostCommentsMap());

  // Reshare modal state
  const [reshareTargetPost, setReshareTargetPost] = useState<Post | null>(null);

  // Report modal state
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
    fetchPosts();

    const interval = setInterval(() => {
      fetchPosts(true);
    }, 25000);

    return () => clearInterval(interval);
  }, []);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const fetchPosts = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch('/api/posts');
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch feed`);

      const rawData = await res.json();
      const rawList: any[] = Array.isArray(rawData) ? rawData : rawData.posts || [];

      const likesMap = loadLocalLikesMap();
      const mappedPosts: Post[] = rawList.map((p: any) => ({
        id: p.id,
        content: p.content || '',
        authorName: p.author_name || p.authorName || 'Super Admin',
        authorParish: p.author_parish || p.authorParish || 'Holy Synod Headquarters',
        authorAvatar: p.author_avatar || p.authorAvatar || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
        authorId: p.author_id || p.authorId || 'admin',
        imageUrl: p.image_url || p.imageUrl || null,
        videoId: p.video_id || p.videoId || null,
        likesCount: Number(p.likes_count ?? p.likesCount ?? 0),
        commentsCount: Number(p.comments_count ?? p.commentsCount ?? 0),
        resharesCount: Number(p.reshares_count ?? p.resharesCount ?? 0),
        createdAt: p.created_at || p.createdAt || new Date().toISOString(),
        isLiked: likesMap[p.id] !== undefined ? likesMap[p.id] : false,
      }));

      setPosts(mappedPosts);
      setFeedError(null);

      const fMap: Record<string, boolean> = {};
      mappedPosts.forEach((p) => {
        fMap[p.authorName] = isFollowing(p.authorName);
      });
      setFollowedMap(fMap);
    } catch (err: any) {
      console.warn('[FeedView] Feed fetch error:', err);
      setFeedError(err?.message || 'Unable to connect to Cloudflare D1 database.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handlePhotoFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        triggerToast('Please select a valid image file.');
        return;
      }
      triggerToast('Optimizing photo...');
      try {
        const compressed = await compressImageToDataUrl(file, 800, 0.7);
        setImageUrl(compressed);
        triggerToast('Photo ready!');
      } catch (err) {
        console.error('Image compression error:', err);
        triggerToast('Error processing image');
      }
    }
    e.target.value = '';
  };

  const handleVideoFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('video/')) {
        triggerToast('Please select a valid video file.');
        return;
      }
      setSelectedVideoFile(file);
      setVideoFileName(file.name);
      const localPreviewUrl = URL.createObjectURL(file);
      setVideoUrl(localPreviewUrl);
      triggerToast('Video attached. Click "POST" to upload.');
    }
    e.target.value = '';
  };

  const handleToggleFollowUser = (authorName: string) => {
    const isNowFollowing = toggleFollow(authorName);
    setFollowedMap((prev) => ({
      ...prev,
      [authorName]: isNowFollowing,
    }));
    triggerToast(
      isNowFollowing
        ? `Now following ${authorName}.`
        : `Unfollowed ${authorName}.`
    );
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostText.trim() && !imageUrl && !selectedVideoFile && !videoUrl) return;

    setIsSubmitting(true);
    setUploadProgress(0);
    setSubmitStatusText('Preparing reflection...');

    try {
      let finalVideoId: string | null = null;

      if (selectedVideoFile) {
        setSubmitStatusText('Uploading video to Bunny Stream...');
        triggerToast('Uploading video directly to Bunny Stream CDN...');

        const uploadedGuid = await uploadVideoToBunnyStream(
          selectedVideoFile,
          newPostText || selectedVideoFile.name,
          (percent) => {
            setUploadProgress(percent);
            setSubmitStatusText(`Uploading video to Bunny Stream (${percent}%)...`);
          }
        );

        if (!uploadedGuid) {
          throw new Error('Bunny Stream upload failed to return a valid video GUID.');
        }
        finalVideoId = uploadedGuid;
      }

      setSubmitStatusText('Saving reflection to Cloudflare D1...');

      const postPayload = {
        id: crypto.randomUUID ? crypto.randomUUID() : `post-${Date.now()}`,
        content: newPostText.trim(),
        author_name: profile?.full_name || 'Super Admin',
        author_parish: profile?.parish || 'Holy Synod Headquarters',
        author_avatar:
          profile?.avatar_url ||
          'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
        author_id: profile?.id || 'admin',
        image_url: finalVideoId ? null : (imageUrl || null),
        video_id: finalVideoId,
        likes_count: 0,
        comments_count: 0,
        reshares_count: 0,
        created_at: new Date().toISOString(),
      };

      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postPayload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Failed to save post (${res.status})`);
      }

      // Clear inputs
      setNewPostText('');
      setImageUrl('');
      setVideoUrl('');
      setSelectedVideoFile(null);
      setVideoFileName('');
      setUploadProgress(0);

      // Refresh from D1
      await fetchPosts(true);
      triggerToast('Reflection published to parish feed!');
    } catch (err: any) {
      console.error('[FeedView] Post submission error:', err);
      triggerToast('Error submitting post: ' + (err?.message || 'Database error'));
    } finally {
      setIsSubmitting(false);
      setSubmitStatusText('');
      setUploadProgress(0);
    }
  };

  const handleToggleLike = async (postId: string) => {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id === postId) {
          const isLiked = !p.isLiked;
          return {
            ...p,
            isLiked,
            likesCount: isLiked ? (p.likesCount || 0) + 1 : Math.max(0, (p.likesCount || 1) - 1),
          };
        }
        return p;
      })
    );

    const res = await togglePostLike(postId, profile);
    if (res && typeof res.likes_count === 'number') {
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, isLiked: res.liked, likesCount: res.likes_count } : p))
      );
    }
  };

  const handleAddComment = async (postId: string, commentText: string) => {
    const text = commentText.trim();
    if (!text) return;

    setCommentsMap((prev) => ({
      ...prev,
      [postId]: [...(prev[postId] || []), text],
    }));

    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, commentsCount: (p.commentsCount || 0) + 1 } : p))
    );

    await addPostComment(postId, text, profile);
  };

  const handleDelete = async (postId: string) => {
    const res = await deletePost(postId, profile);
    if (res.success) {
      setPosts((prev) => prev.filter((p) => p.id !== postId));
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

  const filteredPosts =
    feedTab === 'all'
      ? posts
      : posts.filter(
          (p) =>
            followedMap[p.authorName] ||
            (profile?.full_name && p.authorName.toLowerCase() === profile.full_name.toLowerCase())
        );

  return (
    <div className="space-y-6">
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 px-4 py-2.5 rounded-2xl bg-[#3d2b18] text-[#f5ebd9] border-2 border-[#c5a059] shadow-2xl font-serif text-xs flex items-center gap-2 animate-bounce">
          <Check className="w-4 h-4 text-[#c5a059]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {feedError && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-500/50 text-amber-950 dark:text-amber-200 text-xs flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2.5 min-w-0">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div className="truncate">
              <span className="font-bold">Feed Notice: </span>
              <span>{feedError}</span>
            </div>
          </div>
          <button
            onClick={() => fetchPosts()}
            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-serif font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Retry</span>
          </button>
        </div>
      )}

      <LiturgicalBanner onOpenCalendar={onOpenCalendar} />
      <StoriesBar onSelectUser={onSelectUser} />

      {/* Post Creation Form */}
      <div className="bg-[#f6ebd6] dark:bg-[#1c1611] border-2 border-[#c5a059] dark:border-[#8b6b4a] rounded-3xl p-4 shadow-lg">
        <form onSubmit={handleCreatePost} className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-[#3d2b18] text-[#c5a059] flex items-center justify-center font-bold text-lg shrink-0 shadow-md border-2 border-[#c5a059]">
              ☨
            </div>
            <div className="flex-1 rounded-2xl bg-[#eedcb5] dark:bg-[#282019] border border-[#c5a059] dark:border-[#8b6b4a] p-2.5 flex items-center gap-2">
              <input
                type="text"
                value={newPostText}
                onChange={(e) => setNewPostText(e.target.value)}
                placeholder={t('sharePost')}
                className="w-full bg-transparent text-xs font-serif uppercase tracking-wider text-[#3d2b18] dark:text-[#f5ebd9] placeholder-[#7c5f3d] dark:placeholder-[#a89379] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-1 rounded-lg text-[#7c5f3d] hover:text-[#3d2b18] hover:bg-[#c5a059]/20 transition-colors shrink-0 cursor-pointer"
                title="Upload photo"
              >
                <Image className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              </button>
              <button
                type="button"
                onClick={() => videoFileInputRef.current?.click()}
                className="p-1 rounded-lg text-[#7c5f3d] hover:text-[#3d2b18] hover:bg-[#c5a059]/20 transition-colors shrink-0 cursor-pointer"
                title="Upload video"
              >
                <Video className="w-4 h-4 text-[#a8833c]" />
              </button>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoFileSelect}
            className="hidden"
          />
          <input
            ref={videoFileInputRef}
            type="file"
            accept="video/*"
            onChange={handleVideoFileSelect}
            className="hidden"
          />

          {imageUrl && (
            <div className="relative rounded-2xl overflow-hidden border-2 border-[#c5a059] bg-[#3d2b18]/10 p-1">
              <img
                src={imageUrl}
                alt="Selected preview"
                className="w-full h-auto max-h-80 object-cover rounded-xl"
              />
              <button
                type="button"
                onClick={() => setImageUrl('')}
                className="absolute top-3 right-3 p-1.5 rounded-full bg-[#3d2b18]/90 text-white hover:bg-red-700 transition-all shadow-md cursor-pointer border border-[#c5a059]/50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {videoUrl && (
            <div className="relative rounded-2xl overflow-hidden border-2 border-[#c5a059] bg-[#3d2b18]/10 p-1">
              <video
                src={videoUrl}
                controls
                playsInline
                className="w-full h-auto max-h-80 rounded-xl object-contain bg-black"
              />
              <button
                type="button"
                onClick={() => {
                  setVideoUrl('');
                  setSelectedVideoFile(null);
                  setVideoFileName('');
                }}
                className="absolute top-3 right-3 p-1.5 rounded-full bg-[#3d2b18]/90 text-white hover:bg-red-700 transition-all shadow-md cursor-pointer border border-[#c5a059]/50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {isSubmitting && selectedVideoFile && (
            <div className="w-full bg-[#eedcb5] dark:bg-[#282019] rounded-full h-2 overflow-hidden border border-[#c5a059]/40 mt-1">
              <div
                className="bg-[#c5a059] h-2 rounded-full transition-all duration-200"
                style={{ width: `${Math.max(5, uploadProgress)}%` }}
              />
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-[#c5a059]/30">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer text-[#7c5f3d] hover:text-[#3d2b18] hover:bg-[#eedcb5] dark:hover:bg-[#282019]"
              >
                <Image className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                <span className="hidden sm:inline font-serif uppercase tracking-wider text-[11px]">
                  {imageUrl ? 'Photo Attached' : 'Photo'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => videoFileInputRef.current?.click()}
                className="p-2 rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer text-[#7c5f3d] hover:text-[#3d2b18] hover:bg-[#eedcb5] dark:hover:bg-[#282019]"
              >
                <Video className="w-4 h-4 text-[#a8833c]" />
                <span className="hidden sm:inline font-serif uppercase tracking-wider text-[11px]">
                  {videoUrl || selectedVideoFile ? 'Video Attached' : 'Video'}
                </span>
              </button>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || (!newPostText.trim() && !imageUrl && !videoUrl && !selectedVideoFile)}
              className="px-5 py-2 rounded-xl bg-[#a8833c] hover:bg-[#8f6e30] text-white font-serif uppercase tracking-wider font-bold text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>{submitStatusText || 'Publishing...'}</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>{t('post')}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Mode Switcher */}
      <div className="flex items-center justify-between bg-[#f6ebd6] dark:bg-[#1c1611] border-2 border-[#c5a059] p-1.5 rounded-2xl shadow-md font-serif text-xs">
        <button
          onClick={() => setFeedTab('all')}
          className={`flex-1 py-2 rounded-xl font-bold uppercase tracking-wider transition-all cursor-pointer text-center ${
            feedTab === 'all'
              ? 'bg-[#3d2b18] text-[#c5a059] shadow-md border border-[#c5a059]'
              : 'text-[#7c5f3d] hover:text-[#3d2b18] dark:text-[#a89379]'
          }`}
        >
          {t('allParishFeed')} ({posts.length})
        </button>
        <button
          onClick={() => setFeedTab('following')}
          className={`flex-1 py-2 rounded-xl font-bold uppercase tracking-wider transition-all cursor-pointer text-center ${
            feedTab === 'following'
              ? 'bg-[#3d2b18] text-[#c5a059] shadow-md border border-[#c5a059]'
              : 'text-[#7c5f3d] hover:text-[#3d2b18] dark:text-[#a89379]'
          }`}
        >
          {t('followingFeed')} ({filteredPosts.length})
        </button>
      </div>

      {/* Post List */}
      <div className="space-y-4">
        {loading && posts.length === 0 ? (
          <div className="p-8 text-center bg-[#f6ebd6] dark:bg-[#1c1611] rounded-3xl border-2 border-[#c5a059]">
            <Sparkles className="w-8 h-8 mx-auto text-[#a8833c] animate-spin mb-2" />
            <p className="text-xs text-[#7c5f3d] font-serif uppercase tracking-wider">Loading parish feed...</p>
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="p-8 text-center bg-[#f6ebd6] dark:bg-[#1c1611] rounded-3xl border-2 border-[#c5a059] text-[#7c5f3d] text-xs font-serif uppercase space-y-3 shadow-md">
            <Church className="w-8 h-8 mx-auto text-[#a8833c]" />
            <p className="font-bold text-[#3d2b18] dark:text-[#f5ebd9] text-sm">
              {feedTab === 'following'
                ? "You aren't following anyone with active posts yet."
                : 'No posts found in the parish feed.'}
            </p>
          </div>
        ) : (
          filteredPosts.map((post) => (
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
              onSelectUser={onSelectUser}
              onOpenMessengerWithUser={onOpenMessengerWithUser}
              onToggleFollow={handleToggleFollowUser}
              isFollowed={Boolean(followedMap[post.authorName])}
              onToggleLike={handleToggleLike}
              onDeletePost={handleDelete}
              onOpenReport={handleOpenReport}
              onReshare={(p) => setReshareTargetPost(p)}
              comments={commentsMap[post.id] || []}
              isCommentsOpen={activeCommentPostId === post.id}
              onToggleComments={() =>
                setActiveCommentPostId(activeCommentPostId === post.id ? null : post.id)
              }
              onAddComment={handleAddComment}
            />
          ))
        )}
      </div>

      <ReshareModal
        post={reshareTargetPost}
        isOpen={Boolean(reshareTargetPost)}
        onClose={() => setReshareTargetPost(null)}
        onReshareCreated={(newPost) => setPosts([newPost, ...posts])}
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
