/** Base URL del backend público (sin barra final). Vacío si no está definido en build. */
export function getPublicApiBaseUrl() {
  if (typeof process === 'undefined' || !process.env.REACT_APP_API_BASE_URL) return '';
  return String(process.env.REACT_APP_API_BASE_URL).replace(/\/$/, '');
}
