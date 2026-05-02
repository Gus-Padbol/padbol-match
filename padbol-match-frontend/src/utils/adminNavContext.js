/** Session flag: admin_club (y similares) navegando en contexto panel / torneo desde admin. */
const KEY = 'padbol_admin_nav_context';

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

export function clearAdminNavContext() {
  setAdminNavContext(false);
}

/**
 * Contexto para "Gestionar" equipos / gestión masiva: solo con `state.fromAdmin === true`
 * (navegación desde panel) o bandera de sesión activa (`readAdminNavContext`).
 */
export function tieneContextoAdminGestionEquiposTorneo(locationState) {
  if (locationState != null && typeof locationState === 'object' && locationState.fromAdmin === true) {
    return true;
  }
  return readAdminNavContext();
}
