/** Clave localStorage: vuelta al flujo de reserva tras login (pathname + search + hash). */
export const RESERVA_RETURN_STORAGE_KEY = 'padbol_reserva_return';

/**
 * Guarda pathname + query (+ hash) para volver tras el login.
 * @param {{ sedeId?: string|number; fecha?: string; hora?: string; cancha?: string|number }} [extraQuery] mezcla con la URL actual (p. ej. estado de reserva no reflejado en el address bar).
 */
export function saveReservaReturnUrl(extraQuery) {
  try {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    if (extraQuery && typeof extraQuery === 'object') {
      const { sedeId, fecha, hora, cancha } = extraQuery;
      if (sedeId != null && String(sedeId).trim() !== '') sp.set('sedeId', String(sedeId).trim());
      if (fecha != null && String(fecha).trim() !== '') sp.set('fecha', String(fecha).trim());
      if (hora != null && String(hora).trim() !== '') sp.set('hora', String(hora).trim());
      if (cancha != null && String(cancha).trim() !== '') sp.set('canchaId', String(cancha).trim());
    }
    const qs = sp.toString();
    const path = window.location.pathname || '/reservar';
    const u = `${path}${qs ? `?${qs}` : ''}${window.location.hash || ''}`;
    localStorage.setItem(RESERVA_RETURN_STORAGE_KEY, u);
  } catch {
    /* ignore */
  }
}
