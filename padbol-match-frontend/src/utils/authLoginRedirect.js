/** Path completo para ?redirect= (pathname + search), listo para encodeURIComponent. */
export function authLoginRedirectPath(location) {
  return `${location.pathname}${location.search || ''}`;
}

/** URL `/login?redirect=…` con destino seguro (pathname + search opcional). */
export function authUrlWithRedirect(pathnameAndSearch) {
  const raw = String(pathnameAndSearch || '/').trim() || '/';
  const p = raw.startsWith('/') ? raw : `/${raw}`;
  return `/login?redirect=${encodeURIComponent(p)}`;
}

/**
 * Tras login desde el hub (`/`, `/hub`, …): ir al perfil.
 * Desde otra ruta: volver a la misma URL (pathname + search).
 */
export function loginRedirectAfterHubEntry(location) {
  const path = String(location?.pathname || '/').replace(/\/+$/, '') || '/';
  const hubRoots = ['/', '/hub', '/inicio', '/home'];
  if (hubRoots.includes(path)) return '/mi-perfil';
  return authLoginRedirectPath(location);
}
