import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';

const STORAGE_KEY = 'oc-welcome-overlay-day';
const SHOW_MS = 3600;
const FADE_MS = 700;

function todayKey(): string {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

const PARTICLES = [
  { left: '18%', delay: '0s', size: 10, dur: '2.8s' },
  { left: '32%', delay: '0.5s', size: 7, dur: '3.2s' },
  { left: '47%', delay: '0.2s', size: 12, dur: '2.6s' },
  { left: '61%', delay: '0.9s', size: 8, dur: '3s' },
  { left: '74%', delay: '0.4s', size: 11, dur: '2.9s' },
  { left: '86%', delay: '1.1s', size: 7, dur: '3.4s' },
  { left: '26%', delay: '1.4s', size: 9, dur: '3.1s' },
  { left: '68%', delay: '1.7s', size: 6, dur: '2.7s' },
];

export function WelcomeOverlay() {
  const { language } = useTheme();
  const [show, setShow] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const ar = language === 'ar';

  useEffect(() => {
    let t1: number | undefined;
    let t2: number | undefined;
    try {
      const key = todayKey();
      if (window.localStorage.getItem(STORAGE_KEY) === key) return;
      window.localStorage.setItem(STORAGE_KEY, key);
    } catch {
      /* storage unavailable — still show once this session */
    }
    setShow(true);
    t1 = window.setTimeout(() => setLeaving(true), SHOW_MS);
    t2 = window.setTimeout(() => setShow(false), SHOW_MS + FADE_MS);
    return () => {
      if (t1) window.clearTimeout(t1);
      if (t2) window.clearTimeout(t2);
    };
  }, []);

  if (!show) return null;

  const dismiss = () => {
    setLeaving(true);
    window.setTimeout(() => setShow(false), FADE_MS);
  };

  return (
    <div
      onClick={dismiss}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center cursor-pointer"
      style={{
        background: 'radial-gradient(ellipse at 50% 35%, #16294d 0%, #0b1526 55%, #060b14 100%)',
        opacity: leaving ? 0 : 1,
        transition: 'opacity ' + FADE_MS + 'ms ease',
      }}
    >
      <style>{`
        @keyframes ocw-glow {
          0%, 100% { filter: drop-shadow(0 0 12px rgba(232,182,76,0.55)); transform: scale(1); }
          50% { filter: drop-shadow(0 0 34px rgba(255,220,130,0.95)); transform: scale(1.045); }
        }
        @keyframes ocw-rise {
          0% { transform: translateY(0); opacity: 0; }
          20% { opacity: 0.9; }
          100% { transform: translateY(-46vh); opacity: 0; }
        }
        @keyframes ocw-fadeup {
          from { opacity: 0; transform: translateY(18px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes ocw-spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* rising light particles */}
      {PARTICLES.map((p, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            bottom: '18%',
            left: p.left,
            width: p.size,
            height: p.size,
            borderRadius: '9999px',
            background: 'radial-gradient(circle, #ffe9a8 0%, rgba(232,182,76,0.35) 70%, transparent 100%)',
            animation: 'ocw-rise ' + p.dur + ' linear ' + p.delay + ' infinite',
            pointerEvents: 'none',
          }}
        />
      ))}

      {/* halo ring */}
      <div
        style={{
          position: 'absolute',
          width: 220,
          height: 220,
          borderRadius: '9999px',
          border: '1px solid rgba(232,182,76,0.25)',
          animation: 'ocw-spin-slow 24s linear infinite',
          pointerEvents: 'none',
        }}
      />

      {/* golden Coptic cross */}
      <div style={{ animation: 'ocw-glow 2.6s ease-in-out infinite, ocw-fadeup 0.9s ease both' }}>
        <svg width="128" height="128" viewBox="0 0 100 100" aria-hidden="true">
          <defs>
            <linearGradient id="ocw-gold" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffe9a8" />
              <stop offset="0.5" stopColor="#e8b64c" />
              <stop offset="1" stopColor="#b97f1f" />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r="45" fill="none" stroke="url(#ocw-gold)" strokeWidth="3.5" />
          <path
            d="M45,20 L55,20 L54,42 L76,40 L80,42 L80,58 L76,60 L54,58 L55,80 L45,80 L46,58 L24,60 L20,58 L20,42 L24,40 L46,42 Z"
            fill="url(#ocw-gold)"
          />
          <circle cx="50" cy="50" r="7" fill="none" stroke="url(#ocw-gold)" strokeWidth="2.5" />
        </svg>
      </div>

      {/* welcome words */}
      <div className="mt-8 text-center px-8" style={{ animation: 'ocw-fadeup 0.9s ease 0.35s both' }}>
        <div
          className="font-serif font-black"
          style={{ fontSize: 40, color: '#f3d27a', textShadow: '0 2px 18px rgba(232,182,76,0.45)', lineHeight: 1.15 }}
        >
          {ar ? 'أهلاً بك' : 'Welcome'}
        </div>
        <div
          className="mt-3 font-serif"
          style={{ fontSize: 19, color: '#f5ebd9', opacity: 0.95, lineHeight: 1.5 }}
        >
          {ar ? 'سعداء جداً بوجودك هنا' : "We're so happy you're here"}
        </div>
        <div
          className="mt-2 font-serif"
          style={{ fontSize: 15, color: '#c9a84c', opacity: 0.85 }}
          dir="auto"
        >
          {ar ? 'Welcome' : 'أهلاً بك ✦ سعداء بوجودك هنا'}
        </div>
      </div>

      <div
        className="absolute bottom-10 text-xs tracking-widest uppercase"
        style={{ color: 'rgba(245,235,217,0.4)', animation: 'ocw-fadeup 0.9s ease 0.8s both' }}
      >
        {ar ? 'اضغط في أي مكان للمتابعة' : 'tap anywhere to continue'}
      </div>
    </div>
  );
}
