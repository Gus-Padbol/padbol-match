/**
 * Cliente Admin — GET /api/admin/torneos/resumen-stats (batch de badges del tab Torneos).
 * Sustituye el N+1 de /equipos + /partidos en el listado.
 */

export const TORNEOS_RESUMEN_STATS_MAX_IDS = 200;

/** Roles autorizados por Backend para el endpoint batch. */
export function canRoleFetchTorneosResumenStats(rol) {
  const r = String(rol || '')
    .trim()
    .toLowerCase();
  return r === 'super_admin' || r === 'admin_club';
}

function resolveApiBase(apiBaseUrl) {
  return String(apiBaseUrl || '').replace(/\/$/, '');
}

function toSafeInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.trunc(n);
}

function toSafeBool(value) {
  return value === true;
}

function toSafeWinnerId(value) {
  if (value == null || value === '') return null;
  const s = String(value).trim();
  return s || null;
}

function toSafeWinnerNombre(value) {
  if (value == null) return null;
  const s = String(value).trim();
  return s || null;
}

/**
 * Extrae ids válidos (enteros positivos), deduplicados, máx. 200.
 * Ids inválidos se excluyen (no se envían al Backend).
 */
export function collectValidTorneoIds(torneos, { max = TORNEOS_RESUMEN_STATS_MAX_IDS } = {}) {
  const limit = Math.max(0, Math.min(Number(max) || TORNEOS_RESUMEN_STATS_MAX_IDS, TORNEOS_RESUMEN_STATS_MAX_IDS));
  const seen = new Set();
  const ids = [];
  for (const t of Array.isArray(torneos) ? torneos : []) {
    const raw = t?.id != null ? t.id : t;
    const s = String(raw ?? '').trim();
    if (!/^\d+$/.test(s)) continue;
    const n = Number.parseInt(s, 10);
    if (!Number.isFinite(n) || n <= 0) continue;
    if (seen.has(n)) continue;
    seen.add(n);
    ids.push(n);
    if (ids.length >= limit) break;
  }
  return ids;
}

export function buildTorneosResumenStatsFlightKey({ torneoIds, sedeId = null, estado = null } = {}) {
  const ids = (Array.isArray(torneoIds) ? torneoIds : []).map((n) => String(n)).join(',');
  const sede = sedeId != null && sedeId !== '' ? String(sedeId) : '';
  const est = estado != null && String(estado).trim() !== '' ? String(estado).trim().toLowerCase() : '';
  return `${ids}|${sede}|${est}`;
}

/** Normaliza un item del Backend al shape canónico (+ aliases UI legacy). */
export function normalizeTorneoResumenStatsItem(raw) {
  const torneoId = String(raw?.torneo_id ?? '').trim();
  if (!torneoId) return null;

  const winner_equipo_id = toSafeWinnerId(raw?.winner_equipo_id);
  let winner_nombre = toSafeWinnerNombre(raw?.winner_nombre);
  if (!winner_equipo_id) winner_nombre = null;

  const equipos_count = toSafeInt(raw?.equipos_count);
  const equipos_confirmados = toSafeInt(raw?.equipos_confirmados);
  const equipos_pendientes = toSafeInt(raw?.equipos_pendientes);
  const partidos_total = toSafeInt(raw?.partidos_total);
  const partidos_jugados = toSafeInt(raw?.partidos_jugados);
  const partidos_pendientes = toSafeInt(raw?.partidos_pendientes);
  const tiene_grupos = toSafeBool(raw?.tiene_grupos);
  const sorteo_realizado = toSafeBool(raw?.sorteo_realizado);

  return {
    torneo_id: torneoId,
    equipos_count,
    equipos_confirmados,
    equipos_pendientes,
    partidos_total,
    partidos_jugados,
    partidos_pendientes,
    tiene_grupos,
    sorteo_realizado,
    winner_equipo_id,
    winner_nombre,
    // Aliases para UI existente del AdminDashboard (sin rediseñar badges).
    total_partidos: partidos_total,
    equipos_confirmados_sorteo: equipos_confirmados,
    winner: winner_nombre ? { id: winner_equipo_id, nombre: winner_nombre } : null,
  };
}

