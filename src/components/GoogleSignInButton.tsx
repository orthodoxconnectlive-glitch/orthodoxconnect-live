import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

// Sign in / Sign up with Google (Google Identity Services ID-token flow).
// The button renders ONLY when the worker reports a Google client ID
// (GET /api/auth/google/config). Until Hany pastes his OAuth client ID into
// wrangler [vars], this renders nothing and email login works as before.
// On credential, the ID token goes to POST /api/auth/google, which verifies
// it with Google and returns the app's normal session — same AuthContext
// state as email sign-in, so no navigation code is needed here.
declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (opts: any) => void;
          renderButton: (el: HTMLElement, opts: any) => void;
        };
      };
    };
  }
}

export const GoogleSignInButton: React.FC = () => {
  const { signInWithGoogle } = useAuth();
  const { language } = useTheme();
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const btnRef = useRef<HTMLDivElement>(null);
  const renderedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const initAndRender = (clientId: string) => {
      if (cancelled || renderedRef.current) return;
      const g = window.google?.accounts?.id;
      const el = btnRef.current;
      if (!g || !el) return;
      renderedRef.current = true;
      g.initialize({
        client_id: clientId,
        ux_mode: 'popup',
        callback: async (resp: any) => {
          const credential = resp?.credential || '';
          if (!credential) return;
          setBusy(true);
          setError(null);
          const { error: err } = await signInWithGoogle(credential);
          setBusy(false);
          if (err) {
            setError(language === 'ar' ? 'فشل تسجيل الدخول عبر Google. حاول مرة أخرى.' : 'Google sign-in failed. Please try again.');
          }
        },
      });
      g.renderButton(el, {
        theme: 'outline',
        size: 'large',
        width: 320,
        locale: language === 'ar' ? 'ar' : 'en',
      });
      setVisible(true);
    };
    (async () => {
      let clientId = '';
      try {
        const r = await fetch('/api/auth/google/config');
        const cfg = await r.json().catch(() => ({}));
        if (!cfg?.configured || !cfg?.clientId) return;
        clientId = cfg.clientId;
      } catch (e) {
        return; // config unreachable: stay hidden, email login still works
      }
      if ((window as any).google?.accounts?.id) {
        initAndRender(clientId);
        return;
      }
      if (!document.getElementById('google-gsi-script')) {
        const s = document.createElement('script');
        s.id = 'google-gsi-script';
        s.src = 'https://accounts.google.com/gsi/client';
        s.async = true;
        s.defer = true;
        s.onload = () => initAndRender(clientId);
        document.head.appendChild(s);
      } else {
        // Script tag exists but GIS not ready yet: retry briefly.
        let tries = 0;
        const timer = window.setInterval(() => {
          tries += 1;
          if ((window as any).google?.accounts?.id || tries > 20) {
            window.clearInterval(timer);
            initAndRender(clientId);
          }
        }, 250);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible && !error) {
    // Still hidden (not configured / script loading). Keep the mount point so
    // GIS can render into it once ready.
    return <div ref={btnRef} className="flex justify-center" />;
  }

  return (
    <div className="mt-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-px bg-(--ln-gold)/30" />
        <span className="text-[10px] font-serif uppercase tracking-widest text-[#1e3a8a] dark:text-[#93c5fd]">
          {language === 'ar' ? 'أو' : 'or'}
        </span>
        <div className="flex-1 h-px bg-(--ln-gold)/30" />
      </div>
      <div ref={btnRef} className="flex justify-center opacity-100" />
      {busy && (
        <p className="text-center text-[11px] font-serif text-[#1e3a8a] dark:text-[#93c5fd] mt-2">
          {language === 'ar' ? 'جارٍ تسجيل الدخول...' : 'Signing you in...'}
        </p>
      )}
      {error && (
        <p className="text-center text-[11px] font-serif text-red-400 mt-2">{error}</p>
      )}
    </div>
  );
};
