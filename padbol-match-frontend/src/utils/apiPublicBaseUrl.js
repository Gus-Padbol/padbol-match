import clientEnvironment from '../config/clientEnvironment.js';
const { resolveClientEnvironment, PRODUCTION_API_URL } = clientEnvironment;

function environment() {
  return resolveClientEnvironment(typeof process === 'undefined' ? {} : process.env);
}

export function isPadbolVercelPreviewHostname(hostname) {
  return /^padbol-match-9abn-(?:[a-z0-9-]+)-padbol1\.vercel\.app$/i.test(
    String(hostname || '').trim(),
  );
}

function shouldUsePreviewProxy(env) {
  if (env.isQA || env.apiBaseUrl || env.apiLegacyUrl || typeof window === 'undefined') return false;
  return isPadbolVercelPreviewHostname(window.location?.hostname);
}

/** Base configurada; en producción conserva el uso relativo cuando está vacía. */
export function getPublicApiBaseUrl() {
  return environment().apiBaseUrl;
}

/** Una sola resolución para las pantallas y servicios que necesitan base absoluta. */
export function getApiBaseUrl({ fallback = PRODUCTION_API_URL, preferLegacy = false } = {}) {
  const env = environment();
  // Las previews del proyecto usan el proxy same-origin de Vercel. El backend
  // de producción no debe abrir CORS para cualquier subdominio efímero.
  if (shouldUsePreviewProxy(env)) return '';
  return (preferLegacy ? env.apiLegacyUrl || env.apiBaseUrl : env.apiBaseUrl || env.apiLegacyUrl) || fallback;
}
