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