/**
 * Transforma la respuesta HTTP en mapa estable keyed por torneo_id (string).
 * Items duplicados → gana el último válido (determinístico).
 */
export function normalizeTorneosResumenStatsResponse(payload) {
  if (payload == null || typeof payload !== 'object') {
    const err = new Error('Respuesta de resumen de torneos inválida');
    err.code = 'INVALID_RESUMEN_STATS';
    throw err;
  }
  const items = Array.isArray(payload?.data?.items)
    ? payload.data.items
    : Array.isArray(payload?.items)
      ? payload.items
      : null;
  if (!Array.isArray(items)) {
    const err = new Error('Respuesta de resumen de torneos inválida');
    err.code = 'INVALID_RESUMEN_STATS';
    throw err;
  }

  const map = {};
  for (const raw of items) {
    const item = normalizeTorneoResumenStatsItem(raw);
    if (!item) continue;
    map[item.torneo_id] = item;
  }
  return map;
}

export function getTorneoResumenStat(map, torneoId) {
  if (!map || torneoId == null) return null;
  return map[String(torneoId)] || null;
}

export function parseTorneosResumenStatsError(status, json) {
  const msg = json?.error || json?.message || null;
  if (status === 401) return msg || 'Sesión expirada. Volvé a iniciar sesión.';
  if (status === 403) return msg || 'No tenés permiso para ver el resumen de torneos.';
  if (status === 400) return msg || 'No se pudo solicitar el resumen de torneos.';
  if (status === 503) return msg || 'Resumen de torneos no disponible.';
  return msg || 'No se pudo cargar el resumen de torneos.';
}

/** Single-flight in-memory (sin librería). */
const inflightByKey = new Map();

/** Solo tests. */
export function __clearTorneosResumenStatsInflight() {
  inflightByKey.clear();
}

export function __getTorneosResumenStatsInflightSize() {
  return inflightByKey.size;
}

/**
 * GET /api/admin/torneos/resumen-stats
 * @returns {Promise<Record<string, object>>} mapa normalizado
 */
export async function fetchAdminTorneosResumenStats({
  apiBaseUrl,
  accessToken,
  torneoIds,
  sedeId = null,
  estado = null,
  limit = null,
  signal,
} = {}) {
  if (!accessToken) {
    const err = new Error(parseTorneosResumenStatsError(401, {}));
    err.status = 401;
    throw err;
  }

  const ids = collectValidTorneoIds(
    (Array.isArray(torneoIds) ? torneoIds : []).map((id) => ({ id })),
  );
  if (ids.length === 0) {
    return {};
  }

  const flightKey = buildTorneosResumenStatsFlightKey({ torneoIds: ids, sedeId, estado });
  if (inflightByKey.has(flightKey)) {
    return inflightByKey.get(flightKey);
  }

  const run = (async () => {
    const q = new URLSearchParams();
    q.set('torneo_ids', ids.join(','));
    if (sedeId != null && sedeId !== '') q.set('sede_id', String(sedeId));
    if (estado != null && String(estado).trim() !== '') {
      q.set('estado', String(estado).trim().toLowerCase());
    }
    if (limit != null && Number.isFinite(Number(limit)) && Number(limit) > 0) {
      q.set('limit', String(Math.min(Number(limit), TORNEOS_RESUMEN_STATS_MAX_IDS)));
    }

    const res = await fetch(
      `${resolveApiBase(apiBaseUrl)}/api/admin/torneos/resumen-stats?${q.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
        signal,
      },
    );
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(parseTorneosResumenStatsError(res.status, json));
      err.status = res.status;
      err.code = json?.code;
      throw err;
    }
    return normalizeTorneosResumenStatsResponse(json);
  })();

  inflightByKey.set(flightKey, run);
  try {
    return await run;
  } finally {
    if (inflightByKey.get(flightKey) === run) {
      inflightByKey.delete(flightKey);
    }
  }
}
