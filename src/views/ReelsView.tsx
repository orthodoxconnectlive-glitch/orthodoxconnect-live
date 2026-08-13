import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  Volume2,
  VolumeX,
  Upload,
} from 'lucide-react';
import { Post } from '../types';
import { loadReels, deletePost, savePost } from '../utils/posts';
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
  const [activeReelId, setActiveReelId] = useState<string>('');
  const [unmutedReelId, setUnmutedReelId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  // TikTok interactions state
  const [followedAuthors, setFollowedAuthors] = useState<Record<string, boolean>>({});
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [savedMap, setSavedMap] = useState<Record<string, boolean>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Comments drawer state
  const [openCommentReelId, setOpenCommentReelId] = useState<string | null>(null);
  const [reelCommentsMap, setReelCommentsMap] = useState<Record<string, ReelComment[]>>({});

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Requirement 4: Cleanup effect to stop and reset all media on unmount
  useEffect(() => {
    return () => {
      const allMedia = document.querySelectorAll<HTMLMediaElement>('video, audio');
      allMedia.forEach((media) => {
        try {
          media.pause();
          media.currentTime = 0;
        } catch (err) {
          console.warn('Error pausing media on unmount:', err);
        }
      });
    };
  }, []);

  useEffect(() => {
    fetchReels();
  }, []);

  const fetchReels = async () => {
    setLoading(true);
    const loadedReels = await loadReels();
    setReels(loadedReels);

    if (loadedReels.length > 0) {
      setActiveReelId(loadedReels[0].id);
    }

    // Load saved likes and comments from localStorage
    let savedLikes: Record<string, boolean> = {};
    let savedComments: Record<string, ReelComment[]> = {};
    try {
      const rawLikes = localStorage.getItem('orthodox_reels_liked_map');
      if (rawLikes) savedLikes = JSON.parse(rawLikes);
      const rawComments = localStorage.getItem('orthodox_reels_comments_map');
      if (rawComments) savedComments = JSON.parse(rawComments);
    } catch (e) {
      console.warn('Reels cache read error:', e);
    }

    setLikedMap(savedLikes);

    const initialLikesCount: Record<string, number> = {};
    const initialComments: Record<string, ReelComment[]> = {};

    loadedReels.forEach((reel) => {
      const baseLikes = reel.likesCount || 0;
      initialLikesCount[reel.id] = savedLikes[reel.id] ? baseLikes + 1 : baseLikes;
      initialComments[reel.id] = savedComments[reel.id] || [];
    });

    setLikeCounts(initialLikesCount);
    setReelCommentsMap(initialComments);
    setLoading(false);
  };

  // Requirement 3: Global Sound Control (only ONE unmuted video at a time)
  const handleToggleMuteReel = (reelId: string) => {
    if (unmutedReelId === reelId) {
      // Mute this reel
      setUnmutedReelId(null);
      const allMedia = document.querySelectorAll<HTMLMediaElement>('video, audio');
      allMedia.forEach((m) => {
        m.muted = true;
      });
    } else {
      // Unmute this reel and automatically mute all other media
      setUnmutedReelId(reelId);
      const allMedia = document.querySelectorAll<HTMLMediaElement>('video, audio');
      allMedia.forEach((m) => {
        const parentCard = m.closest(`#reel-item-${reelId}`);
        if (parentCard) {
          m.muted = false;
        } else {
          m.muted = true;
        }
      });
    }
  };

  const handleToggleGlobalMute = () => {
    if (unmutedReelId) {
      setUnmutedReelId(null);
      const allMedia = document.querySelectorAll<HTMLMediaElement>('video, audio');
      allMedia.forEach((m) => {
        m.muted = true;
      });
    } else if (activeReelId) {
      handleToggleMuteReel(activeReelId);
    } else if (reels[0]) {
      handleToggleMuteReel(reels[0].id);
    }
  };

  const handleVisibleChange = (reelId: string, isVisible: boolean) => {
    if (isVisible) {
      setActiveReelId(reelId);
    }
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
      triggerToast('Uploading reel directly to Bunny Stream CDN...');
      const iframeUrl = await uploadVideoToBunnyStream(file, file.name);

      const newReel = await savePost({
        text: file.name.replace(/\.[^/.]+$/, ''),
        authorName: profile?.full_name || 'Orthodox Parishioner',
        authorParish: profile?.parish || 'Orthodox Church',
        authorAvatar:
          profile?.avatar_url ||
          'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
        authorId: profile?.id,
        video: iframeUrl,
      });

      setReels((prev) => [newReel, ...prev]);
      setActiveReelId(newReel.id);
      triggerToast('New Orthodox Reel uploaded via Bunny Stream!');
    } catch (err) {
      console.error('Reel upload error:', err);
      triggerToast('Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const scrollToReelIndex = (index: number) => {
    if (index >= 0 && index < reels.length) {
      const targetReel = reels[index];
      const el = document.getElementById(`reel-item-${targetReel.id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setActiveReelId(targetReel.id);
      }
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
        console.warn('Reels likes save error:', e);
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
      triggerToast(nextVal ? 'Saved reel to bookmarks' : 'Removed from saved');
      return { ...prev, [reelId]: nextVal };
    });
  };

  const handleDeleteReel = async (reelId: string) => {
    if (window.confirm('Are you sure you want to delete this reel?')) {
      await deletePost(reelId);
      setReels((prev) => prev.filter((r) => r.id !== reelId));
      triggerToast('Reel deleted successfully.');
    }
  };

  const handleShare = (reel: Post) => {
    const url = `https://orthodoxconnect.live/reels/${reel.id}`;
    navigator.clipboard.writeText(url);
    triggerToast('Reel link copied to clipboard!');
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
        console.warn('Reels comments save error:', e);
      }
      return updated;
    });
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (openCommentReelId) return;

      const activeIndex = reels.findIndex((r) => r.id === activeReelId);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (activeIndex < reels.length - 1) {
          scrollToReelIndex(activeIndex + 1);
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (activeIndex > 0) {
          scrollToReelIndex(activeIndex - 1);
        }
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        handleToggleGlobalMute();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeReelId, reels, openCommentReelId, unmutedReelId]);

  if (loading) {
    return (
      <div className="min-h-[550px] flex flex-col items-center justify-center p-8 bg-[#1c1611] rounded-3xl border-2 border-[#c5a059]">
        <Sparkles className="w-10 h-10 text-[#c5a059] animate-spin mb-3" />
        <span className="text-xs text-[#f5ebd9] font-serif uppercase tracking-wider font-bold">
          Loading Orthodox Reels Feed...
        </span>
      </div>
    );
  }

  if (reels.length === 0) {
    return (
      <div className="p-8 text-center bg-[#1c1611] rounded-3xl border-2 border-[#c5a059] text-[#f5ebd9] text-xs font-serif uppercase">
        No video reels available.
      </div>
    );
  }

  const activeIndex = Math.max(0, reels.findIndex((r) => r.id === activeReelId));

  return (
    <div className="max-w-md mx-auto space-y-3 relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-[#1c1611]/95 border-2 border-[#c5a059] text-[#f5ebd9] text-xs font-serif uppercase tracking-wider font-bold shadow-2xl animate-fade-in flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-[#c5a059]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header Controls Bar */}
      <div className="flex items-center justify-between p-3 rounded-2xl bg-[#1c1611] border-2 border-[#c5a059] shadow-lg text-xs">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-[#3d2b18] text-[#c5a059] font-bold flex items-center justify-center text-xs">
            ☨
          </div>
          <h2 className="font-serif-coptic font-bold text-[#f5ebd9] uppercase tracking-wider">
            Orthodox Reels
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#c5a059] hover:bg-[#a8833c] text-[#1c1611] font-serif font-bold text-[11px] uppercase tracking-wider cursor-pointer shadow-md transition-colors">
            <Upload className="w-3.5 h-3.5" />
            <span>{isUploading ? 'Uploading...' : 'Upload Reel'}</span>
            <input
              type="file"
              accept="video/*"
              disabled={isUploading}
              onChange={handleVideoUploadSelect}
              className="hidden"
            />
          </label>
          <button
            onClick={handleToggleGlobalMute}
            className="p-1.5 rounded-xl bg-[#282019] border border-[#c5a059] text-[#f5ebd9] hover:bg-[#c5a059] hover:text-white transition-colors cursor-pointer"
            title={unmutedReelId ? 'Mute audio' : 'Unmute audio'}
          >
            {unmutedReelId ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4" />}
          </button>
          <span className="text-[10px] font-serif font-bold text-[#c5a059] bg-[#282019] px-2.5 py-1 rounded-full border border-[#c5a059]">
            {activeIndex + 1} / {reels.length}
          </span>
        </div>
      </div>

      {/* Continuous Vertical Snap Scrollable Reels Feed Container */}
      <div
        ref={scrollContainerRef}
        className="h-screen w-full overflow-y-scroll snap-y snap-mandatory scroll-smooth no-scrollbar pr-1 pb-24 space-y-4"
      >
        {reels.map((reel) => {
          const isUnmuted = unmutedReelId === reel.id;
          const isLiked = !!likedMap[reel.id];
          const isSaved = !!savedMap[reel.id];
          const isFollowed = !!followedAuthors[reel.authorName];
          const activeComments = reelCommentsMap[reel.id] || [];
          const isCommentOpen = openCommentReelId === reel.id;

          return (
            <ReelCard
              key={reel.id}
              reel={reel}
              isUnmuted={isUnmuted}
              onToggleMute={handleToggleMuteReel}
              onSelectUser={onSelectUser}
              onOpenMessengerWithUser={onOpenMessengerWithUser}
              liked={isLiked}
              likeCount={likeCounts[reel.id] || 0}
              onToggleLike={handleToggleLike}
              saved={isSaved}
              onToggleSave={handleToggleSave}
              isFollowed={isFollowed}
              onToggleFollow={handleToggleFollow}
              onDeleteReel={handleDeleteReel}
              comments={activeComments}
              isCommentOpen={isCommentOpen}
              onToggleCommentOpen={(id) => setOpenCommentReelId(openCommentReelId === id ? null : id)}
              onAddComment={handleAddComment}
              onShare={handleShare}
              onVisibleChange={handleVisibleChange}
            />
          );
        })}
      </div>

      {/* Reel Up/Down Floating Nav Buttons */}
      <div className="flex items-center justify-between p-3 rounded-2xl bg-[#1c1611] border-2 border-[#c5a059] shadow-lg">
        <button
          onClick={() => scrollToReelIndex(activeIndex - 1)}
          disabled={activeIndex <= 0}
          className="px-4 py-2 rounded-xl bg-[#282019] hover:bg-[#c5a059] text-[#f5ebd9] hover:text-white text-xs font-serif uppercase tracking-wider font-bold flex items-center gap-1.5 disabled:opacity-30 cursor-pointer transition-all border border-[#c5a059]"
        >
          <ChevronUp className="w-4 h-4" /> Previous Reel
        </button>

        <span className="text-[10px] text-[#c5a059] font-serif uppercase tracking-wider hidden sm:inline">
          Scroll or use ↑/↓ keys
        </span>

        <button
          onClick={() => scrollToReelIndex(activeIndex + 1)}
          disabled={activeIndex >= reels.length - 1}
          className="px-4 py-2 rounded-xl bg-[#c5a059] hover:bg-[#a8833c] text-white text-xs font-serif uppercase tracking-wider font-bold flex items-center gap-1.5 disabled:opacity-30 cursor-pointer transition-all shadow-md"
        >
          Next Reel <ChevronDown className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
