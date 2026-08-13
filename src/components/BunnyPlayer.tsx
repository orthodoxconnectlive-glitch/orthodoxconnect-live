import React, { useState, useEffect, useRef } from 'react';
import { Eye, Radio, Sparkles, Square, Camera, AlertCircle } from 'lucide-react';
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
  isUserBroadcasting = false,
  onEndBroadcast,
}) => {
  const [hasBlessingRequested, setHasBlessingRequested] = useState<boolean>(false);
  const [localCameraStream, setLocalCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const webcamRef = useRef<HTMLVideoElement | null>(null);

  // Bunny Stream CDN Library ID: 713265
  const bunnyLibraryId = '713265';

  const activeStream = mediaStream || localCameraStream;

  // Attach MediaStream to video element whenever activeStream or ref changes
  useEffect(() => {
    if (webcamRef.current && activeStream) {
      webcamRef.current.srcObject = activeStream;
    }
  }, [activeStream]);

  // Clean up local camera stream if enabled inside BunnyPlayer
  useEffect(() => {
    return () => {
      if (localCameraStream) {
        localCameraStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [localCameraStream]);

  const handleStartLocalWebcam = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      setLocalCameraStream(stream);
    } catch (err: any) {
      console.warn('Local player webcam error:', err);
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

  // Determine stream embed type
  let embedSrc = '';
  let isDirectVideo = false;
  let isFallbackDummyUrl = false;

  if (videoUrl) {
    const trimmed = videoUrl.trim();
    if (
      trimmed === 'webcam-feed' ||
      trimmed.includes('preview-stream') ||
      trimmed.includes('vespers-stream') ||
      trimmed.includes('chanting-stream')
    ) {
      isFallbackDummyUrl = true;
    } else if (
      trimmed.includes('iframe.mediadelivery.net') ||
      trimmed.includes('bunnycdn.com') ||
      trimmed.includes('b-cdn.net')
    ) {
      embedSrc = trimmed;
    } else if (/^[0-9a-fA-F-]{10,}$/.test(trimmed)) {
      embedSrc = `https://iframe.mediadelivery.net/embed/${bunnyLibraryId}/${trimmed}`;
    } else if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      isDirectVideo = true;
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
      {activeStream ? (
        /* Render Active Webcam / Microphone Media Stream */
        <div className="relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden">
          <video
            ref={webcamRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover transform scale-x-[-1]"
          />
          <div className="absolute bottom-4 left-4 z-10 px-3 py-1 rounded-lg bg-stone-950/80 backdrop-blur border border-amber-500/40 text-amber-200 text-xs font-mono">
            🔴 Live Device Camera & Microphone
          </div>
        </div>
      ) : embedSrc ? (
        /* Render Bunny Stream Embed iframe */
        <div className="relative w-full aspect-video bg-black">
          <iframe
            src={embedSrc}
            loading="lazy"
            className="w-full h-full border-0"
            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
            allowFullScreen
            title={title || 'Bunny Stream Live Video'}
          />
        </div>
      ) : isDirectVideo ? (
        /* Render Direct Video Source */
        <div className="relative w-full aspect-video bg-black flex items-center justify-center">
          <video
            data-media-id={videoUrl || 'bunny-direct-video'}
            src={videoUrl}
            poster={posterUrl}
            controls
            playsInline
            autoPlay={autoplay}
            className="w-full h-full max-h-[600px] object-contain"
          />
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
          <p className="text-stone-400 text-xs max-w-md mb-4">
            No external Bunny stream link attached. Click below to launch your device camera and stream live directly to your parish.
          </p>

          {cameraError && (
            <div className="mb-3 p-2 rounded-lg bg-red-950/80 border border-red-500/40 text-red-200 text-xs flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{cameraError}</span>
            </div>
          )}

          <button
            onClick={handleStartLocalWebcam}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-bold text-xs flex items-center gap-2 shadow-xl transition-all transform hover:scale-105 cursor-pointer"
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
            className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
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

