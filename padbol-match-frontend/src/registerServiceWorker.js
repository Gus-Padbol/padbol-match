/**
 * Registro del SW en producción: nueva versión por build (CACHE_VERSION + ?v=),
 * skipWaiting + clients.claim en el SW, y recarga automática cuando hay update real
 * (evita quedar atrapado en HTML/JS de un deploy anterior).
 */

import { PWA_BUILD_ID } from './pwaBuildId';

const SW_URL_REL = '/sw.js';
const RELOAD_GUARD_KEY = 'padbol:pwa-reload-once';

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

/** Una sola recarga por ciclo de update; evita loops si el reload re-dispara el evento. */
export function shouldAutoReloadForSwUpdate(data, storage = sessionStorage) {
  if (!data || typeof data !== 'object') return false;
  if (data.type !== 'PM_SW_UPDATED' && data.forceReload !== true) return false;
  try {
    if (storage.getItem(RELOAD_GUARD_KEY) === '1') return false;
    storage.setItem(RELOAD_GUARD_KEY, '1');
  } catch {
    /* private mode: aún así recargamos una vez */
  }
  return true;
}

export function clearSwReloadGuard(storage = sessionStorage) {
  try {
    storage.removeItem(RELOAD_GUARD_KEY);
  } catch {
    /* ignore */
  }
}

function reloadForSwUpdate() {
  try {
    window.location.reload();
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

  // Tras un reload por update, limpiar el guard para el próximo ciclo de deploy.
  clearSwReloadGuard();

  // Si la página ya estaba controlada, un controllerchange = SW nuevo → recargar
  // (no en el primer install, para evitar reload innecesario en la 1ª visita).
  const hadControllerOnLoad = Boolean(navigator.serviceWorker.controller);
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadControllerOnLoad || refreshing) return;
    refreshing = true;
    if (shouldAutoReloadForSwUpdate({ type: 'PM_SW_UPDATED', forceReload: true })) {
      reloadForSwUpdate();
    }
  });

  navigator.serviceWorker.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    postSwMessageToPage(data);
    if (shouldAutoReloadForSwUpdate(data)) {
      reloadForSwUpdate();
    }
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
