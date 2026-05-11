/**
 * Registro del SW en producción: actualización inmediata (el SW usa skipWaiting + clients.claim)
 * y aviso al documento cuando hay build nuevo o cuando el SW se activó.
 */

const SW_URL_REL = '/sw.js';

function requestSkipWaiting(worker) {
  if (!worker) return;
  try {
    worker.postMessage({ type: 'SKIP_WAITING' });
  } catch {
    /* ignore */
  }
}

function postSwMessageToPage(data) {
  try {
    window.dispatchEvent(new CustomEvent('padbol:pwa-sw-message', { detail: data }));
  } catch {
    /* ignore */
  }
}

function attachRegistrationHandlers(registration) {
  if (!registration || registration.__padbolHandlersAttached) return;
  registration.__padbolHandlersAttached = true;

  registration.addEventListener('updatefound', () => {
    const installing = registration.installing;
    if (!installing) return;
    requestSkipWaiting(installing);
    installing.addEventListener('statechange', () => {
      requestSkipWaiting(installing);
      if (installing.state !== 'installed') return;
      // Primera instalación: no hay controller aún; no es “actualización” para el usuario.
      if (!navigator.serviceWorker.controller) return;
      const payload = { phase: 'installed', waiting: Boolean(registration.waiting) };
      postSwMessageToPage({ type: 'PM_SW_UPDATE_AVAILABLE', ...payload });
      try {
        window.dispatchEvent(new CustomEvent('padbol:pwa-update-available', { detail: payload }));
      } catch {
        /* ignore */
      }
    });
  });

  requestSkipWaiting(registration.waiting);
}

export function registerServiceWorker() {
  if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) {
    return;
  }

  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  navigator.serviceWorker.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    postSwMessageToPage(data);
  });

  window.addEventListener('load', () => {
    const base = String(process.env.PUBLIC_URL || '').replace(/\/$/, '');
    const swUrl = `${base}${SW_URL_REL}`;

    navigator.serviceWorker
      .register(swUrl)
      .then((registration) => {
        attachRegistrationHandlers(registration);
        requestSkipWaiting(registration.waiting);
        void registration.update();

        setInterval(() => {
          void registration.update();
        }, 60 * 60 * 1000);
      })
      .catch(() => {
        /* sin SW la app sigue siendo usable */
      });
  });
}
