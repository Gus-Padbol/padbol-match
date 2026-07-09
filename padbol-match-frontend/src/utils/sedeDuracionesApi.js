const DEFAULT_API_BASE =
  typeof process !== 'undefined' && process.env.REACT_APP_API_BASE_URL
    ? String(process.env.REACT_APP_API_BASE_URL).replace(/\/$/, '')
    : 'https://padbol-backend.onrender.com';

export const MI_SEDE_PRECIOS_DEPORTE_OPTIONS = [
  { value: '__base__', label: 'Base / Todas las disciplinas' },
  { value: 'padbol', label: 'Padbol' },
  { value: 'padel', label: 'Pádel' },
  { value: 'tenis', label: 'Tenis' },
  { value: 'futbol', label: 'Fútbol' },
  { value: 'basquet', label: 'Básquet' },
  { value: 'voley', label: 'Vóley' },
];

export function resolveSedeDuracionesApiBase(apiBaseUrl) {
  return String(apiBaseUrl || DEFAULT_API_BASE).replace(/\/$/, '');
}

/** null = precio base (todas las disciplinas). */
export function deporteQueryParam(deporte) {
  if (deporte == null || deporte === '' || deporte === '__base__') return null;
  return String(deporte).trim().toLowerCase();
}

export function deporteLabelMiSedePrecios(deporte) {
  if (deporte == null || deporte === '') return 'Base';
  const hit = MI_SEDE_PRECIOS_DEPORTE_OPTIONS.find(
    (o) => o.value !== '__base__' && String(o.value).toLowerCase() === String(deporte).toLowerCase(),
  );
  return hit?.label || String(deporte);
}

export function sameDeporteDuracion(a, b) {
  const na = deporteQueryParam(a);
  const nb = deporteQueryParam(b);
  return na === nb;
}

export function filterDuracionesPorDeporte(rows, deporteSel) {
  const list = Array.isArray(rows) ? rows : [];
  const dep = deporteQueryParam(deporteSel);
  if (dep) {
    return list.filter((r) => r?.deporte != null && String(r.deporte).toLowerCase() === dep);
  }
  return list.filter((r) => r?.deporte == null || r?.deporte === '');
}

export function sortDuracionesRows(rows) {
  return [...(Array.isArray(rows) ? rows : [])].sort((a, b) => {
    const da = Number(a?.duracion_minutos) || 0;
    const db = Number(b?.duracion_minutos) || 0;
    if (da === 60 && db !== 60) return -1;
    if (db === 60 && da !== 60) return 1;
    return da - db;
  });
}

export function countDuracionesActivas(rows) {
  return (Array.isArray(rows) ? rows : []).filter((r) => !!r?.activo).length;
}

export function tieneDuracionDuplicada(rows, duracionMinutos, deporteSel) {
  const dm = Number(duracionMinutos);
  if (!Number.isFinite(dm)) return false;
  return filterDuracionesPorDeporte(rows, deporteSel).some((r) => Number(r?.duracion_minutos) === dm);
}

function buildDuracionesUrl(base, sedeId, pathSuffix = '', deporte) {
  const sid = Number(sedeId);
  const url = new URL(`${base}/api/sedes/${encodeURIComponent(String(sid))}/duraciones${pathSuffix}`);
  const dep = deporteQueryParam(deporte);
  if (dep) url.searchParams.set('deporte', dep);
  return url.toString();
}

/** GET /api/sedes/:id/duraciones */
export async function fetchSedeDuraciones(sedeId, token, opts = {}) {
  const { apiBaseUrl, deporte, signal } = opts;
  const base = resolveSedeDuracionesApiBase(apiBaseUrl);
  const sid = Number(sedeId);
  if (!Number.isFinite(sid) || sid <= 0) return { duraciones: [] };

  const res = await fetch(buildDuracionesUrl(base, sid, '', deporte), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'No se pudieron cargar las duraciones');

  const raw = Array.isArray(data.duraciones) ? data.duraciones : [];
  const duraciones = sortDuracionesRows(filterDuracionesPorDeporte(raw, deporte));
  return { duraciones, raw };
}

/** GET /api/sedes/:id/duraciones-disponibles (público) */
export async function fetchSedeDuracionesDisponibles(sedeId, opts = {}) {
  const { apiBaseUrl, deporte, signal } = opts;
  const base = resolveSedeDuracionesApiBase(apiBaseUrl);
  const sid = Number(sedeId);
  if (!Number.isFinite(sid) || sid <= 0) return { duraciones: [], grupos: [] };

  const url = new URL(`${base}/api/sedes/${encodeURIComponent(String(sid))}/duraciones-disponibles`);
  const dep = deporteQueryParam(deporte);
  if (dep) url.searchParams.set('deporte', dep);

  const res = await fetch(url.toString(), { signal });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'No se pudieron cargar las duraciones disponibles');

  if (Array.isArray(data.duraciones)) {
    return { duraciones: data.duraciones, grupos: data.grupos || [], sede_id: data.sede_id };
  }
  if (Array.isArray(data.grupos)) {
    const flat = data.grupos.flatMap((g) =>
      (Array.isArray(g.items) ? g.items : []).map((item) => ({
        ...item,
        deporte: item.deporte ?? g.deporte ?? null,
      })),
    );
    return { duraciones: flat, grupos: data.grupos, sede_id: data.sede_id };
  }
  return { duraciones: [], grupos: [], sede_id: data.sede_id };
}

/** POST /api/sedes/:id/duraciones */
export async function createSedeDuracion(sedeId, token, payload, opts = {}) {
  const { apiBaseUrl } = opts;
  const base = resolveSedeDuracionesApiBase(apiBaseUrl);
  const sid = Number(sedeId);
  if (!Number.isFinite(sid) || sid <= 0) throw new Error('sede_id inválido');

  const body = { ...(payload || {}) };
  if (Object.prototype.hasOwnProperty.call(body, 'deporte')) {
    body.deporte = deporteQueryParam(body.deporte);
  }

  const res = await fetch(`${base}/api/sedes/${encodeURIComponent(String(sid))}/duraciones`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'No se pudo crear la duración');
  return data;
}

/** PATCH /api/sedes/:id/duraciones/:rowId */
export async function updateSedeDuracion(sedeId, rowId, token, payload, opts = {}) {
  const { apiBaseUrl } = opts;
  const base = resolveSedeDuracionesApiBase(apiBaseUrl);
  const sid = Number(sedeId);
  const rid = Number(rowId);
  if (!Number.isFinite(sid) || sid <= 0 || !Number.isFinite(rid) || rid <= 0) {
    throw new Error('Parámetros inválidos');
  }

  const res = await fetch(
    `${base}/api/sedes/${encodeURIComponent(String(sid))}/duraciones/${encodeURIComponent(String(rid))}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload || {}),
    },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'No se pudo actualizar la duración');
  return data;
}

/** DELETE /api/sedes/:id/duraciones/:rowId */
export async function deleteSedeDuracion(sedeId, rowId, token, opts = {}) {
  const { apiBaseUrl } = opts;
  const base = resolveSedeDuracionesApiBase(apiBaseUrl);
  const sid = Number(sedeId);
  const rid = Number(rowId);
  if (!Number.isFinite(sid) || sid <= 0 || !Number.isFinite(rid) || rid <= 0) {
    throw new Error('Parámetros inválidos');
  }

  const res = await fetch(
    `${base}/api/sedes/${encodeURIComponent(String(sid))}/duraciones/${encodeURIComponent(String(rid))}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'No se pudo eliminar la duración');
  return data;
}
