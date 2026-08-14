/**
 * OrthodoxConnect Service Worker
 * Handles background push notifications, call ringing events, and notification click actions.
 */

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle incoming push notification events from server or background sync
self.addEventListener('push', (event) => {
  let data = {
    title: 'OrthodoxConnect Notification',
    body: 'You have a new update in your parish community.',
    icon: 'https://images.unsplash.com/photo-1548625361-1959779df5ff?auto=format&fit=crop&q=80&w=192',
    badge: 'https://images.unsplash.com/photo-1548625361-1959779df5ff?auto=format&fit=crop&q=80&w=96',
    data: { url: '/' },
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    vibrate: [300, 100, 300, 100, 500],
    data: data.data || { url: '/' },
    requireInteraction: data.type === 'call',
    actions: data.type === 'call' ? [
      { action: 'answer', title: '📞 Answer' },
      { action: 'decline', title: '❌ Decline' }
    ] : [
      { action: 'open', title: 'Open App' }
    ],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Handle notification click: Focus active client window or open app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
