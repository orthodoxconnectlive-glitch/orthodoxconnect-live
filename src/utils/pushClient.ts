/**
 * Web Push client for OrthodoxConnect.
 * Subscribes this device to push notifications (used for incoming calls
 * even when the app is closed) and registers the subscription with the server.
 */

// VAPID public key (safe to ship in client code)
const VAPID_PUBLIC_KEY =
  'BIOd2w3oH0M41g64TK_M7_80MOtbIKfNYzPBg-dqJxfM-9VBnCoQmKYzvqokHsk6F89OPJWDtM2OlH9rA0ozKr0';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Make sure this device is subscribed to Web Push and the subscription
 * is registered on the server for this user. Safe to call on every login.
 */
export async function ensurePushSubscription(userId: string): Promise<void> {
  try {
    if (!userId) return;
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('[push] Web Push not supported in this browser');
      return;
    }

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();

    if (!sub) {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.warn('[push] notification permission not granted');
        return;
      }
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    const subJson = sub.toJSON();
    const endpoint = subJson.endpoint || '';
    const p256dh = (subJson.keys && (subJson.keys as any).p256dh) || '';
    const auth = (subJson.keys && (subJson.keys as any).auth) || '';
    if (!endpoint || !p256dh || !auth) {
      console.warn('[push] incomplete subscription keys');
      return;
    }

    const res = await fetch('/api/push-subscriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        subscription: { endpoint, keys: { p256dh, auth } },
      }),
    });
    if (!res.ok) {
      console.warn('[push] server registration failed:', res.status);
    } else {
      console.log('[push] device registered for call notifications');
    }
  } catch (e) {
    console.warn('[push] subscription failed:', e);
  }
}

/** Remove this device's push subscription (e.g. on logout). */
export async function removePushSubscription(userId: string): Promise<void> {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe();
      await fetch('/api/push-subscriptions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, endpoint }),
      }).catch(() => {});
    }
  } catch (e) {
    console.warn('[push] unsubscribe failed:', e);
  }
}

/**
 * Force a fresh push subscription: unsubscribe any existing one, create a new
 * subscription, register it with the server, and ask the server to send a test
 * push. Returns a status message for the UI.
 */
export async function testPushNotification(userId: string): Promise<string> {
  try {
    if (!userId) return 'Not logged in';
    if (typeof window === 'undefined') return 'Not supported';
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return 'Push not supported in this browser';
    }
    const reg = await navigator.serviceWorker.ready;
    // Drop any stale subscription so we get a fresh endpoint
    const oldSub = await reg.pushManager.getSubscription();
    if (oldSub) {
      try { await oldSub.unsubscribe(); } catch (e) {}
    }
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return 'Notification permission denied — enable it in browser settings';
    }
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
    const subJson = sub.toJSON();
    const endpoint = subJson.endpoint || '';
    const p256dh = (subJson.keys && (subJson.keys as any).p256dh) || '';
    const auth = (subJson.keys && (subJson.keys as any).auth) || '';
    if (!endpoint || !p256dh || !auth) return 'Failed to create subscription';

    const regRes = await fetch('/api/push-subscriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, subscription: { endpoint, keys: { p256dh, auth } } }),
    });
    if (!regRes.ok) return 'Server registration failed';

    // Ask server to send a test push to this device
    const testRes = await fetch('/api/push-subscriptions/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId }),
    });
    if (!testRes.ok) return 'Registered, but test send failed';
    return 'ok';
  } catch (e) {
    console.warn('[push] test failed:', e);
    return 'Error: ' + ((e as any)?.message || 'unknown');
  }
}
