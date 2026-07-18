/* Padbol Match — service worker (shell + estáticos).
 * CACHE_VERSION lo inyecta scripts/emit-pwa-build-id.js en cada build / arranque.
 * skipWaiting + clients.claim: el nuevo SW toma control al instalarse.
 *
 * Estrategia (evita atrapar HTML/JS incompatibles entre deploys):
 * - Navegaciones / documentos HTML: network-first (fallback a caché solo offline).
 * - /sw.js: nunca interceptar (el browser debe ver el script nuevo).
 * - /static/* hasheado: cache-first (immutable).
 * - Iconos/manifest: cache-first con revalidación al fallar red.
 */
const CACHE_VERSION = 'pwa-1784391462115';

/** postMessage al cliente cuando se reemplazó una caché anterior (actualización real). */
const MSG_UPDATED = 'PM_SW_UPDATED';

/** Solo offline fallback — no se sirve en cache-first para documentos. */
const PRECACHE_URLS = ['/manifest.json', '/logo192.png', '/logo512.png', '/favicon.ico'];

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

function isNavigationRequest(request) {
  if (request.mode === 'navigate') return true;
  const accept = request.headers.get('accept') || '';
  return accept.includes('text/html');
}

function networkFirst(request) {
  return fetch(request)
    .then((response) => {
      if (response && response.status === 200 && response.type !== 'error') {
        const copy = response.clone();
        caches.open(CACHE_VERSION).then((cache) => {
          try {
            cache.put(request, copy);
          } catch {
            /* ignore */
          }
        });
      }
      return response;
    })
    .catch(() =>
      caches.match(request).then((cached) => cached || caches.match('/'))
    );
}

function cacheFirst(request) {
  return caches.match(request).then((cached) => {
    if (cached) return cached;
    return fetch(request).then((response) => {
      if (!response || response.status !== 200 || response.type === 'error') {
        return response;
      }
      const copy = response.clone();
      caches.open(CACHE_VERSION).then((cache) => {
        try {
          cache.put(request, copy);
        } catch {
          /* ignore */
        }
      });
      return response;
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
              /* host puede fallar; no bloquea el SW */
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
            forceReload: true,
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

  // El script del SW no debe pasar por cache-first (bloquearía actualizaciones).
  if (path === '/sw.js' || path.endsWith('/sw.js')) {
    return;
  }

  // HTML / navegación: siempre preferir red para no servir index.html de otro deploy.
  if (isNavigationRequest(event.request) || path === '/') {
    event.respondWith(networkFirst(event.request));
    return;
  }

  const isHashedStatic = path.startsWith('/static/');
  const isPrecachedShell = PRECACHE_URLS.includes(path);

  if (!isHashedStatic && !isPrecachedShell) {
    return;
  }

  event.respondWith(cacheFirst(event.request));
});
