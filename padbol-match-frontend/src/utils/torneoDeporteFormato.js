/** Valores persistidos en `torneos.deporte` / `torneos.formato_equipo`. */
export const TORNEO_DEPORTE_PADBOL = 'padbol';
export const TORNEO_DEPORTE_PADEL = 'padel';
export const TORNEO_DEPORTE_PICKLEBALL = 'pickleball';

export const TORNEO_FORMATO_SINGLES = 'singles';
export const TORNEO_FORMATO_DOBLES = 'dobles';

export function normalizeTorneoDeporte(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'pádel' || s === 'padel') return TORNEO_DEPORTE_PADEL;
  if (s === 'pickleball') return TORNEO_DEPORTE_PICKLEBALL;
  return TORNEO_DEPORTE_PADBOL;
}

/** Formato de partido por equipo: singles = 1 jugador, dobles = 2+. */
export function resolveFormatoEquipoTorneo(torneo) {
  if (!torneo || typeof torneo !== 'object') return TORNEO_FORMATO_DOBLES;
  const f = String(torneo.formato_equipo || '').trim().toLowerCase();
  if (f === TORNEO_FORMATO_SINGLES || f === '1v1') return TORNEO_FORMATO_SINGLES;
  if (f === TORNEO_FORMATO_DOBLES || f === '2v2') return TORNEO_FORMATO_DOBLES;
  const d = normalizeTorneoDeporte(torneo.deporte);
  if (d === TORNEO_DEPORTE_PICKLEBALL) return TORNEO_FORMATO_DOBLES;
  return TORNEO_FORMATO_DOBLES;
}

export function esTorneoSingles(torneo) {
  return resolveFormatoEquipoTorneo(torneo) === TORNEO_FORMATO_SINGLES;
}

/** Mínimo de jugadores registrados para considerar el equipo “completo” según el torneo. */
export function jugadoresMinimosEquipoTorneo(torneo) {
  return esTorneoSingles(torneo) ? 1 : 2;
}

export function etiquetaDeporteTorneo(deporte) {
  switch (normalizeTorneoDeporte(deporte)) {
    case TORNEO_DEPORTE_PADEL:
      return 'Pádel';
    case TORNEO_DEPORTE_PICKLEBALL:
      return 'Pickleball';
    default:
      return 'Padbol';
  }
}

export function etiquetaFormatoEquipoTorneo(formato) {
  return resolveFormatoEquipoTorneo({ formato_equipo: formato }) === TORNEO_FORMATO_SINGLES
    ? 'Singles (1v1)'
    : 'Dobles (2v2)';
}

/** Una línea para cards / cabecera pública. */
export function resumenDeporteFormatoTorneo(torneo) {
  const d = etiquetaDeporteTorneo(torneo?.deporte);
  const f = resolveFormatoEquipoTorneo(torneo);
  const fLabel = f === TORNEO_FORMATO_SINGLES ? 'Singles (1v1)' : 'Dobles (2v2)';
  return `${d} · ${fLabel}`;
}

export const TORNEO_DEPORTE_OPTIONS = [
  { value: TORNEO_DEPORTE_PADBOL, label: 'Padbol' },
  { value: TORNEO_DEPORTE_PADEL, label: 'Pádel' },
  { value: TORNEO_DEPORTE_PICKLEBALL, label: 'Pickleball' },
];

export const TORNEO_FORMATO_PICKLE_OPTIONS = [
  { value: TORNEO_FORMATO_SINGLES, label: 'Singles (1v1)' },
  { value: TORNEO_FORMATO_DOBLES, label: 'Dobles (2v2)' },
];
