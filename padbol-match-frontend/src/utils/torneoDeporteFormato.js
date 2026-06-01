/** Valores persistidos en `torneos.deporte` / `torneos.formato_equipo`. */
export const TORNEO_DEPORTE_PADBOL = 'padbol';
export const TORNEO_DEPORTE_PADEL = 'padel';
export const TORNEO_DEPORTE_PICKLEBALL = 'pickleball';
export const TORNEO_DEPORTE_TENIS = 'tenis';
export const TORNEO_DEPORTE_FUTBOL5 = 'futbol_5';
export const TORNEO_DEPORTE_FUTBOL7 = 'futbol_7';

export const TORNEO_FORMATO_SINGLES = 'singles';
export const TORNEO_FORMATO_DOBLES = 'dobles';
/** Fútbol: jugadores por equipo en cancha (persistido en `formato_equipo`). */
export const TORNEO_FORMATO_EQUIPO_5 = 'equipo_5';
export const TORNEO_FORMATO_EQUIPO_7 = 'equipo_7';

const DEPORTE_ORDER = [
  TORNEO_DEPORTE_PADBOL,
  TORNEO_DEPORTE_PADEL,
  TORNEO_DEPORTE_PICKLEBALL,
  TORNEO_DEPORTE_TENIS,
  TORNEO_DEPORTE_FUTBOL5,
  TORNEO_DEPORTE_FUTBOL7,
];

export function normalizeTorneoDeporte(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'pádel' || s === 'padel') return TORNEO_DEPORTE_PADEL;
  if (s === 'pickleball') return TORNEO_DEPORTE_PICKLEBALL;
  if (s === 'tenis' || s === 'tennis') return TORNEO_DEPORTE_TENIS;
  if (s === 'futbol_5' || s === 'futbol5') return TORNEO_DEPORTE_FUTBOL5;
  if (s === 'futbol_7' || s === 'futbol7') return TORNEO_DEPORTE_FUTBOL7;
  if (DEPORTE_ORDER.includes(s)) return s;
  return TORNEO_DEPORTE_PADBOL;
}

/** Pickleball y tenis: singles o dobles. */
export function torneoDeportePermiteSinglesDobles(deporte) {
  const d = normalizeTorneoDeporte(deporte);
  return d === TORNEO_DEPORTE_PICKLEBALL || d === TORNEO_DEPORTE_TENIS;
}

export function formatoEquipoDefaultParaDeporte(deporte) {
  const d = normalizeTorneoDeporte(deporte);
  if (d === TORNEO_DEPORTE_FUTBOL5) return TORNEO_FORMATO_EQUIPO_5;
  if (d === TORNEO_DEPORTE_FUTBOL7) return TORNEO_FORMATO_EQUIPO_7;
  return TORNEO_FORMATO_DOBLES;
}

/** Body API crear/editar torneo: `formato_equipo` coherente con `deporte`. */
export function formatoEquipoPayloadParaApi(deporte, formatoSeleccionado) {
  const d = normalizeTorneoDeporte(deporte);
  if (torneoDeportePermiteSinglesDobles(d)) {
    const f = String(formatoSeleccionado || '').trim().toLowerCase();
    if (f === TORNEO_FORMATO_SINGLES || f === '1v1') return TORNEO_FORMATO_SINGLES;
    return TORNEO_FORMATO_DOBLES;
  }
  if (d === TORNEO_DEPORTE_FUTBOL5) return TORNEO_FORMATO_EQUIPO_5;
  if (d === TORNEO_DEPORTE_FUTBOL7) return TORNEO_FORMATO_EQUIPO_7;
  return TORNEO_FORMATO_DOBLES;
}

