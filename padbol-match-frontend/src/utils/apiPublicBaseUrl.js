import clientEnvironment from '../config/clientEnvironment.js';
const { resolveClientEnvironment, PRODUCTION_API_URL } = clientEnvironment;

function environment() {
  // CRA replaces these literal REACT_APP_* reads at build time. Reading process.env
  // behind a runtime `typeof process` guard yields {} in the browser and falls back
  // to production even when the build was compiled with QA/development endpoints.
  return resolveClientEnvironment({
    REACT_APP_APP_VARIANT: process.env.REACT_APP_APP_VARIANT,
    REACT_APP_API_BASE_URL: process.env.REACT_APP_API_BASE_URL,
    REACT_APP_API_URL: process.env.REACT_APP_API_URL,
    REACT_APP_SUPABASE_URL: process.env.REACT_APP_SUPABASE_URL,
    REACT_APP_SUPABASE_ANON_KEY: process.env.REACT_APP_SUPABASE_ANON_KEY,
  });
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
