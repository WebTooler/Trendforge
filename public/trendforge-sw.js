const CACHE_NAME = 'trendforge-notifications-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'TREND_FORGE_NEW_STORY') return;
  const options = event.data.options || {};
  event.waitUntil(self.registration.showNotification('New on TrendForge', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/Trendforge/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => 'focus' in client);
      if (existing) return existing.focus().then(() => existing.navigate(target));
      return self.clients.openWindow(target);
    }),
  );
});
