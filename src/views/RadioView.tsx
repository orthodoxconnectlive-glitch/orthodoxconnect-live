import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Radio as RadioIcon,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Trash2,
  Plus,
  ListMusic,
  Settings2,
  ChevronDown,
  ChevronUp,
  Share2,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { apiFetch } from '../lib/api';

interface RadioTrack {
  id: string;
  title: string;
  youtube_id: string;
  category: string;
  sort_order?: number;
  created_at?: string;
}

interface RadioLive {
  is_live: boolean;
  youtube_id: string;
  title: string;
}

// YouTube IFrame API loader (singleton).
let ytApiPromise: Promise<any> | null = null;
function loadYouTubeApi(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  const w = window as any;
  if (w.YT && w.YT.Player) return Promise.resolve(w.YT);
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve, reject) => {
    const prev = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      try { if (typeof prev === 'function') prev(); } catch {}
      resolve(w.YT);
    };
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    tag.onerror = () => { ytApiPromise = null; reject(new Error('YouTube API failed to load')); };
    document.head.appendChild(tag);
    // Safety timeout: never hang the play button forever.
    setTimeout(() => {
      if (w.YT && w.YT.Player) resolve(w.YT);
    }, 15000);
  });
  return ytApiPromise;
}

const CATS = [
  { id: 'all', en: 'All', ar: 'الكل' },
  { id: 'liturgy', en: 'Liturgy', ar: 'القداس' },
  { id: 'hymns', en: 'Hymns', ar: 'ترانيم ومدائح' },
  { id: 'songs', en: 'Songs', ar: 'أغاني' },
];

interface RadioViewProps {
  focusTrackId?: string | null;
  onFocusTrackConsumed?: () => void;
  focusRadioLive?: boolean;
  onFocusRadioLiveConsumed?: () => void;
}

