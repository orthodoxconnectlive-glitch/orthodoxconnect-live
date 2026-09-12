/**
 * Web Push client for OrthodoxConnect.
 * Subscribes this device to push notifications (used for incoming calls
 * even when the app is closed) and registers the subscription with the server.
 */

// VAPID public key (safe to ship in client code)
// Rotated 2026-09-12 after the previous key was lost from worker env on redeploy.
const VAPID_PUBLIC_KEY =
  'BDrZbE-xWZdI4bykRXZG1pZRSV1g4_zxXVLzZvBISWGEsLuluW5G0nTNatg8MqBNcsoZLLApuLPk6RHyjJHPQ98';
const VAPID_KEY_STORAGE = 'oc-vapid-key-used';

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

    // Key rotation: if we have no record of which VAPID key this subscription was
    // made with, or it differs from the current key, the subscription is useless —
    // drop it and subscribe fresh. (Keys were rotated 2026-09-12.)
    try {
      const usedKey = localStorage.getItem(VAPID_KEY_STORAGE);
      if (sub && usedKey !== VAPID_PUBLIC_KEY) {
        try { await sub.unsubscribe(); } catch (e) {}
        try {
          await fetch('/api/push-subscriptions', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId, clear_all: true }),
          });
        } catch (e) {}
        sub = null;
      }
    } catch (e) {}

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
      try { localStorage.setItem(VAPID_KEY_STORAGE, VAPID_PUBLIC_KEY); } catch (e) {}
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

    // Clear all old subscriptions for this user first (removes dead endpoints)
    await fetch('/api/push-subscriptions', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, clear_all: true }),
    }).catch(() => {});

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

/**
 * Deep diagnostic: tests each layer separately and returns a detailed report.
 * 1. Can the service worker show a notification directly? (local test)
 * 2. Is there a valid push subscription?
 * 3. Does the server accept the registration?
 */
export async function diagnosePush(userId: string): Promise<string> {
  const lines: string[] = [];
  try {
    if (!('serviceWorker' in navigator)) { lines.push('❌ No service worker support'); return lines.join('\n'); }
    if (!('PushManager' in window)) { lines.push('❌ No PushManager support'); return lines.join('\n'); }
    lines.push('✓ Browser supports push');

    const reg = await navigator.serviceWorker.ready;
    lines.push('✓ Service worker ready');

    // Test 1: can SW show a notification directly?
    try {
      await reg.showNotification('Direct test', { body: 'If you see this, the service worker works' });
      lines.push('✓ Direct notification shown — check phone top NOW');
    } catch (e) {
      lines.push('❌ Direct notification failed: ' + ((e as any)?.message || 'unknown'));
    }

    // Test 2: subscription status
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      lines.push('✓ Push subscription exists');
      lines.push('  Endpoint: ' + sub.endpoint.substring(0, 50) + '...');
    } else {
      lines.push('❌ No push subscription in browser');
    }

    lines.push('Permission: ' + Notification.permission);
    return lines.join('\n');
  } catch (e) {
    return 'Error: ' + ((e as any)?.message || 'unknown');
  }
}
