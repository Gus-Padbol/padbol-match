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
