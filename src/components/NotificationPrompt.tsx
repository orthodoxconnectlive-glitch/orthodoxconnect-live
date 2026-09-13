import { useState, useEffect } from 'react';
import { ensurePushSubscription } from '../utils/pushClient';
import { useAuth } from '../context/AuthContext';

/**
 * Banner prompting the user to enable push notifications if not already granted.
 * Ensures every user gets registered for closed-app notifications without
 * needing the manual reset-push page.
 */
export function NotificationPrompt() {
  const { profile } = useAuth();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!profile?.id) return;
    if (!('Notification' in window)) return;
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
