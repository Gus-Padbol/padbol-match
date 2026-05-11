/* Padbol Match — service worker (shell + estáticos).
 * Bump CACHE_VERSION en cada deploy importante para invalidar caché en PWA (p. ej. iOS).
 * skipWaiting + clients.claim: el nuevo SW toma control en cuanto termina install/activate. */
const CACHE_VERSION = 'padbol-match-pwa-v3';

/** postMessage al cliente al activar una nueva versión (ver `registerServiceWorker.js`). */
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
      .then(() => self.skipWaiting())
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
      .then(() =>
        broadcastToClients({
          type: MSG_UPDATED,
          version: CACHE_VERSION,
          ts: Date.now(),
        })
      )
  );
});

/** Permite que el cliente pida saltar espera si en el futuro se quita skipWaiting del install. */
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
