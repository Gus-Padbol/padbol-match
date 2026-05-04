/** Clave localStorage: vuelta al flujo de reserva tras login (pathname + search + hash). */
export const RESERVA_RETURN_STORAGE_KEY = 'padbol_reserva_return';

/** Clave sessionStorage: estado completo de la reserva antes del login (sede, fecha, hora, cancha). */
export const RESERVA_FORM_RESTORE_KEY = 'padbol_reserva_form_restore_v1';

/**
 * Tras login/registro: URL para volver a `/reservar` con la misma selección (localStorage o sessionStorage).
 */
export function getPostLoginReservaPath() {
  try {
    const u = localStorage.getItem(RESERVA_RETURN_STORAGE_KEY)?.trim();
    if (u && u.startsWith('/reservar')) return u;
  } catch {
    /* ignore */
  }
  try {
    const raw = sessionStorage.getItem(RESERVA_FORM_RESTORE_KEY);
    if (!raw) return '/';
    const data = JSON.parse(raw);
    const sid = data?.filtros?.sede_id;
    const fecha = data?.fecha != null ? String(data.fecha).trim() : '';
    const hora = data?.hora != null ? String(data.hora).trim() : '';
    const cancha = data?.cancha != null ? String(data.cancha).trim() : '';
    if (sid === '' || sid == null || !fecha || !hora || !cancha) return '/';
    const sp = new URLSearchParams({
      sedeId: String(sid),
      fecha,
      hora,
      canchaId: cancha,
    });
    return `/reservar?${sp.toString()}`;
  } catch {
    return '/';
  }
}

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
