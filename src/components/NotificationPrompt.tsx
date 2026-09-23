import { useState, useEffect } from 'react';
import { ensurePushSubscription } from '../utils/pushClient';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

/** True on iPhone/iPad (including iPadOS 13+ which reports as Mac). */
function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1)
  );
}

/** True when running as an installed (home-screen) app. */
function isStandalone(): boolean {
  try {
    if ((window.navigator as any).standalone === true) return true;
    if (window.matchMedia('(display-mode: standalone)').matches) return true;
  } catch (e) {}
  return false;
}

/**
 * Banner prompting the user to enable push notifications if not already granted.
 * Ensures every user gets registered for closed-app notifications without
 * needing the manual reset-push page.
 *
 * iPhone special case: Apple only delivers push notifications to web apps that
 * were added to the Home Screen (iOS 16.4+). In mobile Safari the "Enable"
 * button would silently do nothing, so iOS browser users instead get a short
 * Add-to-Home-Screen guide.
 */
export function NotificationPrompt() {
  const { profile } = useAuth();
  const { language } = useTheme();
  const ar = language === 'ar';
  const [visible, setVisible] = useState(false);
  const [installGuide, setInstallGuide] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!profile?.id) return;
    if (!('Notification' in window)) return;

    // iPhone in the browser (not installed): push can't work here at all —
    // guide the user to add the app to the Home Screen first.
    if (isIOS() && !isStandalone()) {
      try {
        if (localStorage.getItem('oc-notif-install-dismissed') === '1') return;
      } catch (e) {}
      setInstallGuide(true);
      return;
    }

    // Don't nag if already dismissed
    try {
      if (localStorage.getItem('oc-notif-prompt-dismissed') === '1') return;
    } catch (e) {}

    // Show banner if permission not granted
    if (Notification.permission === 'default') {
      setVisible(true);
    } else if (Notification.permission === 'granted') {
      // Permission granted but ensure we're subscribed (silent)
      ensurePushSubscription(profile.id);
    }
    // If denied, don't show banner (user must enable in browser settings)
  }, [profile?.id]);

  const dismiss = () => {
    try { localStorage.setItem('oc-notif-prompt-dismissed', '1'); } catch (e) {}
    setVisible(false);
  };

  const dismissInstallGuide = () => {
    try { localStorage.setItem('oc-notif-install-dismissed', '1'); } catch (e) {}
    setInstallGuide(false);
  };

  const enable = async () => {
    if (!profile?.id) return;
    setBusy(true);
    try {
      await ensurePushSubscription(profile.id);
      // Check if it worked
      if (Notification.permission === 'granted') {
        setVisible(false);
        try { localStorage.setItem('oc-notif-prompt-dismissed', '1'); } catch (e) {}
      }
    } catch (e) {}
    setBusy(false);
  };

  if (installGuide) {
    return (
      <div className="mx-4 mt-3 p-4 rounded-xl bg-gradient-to-r from-amber-900/90 to-yellow-800/90 border border-amber-600/50 shadow-lg" dir={ar ? 'rtl' : 'ltr'}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">📲</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-100">
              {ar ? 'استلم التنبيهات والتطبيق مغلق' : 'Get alerts even when the app is closed'}
            </p>
            <p className="text-xs text-amber-200/80">
              {ar
                ? 'على الآيفون، أضف التطبيق إلى الشاشة الرئيسية أولاً:'
                : 'On iPhone, add the app to your Home Screen first:'}
            </p>
          </div>
          <button
            onClick={dismissInstallGuide}
            className="text-amber-300/70 hover:text-amber-200 text-lg px-1"
            aria-label={ar ? 'إغلاق' : 'Dismiss'}
          >
            ✕
          </button>
        </div>
        <ol className="mt-2 space-y-1 text-xs text-amber-100/90 list-none">
          <li>{ar ? '١. اضغط زر المشاركة في سفاري' : '1. Tap the Share button in Safari'} ⎙</li>
          <li>{ar ? '٢. اختر "إضافة إلى الشاشة الرئيسية"' : '2. Choose "Add to Home Screen"'}</li>
          <li>{ar ? '٣. افتح التطبيق من الأيقونة الجديدة واضغط "تفعيل" للتنبيهات' : '3. Open the app from the new icon, then tap Enable for notifications'}</li>
        </ol>
      </div>
    );
  }

  if (!visible) return null;

  return (
    <div className="mx-4 mt-3 p-4 rounded-xl bg-gradient-to-r from-amber-900/90 to-yellow-800/90 border border-amber-600/50 flex items-center gap-3 shadow-lg">
      <span className="text-2xl">🔔</span>
      <div className="flex-1">
        <p className="text-sm font-semibold text-amber-100">Never miss a message</p>
        <p className="text-xs text-amber-200/80">Enable notifications to get alerts even when the app is closed.</p>
      </div>
      <button
        onClick={enable}
        disabled={busy}
        className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold disabled:opacity-50"
      >
        {busy ? '...' : 'Enable'}
      </button>
      <button
        onClick={dismiss}
        className="text-amber-300/70 hover:text-amber-200 text-lg px-1"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
