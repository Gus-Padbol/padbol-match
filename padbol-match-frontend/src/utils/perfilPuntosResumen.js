/**
 * Agrupa puntos de torneos finalizados según `torneos.nivel_torneo` (alcance del evento).
 * @param {Array<{ nivel_torneo?: string, puntos?: number }>} filas Ej. salida de {@link fetchTorneosConPuntosParaPerfil}
 * @returns {{ club: number, nacional: number, fipa: number }}
 */
export function sumarPuntosPorAlcanceDesdeFilasTorneo(filas) {
  const o = { club: 0, nacional: 0, fipa: 0 };
  for (const row of filas || []) {
    const b = bucketAlcanceTorneo(row?.nivel_torneo);
    if (!b) continue;
    o[b] += Number(row?.puntos) || 0;
  }
  return o;
}

/** @returns {'club'|'nacional'|'fipa'|null} */
export function bucketAlcanceTorneo(nivelRaw) {
  const n = String(nivelRaw || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_');
  if (!n) return null;
  if (n === 'local' || n === 'club' || n === 'club_no_oficial' || n === 'club_oficial') return 'club';
  if (n === 'nacional') return 'nacional';
  if (n === 'internacional' || n === 'fipa' || n === 'mundial') return 'fipa';
  return null;
}

export function contarTorneosUnicosConPuntos(filas) {
  return new Set((filas || []).map((r) => r?.torneo_id).filter((x) => x != null)).size;
}

export function tieneAlgunoPuntosPorAlcance(tot) {
  const t = tot || { club: 0, nacional: 0, fipa: 0 };
  return (Number(t.club) || 0) > 0 || (Number(t.nacional) || 0) > 0 || (Number(t.fipa) || 0) > 0;
}
