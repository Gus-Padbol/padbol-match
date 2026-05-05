/**
 * Super admin puede activar "modo jugador" para navegar sin bypass admin (sessionStorage).
 */

export const PADBOL_MODO_JUGADOR_STORAGE_KEY = 'padbol_modo_jugador';

export const PADBOL_MODO_JUGADOR_CHANGED_EVENT = 'padbol-modo-jugador-changed';

/** Misma lista que {@link ../utils/torneoAdminAccess} (emails con admin global histórico). */
const LEGACY_SUPER_ADMIN_EMAILS = [
  'padbolinternacional@gmail.com',
  'admin@padbol.com',
  'sm@padbol.com',
  'juanpablo@padbol.com',
];

export function isSuperAdminIdentity(email, rol) {
  const em = String(email || '').trim().toLowerCase();
  if (LEGACY_SUPER_ADMIN_EMAILS.includes(em)) return true;
  if (String(rol || '').trim().toLowerCase() === 'super_admin') return true;
  return false;
}

export function readPadbolModoJugadorStorage() {
  if (typeof sessionStorage === 'undefined') return false;
  try {
    return sessionStorage.getItem(PADBOL_MODO_JUGADOR_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setPadbolModoJugador(enabled) {
  if (typeof sessionStorage === 'undefined') return;
  try {
    if (enabled) sessionStorage.setItem(PADBOL_MODO_JUGADOR_STORAGE_KEY, 'true');
    else sessionStorage.removeItem(PADBOL_MODO_JUGADOR_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  notifyPadbolModoJugadorChanged();
}

export function notifyPadbolModoJugadorChanged() {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new Event(PADBOL_MODO_JUGADOR_CHANGED_EVENT));
  } catch {
    /* ignore */
  }
}

/** Super admin con flag activo: sin permisos admin en la app hasta desactivar. */
export function isPadbolModoJugadorActivo({ email, rol } = {}) {
  return readPadbolModoJugadorStorage() && isSuperAdminIdentity(email, rol);
}
