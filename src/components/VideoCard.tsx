import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  Church,
  Trash2,
  Send,
  X,
  Plus,
  Check,
  Maximize,
  Music,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { Post } from '../types';
import { useAuth } from '../context/AuthContext';
import { useMedia } from '../context/MediaContext';
import { UserProfileData } from '../views/ProfileView';

export interface VideoComment {
  id: string;
  authorName: string;
  authorAvatar: string;
  text: string;
  createdAt: string;
}

export interface VideoCardProps {
  video: Post;
  isPlaying: boolean;
  onTogglePlay: (e?: React.MouseEvent) => void;
  onSelectUser?: (userData: UserProfileData) => void;
  onOpenMessengerWithUser?: (contactId?: string) => void;
  liked: boolean;
  likeCount: number;
  onToggleLike: (videoId: string) => void;
  saved: boolean;
  onToggleSave: (videoId: string) => void;
  isFollowed: boolean;
  onToggleFollow: (authorName: string) => void;
  onDeleteVideo: (videoId: string) => void;
  comments: VideoComment[];
  isCommentOpen: boolean;
  onToggleCommentOpen: (videoId: string) => void;
  onAddComment: (videoId: string, text: string) => void;
  onShare: (video: Post) => void;
  onHashtagClick?: (tag: string) => void;
}

export const DEFAULT_POSTER =
  'https://images.unsplash.com/photo-1548625361-1959779df5ff?auto=format&fit=crop&q=80&w=800';

/**
 * Standardized helper to extract a clean Bunny Stream Video GUID / UUID
 * from any input format (pure GUID, embed URL, iframe src, CDN stream URL).
 */
