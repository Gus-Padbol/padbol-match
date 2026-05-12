/**
 * Respuesta de GET /api/jugador/:alias/estadisticas con agregados por deporte.
 */

export function torneosJugadosTotalDesdeEstadisticas(stats) {
  if (!stats || typeof stats !== 'object') return 0;
  const t = stats.torneos_jugados_total;
  if (t != null && Number.isFinite(Number(t))) return Number(t);
  return Number(stats.torneos_jugados) || 0;
}

/**
 * Métricas de torneos/partidos/ranking para la pestaña seleccionada (o agregado legacy).
 * @returns {object|null} null si no hay torneos finalizados jugados.
 */
export function sliceEstadisticasJugadorTorneo(stats, deporteSeleccionado) {
  if (!stats || typeof stats !== 'object') return null;
  const total = torneosJugadosTotalDesdeEstadisticas(stats);
  if (total <= 0) return null;
  const por = stats.estadisticas_por_deporte;
  const deps = stats.deportes_jugados;
  if (por && typeof por === 'object' && Array.isArray(deps) && deps.length > 0) {
    const fallback = deps[0]?.deporte;
    const key = String(deporteSeleccionado || fallback || '').trim();
    if (key && por[key]) return por[key];
  }
  return stats;
}
