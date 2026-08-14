import React, { useState, useEffect, useRef } from 'react';
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

interface VideoCardProps {
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

export const VideoCard: React.FC<VideoCardProps> = ({
  video,
  isPlaying,
  onTogglePlay,
  onSelectUser,
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
  const { pauseAllMedia, setActiveMediaId } = useMedia();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [newCommentText, setNewCommentText] = useState<string>('');
  const [showPlayPulse, setShowPlayPulse] = useState<boolean>(false);
  const [doubleTapHearts, setDoubleTapHearts] = useState<{ id: number; x: number; y: number }[]>([]);
  const [progress, setProgress] = useState<number>(0);
  const [isCaptionExpanded, setIsCaptionExpanded] = useState<boolean>(false);

  const lastTapRef = useRef<number>(0);
  const elementMediaId = `video-${video.id}`;

  // Robustly handle raw video URLs or Bunny Stream GUIDs
  const bunnyCdnHost = import.meta.env.VITE_BUNNY_CDN_HOST || 'vz-840ad26e-6fe.b-cdn.net';
  let rawVideoUrl = video.video || video.image || '';
  
  if (rawVideoUrl && !rawVideoUrl.startsWith('http') && rawVideoUrl.length > 3) {
    rawVideoUrl = `https://${bunnyCdnHost}/${rawVideoUrl}/play_720p.mp4`;
  } else if (!rawVideoUrl || rawVideoUrl.length < 5) {
    rawVideoUrl = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';
  }

  const isIframeEmbed =
    rawVideoUrl.includes('iframe.mediadelivery.net/embed/') &&
    !rawVideoUrl.endsWith('.mp4');

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || isIframeEmbed) return;

    if (isPlaying) {
      vid.muted = isMuted;
      setActiveMediaId(elementMediaId);

      const playPromise = vid.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          vid.muted = true;
          setIsMuted(true);
          vid.play().catch(() => {});
        });
      }
    } else {
      vid.pause();
    }
  }, [isPlaying, isMuted, elementMediaId, setActiveMediaId, isIframeEmbed]);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;

    const handleTimeUpdate = () => {
      if (vid.duration) {
        setProgress((vid.currentTime / vid.duration) * 100);
      }
    };

    vid.addEventListener('timeupdate', handleTimeUpdate);
    return () => {
      vid.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (videoRef.current) {
        try {
          videoRef.current.pause();
          videoRef.current.src = '';
        } catch (e) {}
      }
    };
  }, []);

  const handleScreenClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('form') || target.closest('.no-screen-tap')) {
      return;
    }

    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;

    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
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
      lastTapRef.current = now;
      setTimeout(() => {
        if (lastTapRef.current === now) {
          if (videoRef.current) {
            if (videoRef.current.paused) {
              pauseAllMedia(videoRef.current);
              videoRef.current.play().catch(() => {});
            } else {
              videoRef.current.pause();
            }
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
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (videoRef.current) {
      videoRef.current.muted = nextMuted;
    }
  };

  const handleToggleFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
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
    profile?.id === video.authorId ||
    profile?.role === 'admin' ||
    profile?.role === 'owner' ||
    profile?.role === 'super_admin' ||
    profile?.email === 'orthodoxconnect.live@gmail.com';

  const authorHandle = `@${video.authorName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'orthodox'}`;

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
      id={`tiktok-video-${video.id}`}
      data-video-id={video.id}
      onClick={handleScreenClick}
      className="w-full h-full relative overflow-hidden bg-black select-none flex items-center justify-center snap-start snap-always"
    >
      {/* Main Video Player Surface */}
      {isIframeEmbed ? (
        <div className="relative w-full h-full bg-black flex items-center justify-center">
          <iframe
            src={`${rawVideoUrl}?autoplay=${isPlaying ? 1 : 0}&muted=${isMuted ? 1 : 0}&loop=1`}
            loading="lazy"
            className="w-full h-full border-0 pointer-events-auto"
            allow="accelerometer; gyroscope; encrypted-media; picture-in-picture; autoplay;"
            allowFullScreen
            title={video.text || 'Orthodox Video'}
          />
        </div>
      ) : (
        <div className="relative w-full h-full flex items-center justify-center bg-black">
          <video
            ref={videoRef}
            data-media-id={elementMediaId}
            src={rawVideoUrl}
            controls={true}
            loop={true}
            preload="auto"
            muted={isMuted}
            playsInline
            // @ts-ignore
            webkit-playsinline="true"
            className="w-full h-full object-cover sm:object-contain bg-black cursor-pointer"
          />
        </div>
      )}

      {/* Dark Vignette Overlays */}
      <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/70 via-black/30 to-transparent pointer-events-none z-10" />
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/90 via-black/50 to-transparent pointer-events-none z-10" />

      {/* Top Right Controls */}
      <div className="absolute top-4 right-4 z-30 flex items-center gap-2 pointer-events-auto">
        <button
          type="button"
          onClick={handleToggleMute}
          className="w-10 h-10 rounded-full bg-black/55 hover:bg-black/85 backdrop-blur-md border border-white/20 text-[#f5ebd9] flex items-center justify-center transition-transform active:scale-90 shadow-xl cursor-pointer"
          title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
        >
          {isMuted ? (
            <VolumeX className="w-5 h-5 text-red-400" />
          ) : (
            <Volume2 className="w-5 h-5 text-[#c5a059]" />
          )}
        </button>

        <button
          type="button"
          onClick={handleToggleFullscreen}
          className="w-10 h-10 rounded-full bg-black/55 hover:bg-black/85 backdrop-blur-md border border-white/20 text-[#f5ebd9] flex items-center justify-center transition-transform active:scale-90 shadow-xl cursor-pointer"
          title="Fullscreen"
        >
          <Maximize className="w-4 h-4" />
        </button>
      </div>

      {/* Play/Pause Center Indicator */}
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

      {/* Double Tap Hearts */}
      {doubleTapHearts.map((heart) => (
        <div
          key={heart.id}
          style={{ left: `${heart.x - 36}px`, top: `${heart.y - 36}px` }}
          className="absolute z-40 pointer-events-none animate-heart-burst"
        >
          <Heart className="w-18 h-18 text-red-500 fill-red-500 filter drop-shadow-[0_0_12px_rgba(239,68,68,0.8)]" />
        </div>
      ))}

      {/* Right Sidebar */}
      <div className="absolute right-2.5 sm:right-4 bottom-16 z-30 flex flex-col items-center gap-4.5 pointer-events-auto">
        <div className="relative flex flex-col items-center mb-1">
          <div
            onClick={(e) => {
              e.stopPropagation();
              onSelectUser?.({
                id: video.authorId,
                name: video.authorName,
                avatar: video.authorAvatar,
                parish: video.authorParish,
              });
            }}
            className="w-12 h-12 rounded-full border-2 border-[#c5a059] overflow-hidden shadow-2xl cursor-pointer hover:scale-105 transition-transform"
          >
            <img
              src={video.authorAvatar}
              alt={video.authorName}
              className="w-full h-full object-cover"
            />
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFollow(video.authorName);
            }}
            className={`absolute -bottom-2 w-5 h-5 rounded-full flex items-center justify-center text-white text-[11px] font-bold shadow-lg border border-black cursor-pointer transition-all ${
              isFollowed
                ? 'bg-emerald-600 scale-90'
                : 'bg-red-500 hover:bg-red-600 hover:scale-110 active:scale-95'
            }`}
          >
            {isFollowed ? <Check className="w-3 h-3 stroke-[3]" /> : <Plus className="w-3.5 h-3.5 stroke-[3]" />}
          </button>
        </div>

        {/* Like Button */}
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
          >
            <Heart className={`w-7 h-7 transition-colors ${liked ? 'fill-current' : ''}`} />
          </button>
          <span className="text-white text-[11px] font-bold tracking-tight drop-shadow-md">
            {formatCount(likeCount)}
          </span>
        </div>

        {/* Comments Button */}
        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleCommentOpen(video.id);
            }}
            className="w-11 h-11 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md flex items-center justify-center text-white hover:text-[#c5a059] transition-transform active:scale-110 cursor-pointer shadow-xl"
          >
            <MessageCircle className="w-7 h-7 fill-white/10" />
          </button>
          <span className="text-white text-[11px] font-bold tracking-tight drop-shadow-md">
            {formatCount(comments.length)}
          </span>
        </div>

        {/* Bookmark Button */}
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
          >
            <Bookmark className={`w-6 h-6 ${saved ? 'fill-current' : ''}`} />
          </button>
          <span className="text-white text-[10px] font-bold tracking-tight drop-shadow-md">
            {saved ? 'Saved' : 'Save'}
          </span>
        </div>

        {/* Share Button */}
        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onShare(video);
            }}
            className="w-11 h-11 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md flex items-center justify-center text-white hover:text-[#c5a059] transition-transform active:scale-110 cursor-pointer shadow-xl"
          >
            <Share2 className="w-6 h-6" />
          </button>
          <span className="text-white text-[10px] font-bold tracking-tight drop-shadow-md">
            Share
          </span>
        </div>

        {/* Delete Button */}
        {canDelete && (
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteVideo(video.id);
              }}
              className="w-9 h-9 rounded-full bg-red-950/80 border border-red-500/50 flex items-center justify-center text-red-300 hover:bg-red-600 hover:text-white transition-transform active:scale-95 cursor-pointer shadow-xl"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Bottom Metadata Overlay */}
      <div className="absolute bottom-3 left-3 right-16 sm:right-20 z-20 flex flex-col gap-2 text-left pointer-events-auto">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectUser?.({
                id: video.authorId,
                name: video.authorName,
                avatar: video.authorAvatar,
                parish: video.authorParish,
              });
            }}
            className="flex items-center gap-1.5 font-bold text-sm text-white hover:underline cursor-pointer drop-shadow-md"
          >
            <span>{authorHandle}</span>
            <CheckCircle2 className="w-4 h-4 text-[#38bdf8] fill-[#38bdf8] stroke-black" />
          </button>

          {video.authorParish && (
            <span className="px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-md border border-[#c5a059]/40 text-[#c5a059] text-[10px] font-serif flex items-center gap-1 drop-shadow-md">
              <Church className="w-2.5 h-2.5" />
              <span className="truncate max-w-[120px]">{video.authorParish}</span>
            </span>
          )}
        </div>

        {video.text && (
          <div className="text-xs text-white/95 font-serif leading-relaxed drop-shadow-md max-w-full">
            <p className={isCaptionExpanded ? '' : 'line-clamp-2'}>
              {renderFormattedCaption(video.text)}
            </p>
            {video.text.length > 90 && (
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

        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2 overflow-hidden flex-1 bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 max-w-[240px]">
            <Music className="w-3.5 h-3.5 text-[#c5a059] shrink-0" />
            <div className="overflow-hidden whitespace-nowrap text-[11px] text-white/90 font-serif">
              <span className="inline-block animate-marquee">
                Original Audio — {video.authorName} • Orthodox Reflection ☨
              </span>
            </div>
          </div>

          <div className="relative w-8 h-8 rounded-full bg-gradient-to-tr from-neutral-900 via-neutral-800 to-black border-2 border-neutral-700 shadow-xl flex items-center justify-center shrink-0">
            <div
              className={`w-6 h-6 rounded-full overflow-hidden border border-[#c5a059]/60 flex items-center justify-center ${
                isPlaying ? 'animate-spin-slow' : ''
              }`}
            >
              <img
                src={video.authorAvatar}
                alt="Audio thumbnail"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute w-1.5 h-1.5 rounded-full bg-black border border-white/40" />
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="absolute bottom-0 inset-x-0 h-1 bg-white/20 z-30 pointer-events-none">
        <div
          style={{ width: `${progress}%` }}
          className="h-full bg-gradient-to-r from-[#c5a059] to-[#eedcb5] transition-all duration-100"
        />
      </div>

      {/* Comment Drawer Sheet */}
      {isCommentOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="no-screen-tap absolute inset-x-0 bottom-0 max-h-[72%] h-[420px] bg-[#1c1611]/98 backdrop-blur-2xl border-t-2 border-[#c5a059] rounded-t-3xl p-4 z-50 flex flex-col shadow-2xl text-[#f5ebd9]"
        >
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
              className="p-1 rounded-full text-white/70 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-2 py-2.5 overflow-x-auto border-b border-[#c5a059]/20">
            {['☨ Amen', '🙏 Praying', '🕊️ Blessed', '❤️ Glory to God', '✝️ Lord Have Mercy'].map(
              (chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => handleQuickReaction(chip)}
                  className="px-2.5 py-1 rounded-full bg-[#282019] hover:bg-[#c5a059] hover:text-[#1c1611] text-[#c5a059] text-[11px] font-serif border border-[#c5a059]/40 whitespace-nowrap cursor-pointer shrink-0"
                >
                  {chip}
                </button>
              )
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 py-3 pr-1 text-xs">
            {comments.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-[#a89379] font-serif">
                  Be the first to leave a reflection on this video!
                </p>
              </div>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="flex gap-2.5 items-start">
                  <img
                    src={c.authorAvatar}
                    alt={c.authorName}
                    className="w-8 h-8 rounded-full object-cover border border-[#c5a059] shrink-0 mt-0.5"
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

          <form onSubmit={handleCommentSubmit} className="flex gap-2 pt-2.5 border-t border-[#c5a059]/30">
            <input
              type="text"
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
              placeholder="Add a comment or reflection..."
              className="flex-1 bg-[#282019] border border-[#c5a059] rounded-2xl px-3.5 py-2 text-xs text-[#f5ebd9] placeholder-[#a89379] focus:outline-none"
            />
            <button
              type="submit"
              disabled={!newCommentText.trim()}
              className="px-4 py-2 bg-[#c5a059] text-[#1c1611] rounded-2xl font-bold text-xs flex items-center justify-center disabled:opacity-40 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
