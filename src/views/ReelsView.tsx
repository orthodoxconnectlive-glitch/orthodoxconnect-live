import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  Upload,
} from 'lucide-react';
import { Post } from '../types';
import { loadPosts, deletePost, savePost } from '../utils/posts';
import { uploadVideoToBunnyStream } from '../utils/storage';
import { ReelCard, ReelComment } from '../components/ReelCard';
import { useAuth } from '../context/AuthContext';
import { UserProfileData } from './ProfileView';

interface ReelsViewProps {
  onSelectUser?: (userData: UserProfileData) => void;
  onOpenMessengerWithUser?: (contactId?: string) => void;
}

export const ReelsView: React.FC<ReelsViewProps> = ({ onSelectUser, onOpenMessengerWithUser }) => {
  const { profile } = useAuth();
  const [reels, setReels] = useState<Post[]>([]);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  // Social interactions state
  const [followedAuthors, setFollowedAuthors] = useState<Record<string, boolean>>({});
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [savedMap, setSavedMap] = useState<Record<string, boolean>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Comments drawer state
  const [openCommentReelId, setOpenCommentReelId] = useState<string | null>(null);
  const [reelCommentsMap, setReelCommentsMap] = useState<Record<string, ReelComment[]>>({});

  // Touch and wheel interaction refs for gesture navigation
  const touchStartY = useRef<number>(0);
  const isNavigatingRef = useRef<boolean>(false);

  // Total Tab Isolation & Strict Unmount Cleanup
  useEffect(() => {
    return () => {
      const allMedia = document.querySelectorAll<HTMLMediaElement>('video, audio');
      allMedia.forEach((m) => {
        try {
          m.pause();
          m.currentTime = 0;
          m.src = '';
        } catch (e) {
          // ignore
        }
      });
    };
  }, []);

  // Fetch videos from unified storage feed
  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchVideos = async () => {
    setLoading(true);

    const { posts } = await loadPosts();
    const videoReels = posts.filter((p) => !!p.video || (p.image && p.image.endsWith('.mp4')));

    const finalReels = videoReels.length > 0 ? videoReels : [
      {
        id: 'fallback-reel-1',
        text: 'Orthodox Spiritual Reflection ☨',
        authorName: 'OrthodoxConnect',
        authorParish: 'Parish Fellowship',
        authorAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
        video: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        image: 'https://images.unsplash.com/photo-1548625361-1959779df5ff?auto=format&fit=crop&q=80&w=800',
        createdAt: new Date().toISOString(),
        likesCount: 25,
        commentsCount: 2,
        resharesCount: 0,
      }
    ];

    setReels(finalReels);
    setActiveIndex(0);

    let savedLikes: Record<string, boolean> = {};
    let savedComments: Record<string, ReelComment[]> = {};
    try {
      const rawLikes = localStorage.getItem('orthodox_reels_liked_map');
      if (rawLikes) savedLikes = JSON.parse(rawLikes);
      const rawComments = localStorage.getItem('orthodox_reels_comments_map');
      if (rawComments) savedComments = JSON.parse(rawComments);
    } catch (e) {
      console.warn('Videos cache read error:', e);
    }

    setLikedMap(savedLikes);

    const initialLikesCount: Record<string, number> = {};
    const initialComments: Record<string, ReelComment[]> = {};

    finalReels.forEach((reel) => {
      const baseLikes = reel.likesCount || 0;
      initialLikesCount[reel.id] = savedLikes[reel.id] ? baseLikes + 1 : baseLikes;
      initialComments[reel.id] = savedComments[reel.id] || [];
    });

    setLikeCounts(initialLikesCount);
    setReelCommentsMap(initialComments);
    setLoading(false);
  };

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleVideoUploadSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      triggerToast('Please select a valid video file.');
      return;
    }
    try {
      setIsUploading(true);
      triggerToast('Uploading video directly to Bunny Stream CDN...');
      const iframeUrl = await uploadVideoToBunnyStream(file, file.name);

      const newPost = await savePost({
        text: file.name.replace(/\.[^/.]+$/, ''),
        authorName: profile?.full_name || 'Orthodox Parishioner',
        authorParish: profile?.parish || 'Orthodox Church',
        authorAvatar:
          profile?.avatar_url ||
          'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
        authorId: profile?.id,
        video: iframeUrl,
      });

      setReels((prev) => [newPost, ...prev]);
      setActiveIndex(0);
      triggerToast('New video successfully uploaded!');
    } catch (err) {
      console.error('Video upload error:', err);
      triggerToast('Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const navigateToVideo = useCallback(
    (newIndex: number) => {
      if (newIndex >= 0 && newIndex < reels.length) {
        const allMedia = document.querySelectorAll<HTMLMediaElement>('video, audio');
        allMedia.forEach((m) => {
          try {
            m.pause();
            m.currentTime = 0;
          } catch (e) {}
        });
        setOpenCommentReelId(null);
        setActiveIndex(newIndex);
      }
    },
    [reels.length]
  );

  const handleNextVideo = useCallback(() => {
    if (activeIndex < reels.length - 1) {
      navigateToVideo(activeIndex + 1);
    }
  }, [activeIndex, reels.length, navigateToVideo]);

  const handlePrevVideo = useCallback(() => {
    if (activeIndex > 0) {
      navigateToVideo(activeIndex - 1);
    }
  }, [activeIndex, navigateToVideo]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (openCommentReelId) return;
      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault();
        handleNextVideo();
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        handlePrevVideo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNextVideo, handlePrevVideo, openCommentReelId]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (openCommentReelId) return;
    const touchEndY = e.changedTouches[0].clientY;
    const diff = touchStartY.current - touchEndY;
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        handleNextVideo();
      } else {
        handlePrevVideo();
      }
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (openCommentReelId) return;
    if (isNavigatingRef.current) return;
    if (Math.abs(e.deltaY) > 40) {
      isNavigatingRef.current = true;
      if (e.deltaY > 0) {
        handleNextVideo();
      } else {
        handlePrevVideo();
      }
      setTimeout(() => {
        isNavigatingRef.current = false;
      }, 500);
    }
  };

  const handleToggleLike = (reelId: string) => {
    setLikedMap((prev) => {
      const isCurrentlyLiked = !!prev[reelId];
      const nextState = !isCurrentlyLiked;
      const updated = { ...prev, [reelId]: nextState };
      try {
        localStorage.setItem('orthodox_reels_liked_map', JSON.stringify(updated));
      } catch (e) {
        console.warn('Videos likes save error:', e);
      }
      setLikeCounts((cPrev) => ({
        ...cPrev,
        [reelId]: (cPrev[reelId] || 0) + (nextState ? 1 : -1),
      }));
      return updated;
    });
  };

  const handleToggleFollow = (authorName: string) => {
    setFollowedAuthors((prev) => {
      const nextVal = !prev[authorName];
      triggerToast(nextVal ? `Now following ${authorName}` : `Unfollowed ${authorName}`);
      return { ...prev, [authorName]: nextVal };
    });
  };

  const handleToggleSave = (reelId: string) => {
    setSavedMap((prev) => {
      const nextVal = !prev[reelId];
      triggerToast(nextVal ? 'Saved video to bookmarks' : 'Removed from saved');
      return { ...prev, [reelId]: nextVal };
    });
  };

  const handleDeleteVideo = async (reelId: string) => {
    if (window.confirm('Are you sure you want to delete this video?')) {
      await deletePost(reelId);
      const nextReels = reels.filter((r) => r.id !== reelId);
      setReels(nextReels);
      if (activeIndex >= nextReels.length) {
        setActiveIndex(Math.max(0, nextReels.length - 1));
      }
      triggerToast('Video deleted successfully.');
    }
  };

  const handleShare = (reel: Post) => {
    const url = `https://orthodoxconnect.live/videos/${reel.id}`;
    navigator.clipboard.writeText(url);
    triggerToast('Video link copied to clipboard!');
  };

  const handleAddComment = (reelId: string, text: string) => {
    const newComment: ReelComment = {
      id: `comment-${Date.now()}`,
      authorName: profile?.full_name || 'Orthodox Parishioner',
      authorAvatar:
        profile?.avatar_url ||
        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
      text,
      createdAt: 'Just now',
    };

    setReelCommentsMap((prev) => {
      const updated = {
        ...prev,
        [reelId]: [newComment, ...(prev[reelId] || [])],
      };
      try {
        localStorage.setItem('orthodox_reels_comments_map', JSON.stringify(updated));
      } catch (e) {
        console.warn('Videos comments save error:', e);
      }
      return updated;
    });
  };

  if (loading) {
    return (
      <div className="min-h-[550px] flex flex-col items-center justify-center p-8 bg-[#1c1611] rounded-3xl border-2 border-[#c5a059]">
        <Sparkles className="w-10 h-10 text-[#c5a059] animate-spin mb-3" />
        <span className="text-xs text-[#f5ebd9] font-serif uppercase tracking-wider font-bold">
          Loading Videos...
        </span>
      </div>
    );
  }

  if (reels.length === 0) {
    return (
      <div className="p-8 text-center bg-[#1c1611] rounded-3xl border-2 border-[#c5a059] text-[#f5ebd9] text-xs font-serif uppercase">
        No videos available.
      </div>
    );
  }

  const currentReel = reels[activeIndex];
  if (!currentReel) return null;

  const isLiked = !!likedMap[currentReel.id];
  const isSaved = !!savedMap[currentReel.id];
  const isFollowed = !!followedAuthors[currentReel.authorName];
  const activeComments = reelCommentsMap[currentReel.id] || [];
  const isCommentOpen = openCommentReelId === currentReel.id;

  return (
    <div
      className="max-w-md mx-auto space-y-3 relative h-[calc(100dvh-5.5rem)] flex flex-col justify-center select-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-[#1c1611]/95 border-2 border-[#c5a059] text-[#f5ebd9] text-xs font-serif uppercase tracking-wider font-bold shadow-2xl animate-fade-in flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-[#c5a059]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header Controls Bar */}
      <div className="flex items-center justify-between p-3 rounded-2xl bg-[#1c1611] border-2 border-[#c5a059] shadow-lg text-xs shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-[#3d2b18] text-[#c5a059] font-bold flex items-center justify-center text-xs">
            ☨
          </div>
          <h2 className="font-serif-coptic font-bold text-[#f5ebd9] uppercase tracking-wider">
            Videos Feed
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#c5a059] hover:bg-[#a8833c] text-[#1c1611] font-serif font-bold text-[11px] uppercase tracking-wider cursor-pointer shadow-md transition-colors">
            <Upload className="w-3.5 h-3.5" />
            <span>{isUploading ? 'Uploading...' : 'Upload Video'}</span>
            <input
              type="file"
              accept="video/*"
              disabled={isUploading}
              onChange={handleVideoUploadSelect}
              className="hidden"
            />
          </label>
          <span className="text-[11px] font-serif font-bold text-[#c5a059] bg-[#282019] px-3 py-1 rounded-full border border-[#c5a059]">
            {activeIndex + 1} / {reels.length}
          </span>
        </div>
      </div>

      {/* Single Active Video Container */}
      <div className="w-full relative flex-1 min-h-0 flex items-center justify-center">
        <ReelCard
          key={currentReel.id}
          reel={currentReel}
          onSelectUser={onSelectUser}
          onOpenMessengerWithUser={onOpenMessengerWithUser}
          liked={isLiked}
          likeCount={likeCounts[currentReel.id] || 0}
          onToggleLike={handleToggleLike}
          saved={isSaved}
          onToggleSave={handleToggleSave}
          isFollowed={isFollowed}
          onToggleFollow={handleToggleFollow}
          onDeleteReel={handleDeleteVideo}
          comments={activeComments}
          isCommentOpen={isCommentOpen}
          onToggleCommentOpen={(id) => setOpenCommentReelId(openCommentReelId === id ? null : id)}
          onAddComment={handleAddComment}
          onShare={handleShare}
        />
      </div>

      {/* Navigation Controls */}
      <div className="flex items-center justify-between p-3 rounded-2xl bg-[#1c1611] border-2 border-[#c5a059] shadow-lg shrink-0">
        <button
          type="button"
          onClick={handlePrevVideo}
          disabled={activeIndex <= 0}
          className="px-4 py-2 rounded-xl bg-[#282019] hover:bg-[#c5a059] text-[#f5ebd9] hover:text-[#1c1611] text-xs font-serif uppercase tracking-wider font-bold flex items-center gap-1.5 disabled:opacity-30 cursor-pointer transition-all border border-[#c5a059]"
        >
          <ChevronUp className="w-4 h-4" /> Previous Video
        </button>

        <span className="text-[10px] text-[#c5a059] font-serif uppercase tracking-wider hidden sm:inline">
          Swipe, wheel, or use ↑/↓ keys
        </span>

        <button
          type="button"
          onClick={handleNextVideo}
          disabled={activeIndex >= reels.length - 1}
          className="px-4 py-2 rounded-xl bg-[#c5a059] hover:bg-[#a8833c] text-[#1c1611] text-xs font-serif uppercase tracking-wider font-bold flex items-center gap-1.5 disabled:opacity-30 cursor-pointer transition-all shadow-md"
        >
          Next Video <ChevronDown className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
