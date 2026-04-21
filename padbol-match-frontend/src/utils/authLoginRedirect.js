/** Path completo para ?redirect= (pathname + search), listo para encodeURIComponent. */
export function authLoginRedirectPath(location) {
  return `${location.pathname}${location.search || ''}`;
}

/** URL `/auth?redirect=…` con destino seguro (pathname + search opcional). */
export function authUrlWithRedirect(pathnameAndSearch) {
  const raw = String(pathnameAndSearch || '/hub').trim() || '/hub';
  const p = raw.startsWith('/') ? raw : `/${raw}`;
  return `/auth?redirect=${encodeURIComponent(p)}`;
}
