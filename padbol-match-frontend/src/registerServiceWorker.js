/**
 * Registro del SW en producción: nueva versión por build (CACHE_VERSION + ?v=),
 * skipWaiting + clients.claim en el SW, y banner para recargar cuando el usuario elija.
 */

import { PWA_BUILD_ID } from './pwaBuildId';

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

  navigator.serviceWorker.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    postSwMessageToPage(data);
  });

  window.addEventListener('load', () => {
    const base = String(process.env.PUBLIC_URL || '').replace(/\/$/, '');
    const swPath = `${base}${SW_URL_REL}`;
    const sep = swPath.includes('?') ? '&' : '?';
    const swUrl = `${swPath}${sep}v=${encodeURIComponent(PWA_BUILD_ID)}`;

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
