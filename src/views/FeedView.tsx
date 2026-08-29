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
  Link2,
} from 'lucide-react';
import { Post, PostComment } from '../types';
import { addNotification } from '../utils/notifications';
import { TimeAgo } from '../components/TimeAgo';
import {
  loadPosts,
  savePost,
  deletePost,
  togglePostLike,
  fetchPostComments,
  addPostComment,
  deletePostComment,
  getLocalSavedPosts,
  BUNNY_STREAM_BASE,
  SEED_VIDEOS,
  loadLocalPostCommentsMap,
  saveLocalPostCommentsMap,
  loadLocalLikesMap,
  saveLocalLikesMap,
  loadLocalLikersMap,
  saveLocalLikersMap,
} from '../utils/posts';
import { uploadMediaFile, uploadVideoToBunnyStream, compressImageToDataUrl } from '../utils/storage';
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

// Helper to extract embed links
export function parseVideoEmbed(url?: string | null): { type: 'youtube' | 'vimeo' | 'direct'; embedUrl: string } | null {
  if (!url) return null;
  const cleanUrl = url.trim();

  // YouTube match (standard, share links, shorts)
  const ytMatch = cleanUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/i);
  if (ytMatch && ytMatch[1]) {
    return {
      type: 'youtube',
      embedUrl: `https://www.youtube-nocookie.com/embed/${ytMatch[1]}`,
    };
  }

  // Vimeo match
  const vimeoMatch = cleanUrl.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (vimeoMatch && vimeoMatch[1]) {
    return {
      type: 'vimeo',
      embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}`,
    };
  }

  // Direct MP4 / WebM / Bunny Stream CDN
  if (/\.(mp4|webm|ogg)$/i.test(cleanUrl) || cleanUrl.includes('.b-cdn.net/')) {
    return {
      type: 'direct',
      embedUrl: cleanUrl,
    };
  }

  return null;
}

interface FeedViewProps {
  onSelectUser?: (userData: UserProfileData) => void;
  onOpenMessengerWithUser?: (contactId?: string) => void;
  onOpenCalendar?: () => void;
}

const PAGE_SIZE = 50;

export const FeedView: React.FC<FeedViewProps> = ({
  onSelectUser,
  onOpenMessengerWithUser,
  onOpenCalendar,
}) => {
  const { profile } = useAuth();
  const { t, language } = useTheme();

  // Instant render from local storage cache with likes and likers merged
  const [posts, setPosts] = useState<Post[]>(() => {
    const cached = getLocalSavedPosts();
    const localLikes = loadLocalLikesMap();
    const localLikers = loadLocalLikersMap();
    const localComments = loadLocalPostCommentsMap();

    return cached.map((p) => {
      const isLocallyLiked = localLikes[p.id] !== undefined ? localLikes[p.id] : Boolean(p.isLiked);
      const baseCount = typeof p.likesCount === 'number' ? p.likesCount : (p.likes_count || 0);
      const adjustedCount = isLocallyLiked && baseCount === 0 ? 1 : baseCount;
      const likers = localLikers[p.id] || p.likers || [];
      const comments = localComments[p.id] || [];

      return {
        ...p,
        isLiked: isLocallyLiked,
        likesCount: adjustedCount,
        likes_count: adjustedCount,
        likers,
        commentsCount: Math.max(p.commentsCount || 0, comments.length),
      };
    });
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
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
  const [showVideoUrlInput, setShowVideoUrlInput] = useState(false);
  const [selectedVideoFile, setSelectedVideoFile] = useState<File | null>(null);
  const [videoFileName, setVideoFileName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatusText, setSubmitStatusText] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoFileInputRef = useRef<HTMLInputElement>(null);

  // Comments & Modal state
  const [activeCommentPostId, setActiveCommentPostId] = useState<string | null>(null);
  const [commentsMap, setCommentsMap] = useState<Record<string, PostComment[]>>({});
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
    fetchPosts();

    const interval = setInterval(() => {
      fetchPosts(true);
    }, 45000);

    return () => {
      clearInterval(interval);
    };
  }, [profile?.id, profile?.email]);

  useEffect(() => {
    return () => {
      const allMedia = document.querySelectorAll<HTMLMediaElement>('video, audio');
      allMedia.forEach((media) => {
        try {
          if (!media.paused) media.pause();
        } catch (e) {}
      });
    };
  }, [feedTab]);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const syncPostMetadata = (rawPosts: Post[]) => {
    const localLikes = loadLocalLikesMap();
    const localLikersMap = loadLocalLikersMap();
    const localCommentsMap = loadLocalPostCommentsMap();

    return rawPosts.map((p) => {
      const isLocallyLiked = localLikes[p.id] !== undefined ? localLikes[p.id] : Boolean(p.isLiked);
      const baseCount = typeof p.likesCount === 'number' ? p.likesCount : (p.likes_count || 0);
      const adjustedCount = isLocallyLiked && baseCount === 0 ? 1 : baseCount;
      const likers = localLikersMap[p.id] || p.likers || [];

      return {
        ...p,
        isLiked: isLocallyLiked,
        likesCount: adjustedCount,
        likes_count: adjustedCount,
        likers,
        commentsCount: Math.max(p.commentsCount || 0, (localCommentsMap[p.id] || []).length),
      };
    });
  };

  // Initial / Refresh fetch
  const fetchPosts = async (silent = false) => {
    if (!silent && posts.length === 0) setLoading(true);
    setFeedError(null);

    try {
      const { posts: fetchedPosts, error } = await loadPosts(undefined, { limit: PAGE_SIZE, page: 1 });

      if (error) {
        setFeedError(error);
      }

      const activePosts = fetchedPosts && fetchedPosts.length > 0 ? fetchedPosts : getLocalSavedPosts();
      const synced = syncPostMetadata(activePosts);

      setPosts(synced);
      setPage(1);
      setHasMore(synced.length >= PAGE_SIZE);

      const fMap: Record<string, boolean> = {};
      synced.forEach((p) => {
        const name = p.authorName || p.author_name || '';
        if (name) fMap[name] = isFollowing(name);
      });
      setFollowedMap(fMap);
    } catch (err: any) {
      console.warn('[FeedView] Feed fetch exception:', err);
      setFeedError(err?.message || 'Database error');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Load older posts function
  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);

    try {
      const nextPage = page + 1;
      const { posts: nextBatch, error } = await loadPosts(undefined, { 
        limit: PAGE_SIZE, 
        page: nextPage,
        offset: posts.length 
      });

      if (error) {
        setFeedError(error);
      }

      if (nextBatch && nextBatch.length > 0) {
        const syncedBatch = syncPostMetadata(nextBatch);
        
        // Prevent duplicate IDs when appending
        setPosts((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const uniqueNew = syncedBatch.filter((p) => !existingIds.has(p.id));
          return [...prev, ...uniqueNew];
        });

        setPage(nextPage);
        if (nextBatch.length < PAGE_SIZE) {
          setHasMore(false);
        }
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.warn('[FeedView] Failed to load older posts:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  const handlePhotoFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        triggerToast(language === 'ar' ? 'يرجى اختيار ملف صورة صالح.' : 'Please select a valid image file.');
        return;
      }
      try {
        triggerToast(language === 'ar' ? 'جارٍ تجهيز وضغط الصورة...' : 'Compressing photo...');
        const compressedUrl = await compressImageToDataUrl(file, 800, 0.7);
        setImageUrl(compressedUrl);
        triggerToast(language === 'ar' ? 'تم إرفاق الصورة!' : 'Photo attached!');
      } catch (err) {
        const url = await uploadMediaFile(file, 'post-photos');
        setImageUrl(url);
        triggerToast(language === 'ar' ? 'تم إرفاق الصورة!' : 'Photo attached!');
      }
    }
    e.target.value = '';
  };

  const handleVideoFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('video/')) {
        triggerToast(language === 'ar' ? 'يرجى اختيار ملف فيديو صالح.' : 'Please select a valid video file.');
        return;
      }
      setSelectedVideoFile(file);
      setVideoFileName(file.name);
      const localPreviewUrl = URL.createObjectURL(file);
      setVideoUrl(localPreviewUrl);
      setShowVideoUrlInput(false);
      triggerToast(
        language === 'ar'
          ? 'تم إرفاق الفيديو. اضغط "نشر" للرفع والتأكيد.'
          : 'Video attached. Click "Publish Reflection" to upload.'
      );
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
        ? language === 'ar'
          ? `أنت الآن تتابع ${authorName}.`
          : `Now following ${authorName}.`
        : language === 'ar'
        ? `تم إلغاء متابعة ${authorName}.`
        : `Unfollowed ${authorName}.`
    );
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();

    let detectedVideoLink = videoUrl.trim();
    if (!detectedVideoLink && !selectedVideoFile) {
      const match = newPostText.match(/https?:\/\/[^\s]+/i);
      if (match && parseVideoEmbed(match[0])) {
        detectedVideoLink = match[0];
      }
    }

    if (!newPostText.trim() && !imageUrl && !detectedVideoLink && !selectedVideoFile) return;

    setIsSubmitting(true);
    setUploadProgress(0);
    setSubmitStatusText(language === 'ar' ? 'جارٍ إعداد المنشور...' : 'Preparing reflection...');

    try {
      let finalVideoId: string | null = null;

      if (selectedVideoFile) {
        setSubmitStatusText(
          language === 'ar'
            ? 'جارٍ رفع الفيديو إلى Bunny Stream...'
            : 'Uploading video to Bunny Stream...'
        );

        const uploadedGuid = await uploadVideoToBunnyStream(
          selectedVideoFile,
          newPostText || selectedVideoFile.name,
          (percent) => {
            setUploadProgress(percent);
          }
        );

        if (!uploadedGuid) {
          throw new Error('Bunny Stream upload failed to return a valid video GUID.');
        }
        finalVideoId = uploadedGuid;
      } else if (detectedVideoLink && !detectedVideoLink.startsWith('blob:') && !detectedVideoLink.startsWith('data:')) {
        finalVideoId = detectedVideoLink;
      }

      setSubmitStatusText(language === 'ar' ? 'جارٍ حفظ المنشور...' : 'Saving reflection...');

      const postId =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `post-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

      const postPayload = {
        id: postId,
        content: newPostText.trim(),
        image_url: finalVideoId ? null : imageUrl || null,
        video_id: finalVideoId,
        author_id: profile?.id || null,
        author_name: profile?.full_name || (language === 'ar' ? 'عضو الرعية' : 'Orthodox Parishioner'),
        author_parish: profile?.parish || (language === 'ar' ? 'كنيسة أرثوذكسية' : 'Orthodox Church'),
        author_avatar:
          profile?.avatar_url ||
          'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
        created_at: new Date().toISOString(),
      };

      try {
        await fetch('/api/posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(postPayload),
        });
      } catch (postErr) {
        console.warn('[FeedView] API save warning:', postErr);
      }

      await savePost({
        id: postPayload.id,
        text: postPayload.content,
        content: postPayload.content,
        authorName: postPayload.author_name,
        author_name: postPayload.author_name,
        authorParish: postPayload.author_parish,
        author_parish: postPayload.author_parish,
        authorAvatar: postPayload.author_avatar,
        author_avatar: postPayload.author_avatar,
        authorId: postPayload.author_id || undefined,
        author_id: postPayload.author_id || undefined,
        image: postPayload.image_url || undefined,
        imageUrl: postPayload.image_url || undefined,
        image_url: postPayload.image_url || undefined,
        video: postPayload.video_id || undefined,
        videoId: postPayload.video_id || undefined,
        video_id: postPayload.video_id || undefined,
        createdAt: postPayload.created_at,
        created_at: postPayload.created_at,
      });

      setNewPostText('');
      setImageUrl('');
      setVideoUrl('');
      setShowVideoUrlInput(false);
      setSelectedVideoFile(null);
      setVideoFileName('');
      setUploadProgress(0);

      await fetchPosts(true);
      triggerToast(language === 'ar' ? 'تم نشر المنشور!' : 'Reflection published!');
    } catch (err: any) {
      console.error('[FeedView] Post submission error:', err);
      triggerToast('Error: ' + (err?.message || 'Failed to submit post'));
    } finally {
      setIsSubmitting(false);
      setSubmitStatusText('');
      setUploadProgress(0);
    }
  };

  const handleToggleLike = async (postId: string) => {
    const myLikerId = profile?.id || 'me';
    const myLikerName = profile?.full_name || (language === 'ar' ? 'أنت' : 'You');
    const myLikerAvatar =
      profile?.avatar_url ||
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200';

    let nextIsLiked = false;
    let updatedLikersList: any[] = [];

    setPosts((prev) =>
      prev.map((p) => {
        if (p.id === postId) {
          nextIsLiked = !p.isLiked;
          const currentCount = typeof p.likesCount === 'number' ? p.likesCount : (p.likes_count || 0);
          const nextCount = nextIsLiked ? currentCount + 1 : Math.max(0, currentCount - 1);

          let updatedLikers = p.likers ? [...p.likers] : [];
          if (nextIsLiked) {
            updatedLikers = [
              { userId: myLikerId, userName: myLikerName, userAvatar: myLikerAvatar },
              ...updatedLikers.filter(
                (l) => l.userId !== myLikerId && l.userId !== 'me' && l.userId !== profile?.id
              ),
            ];
          } else {
            updatedLikers = updatedLikers.filter(
              (l) => l.userId !== myLikerId && l.userId !== 'me' && l.userId !== profile?.id
            );
          }

          updatedLikersList = updatedLikers;

          return {
            ...p,
            isLiked: nextIsLiked,
            likesCount: nextCount,
            likes_count: nextCount,
            likers: updatedLikers,
          };
        }
        return p;
      })
    );

    const currentLocalLikes = loadLocalLikesMap();
    saveLocalLikesMap({
      ...currentLocalLikes,
      [postId]: nextIsLiked,
    });

    const currentLikersMap = loadLocalLikersMap();
    saveLocalLikersMap({
      ...currentLikersMap,
      [postId]: updatedLikersList,
    });

    try {
      await togglePostLike(postId, profile);
    } catch (err) {
      console.warn('Error syncing like:', err);
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
        'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
      author_avatar:
        profile?.avatar_url ||
        'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
      content: text,
      createdAt: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    setCommentsMap((prev) => ({
      ...prev,
      [postId]: [...(prev[postId] || []), optimisticComment],
    }));

    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, commentsCount: (p.commentsCount || 0) + 1 } : p))
    );

    await addPostComment(postId, text, profile);
  };

  const handleDeleteComment = async (postId: string, commentId: string) => {
    setCommentsMap((prev) => ({
      ...prev,
      [postId]: (prev[postId] || []).filter((c) => c.id !== commentId),
    }));

    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, commentsCount: Math.max(0, (p.commentsCount || 1) - 1) } : p
      )
    );

    await deletePostComment(postId, commentId, profile);
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

  const parsedPreviewEmbed = parseVideoEmbed(videoUrl);

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
      {/* Toast Notice */}
      {toastMessage && (
        <div className="fixed top-20 right-6 rtl:right-auto rtl:left-6 z-50 px-4 py-2.5 rounded-2xl bg-[#3d2b18] text-[#f5ebd9] border-2 border-[#c5a059] shadow-2xl font-serif text-xs flex items-center gap-2 animate-bounce">
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
              <span className="font-bold">{language === 'ar' ? 'تنبيه الخلاصة: ' : 'Feed Notice: '}</span>
              <span>{feedError}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => fetchPosts()}
              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-serif font-bold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>{language === 'ar' ? 'إعادة المحاولة' : 'Retry'}</span>
            </button>
            <button
              onClick={() => setFeedError(null)}
              className="p-1.5 hover:bg-amber-200 dark:hover:bg-amber-900 rounded-xl transition-colors shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4 text-amber-700 dark:text-amber-300" />
            </button>
          </div>
        </div>
      )}

      {/* Liturgical Banner */}
      <LiturgicalBanner onOpenCalendar={onOpenCalendar} />

      {/* Stories Bar */}
      <StoriesBar onSelectUser={onSelectUser} />

      {/* Post Creation Box */}
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
              >
                <Image className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              </button>
              <button
                type="button"
                onClick={() => setShowVideoUrlInput((prev) => !prev)}
                className="p-1 rounded-lg text-[#7c5f3d] hover:text-[#3d2b18] hover:bg-[#c5a059]/20 transition-colors shrink-0 cursor-pointer"
              >
                <Video className="w-4 h-4 text-[#a8833c]" />
              </button>
            </div>
          </div>

          {/* Link / Video Input Drawer */}
          {showVideoUrlInput && (
            <div className="p-3 bg-[#eedcb5]/60 dark:bg-[#282019]/70 border border-[#c5a059]/50 rounded-2xl space-y-2">
              <div className="flex items-center gap-2">
                <Link2 className="w-4 h-4 text-[#a8833c] shrink-0" />
                <input
                  type="url"
                  placeholder={language === 'ar' ? 'ضع رابط يوتيوب أو فيديو مباشر...' : 'Paste YouTube, Vimeo, or video URL...'}
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  className="w-full bg-[#f6ebd6] dark:bg-[#1c1611] text-xs px-3 py-1.5 rounded-xl border border-[#c5a059]/40 text-[#3d2b18] dark:text-[#f5ebd9] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => videoFileInputRef.current?.click()}
                  className="px-2.5 py-1.5 bg-[#3d2b18] text-[#c5a059] border border-[#c5a059] rounded-xl text-[10px] font-serif uppercase tracking-wider shrink-0 hover:bg-[#282019] flex items-center gap-1"
                >
                  <Upload className="w-3 h-3" />
                  <span>{language === 'ar' ? 'رفع ملف' : 'File'}</span>
                </button>
              </div>
            </div>
          )}

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

          {/* Image Preview */}
          {imageUrl && (
            <div className="relative rounded-2xl overflow-hidden border-2 border-[#c5a059] bg-[#3d2b18]/10 p-1">
              <div className="relative max-h-80 overflow-hidden rounded-xl bg-black/20 flex items-center justify-center">
                <img
                  src={imageUrl}
                  alt="Selected photo preview"
                  className="w-full h-auto max-h-80 object-cover rounded-xl"
                />
                <div className="absolute top-2 right-2 rtl:right-auto rtl:left-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setImageUrl('')}
                    className="p-1.5 rounded-full bg-[#3d2b18]/90 text-[#f5ebd9] hover:bg-red-700 hover:text-white transition-all shadow-md cursor-pointer border border-[#c5a059]/50"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Video Preview (Embed or Direct File) */}
          {videoUrl && (
            <div className="relative rounded-2xl overflow-hidden border-2 border-[#c5a059] bg-[#3d2b18]/10 p-1">
              <div className="relative aspect-video rounded-xl bg-black overflow-hidden flex items-center justify-center">
                {parsedPreviewEmbed?.type === 'youtube' || parsedPreviewEmbed?.type === 'vimeo' ? (
                  <iframe
                    src={parsedPreviewEmbed.embedUrl}
                    title="Video Preview"
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <video
                    src={videoUrl}
                    controls
                    playsInline
                    autoPlay={false}
                    muted={true}
                    className="w-full h-full object-contain bg-black"
                  />
                )}
                <div className="absolute top-2 right-2 rtl:right-auto rtl:left-2 z-10 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setVideoUrl('');
                      setSelectedVideoFile(null);
                      setVideoFileName('');
                    }}
                    className="p-1.5 rounded-full bg-[#3d2b18]/90 text-[#f5ebd9] hover:bg-red-700 hover:text-white transition-all shadow-md cursor-pointer border border-[#c5a059]/50"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
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
                  {imageUrl ? (language === 'ar' ? 'تم إرفاق صورة' : 'Photo Attached') : (language === 'ar' ? 'صورة' : 'Photo')}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setShowVideoUrlInput((prev) => !prev)}
                className="p-2 rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer text-[#7c5f3d] hover:text-[#3d2b18] hover:bg-[#eedcb5] dark:hover:bg-[#282019]"
              >
                <Video className="w-4 h-4 text-[#a8833c]" />
                <span className="hidden sm:inline font-serif uppercase tracking-wider text-[11px]">
                  {videoUrl || selectedVideoFile ? (language === 'ar' ? 'تم إرفاق فيديو' : 'Video Attached') : (language === 'ar' ? 'فيديو / رابط' : 'Video / Link')}
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
                  <span>{submitStatusText || (language === 'ar' ? 'جارٍ النشر...' : 'Publishing...')}</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5 rtl:rotate-180" />
                  <span>{t('post')}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Feed Filter Mode Switcher */}
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

      {/* Posts List */}
      <div className="space-y-4">
        {loading && posts.length === 0 ? (
          <div className="p-8 text-center bg-[#f6ebd6] dark:bg-[#1c1611] rounded-3xl border-2 border-[#c5a059]">
            <Sparkles className="w-8 h-8 mx-auto text-[#a8833c] animate-spin mb-2" />
            <p className="text-xs text-[#7c5f3d] font-serif uppercase tracking-wider">
              {language === 'ar' ? 'جارٍ تحميل خلاصة الرعية...' : 'Loading parish feed...'}
            </p>
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="p-8 text-center bg-[#f6ebd6] dark:bg-[#1c1611] rounded-3xl border-2 border-[#c5a059] text-[#7c5f3d] text-xs font-serif uppercase space-y-3 shadow-md">
            <Church className="w-8 h-8 mx-auto text-[#a8833c]" />
            <p className="font-bold text-[#3d2b18] dark:text-[#f5ebd9] text-sm">
              {feedTab === 'following'
                ? (language === 'ar'
                    ? 'أنت لا تتابع أي شخص لديه منشورات نشطة بعد.'
                    : "You aren't following anyone with active posts yet.")
                : (language === 'ar'
                    ? 'لا توجد منشورات في خلاصة الرعية.'
                    : 'No posts found in the parish feed.')}
            </p>
          </div>
        ) : (
          <>
            {filteredPosts.map((post) => (
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
                onToggleComments={() => handleToggleComments(post.id)}
                onAddComment={handleAddComment}
                onDeleteComment={handleDeleteComment}
              />
            ))}

            {/* Load More Button Container */}
            {feedTab === 'all' && (
              <div className="flex justify-center pt-4 pb-8">
                {hasMore ? (
                  <button
                    type="button"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="px-6 py-3 rounded-2xl bg-[#3d2b18] hover:bg-[#282019] text-[#c5a059] border-2 border-[#c5a059] font-serif font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg transition-all cursor-pointer disabled:opacity-50"
                  >
                    {loadingMore ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-[#c5a059]" />
                        <span>{language === 'ar' ? 'جارٍ تحميل منشورات سابقة...' : 'Loading older posts...'}</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-[#c5a059]" />
                        <span>{language === 'ar' ? 'تحميل المنشورات السابقة' : 'Load Older Posts'}</span>
                      </>
                    )}
                  </button>
                ) : (
                  <div className="text-center py-4 text-xs font-serif text-[#7c5f3d] dark:text-[#a89379] italic">
                    {language === 'ar' ? 'وصلت إلى بداية المنشورات' : 'You have viewed all reflections.'}
                  </div>
                )}
              </div>
            )}
          </>
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
