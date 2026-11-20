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
 *
 * Diagnostics (Hany, 2026-11-20): registration used to fail silently —
 * the token listener is async, the token POST ignored its HTTP status,
 * and errors only reached console.warn, which nobody can see on a phone.
 * This module now keeps a plain-English diagnostics record (permission,
 * token received, server accepted, server has a token, last problem) that
 * Settings → Notifications shows on the phone, so a closed-app failure
 * can be pinned to the phone or the server without the Cloudflare logs.
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

export interface PushDiagnostics {
  isNative: boolean;
  permission: 'granted' | 'denied' | 'prompt' | 'unknown';
  tokenReceived: boolean;
  tokenReceivedAt: number | null;
  tokenPostStatus: number | null;
  tokenPostAt: number | null;
  lastError: string | null;
  serverRegistered: boolean | null;
  serverTokenCount: number | null;
  serverCheckedAt: number | null;
}

const diag: PushDiagnostics = {
  isNative: false,
  permission: 'unknown',
  tokenReceived: false,
  tokenReceivedAt: null,
  tokenPostStatus: null,
  tokenPostAt: null,
  lastError: null,
  serverRegistered: null,
  serverTokenCount: null,
  serverCheckedAt: null,
};

let listenersAttached = false;
let pushModule: any = null;

async function loadPushModule(): Promise<any | null> {
  if (pushModule) return pushModule;
  try {
    const mod: any = await import('@capacitor/push-notifications');
    pushModule = mod.PushNotifications || null;
    return pushModule;
  } catch (e) {
    diag.lastError = 'Push plugin missing in this app version';
    return null;
  }
}

async function postFcmToken(userId: string, token: string, platform: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/fcm-tokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ user_id: userId, token, platform }),
    });
    diag.tokenPostStatus = res.status;
    diag.tokenPostAt = Date.now();
    if (!res.ok) {
      diag.lastError = `Server refused the token (HTTP ${res.status})`;
      console.warn('[native-push] token registration failed:', res.status);
      return false;
    }
    return true;
  } catch (e) {
    diag.lastError = 'Could not reach the server to send the token';
    console.warn('[native-push] token registration failed:', e);
    return false;
  }
}

/** Current diagnostics (a copy). Never includes the token value itself. */
export function getPushDiagnostics(): PushDiagnostics {
  return { ...diag, isNative: isNativeApp() };
}

/**
 * Ask the server whether it holds any FCM token for this signed-in user.
 * Returns null when the check itself failed (shown as "Couldn't check").
 */
export async function fetchPushServerStatus(): Promise<{ registered: boolean; count: number } | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/fcm-tokens/status`, {
      headers: { ...authHeader() },
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok || !data || typeof data.registered !== 'boolean') return null;
    diag.serverRegistered = !!data.registered;
    diag.serverTokenCount = typeof data.count === 'number' ? data.count : null;
    diag.serverCheckedAt = Date.now();
    return { registered: diag.serverRegistered, count: diag.serverTokenCount ?? 0 };
  } catch (e) {
    return null;
  }
}

/**
 * Load diagnostics without re-registering or prompting: permission state
 * (checkPermissions, no dialog) + server token check.
 */
export async function loadPushDiagnostics(): Promise<PushDiagnostics> {
  diag.isNative = isNativeApp();
  if (!diag.isNative) return getPushDiagnostics();
  try {
    const PushNotifications = await loadPushModule();
    if (PushNotifications && typeof PushNotifications.checkPermissions === 'function') {
      const perm = await PushNotifications.checkPermissions().catch(() => null);
      if (perm && typeof perm.receive === 'string') {
        diag.permission = perm.receive === 'granted' ? 'granted' : perm.receive === 'denied' ? 'denied' : 'prompt';
      }
    }
  } catch (e) {}
  await fetchPushServerStatus();
  return getPushDiagnostics();
}

/**
 * Register this native device for FCM push. Safe to call on every login:
 * on the web it returns false immediately; in the native app it requests
 * permission, registers with FCM, and sends the token to the server.
 * Returns true when registration started (the token itself arrives
 * asynchronously — see getPushDiagnostics for whether it landed).
 */
export async function registerNativePush(userId: string): Promise<boolean> {
  try {
    if (!userId || !isNativeApp()) return false;
    if (typeof window === 'undefined') return false;
    diag.isNative = true;
    const PushNotifications = await loadPushModule();
    if (!PushNotifications) return false;
    const perm = await PushNotifications.requestPermissions();
    diag.permission = perm && perm.receive === 'granted' ? 'granted' : 'denied';
    if (perm.receive !== 'granted') {
      diag.lastError = 'Notification permission not allowed on this phone';
      console.warn('[native-push] notification permission not granted');
      return false;
    }
    // Attach ALL listeners BEFORE register(): on Android the 'registration'
    // event can fire before a listener attached after register() exists,
    // losing the token with no retry (v9 fix — v8 never registered a token).
    // Attached once: re-registering must not stack duplicate listeners.
    if (!listenersAttached) {
      listenersAttached = true;
      PushNotifications.addListener('registration', async (reg: any) => {
        if (reg && reg.value) {
          diag.tokenReceived = true;
          diag.tokenReceivedAt = Date.now();
          await postFcmToken(userId, reg.value, 'android');
        }
      });
      PushNotifications.addListener('registrationError', (err: any) => {
        const msg = (err && (err.error || err.message)) || 'Registration failed';
        diag.lastError = String(msg).slice(0, 200);
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
    }
    await PushNotifications.register();
    // Retry once if no token arrived within 10s (listeners are attached,
    // so the retry's event will be caught).
    setTimeout(() => {
      if (!diag.tokenReceived) {
        console.warn('[native-push] no token in 10s, retrying register()');
        PushNotifications.register().catch(() => {});
      }
    }, 10000);
    return true;
  } catch (e) {
    diag.lastError = String((e as any)?.message || e).slice(0, 200);
    console.warn('[native-push] registration failed:', e);
    return false;
  }
}

/**
 * "Check again" from Settings → Notifications: re-run registration, wait
 * up to 12s for the token to land, then ask the server what it holds.
 */
export async function refreshPushDiagnostics(userId: string): Promise<PushDiagnostics> {
  if (!isNativeApp() || !userId) return getPushDiagnostics();
  const startedAt = Date.now();
  await registerNativePush(userId);
  // Wait for the async token event (already true if a previous login got one).
  while (!diag.tokenReceived && Date.now() - startedAt < 12000) {
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!diag.tokenReceived) {
    diag.lastError = diag.lastError || 'No token arrived from the phone in 12s';
  }
  await fetchPushServerStatus();
  return getPushDiagnostics();
}
