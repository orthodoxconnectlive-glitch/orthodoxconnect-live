import React, { useState, useEffect, useRef } from 'react';
import { Radio, Eye, PlusCircle, Heart, Share2, Flame, CheckCircle, Square, Link2, X, Send } from 'lucide-react';
import { BunnyPlayer } from '../components/BunnyPlayer';
import { ParishLiveChat } from '../components/ParishLiveChat';
import { GoLiveModal, StreamData } from '../components/GoLiveModal';
import { liveStreamsApi } from '../lib/api';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

interface LiveStreamItem {
  id: string;
  title: string;
  parish: string;
  priestName: string;
  viewers: number;
  videoUrl: string;
  isLive: boolean;
}

const INITIAL_STREAMS_EN: LiveStreamItem[] = [
  {
    id: 'stream-1',
    title: 'Divine Liturgy of St. John Chrysostom & Homily',
    parish: 'Holy Trinity Cathedral, Boston',
    priestName: 'Fr. Nicholas Vasileiou',
    viewers: 284,
    videoUrl: 'https://iframe.mediadelivery.net/embed/713265/preview-stream',
    isLive: true,
  },
  {
    id: 'stream-2',
    title: 'Great Vespers & Litya for the Holy Transfiguration',
    parish: 'St. George Antiochian Cathedral, Damascus',
    priestName: 'Fr. Gabriel Haddad',
    viewers: 195,
    videoUrl: 'https://iframe.mediadelivery.net/embed/713265/vespers-stream',
    isLive: true,
  },
  {
    id: 'stream-3',
    title: 'Orthodox Sacred Chanting & Holy Liturgy Live',
    parish: 'St. Vladimir Orthodox Seminary',
    priestName: 'Fr. Chad Hatfield',
    viewers: 312,
    videoUrl: 'https://iframe.mediadelivery.net/embed/713265/chanting-stream',
    isLive: true,
  },
];

const INITIAL_STREAMS_AR: LiveStreamItem[] = [
  {
    id: 'stream-1',
    title: 'القداس الإلهي للقديس يوحنا فم الذهب والعظة الروحية',
    parish: 'كاتدرائية الثالوث الأقدس',
    priestName: 'الأب نقولا فاسيليو',
    viewers: 284,
    videoUrl: 'https://iframe.mediadelivery.net/embed/713265/preview-stream',
    isLive: true,
  },
  {
    id: 'stream-2',
    title: 'صلاة الغروب الكبرى والليتية لعيد التجلي الإلهي',
    parish: 'كاتدرائية القديس جاورجيوس، دمشق',
    priestName: 'الأب جبرائيل حداد',
    viewers: 195,
    videoUrl: 'https://iframe.mediadelivery.net/embed/713265/vespers-stream',
    isLive: true,
  },
  {
    id: 'stream-3',
    title: 'ترانيم بيزنطية مقدسة والقداس الإلهي المباشر',
    parish: 'معهد القديس فلاديمير اللاهوتي',
    priestName: 'الأب تشاد هاتفيلد',
    viewers: 312,
    videoUrl: 'https://iframe.mediadelivery.net/embed/713265/chanting-stream',
    isLive: true,
  },
];

const LOCAL_STORAGE_KEY = 'orthodox_live_streams_v2';

