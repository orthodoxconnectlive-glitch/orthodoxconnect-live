import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { apiFetch } from '../lib/api';

type CandleMode = 'welcome' | 'pray';
type CandleState = 'idle' | 'lighting' | 'lit';

// How long a lit candle burns before it goes out (1 minute per person).
const BURN_MS = 60000;

type CandleStats = {
  total: number;
  today: number;
  recent: Array<{ user_name: string; created_at: string }>;
};

const litKey = () => `oc_candle_lit_${new Date().toISOString().slice(0, 10)}`;

export default function CandleModal({
  isOpen,
  onClose,
  mode,
}: {
  isOpen: boolean;
  onClose: () => void;
  mode: CandleMode;
}) {
  const { language } = useTheme();
  const ar = language === 'ar';
  const [state, setState] = useState<CandleState>('idle');
  const [stats, setStats] = useState<CandleStats | null>(null);
  const burnTimer = useRef<number | null>(null);

  const clearBurnTimer = () => {
    if (burnTimer.current) {
      clearTimeout(burnTimer.current);
      burnTimer.current = null;
    }
  };

  // After lighting, the flame burns BURN_MS then goes out on its own.
  const scheduleBurnout = (litAt: number) => {
    clearBurnTimer();
    const remaining = BURN_MS - (Date.now() - litAt);
    if (remaining <= 0) {
      setState('idle');
      try { localStorage.removeItem(litKey()); } catch {}
      return;
    }
    burnTimer.current = window.setTimeout(() => {
      setState('idle');
      try { localStorage.removeItem(litKey()); } catch {}
      burnTimer.current = null;
    }, remaining);
  };

  const refreshStats = () => {
    apiFetch<{ success: boolean; total: number; today: number; recent: CandleStats['recent'] }>('/api/candles')
      .then((r) => {
        if (r && r.success) setStats({ total: r.total || 0, today: r.today || 0, recent: r.recent || [] });
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (isOpen) {
      try {
        // The stored value is the lighting timestamp; the flame is still
        // alive only within BURN_MS of it (old '1' values read as idle).
        const litAt = Number(localStorage.getItem(litKey()) || 0);
        if (litAt && Date.now() - litAt < BURN_MS) {
          setState('lit');
          scheduleBurnout(litAt);
        } else {
          setState('idle');
        }
      } catch {
        setState('idle');
      }
      refreshStats();
    } else {
      clearBurnTimer();
    }
  }, [isOpen]);

  useEffect(() => () => clearBurnTimer(), []);

  if (!isOpen) return null;

  const startLighting = () => {
    if (state !== 'idle') return;
    setState('lighting');
    setTimeout(() => {
      const now = Date.now();
      setState('lit');
      try {
        localStorage.setItem(litKey(), String(now));
      } catch {}
      // Record the lighting on the server (count + who lit). Best-effort:
      // the candle still lights locally even if the request fails.
      apiFetch('/api/candles', { method: 'POST', body: JSON.stringify({}) })
        .then(() => refreshStats())
        .catch(() => {});
      scheduleBurnout(now);
    }, 2100);
  };

  const title =
    mode === 'welcome'
      ? ar
        ? 'أهلاً بك في أورثوذكس كونكت 🕯'
        : 'Welcome to OrthodoxConnect 🕯'
      : ar
        ? 'قُل صلاتك'
        : 'Say your prayer';
  const subtitle =
    mode === 'welcome'
      ? ar
        ? 'ابدأ رحلتك بإضاءة شمعة.'
        : 'Begin your journey by lighting a candle.'
      : ar
        ? 'تحدث مع الله.'
        : 'Talk with God.';
  const lightLabel = ar ? 'أضئ الشمعة 🕯' : 'Light up the candle 🕯';
  const litMessage = ar
    ? 'شمعتك مضيئة. الله يسمعك. 🤍'
    : 'Your candle is lit. God hears you. 🤍';
  const amenLabel = ar ? 'آمين 🤍' : 'Amen 🤍';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-6 bg-[#0b0705]/95 backdrop-blur-sm animate-fade-in">
      <style>{`
        @keyframes oc-match-move {
          0% { transform: translate(95px, 130px) rotate(38deg); opacity: 0; }
          12% { opacity: 1; }
          62% { transform: translate(6px, 6px) rotate(14deg); opacity: 1; }
          78% { transform: translate(0px, 0px) rotate(12deg); opacity: 1; }
          100% { transform: translate(0px, 0px) rotate(12deg); opacity: 0; }
        }
        @keyframes oc-spark {
          0%, 55% { opacity: 0; transform: scale(0.3); }
          68% { opacity: 1; transform: scale(1.25); }
          82% { opacity: 0.9; transform: scale(1); }
          100% { opacity: 0; transform: scale(0.4); }
        }
        @keyframes oc-flame-flicker {
          0%, 100% { transform: scale(1) skewX(0deg); }
          25% { transform: scale(1.06, 0.94) skewX(2.5deg); }
          50% { transform: scale(0.96, 1.05) skewX(-2deg); }
          75% { transform: scale(1.03, 0.97) skewX(1.5deg); }
        }
        @keyframes oc-glow-pulse {
          0%, 100% { opacity: 0.55; transform: scale(1); }
          50% { opacity: 0.85; transform: scale(1.08); }
        }
        @keyframes oc-flame-in {
          0% { opacity: 0; transform: scale(0.2); }
          60% { opacity: 1; transform: scale(1.15); }
          100% { opacity: 1; transform: scale(1); }
        }
        .oc-match { animation: oc-match-move 2.1s ease-in-out forwards; transform-origin: 100px 108px; }
        .oc-spark { animation: oc-spark 2.1s ease-out forwards; transform-origin: 100px 100px; }
        .oc-flame { animation: oc-flame-in 0.5s ease-out forwards, oc-flame-flicker 1.6s ease-in-out 0.5s infinite; transform-origin: 100px 96px; }
        .oc-glow { animation: oc-glow-pulse 2.4s ease-in-out infinite; transform-origin: 100px 92px; }
      `}</style>

      <div className="relative w-full max-w-sm text-center">
        <button
          onClick={onClose}
          className="absolute -top-2 right-0 p-2 rounded-full text-stone-500 hover:text-amber-200 hover:bg-white/10 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="font-serif font-bold text-2xl text-amber-100 mb-1">{title}</h2>
        <p className="text-stone-400 text-sm mb-2">{subtitle}</p>
        {stats && stats.total > 0 && (
          <p className="text-amber-200/70 text-xs mb-4">
            🕯 {stats.total.toLocaleString()} {ar ? 'شمعة مضيئة' : 'candles lit'}
          </p>
        )}

        {/* Candle scene */}
        <div className="mx-auto w-56 h-64 relative">
          <svg viewBox="0 0 200 260" className="w-full h-full">
            <defs>
              <radialGradient id="ocGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.85" />
                <stop offset="45%" stopColor="#f59e0b" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="ocWax" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#e8d9b8" />
                <stop offset="50%" stopColor="#f7ecd2" />
                <stop offset="100%" stopColor="#d9c49a" />
              </linearGradient>
              <linearGradient id="ocFlame" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="#f97316" />
                <stop offset="55%" stopColor="#fbbf24" />
                <stop offset="100%" stopColor="#fef3c7" />
              </linearGradient>
            </defs>

            {/* Warm glow behind the flame */}
            {state === 'lit' && (
              <circle cx="100" cy="92" r="72" fill="url(#ocGlow)" className="oc-glow" />
            )}

            {/* Candle plate */}
            <ellipse cx="100" cy="232" rx="52" ry="10" fill="#3a2c1c" />
            <ellipse cx="100" cy="229" rx="52" ry="10" fill="#54402a" />

            {/* Candle body */}
            <rect x="78" y="118" width="44" height="112" rx="9" fill="url(#ocWax)" />
            <ellipse cx="100" cy="118" rx="22" ry="7" fill="#fbf3df" />
            <ellipse cx="100" cy="119" rx="13" ry="4" fill="#e6d3a8" />
            {/* Wax drips */}
            <rect x="82" y="122" width="7" height="26" rx="3.5" fill="#f7ecd2" opacity="0.85" />
            <rect x="111" y="122" width="6" height="18" rx="3" fill="#f7ecd2" opacity="0.85" />

            {/* Wick */}
            <rect x="98.6" y="104" width="2.8" height="14" rx="1.4" fill="#2b2118" />

            {/* Flame */}
            {state === 'lit' && (
              <g className="oc-flame">
                <path
                  d="M100 62 C 112 78, 110 92, 100 100 C 90 92, 88 78, 100 62 Z"
                  fill="url(#ocFlame)"
                />
                <ellipse cx="100" cy="90" rx="4.5" ry="7" fill="#fff7ed" opacity="0.9" />
              </g>
            )}

            {/* Spark flash where the match meets the wick */}
            {state === 'lighting' && (
              <g className="oc-spark">
                <circle cx="100" cy="102" r="9" fill="#fde68a" />
                <circle cx="100" cy="102" r="4.5" fill="#fffbeb" />
              </g>
            )}

            {/* Matchstick lighting the candle */}
            {state === 'lighting' && (
              <g className="oc-match">
                <rect x="97" y="108" width="6" height="72" rx="3" fill="#c9a06a" transform="rotate(0 100 108)" />
                <rect x="97" y="108" width="6" height="72" rx="3" fill="#c9a06a" />
                <circle cx="100" cy="106" r="7" fill="#b91c1c" />
                <circle cx="100" cy="106" r="7" fill="#ef4444" opacity="0.55" />
              </g>
            )}
          </svg>
        </div>

        {/* Actions */}
        <div className="mt-6 min-h-[76px] flex flex-col items-center justify-start gap-3">
          {state === 'idle' && (
            <button
              onClick={startLighting}
              className="px-8 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-serif font-bold text-base shadow-[0_0_30px_rgba(245,158,11,0.35)] transition-all cursor-pointer"
            >
              {lightLabel}
            </button>
          )}
          {state === 'lighting' && (
            <p className="text-amber-200/80 text-sm font-serif italic animate-pulse">
              {ar ? '...تُضاء الشمعة' : 'Lighting your candle...'}
            </p>
          )}
          {state === 'lit' && (
            <>
              <p className="text-amber-100 font-serif text-lg">{litMessage}</p>
              {stats && stats.recent.length > 0 && (
                <p className="text-stone-400 text-xs max-w-[280px] leading-relaxed">
                  {ar ? 'أضاء مؤخراً: ' : 'Recently lit by: '}
                  {stats.recent
                    .slice(0, 6)
                    .map((r) => r.user_name || (ar ? 'مؤمن' : 'A believer'))
                    .filter(Boolean)
                    .join(ar ? '، ' : ', ')}
                </p>
              )}
              <button
                onClick={onClose}
                className="px-8 py-2.5 rounded-2xl border border-amber-500/50 text-amber-200 hover:bg-amber-500/10 font-serif font-bold text-sm transition-all cursor-pointer"
              >
                {amenLabel}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