export const RadioView: React.FC<RadioViewProps> = ({ focusTrackId, onFocusTrackConsumed, focusRadioLive, onFocusRadioLiveConsumed }) => {
  const { profile } = useAuth();
  const { language } = useTheme();
  const ar = language === 'ar';

  const [tracks, setTracks] = useState<RadioTrack[]>([]);
  const [live, setLive] = useState<RadioLive>({ is_live: false, youtube_id: '', title: '' });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [playerError, setPlayerError] = useState('');
  const [liveLinkExpired, setLiveLinkExpired] = useState(false);

  const playerRef = useRef<any>(null);
  const playerHostRef = useRef<HTMLDivElement>(null);

  // ---------- Station ID jingle: every 45 min of playback, like a real radio ----------
  const JINGLE_EVERY_MS = 45 * 60 * 1000;
  const JINGLE_MAX_WAIT_MS = 60 * 60 * 1000; // marathon track: interrupt rather than wait forever
  const JINGLE_URL = '/radio-jingle.mp3';
  const playStartRef = useRef<number | null>(null);
  const playedMsRef = useRef(0);
  const jinglePendingRef = useRef(false);
  const jinglePlayingRef = useRef(false);
  const jingleAudioRef = useRef<HTMLAudioElement | null>(null);
  const isPlayingRef = useRef(false);
  const liveRef = useRef(live);
  liveRef.current = live;
  const [jingleNow, setJingleNow] = useState(false);

  // ---------- Welcome jingle: plays once per visit when the station starts ----------
  const WELCOME_URL = '/radio-welcome.mp3';
  const welcomePlayedRef = useRef(false);
  const welcomePlayingRef = useRef(false);
  const welcomeAudioRef = useRef<HTMLAudioElement | null>(null);
  const welcomeFinishRef = useRef<((proceed: boolean) => void) | null>(null);
  const [welcomeNow, setWelcomeNow] = useState(false);

  const playJingle = useCallback(() => {
    const player = playerRef.current;
    jinglePlayingRef.current = true;
    jinglePendingRef.current = false;
    playedMsRef.current = 0;
    playStartRef.current = null;
    setIsPlaying(false);
    isPlayingRef.current = false;
    setJingleNow(true);
    try { player?.pauseVideo(); } catch {}
    const resume = () => {
      jinglePlayingRef.current = false;
      setJingleNow(false);
      try { playerRef.current?.playVideo(); } catch {}
    };
    try {
      let audio = jingleAudioRef.current;
      if (!audio) {
        audio = new Audio(JINGLE_URL);
        audio.preload = 'auto';
        jingleAudioRef.current = audio;
      }
      audio.onended = resume;
      audio.onerror = resume; // never stall the station on a missing file
      audio.currentTime = 0;
      const pr = audio.play();
      if (pr && typeof (pr as any).catch === 'function') (pr as any).catch(resume);
    } catch {
      resume();
    }
  }, []);
  // Welcome jingle: plays once per visit before the first track. Never stalls the station.
  const playWelcome = useCallback((): Promise<boolean> => {
    return new Promise((resolve) => {
      let done = false;
      const finish = (proceed: boolean) => {
        if (done) return;
        done = true;
        welcomePlayingRef.current = false;
        welcomeFinishRef.current = null;
        setWelcomeNow(false);
        try { welcomeAudioRef.current?.pause(); } catch {}
        resolve(proceed);
      };
      welcomeFinishRef.current = finish;
      welcomePlayingRef.current = true;
      setWelcomeNow(true);
      try {
        let audio = welcomeAudioRef.current;
        if (!audio) {
          audio = new Audio(WELCOME_URL);
          audio.preload = 'auto';
          welcomeAudioRef.current = audio;
        }
        audio.onended = () => finish(true);
        audio.onerror = () => finish(true); // missing file: start the track anyway
        audio.currentTime = 0;
        const pr = audio.play();
        if (pr && typeof (pr as any).catch === 'function') (pr as any).catch(() => finish(true));
      } catch {
        finish(true);
      }
    });
  }, []);
  const tracksRef = useRef<RadioTrack[]>([]);
  const filterRef = useRef('all');
  tracksRef.current = tracks;
  filterRef.current = filter;

  const isSuperAdmin = profile?.email?.toLowerCase() === 'orthodoxconnect.live@gmail.com' || profile?.role === 'super_admin';
  const isAdminOrOwner = isSuperAdmin || profile?.role === 'admin' || profile?.role === 'owner';

  const filteredTracks = tracks.filter((t) => filter === 'all' || t.category === filter);

  const fetchRadio = useCallback(async () => {
    try {
      const d: any = await apiFetch('/api/radio');
      if (d && d.success !== false) {
        setTracks(d.tracks || []);
        setLive(d.live || { is_live: false, youtube_id: '', title: '' });
      }
    } catch (e) {
      console.warn('[radio] load failed', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchRadio(); }, [fetchRadio]);

  const playlistIds = () => {
    const list = tracksRef.current.filter((t) => filterRef.current === 'all' || t.category === filterRef.current);
    return list.map((t) => t.youtube_id);
  };

  const attachPlayerEvents = (player: any) => {
    const accumulate = () => {
      if (playStartRef.current != null) {
        playedMsRef.current += Date.now() - playStartRef.current;
        playStartRef.current = null;
      }
    };
    player.addEventListener('onStateChange', (e: any) => {
      const YTNS = (window as any).YT;
      const state = e.data;
      if (!YTNS) return;
      if (state === YTNS.PlayerState.PLAYING) {
        // A new track just started: fire a pending station ID before it.
        if (jinglePendingRef.current && !jinglePlayingRef.current) {
          playJingle();
          return;
        }
        setIsPlaying(true);
        isPlayingRef.current = true;
        setStarted(true);
        playStartRef.current = Date.now();
        try { setCurrentIndex(player.getPlaylistIndex() ?? 0); } catch {}
      } else if (state === YTNS.PlayerState.PAUSED || state === YTNS.PlayerState.ENDED) {
        accumulate();
        setIsPlaying(false);
        isPlayingRef.current = false;
      } else if (state === YTNS.PlayerState.CUED) {
        try { setCurrentIndex(player.getPlaylistIndex() ?? 0); } catch {}
      }
    });
    player.addEventListener('onError', () => {
      // Skip dead/unplayable videos automatically — the station never stalls.
      try { player.nextVideo(); } catch {}
    });
  };

  // Resolves when the current YouTube player fires onReady.
  const playerReadyRef = useRef<Promise<void> | null>(null);

  const ensurePlayer = async (): Promise<any> => {
    if (playerRef.current) {
      // A previous tap may still be initializing the player; wait for it.
      if (playerReadyRef.current) await playerReadyRef.current;
      return playerRef.current;
    }
    const YT = await loadYouTubeApi();
    if (!playerHostRef.current) throw new Error('player host missing');
    const ids = playlistIds();
    if (!ids.length) throw new Error('empty');
    let resolveReady: () => void = () => {};
    let rejectReady: (e: any) => void = () => {};
    playerReadyRef.current = new Promise<void>((res, rej) => {
      resolveReady = res;
      rejectReady = rej;
    });
    const readyTimer = setTimeout(() => rejectReady(new Error('player init timeout')), 20000);
    const player = new YT.Player(playerHostRef.current, {
      videoId: ids[0],
      playerVars: { autoplay: 0, rel: 0, modestbranding: 1 },
      events: {
        onReady: () => {
          clearTimeout(readyTimer);
          resolveReady();
        },
      },
    });
    attachPlayerEvents(player);
    playerRef.current = player;
    try {
      // Never issue playlist commands before the player is ready.
      await playerReadyRef.current;
    } catch (e) {
      // Tear down the broken player so the next tap starts clean.
      try { player.destroy(); } catch {}
      playerRef.current = null;
      playerReadyRef.current = null;
      throw e;
    }
    playerReadyRef.current = null;
    return player;
  };

  const startAt = async (index: number) => {
    setPlayerError('');
    try {
      const ids = playlistIds();
      if (!ids.length) return;
      // Kick the welcome greeting off synchronously inside the tap gesture,
      // before any await: phone web views only allow audio started from a tap.
      let welcomePromise: Promise<boolean> | null = null;
      if (!welcomePlayedRef.current && !liveRef.current.is_live) {
        welcomePlayedRef.current = true;
        welcomePromise = playWelcome();
      }
      const player = await ensurePlayer();
      // Warm up the jingles so they play instantly when due.
      try {
        if (!jingleAudioRef.current) {
          const a = new Audio(JINGLE_URL);
          a.preload = 'auto';
          jingleAudioRef.current = a;
        }
        if (!welcomeAudioRef.current) {
          const w = new Audio(WELCOME_URL);
          w.preload = 'auto';
          welcomeAudioRef.current = w;
        }
      } catch {}
      const safeIndex = Math.max(0, Math.min(index, ids.length - 1));
      const begin = () => {
        // Array form is the documented loadPlaylist signature; only call once ready.
        player.loadPlaylist(ids, safeIndex);
        setCurrentIndex(safeIndex);
        setStarted(true);
      };
      // First start of the visit (regular station only): welcome jingle, then the track.
      if (welcomePromise) {
        await welcomePromise;
      }
      begin();
    } catch (e: any) {
      try { console.error('[radio] startAt failed', e); } catch {}
      setPlayerError(ar ? 'تعذر تشغيل الراديو. حاول مرة أخرى.' : 'Could not start the radio. Please try again.');
    }
  };

  const togglePlay = async () => {
    if (welcomePlayingRef.current) {
      // Tapped during the welcome: skip it and start the track right away.
      try { welcomeFinishRef.current?.(true); } catch {}
      return;
    }
    if (!playerRef.current) {
      await startAt(currentIndex);
      return;
    }
    try {
      if (isPlaying) playerRef.current.pauseVideo();
      else playerRef.current.playVideo();
    } catch {}
  };

  const playNext = () => { try { playerRef.current?.nextVideo(); } catch {} };
  const playPrev = () => { try { playerRef.current?.previousVideo(); } catch {} };

  const changeFilter = (f: string) => {
    setFilter(f);
    filterRef.current = f;
    setCurrentIndex(0);
    // If already playing, restart the playlist with the new filter.
    if (playerRef.current && started) {
      const ids = tracksRef.current.filter((t) => f === 'all' || t.category === f).map((t) => t.youtube_id);
      if (ids.length) {
        try { playerRef.current.loadPlaylist(ids, 0); } catch {}
      } else {
        try { playerRef.current.stopVideo(); } catch {}
        setIsPlaying(false);
      }
    }
  };

  const nowPlaying = filteredTracks[currentIndex];

  // ---------- Admin: manage station ----------
  const [showAdmin, setShowAdmin] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newCat, setNewCat] = useState('hymns');
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminMsg, setAdminMsg] = useState('');
  const [liveOn, setLiveOn] = useState(false);
  const [liveUrl, setLiveUrl] = useState('');
  const [liveTitle, setLiveTitle] = useState('');

  useEffect(() => {
    setLiveOn(live.is_live);
    setLiveUrl(live.youtube_id ? `https://www.youtube.com/watch?v=${live.youtube_id}` : '');
    setLiveTitle(live.title || '');
  }, [live]);

  const adminAdd = async () => {
    if (!newTitle.trim() || !newUrl.trim()) {
      setAdminMsg(ar ? 'اكتب الاسم ورابط اليوتيوب.' : 'Enter a title and a YouTube link.');
      return;
    }
    setAdminBusy(true);
    setAdminMsg('');
    try {
      const d: any = await apiFetch('/api/radio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim(), youtube_url: newUrl.trim(), category: newCat }),
      });
      if (d && d.success) {
        setNewTitle(''); setNewUrl('');
        await fetchRadio();
        setAdminMsg(ar ? 'تمت الإضافة ✓' : 'Added ✓');
      } else {
        setAdminMsg(d?.error || (ar ? 'الرابط غير صالح.' : 'That YouTube link looks invalid.'));
      }
    } catch (e: any) {
      // apiFetch throws on HTTP errors (e.g. 400) carrying the server's message — surface it instead of a generic error.
      const msg = String((e && e.message) || '').replace(/^API error:[^(]*\(\d+\)\s*/, '').trim();
      setAdminMsg(ar ? 'تعذّر الحفظ. تأكد أن الرابط رابط فيديو يوتيوب مباشر ثم حاول مجددًا.' : (msg || 'Something went wrong.'));
    } finally {
      setAdminBusy(false);
    }
  };

  const adminDelete = async (id: string) => {
    if (!window.confirm(ar ? 'حذف هذا من الراديو؟' : 'Remove this from the radio?')) return;
    try {
      await apiFetch(`/api/radio/tracks/${encodeURIComponent(id)}`, { method: 'DELETE' });
      await fetchRadio();
    } catch {}
  };

  const adminSaveLive = async () => {
    setAdminBusy(true);
    setAdminMsg('');
    try {
      const d: any = await apiFetch('/api/radio/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_live: liveOn, youtube_url: liveUrl.trim(), title: liveTitle.trim() }),
      });
      if (d && d.success) {
        await fetchRadio();
        setAdminMsg(ar ? 'تم حفظ البث ✓' : 'Live setting saved ✓');
      } else {
        setAdminMsg(d?.error || (ar ? 'حدث خطأ.' : 'Something went wrong.'));
      }
    } catch (e: any) {
      const msg = String((e && e.message) || '').replace(/^API error:[^(]*\(\d+\)\s*/, '').trim();
      setAdminMsg(ar ? 'تعذّر حفظ البث. تأكد أن الرابط رابط فيديو يوتيوب مباشر.' : (msg || 'Something went wrong.'));
    } finally {
      setAdminBusy(false);
    }
  };

  const catLabel = (id: string) => {
    const c = CATS.find((x) => x.id === id);
    return c ? (ar ? c.ar : c.en) : id;
  };

  const shareTrack = async (t: RadioTrack) => {
    const url = `https://orthodoxconnect.live/radio/${encodeURIComponent(t.id)}`;
    const text = `${t.title} | ${ar ? 'راديو أرثوذكسى' : 'OrthodoxConnect Radio'} 🎧`;
    if (typeof navigator !== 'undefined' && (navigator as any).share) {
      try {
        await (navigator as any).share({ title: t.title, text, url });
        return;
      } catch (e) { /* user dismissed */ }
    }
    try {
      // Copy-link fallback carries the track name too, not just the URL.
      await navigator.clipboard.writeText(`${text}\n${url}`);
      alert(ar ? 'تم نسخ رابط الأغنية — شاركه مع أحبائك' : 'Track link copied — share it with your loved ones');
    } catch (e) {
      console.error('Share failed:', e);
    }
  };

  const shareLive = async () => {
    const url = 'https://orthodoxconnect.live/radio/live';
    const text = `${live.title || (ar ? 'بث مباشر' : 'Live broadcast')} | ${ar ? 'راديو أرثوذكسى' : 'OrthodoxConnect Radio'} 🔴`;
    if (typeof navigator !== 'undefined' && (navigator as any).share) {
      try {
        await (navigator as any).share({ title: live.title || 'Live', text, url });
        return;
      } catch (e) { /* user dismissed */ }
    }
    try {
      // Copy-link fallback carries the broadcast title too, not just the URL.
      await navigator.clipboard.writeText(`${text}\n${url}`);
      alert(ar ? 'تم نسخ رابط البث المباشر — شاركه مع أحبائك' : 'Live link copied — share it with your loved ones');
    } catch (e) {
      console.error('Share failed:', e);
    }
  };

  // Station ID scheduler: counts actual playback minutes, fires between songs.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (jinglePlayingRef.current) return;
      if (liveRef.current.is_live) return; // live broadcast: never interrupt
      if (!isPlayingRef.current || playStartRef.current == null) return;
      const elapsed = playedMsRef.current + (Date.now() - playStartRef.current);
      if (elapsed >= JINGLE_MAX_WAIT_MS) {
        playJingle(); // marathon track (long sermon): interrupt rather than wait forever
      } else if (elapsed >= JINGLE_EVERY_MS && !jinglePendingRef.current) {
        jinglePendingRef.current = true; // plays at the next track boundary
      }
    }, 15000);
    return () => window.clearInterval(id);
  }, [playJingle]);

  // Deep link: ?track=<id> starts the station on that track.
  useEffect(() => {
    if (!focusTrackId || tracks.length === 0) return;
    if (onFocusTrackConsumed) onFocusTrackConsumed();
    const idx = tracks.findIndex((t) => t.id === focusTrackId);
    if (idx < 0) return;
    setFilter('all');
    filterRef.current = 'all';
    setCurrentIndex(0);
    void startAt(idx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusTrackId, tracks]);

  // Deep link: ?radioLive=1 opens the radio on the live broadcast.
  // The live banner autoplays on its own when the station is live; if the
  // broadcast has ended by the time the link is opened, show a note instead.
  useEffect(() => {
    if (!focusRadioLive || loading) return;
    if (onFocusRadioLiveConsumed) onFocusRadioLiveConsumed();
    if (!(live.is_live && live.youtube_id)) setLiveLinkExpired(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRadioLive, loading]);

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-10">
      {/* Header */}
      <div className="bg-(--bg-card) dark:bg-[#1c1611] border-2 border-(--ln-gold) dark:border-[#8b6b4a] rounded-3xl p-5 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-(--ac-gold)/15 border border-(--ln-gold) flex items-center justify-center text-(--ac-gold-tx)">
            <RadioIcon className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h1 className="font-serif font-bold text-lg text-(--tx-strong) dark:text-[#f5ebd9]">
              {ar ? 'راديو أرثوذكسى' : 'OrthodoxConnect Radio'}
            </h1>
            <p className="text-xs text-(--tx-mute) dark:text-[#a89379]">
              {ar ? 'القداس والترانيم والأغاني على مدار الساعة' : 'Liturgy, hymns and songs around the clock'}
            </p>
          </div>
          {live.is_live && (
            <span className="px-3 py-1 rounded-full bg-red-600 text-white text-xs font-bold animate-pulse">
              {ar ? '🔴 بث مباشر' : '🔴 LIVE'}
            </span>
          )}
        </div>
      </div>

      {liveLinkExpired && (
        <div className="bg-(--bg-card) dark:bg-[#1c1611] border-2 border-(--ln-gold) dark:border-[#8b6b4a] rounded-3xl p-4 shadow-lg flex items-center gap-3">
          <p className="flex-1 text-sm text-(--tx-strong) dark:text-[#f5ebd9]">
            {ar ? 'انتهى هذا البث المباشر — هذه هي المحطة العادية.' : 'That live broadcast has ended — here is the regular station.'}
          </p>
          <button
            onClick={() => setLiveLinkExpired(false)}
            className="p-2 rounded-lg text-(--tx-mute) dark:text-[#a89379] hover:bg-(--bg-soft) cursor-pointer"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-10 h-10 rounded-full border-4 border-(--ln-gold) border-t-transparent animate-spin" />
        </div>
      ) : live.is_live && live.youtube_id ? (
        /* ---------- LIVE MODE ---------- */
        <div className="bg-(--bg-card) dark:bg-[#1c1611] border-2 border-red-500/60 rounded-3xl p-4 shadow-lg space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-600 animate-pulse" />
            <h2 className="font-bold text-(--tx-strong) dark:text-[#f5ebd9] flex-1 min-w-0 truncate">
              {live.title || (ar ? 'بث مباشر' : 'Live now')}
            </h2>
            <button
              onClick={shareLive}
              className="w-10 h-10 rounded-full bg-(--bg-soft) dark:bg-[#282019] border border-red-500/50 flex items-center justify-center text-(--tx-strong) dark:text-[#f5ebd9] cursor-pointer shrink-0"
              title={ar ? 'مشاركة البث المباشر' : 'Share live broadcast'}
              aria-label="Share"
            >
              <Share2 className="w-5 h-5" />
            </button>
          </div>
          <div className="rounded-2xl overflow-hidden aspect-video bg-black">
            <iframe
              key={live.youtube_id}
              className="w-full h-full"
              src={`https://www.youtube.com/embed/${live.youtube_id}?autoplay=1&rel=0`}
              title={live.title || 'Live'}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
          <p className="text-xs text-(--tx-mute) dark:text-[#a89379]">
            {ar ? 'البث المباشر يعمل الآن. ستعود المحطة العادية بعد انتهاء البث.' : 'The live broadcast is on now. The regular station returns when it ends.'}
          </p>
        </div>
      ) : tracks.length === 0 ? (
        /* ---------- EMPTY STATION ---------- */
        <div className="bg-(--bg-card) dark:bg-[#1c1611] border-2 border-(--ln-gold) dark:border-[#8b6b4a] rounded-3xl p-10 text-center shadow-lg">
          <RadioIcon className="w-10 h-10 mx-auto mb-3 text-(--tx-mute)" />
          <p className="font-serif font-bold text-(--tx-strong) dark:text-[#f5ebd9]">
            {ar ? 'المحطة تُجهَّز الآن…' : 'The station is getting ready…'}
          </p>
          <p className="text-xs text-(--tx-mute) dark:text-[#a89379] mt-1">
            {ar ? 'قريبًا: القداس والترانيم والأغاني هنا.' : 'Liturgy, hymns and songs are coming here soon.'}
          </p>
        </div>
      ) : (
        /* ---------- STATION PLAYER ---------- */
        <div className="bg-(--bg-card) dark:bg-[#1c1611] border-2 border-(--ln-gold) dark:border-[#8b6b4a] rounded-3xl p-4 shadow-lg space-y-4">
          {/* Category filter */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {CATS.map((c) => (
              <button
                key={c.id}
                onClick={() => changeFilter(c.id)}
                className={`px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
                  filter === c.id
                    ? 'bg-(--ac-gold) text-white shadow'
                    : 'bg-(--bg-soft) dark:bg-[#282019] text-(--tx-mute) dark:text-[#a89379] border border-(--ln-gold) dark:border-[#8b6b4a]'
                }`}
              >
                {ar ? c.ar : c.en}
              </button>
            ))}
          </div>

          {/* Player */}
          <div className="rounded-2xl overflow-hidden aspect-video bg-black">
            <div ref={playerHostRef} className="w-full h-full" />
          </div>

          {/* Now playing + controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={playPrev}
              className="w-11 h-11 rounded-full bg-(--bg-soft) dark:bg-[#282019] border border-(--ln-gold) flex items-center justify-center text-(--tx-strong) dark:text-[#f5ebd9] cursor-pointer"
              aria-label="Previous"
            >
              <SkipBack className="w-5 h-5" />
            </button>
            <button
              onClick={togglePlay}
              className="w-16 h-16 rounded-full bg-(--ac-gold) text-white flex items-center justify-center shadow-lg cursor-pointer hover:scale-105 transition-transform"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
            </button>
            <button
              onClick={playNext}
              className="w-11 h-11 rounded-full bg-(--bg-soft) dark:bg-[#282019] border border-(--ln-gold) flex items-center justify-center text-(--tx-strong) dark:text-[#f5ebd9] cursor-pointer"
              aria-label="Next"
            >
              <SkipForward className="w-5 h-5" />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-(--tx-mute) dark:text-[#a89379] font-bold">
                {ar ? 'يُذاع الآن' : 'Now playing'}
              </p>
              {jingleNow ? (
                <p className="font-bold text-(--tx-strong) dark:text-[#f5ebd9] truncate">
                  📻 {ar ? 'أرثوذكس كونيكت راديو لايف' : 'OrthodoxConnect Radio Live'}
                </p>
              ) : welcomeNow ? (
                <p className="font-bold text-(--tx-strong) dark:text-[#f5ebd9] truncate">
                  👋 {ar ? 'أهلاً بيك في راديو أرثوذكس كونيكت' : 'Welcome to OrthodoxConnect Radio'}
                </p>
              ) : (
                <p className="font-bold text-(--tx-strong) dark:text-[#f5ebd9] truncate">
                  {started && nowPlaying ? nowPlaying.title : ar ? 'اضغط تشغيل لبدء الراديو' : 'Tap play to start the radio'}
                </p>
              )}
              {started && nowPlaying && (
                <p className="text-xs text-(--tx-mute) dark:text-[#a89379]">{catLabel(nowPlaying.category)}</p>
              )}
            </div>
            {started && nowPlaying && (
              <button
                onClick={() => shareTrack(nowPlaying)}
                className="w-11 h-11 rounded-full bg-(--bg-soft) dark:bg-[#282019] border border-(--ln-gold) flex items-center justify-center text-(--tx-strong) dark:text-[#f5ebd9] cursor-pointer shrink-0"
                title={ar ? 'مشاركة' : 'Share'}
                aria-label="Share"
              >
                <Share2 className="w-5 h-5" />
              </button>
            )}
          </div>
          {playerError && <p className="text-xs text-red-600 dark:text-red-400">{playerError}</p>}

          {/* Track list */}
          <div className="border-t border-(--ln-gold) dark:border-[#8b6b4a] pt-3">
            <div className="flex items-center gap-2 mb-2 text-(--tx-mute) dark:text-[#a89379]">
              <ListMusic className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">
                {ar ? 'برنامج المحطة' : 'Station lineup'} ({filteredTracks.length})
              </span>
            </div>
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {filteredTracks.map((t, i) => (
                <div
                  key={t.id}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl transition-colors ${
                    started && i === currentIndex
                      ? 'bg-(--ac-gold)/15 border border-(--ln-gold)'
                      : 'hover:bg-(--bg-soft) dark:hover:bg-[#282019]'
                  }`}
                >
                  <button
                    onClick={() => startAt(i)}
                    className="flex-1 min-w-0 flex items-center gap-3 text-left cursor-pointer"
                  >
                    <span className="text-xs font-bold text-(--tx-mute) w-6 text-center">{i + 1}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold text-(--tx-strong) dark:text-[#f5ebd9] truncate">{t.title}</span>
                      <span className="block text-[11px] text-(--tx-mute) dark:text-[#a89379]">{catLabel(t.category)}</span>
                    </span>
                    {started && i === currentIndex && isPlaying && (
                      <span className="flex gap-0.5 items-end h-4" aria-hidden>
                        <span className="w-1 bg-(--ac-gold) rounded animate-pulse h-4" />
                        <span className="w-1 bg-(--ac-gold) rounded animate-pulse h-2.5" />
                        <span className="w-1 bg-(--ac-gold) rounded animate-pulse h-3.5" />
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => shareTrack(t)}
                    className="p-2 rounded-lg text-(--tx-mute) dark:text-[#a89379] hover:bg-(--bg-soft) dark:hover:bg-[#282019] cursor-pointer shrink-0"
                    title={ar ? 'مشاركة' : 'Share'}
                    aria-label="Share"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ---------- ADMIN: manage station ---------- */}
      {isAdminOrOwner && (
        <div className="bg-(--bg-card) dark:bg-[#1c1611] border-2 border-(--ln-gold) dark:border-[#8b6b4a] rounded-3xl shadow-lg overflow-hidden">
          <button
            onClick={() => setShowAdmin((s) => !s)}
            className="w-full flex items-center gap-2 p-4 cursor-pointer"
          >
            <Settings2 className="w-5 h-5 text-(--ac-gold-tx)" />
            <span className="font-bold text-sm text-(--tx-strong) dark:text-[#f5ebd9] flex-1 text-left">
              {ar ? 'إدارة المحطة' : 'Manage station'}
            </span>
            {showAdmin ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showAdmin && (
            <div className="px-4 pb-4 space-y-4 border-t border-(--ln-gold) dark:border-[#8b6b4a] pt-4">
              {/* Live mode */}
              <div className="rounded-2xl border border-red-500/40 p-3 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={liveOn}
                    onChange={(e) => setLiveOn(e.target.checked)}
                    className="w-5 h-5 accent-red-600"
                  />
                  <span className="font-bold text-sm text-red-600 dark:text-red-400">
                    {ar ? '🔴 بث مباشر الآن' : '🔴 Live now'}
                  </span>
                </label>
                <input
                  value={liveUrl}
                  onChange={(e) => setLiveUrl(e.target.value)}
                  placeholder={ar ? 'رابط يوتيوب البث المباشر' : 'YouTube link of the live broadcast'}
                  className="w-full px-3 py-2 rounded-xl bg-(--bg-soft) dark:bg-[#282019] border border-(--ln-gold) text-sm"
                  dir="ltr"
                />
                <input
                  value={liveTitle}
                  onChange={(e) => setLiveTitle(e.target.value)}
                  placeholder={ar ? 'عنوان البث (مثال: قداس الأحد)' : 'Live title (e.g. Sunday Liturgy)'}
                  className="w-full px-3 py-2 rounded-xl bg-(--bg-soft) dark:bg-[#282019] border border-(--ln-gold) text-sm"
                />
                <button
                  onClick={adminSaveLive}
                  disabled={adminBusy}
                  className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-bold cursor-pointer disabled:opacity-50"
                >
                  {ar ? 'حفظ البث' : 'Save live'}
                </button>
              </div>

              {/* Add track */}
              <div className="rounded-2xl border border-(--ln-gold) dark:border-[#8b6b4a] p-3 space-y-2">
                <p className="font-bold text-sm text-(--tx-strong) dark:text-[#f5ebd9]">
                  {ar ? 'أضف إلى المحطة' : 'Add to the station'}
                </p>
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={ar ? 'الاسم (مثال: القداس الإلهي)' : 'Title (e.g. Divine Liturgy)'}
                  className="w-full px-3 py-2 rounded-xl bg-(--bg-soft) dark:bg-[#282019] border border-(--ln-gold) text-sm"
                />
                <input
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder={ar ? 'رابط اليوتيوب' : 'YouTube link'}
                  className="w-full px-3 py-2 rounded-xl bg-(--bg-soft) dark:bg-[#282019] border border-(--ln-gold) text-sm"
                  dir="ltr"
                />
                <div className="flex gap-2">
                  <select
                    value={newCat}
                    onChange={(e) => setNewCat(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-(--bg-soft) dark:bg-[#282019] border border-(--ln-gold) text-sm"
                  >
                    {CATS.filter((c) => c.id !== 'all').map((c) => (
                      <option key={c.id} value={c.id}>{ar ? c.ar : c.en}</option>
                    ))}
                  </select>
                  <button
                    onClick={adminAdd}
                    disabled={adminBusy}
                    className="flex-1 px-4 py-2 rounded-xl bg-(--ac-gold) text-white text-sm font-bold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1"
                  >
                    <Plus className="w-4 h-4" /> {ar ? 'أضف' : 'Add'}
                  </button>
                </div>
              </div>

              {adminMsg && <p className="text-xs font-bold text-(--ac-gold-tx)">{adminMsg}</p>}

              {/* Existing tracks */}
              <div className="space-y-1">
                {tracks.map((t) => (
                  <div key={t.id} className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-(--bg-soft) dark:hover:bg-[#282019]">
                    <span className="flex-1 min-w-0 text-sm truncate text-(--tx-strong) dark:text-[#f5ebd9]">{t.title}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-(--bg-soft) dark:bg-[#282019] border border-(--ln-gold) text-(--tx-mute)">
                      {catLabel(t.category)}
                    </span>
                    <button
                      onClick={() => adminDelete(t.id)}
                      className="p-1.5 rounded-lg text-red-600 hover:bg-red-100 dark:hover:bg-red-950 cursor-pointer"
                      aria-label="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {tracks.length === 0 && (
                  <p className="text-xs text-(--tx-mute) text-center py-2">
                    {ar ? 'لا يوجد شيء بعد.' : 'Nothing here yet.'}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
