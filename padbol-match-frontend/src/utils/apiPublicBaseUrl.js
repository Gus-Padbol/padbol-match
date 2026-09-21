import clientEnvironment from '../config/clientEnvironment.js';
const { resolveClientEnvironment, PRODUCTION_API_URL } = clientEnvironment;

function environment() {
  return resolveClientEnvironment(typeof process === 'undefined' ? {} : process.env);
}

/** Base configurada; en producción conserva el uso relativo cuando está vacía. */
export function getPublicApiBaseUrl() {
  return environment().apiBaseUrl;
}

/** Una sola resolución para las pantallas y servicios que necesitan base absoluta. */
export function getApiBaseUrl({ fallback = PRODUCTION_API_URL, preferLegacy = false } = {}) {
  const env = environment();
  return (preferLegacy ? env.apiLegacyUrl || env.apiBaseUrl : env.apiBaseUrl || env.apiLegacyUrl) || fallback;
}
