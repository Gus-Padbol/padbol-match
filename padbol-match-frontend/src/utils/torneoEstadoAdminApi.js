/**
 * Estados de torneo en formularios admin (valores de <select>).
 * Valores canónicos en BD / API: ver {@link mapEstadoTorneoFormParaApi}.
 */
export function mapEstadoTorneoDesdeApiParaForm(raw) {
  const e = String(raw || '').toLowerCase().trim();
  if (e === 'planificacion' || e === 'proximo') return 'proximo';
  if (e === 'abierto' || e === 'inscripcion_abierta') return 'abierto';
  if (e === 'en_curso' || e === 'activo') return 'en_curso';
  if (e === 'finalizado') return 'finalizado';
  if (e === 'cancelado') return 'cancelado';
  return 'proximo';
}

/** Convierte el valor del formulario al estado guardado en `torneos` (Supabase). */
export function mapEstadoTorneoFormParaApi(raw) {
  const e = String(raw || '').toLowerCase().trim();
  if (e === 'proximo') return 'planificacion';
  if (e === 'abierto') return 'abierto';
  if (e === 'en_curso') return 'en_curso';
  if (e === 'finalizado') return 'finalizado';
  if (e === 'cancelado') return 'cancelado';
  return 'planificacion';
}
