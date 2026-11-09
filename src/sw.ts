/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

declare let self: ServiceWorkerGlobalScope;

self.skipWaiting();
clientsClaim();
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));

self.addEventListener('push', (event) => {
  let data: { title?: string; body?: string; url?: string } = {};
  try {
    data = event.data?.json() ?? {};
  } catch {
    data = { body: event.data?.text() };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Focus', {
      body: data.body || '',
      icon: self.registration.scope + 'icon-192.png',
      badge: self.registration.scope + 'icon-192.png',
      data: { url: data.url || '/' }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // '/#/life' → https://toi.github.io/focus/#/life
  const raw: string = (event.notification.data && event.notification.data.url) || '/';
  const url = new URL(raw.replace(/^\//, ''), self.registration.scope).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const c = clients[0] as WindowClient | undefined;
      if (c) {
        c.focus();
        return c.navigate(url).catch(() => undefined);
      }
      return self.clients.openWindow(url);
    })
  );
});