export const LiveBroadcastView: React.FC = () => {
  const { t, language } = useTheme();
  const { profile } = useAuth();

  const defaultStreams = language === 'ar' ? INITIAL_STREAMS_AR : INITIAL_STREAMS_EN;

  const [streams, setStreams] = useState<LiveStreamItem[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Error reading local live streams:', e);
    }
    return defaultStreams;
  });

  useEffect(() => {
    setStreams((prev) => {
      const isArabic = language === 'ar';
      const targetDefaults = isArabic ? INITIAL_STREAMS_AR : INITIAL_STREAMS_EN;
      return prev.map((s) => {
        const match = targetDefaults.find((d) => d.id === s.id);
        if (match) {
          return { ...s, title: match.title, parish: match.parish, priestName: match.priestName };
        }
        return s;
      });
    });
  }, [language]);

  const [activeStreamId, setActiveStreamId] = useState<string>(() => streams[0]?.id || 'stream-1');
  const [isGoLiveOpen, setIsGoLiveOpen] = useState(false);
  const [isShareLinkOpen, setIsShareLinkOpen] = useState(false);
  
  // Custom Live Stream Form State
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkParish, setLinkParish] = useState(profile?.parish || '');
  const [linkCelebrant, setLinkCelebrant] = useState(profile?.full_name || '');
  const [isSubmittingLink, setIsSubmittingLink] = useState(false);

  const [likeCount, setLikeCount] = useState<number>(142);
  const [isLiked, setIsLiked] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Active Broadcast State
  const [activeWebcamStream, setActiveWebcamStream] = useState<MediaStream | null>(null);
  const [isUserBroadcasting, setIsUserBroadcasting] = useState<boolean>(false);
  const playerRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    return () => {
      if (playerRef.current) {
        try {
          playerRef.current.pause();
          playerRef.current.srcObject = null;
          playerRef.current.src = '';
        } catch (e) {}
      }
      if (activeWebcamStream) {
        try {
          activeWebcamStream.getTracks().forEach((track) => track.stop());
        } catch (e) {}
      }
      const media = document.querySelectorAll<HTMLMediaElement>('video, audio');
      media.forEach((m) => {
        try {
          m.pause();
          m.muted = true;
          m.src = '';
          m.srcObject = null;
        } catch (e) {}
      });
      const iframes = document.querySelectorAll<HTMLIFrameElement>('iframe');
      iframes.forEach((ifr) => {
        try {
          if (ifr.src.includes('mediadelivery.net') || ifr.src.includes('bunny')) {
            ifr.src = 'about:blank';
          }
        } catch (e) {}
      });
    };
  }, [activeWebcamStream]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    async function fetchRemoteStreams() {
      try {
        const data = await liveStreamsApi.getAll();

        if (data && data.length > 0) {
          const mapped: LiveStreamItem[] = data.map((row) => ({
            id: row.id || `stream-${Date.now()}`,
            title: row.title || (language === 'ar' ? 'خدمة الرعية المباشرة' : 'Parish Live Service'),
            parish: row.host_parish || row.parish || (language === 'ar' ? 'الكنيسة الأرثوذكسية' : 'Orthodox Church'),
            priestName: row.priest_name || (language === 'ar' ? 'الكاهن الخادم' : 'Priest / Host'),
            viewers: row.viewers_count || row.viewers || 1,
            videoUrl: row.media_url || row.video_url || row.videoUrl || 'https://iframe.mediadelivery.net/embed/713265/preview-stream',
            isLive: row.is_live ?? true,
          }));

          setStreams((prev) => {
            const combined = [...mapped];
            prev.forEach((p) => {
              if (!combined.some((c) => c.id === p.id)) {
                combined.push(p);
              }
            });
            return combined;
          });
        }
      } catch (err) {
        console.warn('Live streams query notice:', err);
      }
    }
    fetchRemoteStreams();
  }, [language]);

  const activeStream = streams.find((s) => s.id === activeStreamId) || streams[0] || defaultStreams[0];

  const handleStartStream = (data: StreamData, mediaStream?: MediaStream | null) => {
    const newStreamId = 'stream-' + Date.now();
    const newStream: LiveStreamItem = {
      id: newStreamId,
      title: data.title,
      parish: data.host_parish || data.parish || (language === 'ar' ? 'الرعية الأرثوذكسية' : 'Orthodox Parish'),
      priestName: language === 'ar' ? 'أنت (الكاهن / المستضيف)' : 'You (Priest / Host)',
      viewers: 1,
      videoUrl: data.media_url || data.videoUrl || 'webcam-feed',
      isLive: true,
    };

    if (mediaStream) {
      setActiveWebcamStream(mediaStream);
    }
    setIsUserBroadcasting(true);

    const updated = [newStream, ...streams];
    setStreams(updated);
    setActiveStreamId(newStreamId);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {}
    showToast(language === 'ar' ? 'بدأ البث المباشر بنجاح!' : 'Live broadcast started successfully!');
  };

  const handleShareCustomLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkUrl.trim() || !linkTitle.trim()) return;

    setIsSubmittingLink(true);
    const newStreamId = 'stream-' + Date.now();

    // Standardize YouTube URLs into embed links if applicable
    let finalUrl = linkUrl.trim();
    const ytMatch = finalUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|live\/))([a-zA-Z0-9_-]+)/);
    if (ytMatch) {
      finalUrl = `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&mute=0`;
    }

    const newStream: LiveStreamItem = {
      id: newStreamId,
      title: linkTitle.trim(),
      parish: linkParish.trim() || (language === 'ar' ? 'الرعية الأرثوذكسية' : 'Orthodox Parish'),
      priestName: linkCelebrant.trim() || (language === 'ar' ? 'الكاهن الخادم' : 'Priest / Celebrant'),
      viewers: 1,
      videoUrl: finalUrl,
      isLive: true,
    };

    try {
      await liveStreamsApi.create({
        id: newStreamId,
        title: newStream.title,
        host_parish: newStream.parish,
        priest_name: newStream.priestName,
        media_url: newStream.videoUrl,
        is_live: true,
      });
    } catch (err) {
      console.warn('Error persisting stream to API:', err);
    }

    const updated = [newStream, ...streams];
    setStreams(updated);
    setActiveStreamId(newStreamId);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {}

    setIsSubmittingLink(false);
    setIsShareLinkOpen(false);
    setLinkTitle('');
    setLinkUrl('');
    showToast(language === 'ar' ? 'تمت مشاركة رابط البث المباشر بنجاح!' : 'Live stream link shared successfully!');
  };

  const handleEndBroadcast = () => {
    if (activeWebcamStream) {
      try {
        activeWebcamStream.getTracks().forEach((t) => t.stop());
      } catch (e) {}
      setActiveWebcamStream(null);
    }
    setIsUserBroadcasting(false);
    showToast(language === 'ar' ? 'تم إنهاء البث المباشر.' : 'Live broadcast ended.');
  };

  const handleLikeToggle = () => {
    setIsLiked(!isLiked);
    setLikeCount((prev) => (isLiked ? prev - 1 : prev + 1));
  };

  const handleLightVirtualCandle = () => {
    showToast(t('candleLitNotice'));
  };

  const handleShareStream = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      showToast(language === 'ar' ? 'تم نسخ رابط البث المباشر!' : 'Live stream link copied to clipboard!');
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 p-4 rounded-2xl bg-[#1c1611] border-2 border-amber-500 text-amber-200 text-sm font-serif font-bold shadow-2xl flex items-center gap-3 animate-bounce">
          <CheckCircle className="w-5 h-5 text-amber-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Active Broadcast Control Banner */}
      {isUserBroadcasting && (
        <div className="p-4 rounded-2xl bg-red-950/90 border-2 border-red-500 shadow-2xl flex items-center justify-between gap-4 animate-pulse">
          <div className="flex items-center gap-3">
            <span className="w-4 h-4 rounded-full bg-red-500 animate-ping" />
            <div>
              <h3 className="font-serif font-bold text-sm text-red-100 uppercase tracking-wider">
                {t('youAreBroadcasting')}
              </h3>
              <p className="text-xs text-red-200/80">
                {t('broadcastingSub')}
              </p>
            </div>
          </div>
          <button
            onClick={handleEndBroadcast}
            className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center gap-2 shadow-xl cursor-pointer border border-red-400"
          >
            <Square className="w-4 h-4 fill-current" />
            <span>{t('endBroadcastNow')}</span>
          </button>
        </div>
      )}

      {/* Top Banner & Go Live / Share Link Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-red-950/60 via-stone-950 to-amber-950/50 border border-red-500/30 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-400 animate-pulse">
            <Radio className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-serif font-bold text-xl text-amber-100">
              {t('liveParishBroadcasts')}
            </h2>
            <p className="text-xs text-stone-400">
              {language === 'ar'
                ? 'متابعة القداسات والعظات والصلوات مباشرة عبر الكاميرا أو مشاركة روابط البث'
                : 'Watch Divine Liturgy and Church Services live via Camera, YouTube, or Stream Link'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {/* Share Stream Link Button */}
          <button
            onClick={() => setIsShareLinkOpen(true)}
            className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-[#c5a059] hover:bg-[#a8833c] text-[#1c1611] font-serif font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer shrink-0 uppercase tracking-wider"
          >
            <Link2 className="w-4 h-4" />
            <span>{language === 'ar' ? 'مشاركة رابط بث' : 'Share Stream Link'}</span>
          </button>

          {/* Camera Broadcast Button */}
          <button
            onClick={() => setIsGoLiveOpen(true)}
            className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-serif font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all transform hover:scale-105 cursor-pointer shrink-0 uppercase tracking-wider"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{t('startLiveBroadcast')}</span>
          </button>
        </div>
      </div>

      {/* Theatre View Layout: Bunny Player + Live Chat Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-4">
          <BunnyPlayer
            mediaStream={activeWebcamStream}
            videoUrl={activeStream.videoUrl}
            title={activeStream.title}
            isLive={activeStream.isLive}
            viewerCount={activeStream.viewers}
            autoplay={false}
            muted={true}
            isUserBroadcasting={isUserBroadcasting}
            onEndBroadcast={handleEndBroadcast}
          />

          {/* Info Panel Under Video */}
          <div className="p-5 rounded-2xl bg-stone-950 border border-amber-900/30 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-900/30 pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="px-2.5 py-0.5 rounded-full bg-red-600 text-white font-bold text-[10px] tracking-wider uppercase animate-pulse">
                    {t('liveParishBadge')}
                  </span>
                  <span className="text-xs text-amber-400 font-semibold">
                    {activeStream.parish}
                  </span>
                </div>
                <h1 className="font-serif font-bold text-xl text-amber-100">
                  {activeStream.title}
                </h1>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3.5 py-1.5 rounded-full bg-red-600/20 border border-red-500/40 text-red-400 text-xs font-bold flex items-center gap-1.5">
                  <Eye className="w-4 h-4" /> {activeStream.viewers} {t('watchingCount')}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-1">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/40 flex items-center justify-center font-serif font-bold text-amber-300">
                  ☦
                </div>
                <div>
                  <h3 className="font-bold text-sm text-amber-100">
                    {activeStream.parish}
                  </h3>
                  <p className="text-xs text-stone-400">
                    {t('celebrant')}: {activeStream.priestName}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={handleLikeToggle}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    isLiked
                      ? 'bg-red-600 text-white shadow-md'
                      : 'bg-stone-900 hover:bg-stone-800 text-amber-200 border border-amber-900/40'
                  }`}
                >
                  <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                  <span>{likeCount}</span>
                </button>

                <button
                  onClick={handleLightVirtualCandle}
                  className="px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-amber-300 border border-amber-900/40 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Flame className="w-4 h-4 text-amber-400" />
                  <span>{t('lightCandle')}</span>
                </button>

                <button
                  onClick={handleShareStream}
                  className="px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-amber-200 border border-amber-900/40 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Share2 className="w-4 h-4" />
                  <span>{t('shareStream')}</span>
                </button>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-stone-900/70 border border-amber-900/20 text-xs text-stone-300 space-y-1">
              <p className="font-semibold text-amber-200">{t('broadcastInfo')}:</p>
              <p>
                {language === 'ar'
                  ? `يتم البث مباشرة من ${activeStream.parish}. جميع المؤمنين مدعوون للاتحاد في الصلاة والبركة خلال الخدمة الإلهية.`
                  : `Streamed directly from ${activeStream.parish}. All faithful are invited to unite in prayer during divine services.`}
              </p>
            </div>
          </div>
        </div>

        {/* Live Chat Sidebar */}
        <div className="lg:col-span-1">
          <ParishLiveChat parishName={activeStream.parish} />
        </div>
      </div>

      {/* Other Parish Live Broadcasts List */}
      <div className="space-y-3 pt-4">
        <h3 className="font-serif font-bold text-sm text-amber-300 uppercase tracking-wider">
          {t('moreParishBroadcasts')}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {streams.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveStreamId(s.id)}
              className={`p-4 rounded-2xl border text-left rtl:text-right transition-all cursor-pointer flex flex-col justify-between ${
                s.id === activeStreamId
                  ? 'bg-amber-950/40 border-amber-500 shadow-xl ring-1 ring-amber-500/40'
                  : 'bg-stone-950 border-amber-900/30 hover:border-amber-500/40'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-bold uppercase tracking-wider">
                    {s.isLive ? (language === 'ar' ? 'مباشر' : 'LIVE') : (language === 'ar' ? 'غير متصل' : 'OFFLINE')}
                  </span>
                  <span className="text-[11px] text-amber-400 font-bold flex items-center gap-1">
                    <Eye className="w-3 h-3" /> {s.viewers}
                  </span>
                </div>
                <h4 className="font-serif font-bold text-xs text-amber-100 mb-1 line-clamp-2">
                  {s.title}
                </h4>
                <p className="text-[11px] text-stone-400 line-clamp-1">{s.parish}</p>
              </div>
              <p className="text-[10px] text-amber-400/80 mt-3 font-medium">
                {t('celebrant')}: {s.priestName}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Webcam GoLive Modal */}
      <GoLiveModal
        isOpen={isGoLiveOpen}
        onClose={() => setIsGoLiveOpen(false)}
        onStartStream={handleStartStream}
      />

      {/* Share Live Stream Link Modal */}
      {isShareLinkOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-lg bg-[#eddcb9] dark:bg-[#18120e] border-2 border-[#c5a059] rounded-3xl p-6 shadow-2xl space-y-4 text-[#3d2b18] dark:text-[#f5ebd9]">
            <div className="flex items-center justify-between pb-3 border-b border-[#c5a059]/40">
              <div className="flex items-center gap-2">
                <Radio className="w-5 h-5 text-red-600 animate-pulse" />
                <h3 className="font-serif-coptic font-bold text-base">
                  {language === 'ar' ? 'مشاركة رابط بث مباشر' : 'Share Live Stream Link'}
                </h3>
              </div>
              <button
                onClick={() => setIsShareLinkOpen(false)}
                className="p-1.5 rounded-xl bg-[#f6ebd6] dark:bg-[#282019] border border-[#c5a059] hover:bg-[#c5a059] hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleShareCustomLink} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-serif uppercase tracking-wider font-bold text-[#7c5f3d] dark:text-[#a89379] mb-1">
                  {language === 'ar' ? 'عنوان البث أو القداس' : 'Broadcast / Liturgy Title'}
                </label>
                <input
                  type="text"
                  required
                  value={linkTitle}
                  onChange={(e) => setLinkTitle(e.target.value)}
                  placeholder={language === 'ar' ? 'القداس الإلهي وعظة الأحد' : 'Sunday Divine Liturgy & Sermon'}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#f6ebd6] dark:bg-[#282019] border border-[#c5a059] text-xs font-serif text-[#3d2b18] dark:text-[#f5ebd9] focus:outline-none focus:border-[#a8833c]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-serif uppercase tracking-wider font-bold text-[#7c5f3d] dark:text-[#a89379] mb-1">
                  {language === 'ar' ? 'رابط البث (YouTube / Facebook / Bunny / HLS / MP4)' : 'Stream URL (YouTube, Facebook, Bunny, HLS)'}
                </label>
                <input
                  type="url"
                  required
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=... or https://iframe.mediadelivery.net/..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#f6ebd6] dark:bg-[#282019] border border-[#c5a059] text-xs font-serif text-[#3d2b18] dark:text-[#f5ebd9] focus:outline-none focus:border-[#a8833c]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-serif uppercase tracking-wider font-bold text-[#7c5f3d] dark:text-[#a89379] mb-1">
                    {language === 'ar' ? 'اسم الكنيسة / الرعية' : 'Parish Name'}
                  </label>
                  <input
                    type="text"
                    value={linkParish}
                    onChange={(e) => setLinkParish(e.target.value)}
                    placeholder="St. Mark Coptic Church"
                    className="w-full px-3 py-2 rounded-xl bg-[#f6ebd6] dark:bg-[#282019] border border-[#c5a059] text-xs font-serif text-[#3d2b18] dark:text-[#f5ebd9] focus:outline-none focus:border-[#a8833c]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-serif uppercase tracking-wider font-bold text-[#7c5f3d] dark:text-[#a89379] mb-1">
                    {language === 'ar' ? 'الكاهن / الخادم' : 'Priest / Celebrant'}
                  </label>
                  <input
                    type="text"
                    value={linkCelebrant}
                    onChange={(e) => setLinkCelebrant(e.target.value)}
                    placeholder="Fr. Mina"
                    className="w-full px-3 py-2 rounded-xl bg-[#f6ebd6] dark:bg-[#282019] border border-[#c5a059] text-xs font-serif text-[#3d2b18] dark:text-[#f5ebd9] focus:outline-none focus:border-[#a8833c]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#c5a059]/30">
                <button
                  type="button"
                  onClick={() => setIsShareLinkOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#c5a059] text-xs font-serif uppercase font-bold text-[#7c5f3d] dark:text-[#a89379] hover:bg-[#f6ebd6] transition-colors cursor-pointer"
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingLink || !linkUrl.trim() || !linkTitle.trim()}
                  className="px-5 py-2 rounded-xl bg-[#c5a059] hover:bg-[#a8833c] text-[#1c1611] font-serif font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5 rtl:rotate-180" />
                  <span>
                    {isSubmittingLink
                      ? (language === 'ar' ? 'جارٍ النشر...' : 'Publishing...')
                      : (language === 'ar' ? 'بدء البث المباشر' : 'Publish Live Stream')}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
