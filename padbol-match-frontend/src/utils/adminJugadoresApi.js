const DEFAULT_LIMIT = 20;

export async function fetchAdminJugadoresList({
  apiBaseUrl,
  accessToken,
  sedeId,
  q = '',
  page = 1,
  limit = DEFAULT_LIMIT,
}) {
  const params = new URLSearchParams();
  if (sedeId != null && sedeId !== '') params.set('sede_id', String(sedeId));
  if (q) params.set('q', q);
  params.set('page', String(page));
  params.set('limit', String(limit));

  const res = await fetch(`${apiBaseUrl}/api/admin/jugadores?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json.error || `Error ${res.status}`);
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
  const params = new URLSearchParams();
  params.set('q', String(q || ''));
  if (sedeId != null && sedeId !== '') params.set('sede_id', String(sedeId));
  params.set('limit', String(limit));

  const res = await fetch(`${apiBaseUrl}/api/admin/jugadores/buscar?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json.error || `Error ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return Array.isArray(json.items) ? json.items : [];
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
