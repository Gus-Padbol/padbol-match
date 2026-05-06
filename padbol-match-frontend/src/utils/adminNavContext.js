/** Claves legacy / torneo: limpiar junto con {@link clearAdminNavContext} al pasar a inscripción jugador. */
const ADMIN_TORNEO_SESSION_KEYS = [
  'padbol_admin_nav_context',
  'padbol_admin_torneo_context',
  'padbol_from_admin',
  'padbol_modo_jugador',
];

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
