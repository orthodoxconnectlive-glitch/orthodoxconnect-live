import React, { useState, useEffect, useRef } from 'react';
import {
  Film,
  Heart,
  MessageCircle,
  MessageSquare,
  Share2,
  Bookmark,
  Volume2,
  VolumeX,
  Church,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Plus,
  Check,
  Music,
  X,
  Send,
  Play,
  Trash2,
  Upload,
} from 'lucide-react';
import { Post } from '../types';
import { loadReels, deletePost, savePost } from '../utils/posts';
import { uploadVideoToBunnyStream } from '../utils/storage';
import { BunnyPlayer } from '../components/BunnyPlayer';
import { useAuth } from '../context/AuthContext';

import { UserProfileData } from './ProfileView';

interface ReelComment {
  id: string;
  authorName: string;
  authorAvatar: string;
  text: string;
  createdAt: string;
}

interface ReelsViewProps {
  onSelectUser?: (userData: UserProfileData) => void;
  onOpenMessengerWithUser?: (contactId?: string) => void;
}

export const ReelsView: React.FC<ReelsViewProps> = ({ onSelectUser, onOpenMessengerWithUser }) => {
  const { profile } = useAuth();
  const [reels, setReels] = useState<Post[]>([]);
  const [activeReelId, setActiveReelId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);

  // TikTok interactions state
  const [followedAuthors, setFollowedAuthors] = useState<Record<string, boolean>>({});
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [savedMap, setSavedMap] = useState<Record<string, boolean>>({});
  const [showHeartAnim, setShowHeartAnim] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Comments drawer state
  const [openCommentReelId, setOpenCommentReelId] = useState<string | null>(null);
  const [reelCommentsMap, setReelCommentsMap] = useState<Record<string, ReelComment[]>>({});
  const [newCommentText, setNewCommentText] = useState('');
  const [isUploading, setIsUploading] = useState(false);

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
        authorAvatar: profile?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
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

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchReels();
  }, []);

  // Intersection Observer to detect which reel is currently in view during scrolling
  useEffect(() => {
    if (reels.length === 0) return;

    if (!activeReelId && reels[0]) {
      setActiveReelId(reels[0].id);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            const id = entry.target.getAttribute('data-reel-id');
            if (id) {
              setActiveReelId(id);
              setIsPlaying(true);
            }
          }
        });
      },
      { threshold: 0.5 }
    );

    const elements = document.querySelectorAll('.reel-snap-item');
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [reels]);

  // Keyboard Up/Down navigation
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
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeReelId, reels, openCommentReelId]);

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

    // Initialize counts and default mock comments
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

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const scrollToReelIndex = (index: number) => {
    if (index >= 0 && index < reels.length) {
      const targetReel = reels[index];
      const el = document.getElementById(`reel-item-${targetReel.id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setActiveReelId(targetReel.id);
        setIsPlaying(true);
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

  const handleDoubleTapVideo = (reelId: string) => {
    if (!likedMap[reelId]) {
      handleToggleLike(reelId);
    }
    setShowHeartAnim(reelId);
    setTimeout(() => setShowHeartAnim(null), 800);
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

  const handleAddComment = (e: React.FormEvent, reelId: string) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;

    const newComment: ReelComment = {
      id: `comment-${Date.now()}`,
      authorName: profile?.full_name || 'Orthodox Parishioner',
      authorAvatar: profile?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
      text: newCommentText.trim(),
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

    setNewCommentText('');
  };

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
            onClick={() => setIsMuted(!isMuted)}
            className="p-1.5 rounded-xl bg-[#282019] border border-[#c5a059] text-[#f5ebd9] hover:bg-[#c5a059] hover:text-white transition-colors cursor-pointer"
            title={isMuted ? 'Unmute audio' : 'Mute audio'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <span className="text-[10px] font-serif font-bold text-[#c5a059] bg-[#282019] px-2.5 py-1 rounded-full border border-[#c5a059]">
            {activeIndex + 1} / {reels.length}
          </span>
        </div>
      </div>

      {/* Continuous Vertical Scrollable Reels Feed Container */}
      <div
        ref={scrollContainerRef}
        className="h-[calc(100vh-10rem)] min-h-[600px] overflow-y-auto snap-y snap-mandatory scroll-smooth space-y-6 pr-1 no-scrollbar"
      >
        {reels.map((reel) => {
          const isActive = activeReelId === reel.id;
          const isLiked = !!likedMap[reel.id];
          const isSaved = !!savedMap[reel.id];
          const isFollowed = !!followedAuthors[reel.authorName];
          const activeComments = reelCommentsMap[reel.id] || [];
          const isCommentOpen = openCommentReelId === reel.id;

          return (
            <div
              key={reel.id}
              id={`reel-item-${reel.id}`}
              data-reel-id={reel.id}
              className="reel-snap-item w-full h-[calc(100vh-11rem)] min-h-[580px] max-h-[760px] snap-start snap-always shrink-0 relative rounded-3xl bg-black border-2 border-[#c5a059] overflow-hidden shadow-2xl flex flex-col justify-between group select-none"
            >
              {/* Background Video Player */}
              <div
                onClick={() => setIsPlaying(!isPlaying)}
                onDoubleClick={() => handleDoubleTapVideo(reel.id)}
                className="absolute inset-0 z-0 cursor-pointer"
              >
                {reel.video?.includes('bunnycdn.com') || reel.video?.includes('iframe.mediadelivery.net') || reel.video?.includes('mediadelivery.net') ? (
                  <BunnyPlayer
                    videoUrl={reel.video}
                    title={reel.text}
                    autoplay={isActive && isPlaying}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <video
                    src={reel.video}
                    controls
                    autoPlay={isActive && isPlaying}
                    playsInline
                    loop
                    className="w-full h-full object-cover bg-black"
                  />
                )}

                {/* Pause overlay icon */}
                {isActive && !isPlaying && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
                    <div className="w-16 h-16 rounded-full bg-[#c5a059] text-[#3d2b18] flex items-center justify-center shadow-2xl animate-pulse">
                      <Play className="w-8 h-8 fill-current ml-1" />
                    </div>
                  </div>
                )}

                {/* Double Tap Heart Animation Overlay */}
                {showHeartAnim === reel.id && (
                  <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                    <Heart className="w-24 h-24 text-red-600 fill-current animate-ping drop-shadow-2xl" />
                  </div>
                )}
              </div>

              {/* Top Floating Badge */}
              <div className="relative z-20 p-4 flex items-center justify-between pointer-events-none">
                <span className="px-3 py-1 rounded-full bg-[#1c1611]/80 backdrop-blur-md text-[#c5a059] text-[10px] font-serif uppercase tracking-wider font-bold border border-[#c5a059] flex items-center gap-1.5 shadow-md">
                  <Church className="w-3.5 h-3.5 text-[#c5a059]" />
                  {reel.authorParish}
                </span>
              </div>

              {/* Bottom Left Info & Audio Overlay */}
              <div className="relative z-20 p-4 bg-gradient-to-t from-black/95 via-black/60 to-transparent space-y-2 mt-auto">
                {/* Author Header */}
                <div className="flex items-center gap-3">
                  <div
                    className="relative cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() =>
                      onSelectUser?.({
                        id: reel.authorId,
                        name: reel.authorName,
                        avatar: reel.authorAvatar,
                        parish: reel.authorParish,
                      })
                    }
                  >
                    <img
                      src={reel.authorAvatar}
                      alt={reel.authorName}
                      className="w-10 h-10 rounded-full border-2 border-[#c5a059] object-cover shadow-lg"
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleFollow(reel.authorName);
                      }}
                      className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] shadow-md border border-black cursor-pointer transition-transform ${
                        isFollowed ? 'bg-emerald-600' : 'bg-red-600 hover:scale-110'
                      }`}
                      title={isFollowed ? 'Following' : 'Follow Creator'}
                    >
                      {isFollowed ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                    </button>
                  </div>

                  <div
                    className="cursor-pointer hover:underline"
                    onClick={() =>
                      onSelectUser?.({
                        id: reel.authorId,
                        name: reel.authorName,
                        avatar: reel.authorAvatar,
                        parish: reel.authorParish,
                      })
                    }
                  >
                    <h4 className="font-serif-coptic font-bold text-xs text-[#f5ebd9] uppercase tracking-wider leading-tight">
                      {reel.authorName}
                    </h4>
                    <p className="text-[9px] text-[#c5a059] font-serif uppercase tracking-widest">
                      @{reel.authorName.toLowerCase().replace(/[^a-z0-9]/g, '')}
                    </p>
                  </div>
                </div>

                {/* Caption & Hashtags */}
                <p className="text-xs text-[#f5ebd9] line-clamp-3 leading-relaxed font-serif pr-12">
                  {reel.text}{' '}
                  <span className="text-[#c5a059] font-bold">
                    #Orthodox #Faith #Feast #Coptic
                  </span>
                </p>

                {/* TikTok Audio Marquee Bar */}
                <div className="flex items-center gap-2 pt-1">
                  <Music className="w-3.5 h-3.5 text-[#c5a059] animate-bounce" />
                  <div className="overflow-hidden w-48 text-[10px] text-[#f5ebd9] whitespace-nowrap font-serif uppercase tracking-wider">
                    <p className="inline-block animate-marquee">
                      🎵 Coptic Hymn — Agpeya Midnight Prayer (Original Audio)
                    </p>
                  </div>
                </div>
              </div>

              {/* Floating Right Action Stack (TikTok Style) */}
              <div className="absolute right-3 bottom-12 z-30 flex flex-col items-center gap-4 text-white">
                {/* Like Button */}
                <button
                  onClick={() => handleToggleLike(reel.id)}
                  className="flex flex-col items-center gap-1 group cursor-pointer"
                >
                  <div
                    className={`p-3 rounded-full backdrop-blur-md border border-[#c5a059] transition-all ${
                      isLiked
                        ? 'bg-red-600 text-white scale-110 shadow-lg shadow-red-600/50'
                        : 'bg-[#1c1611]/80 text-[#c5a059] hover:bg-red-600/30'
                    }`}
                  >
                    <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
                  </div>
                  <span className="text-[10px] font-bold text-[#f5ebd9] shadow-sm font-serif">
                    {likeCounts[reel.id] || 0}
                  </span>
                </button>

                {/* Comment Drawer Button */}
                <button
                  onClick={() => setOpenCommentReelId(isCommentOpen ? null : reel.id)}
                  className="flex flex-col items-center gap-1 group cursor-pointer"
                >
                  <div className="p-3 rounded-full bg-[#1c1611]/80 backdrop-blur-md border border-[#c5a059] text-[#c5a059] hover:bg-[#c5a059] hover:text-[#3d2b18] transition-all">
                    <MessageCircle className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold text-[#f5ebd9] shadow-sm font-serif">
                    {activeComments.length}
                  </span>
                </button>

                {/* Direct Message 1-on-1 Button */}
                {onOpenMessengerWithUser && (
                  <button
                    onClick={() => onOpenMessengerWithUser(reel.authorId || reel.authorName)}
                    className="flex flex-col items-center gap-1 group cursor-pointer"
                    title="Send Direct 1-to-1 Message"
                  >
                    <div className="p-3 rounded-full bg-[#1c1611]/80 backdrop-blur-md border border-[#c5a059] text-[#c5a059] hover:bg-[#c5a059] hover:text-[#3d2b18] transition-all">
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <span className="text-[9px] font-bold text-[#f5ebd9] shadow-sm font-serif uppercase">Chat</span>
                  </button>
                )}

                {/* Save / Bookmark Button */}
                <button
                  onClick={() => handleToggleSave(reel.id)}
                  className="flex flex-col items-center gap-1 group cursor-pointer"
                >
                  <div
                    className={`p-3 rounded-full backdrop-blur-md border border-[#c5a059] transition-all ${
                      isSaved
                        ? 'bg-[#c5a059] text-[#3d2b18] font-bold scale-110'
                        : 'bg-[#1c1611]/80 text-[#c5a059] hover:bg-[#c5a059]/30'
                    }`}
                  >
                    <Bookmark className={`w-5 h-5 ${isSaved ? 'fill-current' : ''}`} />
                  </div>
                  <span className="text-[9px] font-bold text-[#f5ebd9] shadow-sm font-serif uppercase">Save</span>
                </button>

                {/* Share Button */}
                <button
                  onClick={() => handleShare(reel)}
                  className="flex flex-col items-center gap-1 group cursor-pointer"
                >
                  <div className="p-3 rounded-full bg-[#1c1611]/80 backdrop-blur-md border border-[#c5a059] text-[#c5a059] hover:bg-[#c5a059] hover:text-[#3d2b18] transition-all">
                    <Share2 className="w-5 h-5" />
                  </div>
                  <span className="text-[9px] font-bold text-[#f5ebd9] shadow-sm font-serif uppercase">Share</span>
                </button>

                {/* Delete Reel Button for Admins or Author */}
                {(profile?.id === reel.authorId || profile?.role === 'admin' || profile?.role === 'owner' || profile?.role === 'super_admin' || profile?.email === 'orthodoxconnect.live@gmail.com') && (
                  <button
                    onClick={() => handleDeleteReel(reel.id)}
                    className="flex flex-col items-center gap-1 group cursor-pointer"
                    title="Delete Reel"
                  >
                    <div className="p-3 rounded-full bg-red-900/80 backdrop-blur-md border border-red-500 text-red-300 hover:bg-red-600 hover:text-white transition-all">
                      <Trash2 className="w-5 h-5" />
                    </div>
                    <span className="text-[9px] font-bold text-red-300 shadow-sm font-serif uppercase">Delete</span>
                  </button>
                )}

                {/* TikTok Spinning Vinyl Disc */}
                <div className="mt-2 w-10 h-10 rounded-full bg-[#1c1611] p-1 border-2 border-[#c5a059] shadow-2xl animate-spin">
                  <img
                    src={reel.authorAvatar}
                    alt="Disc"
                    className="w-full h-full rounded-full object-cover"
                  />
                </div>
              </div>

              {/* TikTok Slide-up Comment Drawer for this Reel */}
              {isCommentOpen && (
                <div className="absolute inset-x-0 bottom-0 z-40 h-[65%] bg-[#1c1611]/95 backdrop-blur-2xl rounded-t-3xl border-t-2 border-[#c5a059] p-4 flex flex-col justify-between shadow-2xl animate-slide-up">
                  {/* Drawer Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-[#c5a059]/30">
                    <div className="flex items-center gap-2">
                      <MessageCircle className="w-4 h-4 text-[#c5a059]" />
                      <h3 className="font-serif-coptic font-bold text-xs text-[#f5ebd9] uppercase tracking-wider">
                        Comments ({activeComments.length})
                      </h3>
                    </div>
                    <button
                      onClick={() => setOpenCommentReelId(null)}
                      className="p-1 rounded-full text-[#f5ebd9] hover:bg-[#282019] transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Comments Scrollable List */}
                  <div className="flex-1 overflow-y-auto my-3 space-y-3 pr-1 text-xs no-scrollbar">
                    {activeComments.length === 0 ? (
                      <p className="text-[#a89379] text-center py-6 text-[11px] font-serif uppercase">
                        No comments yet. Encourage this reel!
                      </p>
                    ) : (
                      activeComments.map((c) => (
                        <div key={c.id} className="flex gap-2.5 items-start">
                          <img
                            src={c.authorAvatar}
                            alt={c.authorName}
                            className="w-7 h-7 rounded-full object-cover border border-[#c5a059] shrink-0 mt-0.5"
                          />
                          <div className="flex-1 bg-[#282019] rounded-2xl p-2.5 border border-[#c5a059]/40">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-serif font-bold text-[#c5a059] text-[11px] uppercase tracking-wider">
                                {c.authorName}
                              </span>
                              <span className="text-[9px] text-[#a89379] font-serif">
                                {c.createdAt}
                              </span>
                            </div>
                            <p className="text-[#f5ebd9] leading-normal text-[11px] font-serif">{c.text}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Comment Form Input */}
                  <form onSubmit={(e) => handleAddComment(e, reel.id)} className="flex gap-2 pt-2 border-t border-[#c5a059]/30">
                    <input
                      type="text"
                      value={newCommentText}
                      onChange={(e) => setNewCommentText(e.target.value)}
                      placeholder="Add a spiritual comment..."
                      className="flex-1 bg-[#282019] border border-[#c5a059] rounded-xl px-3 py-2 text-xs text-[#f5ebd9] placeholder-[#a89379] focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={!newCommentText.trim()}
                      className="px-3.5 py-2 bg-[#c5a059] hover:bg-[#a8833c] text-white rounded-xl font-bold text-xs flex items-center justify-center disabled:opacity-40 cursor-pointer transition-colors"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </form>
                </div>
              )}
            </div>
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
