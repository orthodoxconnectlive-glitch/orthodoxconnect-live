/**
 * Native push (Facebook-style FCM) for OrthodoxConnect.
 *
 * Web Push delivery to this browser registration was declared failed
 * 2026-10-31 (Reset + full-minute wait = no notification at all, despite
 * direct SW test working). The native app therefore uses Firebase Cloud
 * Messaging directly, like Facebook: FCM talks straight to the app even
 * when it is closed, with no browser service worker in between.
 *
 * This module is a no-op on the web/PWA: it only activates when running
 * inside Capacitor (window.Capacitor.isNativePlatform()). The
 * @capacitor/push-notifications plugin is loaded dynamically, so the web
 * build does not break before Capacitor is installed.
 */

import { API_BASE_URL, authHeader } from '../lib/api';

export function isNativeApp(): boolean {
  try {
    const cap = (window as any).Capacitor;
    return !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
  } catch (e) {
    return false;
  }
}

async function postFcmToken(userId: string, token: string, platform: string): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/api/fcm-tokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ user_id: userId, token, platform }),
    });
  } catch (e) {
    console.warn('[native-push] token registration failed:', e);
  }
}

/**
 * Register this native device for FCM push. Safe to call on every login:
 * on the web it returns false immediately; in the native app it requests
 * permission, registers with FCM, and sends the token to the server.
 * Returns true when a token was registered.
 */
export async function registerNativePush(userId: string): Promise<boolean> {
  try {
    if (!userId || !isNativeApp()) return false;
    if (typeof window === 'undefined') return false;
    let PushNotifications: any;
    try {
      const mod: any = await import('@capacitor/push-notifications');
      PushNotifications = mod.PushNotifications;
    } catch (e) {
      console.warn('[native-push] push-notifications plugin not installed yet');
      return false;
    }
    if (!PushNotifications) return false;
    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== 'granted') {
      console.warn('[native-push] notification permission not granted');
      return false;
    }
    // Attach ALL listeners BEFORE register(): on Android the 'registration'
    // event can fire before a listener attached after register() exists,
    // losing the token with no retry (v9 fix — v8 never registered a token).
    let tokenReceived = false;
    PushNotifications.addListener('registration', async (reg: any) => {
      if (reg && reg.value) {
        tokenReceived = true;
        await postFcmToken(userId, reg.value, 'android');
      }
    });
    PushNotifications.addListener('registrationError', (err: any) => {
      console.warn('[native-push] registration error:', err);
    });
    // Foreground: the app is open, in-app notifications already work good —
    // do nothing here, the existing in-app system shows the message.
    PushNotifications.addListener('pushNotificationReceived', () => {});
    // Tapped (app closed or background): open the message screen / home.
    PushNotifications.addListener('pushNotificationActionPerformed', (action: any) => {
      try {
        const url = (action && action.notification && action.notification.data && action.notification.data.url) || '/';
        window.location.href = url;
      } catch (e) {}
    });
    await PushNotifications.register();
    // Retry once if no token arrived within 10s (listeners are attached,
    // so the retry's event will be caught).
    setTimeout(() => {
      if (!tokenReceived) {
        console.warn('[native-push] no token in 10s, retrying register()');
        PushNotifications.register().catch(() => {});
      }
    }, 10000);
    return true;
  } catch (e) {
    console.warn('[native-push] registration failed:', e);
    return false;
  }
}
