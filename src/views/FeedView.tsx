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
  getLocalSavedPosts,
  BUNNY_STREAM_BASE,
  SEED_VIDEOS,
  loadLocalPostCommentsMap,
  saveLocalPostCommentsMap,
  loadLocalLikesMap,
  saveLocalLikesMap,
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

export const FeedView: React.FC<FeedViewProps> = ({
  onSelectUser,
  onOpenMessengerWithUser,
  onOpenCalendar,
}) => {
  const { profile } = useAuth();
  const { t } = useTheme();

  // Instant non-blank initial post state from local/seed storage
  const [posts, setPosts] = useState<Post[]>(() => getLocalSavedPosts());
  const [loading, setLoading] = useState<boolean>(false);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [feedTab, setFeedTab] = useState<'all' | 'following'>('all');
  const [followedMap, setFollowedMap] = useState<Record<string, boolean>>(() => {
    const initialPosts = getLocalSavedPosts();
    const fMap: Record<string, boolean> = {};
    initialPosts.forEach((p) => {
      fMap[p.authorName] = isFollowing(p.authorName);
    });
    return fMap;
  });
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

    // Periodic refresh from Cloudflare D1 every 30 seconds
    const interval = setInterval(() => {
      fetchPosts(true);
    }, 30000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  // Pause all media elements when sub-tab changes or FeedView unmounts
  useEffect(() => {
    return () => {
      const allMedia = document.querySelectorAll<HTMLMediaElement>('video, audio');
      allMedia.forEach((media) => {
        try {
          if (!media.paused) {
            media.pause();
          }
          media.currentTime = 0;
        } catch (err) {
          console.warn('Error pausing media on Feed unmount:', err);
        }
      });
    };
  }, [feedTab]);

  useEffect(() => {
    return () => {
      const allMedia = document.querySelectorAll<HTMLMediaElement>('video, audio');
      allMedia.forEach((media) => {
        try {
          if (!media.paused) {
            media.pause();
          }
          media.currentTime = 0;
        } catch (err) {
          console.warn('Error pausing media on Feed unmount:', err);
        }
      });
    };
  }, []);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const fetchPosts = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { posts: loaded, error } = await loadPosts(undefined, { limit: 30 });

      if (error) {
        console.warn('[FeedView] Feed fetch error notice:', error);
        setFeedError(typeof error === 'string' ? error : 'Unable to connect to Cloudflare D1 database.');
      } else {
        setFeedError(null);
      }

      const activePosts = loaded && loaded.length > 0 ? loaded : [];
      const likesMap = loadLocalLikesMap();

      // Apply local saved likes
      const postsWithLikes = activePosts.map((p) => {
        if (likesMap[p.id] !== undefined) {
          return {
            ...p,
            isLiked: likesMap[p.id],
          };
        }
        return p;
      });

      setPosts(postsWithLikes);

      // Initialize follow status map for authors
      const fMap: Record<string, boolean> = {};
      postsWithLikes.forEach((p) => {
        fMap[p.authorName] = isFollowing(p.authorName);
      });
      setFollowedMap(fMap);
    } catch (err: any) {
      console.warn('[FeedView] Feed fetch exception handled:', err);
      setFeedError(err?.message || 'Database error');
      const { posts: fallbackPosts } = await loadPosts(undefined, { limit: 30 });
      setPosts(fallbackPosts || []);
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
      triggerToast('Uploading photo...');
      const url = await uploadMediaFile(file, 'post-photos');
      setImageUrl(url);
      triggerToast('Photo attached!');
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
      // Create instant local preview URL
      const localPreviewUrl = URL.createObjectURL(file);
      setVideoUrl(localPreviewUrl);
      triggerToast('Video attached. Click "Publish Reflection" to upload.');
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
        ? `Now following ${authorName}. You will see all their reflections!`
        : `Unfollowed ${authorName}.`
    );
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostText.trim() && !imageUrl && !videoUrl && !selectedVideoFile) return;

    setIsSubmitting(true);
    setUploadProgress(0);
    setSubmitStatusText('Preparing reflection...');

    try {
      let finalVideoId: string | undefined = undefined;

      // 1. Asynchronous Upload Order:
      // When the user selects a video file and clicks "POST":
      // a. First, call POST /api/bunny/create-video to get container guid
      // b. Second, await binary upload PUT request to Bunny Stream
      if (selectedVideoFile) {
        setSubmitStatusText('Uploading video to Bunny Stream (0%)...');
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
      } else if (videoUrl && !videoUrl.startsWith('blob:') && !videoUrl.startsWith('data:')) {
        finalVideoId = videoUrl;
      }

      // c. Third, ONLY AFTER the PUT request returns status 200/OK, send POST /api/posts containing video_id: guid
      setSubmitStatusText('Saving reflection to database...');
      const created = await savePost({
        text: newPostText.trim(),
        authorName: profile?.full_name || 'Orthodox Parishioner',
        authorParish: profile?.parish || 'Orthodox Church',
        authorAvatar:
          profile?.avatar_url ||
          'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
        authorId: profile?.id,
        // Clean Media Separation: If video is attached, ensure image is null/undefined
        image: finalVideoId ? undefined : (imageUrl || undefined),
        video_id: finalVideoId,
        video: finalVideoId,
      });

      console.log('[FeedView] Post created in Cloudflare D1 with ID:', created.id, 'video_id:', finalVideoId);

      // Clear form inputs upon successful submission
      setNewPostText('');
      setImageUrl('');
      setVideoUrl('');
      setSelectedVideoFile(null);
      setVideoFileName('');
      setUploadProgress(0);

      // Re-fetch post list from D1 to sync UI
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

  const handleToggleLike = (postId: string) => {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id === postId) {
          const isLiked = !p.isLiked;
          const currentLikes = loadLocalLikesMap();
          currentLikes[postId] = isLiked;
          saveLocalLikesMap(currentLikes);

          if (isLiked && p.authorId && profile?.id && p.authorId !== profile.id) {
            addNotification(
              {
                userId: p.authorId,
                type: 'system',
                title: `Reaction from ${profile?.full_name || 'Parishioner'}`,
                body: `Liked your reflection: "${p.text ? (p.text.length > 50 ? p.text.slice(0, 50) + '...' : p.text) : 'Post'}"`,
                senderName: profile?.full_name || 'Parishioner',
                senderAvatar: profile?.avatar_url,
                link: 'feed',
              },
              profile.id
            );
          }

          return {
            ...p,
            isLiked,
            likesCount: isLiked ? (p.likesCount || 0) + 1 : Math.max(0, (p.likesCount || 1) - 1),
          };
        }
        return p;
      })
    );
  };

  const handleAddComment = (postId: string, commentText: string) => {
    const text = commentText.trim();
    if (!text) return;

    const targetPost = posts.find((p) => p.id === postId);

    setCommentsMap((prev) => {
      const updatedMap = {
        ...prev,
        [postId]: [...(prev[postId] || []), text],
      };
      saveLocalPostCommentsMap(updatedMap);
      return updatedMap;
    });

    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, commentsCount: (p.commentsCount || 0) + 1 } : p))
    );

    if (targetPost?.authorId && profile?.id && targetPost.authorId !== profile.id) {
      addNotification(
        {
          userId: targetPost.authorId,
          type: 'mention',
          title: `New comment from ${profile?.full_name || 'Parishioner'}`,
          body: text,
          senderName: profile?.full_name || 'Parishioner',
          senderAvatar: profile?.avatar_url,
          link: 'feed',
        },
        profile.id
      );
    }
  };

  const handleDelete = async (postId: string) => {
    const res = await deletePost(postId, profile);
    if (res.success) {
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } else {
      console.warn('Failed to delete post:', res.error);
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
      {/* Toast notification message */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 px-4 py-2.5 rounded-2xl bg-[#3d2b18] text-[#f5ebd9] border-2 border-[#c5a059] shadow-2xl font-serif text-xs flex items-center gap-2 animate-bounce">
          <Check className="w-4 h-4 text-[#c5a059]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Feed Error Banner */}
      {feedError && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-500/50 text-amber-950 dark:text-amber-200 text-xs flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2.5 min-w-0">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div className="truncate">
              <span className="font-bold">Feed Notice: </span>
              <span>{feedError}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => fetchPosts()}
              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-serif font-bold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry</span>
            </button>
            <button
              onClick={() => setFeedError(null)}
              className="p-1.5 hover:bg-amber-200 dark:hover:bg-amber-900 rounded-xl transition-colors shrink-0 cursor-pointer"
              title="Dismiss notice"
            >
              <X className="w-4 h-4 text-amber-700 dark:text-amber-300" />
            </button>
          </div>
        </div>
      )}

      {/* Daily Liturgical Scripture, Saint of Day & Fasting Banner */}
      <LiturgicalBanner onOpenCalendar={onOpenCalendar} />

      {/* Stories Bar Component */}
      <StoriesBar onSelectUser={onSelectUser} />

      {/* Post Creation Box (Facebook Style Direct Upload) */}
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
                title="Upload photo from device"
              >
                <Image className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              </button>
              <button
                type="button"
                onClick={() => videoFileInputRef.current?.click()}
                className="p-1 rounded-lg text-[#7c5f3d] hover:text-[#3d2b18] hover:bg-[#c5a059]/20 transition-colors shrink-0 cursor-pointer"
                title="Upload video from device"
              >
                <Video className="w-4 h-4 text-[#a8833c]" />
              </button>
            </div>
          </div>

          {/* Hidden File Picker Inputs */}
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

          {/* Facebook-style Local Photo Preview */}
          {imageUrl && (
            <div className="relative rounded-2xl overflow-hidden border-2 border-[#c5a059] bg-[#3d2b18]/10 p-1">
              <div className="relative max-h-80 overflow-hidden rounded-xl bg-black/20 flex items-center justify-center">
                <img
                  src={imageUrl}
                  alt="Selected local photo preview"
                  className="w-full h-auto max-h-80 object-cover rounded-xl"
                />
                <div className="absolute top-2 right-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2.5 py-1.5 rounded-full bg-[#3d2b18]/90 text-[#c5a059] hover:bg-[#3d2b18] hover:text-white transition-all shadow-md text-[10px] font-serif font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer border border-[#c5a059]/50"
                    title="Replace Photo"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Replace</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageUrl('')}
                    className="p-1.5 rounded-full bg-[#3d2b18]/90 text-[#f5ebd9] hover:bg-red-700 hover:text-white transition-all shadow-md cursor-pointer border border-[#c5a059]/50"
                    title="Remove Photo"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="absolute bottom-2 left-2 px-2.5 py-1 rounded-lg bg-[#3d2b18]/80 text-[#c5a059] text-[10px] font-serif font-bold uppercase tracking-wider backdrop-blur-sm border border-[#c5a059]/30">
                  Photo Attached
                </div>
              </div>
            </div>
          )}

          {/* Facebook-style Local Video Preview */}
          {videoUrl && (
            <div className="relative rounded-2xl overflow-hidden border-2 border-[#c5a059] bg-[#3d2b18]/10 p-1">
              <div className="relative max-h-80 overflow-hidden rounded-xl bg-black flex items-center justify-center">
                <video
                  data-media-id="new-post-video-preview"
                  src={videoUrl}
                  controls
                  playsInline
                  autoPlay={false}
                  preload="none"
                  muted={true}
                  onPointerDown={(e) => {
                    e.currentTarget.dataset.userInitiated = 'true';
                  }}
                  onError={(e) => {
                    console.warn('[FeedView] Preview video error:', e);
                  }}
                  className="w-full h-auto max-h-80 rounded-xl object-contain bg-black"
                />
                <div className="absolute top-2 right-2 z-10 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => videoFileInputRef.current?.click()}
                    className="px-2.5 py-1.5 rounded-full bg-[#3d2b18]/90 text-[#c5a059] hover:bg-[#3d2b18] hover:text-white transition-all shadow-md text-[10px] font-serif font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer border border-[#c5a059]/50"
                    title="Replace Video"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Replace</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setVideoUrl('');
                      setSelectedVideoFile(null);
                      setVideoFileName('');
                    }}
                    className="p-1.5 rounded-full bg-[#3d2b18]/90 text-[#f5ebd9] hover:bg-red-700 hover:text-white transition-all shadow-md cursor-pointer border border-[#c5a059]/50"
                    title="Remove Video"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="absolute bottom-2 left-2 z-10 px-2.5 py-1 rounded-lg bg-[#3d2b18]/80 text-[#c5a059] text-[10px] font-serif font-bold uppercase tracking-wider backdrop-blur-sm border border-[#c5a059]/30 flex items-center gap-1">
                  <Video className="w-3.5 h-3.5 text-[#c5a059]" />
                  <span>{videoFileName ? `Video: ${videoFileName}` : 'Bunny Stream Video Attached'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Progress Bar during Video Upload */}
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
                title="Select photo from PC or gallery"
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
                title="Select video from PC or gallery"
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

      {/* Feed Mode Switcher (ALL POSTS vs FOLLOWING) */}
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

      {/* Main Feed Posts List */}
      <div className="space-y-4">
        {loading ? (
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
            {feedTab === 'following' ? (
              <p className="text-[11px] text-[#a8833c]">
                Switch to "All Parish Feed" to discover and follow other parish members!
              </p>
            ) : (
              <p className="text-[11px] text-[#a8833c]">
                Be the first to share a reflection, announcement, or prayer request above!
              </p>
            )}
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

      {/* Reshare Modal */}
      <ReshareModal
        post={reshareTargetPost}
        isOpen={Boolean(reshareTargetPost)}
        onClose={() => setReshareTargetPost(null)}
        onReshareCreated={(newPost) => setPosts([newPost, ...posts])}
      />

      {/* Content Flagging & Reporting Modal */}
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

