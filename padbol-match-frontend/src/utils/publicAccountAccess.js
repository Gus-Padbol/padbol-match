const DEFAULT_PADBOL_MATCH_WEB_ORIGIN = 'https://www.padbolmatch.com';

function cleanOrigin(value) {
  try {
    const url = new URL(String(value || DEFAULT_PADBOL_MATCH_WEB_ORIGIN));
    return url.protocol === 'https:' ? url.origin : DEFAULT_PADBOL_MATCH_WEB_ORIGIN;
  } catch {
    return DEFAULT_PADBOL_MATCH_WEB_ORIGIN;
  }
}

function safeAccessPath(value) {
  const candidate = String(value || '/acceso');
  try {
    const url = new URL(candidate, DEFAULT_PADBOL_MATCH_WEB_ORIGIN);
    if (url.origin !== DEFAULT_PADBOL_MATCH_WEB_ORIGIN || url.pathname !== '/acceso') return '/acceso';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '/acceso';
  }
}

export function isPadbolMatchWebHost(hostname) {
  const host = String(hostname || '').trim().toLowerCase().replace(/\.$/, '');
  return host === 'localhost'
    || host === '127.0.0.1'
    || host === 'padbolmatch.com'
    || host.endsWith('.padbolmatch.com');
}

/**
 * padbol.com no sirve la aplicación en `/acceso`; desde esa web se cruza al
 * dominio de Padbol Match. Dentro de la aplicación se conserva navegación local.
 */
export function resolvePublicAccountAccessHref(
  locationLike,
  accessPath = '/acceso',
  env = typeof process !== 'undefined' ? process.env : {},
) {
  const path = safeAccessPath(accessPath);
  const hostname = locationLike?.hostname || '';
  if (!hostname || isPadbolMatchWebHost(hostname)) return path;
  const appOrigin = cleanOrigin(env?.REACT_APP_PADBOL_MATCH_WEB_URL);
  return `${appOrigin}${path}`;
}

export { DEFAULT_PADBOL_MATCH_WEB_ORIGIN };
