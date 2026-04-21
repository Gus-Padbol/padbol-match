/** Path completo para ?redirect= (pathname + search), listo para encodeURIComponent. */
export function authLoginRedirectPath(location) {
  return `${location.pathname}${location.search || ''}`;
}
