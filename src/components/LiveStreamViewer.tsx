import React, { useEffect, useRef, useState } from 'react';
import { X, Radio, Eye, AlertCircle, Loader2 } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

declare global {
  interface Window {
    Hls?: any;
  }
}

const HLS_CDN = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.13/dist/hls.min.js';

function loadHlsJs(): Promise<any> {
  return new Promise((resolve, reject) => {
    if (window.Hls) {
      resolve(window.Hls);
      return;
    }
    const existing = document.querySelector(`script[src="${HLS_CDN}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(window.Hls));
      existing.addEventListener('error', reject);
      return;
    }
    const script = document.createElement('script');
    script.src = HLS_CDN;
    script.async = true;
    script.onload = () => resolve(window.Hls);
    script.onerror = () => reject(new Error('Failed to load HLS player'));
    document.head.appendChild(script);
  });
}

interface LiveStreamViewerProps {
  playbackUrl: string;
  title: string;
  parish?: string;
  viewerCount?: number;
  onClose: () => void;
}

export const LiveStreamViewer: React.FC<LiveStreamViewerProps> = ({
  playbackUrl,
  title,
  parish,
  viewerCount,
  onClose,
}) => {
  const { language } = useTheme();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<any>(null);
  const [status, setStatus] = useState<'loading' | 'playing' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playbackUrl) return;
    let cancelled = false;

    const attach = async () => {
      try {
        // Safari / iOS plays HLS natively
        if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = playbackUrl;
          video.addEventListener('playing', () => !cancelled && setStatus('playing'));
          video.addEventListener('error', () => {
            if (!cancelled) {
              setStatus('error');
              setErrorMsg(language === 'ar' ? 'تعذر تشغيل البث المباشر.' : 'Could not play the live stream.');
            }
          });
          try {
            video.muted = false;
            await video.play();
          } catch {
            // Autoplay with sound blocked — try muted
            try {
              video.muted = true;
              await video.play();
            } catch {}
          }
          return;
        }

        const Hls = await loadHlsJs();
        if (cancelled) return;
        if (!Hls || !Hls.isSupported()) {
          setStatus('error');
          setErrorMsg(language === 'ar' ? 'متصفحك لا يدعم تشغيل البث المباشر.' : 'Your browser cannot play live streams.');
          return;
        }

        const hls = new Hls({
          maxBufferLength: 30,
          liveSyncDurationCount: 3,
        });
        hlsRef.current = hls;
        hls.on(Hls.Events.ERROR, (_evt: any, data: any) => {
          if (cancelled) return;
          if (data?.fatal) {
            setStatus('error');
            setErrorMsg(language === 'ar' ? 'انقطع البث المباشر.' : 'The live stream was interrupted.');
          }
        });
        hls.loadSource(playbackUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, async () => {
          try {
            await video.play();
            if (!cancelled) setStatus('playing');
          } catch {
            try {
              video.muted = true;
              await video.play();
              if (!cancelled) setStatus('playing');
            } catch {}
          }
        });
      } catch (err: any) {
        if (!cancelled) {
          setStatus('error');
          setErrorMsg(err?.message || 'Player failed to load.');
        }
      }
    };

    attach();

    return () => {
      cancelled = true;
      try {
        hlsRef.current?.destroy();
      } catch {}
      hlsRef.current = null;
    };
  }, [playbackUrl, language]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
      <div className="relative w-full max-w-3xl bg-stone-950 border border-red-500/40 rounded-2xl overflow-hidden shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-2 rounded-full bg-black/60 text-stone-300 hover:text-white hover:bg-black/80 transition-colors cursor-pointer"
          aria-label={language === 'ar' ? 'إغلاق' : 'Close'}
        >
          <X className="w-5 h-5" />
        </button>

        <div className="relative aspect-video bg-black">
          <video
            ref={videoRef}
            controls
            playsInline
            className="w-full h-full"
            data-user-initiated="true"
          />

          {status === 'loading' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60">
              <Loader2 className="w-10 h-10 text-red-400 animate-spin" />
              <p className="text-sm text-stone-300 font-semibold">
                {language === 'ar' ? 'جارٍ الاتصال بالبث المباشر...' : 'Connecting to live stream...'}
              </p>
            </div>
          )}

          {status === 'error' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 p-6 text-center">
              <AlertCircle className="w-10 h-10 text-red-400" />
              <p className="text-sm text-stone-200 font-semibold">{errorMsg}</p>
              <button
                onClick={onClose}
                className="mt-2 px-4 py-2 rounded-xl bg-stone-800 text-stone-200 text-xs font-bold cursor-pointer"
              >
                {language === 'ar' ? 'إغلاق' : 'Close'}
              </button>
            </div>
          )}

          <div className="absolute top-3 left-3 flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-red-600 text-white text-xs font-bold tracking-wider uppercase animate-pulse flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5" />
              {language === 'ar' ? 'مباشر' : 'LIVE'}
            </span>
            {typeof viewerCount === 'number' && (
              <span className="px-2.5 py-1 rounded-full bg-black/60 text-stone-200 text-xs font-bold flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" /> {viewerCount}
              </span>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-stone-800">
          <h3 className="font-serif font-bold text-amber-100 text-base">{title}</h3>
          {parish && <p className="text-xs text-stone-400 mt-1">{parish}</p>}
        </div>
      </div>
    </div>
  );
};
