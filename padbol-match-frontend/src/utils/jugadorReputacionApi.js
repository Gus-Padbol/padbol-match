const EMPTY_REPUTACION = {
  cancelaciones_30dias: 0,
  suspendido: false,
  advertencia: false,
  suspendido_hasta: null,
};

const adminCache = new Map();

export function clearJugadorReputacionAdminCache() {
  adminCache.clear();
}

export async function fetchJugadorReputacion({ apiBaseUrl, accessToken }) {
  if (!accessToken) return { ...EMPTY_REPUTACION };
  const r = await fetch(`${apiBaseUrl}/api/jugador/reputacion`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(body.error || 'No se pudo cargar la reputación');
    err.status = r.status;
    throw err;
  }
  return { ...EMPTY_REPUTACION, ...body };
}

export async function fetchAdminJugadorReputacion({ apiBaseUrl, accessToken, userId, useCache = true }) {
  const uid = String(userId || '').trim();
  if (!uid || !accessToken) return { ...EMPTY_REPUTACION, userId: uid || null };
  const cacheKey = `${apiBaseUrl}::${uid}`;
  if (useCache && adminCache.has(cacheKey)) {
    return adminCache.get(cacheKey);
  }
  const r = await fetch(`${apiBaseUrl}/api/admin/jugador/${encodeURIComponent(uid)}/reputacion`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) {
    return { ...EMPTY_REPUTACION, userId: uid };
  }
  const rep = { ...EMPTY_REPUTACION, ...body, userId: uid };
  adminCache.set(cacheKey, rep);
  return rep;
}

export async function fetchAdminSuspensiones({ apiBaseUrl, accessToken }) {
  const r = await fetch(`${apiBaseUrl}/api/admin/suspensiones`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(body.error || 'No se pudieron cargar las suspensiones');
  }
  return Array.isArray(body.suspensiones) ? body.suspensiones : [];
}

export async function levantarSuspensionAdmin({ apiBaseUrl, accessToken, userId }) {
  const uid = String(userId || '').trim();
  const r = await fetch(`${apiBaseUrl}/api/admin/suspensiones/${encodeURIComponent(uid)}/levantar`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(body.error || 'No se pudo levantar la suspensión');
  }
  adminCache.delete(`${apiBaseUrl}::${uid}`);
  return body;
}

export function formatFechaReputacion(iso, locale = 'es-AR') {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
}
