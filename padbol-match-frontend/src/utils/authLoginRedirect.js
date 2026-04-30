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
 * Valor de `?redirect=` al abrir login desde el hub (`/`, `/hub`, …): vuelve al hub (`/`).
 * Desde otra ruta: conservar pathname + search para volver tras login.
 * El destino final lo decide `AccesoCuenta` (por defecto `/` si no hay `redirect=`).
 */
export function loginRedirectAfterHubEntry(location) {
  const path = String(location?.pathname || '/').replace(/\/+$/, '') || '/';
  const hubRoots = ['/', '/hub', '/inicio', '/home'];
  if (hubRoots.includes(path)) return '/';
  return authLoginRedirectPath(location);
}
