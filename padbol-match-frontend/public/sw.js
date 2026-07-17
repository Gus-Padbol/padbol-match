/* Padbol Match — service worker (shell + estáticos).
 * CACHE_VERSION lo inyecta scripts/emit-pwa-build-id.js en cada build / arranque.
 * skipWaiting + clients.claim: el nuevo SW toma control al instalarse. */
const CACHE_VERSION = 'pwa-1784315844813';

/** postMessage al cliente cuando se reemplazó una caché anterior (actualización real). */
const MSG_UPDATED = 'PM_SW_UPDATED';

const PRECACHE_URLS = ['/', '/manifest.json', '/logo192.png', '/logo512.png', '/favicon.ico'];

function broadcastToClients(data) {
  return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
    clientList.forEach((client) => {
      try {
        client.postMessage(data);
      } catch {
        /* ignore */
      }
    });
  });
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) =>
        Promise.all(
          PRECACHE_URLS.map((url) =>
            cache.add(url).catch(() => {
              /* host puede fallar en /; no bloquea el SW */
            })
          )
        )
      )
  );
});

self.addEventListener('activate', (event) => {
  self.clients.claim();
  event.waitUntil(
    caches.keys().then((keys) => {
      const staleKeys = keys.filter((k) => k !== CACHE_VERSION);
      const hadPrevious = staleKeys.length > 0;
      return Promise.all(staleKeys.map((k) => caches.delete(k))).then(() => {
        if (hadPrevious) {
          return broadcastToClients({
            type: MSG_UPDATED,
            version: CACHE_VERSION,
            ts: Date.now(),
          });
        }
      });
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
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
