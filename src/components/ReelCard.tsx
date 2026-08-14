import React, { useState, useEffect, useRef, useMemo } from 'react';
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
import { useMedia } from '../context/MediaContext';
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
  isUnmuted?: boolean;
  onToggleMute?: (reelId: string) => void;
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
}

export const ReelCard: React.FC<ReelCardProps> = ({
  reel,
  isUnmuted = false,
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
}) => {
  const { profile } = useAuth();
  const { pauseAllMedia, setActiveMediaId } = useMedia();
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(!isUnmuted);
  const [hasError, setHasError] = useState<boolean>(false);
  const [tapFeedback, setTapFeedback] = useState<'play' | 'pause' | 'mute' | 'unmute' | null>(null);
  const [showHeartAnim, setShowHeartAnim] = useState<boolean>(false);
  const [newCommentText, setNewCommentText] = useState<string>('');

  const elementMediaId = `reel-${reel.id}`;
  const libraryId = import.meta.env.VITE_BUNNY_LIBRARY_ID || '713265';
  const bunnyCdnHost = (import.meta.env.VITE_BUNNY_CDN_HOST || 'vz-840ad26e-6fe.b-cdn.net')
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '');

  // Normalized video URL and Bunny GUID extractor
  const videoSource = useMemo(() => {
    const raw = reel.video || reel.image || '';
    if (!raw || typeof raw !== 'string') return { url: '', isBunny: false, iframeUrl: '' };

    const trimmed = raw.trim();
    const guidRegex = /([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/i;
    const match = trimmed.match(guidRegex);
    const guid = match ? match[1] : null;

    const isBunny =
      trimmed.includes('bunnycdn.com') ||
      trimmed.includes('b-cdn.net') ||
      trimmed.includes('mediadelivery.net') ||
      trimmed.includes('bunnyinfra.net') ||
      (guid !== null && !trimmed.startsWith('http') && !trimmed.startsWith('data:') && !trimmed.startsWith('blob:'));

    if (isBunny && guid) {
      return {
        url: `https://${bunnyCdnHost}/${guid}/play_720p.mp4`,
        isBunny: true,
        iframeUrl: `https://iframe.mediadelivery.net/embed/${libraryId}/${guid}?autoplay=true&loop=true&muted=${isAudioMuted ? 'true' : 'false'}`,
      };
    }

    return {
      url: trimmed.length > 5 ? trimmed : 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      isBunny: false,
      iframeUrl: '',
    };
  }, [reel.video, reel.image, bunnyCdnHost, libraryId, isAudioMuted]);

  // Unmount cleanup
  useEffect(() => {
    return () => {
      if (videoRef.current) {
        try {
          videoRef.current.pause();
          videoRef.current.currentTime = 0;
          videoRef.current.removeAttribute('src');
          videoRef.current.load();
        } catch (e) {}
      }
    };
  }, []);

  // Sync mute state changes from props
  useEffect(() => {
    const muted = !isUnmuted;
    setIsAudioMuted(muted);
    if (videoRef.current) {
      videoRef.current.muted = muted;
      videoRef.current.volume = muted ? 0 : 1.0;
    }
  }, [isUnmuted]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => {
      setIsPlaying(true);
      setActiveMediaId(elementMediaId);
    };

    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
    };
  }, [elementMediaId, setActiveMediaId]);

  const handleTogglePlay = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
      setTapFeedback('pause');
      setTimeout(() => setTapFeedback(null), 800);
    } else {
      video.dataset.userInitiated = 'true';
      pauseAllMedia(video);
      setActiveMediaId(elementMediaId);

      // Keep user's chosen audio mute status intact
      video.muted = isAudioMuted;
      video.volume = isAudioMuted ? 0 : 1.0;

      video
        .play()
        .then(() => {
          setIsPlaying(true);
          setTapFeedback('play');
          setTimeout(() => setTapFeedback(null), 800);
        })
        .catch((err) => {
          console.warn('[ReelCard] Playback blocked, retrying muted:', err);
          video.muted = true;
          video.volume = 0;
          setIsAudioMuted(true);
          video.play().catch((e) => console.warn('[ReelCard] Second play attempt failed:', e));
        });
    }
  };

  const handleToggleMuteBtn = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextMuted = !isAudioMuted;
    setIsAudioMuted(nextMuted);

    if (videoRef.current) {
      videoRef.current.muted = nextMuted;
      videoRef.current.volume = nextMuted ? 0 : 1.0;
      if (!nextMuted && videoRef.current.paused) {
        videoRef.current.play().catch((err) => console.warn('[ReelCard] Audio unmute play error:', err));
      }
    }
    onToggleMute?.(reel.id);
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
      className="w-full h-[calc(100dvh-5.5rem)] min-h-[580px] max-h-[820px] relative flex flex-col justify-between bg-black rounded-3xl border-2 border-[#c5a059] overflow-hidden shadow-2xl group select-none my-auto"
    >
      {/* Background Video Player Container */}
      <div
        onClick={() => !hasError && handleTogglePlay()}
        onDoubleClick={handleDoubleTapVideo}
        className="absolute inset-0 z-0 cursor-pointer flex items-center justify-center bg-black"
      >
        {hasError ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-[#1c130c]">
            <div className="w-14 h-14 rounded-full bg-red-950/80 border border-red-500/40 flex items-center justify-center mb-3 text-red-400 shadow-inner">
              <X className="w-7 h-7" />
            </div>
            <h4 className="text-[#f5ebd9] font-serif font-bold text-sm mb-1 uppercase tracking-wider">
              Playback Unavailable
            </h4>
            <p className="text-[#eedcb5]/70 text-xs max-w-xs font-serif mb-4">
              The media source for this video could not be loaded or is offline.
            </p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setHasError(false);
                setIsPlaying(false);
              }}
              className="px-4 py-2 rounded-xl bg-[#3d2b18] hover:bg-[#c5a059] text-[#c5a059] hover:text-[#1c130c] font-serif font-bold text-xs uppercase tracking-wider transition-colors border border-[#c5a059]/40 cursor-pointer shadow-md"
            >
              Retry
            </button>
          </div>
        ) : videoSource.isBunny && !videoSource.url.endsWith('.mp4') ? (
          <BunnyPlayer
            videoUrl={videoSource.url}
            title={reel.text}
            autoplay={isPlaying}
            muted={isAudioMuted}
            className="w-full h-full object-cover"
          />
        ) : (
          <video
            ref={videoRef}
            data-media-id={elementMediaId}
            src={videoSource.url}
            controls={false}
            autoPlay={false}
            muted={isAudioMuted}
            // @ts-ignore
            playsInline
            webkit-playsinline="true"
            x5-playsinline="true"
            loop
            preload="auto"
            onError={(e) => {
              console.warn('[ReelCard] Video element error:', e);
              setHasError(true);
              setIsPlaying(false);
            }}
            className="w-full h-full object-cover bg-black"
          />
        )}

        {/* Prominent Play Overlay */}
        {!isPlaying && !hasError && (
          <div
            onClick={(e) => handleTogglePlay(e)}
            className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/45 hover:bg-black/35 transition-all cursor-pointer group/play"
          >
            <div className="relative flex items-center justify-center">
              <div className="absolute w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-[#c5a059]/30 animate-ping opacity-75 pointer-events-none" />
              <button
                type="button"
                className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-[#c5a059] to-[#8f6e30] hover:from-[#e6d3ab] hover:to-[#c5a059] text-[#1c130c] shadow-2xl flex items-center justify-center border-2 border-[#f5ebd9] transition-transform transform group-hover/play:scale-110 active:scale-95 cursor-pointer"
                title="Tap to Play"
              >
                <Play className="w-8 h-8 sm:w-10 sm:h-10 fill-current ml-1 text-[#1c130c]" />
              </button>
            </div>
            <div className="mt-4 px-4 py-1.5 rounded-full bg-[#3d2b18]/95 backdrop-blur-md border border-[#c5a059]/60 text-[#f5ebd9] text-xs font-serif font-bold uppercase tracking-wider shadow-2xl flex items-center gap-2">
              <Play className="w-3.5 h-3.5 fill-current text-[#c5a059]" />
              <span>TAP TO PLAY</span>
            </div>
          </div>
        )}

        {/* Tap Feedback Animation */}
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

        {/* Double Tap Heart */}
        {showHeartAnim && (
          <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
            <Heart className="w-24 h-24 text-red-600 fill-current animate-ping drop-shadow-2xl" />
          </div>
        )}
      </div>

      {/* Top Floating Badge & Mute Toggle */}
      <div className="relative z-20 p-4 w-full flex items-center justify-between pointer-events-none">
        <span className="px-3 py-1 rounded-full bg-[#1c1611]/85 backdrop-blur-md text-[#c5a059] text-[10px] font-serif uppercase tracking-wider font-bold border border-[#c5a059] flex items-center gap-1.5 shadow-md">
          <Church className="w-3.5 h-3.5 text-[#c5a059]" />
          {reel.authorParish || 'Orthodox Parish'}
        </span>

        <button
          type="button"
          onClick={handleToggleMuteBtn}
          className={`pointer-events-auto px-3 py-1.5 rounded-full backdrop-blur-md border text-xs font-serif font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95 shadow-2xl cursor-pointer ${
            isAudioMuted
              ? 'bg-black/75 border-red-500/70 text-red-300 hover:bg-black/90 hover:border-red-400'
              : 'bg-black/75 border-[#c5a059] text-[#c5a059] hover:bg-black/90 hover:border-[#e6d3ab]'
          }`}
          title={isAudioMuted ? 'Tap to Unmute Audio' : 'Tap to Mute Audio'}
          aria-label="Toggle Sound"
        >
          {isAudioMuted ? (
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
      </div>

      {/* Bottom Info Overlay */}
      <div className="relative z-20 p-4 w-full bg-gradient-to-t from-black/95 via-black/60 to-transparent space-y-2 mt-auto">
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
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFollow(reel.authorName);
              }}
              className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] shadow-md border border-black cursor-pointer transition-transform ${
                isFollowed ? 'bg-emerald-600' : 'bg-red-600 hover:scale-110'
              }`}
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
            <h4 className="font-serif font-bold text-xs text-[#f5ebd9] uppercase tracking-wider leading-tight">
              {reel.authorName}
            </h4>
            <p className="text-[9px] text-[#c5a059] font-serif uppercase tracking-widest">
              @{reel.authorName.toLowerCase().replace(/[^a-z0-9]/g, '')}
            </p>
          </div>
        </div>

        <p className="text-xs text-[#f5ebd9] line-clamp-3 leading-relaxed font-serif pr-12">
          {reel.text}{' '}
          <span className="text-[#c5a059] font-bold">
            #Orthodox #Faith #Feast #Coptic
          </span>
        </p>

        <div className="flex items-center gap-2 pt-1">
          <Music className="w-3.5 h-3.5 text-[#c5a059] animate-bounce" />
          <div className="overflow-hidden w-48 text-[10px] text-[#f5ebd9] whitespace-nowrap font-serif uppercase tracking-wider">
            <p className="inline-block animate-marquee">
              🎵 Orthodox Hymn — Midnight Prayer (Original Audio)
            </p>
          </div>
        </div>
      </div>

      {/* Floating Right Action Stack */}
      <div className="absolute right-3 bottom-12 z-30 flex flex-col items-center gap-3.5 text-white">
        <button
          type="button"
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

        <button
          type="button"
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

        {onOpenMessengerWithUser && (
          <button
            type="button"
            onClick={() => onOpenMessengerWithUser(reel.authorId || reel.authorName)}
            className="flex flex-col items-center gap-1 group cursor-pointer"
          >
            <div className="p-3 rounded-full bg-[#1c1611]/80 backdrop-blur-md border border-[#c5a059] text-[#c5a059] hover:bg-[#c5a059] hover:text-[#3d2b18] transition-all">
              <MessageSquare className="w-5 h-5" />
            </div>
            <span className="text-[9px] font-bold text-[#f5ebd9] shadow-sm font-serif uppercase">Chat</span>
          </button>
        )}

        <button
          type="button"
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

        <button
          type="button"
          onClick={() => onShare(reel)}
          className="flex flex-col items-center gap-1 group cursor-pointer"
        >
          <div className="p-3 rounded-full bg-[#1c1611]/80 backdrop-blur-md border border-[#c5a059] text-[#c5a059] hover:bg-[#c5a059] hover:text-[#3d2b18] transition-all">
            <Share2 className="w-5 h-5" />
          </div>
          <span className="text-[9px] font-bold text-[#f5ebd9] shadow-sm font-serif uppercase">Share</span>
        </button>

        {canDelete && (
          <button
            type="button"
            onClick={() => onDeleteReel(reel.id)}
            className="flex flex-col items-center gap-1 group cursor-pointer"
          >
            <div className="p-3 rounded-full bg-red-900/80 backdrop-blur-md border border-red-500 text-red-300 hover:bg-red-600 hover:text-white transition-all">
              <Trash2 className="w-5 h-5" />
            </div>
            <span className="text-[9px] font-bold text-red-300 shadow-sm font-serif uppercase">Delete</span>
          </button>
        )}

        <div className="mt-1 w-9 h-9 rounded-full bg-[#1c1611] p-1 border-2 border-[#c5a059] shadow-2xl animate-spin">
          <img
            src={reel.authorAvatar}
            alt="Disc"
            className="w-full h-full rounded-full object-cover"
          />
        </div>
      </div>

      {/* Slide-up Comment Drawer */}
      {isCommentOpen && (
        <div className="absolute inset-x-0 bottom-0 z-40 h-[65%] bg-[#1c1611]/95 backdrop-blur-2xl rounded-t-3xl border-t-2 border-[#c5a059] p-4 flex flex-col justify-between shadow-2xl animate-slide-up">
          <div className="flex items-center justify-between pb-3 border-b border-[#c5a059]/30">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-[#c5a059]" />
              <h3 className="font-serif font-bold text-xs text-[#f5ebd9] uppercase tracking-wider">
                Comments ({comments.length})
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onToggleCommentOpen(reel.id)}
              className="p-1 rounded-full text-[#f5ebd9] hover:bg-[#282019] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto my-3 space-y-3 pr-1 text-xs no-scrollbar">
            {comments.length === 0 ? (
              <p className="text-[#a89379] text-center py-6 text-[11px] font-serif uppercase">
                No comments yet. Encourage this video!
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
