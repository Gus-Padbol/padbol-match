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

export function esEstadoCanceladoTorneo(estadoRaw) {
  return estadoTorneoNormalizado(estadoRaw) === 'cancelado';
}

/** Valor del pill de filtro normalizado (trim, minúsculas, sin acentos en la clave). */
export function normalizeTorneoFiltroEstadoPill(filtro) {
  return String(filtro ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * @param {{ estado?: string } | null} t
 * @param {'todos'|'inscripcion_abierta'|'proximo'|'en_curso'|'finalizado'|'cancelado'} filtro
 */
export function torneoPasaFiltroEstadoVista(t, filtro) {
  const f = normalizeTorneoFiltroEstadoPill(filtro);
  if (f === 'todos' || f === 'todas' || f === '') return true;
  if (f === 'finalizado') return esEstadoFinalizadoTorneo(t?.estado);
  if (f === 'en_curso') return esEstadoEnCursoTorneo(t?.estado);
  if (f === 'inscripcion_abierta') return esInscripcionAbiertaTorneo(t?.estado);
  if (f === 'proximo') return esProximoTorneo(t?.estado);
  if (f === 'cancelado') return esEstadoCanceladoTorneo(t?.estado);
  return true;
}

export const FILTROS_ESTADO_TORNEO_PILLS = [
  { id: 'todos', label: 'Todos' },
  { id: 'inscripcion_abierta', label: 'Inscripción abierta' },
  { id: 'proximo', label: 'Próximo' },
  { id: 'en_curso', label: 'En curso' },
  { id: 'finalizado', label: 'Finalizado' },
  { id: 'cancelado', label: 'Cancelado' },
];
