import { torneoFechaInicioEsPasadaCalendario } from './torneoFechaInicioArt';

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
  let s = String(filtro ?? '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();
  try {
    s = s.normalize('NFKC');
  } catch {
    /* ignore */
  }
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export const FILTRO_ESTADO_TORNEO_PILL_IDS = [
  'todos',
  'inscripcion_abierta',
  'proximo',
  'en_curso',
  'finalizado',
  'cancelado',
];

/** @param {(key: string, opts?: object) => string} t */
export function getFiltrosEstadoTorneoPills(t) {
  return FILTRO_ESTADO_TORNEO_PILL_IDS.map((id) => ({
    id,
    label: t(`torneos.filtroEstado.${id}`),
  }));
}

/** @deprecated Usar `getFiltrosEstadoTorneoPills(t)` — etiquetas en i18n. */
export const FILTROS_ESTADO_TORNEO_PILLS = FILTRO_ESTADO_TORNEO_PILL_IDS.map((id) => ({
  id,
  label: id,
}));

/** Id normalizado de la primera pill = «sin filtrar por estado» (convención: siempre la de «Todos»). */
const TORNEO_FILTRO_PILL_ID_TODOS = normalizeTorneoFiltroEstadoPill(FILTRO_ESTADO_TORNEO_PILL_IDS[0] ?? 'todos');

/** Ids de pills que filtran por un estado de torneo concreto (todas menos la primera). */
const TORNEO_FILTRO_ESTADO_IDS_CON_ESTADO = new Set(
  FILTRO_ESTADO_TORNEO_PILL_IDS.slice(1).map((id) => normalizeTorneoFiltroEstadoPill(id)).filter(Boolean)
);

/**
 * true = no aplicar filtro por estado (pill «Todos», vacío, alias o valor no reconocido).
 * Nunca se compara esto con `torneo.estado` de la BD (allí no existe «Todos»).
 */
export function esFiltroTorneoEstadoTodos(filtroRaw) {
  const f = normalizeTorneoFiltroEstadoPill(filtroRaw);
  if (!f) return true;
  if (f === 'todas' || f === 'all') return true;
  if (f === TORNEO_FILTRO_PILL_ID_TODOS) return true;
  return !TORNEO_FILTRO_ESTADO_IDS_CON_ESTADO.has(f);
}

/**
 * @param {{ estado?: string } | null} t
 * @param {'todos'|'inscripcion_abierta'|'proximo'|'en_curso'|'finalizado'|'cancelado'} filtro
 */
export function torneoPasaFiltroEstadoVista(t, filtro) {
  if (esFiltroTorneoEstadoTodos(filtro)) return true;
  const f = normalizeTorneoFiltroEstadoPill(filtro);
  const pasadoCal = torneoFechaInicioEsPasadaCalendario(t?.fecha_inicio);
  if (f === 'finalizado') return esEstadoFinalizadoTorneo(t?.estado) || pasadoCal;
  if (f === 'en_curso') return esEstadoEnCursoTorneo(t?.estado) && !pasadoCal;
  if (f === 'inscripcion_abierta') return esInscripcionAbiertaTorneo(t?.estado) && !pasadoCal;
  if (f === 'proximo') return esProximoTorneo(t?.estado) && !pasadoCal;
  if (f === 'cancelado') return esEstadoCanceladoTorneo(t?.estado);
  return true;
}
