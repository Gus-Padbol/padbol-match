import { supabase } from '../supabaseClient';
import { DEPORTES_CANCHA_SEDE_KEYS } from '../constants/deportesCanchaSede';
import { getPublicApiBaseUrl } from './apiPublicBaseUrl';

const ALLOWED = new Set(DEPORTES_CANCHA_SEDE_KEYS);

/**
 * Slug canónico para query `?deporte=` o null si no aplica (solo sponsors globales en API).
 * @param {unknown} raw
 * @returns {string|null}
 */
export function normalizeSponsorDeporteQueryParam(raw) {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim().toLowerCase();
  if (!s || !ALLOWED.has(s)) return null;
  return s;
}

/**
 * @param {unknown} row
 * @param {string|null} deporteNorm resultado de {@link normalizeSponsorDeporteQueryParam}
 */
export function sponsorRowMatchesDeporteFilter(row, deporteNorm) {
  const arr = row?.deportes;
  const isGlobal = arr == null || (Array.isArray(arr) && arr.length === 0);
  if (deporteNorm == null || deporteNorm === '') {
    return isGlobal;
  }
  if (isGlobal) return true;
  if (!Array.isArray(arr)) return false;
  const needle = String(deporteNorm).trim().toLowerCase();
  return arr.some((x) => String(x || '').trim().toLowerCase() === needle);
}

/**
 * Lista pública de sponsors (activo, aprobado, vigente) vía GET /api/sponsors o fallback Supabase.
 * @param {{ deporte?: string|null }} [opts]
 * @returns {Promise<unknown[]>}
 */
export async function fetchPublicSponsorsList(opts = {}) {
  const deporteNorm = normalizeSponsorDeporteQueryParam(opts.deporte);
  const base = getPublicApiBaseUrl();
  if (base) {
    const qs = deporteNorm ? `?deporte=${encodeURIComponent(deporteNorm)}` : '';
    const res = await fetch(`${base}/api/sponsors${qs}`);
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(t || `HTTP ${res.status}`);
    }
    const body = await res.json().catch(() => ({}));
    if (Array.isArray(body?.sponsors)) return body.sponsors;
    if (Array.isArray(body)) return body;
    return [];
  }

  const { data, error } = await supabase.from('sponsors').select('*').eq('activo', true).eq('aprobado', true);
  if (error) throw error;
  const rows = Array.isArray(data) ? data : [];
  return rows.filter((r) => sponsorRowMatchesDeporteFilter(r, deporteNorm));
}
