/**
 * Orden de torneos en listados públicos (p. ej. TorneosPublicos al filtrar con `?sedeId=` desde SedePublica).
 * Estados: en_curso → abierto → planificacion → finalizado → cancelado;
 * `inscripcion_abierta` se trata como `abierto` para el bucket.
 * Dentro de cada estado, `fecha_inicio` descendente (más reciente arriba).
 */
function bucketOrdenTorneoPublico(estado) {
  const e = String(estado || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const normalized = e === 'inscripcion_abierta' ? 'abierto' : e;
  const map = {
    en_curso: 0,
    abierto: 1,
    planificacion: 2,
    finalizado: 3,
    cancelado: 4,
  };
  return map[normalized] ?? 50;
}

export function compareTorneosPublico(a, b) {
  const ba = bucketOrdenTorneoPublico(a.estado);
  const bb = bucketOrdenTorneoPublico(b.estado);
  if (ba !== bb) return ba - bb;
  const fa = String(a.fecha_inicio || '');
  const fb = String(b.fecha_inicio || '');
  return fb.localeCompare(fa);
}
