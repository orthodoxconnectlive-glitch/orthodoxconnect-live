import React, { useState, useEffect, useRef } from 'react';
import { X, Radio, Camera, AlertCircle, RefreshCw, SwitchCamera } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { liveStreamsApi } from '../lib/api';
import { addNotification } from '../utils/notifications';

export interface StreamData {
  title: string;
  host_parish: string;
  media_url: string;
  parish?: string;
  videoUrl?: string;
  mediaStream?: MediaStream | null;
  isWebcam?: boolean;
  recordId?: string | null;
  // Bunny Stream Live (true live) fields
  isBunnyLive?: boolean;
  bunnyStreamId?: string | null;
  playbackUrlHls?: string | null;
  rtmpUrl?: string | null;
  streamKey?: string | null;
}

interface GoLiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartStream: (streamData: StreamData, mediaStream?: MediaStream | null) => void;
}

export const GoLiveModal: React.FC<GoLiveModalProps> = ({
  isOpen,
  onClose,
  onStartStream,
}) => {
  const { profile } = useAuth();
  const { t, language } = useTheme();

  const [title, setTitle] = useState(
    language === 'ar' ? 'القداس الإلهي والعظة الروحية' : 'Divine Liturgy & Homily'
  );
  const [hostParish, setHostParish] = useState(
    profile?.parish || (language === 'ar' ? 'كاتدرائية القديس جاورجيوس' : 'St. George Cathedral')
  );
  const [mediaUrl, setMediaUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Bunny Stream Live (true live) state
  const [bunnyStream, setBunnyStream] = useState<any | null>(null);
  const [bunnyError, setBunnyError] = useState<string | null>(null);
  const [isStartingBunny, setIsStartingBunny] = useState(false);
  const [showRtmpDetails, setShowRtmpDetails] = useState(false);

  // Camera lens mode ('user' = front / selfie, 'environment' = back / world)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  // Webcam & Microphone states
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const isStreamTransferredRef = useRef<boolean>(false);

  // Helper to safely stop current tracks
  const stopTracks = (streamToStop?: MediaStream | null) => {
    const s = streamToStop || mediaStream;
    if (s) {
      s.getTracks().forEach((track) => track.stop());
    }
  };

  // Function to initialize or switch webcam stream
  const initWebcam = async (targetFacingMode: 'user' | 'environment' = facingMode) => {
    setHasCameraPermission(null);
    setCameraError(null);

    // Stop existing stream before re-requesting a different camera
    stopTracks();

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error(
          language === 'ar'
            ? 'أجهزة الكاميرا والميكروفون غير مدعومة على هذا المتصفح/الجهاز.'
            : 'Webcam & audio media devices are not supported on this browser/device.'
        );
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: targetFacingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: true,
      });

      setMediaStream(stream);
      setHasCameraPermission(true);

      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
      }
    } catch (err: any) {
      console.warn('Webcam permission error:', err);
      setHasCameraPermission(false);
      setCameraError(
        err?.message ||
          (language === 'ar'
            ? 'تم رفض إذن الوصول إلى الكاميرا أو الميكروفون. يرجى السماح بالوصول في إعدادات المتصفح.'
            : 'Camera or microphone permission was denied. Please allow camera access in your browser.')
      );
    }
  };

  // Request camera and microphone when modal opens or facing mode changes
  useEffect(() => {
    if (isOpen) {
      isStreamTransferredRef.current = false;
      initWebcam(facingMode);
    } else {
      // Clean up camera stream if modal closed without starting broadcast
      if (!isStreamTransferredRef.current) {
        stopTracks();
      }
      setMediaStream(null);
      setHasCameraPermission(null);
      setCameraError(null);
    }

    return () => {
      if (!isStreamTransferredRef.current) {
        stopTracks();
      }
    };
  }, [isOpen, facingMode]);

  // Ensure video element receives stream whenever mediaStream changes
  useEffect(() => {
    const video = videoPreviewRef.current;
    if (video && mediaStream) {
      // Set muted via DOM property — JSX muted attr is unreliable and blocks autoplay.
      try { video.muted = true; } catch (e) {}
      if (video.srcObject !== mediaStream) {
        video.srcObject = mediaStream;
      }
      const tryPlay = () => video.play().catch(() => {});
      if (video.readyState >= 1) {
        tryPlay();
      } else {
        const onLoaded = () => { tryPlay(); video.removeEventListener('loadedmetadata', onLoaded); };
        video.addEventListener('loadedmetadata', onLoaded);
      }
    }
  }, [mediaStream]);

  if (!isOpen) return null;

  // --- Bunny true-live setup screen (after stream created, before going live) ---
  if (bunnyStream) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
        <div className="relative w-full max-w-lg bg-stone-950 border border-red-500/40 rounded-2xl p-6 shadow-2xl text-stone-100">
          <div className="flex items-center gap-3 mb-5 pb-3 border-b border-amber-900/40">
            <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-400 animate-pulse">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-lg text-amber-100">
                {language === 'ar' ? 'البث المباشر جاهز' : 'Live Stream Ready'}
              </h3>
              <p className="text-xs text-stone-400">
                {language === 'ar'
                  ? 'صِل برنامج البث ثم اضغط "بدء البث" ليتمكن المشاهدون من المتابعة'
                  : 'Connect your encoder, then press "Start Broadcasting" so viewers can watch'}
              </p>
            </div>
          </div>

          <div className="space-y-3 text-xs mb-5">
            <div>
              <label className="block text-amber-300 font-semibold mb-1">
                {language === 'ar' ? 'عنوان البث' : 'Stream Title'}
              </label>
              <p className="text-amber-100 font-semibold">{bunnyStream.title}</p>
            </div>

            <div className="rounded-xl bg-stone-900 border border-amber-900/30 p-3 space-y-2">
              <p className="text-amber-300 font-semibold">
                {language === 'ar' ? 'إعدادات برنامج البث (OBS / Larix)' : 'Encoder Settings (OBS / Larix)'}
              </p>
              <div>
                <span className="text-stone-400">RTMP URL:</span>
                <code className="block mt-0.5 p-2 rounded bg-black/50 text-green-300 font-mono text-[11px] break-all select-all">
                  {bunnyStream.rtmp_url}
                </code>
              </div>
              <div>
                <span className="text-stone-400">{language === 'ar' ? 'مفتاح البث:' : 'Stream Key:'}</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <code className="flex-1 p-2 rounded bg-black/50 text-green-300 font-mono text-[11px] break-all select-all">
                    {showRtmpDetails ? bunnyStream.stream_key : '••••••••••••••••'}
                  </code>
                  <button
                    type="button"
                    onClick={() => setShowRtmpDetails((v) => !v)}
                    className="px-2.5 py-2 rounded-lg bg-stone-800 text-amber-300 text-[11px] font-bold border border-amber-500/30 cursor-pointer"
                  >
                    {showRtmpDetails
                      ? (language === 'ar' ? 'إخفاء' : 'Hide')
                      : (language === 'ar' ? 'إظهار' : 'Show')}
                  </button>
                </div>
              </div>
              <p className="text-[10px] text-stone-500">
                {language === 'ar'
                  ? 'ملاحظة: بث كاميرا المتصفح مباشرة قيد التطوير — استخدم تطبيق بث RTMP على هاتفك في الوقت الحالي.'
                  : 'Note: direct phone-browser camera ingest is coming soon — use an RTMP streamer app on your phone for now.'}
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={handleCancelBunnySetup}
              className="px-4 py-2 rounded-xl bg-stone-800 text-stone-300 font-semibold cursor-pointer"
            >
              {t('cancel')}
            </button>
            <button
              type="button"
              onClick={handleStartBunnyBroadcast}
              disabled={isStartingBunny}
              className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold shadow-lg flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Radio className="w-4 h-4" />
              <span>
                {isStartingBunny
                  ? (language === 'ar' ? 'جارٍ البدء...' : 'Starting...')
                  : (language === 'ar' ? 'بدء البث المباشر' : 'Start Broadcasting')}
              </span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleToggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  const handleClose = () => {
    if (!isStreamTransferredRef.current) {
      stopTracks();
    }
    setMediaStream(null);
    onClose();
  };

  const handleGoLiveNow = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault();

    const capturedTitle = title.trim();
    const capturedHostParish =
      hostParish.trim() || profile?.parish || (language === 'ar' ? 'رعية أرثوذكسية' : 'Orthodox Parish');
    const capturedMediaUrl = mediaUrl.trim();

    if (!capturedTitle) {
      alert(language === 'ar' ? 'يرجى إدخال عنوان للبث المباشر.' : 'Please enter a broadcast title.');
      return;
    }

    setIsSubmitting(true);
    setBunnyError(null);

    // STEP 1: Try true live via Bunny Stream Live.
    // If Bunny isn't configured/approved yet, fall back to the local-recording flow below.
    let bunny: any = null;
    try {
      bunny = await liveStreamsApi.createBunny({
        title: capturedTitle,
        description: capturedHostParish,
        recordVod: true,
        host_parish: capturedHostParish,
        priest_name: profile?.full_name || (language === 'ar' ? 'الكاهن / مقدم الخدمة' : 'Priest / Host'),
      });
    } catch (err: any) {
      console.warn('[GoLive] Bunny live unavailable, using local fallback:', err?.code || err?.message);
      if (err?.code && err.code !== 'BUNNY_NOT_CONFIGURED') {
        setBunnyError(err?.message || null);
      }
      // fall through to local recording flow
    } finally {
      setIsSubmitting(false);
    }

    if (bunny) {
      // True-live path: show RTMP ingest details so the broadcaster can connect
      // an encoder (OBS, Larix Broadcaster, etc.).
      // TODO: WebRTC-to-RTMP bridge so the phone browser camera can ingest directly
      // without a separate encoder app.
      setBunnyStream(bunny);
      setShowRtmpDetails(false);
      // Dispatch live stream notification to all users
      addNotification({
        userId: 'all',
        type: 'system',
        title: `🔴 ${capturedHostParish} ${language === 'ar' ? 'في بث مباشر' : 'is LIVE'}`,
        body: capturedTitle,
        senderName: profile?.full_name || (language === 'ar' ? 'مسؤول البث' : 'Parish Host'),
        senderAvatar: profile?.avatar_url,
        link: 'live',
      });
      return; // wait for user to press "Start Broadcasting"
    }

    // STEP 2 (fallback): local webcam recording flow (existing behavior)
    const isWebcamActive = !capturedMediaUrl && !!mediaStream;

    const streamPayload: StreamData = {
      title: capturedTitle,
      host_parish: capturedHostParish,
      media_url: capturedMediaUrl || 'webcam-feed',
      parish: capturedHostParish,
      videoUrl: capturedMediaUrl || 'webcam-feed',
      mediaStream: isWebcamActive ? mediaStream : null,
      isWebcam: isWebcamActive,
    };

    // Mark stream as transferred so modal cleanup doesn't stop tracks
    if (isWebcamActive) {
      isStreamTransferredRef.current = true;
    }

    try {
      const created = await liveStreamsApi.create({
        title: streamPayload.title,
        host_parish: streamPayload.host_parish,
        media_url: streamPayload.media_url,
        priest_name: profile?.full_name || (language === 'ar' ? 'الكاهن / مقدم الخدمة' : 'Priest / Host'),
        is_live: true,
        created_at: new Date().toISOString(),
      });
      streamPayload.recordId = (created as any)?.id || null;

      // Dispatch live stream notification to all users
      addNotification({
        userId: 'all',
        type: 'system',
        title: `🔴 ${streamPayload.host_parish} ${language === 'ar' ? 'في بث مباشر' : 'is LIVE'}`,
        body: streamPayload.title,
        senderName: profile?.full_name || (language === 'ar' ? 'مسؤول البث' : 'Parish Host'),
        senderAvatar: profile?.avatar_url,
        link: 'live',
      });
    } catch (err: any) {
      console.warn('Cloudflare D1 live_streams insert notice/fallback:', err);
    }

    // Pass stream data and active MediaStream to parent view
    onStartStream(streamPayload, isWebcamActive ? mediaStream : null);

    // Reset fields and close modal
    setTitle('');
    setHostParish('');
    setMediaUrl('');
    onClose();
  };

  // Start a Bunny true-live broadcast (marks D1 status='live' so viewers can watch)
  const handleStartBunnyBroadcast = async () => {
    if (!bunnyStream) return;
    setIsStartingBunny(true);
    try {
      await liveStreamsApi.startBunny(bunnyStream.id);
    } catch (err) {
      console.warn('[GoLive] startBunny failed:', err);
    } finally {
      setIsStartingBunny(false);
    }

    const streamPayload: StreamData = {
      title: bunnyStream.title,
      host_parish: bunnyStream.host_parish,
      media_url: 'bunny-live',
      parish: bunnyStream.host_parish,
      videoUrl: 'bunny-live',
      mediaStream: null,
      isWebcam: false,
      recordId: bunnyStream.id,
      isBunnyLive: true,
      bunnyStreamId: bunnyStream.bunny_stream_id,
      playbackUrlHls: bunnyStream.playback_url_hls,
      rtmpUrl: bunnyStream.rtmp_url,
      streamKey: bunnyStream.stream_key,
    };

    onStartStream(streamPayload, null);

    // Reset fields and close modal
    setTitle('');
    setHostParish('');
    setMediaUrl('');
    setBunnyStream(null);
    onClose();
  };

  // Cancel a created-but-not-started Bunny stream
  const handleCancelBunnySetup = async () => {
    if (bunnyStream?.id) {
      try {
        await liveStreamsApi.endBunny(bunnyStream.id);
      } catch {}
    }
    setBunnyStream(null);
    setBunnyError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg bg-stone-950 border border-amber-600/40 rounded-2xl p-6 shadow-2xl text-stone-100 text-left rtl:text-right">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 rtl:right-auto rtl:left-4 p-1.5 rounded-full text-stone-400 hover:text-amber-300 hover:bg-stone-900 transition-colors cursor-pointer z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5 pb-3 border-b border-amber-900/40">
          <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-400 animate-pulse">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-serif font-bold text-lg text-amber-100">
              {language === 'ar' ? 'بدء بث رعوي مباشر' : 'Start Live Parish Broadcast'}
            </h3>
            <p className="text-xs text-stone-400">
              {language === 'ar'
                ? 'بث القداس الإلهي أو العظات عبر كاميرا الجهاز أو Bunny Stream'
                : 'Broadcast Divine Liturgy or Homilies via Web Camera or Bunny Stream'}
            </p>
          </div>
        </div>

        {/* Camera Preview Frame */}
        <div className="relative aspect-video rounded-xl bg-stone-900 border border-amber-900/40 overflow-hidden flex flex-col items-center justify-center mb-5 shadow-inner">
          {hasCameraPermission === true && mediaStream ? (
            <div className="relative w-full h-full bg-black">
              <video
                ref={videoPreviewRef}
                data-user-initiated="true"
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover transition-transform duration-300 ${
                  facingMode === 'user' ? 'transform scale-x-[-1]' : 'transform scale-x-100'
                }`}
              />

              {/* Top Left: Live Preview Badge */}
              <div className="absolute top-3 left-3 rtl:left-auto rtl:right-3 flex items-center gap-2 z-10">
                <span className="px-2.5 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-bold tracking-wider uppercase animate-pulse">
                  {language === 'ar' ? 'معاينة حية للكاميرا' : 'WEBCAM LIVE PREVIEW'}
                </span>
              </div>

              {/* Top Right: Camera Switch Button */}
              <button
                type="button"
                onClick={handleToggleFacingMode}
                className="absolute top-3 right-3 rtl:right-auto rtl:left-3 px-2.5 py-1.5 rounded-lg bg-stone-900/85 hover:bg-stone-800 text-amber-300 border border-amber-500/40 text-xs font-semibold flex items-center gap-1.5 backdrop-blur shadow-lg transition-transform active:scale-95 cursor-pointer z-10"
                title={
                  facingMode === 'user'
                    ? language === 'ar'
                      ? 'التبديل إلى الكاميرا الخلفية'
                      : 'Switch to Back Camera'
                    : language === 'ar'
                    ? 'التبديل إلى الكاميرا الأمامية'
                    : 'Switch to Front Camera'
                }
              >
                <SwitchCamera className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  {facingMode === 'user'
                    ? language === 'ar'
                      ? 'الخلفية'
                      : 'Back'
                    : language === 'ar'
                    ? 'الأمامية'
                    : 'Front'}
                </span>
              </button>

              {/* Bottom Right: Feed Status Badge */}
              <div className="absolute bottom-3 right-3 rtl:right-auto rtl:left-3 px-2 py-1 rounded bg-stone-900/80 backdrop-blur border border-amber-500/30 text-[10px] text-amber-300 font-mono">
                {language === 'ar' ? 'بث بدقة 720p جاهز' : '720p HD Feed Active'}
              </div>
            </div>
          ) : hasCameraPermission === null ? (
            <div className="flex flex-col items-center justify-center p-6 text-center space-y-2">
              <Camera className="w-10 h-10 text-amber-400 animate-bounce" />
              <p className="text-xs font-bold text-amber-200">
                {language === 'ar' ? 'جارٍ طلب إذن الكاميرا والميكروفون...' : 'Requesting Camera & Microphone Access...'}
              </p>
              <p className="text-[10px] text-stone-400 max-w-xs">
                {language === 'ar'
                  ? 'يرجى الموافقة على أذونات المتصفح للبث مباشرة من كاميرا جهازك.'
                  : 'Please approve browser permissions to stream directly from your device camera.'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-6 text-center space-y-2">
              <AlertCircle className="w-10 h-10 text-red-400" />
              <p className="text-xs font-bold text-red-300">
                {language === 'ar' ? 'تعذر الوصول إلى الكاميرا' : 'Camera Access Unavailable'}
              </p>
              <p className="text-[10px] text-stone-400 max-w-xs">
                {cameraError ||
                  (language === 'ar'
                    ? 'يرجى تفعيل أذونات الكاميرا في إعدادات المتصفح.'
                    : 'Please enable camera permissions in your browser settings.')}
              </p>
              <button
                type="button"
                onClick={() => initWebcam(facingMode)}
                className="mt-2 px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-amber-300 text-[11px] font-semibold flex items-center gap-1.5 border border-amber-500/30 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{language === 'ar' ? 'إعادة محاولة الاتصال بالكاميرا' : 'Retry Camera Access'}</span>
              </button>
            </div>
          )}
        </div>

        <form onSubmit={handleGoLiveNow} className="space-y-4 text-xs">
          <div>
            <label className="block text-amber-300 font-semibold mb-1">
              {language === 'ar' ? 'عنوان البث المباشر' : 'Broadcast Title'}
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={language === 'ar' ? 'مثال: القداس الإلهي للقديس يوحنا ذهبي الفم' : 'e.g. Divine Liturgy of St. John Chrysostom'}
              className="w-full p-2.5 rounded-xl bg-stone-900 border border-amber-900/30 text-amber-100 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-amber-300 font-semibold mb-1">
              {language === 'ar' ? 'الكنيسة / الدير المستضيف' : 'Host Parish / Monastery'}
            </label>
            <input
              type="text"
              required
              value={hostParish}
              onChange={(e) => setHostParish(e.target.value)}
              placeholder={language === 'ar' ? 'مثال: كاتدرائية القديس جاورجيوس' : 'e.g. St. George Cathedral'}
              className="w-full p-2.5 rounded-xl bg-stone-900 border border-amber-900/30 text-amber-100 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-amber-300 font-semibold mb-1">
              {language === 'ar' ? 'رابط فيديو خارجي أو معرّف Bunny Stream (اختياري)' : 'External Video Link or Bunny Stream GUID (Optional)'}
            </label>
            <input
              type="text"
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              placeholder={
                language === 'ar'
                  ? 'اتركه فارغاً للبث من كاميرا الجهاز، أو الصق رابط فيديو'
                  : 'Leave blank to use live device camera, or paste Bunny Stream embed link'
              }
              className="w-full p-2.5 rounded-xl bg-stone-900 border border-amber-900/30 text-amber-100 focus:outline-none focus:border-amber-500 font-mono text-[11px]"
            />
            <p className="text-[10px] text-stone-400 mt-1">
              {language === 'ar'
                ? 'إذا تُرِك فارغاً، سيتم بث الصورة مباشرة من كاميرا جهازك الظاهرة أعلاه.'
                : 'If left blank, your active Web Camera feed above will be broadcast live.'}
            </p>
          </div>

          <div className="pt-3 flex justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 rounded-xl bg-stone-800 text-stone-300 font-semibold cursor-pointer"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold shadow-lg flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Radio className="w-4 h-4" />
              <span>
                {isSubmitting
                  ? language === 'ar'
                    ? 'جارٍ بدء البث...'
                    : 'Starting Live...'
                  : language === 'ar'
                  ? 'ابدأ البث الآن'
                  : 'Go Live Now'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
