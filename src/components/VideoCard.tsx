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
  const [progress, setProgress] = useState<number>(0);
  const [isCaptionExpanded, setIsCaptionExpanded] = useState<boolean>(false);

  const elementMediaId = `video-${video.id}`;

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

  const handleToggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (videoRef.current) {
      videoRef.current.muted = nextMuted;
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

  const authorHandle = `@${video.authorName?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'orthodox'}`;

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
      id={`video-card-${video.id}`}
      data-video-id={video.id}
      className="w-full max-w-md mx-auto bg-[#1c1611] rounded-3xl border-2 border-[#c5a059]/50 overflow-hidden shadow-2xl relative flex flex-col select-none"
    >
      {/* Video Display Container with fixed 9:16 aspect ratio */}
      <div 
        onClick={onTogglePlay}
        className="relative w-full aspect-[9/16] bg-black cursor-pointer flex items-center justify-center overflow-hidden"
      >
        {isIframeEmbed ? (
          <iframe
            src={`${rawVideoUrl}?autoplay=${isPlaying ? 1 : 0}&muted=${isMuted ? 1 : 0}&loop=1`}
            loading="lazy"
            className="w-full h-full border-0 pointer-events-auto"
            allow="accelerometer; gyroscope; encrypted-media; picture-in-picture; autoplay;"
            allowFullScreen
            title={video.text || 'Orthodox Video'}
          />
        ) : (
          <video
            ref={videoRef}
            data-media-id={elementMediaId}
            src={rawVideoUrl}
            controls={false}
            loop={true}
            preload="metadata"
            muted={isMuted}
            playsInline
            // @ts-ignore
            webkit-playsinline="true"
            className="w-full h-full object-cover bg-black"
          />
        )}

        {/* Play State Overlay Button */}
        {!isPlaying && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none">
            <div className="w-16 h-16 rounded-full bg-[#c5a059] text-[#1c1611] flex items-center justify-center shadow-2xl border-2 border-[#f5ebd9]">
              <Play className="w-8 h-8 fill-current ml-1" />
            </div>
          </div>
        )}

        {/* Top-Right Mute Button */}
        <button
          type="button"
          onClick={handleToggleMute}
          className="absolute top-3 right-3 z-20 p-2.5 rounded-full bg-black/70 backdrop-blur-md border border-[#c5a059]/60 text-[#f5ebd9] hover:bg-[#c5a059] hover:text-[#1c1611] transition-all cursor-pointer"
        >
          {isMuted ? <VolumeX className="w-4 h-4 text-amber-300" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
        </button>

        {/* Progress Bar */}
        <div className="absolute bottom-0 inset-x-0 h-1 bg-white/20 z-20 pointer-events-none">
          <div
            style={{ width: `${progress}%` }}
            className="h-full bg-gradient-to-r from-[#c5a059] to-[#eedcb5] transition-all duration-100"
          />
        </div>
      </div>

      {/* Clean Metadata Section Below Video */}
      <div className="p-4 bg-[#1c1611] flex flex-col gap-3 border-t border-[#c5a059]/20 text-[#f5ebd9]">
        <div className="flex items-center justify-between">
          <div 
            className="flex items-center gap-3 cursor-pointer"
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
              className="w-10 h-10 rounded-full border border-[#c5a059] object-cover"
            />
            <div>
              <div className="flex items-center gap-1">
                <h4 className="font-serif font-bold text-xs text-[#f5ebd9] uppercase tracking-wider">
                  {authorHandle}
                </h4>
                <CheckCircle2 className="w-3.5 h-3.5 text-[#38bdf8] fill-[#38bdf8] stroke-black" />
              </div>
              <p className="text-[10px] text-[#c5a059] font-serif">
                {video.authorParish || 'Orthodox Parish'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFollow(video.authorName);
            }}
            className={`px-3 py-1 rounded-full text-xs font-serif font-bold uppercase transition-all cursor-pointer ${
              isFollowed ? 'bg-emerald-600 text-white' : 'bg-[#c5a059] text-[#1c1611]'
            }`}
          >
            {isFollowed ? 'Following' : 'Follow'}
          </button>
        </div>

        {/* Caption */}
        {video.text && (
          <div className="text-xs text-[#f5ebd9] font-serif leading-relaxed">
            <p className={isCaptionExpanded ? '' : 'line-clamp-2'}>
              {renderFormattedCaption(video.text)}
            </p>
            {video.text.length > 90 && (
              <button
                type="button"
                onClick={() => setIsCaptionExpanded(!isCaptionExpanded)}
                className="text-[#c5a059] hover:text-white text-[11px] font-bold mt-1 cursor-pointer uppercase tracking-wider block"
              >
                {isCaptionExpanded ? 'less' : 'more'}
              </button>
            )}
          </div>
        )}

        {/* Action Bar (Like, Comment, Save, Share, Delete) */}
        <div className="flex items-center justify-between pt-2 border-t border-[#c5a059]/20 text-xs">
          <button
            type="button"
            onClick={() => onToggleLike(video.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#c5a059]/30 transition-colors cursor-pointer ${
              liked ? 'bg-red-600/20 text-red-400 border-red-500' : 'bg-[#282019] hover:bg-[#c5a059]/20'
            }`}
          >
            <Heart className={`w-4 h-4 ${liked ? 'fill-current' : ''}`} />
            <span className="font-serif font-bold">{formatCount(likeCount)}</span>
          </button>

          <button
            type="button"
            onClick={() => onToggleCommentOpen(video.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#282019] border border-[#c5a059]/30 hover:bg-[#c5a059]/20 transition-colors cursor-pointer"
          >
            <MessageCircle className="w-4 h-4 text-[#c5a059]" />
            <span className="font-serif font-bold">{formatCount(comments.length)}</span>
          </button>

          <button
            type="button"
            onClick={() => onToggleSave(video.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#c5a059]/30 transition-colors cursor-pointer ${
              saved ? 'bg-[#c5a059] text-[#1c1611] font-bold' : 'bg-[#282019] hover:bg-[#c5a059]/20'
            }`}
          >
            <Bookmark className={`w-4 h-4 ${saved ? 'fill-current' : ''}`} />
            <span className="font-serif uppercase text-[10px]">Save</span>
          </button>

          <button
            type="button"
            onClick={() => onShare(video)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#282019] border border-[#c5a059]/30 hover:bg-[#c5a059]/20 transition-colors cursor-pointer"
          >
            <Share2 className="w-4 h-4 text-[#c5a059]" />
            <span className="font-serif uppercase text-[10px]">Share</span>
          </button>

          {canDelete && (
            <button
              type="button"
              onClick={() => onDeleteVideo(video.id)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-red-950/80 border border-red-500/50 text-red-300 hover:bg-red-600 hover:text-white transition-colors cursor-pointer"
              title="Delete Video"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Comment Drawer Sheet */}
      {isCommentOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-x-0 bottom-0 max-h-[72%] h-[380px] bg-[#1c1611]/98 backdrop-blur-2xl border-t-2 border-[#c5a059] rounded-t-3xl p-4 z-50 flex flex-col shadow-2xl text-[#f5ebd9]"
        >
          <div className="flex items-center justify-between pb-3 border-b border-[#c5a059]/30">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-[#c5a059]" />
              <h4 className="font-serif font-bold text-xs text-[#f5ebd9] uppercase tracking-wider">
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

          <div className="flex items-center gap-2 py-2 overflow-x-auto border-b border-[#c5a059]/20">
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
              <div className="text-center py-8">
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
                    className="w-7 h-7 rounded-full object-cover border border-[#c5a059] shrink-0 mt-0.5"
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
