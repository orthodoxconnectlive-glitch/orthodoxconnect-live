import React, { useState, useEffect, useRef } from 'react';
import { Eye, Radio, Sparkles, Square, Camera, AlertCircle, RefreshCw, VolumeX } from 'lucide-react';
import { addNotification } from '../utils/notifications';
import { useTheme } from '../context/ThemeContext';

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

const DEFAULT_POSTER = 'https://images.unsplash.com/photo-1548625361-1959779df5ff?auto=format&fit=crop&q=80&w=800';

export const BunnyPlayer: React.FC<BunnyPlayerProps> = ({
  mediaStream,
  videoUrl = '',
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
  const { t, language } = useTheme();
  const [hasBlessingRequested, setHasBlessingRequested] = useState<boolean>(false);
  const [localCameraStream, setLocalCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [hasError, setHasError] = useState<boolean>(false);
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(muted ?? true);

  const webcamRef = useRef<HTMLVideoElement | null>(null);
  const directVideoRef = useRef<HTMLVideoElement | null>(null);

  const bunnyLibraryId = import.meta.env.VITE_BUNNY_LIBRARY_ID || '713265';
  const bunnyCdnHost = import.meta.env.VITE_BUNNY_CDN_HOST || 'vz-840ad26e-6fe.b-cdn.net';

  const activeStream = mediaStream || localCameraStream;

  useEffect(() => {
    setHasError(false);
    setIsAudioMuted(muted ?? true);
  }, [videoUrl, muted]);

  // Clean up streams & media connections on unmount
  useEffect(() => {
    return () => {
      if (webcamRef.current) {
        try {
          webcamRef.current.pause();
          webcamRef.current.srcObject = null;
          webcamRef.current.src = '';
        } catch (e) {}
      }
      if (directVideoRef.current) {
        try {
          directVideoRef.current.pause();
          directVideoRef.current.src = '';
        } catch (e) {}
      }
      if (localCameraStream) {
        try {
          localCameraStream.getTracks().forEach((track) => track.stop());
        } catch (e) {}
      }
      const media = document.querySelectorAll<HTMLMediaElement>('video, audio');
      media.forEach((m) => {
        try {
          m.pause();
          m.src = '';
          m.srcObject = null;
        } catch (e) {}
      });
    };
  }, [localCameraStream]);

  useEffect(() => {
    if (webcamRef.current && activeStream) {
      webcamRef.current.srcObject = activeStream;
      webcamRef.current.play().catch(() => {});
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
      console.warn('[BunnyPlayer] Local player webcam error:', err?.message || String(err));
      setCameraError(
        language === 'ar'
          ? 'تعذر الوصول إلى الكاميرا أو الميكروفون.'
          : err?.message || 'Unable to access camera or microphone.'
      );
    }
  };

  const handleEndLocalWebcam = () => {
    if (localCameraStream) {
      try {
        localCameraStream.getTracks().forEach((track) => track.stop());
      } catch (e) {}
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
    }
    if (webcamRef.current) {
      webcamRef.current.muted = false;
    }
  };

  // Determine stream type & format URLs
  let embedSrc = '';
  let directSrc = '';

  if (videoUrl) {
    const sanitized = videoUrl.trim();

    // 1. YouTube Live / Watch / Short Links
    const ytMatch = sanitized.match(
      /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|live\/|v\/))([a-zA-Z0-9_-]{11})/
    );
    if (ytMatch) {
      embedSrc = `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&mute=${isAudioMuted ? 1 : 0}&playsinline=1&rel=0`;
    }
    // 2. Bunny Stream or generic iframe embed
    else if (sanitized.includes('iframe.mediadelivery.net/embed/') || sanitized.includes('/embed/')) {
      const baseUrl = sanitized.split('?')[0];
      embedSrc = `${baseUrl}?autoplay=1&loop=false&muted=${isAudioMuted}&preload=true&responsive=true`;
    }
    // 3. Bunny CDN Video GUID
    else if (/^[0-9a-fA-F-]{10,}$/.test(sanitized) && !sanitized.startsWith('http')) {
      embedSrc = `https://iframe.mediadelivery.net/embed/${bunnyLibraryId}/${sanitized}?autoplay=1&loop=false&muted=${isAudioMuted}&preload=true&responsive=true`;
    }
    // 4. Direct Video Sources (MP4, HLS m3u8, WebM, Stream URLs)
    else if (
      sanitized.startsWith('http://') ||
      sanitized.startsWith('https://') ||
      sanitized.startsWith('blob:') ||
      sanitized.startsWith('data:')
    ) {
      directSrc = sanitized;
    }
  }

  const showEndBroadcastButton = isUserBroadcasting || Boolean(activeStream);

  return (
    <div
      className={`relative rounded-2xl overflow-hidden bg-stone-900 border border-amber-900/40 shadow-xl group ${className}`}
    >
      {/* Top Header Overlay: Live Badge, Viewer Count, End Button */}
      <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          {isLive && (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-600 text-white text-xs font-bold tracking-wide uppercase shadow-lg animate-pulse">
              <Radio className="w-3.5 h-3.5" /> {t('liveParishBadge')}
            </span>
          )}
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-900/80 backdrop-blur-md text-amber-200 text-xs font-medium border border-amber-500/30 shadow-md">
            <Eye className="w-3.5 h-3.5 text-amber-400" /> {viewerCount} {t('watchingCount')}
          </span>
        </div>

        {showEndBroadcastButton && (
          <button
            type="button"
            onClick={handleEndLocalWebcam}
            className="pointer-events-auto px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center gap-2 shadow-2xl transition-all transform hover:scale-105 cursor-pointer border border-red-400/50"
            title="Finish stream and stop device camera/mic"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>{t('endBroadcastNow')}</span>
          </button>
        )}
      </div>

      {/* Video Content */}
      {hasError ? (
        <div className="relative w-full aspect-video bg-[#1c130c] flex flex-col items-center justify-center p-6 text-center border-b border-[#c5a059]/20 overflow-hidden">
          <img
            src={posterUrl || DEFAULT_POSTER}
            alt="Stream Thumbnail"
            className="absolute inset-0 w-full h-full object-cover opacity-20 filter blur-xs"
          />
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-red-950/80 border border-red-500/40 flex items-center justify-center mb-2.5 text-red-400 shadow-inner">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h4 className="text-[#f5ebd9] font-serif font-bold text-sm mb-1 uppercase tracking-wider">
              {language === 'ar' ? 'البث غير متصل حالياً' : 'Stream Unavailable'}
            </h4>
            <p className="text-[#eedcb5]/70 text-xs max-w-sm mb-3 font-serif">
              {language === 'ar'
                ? 'تعذر تشغيل هذا الرابط. قد يكون البث منتهياً أو أن الرابط غير متاح حالياً.'
                : 'Could not connect to this stream URL. The broadcast may be finished or currently offline.'}
            </p>
            <button
              type="button"
              onClick={() => setHasError(false)}
              className="px-3.5 py-1.5 rounded-xl bg-[#3d2b18] hover:bg-[#c5a059] text-[#c5a059] hover:text-[#1c130c] font-serif font-bold text-xs flex items-center gap-1.5 transition-colors border border-[#c5a059]/40 cursor-pointer shadow-md"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{language === 'ar' ? 'إعادة المحاولة' : 'Retry Connection'}</span>
            </button>
          </div>
        </div>
      ) : activeStream ? (
        /* Device Webcam Stream */
        <div className="relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden">
          <video
            ref={webcamRef}
            autoPlay
            playsInline
            muted={isAudioMuted}
            className="w-full h-full object-cover transform scale-x-[-1]"
          />
          <div className="absolute bottom-4 left-4 rtl:left-auto rtl:right-4 z-10 px-3 py-1 rounded-lg bg-stone-950/80 backdrop-blur border border-amber-500/40 text-amber-200 text-xs font-mono">
            {t('liveCameraAndMic')}
          </div>
        </div>
      ) : embedSrc ? (
        /* YouTube / Bunny / External Embed iframe */
        <div className="relative w-full aspect-video bg-black overflow-hidden flex items-center justify-center">
          <iframe
            src={embedSrc}
            className="w-full h-full border-0 relative z-10"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture;"
            allowFullScreen
            title={title || 'Live Stream Broadcast'}
            onError={() => setHasError(true)}
          />
        </div>
      ) : directSrc ? (
        /* Direct Video File / HLS / MP4 Stream */
        <div className="relative w-full aspect-video bg-black flex items-center justify-center">
          <video
            ref={directVideoRef}
            src={directSrc}
            poster={posterUrl || DEFAULT_POSTER}
            controls
            autoPlay
            playsInline
            muted={isAudioMuted}
            onError={() => setHasError(true)}
            className="w-full h-full max-h-[600px] object-contain"
          />

          {isLive && isAudioMuted && (
            <div className="absolute bottom-4 left-4 rtl:left-auto rtl:right-4 z-30">
              <button
                type="button"
                onClick={handleUnmuteAudio}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#c5a059] to-[#8f6e30] hover:from-[#e6d3ab] hover:to-[#c5a059] text-[#1c130c] font-serif font-bold text-xs flex items-center gap-2 shadow-2xl transition-all transform hover:scale-105 active:scale-95 cursor-pointer border border-[#f5ebd9]"
                title="Click to enable audio"
              >
                <VolumeX className="w-4 h-4 text-red-900" />
                <span>{t('unmuteStream')}</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Camera Launcher Fallback */
        <div className="relative w-full aspect-video bg-gradient-to-br from-amber-950 via-stone-900 to-amber-900/80 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-3 shadow-inner">
            <Camera className="w-7 h-7 text-amber-400 animate-pulse" />
          </div>
          <h4 className="text-amber-100 font-serif font-bold text-lg mb-1">
            {title || t('parishServiceBroadcast')}
          </h4>
          <p className="text-stone-400 text-xs max-w-md mb-4 font-serif">
            {t('noStreamAttached')}
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
            <span>{t('launchWebcamStream')}</span>
          </button>
        </div>
      )}

      {/* Priest Blessing Bar */}
      {isLive && (
        <div className="p-3 bg-stone-950/90 border-t border-amber-900/40 flex items-center justify-between text-xs">
          <span className="text-amber-200/90 font-serif flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-400" /> {t('askForPriestBlessing')}
          </span>
          <button
            type="button"
            onClick={() => {
              const nextState = !hasBlessingRequested;
              setHasBlessingRequested(nextState);
              if (nextState) {
                addNotification(
                  {
                    userId: 'all',
                    type: 'system',
                    title: language === 'ar' ? 'طلب بركة الكاهن' : 'Priest Blessing Requested',
                    body:
                      language === 'ar'
                        ? 'طلب أحد أبناء الرعية بركة الكاهن أثناء الخدمة الإلهية.'
                        : 'A parishioner requested a priest blessing during live service.',
                    link: 'live',
                    senderName: language === 'ar' ? 'أحد أبناء الرعية' : 'Parishioner',
                  },
                  'self'
                );
              }
            }}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer font-serif ${
              hasBlessingRequested
                ? 'bg-amber-500 text-stone-950 font-bold'
                : 'bg-stone-800 hover:bg-stone-700 text-amber-300 border border-amber-500/20'
            }`}
          >
            {hasBlessingRequested ? t('blessingRequested') : `🙏 ${t('requestBlessing')}`}
          </button>
        </div>
      )}
    </div>
  );
};
