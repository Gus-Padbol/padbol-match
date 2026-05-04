/**
 * Filtro por estado de torneo (pills en TorneosPublicos y AdminDashboard).
 * Alineado con estados en BD / API.
 */

/** Estado normalizado para filtros. */
export function estadoTorneoNormalizado(estadoRaw) {
  return String(estadoRaw || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function esInscripcionAbiertaTorneo(estadoRaw) {
  const e = estadoTorneoNormalizado(estadoRaw);
  return e === 'abierto' || e === 'inscripcion_abierta';
}

export function esProximoTorneo(estadoRaw) {
  const e = estadoTorneoNormalizado(estadoRaw);
  return e === 'planificacion' || e === 'proximo';
}

export function esEstadoEnCursoTorneo(estadoRaw) {
  const e = estadoTorneoNormalizado(estadoRaw);
  return e === 'en_curso' || e === 'activo';
}

export function esEstadoFinalizadoTorneo(estadoRaw) {
  return estadoTorneoNormalizado(estadoRaw) === 'finalizado';
}

/**
 * @param {{ estado?: string } | null} t
 * @param {'todos'|'inscripcion_abierta'|'proximo'|'en_curso'|'finalizado'} filtro
 */
export function torneoPasaFiltroEstadoVista(t, filtro) {
  if (filtro === 'todos') return true;
  if (filtro === 'finalizado') return esEstadoFinalizadoTorneo(t?.estado);
  if (filtro === 'en_curso') return esEstadoEnCursoTorneo(t?.estado);
  if (filtro === 'inscripcion_abierta') return esInscripcionAbiertaTorneo(t?.estado);
  if (filtro === 'proximo') return esProximoTorneo(t?.estado);
  return true;
}

export const FILTROS_ESTADO_TORNEO_PILLS = [
  { id: 'todos', label: 'Todos' },
  { id: 'inscripcion_abierta', label: 'Inscripción abierta' },
  { id: 'proximo', label: 'Próximo' },
  { id: 'en_curso', label: 'En curso' },
  { id: 'finalizado', label: 'Finalizado' },
];
