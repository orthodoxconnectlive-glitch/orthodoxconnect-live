import React, { useState, useEffect, useRef } from 'react';
import {
  Heart,
  MessageCircle,
  MessageSquare,
  Share2,
  Bookmark,
  Volume2,
  VolumeX,
  Church,
  Plus,
  Check,
  Music,
  X,
  Send,
  Play,
  Pause,
  Trash2,
} from 'lucide-react';
import { Post } from '../types';
import { BunnyPlayer } from './BunnyPlayer';
import { useAuth } from '../context/AuthContext';
import { UserProfileData } from '../views/ProfileView';

export interface ReelComment {
  id: string;
  authorName: string;
  authorAvatar: string;
  text: string;
  createdAt: string;
}

interface ReelCardProps {
  reel: Post;
  isUnmuted: boolean;
  onToggleMute: (reelId: string) => void;
  onSelectUser?: (userData: UserProfileData) => void;
  onOpenMessengerWithUser?: (contactId?: string) => void;
  liked: boolean;
  likeCount: number;
  onToggleLike: (reelId: string) => void;
  saved: boolean;
  onToggleSave: (reelId: string) => void;
  isFollowed: boolean;
  onToggleFollow: (authorName: string) => void;
  onDeleteReel: (reelId: string) => void;
  comments: ReelComment[];
  isCommentOpen: boolean;
  onToggleCommentOpen: (reelId: string) => void;
  onAddComment: (reelId: string, text: string) => void;
  onShare: (reel: Post) => void;
  onVisibleChange?: (reelId: string, isVisible: boolean) => void;
}

