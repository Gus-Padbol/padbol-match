/* Padbol Match — service worker básico (cache de shell y assets estáticos). Bump CACHE_VERSION al desplegar si querés forzar recarga de caché. */
const CACHE_VERSION = 'padbol-match-pwa-v1';
const PRECACHE_URLS = ['/', '/manifest.json', '/logo192.png', '/logo512.png', '/favicon.ico'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      Promise.all(
        PRECACHE_URLS.map((url) =>
          cache.add(url).catch(() => {
            /* Algún host puede fallar en /; no bloquea el SW */
          })
        )
      )
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key.startsWith('padbol-match-pwa-') && key !== CACHE_VERSION) {
              return caches.delete(key);
            }
            return undefined;
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const path = url.pathname;
  const isStaticAsset =
    path.startsWith('/static/') ||
    /\.(?:js|css|png|jpg|jpeg|gif|svg|ico|webp|woff2?|map)$/i.test(path);

  if (!isStaticAsset && path !== '/' && !PRECACHE_URLS.includes(path)) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type === 'error') {
            return response;
          }
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => {
            try {
              cache.put(event.request, copy);
            } catch {
              /* ignore */
            }
          });
          return response;
        })
        .catch(() => cached)
    })
  );
});
