import { getApiBaseUrl } from './apiPublicBaseUrl';

export const NATIONS_COUNTRY_RANKING_PATH = '/api/nations/country-ranking';

function invalidPayload() {
  return new Error('Country ranking payload invalid');
}

function normalizeRow(row) {
  if (!row || typeof row !== 'object') throw invalidPayload();
  if (typeof row.pais !== 'string' || !/^[A-Z]{2}$/.test(row.pais)) throw invalidPayload();
  if (!Number.isSafeInteger(row.puntos_total) || row.puntos_total < 0) throw invalidPayload();
  if (!Number.isSafeInteger(row.torneos_count) || row.torneos_count < 0) throw invalidPayload();
  if (!Number.isSafeInteger(row.torneos_pendientes) || row.torneos_pendientes < 0) throw invalidPayload();
  const posicion = row.posicion == null ? null : row.posicion;
  if (posicion != null && (!Number.isSafeInteger(posicion) || posicion < 1)) throw invalidPayload();
  return {
    pais: row.pais,
    puntos_total: row.puntos_total,
    torneos_count: row.torneos_count,
    torneos_pendientes: row.torneos_pendientes,
    posicion,
    pendiente: row.pendiente === true,
    torneos: Array.isArray(row.torneos) ? row.torneos : [],
  };
}

/**
 * Reads the public accumulated country ranking. The individual `/api/rankings`
 * contract is never reused so historical FIPA rows stay untouched.
 */
export async function fetchNationsCountryRanking({ baseUrl = getApiBaseUrl(), fetchImpl } = {}) {
  const doFetch = fetchImpl ?? (typeof fetch === 'function' ? fetch : null);
  if (!doFetch) throw new Error('Country ranking unavailable');
  const response = await doFetch(`${baseUrl}${NATIONS_COUNTRY_RANKING_PATH}`, {
    headers: { Accept: 'application/json' },
  });
  if (!response?.ok) throw new Error(`Country ranking ${response?.status ?? 'network'}`);
  const payload = await response.json();
  if (!payload || payload.ok !== true || !Array.isArray(payload.items)) throw invalidPayload();
  return payload.items.map(normalizeRow);
}
