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
  AlertCircle,
  RefreshCw,
  Send,
  X,
  Plus,
  Check,
  Maximize,
} from 'lucide-react';
import { Post } from '../types';
import { BunnyPlayer } from './BunnyPlayer';
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
}

export const VideoCard: React.FC<VideoCardProps> = ({
  video,
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
}) => {
  const { profile } = useAuth();
  const { pauseAllMedia, setActiveMediaId } = useMedia();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Strict initial playback defaults: Always paused and muted
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [hasStarted, setHasStarted] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [hasError, setHasError] = useState<boolean>(false);
  const [newCommentText, setNewCommentText] = useState<string>('');

  const elementMediaId = `video-${video.id}`;
  const bunnyCdnHost = import.meta.env.VITE_BUNNY_CDN_HOST || 'vz-840ad26e-6fe.b-cdn.net';

  const isBunnyEmbed =
    video.video?.includes('bunnycdn.com') ||
    video.video?.includes('iframe.mediadelivery.net') ||
    video.video?.includes('mediadelivery.net') ||
    video.video?.includes(bunnyCdnHost) ||
    video.video?.includes('b-cdn.net') ||
    video.video?.includes('bunnyinfra.net');

  // Strict unmount cleanup: Stop video playback and clear source
  useEffect(() => {
    return () => {
      if (videoRef.current) {
        try {
          videoRef.current.pause();
          videoRef.current.currentTime = 0;
          videoRef.current.src = '';
        } catch (e) {
          // ignore
        }
      }
    };
  }, []);

  // Synchronize playback events
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;

    const handlePlay = () => {
      setIsPlaying(true);
      setHasStarted(true);
      setActiveMediaId(elementMediaId);
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    const handleEnded = () => {
      setIsPlaying(false);
    };

    vid.addEventListener('play', handlePlay);
    vid.addEventListener('pause', handlePause);
    vid.addEventListener('ended', handleEnded);

    return () => {
      vid.removeEventListener('play', handlePlay);
      vid.removeEventListener('pause', handlePause);
      vid.removeEventListener('ended', handleEnded);
    };
  }, [elementMediaId, setActiveMediaId]);

  // Explicit Play action handler: Pauses other media before starting
  const handleExplicitPlay = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (hasError) return;
    const vid = videoRef.current;
    if (!vid) return;

    if (isPlaying) {
      vid.pause();
      setIsPlaying(false);
    } else {
      // Mark as explicitly user-initiated for global prototype guard
      vid.dataset.userInitiated = 'true';
      // Automatically pause any other video currently playing
      pauseAllMedia(vid);
      setActiveMediaId(elementMediaId);

      // Unmute on explicit user play
      vid.muted = false;
      setIsMuted(false);

      vid
        .play()
        .then(() => {
          setIsPlaying(true);
          setHasStarted(true);
        })
        .catch((err) => {
          console.warn('[VideoCard] Playback was prevented:', err);
        });
    }
  };

  const handleToggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (videoRef.current) {
      videoRef.current.muted = nextMuted;
      if (!nextMuted) {
        videoRef.current.dataset.userInitiated = 'true';
      }
    }
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

  const canDelete =
    profile?.id === video.authorId ||
    profile?.role === 'admin' ||
    profile?.role === 'owner' ||
    profile?.role === 'super_admin' ||
    profile?.email === 'orthodoxconnect.live@gmail.com';

  return (
    <div
      ref={containerRef}
      id={`video-card-${video.id}`}
      data-video-id={video.id}
      className="bg-[#f6ebd6] dark:bg-[#1c1611] border-2 border-[#c5a059] dark:border-[#8b6b4a] rounded-3xl overflow-hidden shadow-xl transition-all"
    >
      {/* Card Header: Author Info & Parish */}
      <div className="p-4 flex items-center justify-between border-b border-[#c5a059]/30">
        <div className="flex items-center gap-3">
          <div
            className="relative cursor-pointer hover:opacity-85 transition-opacity"
            onClick={() =>
              onSelectUser?.({
                id: video.authorId,
                name: video.authorName,
                avatar: video.authorAvatar,
                parish: video.authorParish,
              })
            }
          >
            <img
              src={video.authorAvatar}
              alt={video.authorName}
              className="w-11 h-11 rounded-full border-2 border-[#c5a059] object-cover shadow-md"
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFollow(video.authorName);
              }}
              className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] shadow-md border border-black cursor-pointer transition-transform ${
                isFollowed ? 'bg-emerald-600' : 'bg-red-600 hover:scale-110'
              }`}
              title={isFollowed ? 'Following' : 'Follow Creator'}
            >
              {isFollowed ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
            </button>
          </div>

          <div>
            <div
              className="cursor-pointer hover:underline"
              onClick={() =>
                onSelectUser?.({
                  id: video.authorId,
                  name: video.authorName,
                  avatar: video.authorAvatar,
                  parish: video.authorParish,
                })
              }
            >
              <h3 className="font-serif-coptic font-bold text-sm text-[#3d2b18] dark:text-[#f5ebd9] leading-tight">
                {video.authorName}
              </h3>
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-[#7c5f3d] dark:text-[#c5a059]">
              <span className="flex items-center gap-1 font-serif">
                <Church className="w-3 h-3" />
                {video.authorParish || 'Orthodox Parish'}
              </span>
              <span>•</span>
              <span className="font-serif">{video.timestamp || 'Recent'}</span>
            </div>
          </div>
        </div>

        {/* Header Action Menu */}
        <div className="flex items-center gap-1.5">
          {onOpenMessengerWithUser && (
            <button
              type="button"
              onClick={() => onOpenMessengerWithUser(video.authorId || video.authorName)}
              className="p-2 rounded-xl bg-[#eedcb5] dark:bg-[#282019] text-[#7c5f3d] dark:text-[#c5a059] hover:bg-[#c5a059] hover:text-[#1c1611] transition-colors cursor-pointer border border-[#c5a059]/40 text-xs flex items-center gap-1 font-serif font-bold uppercase"
              title="Message Creator"
            >
              <MessageCircle className="w-4 h-4" />
              <span className="hidden sm:inline text-[10px]">Chat</span>
            </button>
          )}

          {canDelete && (
            <button
              type="button"
              onClick={() => onDeleteVideo(video.id)}
              className="p-2 rounded-xl bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 hover:bg-red-600 hover:text-white transition-colors cursor-pointer border border-red-500/30"
              title="Delete Video"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Video Title / Description */}
      {video.text && (
        <div className="px-4 py-3 text-sm text-[#3d2b18] dark:text-[#f5ebd9] font-serif leading-relaxed">
          <p>{video.text}</p>
        </div>
      )}

      {/* Main Video Player Container */}
      <div className="relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden">
        {hasError ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-[#1c130c]">
            <div className="w-12 h-12 rounded-full bg-red-950/80 border border-red-500/40 flex items-center justify-center mb-2.5 text-red-400">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h4 className="text-[#f5ebd9] font-serif font-bold text-sm mb-1 uppercase tracking-wider">
              Video Playback Unavailable
            </h4>
            <p className="text-[#eedcb5]/70 text-xs max-w-xs font-serif mb-3">
              The video source could not be loaded or is currently offline.
            </p>
            <button
              type="button"
              onClick={() => {
                setHasError(false);
                setIsPlaying(false);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-[#3d2b18] hover:bg-[#c5a059] text-[#c5a059] hover:text-[#1c130c] font-serif font-bold text-xs uppercase tracking-wider transition-colors border border-[#c5a059]/40 cursor-pointer shadow-md flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        ) : isBunnyEmbed ? (
          <BunnyPlayer
            videoUrl={video.video}
            title={video.text}
            autoplay={false}
            muted={isMuted}
            className="w-full h-full object-cover"
          />
        ) : (
          <>
            {/* Standard HTML5 Video: Initialized with autoPlay={false}, preload="none", and muted */}
            <video
              ref={videoRef}
              data-media-id={elementMediaId}
              src={video.video}
              poster={video.image}
              controls={hasStarted}
              autoPlay={false}
              preload="none"
              muted={isMuted}
              playsInline
              onClick={handleExplicitPlay}
              onError={(e) => {
                console.warn('[VideoCard] Video error:', e);
                setHasError(true);
                setIsPlaying(false);
              }}
              className="w-full h-full object-contain bg-black cursor-pointer"
            />

            {/* Video Controls Bar Overlay (when started) */}
            {hasStarted && (
              <div className="absolute top-3 right-3 z-20 flex items-center gap-2 pointer-events-auto">
                <button
                  type="button"
                  onClick={handleToggleMute}
                  className="p-2 rounded-full bg-black/70 hover:bg-black/90 text-[#f5ebd9] backdrop-blur-sm border border-white/20 transition-all cursor-pointer shadow-md"
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
                </button>
                <button
                  type="button"
                  onClick={handleToggleFullscreen}
                  className="p-2 rounded-full bg-black/70 hover:bg-black/90 text-[#f5ebd9] backdrop-blur-sm border border-white/20 transition-all cursor-pointer shadow-md"
                  title="Fullscreen"
                >
                  <Maximize className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Prominent Golden Play Button Overlay when Paused */}
            {!isPlaying && (
              <div
                onClick={handleExplicitPlay}
                className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/45 hover:bg-black/35 transition-all cursor-pointer group/play"
              >
                <div className="relative flex items-center justify-center">
                  <div className="absolute w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-[#c5a059]/30 animate-ping opacity-75 pointer-events-none" />
                  <button
                    type="button"
                    className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-[#c5a059] to-[#8f6e30] hover:from-[#e6d3ab] hover:to-[#c5a059] text-[#1c130c] shadow-2xl flex items-center justify-center border-2 border-[#f5ebd9] transition-transform transform group-hover/play:scale-110 active:scale-95 cursor-pointer"
                    title="Play Video"
                    aria-label="Play Video"
                  >
                    <Play className="w-8 h-8 sm:w-10 sm:h-10 fill-current ml-1 text-[#1c130c]" />
                  </button>
                </div>
                <div className="mt-4 px-4 py-1.5 rounded-full bg-[#3d2b18]/95 backdrop-blur-md border border-[#c5a059]/60 text-[#f5ebd9] text-xs font-serif font-bold uppercase tracking-wider shadow-2xl flex items-center gap-2">
                  <Play className="w-3.5 h-3.5 fill-current text-[#c5a059]" />
                  <span>{hasStarted ? 'RESUME VIDEO' : 'PLAY VIDEO'}</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Card Footer: Social Actions (Like, Comment, Save, Share) */}
      <div className="p-4 bg-[#eedcb5]/40 dark:bg-[#1c1611]/80 border-t border-[#c5a059]/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Like Button */}
          <button
            type="button"
            onClick={() => onToggleLike(video.id)}
            className={`px-3.5 py-1.5 rounded-xl border flex items-center gap-1.5 text-xs font-serif font-bold transition-all cursor-pointer ${
              liked
                ? 'bg-red-600 text-white border-red-600 shadow-md'
                : 'bg-[#eedcb5] dark:bg-[#282019] text-[#7c5f3d] dark:text-[#c5a059] border-[#c5a059]/50 hover:bg-red-500/20'
            }`}
          >
            <Heart className={`w-4 h-4 ${liked ? 'fill-current' : ''}`} />
            <span>{likeCount}</span>
          </button>

          {/* Comment Drawer Toggle */}
          <button
            type="button"
            onClick={() => onToggleCommentOpen(video.id)}
            className="px-3.5 py-1.5 rounded-xl bg-[#eedcb5] dark:bg-[#282019] text-[#7c5f3d] dark:text-[#c5a059] border border-[#c5a059]/50 hover:bg-[#c5a059] hover:text-[#1c1611] transition-all flex items-center gap-1.5 text-xs font-serif font-bold cursor-pointer"
          >
            <MessageCircle className="w-4 h-4" />
            <span>{comments.length}</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Save / Bookmark Button */}
          <button
            type="button"
            onClick={() => onToggleSave(video.id)}
            className={`p-2 rounded-xl border transition-all cursor-pointer ${
              saved
                ? 'bg-[#c5a059] text-[#1c1611] border-[#c5a059] shadow-md font-bold'
                : 'bg-[#eedcb5] dark:bg-[#282019] text-[#7c5f3d] dark:text-[#c5a059] border-[#c5a059]/50 hover:bg-[#c5a059]/30'
            }`}
            title={saved ? 'Saved' : 'Save to bookmarks'}
          >
            <Bookmark className={`w-4 h-4 ${saved ? 'fill-current' : ''}`} />
          </button>

          {/* Share Button */}
          <button
            type="button"
            onClick={() => onShare(video)}
            className="p-2 rounded-xl bg-[#eedcb5] dark:bg-[#282019] text-[#7c5f3d] dark:text-[#c5a059] border border-[#c5a059]/50 hover:bg-[#c5a059] hover:text-[#1c1611] transition-all cursor-pointer"
            title="Share Video"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Expandable Comments Drawer */}
      {isCommentOpen && (
        <div className="p-4 bg-[#eedcb5]/60 dark:bg-[#282019] border-t-2 border-[#c5a059]/40 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <h4 className="font-serif-coptic font-bold text-xs text-[#3d2b18] dark:text-[#f5ebd9] uppercase tracking-wider flex items-center gap-1.5">
              <MessageCircle className="w-4 h-4 text-[#c5a059]" />
              Comments ({comments.length})
            </h4>
            <button
              type="button"
              onClick={() => onToggleCommentOpen(video.id)}
              className="p-1 text-[#7c5f3d] dark:text-[#a89379] hover:text-[#3d2b18] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="max-h-60 overflow-y-auto space-y-2.5 pr-1 text-xs no-scrollbar">
            {comments.length === 0 ? (
              <p className="text-center py-4 text-[#7c5f3d] dark:text-[#a89379] font-serif">
                No comments yet. Share your thoughts on this video!
              </p>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="flex gap-2.5 items-start">
                  <img
                    src={c.authorAvatar}
                    alt={c.authorName}
                    className="w-7 h-7 rounded-full object-cover border border-[#c5a059] shrink-0 mt-0.5"
                  />
                  <div className="flex-1 bg-[#f6ebd6] dark:bg-[#1c1611] rounded-2xl p-2.5 border border-[#c5a059]/40">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-serif font-bold text-[#c5a059] text-[11px] uppercase tracking-wider">
                        {c.authorName}
                      </span>
                      <span className="text-[9px] text-[#7c5f3d] dark:text-[#a89379] font-serif">
                        {c.createdAt}
                      </span>
                    </div>
                    <p className="text-[#3d2b18] dark:text-[#f5ebd9] leading-normal text-xs font-serif">
                      {c.text}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleCommentSubmit} className="flex gap-2 pt-2 border-t border-[#c5a059]/30">
            <input
              type="text"
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
              placeholder="Write a spiritual comment..."
              className="flex-1 bg-[#f6ebd6] dark:bg-[#1c1611] border border-[#c5a059] rounded-xl px-3 py-2 text-xs text-[#3d2b18] dark:text-[#f5ebd9] placeholder-[#7c5f3d] dark:placeholder-[#a89379] focus:outline-none"
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
