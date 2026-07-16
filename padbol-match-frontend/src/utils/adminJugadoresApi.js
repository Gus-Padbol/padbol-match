const DEFAULT_LIMIT = 20;

function resolveApiBase(apiBaseUrl) {
  return String(apiBaseUrl || '').replace(/\/$/, '');
}

export function normalizeAdminJugadoresSearchItems(json) {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.items)) return json.items;
  if (Array.isArray(json?.jugadores)) return json.jugadores;
  if (Array.isArray(json?.data)) return json.data;
  return [];
}

export function parseAdminJugadoresApiError(status, json) {
  const msg = json?.error || json?.message || null;
  if (status === 401) return msg || 'Sesión expirada. Volvé a iniciar sesión (401).';
  if (status === 403) return msg || 'No tenés permiso para buscar jugadores de esta sede (403).';
  if (status === 500) return msg || 'Error del servidor al buscar jugadores (500).';
  if (status === 503) return msg || 'Servicio de jugadores no disponible (503).';
  return msg || `Error al buscar jugadores (${status || 'red'})`;
}

export async function fetchAdminJugadoresList({
  apiBaseUrl,
  accessToken,
  sedeId,
  q = '',
  page = 1,
  limit = DEFAULT_LIMIT,
}) {
  if (!accessToken) {
    const err = new Error('Sesión expirada. Volvé a iniciar sesión.');
    err.status = 401;
    throw err;
  }
  const params = new URLSearchParams();
  if (sedeId != null && sedeId !== '') params.set('sede_id', String(sedeId));
  if (q) params.set('q', q);
  params.set('page', String(page));
  params.set('limit', String(limit));

  const res = await fetch(`${resolveApiBase(apiBaseUrl)}/api/admin/jugadores?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(parseAdminJugadoresApiError(res.status, json));
    err.status = res.status;
    err.code = json.code;
    throw err;
  }
  return json;
}

export async function searchAdminJugadores({
  apiBaseUrl,
  accessToken,
  q,
  sedeId,
  limit = 12,
}) {
  if (!accessToken) {
    const err = new Error('Sesión expirada. Volvé a iniciar sesión (401).');
    err.status = 401;
    throw err;
  }
  const params = new URLSearchParams();
  params.set('q', String(q || ''));
  if (sedeId != null && sedeId !== '') params.set('sede_id', String(sedeId));
  params.set('limit', String(limit));

  const res = await fetch(`${resolveApiBase(apiBaseUrl)}/api/admin/jugadores/buscar?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(parseAdminJugadoresApiError(res.status, json));
    err.status = res.status;
    throw err;
  }
  return normalizeAdminJugadoresSearchItems(json);
}

export function formatJugadorUsername(username) {
  const u = String(username || '').trim().replace(/^@+/, '');
  return u ? `@${u}` : '';
}

export function formatJugadorVinculacionLabel(vinculacion, t) {
  const v = String(vinculacion || '').toLowerCase();
  if (v === 'con_historial') return t('admin.jugadores.vinculacionHistorial');
  if (v === 'registrado') return t('admin.jugadores.vinculacionRegistrado');
  return t('admin.jugadores.vinculacionSinHistorial');
}

export function formatJugadorActivity(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    const s = String(iso).slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
  }
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Ordenamiento cliente sobre items ya cargados. */
export function sortAdminJugadoresItems(items, sortKey = 'name_asc') {
  const rows = Array.isArray(items) ? [...items] : [];
  const nameOf = (j) => String(j?.display_name || j?.nombre || '').toLowerCase();
  const actOf = (j) => {
    const t = j?.last_activity_at ? new Date(j.last_activity_at).getTime() : 0;
    return Number.isFinite(t) ? t : 0;
  };
  switch (sortKey) {
    case 'name_desc':
      return rows.sort((a, b) => nameOf(b).localeCompare(nameOf(a), 'es'));
    case 'activity_desc':
      return rows.sort((a, b) => actOf(b) - actOf(a));
    case 'activity_asc':
      return rows.sort((a, b) => actOf(a) - actOf(b));
    case 'name_asc':
    default:
      return rows.sort((a, b) => nameOf(a).localeCompare(nameOf(b), 'es'));
  }
}

export function filterAdminJugadoresByVinculacion(items, vinculacion = '') {
  const v = String(vinculacion || '').trim().toLowerCase();
  if (!v) return Array.isArray(items) ? items : [];
  return (Array.isArray(items) ? items : []).filter(
    (j) => String(j?.vinculacion || '').toLowerCase() === v,
  );
}
