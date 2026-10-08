/**
 * Etiquetas amigables para `tipo_torneo` y `nivel_torneo` guardados en Supabase.
 */

import { TORNEO_CATEGORIAS_EDAD } from '../constants/torneoCategoriasEdad';

function capitalizeFirstAfterUnderscores(raw) {
  const s = String(raw || '').trim();
  if (!s) return '—';
  const spaced = s.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

/**
 * @param {string | null | undefined} tipo Valor de `torneos.tipo_torneo`
 * @returns {string}
 */
export function formatTipoTorneo(tipo) {
  const t = String(tipo || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  if (!t) return '—';
  if (t === 'round_robin') return 'Round Robin';
  if (t === 'grupos_knockout') return 'Grupos + Knockout';
  if (t === 'eliminacion' || t === 'knockout' || t === 'eliminatoria') return 'Eliminación directa';
  return capitalizeFirstAfterUnderscores(tipo);
}

/**
 * @param {string | null | undefined} nivel Valor de `torneos.nivel_torneo` (slug o id custom)
 * @returns {string}
 */
export function formatNivelTorneo(nivel) {
  const n = String(nivel || '').trim().toLowerCase();
  if (!n) return '—';
  if (n === 'club') return 'Club';
  if (n === 'nacional') return 'Nacional';
  if (n === 'internacional') return 'Internacional';
  if (n === 'fipa') return 'Internacional FIPA';
  if (n === 'club_no_oficial') return 'Club no oficial';
  if (n === 'club_oficial') return 'Club oficial';
  if (n === 'mundial') return 'Mundial';
  if (n === 'local') return 'Local';
  return capitalizeFirstAfterUnderscores(nivel);
}

/**
 * @param {string | null | undefined} c Valor de `torneos.categoria`
 * @returns {string}
 */
export function formatCategoriaTorneo(c) {
  const v = String(c || '').trim();
  if (!v) return 'Libre';
  if (v === 'Libre') return 'Libre (todas las categorías)';
  return v;
}

/** Lectura unificada: `tipo_competencia`, columna `tipo_torneo_genero` (alias en BD) o legacy `genero_competencia`. */
export function torneoTipoCompetenciaDb(t) {
  if (t && typeof t === 'object') {
    return String(t.tipo_competencia || t.tipo_torneo_genero || t.genero_competencia || '').trim();
  }
  return String(t || '').trim();
}

/** Competencia del torneo: masculino | femenino | mixto */
export function formatGeneroCompetenciaTorneo(raw) {
  const v = String(raw || '').trim().toLowerCase();
  if (!v) return '—';
  if (v === 'masculino') return 'Masculino';
  if (v === 'femenino') return 'Femenino';
  if (v === 'mixto') return 'Mixto';
  return capitalizeFirstAfterUnderscores(raw);
}

/**
 * `torneos.categoria_edad`:
 * u13 | u15 | u17 (Next Generation) | open | master_30 | master_40 | master_50 | sub_18 (legado)
 *
 * Etiquetas desde el registro canónico (`constants/torneoCategoriasEdad`), así los valores
 * nuevos no requieren tocar cada vista.
 */
export function formatCategoriaEdadTorneo(raw) {
  const v = String(raw || '').trim().toLowerCase();
  if (!v) return '—';
  const meta = TORNEO_CATEGORIAS_EDAD.find((c) => c.value === v);
  if (meta) return meta.labelEs;
  return capitalizeFirstAfterUnderscores(raw);
}
