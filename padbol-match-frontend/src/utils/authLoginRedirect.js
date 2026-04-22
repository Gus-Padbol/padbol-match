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
