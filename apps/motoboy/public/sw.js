/* Service worker do app do motoboy — Web Push + clique na notificação.
   Mantém-se propositalmente simples: sem cache offline por enquanto,
   só o canal de notificações (Fase 5 Bloco B). */

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { title: 'Leeva', body: event.data ? event.data.text() : '' };
  }
  const title = payload.title || 'Leeva';
  const options = {
    body: payload.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: payload.tag || 'leeva',
    renotify: true,
    requireInteraction: !!payload.urgent,
    vibrate: payload.urgent ? [300, 120, 300] : [200],
    data: { url: payload.url || '/status', ...(payload.data || {}) },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/status';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(target).catch(() => {});
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
