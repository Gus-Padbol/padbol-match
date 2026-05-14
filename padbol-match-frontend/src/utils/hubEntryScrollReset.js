/** Contenedor scroll interno de {@link ../pages/UserHome.jsx}. */
export const HUB_SCROLL_CONTAINER_SELECTOR = '.hub-scroll-container';

export function hubPathOnlyFromString(dest) {
  if (dest == null) return '/';
  const s = String(dest).trim();
  if (!s) return '/';
  const noHash = s.split('#')[0];
  let pathPart = noHash;
  if (noHash.includes('://')) {
    try {
      pathPart = new URL(noHash).pathname || '/';
    } catch {
      pathPart = '/';
    }
  } else {
    pathPart = noHash.split('?')[0] || '/';
  }
  return pathPart.replace(/\/+$/, '') || '/';
}

export function isUserHomeHubPath(pathOrFullUrl) {
  const p = hubPathOnlyFromString(pathOrFullUrl);
  return p === '/hub' || p === '/inicio' || p === '/home';
}

/** Viewport + document + panel interno del hub (si ya está en el DOM). */
export function resetHubEntryScroll() {
  try {
    if (typeof window !== 'undefined') {
      try {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      } catch {
        window.scrollTo(0, 0);
      }
    }
    if (typeof document !== 'undefined') {
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
      const el = document.querySelector(HUB_SCROLL_CONTAINER_SELECTOR);
      if (el) el.scrollTop = 0;
    }
  } catch {
    try {
      if (typeof window !== 'undefined') window.scrollTo(0, 0);
    } catch {
      /* ignore */
    }
  }
}

/** Tras `navigate` al hub: el layout nuevo puede montarse en el siguiente frame. */
export function scheduleHubEntryScrollReset() {
  resetHubEntryScroll();
  if (typeof window === 'undefined') return;
  if (typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(() => resetHubEntryScroll());
  }
  window.setTimeout(resetHubEntryScroll, 0);
}