export function extractCleanVideoId(rawSource?: string | null): string | null {
  if (!rawSource || typeof rawSource !== 'string') return null;
  const trimmed = rawSource.trim();
  if (!trimmed) return null;

  // 1. Standard 36-char UUID regex (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
  const guidRegex = /([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/;
  const match = trimmed.match(guidRegex);
  if (match) return match[1];

  // 2. Direct alphanumeric ID (10+ characters without path/protocol)
  if (/^[0-9a-fA-F-]{10,}$/.test(trimmed) && !trimmed.startsWith('http') && !trimmed.includes('/')) {
    return trimmed;
  }

  // 3. Extract from Bunny iframe or mediadelivery URL
  if (trimmed.includes('mediadelivery.net') || trimmed.includes('bunnycdn.com') || trimmed.includes('b-cdn.net')) {
    const parts = trimmed.split('?')[0].split('/');
    const lastPart = parts[parts.length - 1];
    if (lastPart && (lastPart.length >= 10 || guidRegex.test(lastPart))) {
      const pMatch = lastPart.match(guidRegex);
      return pMatch ? pMatch[1] : lastPart;
    }
  }

  return null;
}

export const VideoCard: React.FC<VideoCardProps> = ({
  video,
  isPlaying,
  onTogglePlay,
  onSelectUser,
  onOpenMessengerWithUser,
  liked,
  likeCount,
  onToggleLike,
  saved,
  onToggleSave,
  isFollowed,
  onToggleFollow,
  onDeleteVideo,
  comments,
  isCommentOpen,
  onToggleCommentOpen,
  onAddComment,
  onShare,
  onHashtagClick,
}) => {
  const { profile } = useAuth();
  const { pauseAllMedia, setActiveMediaId, isGlobalMuted, setIsGlobalMuted } = useMedia();
  const containerRef = useRef<HTMLDivElement>(null);

  // Standardize & sanitize video item properties
  const rawItem = video as any;
  const authorName = video.authorName || rawItem.author_name || 'Orthodox Parishioner';
  const authorParish = video.authorParish || rawItem.author_parish || 'Orthodox Parish';
  const authorAvatar =
    video.authorAvatar ||
    rawItem.author_avatar ||
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200';
  const authorId = video.authorId || rawItem.author_id;
  const videoText = video.text || rawItem.content || '';
  const postImage = video.image || rawItem.image_url || rawItem.image || rawItem.photo_url;

  // Standardize Video GUID Extraction: prioritize post.video_id || post.videoId
  const rawVideoSource =
    video.video_id ||
    rawItem.video_id ||
    video.video ||
    rawItem.videoId ||
    rawItem.video_url;
  const cleanVideoId = extractCleanVideoId(rawVideoSource);

  // UI state
  const [newCommentText, setNewCommentText] = useState<string>('');
  const [showPlayPulse, setShowPlayPulse] = useState<boolean>(false);
  const [doubleTapHearts, setDoubleTapHearts] = useState<{ id: number; x: number; y: number }[]>([]);
  const [isCaptionExpanded, setIsCaptionExpanded] = useState<boolean>(false);

  const lastTapRef = useRef<number>(0);
  const elementMediaId = `reel-${video.id}`;

  // Keep active media context synced
  useEffect(() => {
    if (isPlaying) {
      setActiveMediaId(elementMediaId);
    }
  }, [isPlaying, elementMediaId, setActiveMediaId]);

  // Screen Tap / Double Tap Handler (Reels style)
  const handleScreenClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('form') || target.closest('.no-screen-tap')) {
      return;
    }

    const now = Date.now();
    const DOUBLE_TAP_DELAY = 280;

    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      // Double tap -> Like reel with animated heart burst
      const rect = containerRef.current?.getBoundingClientRect();
      const x = rect ? e.clientX - rect.left : e.clientX;
      const y = rect ? e.clientY - rect.top : e.clientY;

      const heartId = Date.now();
      setDoubleTapHearts((prev) => [...prev, { id: heartId, x, y }]);
      setTimeout(() => {
        setDoubleTapHearts((prev) => prev.filter((h) => h.id !== heartId));
      }, 800);

      if (!liked) {
        onToggleLike(video.id);
      }
      lastTapRef.current = 0;
    } else {
      // Single tap -> Play / Pause toggle
      lastTapRef.current = now;
      setTimeout(() => {
        if (lastTapRef.current === now) {
          if (!isPlaying) {
            pauseAllMedia();
          }
          setShowPlayPulse(true);
          setTimeout(() => setShowPlayPulse(false), 500);
          onTogglePlay(e);
        }
      }, DOUBLE_TAP_DELAY);
    }
  };

  const handleToggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsGlobalMuted(!isGlobalMuted);
  };

  const handleToggleFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch((err) => {
        console.warn('Fullscreen request error:', err);
      });
    } else {
      document.exitFullscreen().catch((err) => {
        console.warn('Exit fullscreen error:', err);
      });
    }
  };

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;
    onAddComment(video.id, newCommentText.trim());
    setNewCommentText('');
  };

  const handleQuickReaction = (reaction: string) => {
    onAddComment(video.id, reaction);
  };

  const canDelete =
    profile?.id === authorId ||
    profile?.role === 'admin' ||
    profile?.role === 'owner' ||
    profile?.role === 'super_admin' ||
    profile?.email === 'orthodoxconnect.live@gmail.com';

  const authorHandle = `@${authorName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'orthodox'}`;

  // Helper to render caption with interactive hashtags
  const renderFormattedCaption = (text: string) => {
    if (!text) return null;
    const words = text.split(/(\s+)/);
    return words.map((word, idx) => {
      if (word.startsWith('#')) {
        return (
          <span
            key={idx}
            onClick={(e) => {
              e.stopPropagation();
              onHashtagClick?.(word);
            }}
            className="text-[#c5a059] font-bold hover:underline cursor-pointer mr-1 inline-block"
          >
            {word}
          </span>
        );
      }
      return <span key={idx}>{word}</span>;
    });
  };

  const formatCount = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return String(num);
  };

  return (
    <div
      ref={containerRef}
      id={`orthodox-reel-${video.id}`}
      data-video-id={video.id}
      onClick={handleScreenClick}
      className="w-full h-full relative overflow-hidden bg-black select-none flex items-center justify-center snap-start snap-always"
    >
      {/* Fallback Ambient Background: Blurred backdrop preventing harsh black letterboxing */}
      <div
        className="absolute inset-0 bg-cover bg-center filter blur-xl opacity-30 scale-110 pointer-events-none"
        style={{
          backgroundImage: `url(${
            cleanVideoId
              ? `https://vz-840ad26e-6fe.b-cdn.net/${cleanVideoId}/thumbnail.jpg`
              : postImage || DEFAULT_POSTER
          })`,
        }}
      />

      {/* 1. Main 9:16 Video Player Surface: Render Bunny Stream embed iframe for active reel */}
      <div className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden rounded-2xl sm:rounded-3xl">
        {cleanVideoId ? (
          isPlaying ? (
            <iframe
              src={`https://iframe.mediadelivery.net/embed/713265/${cleanVideoId}?autoplay=true&loop=true&muted=${
                isGlobalMuted ? 'true' : 'false'
              }&preload=true&responsive=true`}
              loading="eager"
              className="w-full h-full border-0 absolute inset-0 object-cover pointer-events-auto"
              allow="accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture;"
              allowFullScreen={true}
              title={videoText || 'Orthodox Reel'}
            />
          ) : (
            <div className="relative w-full h-full">
              <img
                src={
                  cleanVideoId
                    ? `https://vz-840ad26e-6fe.b-cdn.net/${cleanVideoId}/thumbnail.jpg`
                    : postImage || DEFAULT_POSTER
                }
                alt="Reel content"
                className="w-full h-full object-cover"
                onError={(e) => {
                  if (postImage) (e.currentTarget as HTMLImageElement).src = postImage;
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/25 pointer-events-none">
                <div className="w-16 h-16 rounded-full bg-black/60 backdrop-blur-sm border-2 border-[#c5a059] flex items-center justify-center text-[#c5a059] shadow-2xl">
                  <Play className="w-8 h-8 fill-current ml-1" />
                </div>
              </div>
            </div>
          )
        ) : (
          <img
            src={postImage || DEFAULT_POSTER}
            alt="Reel content"
            className="w-full h-full object-cover"
          />
        )}
      </div>

      {/* Dark Vignette Gradients for Legibility (Top and Bottom) */}
      <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/75 via-black/30 to-transparent pointer-events-none z-10" />
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/90 via-black/50 to-transparent pointer-events-none z-10" />

      {/* 2. Top Right Player Controls (Sound / Mute & Fullscreen) */}
      <div className="absolute top-14 sm:top-16 right-3 sm:right-4 z-30 flex items-center gap-2 pointer-events-auto no-screen-tap">
        <button
          type="button"
          onClick={handleToggleMute}
          className={`px-3 py-1.5 rounded-full backdrop-blur-md border text-xs font-serif font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95 shadow-2xl cursor-pointer ${
            isGlobalMuted
              ? 'bg-black/75 border-red-500/70 text-red-300 hover:bg-black/90 hover:border-red-400'
              : 'bg-black/75 border-[#c5a059] text-[#c5a059] hover:bg-black/90 hover:border-[#e6d3ab]'
          }`}
          title={isGlobalMuted ? 'Tap to Unmute Audio' : 'Tap to Mute Audio'}
          aria-label="Toggle Sound"
        >
          {isGlobalMuted ? (
            <>
              <VolumeX className="w-4 h-4 text-red-400 shrink-0" />
              <span className="text-[10px] tracking-wider text-red-300 font-sans font-bold">MUTE</span>
            </>
          ) : (
            <>
              <Volume2 className="w-4 h-4 text-[#c5a059] shrink-0" />
              <span className="text-[10px] tracking-wider text-[#f5ebd9] font-sans font-bold">AUDIO ON</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleToggleFullscreen}
          className="w-8 h-8 rounded-full bg-black/60 hover:bg-black/85 backdrop-blur-md border border-white/20 text-[#f5ebd9] flex items-center justify-center transition-transform active:scale-90 shadow-xl cursor-pointer"
          title="Fullscreen"
          aria-label="Fullscreen"
        >
          <Maximize className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 3. Center Screen Play/Pause Animated Pulse Indicator */}
      {(!isPlaying || showPlayPulse) && (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
          <div className="w-20 h-20 rounded-full bg-black/60 backdrop-blur-md border-2 border-[#c5a059] flex items-center justify-center text-[#c5a059] shadow-2xl transition-all scale-100 animate-fade-in">
            {isPlaying ? (
              <Pause className="w-9 h-9 fill-current" />
            ) : (
              <Play className="w-9 h-9 fill-current ml-1" />
            )}
          </div>
        </div>
      )}

      {/* 4. Double-Tap Floating Heart Burst Animations */}
      {doubleTapHearts.map((heart) => (
        <div
          key={heart.id}
          style={{ left: `${heart.x - 36}px`, top: `${heart.y - 36}px` }}
          className="absolute z-40 pointer-events-none animate-heart-burst"
        >
          <Heart className="w-18 h-18 text-red-500 fill-red-500 filter drop-shadow-[0_0_12px_rgba(239,68,68,0.8)]" />
        </div>
      ))}

      {/* 5. Right-Side Action Bar: z-30 pointer-events-auto */}
      <div className="absolute right-2.5 sm:right-4 bottom-16 z-30 flex flex-col items-center gap-4.5 pointer-events-auto">
        {/* Author Avatar with Red (+) Follow Button */}
        <div className="relative flex flex-col items-center mb-1">
          <div
            onClick={(e) => {
              e.stopPropagation();
              onSelectUser?.({
                id: authorId,
                name: authorName,
                avatar: authorAvatar,
                parish: authorParish,
              });
            }}
            className="w-12 h-12 rounded-full border-2 border-[#c5a059] overflow-hidden shadow-2xl cursor-pointer hover:scale-105 transition-transform"
          >
            <img
              src={authorAvatar}
              alt={authorName}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Red (+) Follow Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFollow(authorName);
            }}
            className={`absolute -bottom-2 w-5 h-5 rounded-full flex items-center justify-center text-white text-[11px] font-bold shadow-lg border border-black cursor-pointer transition-all ${
              isFollowed
                ? 'bg-emerald-600 scale-90'
                : 'bg-red-500 hover:bg-red-600 hover:scale-110 active:scale-95'
            }`}
            title={isFollowed ? 'Following' : 'Follow Creator'}
            aria-label="Follow Creator"
          >
            {isFollowed ? <Check className="w-3 h-3 stroke-[3]" /> : <Plus className="w-3.5 h-3.5 stroke-[3]" />}
          </button>
        </div>

        {/* Heart / Like Button */}
        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleLike(video.id);
            }}
            className={`w-11 h-11 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md flex items-center justify-center transition-transform active:scale-125 cursor-pointer shadow-xl ${
              liked ? 'text-red-500' : 'text-white hover:text-red-400'
            }`}
            title={liked ? 'Unlike' : 'Like'}
            aria-label="Like Video"
          >
            <Heart className={`w-7 h-7 transition-colors ${liked ? 'fill-current' : ''}`} />
          </button>
          <span className="text-white text-[11px] font-bold tracking-tight drop-shadow-md">
            {formatCount(likeCount)}
          </span>
        </div>

        {/* Speech Bubble / Comment Button */}
        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleCommentOpen(video.id);
            }}
            className="w-11 h-11 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md flex items-center justify-center text-white hover:text-[#c5a059] transition-transform active:scale-110 cursor-pointer shadow-xl"
            title="Comments"
            aria-label="Open Comments"
          >
            <MessageCircle className="w-7 h-7 fill-white/10" />
          </button>
          <span className="text-white text-[11px] font-bold tracking-tight drop-shadow-md">
            {formatCount(comments.length)}
          </span>
        </div>

        {/* Bookmark / Save Button */}
        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSave(video.id);
            }}
            className={`w-11 h-11 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md flex items-center justify-center transition-transform active:scale-110 cursor-pointer shadow-xl ${
              saved ? 'text-[#c5a059]' : 'text-white hover:text-[#c5a059]'
            }`}
            title={saved ? 'Saved' : 'Save to bookmarks'}
            aria-label="Save Video"
          >
            <Bookmark className={`w-6 h-6 ${saved ? 'fill-current' : ''}`} />
          </button>
          <span className="text-white text-[10px] font-bold tracking-tight drop-shadow-md">
            {saved ? 'Saved' : 'Save'}
          </span>
        </div>

        {/* Share Button with Direct Link Copy */}
        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onShare(video);
            }}
            className="w-11 h-11 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md flex items-center justify-center text-white hover:text-[#c5a059] transition-transform active:scale-110 cursor-pointer shadow-xl"
            title="Share Video"
            aria-label="Share Video"
          >
            <Share2 className="w-6 h-6" />
          </button>
          <span className="text-white text-[10px] font-bold tracking-tight drop-shadow-md">
            Share
          </span>
        </div>

        {/* Delete Button (if admin or author) */}
        {canDelete && (
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteVideo(video.id);
              }}
              className="w-9 h-9 rounded-full bg-red-950/80 border border-red-500/50 flex items-center justify-center text-red-300 hover:bg-red-600 hover:text-white transition-transform active:scale-95 cursor-pointer shadow-xl"
              title="Delete Reel"
              aria-label="Delete Reel"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* 6. Bottom Overlay: Creator info, caption with clickable hashtags, and audio track bar */}
      <div className="absolute bottom-3 left-3 right-16 sm:right-20 z-30 flex flex-col gap-2 text-left pointer-events-auto">
        {/* Creator Username & Verified Badge */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectUser?.({
                id: authorId,
                name: authorName,
                avatar: authorAvatar,
                parish: authorParish,
              });
            }}
            className="flex items-center gap-1.5 font-bold text-sm text-white hover:underline cursor-pointer drop-shadow-md"
          >
            <span>{authorHandle}</span>
            <CheckCircle2 className="w-4 h-4 text-[#38bdf8] fill-[#38bdf8] stroke-black" />
          </button>

          {/* Parish Badge */}
          {authorParish && (
            <span className="px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-md border border-[#c5a059]/40 text-[#c5a059] text-[10px] font-serif flex items-center gap-1 drop-shadow-md">
              <Church className="w-2.5 h-2.5" />
              <span className="truncate max-w-[120px]">{authorParish}</span>
            </span>
          )}
        </div>

        {/* Video Caption with Clickable Hashtags */}
        {videoText && (
          <div className="text-xs text-white/95 font-serif leading-relaxed drop-shadow-md max-w-full">
            <p className={isCaptionExpanded ? '' : 'line-clamp-2'}>
              {renderFormattedCaption(videoText)}
            </p>
            {videoText.length > 90 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsCaptionExpanded(!isCaptionExpanded);
                }}
                className="text-white/60 hover:text-white text-[11px] font-bold mt-0.5 cursor-pointer block"
              >
                {isCaptionExpanded ? 'less' : 'more'}
              </button>
            )}
          </div>
        )}

        {/* Audio Track Bar with Spinning Vinyl Disc */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2 overflow-hidden flex-1 bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 max-w-[240px]">
            <Music className="w-3.5 h-3.5 text-[#c5a059] shrink-0" />
            <div className="overflow-hidden whitespace-nowrap text-[11px] text-white/90 font-serif">
              <span className="inline-block animate-marquee">
                Original Audio — {authorName} • Byzantine Liturgical Reflection ☨
              </span>
            </div>
          </div>

          {/* Spinning Audio Thumbnail Disc */}
          <div className="relative w-8 h-8 rounded-full bg-gradient-to-tr from-neutral-900 via-neutral-800 to-black border-2 border-neutral-700 shadow-xl flex items-center justify-center shrink-0">
            <div
              className={`w-6 h-6 rounded-full overflow-hidden border border-[#c5a059]/60 flex items-center justify-center ${
                isPlaying ? 'animate-spin-slow' : ''
              }`}
            >
              <img
                src={authorAvatar}
                alt="Audio thumbnail"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute w-1.5 h-1.5 rounded-full bg-black border border-white/40" />
          </div>
        </div>
      </div>

      {/* 7. Slide-Up Comment Drawer / Bottom Sheet */}
      {isCommentOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="no-screen-tap absolute inset-x-0 bottom-0 max-h-[72%] h-[420px] bg-[#1c1611]/98 backdrop-blur-2xl border-t-2 border-[#c5a059] rounded-t-3xl p-4 z-50 flex flex-col shadow-2xl animate-fade-in text-[#f5ebd9]"
        >
          {/* Drawer Header */}
          <div className="flex items-center justify-between pb-3 border-b border-[#c5a059]/30">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-[#c5a059]" />
              <h4 className="font-serif-coptic font-bold text-sm text-[#f5ebd9] uppercase tracking-wider">
                Comments ({comments.length})
              </h4>
            </div>
            <button
              type="button"
              onClick={() => onToggleCommentOpen(video.id)}
              className="p-1 rounded-full text-white/70 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Spiritual Reaction Chips */}
          <div className="flex items-center gap-2 py-2.5 overflow-x-auto no-scrollbar border-b border-[#c5a059]/20">
            {['☨ Amen', '🙏 Praying', '🕊️ Blessed', '❤️ Glory to God', '✝️ Lord Have Mercy'].map(
              (chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => handleQuickReaction(chip)}
                  className="px-2.5 py-1 rounded-full bg-[#282019] hover:bg-[#c5a059] hover:text-[#1c1611] text-[#c5a059] text-[11px] font-serif border border-[#c5a059]/40 whitespace-nowrap cursor-pointer transition-colors shrink-0"
                >
                  {chip}
                </button>
              )
            )}
          </div>

          {/* Comments Scrollable List */}
          <div className="flex-1 overflow-y-auto space-y-3 py-3 pr-1 text-xs no-scrollbar">
            {comments.length === 0 ? (
              <div className="text-center py-10">
                <Sparkles className="w-8 h-8 text-[#c5a059]/50 mx-auto mb-2" />
                <p className="text-[#a89379] font-serif">
                  Be the first to leave a reflection on this video!
                </p>
              </div>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="flex gap-2.5 items-start animate-fade-in">
                  <img
                    src={c.authorAvatar}
                    alt={c.authorName}
                    className="w-8 h-8 rounded-full object-cover border border-[#c5a059] shrink-0 mt-0.5 shadow-md"
                  />
                  <div className="flex-1 bg-[#282019]/90 rounded-2xl p-2.5 border border-[#c5a059]/30">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-serif font-bold text-[#c5a059] text-[11px] uppercase tracking-wider">
                        {c.authorName}
                      </span>
                      <span className="text-[9px] text-[#a89379] font-serif">{c.createdAt}</span>
                    </div>
                    <p className="text-[#f5ebd9] leading-relaxed text-xs font-serif">{c.text}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Comment Input Form */}
          <form onSubmit={handleCommentSubmit} className="flex gap-2 pt-2.5 border-t border-[#c5a059]/30">
            <input
              type="text"
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
              placeholder="Add a reflection or prayer..."
              className="flex-1 bg-[#282019] border border-[#c5a059] rounded-2xl px-3.5 py-2 text-xs text-[#f5ebd9] placeholder-[#a89379] focus:outline-none focus:ring-1 focus:ring-[#c5a059]"
            />
            <button
              type="submit"
              disabled={!newCommentText.trim()}
              className="px-4 py-2 bg-[#c5a059] hover:bg-[#a8833c] text-[#1c1611] rounded-2xl font-bold text-xs flex items-center justify-center disabled:opacity-40 cursor-pointer transition-colors shadow-md"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export const ReelCard = VideoCard;
