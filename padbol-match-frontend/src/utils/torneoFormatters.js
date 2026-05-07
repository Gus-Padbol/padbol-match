/**
 * Etiquetas amigables para `tipo_torneo` y `nivel_torneo` guardados en Supabase.
 */

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

/** `torneos.genero_competencia`: masculino | femenino | mixto */
export function formatGeneroCompetenciaTorneo(raw) {
  const v = String(raw || '').trim().toLowerCase();
  if (!v) return '—';
  if (v === 'masculino') return 'Masculino';
  if (v === 'femenino') return 'Femenino';
  if (v === 'mixto') return 'Mixto';
  return capitalizeFirstAfterUnderscores(raw);
}

/** `torneos.categoria_edad`: sub_18 | open | master_40 | master_50 */
export function formatCategoriaEdadTorneo(raw) {
  const v = String(raw || '').trim().toLowerCase();
  if (!v) return '—';
  if (v === 'sub_18') return 'Sub 18';
  if (v === 'open') return 'Open';
  if (v === 'master_40') return 'Máster +40';
  if (v === 'master_50') return 'Máster +50';
  return capitalizeFirstAfterUnderscores(raw);
}
