import React, { useState, useEffect, useRef } from 'react';
import { Radio, Eye, PlusCircle, Heart, Share2, Flame, CheckCircle, Square } from 'lucide-react';
import { BunnyPlayer } from '../components/BunnyPlayer';
import { ParishLiveChat } from '../components/ParishLiveChat';
import { GoLiveModal, StreamData } from '../components/GoLiveModal';
import { supabase } from '../lib/supabase';

interface LiveStreamItem {
  id: string;
  title: string;
  parish: string;
  priestName: string;
  viewers: number;
  videoUrl: string;
  isLive: boolean;
}

const INITIAL_STREAMS: LiveStreamItem[] = [
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

const LOCAL_STORAGE_KEY = 'orthodox_live_streams';

export const LiveBroadcastView: React.FC = () => {
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
    return INITIAL_STREAMS;
  });

  const [activeStreamId, setActiveStreamId] = useState<string>(() => streams[0]?.id || 'stream-1');
  const [isGoLiveOpen, setIsGoLiveOpen] = useState(false);
  const [likeCount, setLikeCount] = useState<number>(142);
  const [isLiked, setIsLiked] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Active Broadcast State
  const [activeWebcamStream, setActiveWebcamStream] = useState<MediaStream | null>(null);
  const [isUserBroadcasting, setIsUserBroadcasting] = useState<boolean>(false);
  const playerRef = useRef<HTMLVideoElement | null>(null);

  // Unmount cleanup: Hard Disconnect Live Stream on Tab Switch & silence all media
  useEffect(() => {
    return () => {
      // Stop HLS/WebRTC/Bunny Stream connections
      if (playerRef.current) {
        try {
          playerRef.current.pause();
          playerRef.current.srcObject = null;
          playerRef.current.src = '';
        } catch (e) {
          // ignore
        }
      }
      if (activeWebcamStream) {
        try {
          activeWebcamStream.getTracks().forEach((track) => track.stop());
        } catch (e) {
          // ignore
        }
      }
      // Hard disconnect & clear all audio and video elements
      const media = document.querySelectorAll<HTMLMediaElement>('video, audio');
      media.forEach((m) => {
        try {
          m.pause();
          m.muted = true;
          m.src = '';
          m.srcObject = null;
        } catch (e) {
          // ignore
        }
      });
      // Clear iframe streams
      const iframes = document.querySelectorAll<HTMLIFrameElement>('iframe');
      iframes.forEach((ifr) => {
        try {
          if (ifr.src.includes('mediadelivery.net') || ifr.src.includes('bunny')) {
            ifr.src = 'about:blank';
          }
        } catch (e) {
          // ignore
        }
      });
    };
  }, [activeWebcamStream]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Sync remote Supabase live_streams if available
  useEffect(() => {
    async function fetchRemoteStreams() {
      try {
        const { data, error } = await supabase
          .from('live_streams')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          const mapped: LiveStreamItem[] = data.map((row) => ({
            id: row.id || `stream-${Date.now()}`,
            title: row.title || 'Parish Live Service',
            parish: row.host_parish || row.parish || 'Orthodox Church',
            priestName: row.priest_name || 'Priest / Host',
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
        console.warn('Supabase remote live streams query notice:', err);
      }
    }
    fetchRemoteStreams();
  }, []);

  const activeStream = streams.find((s) => s.id === activeStreamId) || streams[0] || INITIAL_STREAMS[0];

  const handleStartStream = (data: StreamData, mediaStream?: MediaStream | null) => {
    const newStreamId = 'stream-' + Date.now();
    const newStream: LiveStreamItem = {
      id: newStreamId,
      title: data.title,
      parish: data.host_parish || data.parish || 'Orthodox Parish',
      priestName: 'You (Priest / Host)',
      viewers: 1,
      videoUrl: data.media_url || data.videoUrl || 'webcam-feed',
      isLive: true,
    };

    if (mediaStream) {
      setActiveWebcamStream(mediaStream);
    }
    setIsUserBroadcasting(true);

    const updatedStreams = [newStream, ...streams];
    setStreams(updatedStreams);
    setActiveStreamId(newStreamId);

    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedStreams));
    } catch (e) {
      console.warn('Failed to save live streams to localStorage:', e);
    }

    showToast('🔴 Live Broadcast Started! You are now broadcasting.');
  };

  const handleEndBroadcast = () => {
    if (activeWebcamStream) {
      try {
        activeWebcamStream.getTracks().forEach((track) => track.stop());
      } catch (e) {
        // ignore
      }
      setActiveWebcamStream(null);
    }
    setIsUserBroadcasting(false);

    // Update active stream live status and persist
    setStreams((prev) => {
      const updated = prev.map((s) => (s.id === activeStreamId ? { ...s, isLive: false } : s));
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    // If currently on a custom webcam broadcast stream, reset to an official active parish stream
    if (activeStream.videoUrl === 'webcam-feed' || activeStream.priestName.includes('You')) {
      setActiveStreamId(INITIAL_STREAMS[0].id);
    }

    showToast('⏹️ Live Broadcast finished. Camera & microphone stopped.');
  };

  const handleLikeToggle = () => {
    setIsLiked(!isLiked);
    setLikeCount((prev) => (isLiked ? prev - 1 : prev + 1));
  };

  const handleShareStream = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      showToast('Stream link copied to clipboard!');
    } else {
      showToast('Live Broadcast URL ready to share!');
    }
  };

  const handleLightVirtualCandle = () => {
    showToast('🕯️ Virtual Candle Lit for Parish Intentions.');
  };

  return (
    <div className="space-y-6 relative">
      {/* Toast Feedback Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-2xl bg-[#1c1611] border border-[#c5a059] text-[#f5ebd9] font-serif font-bold text-xs shadow-2xl flex items-center gap-2 animate-bounce">
          <CheckCircle className="w-4 h-4 text-[#c5a059]" />
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
                You Are Currently Broadcasting Live
              </h3>
              <p className="text-xs text-red-200/80">
                Device camera and microphone are live and streaming to parishioners.
              </p>
            </div>
          </div>
          <button
            onClick={handleEndBroadcast}
            className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center gap-2 shadow-xl cursor-pointer border border-red-400"
          >
            <Square className="w-4 h-4 fill-current" />
            <span>End Broadcast Now</span>
          </button>
        </div>
      )}

      {/* Top Banner & Go Live Action */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-red-950/60 via-stone-950 to-amber-950/50 border border-red-500/30 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-400 animate-pulse">
            <Radio className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-serif font-bold text-xl text-amber-100">
              Live Parish Broadcasts
            </h2>
            <p className="text-xs text-stone-400">
              Watch Divine Liturgy and Church Services live via Device Camera or Bunny Stream
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsGoLiveOpen(true)}
          className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg transition-all transform hover:scale-105 cursor-pointer shrink-0"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Start Live Broadcast</span>
        </button>
      </div>

      {/* Theatre View Layout: Bunny Player + Live Chat Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left / Main Column: Bunny Stream Player & Metadata */}
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

          {/* Under Video Header & Info Panel */}
          <div className="p-5 rounded-2xl bg-stone-950 border border-amber-900/30 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-900/30 pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="px-2.5 py-0.5 rounded-full bg-red-600 text-white font-bold text-[10px] tracking-wider uppercase animate-pulse">
                    LIVE PARISH BROADCAST
                  </span>
                  <span className="text-xs text-amber-400 font-semibold">
                    {activeStream.parish}
                  </span>
                </div>
                <h1 className="font-serif font-bold text-xl text-amber-100">
                  {activeStream.title}
                </h1>
              </div>

              {/* Viewers Badge */}
              <div className="flex items-center gap-2">
                <span className="px-3.5 py-1.5 rounded-full bg-red-600/20 border border-red-500/40 text-red-400 text-xs font-bold flex items-center gap-1.5">
                  <Eye className="w-4 h-4" /> {activeStream.viewers} Watching
                </span>
              </div>
            </div>

            {/* Parish & Priest Metadata + Interaction Buttons */}
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
                    Celebrant: {activeStream.priestName}
                  </p>
                </div>
              </div>

              {/* Action Buttons Row */}
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
                  title="Light a candle in memory or prayer"
                >
                  <Flame className="w-4 h-4 text-amber-400" />
                  <span>Light Candle</span>
                </button>

                <button
                  onClick={handleShareStream}
                  className="px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-amber-200 border border-amber-900/40 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Share</span>
                </button>
              </div>
            </div>

            {/* Service Description Box */}
            <div className="p-3.5 rounded-xl bg-stone-900/70 border border-amber-900/20 text-xs text-stone-300 space-y-1">
              <p className="font-semibold text-amber-200">Broadcast Information:</p>
              <p>
                Streamed directly from {activeStream.parish}. All faithful are invited to unite in prayer during divine services.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Live Chat Sidebar */}
        <div className="lg:col-span-1">
          <ParishLiveChat parishName={activeStream.parish} />
        </div>
      </div>

      {/* Other Parish Live Broadcasts Section */}
      <div className="space-y-3 pt-4">
        <h3 className="font-serif font-bold text-sm text-amber-300 uppercase tracking-wider">
          More Parish Broadcasts
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {streams.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveStreamId(s.id)}
              className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                s.id === activeStreamId
                  ? 'bg-amber-950/40 border-amber-500 shadow-xl ring-1 ring-amber-500/40'
                  : 'bg-stone-950 border-amber-900/30 hover:border-amber-500/40'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-bold uppercase tracking-wider">
                    {s.isLive ? 'LIVE' : 'OFFLINE'}
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
                Celebrant: {s.priestName}
              </p>
            </button>
          ))}
        </div>
      </div>

      <GoLiveModal
        isOpen={isGoLiveOpen}
        onClose={() => setIsGoLiveOpen(false)}
        onStartStream={handleStartStream}
      />
    </div>
  );
};