/** Formato de partido por equipo: singles | dobles | equipo_5 | equipo_7. */
export function resolveFormatoEquipoTorneo(torneo) {
  if (!torneo || typeof torneo !== 'object') return TORNEO_FORMATO_DOBLES;
  const f = String(torneo.formato_equipo || '').trim().toLowerCase();
  if (f === TORNEO_FORMATO_SINGLES || f === '1v1') return TORNEO_FORMATO_SINGLES;
  if (f === TORNEO_FORMATO_DOBLES || f === '2v2') return TORNEO_FORMATO_DOBLES;
  if (f === TORNEO_FORMATO_EQUIPO_5) return TORNEO_FORMATO_EQUIPO_5;
  if (f === TORNEO_FORMATO_EQUIPO_7) return TORNEO_FORMATO_EQUIPO_7;
  const d = normalizeTorneoDeporte(torneo.deporte);
  if (torneoDeportePermiteSinglesDobles(d)) return TORNEO_FORMATO_DOBLES;
  return TORNEO_FORMATO_DOBLES;
}

export function esTorneoSingles(torneo) {
  return resolveFormatoEquipoTorneo(torneo) === TORNEO_FORMATO_SINGLES;
}

/** Mínimo de jugadores registrados para considerar el equipo “completo” según el torneo. */
export function jugadoresMinimosEquipoTorneo(torneo) {
  const fmt = resolveFormatoEquipoTorneo(torneo);
  if (fmt === TORNEO_FORMATO_SINGLES) return 1;
  if (fmt === TORNEO_FORMATO_EQUIPO_5) return 5;
  if (fmt === TORNEO_FORMATO_EQUIPO_7) return 7;
  return 2;
}

export function etiquetaDeporteTorneo(deporte) {
  switch (normalizeTorneoDeporte(deporte)) {
    case TORNEO_DEPORTE_PADEL:
      return 'Pádel';
    case TORNEO_DEPORTE_PICKLEBALL:
      return 'Pickleball';
    case TORNEO_DEPORTE_TENIS:
      return 'Tenis';
    case TORNEO_DEPORTE_FUTBOL5:
      return 'Fútbol 5';
    case TORNEO_DEPORTE_FUTBOL7:
      return 'Fútbol 7';
    default:
      return 'Padbol';
  }
}

export function etiquetaFormatoEquipoResuelto(torneo) {
  const fmt = resolveFormatoEquipoTorneo(torneo);
  if (fmt === TORNEO_FORMATO_SINGLES) return 'Singles (1v1)';
  if (fmt === TORNEO_FORMATO_DOBLES) return 'Dobles (2v2)';
  if (fmt === TORNEO_FORMATO_EQUIPO_5) return 'Equipos de 5';
  if (fmt === TORNEO_FORMATO_EQUIPO_7) return 'Equipos de 7';
  return 'Dobles (2v2)';
}

export function etiquetaFormatoEquipoTorneo(formato) {
  return etiquetaFormatoEquipoResuelto({ formato_equipo: formato });
}

/** Una línea para cards / cabecera pública. */
export function resumenDeporteFormatoTorneo(torneo) {
  const d = etiquetaDeporteTorneo(torneo?.deporte);
  if (normalizeTorneoDeporte(torneo?.deporte) === TORNEO_DEPORTE_PADBOL) {
    return d;
  }
  const fLabel = etiquetaFormatoEquipoResuelto(torneo);
  return `${d} · ${fLabel}`;
}

export const TORNEO_DEPORTE_OPTIONS = [
  { value: TORNEO_DEPORTE_PADBOL, label: 'Padbol' },
  { value: TORNEO_DEPORTE_PADEL, label: 'Pádel' },
  { value: TORNEO_DEPORTE_PICKLEBALL, label: 'Pickleball' },
  { value: TORNEO_DEPORTE_TENIS, label: 'Tenis' },
  { value: TORNEO_DEPORTE_FUTBOL5, label: 'Fútbol 5' },
  { value: TORNEO_DEPORTE_FUTBOL7, label: 'Fútbol 7' },
];

export const TORNEO_FORMATO_SINGLES_DOBLES_OPTIONS = [
  { value: TORNEO_FORMATO_SINGLES, label: 'Singles (1v1)' },
  { value: TORNEO_FORMATO_DOBLES, label: 'Dobles (2v2)' },
];

/** @deprecated usar {@link TORNEO_FORMATO_SINGLES_DOBLES_OPTIONS} */
export const TORNEO_FORMATO_PICKLE_OPTIONS = TORNEO_FORMATO_SINGLES_DOBLES_OPTIONS;
