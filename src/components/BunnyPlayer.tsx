import React, { useState, useEffect, useRef } from 'react';
import { Eye, Radio, Sparkles, Square, Camera, AlertCircle, RefreshCw, Volume2, VolumeX } from 'lucide-react';
import { addNotification } from '../utils/notifications';

interface BunnyPlayerProps {
  mediaStream?: MediaStream | null;
  videoUrl?: string;
  posterUrl?: string;
  title?: string;
  isLive?: boolean;
  viewerCount?: number;
  className?: string;
  autoplay?: boolean;
  muted?: boolean;
  isUserBroadcasting?: boolean;
  onEndBroadcast?: () => void;
}

export const BunnyPlayer: React.FC<BunnyPlayerProps> = ({
  mediaStream,
  videoUrl,
  posterUrl,
  title,
  isLive = false,
  viewerCount = 142,
  className = '',
  autoplay = false,
  muted = true,
  isUserBroadcasting = false,
  onEndBroadcast,
}) => {
  const [hasBlessingRequested, setHasBlessingRequested] = useState<boolean>(false);
  const [localCameraStream, setLocalCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [hasError, setHasError] = useState<boolean>(false);
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(true);

  const webcamRef = useRef<HTMLVideoElement | null>(null);
  const directVideoRef = useRef<HTMLVideoElement | null>(null);

  // Bunny Stream Library & CDN Host
  const bunnyLibraryId = '713265';
  const bunnyCdnHost = import.meta.env.VITE_BUNNY_CDN_HOST || 'vz-840ad26e-6fe.b-cdn.net';

  const activeStream = mediaStream || localCameraStream;

  // Reset error & mute state when videoUrl changes
  useEffect(() => {
    setHasError(false);
    setIsAudioMuted(true);
  }, [videoUrl]);

  // Clean up streams & media connections on unmount
  useEffect(() => {
    return () => {
      if (webcamRef.current) {
        try {
          webcamRef.current.pause();
          webcamRef.current.srcObject = null;
        } catch (e) {
          // ignore
        }
      }
      if (directVideoRef.current) {
        try {
          directVideoRef.current.pause();
          directVideoRef.current.src = '';
        } catch (e) {
          // ignore
        }
      }
      if (localCameraStream) {
        localCameraStream.getTracks().forEach((track) => track.stop());
      }
      const media = document.querySelectorAll<HTMLMediaElement>('video, audio');
      media.forEach((m) => {
        try {
          m.pause();
        } catch (e) {
          // ignore
        }
      });
    };
  }, [localCameraStream]);

  // Attach MediaStream to video element whenever activeStream or ref changes
  useEffect(() => {
    if (webcamRef.current && activeStream) {
      webcamRef.current.srcObject = activeStream;
    }
  }, [activeStream]);

  const handleStartLocalWebcam = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      setLocalCameraStream(stream);
    } catch (err: any) {
      console.warn('[BunnyPlayer] Local player webcam error:', err);
      setCameraError(err?.message || 'Unable to access camera or microphone.');
    }
  };

  const handleEndLocalWebcam = () => {
    if (localCameraStream) {
      localCameraStream.getTracks().forEach((track) => track.stop());
      setLocalCameraStream(null);
    }
    if (onEndBroadcast) {
      onEndBroadcast();
    }
  };

  const handleUnmuteAudio = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsAudioMuted(false);
    if (directVideoRef.current) {
      directVideoRef.current.muted = false;
      directVideoRef.current.dataset.userInitiated = 'true';
    }
    if (webcamRef.current) {
      webcamRef.current.muted = false;
      webcamRef.current.dataset.userInitiated = 'true';
    }
  };

  // Graceful error handler: STOP playback and set error state without calling .play()
  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    console.warn('[BunnyPlayer] Video stream loading error:', e);
    setHasError(true);
  };

  // Determine stream embed type & sanitize URLs (strictly eliminating bunnyinfra.net)
  let embedSrc = '';
  let directSrc = '';
  let isFallbackDummyUrl = false;

  if (videoUrl) {
    let sanitized = videoUrl.trim();
    if (sanitized.includes('bunnyinfra.net')) {
      sanitized = sanitized.replace(/([a-zA-Z0-9_-]+)\.bunnyinfra\.net/g, bunnyCdnHost);
    }

    if (
      sanitized === 'webcam-feed' ||
      sanitized.includes('preview-stream') ||
      sanitized.includes('vespers-stream') ||
      sanitized.includes('chanting-stream')
    ) {
      isFallbackDummyUrl = true;
    } else if (sanitized.includes('iframe.mediadelivery.net')) {
      embedSrc = sanitized;
    } else if (sanitized.includes(bunnyCdnHost) || sanitized.includes('b-cdn.net')) {
      if (/\.(mp4|m3u8|webm|mov)(\?.*)?$/i.test(sanitized)) {
        directSrc = sanitized;
      } else {
        const guidMatch = sanitized.match(/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}|[0-9a-fA-F-]{12,})/);
        if (guidMatch) {
          embedSrc = `https://iframe.mediadelivery.net/embed/${bunnyLibraryId}/${guidMatch[1]}`;
        } else {
          embedSrc = sanitized;
        }
      }
    } else if (/^[0-9a-fA-F-]{10,}$/.test(sanitized)) {
      embedSrc = `https://iframe.mediadelivery.net/embed/${bunnyLibraryId}/${sanitized}`;
    } else if (sanitized.startsWith('http://') || sanitized.startsWith('https://') || sanitized.startsWith('blob:') || sanitized.startsWith('data:')) {
      directSrc = sanitized;
    } else {
      isFallbackDummyUrl = true;
    }
  } else {
    isFallbackDummyUrl = true;
  }

  return (
    <div className={`relative rounded-2xl overflow-hidden bg-stone-900 border border-amber-900/40 shadow-xl group ${className}`}>
      {/* Top Header Overlay: Live Badge, Viewer Count, and END BROADCAST Button */}
      <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          {isLive && (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-600 text-white text-xs font-bold tracking-wide uppercase shadow-lg animate-pulse">
              <Radio className="w-3.5 h-3.5 animate-spin" /> LIVE PARISH BROADCAST
            </span>
          )}
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-900/80 backdrop-blur-md text-amber-200 text-xs font-medium border border-amber-500/30 shadow-md">
            <Eye className="w-3.5 h-3.5 text-amber-400" /> {viewerCount} Viewers
          </span>
        </div>

        {/* End Broadcast Button */}
        {(isUserBroadcasting || activeStream || onEndBroadcast) && (
          <button
            type="button"
            onClick={handleEndLocalWebcam}
            className="pointer-events-auto px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center gap-2 shadow-2xl transition-all transform hover:scale-105 cursor-pointer border border-red-400/50"
            title="Finish stream and stop device camera/mic"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>End Broadcast</span>
          </button>
        )}
      </div>

      {/* Video Display Content */}
      {hasError ? (
        /* Graceful Error Fallback: Stops play loops and displays helpful status */
        <div className="relative w-full aspect-video bg-[#1c130c] flex flex-col items-center justify-center p-6 text-center border-b border-[#c5a059]/20">
          <div className="w-12 h-12 rounded-full bg-red-950/80 border border-red-500/40 flex items-center justify-center mb-2.5 text-red-400 shadow-inner">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h4 className="text-[#f5ebd9] font-serif font-bold text-sm mb-1">
            Media Stream Unavailable
          </h4>
          <p className="text-[#eedcb5]/70 text-xs max-w-sm mb-3 font-serif">
            This video or live stream could not be loaded from Bunny CDN. The link may have expired or is currently offline.
          </p>
          <button
            type="button"
            onClick={() => setHasError(false)}
            className="px-3.5 py-1.5 rounded-xl bg-[#3d2b18] hover:bg-[#c5a059] text-[#c5a059] hover:text-[#1c130c] font-serif font-bold text-xs flex items-center gap-1.5 transition-colors border border-[#c5a059]/40 cursor-pointer shadow-md"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Connection</span>
          </button>
        </div>
      ) : activeStream ? (
        /* Render Active Webcam / Microphone Media Stream */
        <div className="relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden">
          <video
            ref={webcamRef}
            data-user-initiated="true"
            autoPlay
            playsInline
            muted={isAudioMuted}
            className="w-full h-full object-cover transform scale-x-[-1]"
          />
          <div className="absolute bottom-4 left-4 z-10 px-3 py-1 rounded-lg bg-stone-950/80 backdrop-blur border border-amber-500/40 text-amber-200 text-xs font-mono">
            🔴 Live Device Camera & Microphone
          </div>
        </div>
      ) : embedSrc ? (
        /* Render Bunny Stream Embed iframe (canonical iframe.mediadelivery.net endpoint) */
        <div className="relative w-full aspect-video bg-black">
          <iframe
            src={embedSrc}
            loading="lazy"
            className="w-full h-full border-0"
            allow="accelerometer; gyroscope; encrypted-media; picture-in-picture;"
            allowFullScreen
            title={title || 'Bunny Stream Live Video'}
          />
        </div>
      ) : directSrc ? (
        /* Render Direct Video Source with strict autoplay blocker and error trap */
        <div className="relative w-full aspect-video bg-black flex items-center justify-center">
          <video
            ref={directVideoRef}
            data-media-id={videoUrl || 'bunny-direct-video'}
            src={directSrc}
            poster={posterUrl}
            controls
            playsInline
            autoPlay={false}
            preload="none"
            muted={isAudioMuted}
            onError={handleVideoError}
            className="w-full h-full max-h-[600px] object-contain"
          />

          {/* Unmute Live Stream Overlay */}
          {isLive && isAudioMuted && (
            <div className="absolute bottom-4 left-4 z-30">
              <button
                type="button"
                onClick={handleUnmuteAudio}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#c5a059] to-[#8f6e30] hover:from-[#e6d3ab] hover:to-[#c5a059] text-[#1c130c] font-serif font-bold text-xs flex items-center gap-2 shadow-2xl transition-all transform hover:scale-105 active:scale-95 cursor-pointer border border-[#f5ebd9]"
                title="Click to enable audio"
              >
                <VolumeX className="w-4 h-4 text-red-900" />
                <span>Unmute Live Stream</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Fallback: Device Camera Feed / Interactive Live Feed Launcher */
        <div className="relative w-full aspect-video bg-gradient-to-br from-amber-950 via-stone-900 to-amber-900/80 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-3 shadow-inner">
            <Camera className="w-7 h-7 text-amber-400 animate-pulse" />
          </div>
          <h4 className="text-amber-100 font-serif font-bold text-lg mb-1">
            {title || 'Parish Divine Service Broadcast'}
          </h4>
          <p className="text-stone-400 text-xs max-w-md mb-4 font-serif">
            No external Bunny stream link attached. Click below to launch your device camera and stream live directly to your parish.
          </p>

          {cameraError && (
            <div className="mb-3 p-2 rounded-lg bg-red-950/80 border border-red-500/40 text-red-200 text-xs flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{cameraError}</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleStartLocalWebcam}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-bold text-xs flex items-center gap-2 shadow-xl transition-all transform hover:scale-105 cursor-pointer font-serif uppercase tracking-wider"
          >
            <Radio className="w-4 h-4" />
            <span>Launch Device Webcam Stream</span>
          </button>
        </div>
      )}

      {/* Priest Blessing Request Bar */}
      {isLive && (
        <div className="p-3 bg-stone-950/90 border-t border-amber-900/40 flex items-center justify-between text-xs">
          <span className="text-amber-200/90 font-serif flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-400" /> Ask for priest blessing during divine service
          </span>
          <button
            type="button"
            onClick={() => {
              const nextState = !hasBlessingRequested;
              setHasBlessingRequested(nextState);
              if (nextState) {
                addNotification({
                  userId: 'all',
                  type: 'system',
                  title: 'Priest Blessing Requested',
                  body: 'A parishioner requested a priest blessing during live service.',
                  link: 'live',
                });
              }
            }}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer font-serif ${
              hasBlessingRequested
                ? 'bg-amber-500 text-stone-950 font-bold'
                : 'bg-stone-800 hover:bg-stone-700 text-amber-300 border border-amber-500/20'
            }`}
          >
            {hasBlessingRequested ? '✓ Blessing Requested' : '🙏 Request Blessing'}
          </button>
        </div>
      )}
    </div>
  );
};
