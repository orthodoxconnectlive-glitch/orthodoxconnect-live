import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Radio, Video, Volume2, VolumeX, Maximize, AlertCircle, RefreshCw } from 'lucide-react';
import { useMedia } from '../context/MediaContext';
import { BunnyPlayer } from './BunnyPlayer';

interface BroadcastCardProps {
  videoUrl: string;
  title?: string;
  posterUrl?: string;
  authorName?: string;
  authorParish?: string;
  isLive?: boolean;
  mediaId?: string;
  className?: string;
}

export const BroadcastCard: React.FC<BroadcastCardProps> = ({
  videoUrl,
  title,
  posterUrl,
  authorName,
  authorParish,
  isLive = false,
  mediaId,
  className = '',
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [hasStarted, setHasStarted] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  const { pauseAllMedia, setActiveMediaId } = useMedia();

  const elementMediaId = mediaId || `broadcast-${videoUrl}`;
  const bunnyCdnHost = import.meta.env.VITE_BUNNY_CDN_HOST || 'vz-840ad26e-6fe.b-cdn.net';

  const isBunnyEmbed =
    videoUrl.includes('bunnycdn.com') ||
    videoUrl.includes('iframe.mediadelivery.net') ||
    videoUrl.includes('mediadelivery.net') ||
    videoUrl.includes(bunnyCdnHost) ||
    videoUrl.includes('b-cdn.net') ||
    videoUrl.includes('bunnyinfra.net');

  // Reset error when URL changes
  useEffect(() => {
    setHasError(false);
    setIsPlaying(false);
    setHasStarted(false);
  }, [videoUrl]);

  // Synchronize state with video element events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

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

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
    };
  }, [elementMediaId, setActiveMediaId]);

  // Explicit Play tap handler: pauses any other playing media first
  const handleExplicitPlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasError) return;
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      // Pause all other media in the feed and app
      pauseAllMedia(video);
      setActiveMediaId(elementMediaId);
      video.play().catch((err) => {
        console.warn('[BroadcastCard] Playback was prevented:', err);
      });
    }
  };

  // Graceful error handler: Stop playback and set error state without calling .play()
  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    console.warn('[BroadcastCard] Video loading error:', e);
    setHasError(true);
    setIsPlaying(false);
    // Crucial: DO NOT call .play() inside onError handler
  };

  const handleToggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    videoRef.current.muted = nextMuted;
  };

  const handleToggleFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch((err) => {
        console.warn('Error requesting fullscreen:', err);
      });
    } else {
      document.exitFullscreen().catch((err) => {
        console.warn('Error exiting fullscreen:', err);
      });
    }
  };

  // If using Bunny CDN embed or iframe
  if (isBunnyEmbed) {
    return (
      <div id={elementMediaId} className={`rounded-2xl overflow-hidden shadow-xl ${className}`}>
        <BunnyPlayer
          videoUrl={videoUrl}
          title={title}
          isLive={isLive}
          autoplay={false}
          muted={true}
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      id={elementMediaId}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`relative rounded-2xl overflow-hidden bg-black border-2 border-[#c5a059]/40 shadow-xl group ${className}`}
    >
      {hasError ? (
        /* Graceful error fallback card */
        <div className="w-full aspect-video min-h-[220px] bg-[#1c130c] flex flex-col items-center justify-center p-6 text-center border border-red-900/30">
          <div className="w-12 h-12 rounded-full bg-red-950/80 border border-red-500/40 flex items-center justify-center mb-2.5 text-red-400">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h4 className="text-[#f5ebd9] font-serif font-bold text-sm mb-1">
            Broadcast Video Unavailable
          </h4>
          <p className="text-[#eedcb5]/70 text-xs max-w-sm mb-3 font-serif">
            Unable to stream this video file. The source link may be offline or in an unsupported format.
          </p>
          <button
            type="button"
            onClick={() => {
              setHasError(false);
              setIsPlaying(false);
            }}
            className="px-3.5 py-1.5 rounded-xl bg-[#3d2b18] hover:bg-[#c5a059] text-[#c5a059] hover:text-[#1c130c] font-serif font-bold text-xs flex items-center gap-1.5 transition-colors border border-[#c5a059]/40 cursor-pointer shadow-md"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Connection</span>
          </button>
        </div>
      ) : (
        <>
          {/* Video Element: AutoPlay explicitly false, Preload none, Muted by default */}
          <video
            ref={videoRef}
            data-media-id={elementMediaId}
            src={videoUrl}
            poster={posterUrl}
            controls={hasStarted}
            playsInline
            autoPlay={false}
            preload="none"
            muted={isMuted}
            onError={handleVideoError}
            className="w-full h-auto max-h-[520px] object-contain bg-black rounded-2xl cursor-pointer"
            onClick={handleExplicitPlay}
          />

          {/* Top Badges: Broadcast Type, Author Parish */}
          <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
            <div className="flex items-center gap-2">
              {isLive ? (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-600/90 backdrop-blur-sm text-white text-[10px] font-bold uppercase tracking-wider shadow-md animate-pulse">
                  <Radio className="w-3 h-3 animate-spin" /> Live Broadcast
                </span>
              ) : (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#3d2b18]/90 backdrop-blur-sm text-[#c5a059] border border-[#c5a059]/40 text-[10px] font-serif font-bold uppercase tracking-wider shadow-md">
                  <Video className="w-3 h-3 text-[#c5a059]" /> Recorded Broadcast
                </span>
              )}
              {authorParish && (
                <span className="hidden sm:inline-block px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-sm text-[#f5ebd9] text-[10px] font-serif border border-white/10">
                  {authorParish}
                </span>
              )}
            </div>

            {hasStarted && (
              <div className="flex items-center gap-1.5 pointer-events-auto">
                <button
                  type="button"
                  onClick={handleToggleMute}
                  className="p-1.5 rounded-full bg-black/60 hover:bg-black/90 text-[#f5ebd9] backdrop-blur-sm border border-white/20 transition-all cursor-pointer"
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={handleToggleFullscreen}
                  className="p-1.5 rounded-full bg-black/60 hover:bg-black/90 text-[#f5ebd9] backdrop-blur-sm border border-white/20 transition-all cursor-pointer"
                  title="Fullscreen"
                >
                  <Maximize className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Explicit Large Center Play Button Overlay when Paused / Not Started */}
          {!isPlaying && (
            <div
              onClick={handleExplicitPlay}
              className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/40 hover:bg-black/30 transition-all cursor-pointer group"
            >
              <div className="relative flex items-center justify-center">
                {/* Pulsing golden aura */}
                <div className="absolute w-20 h-20 rounded-full bg-[#c5a059]/30 animate-ping opacity-60 pointer-events-none" />

                <button
                  type="button"
                  className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-[#c5a059] to-[#8f6e30] hover:from-[#e6d3ab] hover:to-[#c5a059] text-[#1c130c] shadow-2xl flex items-center justify-center border-2 border-[#f5ebd9] transition-transform transform group-hover:scale-110 active:scale-95 cursor-pointer"
                  title="Play Recorded Broadcast"
                  aria-label="Play Recorded Broadcast"
                >
                  <Play className="w-8 h-8 sm:w-10 sm:h-10 fill-current ml-1 text-[#1c130c]" />
                </button>
              </div>

              <div className="mt-4 px-4 py-1.5 rounded-full bg-[#3d2b18]/90 backdrop-blur-md border border-[#c5a059]/50 text-[#f5ebd9] text-xs font-serif font-bold uppercase tracking-wider shadow-lg flex items-center gap-2">
                <span>{hasStarted ? 'Resume Broadcast' : 'Play Broadcast'}</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
