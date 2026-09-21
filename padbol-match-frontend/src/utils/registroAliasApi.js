import { getApiBaseUrl } from './apiPublicBaseUrl';

/** Sólo disponibilidad pública; el servidor identifica al propietario desde Bearer. */
export async function checkRegistrationAliasAvailability(alias, { accessToken = '', signal } = {}) {
  const value = String(alias || '').trim();
  if (!value || value.length > 80 || value.includes('@')) return false;
  const response = await fetch(`${getApiBaseUrl()}/api/registro/alias-disponible?alias=${encodeURIComponent(value)}`, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    ...(signal ? { signal } : {}),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || typeof payload.available !== 'boolean') throw new Error('alias_availability_unavailable');
  return payload.available;
}
