/** Session flag: admin_club (y similares) navegando en contexto panel / torneo desde admin. */
const KEY = 'padbol_admin_nav_context';

/** Claves legacy / torneo: limpiar junto con {@link clearAdminNavContext} al pasar a inscripción jugador. */
const ADMIN_TORNEO_SESSION_KEYS = [
  KEY,
  'padbol_admin_torneo_context',
  'padbol_from_admin',
];

export function setAdminNavContext(active) {
  try {
    if (active) sessionStorage.setItem(KEY, '1');
    else sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function readAdminNavContext() {
  try {
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/** Quita todas las banderas de admin en sessionStorage usadas por hub / torneo / inscripción. */
export function clearAdminNavContext() {
  try {
    for (const k of ADMIN_TORNEO_SESSION_KEYS) {
      sessionStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
}

/**
 * Contexto gestión equipos en `/torneo/:id/equipos`: solo si `location.state.fromAdmin === true`.
 * No usa sessionStorage: `false`, `undefined` o ausencia de state → modo jugador.
 */
export function tieneContextoAdminGestionEquiposTorneo(locationState) {
  return locationState != null && typeof locationState === 'object' && locationState.fromAdmin === true;
}
