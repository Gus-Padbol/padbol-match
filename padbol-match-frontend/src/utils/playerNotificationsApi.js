import { getApiBaseUrl } from './apiPublicBaseUrl';

export function normalizePlayerNotifications(payload) {
  const rows = Array.isArray(payload) ? payload : payload?.notificaciones;
  return Array.isArray(rows) ? rows.filter((row) => row && row.id != null) : [];
}

export function normalizeNotificationIds(ids) {
  return [...new Set((Array.isArray(ids) ? ids : []).map((id) => String(id ?? '').trim()).filter((id) => id && id.length <= 160))];
}

/** Usa los endpoints montados. Sólo devuelve ids confirmados por el servidor. */
export async function markPlayerNotificationsRead(ids, { headers = {}, all = false, apiBaseUrl = getApiBaseUrl() } = {}) {
  const normalized = normalizeNotificationIds(ids);
  if (!normalized.length) return [];
  const paths = all ? ['/api/notificaciones/leer-todas'] : normalized.map((id) => `/api/notificaciones/${encodeURIComponent(id)}/leer`);
  for (const route of paths) {
    const response = await fetch(`${apiBaseUrl}${route}`, { method: 'PATCH', headers });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.ok !== true) {
      const error = new Error(payload?.error || 'notification_read_failed');
      error.status = response.status;
      throw error;
    }
  }
  return normalized;
}
