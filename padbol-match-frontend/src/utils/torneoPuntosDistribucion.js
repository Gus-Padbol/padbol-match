export function torneoCantidadPosicionesDistribucion(torneoLike) {
  const cantidad = parseInt(String(torneoLike?.cantidad_equipos ?? ''), 10);
  if (Number.isFinite(cantidad) && cantidad > 0) return Math.max(4, cantidad);

  const cupos = parseInt(String(torneoLike?.cupos_maximos ?? ''), 10);
  if (Number.isFinite(cupos) && cupos > 0) return Math.max(4, cupos);

  return 4;
}

/** Per-place recognition is a percentage of the actual level base, not a pool. */
export function calcularDistribucionPuntosTorneo(basePointsRaw, torneoLike = {}, policy = null) {
  const base = Number(basePointsRaw);
  if (!Number.isFinite(base) || base < 0 || !policy?.posiciones) return [];
  return Array.from({length:torneoCantidadPosicionesDistribucion(torneoLike)}, (_,index) => {
    const position=index+1;
    const porcentaje=policy.posiciones[position] ?? (position >= (policy.fallback_from_position ?? 11) ? (policy.fallback_percentage ?? policy.posiciones[10]) : null);
    return {posicion:`${position}°`,porcentaje,puntos:Number.isFinite(porcentaje)?Math.round(base*porcentaje/100):null};
  });
}

export function formatPorcentajeDistribucion(porcentaje) {
  const n = Number(porcentaje);
  if (!Number.isFinite(n)) return '0%';
  return `${Number.isInteger(n) ? n : n.toFixed(2).replace(/\.?0+$/, '')}%`;
}