export const ReelCard: React.FC<ReelCardProps> = ({
  reel,
  isUnmuted,
  onToggleMute,
  onSelectUser,
  onOpenMessengerWithUser,
  liked,
  likeCount,
  onToggleLike,
  saved,
  onToggleSave,
  isFollowed,
  onToggleFollow,
  onDeleteReel,
  comments,
  isCommentOpen,
  onToggleCommentOpen,
  onAddComment,
  onShare,
  onVisibleChange,
}) => {
  const { profile } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [tapFeedback, setTapFeedback] = useState<'play' | 'pause' | 'mute' | 'unmute' | null>(null);
  const [showHeartAnim, setShowHeartAnim] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');

  // 1. Keep videoRef muted state in sync with isUnmuted
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = !isUnmuted;
    }
  }, [isUnmuted]);

  // 2. IntersectionObserver (threshold: 0.7) - Play ONLY when at least 70% in view & tab is reels
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const activeTab = localStorage.getItem('orthodox_active_tab') || 'reels';
          const isReelsTab = activeTab === 'reels';

          if (entry.isIntersecting && entry.intersectionRatio >= 0.7 && isReelsTab) {
            onVisibleChange?.(reel.id, true);

            if (videoRef.current) {
              // Automatically mute all other video/audio elements across the DOM
              const allMedia = document.querySelectorAll<HTMLMediaElement>('video, audio');
              allMedia.forEach((m) => {
                if (m !== videoRef.current && !m.paused) {
                  try {
                    m.pause();
                  } catch (e) {}
                }
              });

              videoRef.current.muted = !isUnmuted;
              videoRef.current
                .play()
                .then(() => {
                  setIsPlaying(true);
                })
                .catch((err) => {
                  console.warn('Reel playback prevented:', err);
                });
            }
          } else if (!entry.isIntersecting || entry.intersectionRatio < 0.7) {
            onVisibleChange?.(reel.id, false);

            // As soon as a video moves off-screen (less than 70% visible), pause and reset time
            if (videoRef.current) {
              try {
                videoRef.current.pause();
                videoRef.current.currentTime = 0;
              } catch (err) {
                console.warn('Error pausing off-screen reel:', err);
              }
              setIsPlaying(false);
            }
          }
        });
      },
      { threshold: 0.7 }
    );

    observer.observe(container);

    return () => {
      observer.disconnect();
      if (videoRef.current) {
        try {
          videoRef.current.pause();
          videoRef.current.currentTime = 0;
        } catch (e) {}
      }
    };
  }, [reel.id, isUnmuted, onVisibleChange]);

  // 3. Tap to toggle mute & ensure only one video has audio
  const handleTapVideo = () => {
    onToggleMute(reel.id);
    const nextMuted = isUnmuted; // if currently unmuted, next is muted
    setTapFeedback(nextMuted ? 'mute' : 'unmute');
    setTimeout(() => setTapFeedback(null), 800);
  };

  const handleDoubleTapVideo = () => {
    if (!liked) {
      onToggleLike(reel.id);
    }
    setShowHeartAnim(true);
    setTimeout(() => setShowHeartAnim(false), 800);
  };

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;
    onAddComment(reel.id, newCommentText.trim());
    setNewCommentText('');
  };

  const isBunnyUrl =
    reel.video?.includes('bunnycdn.com') ||
    reel.video?.includes('iframe.mediadelivery.net') ||
    reel.video?.includes('mediadelivery.net');

  const canDelete =
    profile?.id === reel.authorId ||
    profile?.role === 'admin' ||
    profile?.role === 'owner' ||
    profile?.role === 'super_admin' ||
    profile?.email === 'orthodoxconnect.live@gmail.com';

  return (
    <div
      ref={containerRef}
      id={`reel-item-${reel.id}`}
      data-reel-id={reel.id}
      className="reel-snap-item h-screen w-full snap-start snap-always relative flex items-center justify-center bg-black rounded-3xl border-2 border-[#c5a059] overflow-hidden shadow-2xl flex-col justify-between group select-none"
    >
      {/* Background Video Player */}
      <div
        onClick={handleTapVideo}
        onDoubleClick={handleDoubleTapVideo}
        className="absolute inset-0 z-0 cursor-pointer"
      >
        {isBunnyUrl ? (
          <BunnyPlayer
            videoUrl={reel.video}
            title={reel.text}
            autoplay={false}
            muted={!isUnmuted}
            className="w-full h-full object-cover"
          />
        ) : (
          <video
            ref={videoRef}
            src={reel.video}
            controls={false}
            autoPlay={false}
            muted={true}
            playsInline
            loop
            preload="metadata"
            className="w-full h-full object-cover bg-black"
          />
        )}

        {/* Animated Tap Overlay Feedback Icon */}
        {tapFeedback && (
          <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none bg-black/20">
            <div className="w-20 h-20 rounded-full bg-[#c5a059]/90 text-[#1c1611] flex items-center justify-center shadow-2xl animate-ping">
              {tapFeedback === 'play' && <Play className="w-10 h-10 fill-current ml-1" />}
              {tapFeedback === 'pause' && <Pause className="w-10 h-10 fill-current" />}
              {tapFeedback === 'mute' && <VolumeX className="w-10 h-10" />}
              {tapFeedback === 'unmute' && <Volume2 className="w-10 h-10" />}
            </div>
          </div>
        )}

        {/* Double Tap Heart Animation Overlay */}
        {showHeartAnim && (
          <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
            <Heart className="w-24 h-24 text-red-600 fill-current animate-ping drop-shadow-2xl" />
          </div>
        )}
      </div>

      {/* Top Floating Badge & Mute Indicator */}
      <div className="relative z-20 p-4 w-full flex items-center justify-between pointer-events-none">
        <span className="px-3 py-1 rounded-full bg-[#1c1611]/80 backdrop-blur-md text-[#c5a059] text-[10px] font-serif uppercase tracking-wider font-bold border border-[#c5a059] flex items-center gap-1.5 shadow-md">
          <Church className="w-3.5 h-3.5 text-[#c5a059]" />
          {reel.authorParish || 'Orthodox Parish'}
        </span>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleMute(reel.id);
          }}
          className="pointer-events-auto p-2 rounded-full bg-[#1c1611]/80 backdrop-blur-md border border-[#c5a059] text-[#f5ebd9] hover:bg-[#c5a059] hover:text-[#1c1611] transition-all cursor-pointer shadow-lg"
          title={isUnmuted ? 'Mute' : 'Unmute'}
        >
          {isUnmuted ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-amber-300" />}
        </button>
      </div>

      {/* Bottom Left Info & Audio Overlay */}
      <div className="relative z-20 p-4 w-full bg-gradient-to-t from-black/95 via-black/60 to-transparent space-y-2 mt-auto">
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
                onToggleFollow(reel.authorName);
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
              🎵 Orthodox Hymn — Midnight Prayer (Original Audio)
            </p>
          </div>
        </div>
      </div>

      {/* Floating Right Action Stack (TikTok Style) */}
      <div className="absolute right-3 bottom-12 z-30 flex flex-col items-center gap-4 text-white">
        {/* Like Button */}
        <button
          onClick={() => onToggleLike(reel.id)}
          className="flex flex-col items-center gap-1 group cursor-pointer"
        >
          <div
            className={`p-3 rounded-full backdrop-blur-md border border-[#c5a059] transition-all ${
              liked
                ? 'bg-red-600 text-white scale-110 shadow-lg shadow-red-600/50'
                : 'bg-[#1c1611]/80 text-[#c5a059] hover:bg-red-600/30'
            }`}
          >
            <Heart className={`w-5 h-5 ${liked ? 'fill-current' : ''}`} />
          </div>
          <span className="text-[10px] font-bold text-[#f5ebd9] shadow-sm font-serif">
            {likeCount}
          </span>
        </button>

        {/* Comment Drawer Button */}
        <button
          onClick={() => onToggleCommentOpen(reel.id)}
          className="flex flex-col items-center gap-1 group cursor-pointer"
        >
          <div className="p-3 rounded-full bg-[#1c1611]/80 backdrop-blur-md border border-[#c5a059] text-[#c5a059] hover:bg-[#c5a059] hover:text-[#3d2b18] transition-all">
            <MessageCircle className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-bold text-[#f5ebd9] shadow-sm font-serif">
            {comments.length}
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
          onClick={() => onToggleSave(reel.id)}
          className="flex flex-col items-center gap-1 group cursor-pointer"
        >
          <div
            className={`p-3 rounded-full backdrop-blur-md border border-[#c5a059] transition-all ${
              saved
                ? 'bg-[#c5a059] text-[#3d2b18] font-bold scale-110'
                : 'bg-[#1c1611]/80 text-[#c5a059] hover:bg-[#c5a059]/30'
            }`}
          >
            <Bookmark className={`w-5 h-5 ${saved ? 'fill-current' : ''}`} />
          </div>
          <span className="text-[9px] font-bold text-[#f5ebd9] shadow-sm font-serif uppercase">Save</span>
        </button>

        {/* Share Button */}
        <button
          onClick={() => onShare(reel)}
          className="flex flex-col items-center gap-1 group cursor-pointer"
        >
          <div className="p-3 rounded-full bg-[#1c1611]/80 backdrop-blur-md border border-[#c5a059] text-[#c5a059] hover:bg-[#c5a059] hover:text-[#3d2b18] transition-all">
            <Share2 className="w-5 h-5" />
          </div>
          <span className="text-[9px] font-bold text-[#f5ebd9] shadow-sm font-serif uppercase">Share</span>
        </button>

        {/* Delete Reel Button for Admins or Author */}
        {canDelete && (
          <button
            onClick={() => onDeleteReel(reel.id)}
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
                Comments ({comments.length})
              </h3>
            </div>
            <button
              onClick={() => onToggleCommentOpen(reel.id)}
              className="p-1 rounded-full text-[#f5ebd9] hover:bg-[#282019] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Comments Scrollable List */}
          <div className="flex-1 overflow-y-auto my-3 space-y-3 pr-1 text-xs no-scrollbar">
            {comments.length === 0 ? (
              <p className="text-[#a89379] text-center py-6 text-[11px] font-serif uppercase">
                No comments yet. Encourage this reel!
              </p>
            ) : (
              comments.map((c) => (
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
          <form onSubmit={handleCommentSubmit} className="flex gap-2 pt-2 border-t border-[#c5a059]/30">
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
};
