/** Clave localStorage: vuelta al flujo de reserva tras login (pathname + search + hash). */
export const RESERVA_RETURN_STORAGE_KEY = 'padbol_reserva_return';

/** Clave sessionStorage: estado de la reserva antes del login (`v: 2` = pantalla + filtros + formData). */
export const RESERVA_FORM_RESTORE_KEY = 'padbol_reserva_form_restore_v1';

export const RESERVA_FORM_RESTORE_VERSION = 2;

/**
 * Payload versionado para restaurar el flujo tras login (sessionStorage).
 * @param {{ pantalla: number; filtros: { pais?: string; ciudad?: string; sede_id?: string|number|'' }; formData?: Record<string, unknown> }} state
 */
export function buildReservaSessionPayload(state) {
  const filtros = state?.filtros && typeof state.filtros === 'object' ? state.filtros : {};
  const formData = state?.formData && typeof state.formData === 'object' ? state.formData : {};
  return {
    v: RESERVA_FORM_RESTORE_VERSION,
    pantalla: Number(state?.pantalla) || 1,
    filtros: {
      pais: filtros.pais != null ? String(filtros.pais) : '',
      ciudad: filtros.ciudad != null ? String(filtros.ciudad) : '',
      sede_id: filtros.sede_id === '' || filtros.sede_id == null ? '' : filtros.sede_id,
    },
    formData: { ...formData },
  };
}

/** Guarda estado completo de reserva en sessionStorage antes de ir a login. */
export function saveReservaFormSessionState(state) {
  try {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(RESERVA_FORM_RESTORE_KEY, JSON.stringify(buildReservaSessionPayload(state)));
  } catch {
    /* ignore */
  }
}

function urlSearchFromRestoreData(data) {
  const sp = new URLSearchParams();
  const sid = data?.filtros?.sede_id;
  if (sid !== '' && sid != null && String(sid).trim() !== '') {
    sp.set('sedeId', String(sid).trim());
  }
  const fd = data?.formData && typeof data.formData === 'object' ? data.formData : {};
  const fecha = fd.fecha != null ? String(fd.fecha).trim() : '';
  const hora = fd.hora != null ? String(fd.hora).trim() : '';
  const cancha = fd.cancha != null ? String(fd.cancha).trim() : '';
  if (fecha) sp.set('fecha', fecha);
  if (hora) sp.set('hora', hora);
  if (cancha) sp.set('canchaId', cancha);
  return sp;
}

/**
 * Tras login/registro: URL para volver a `/reservar` (sessionStorage v2, localStorage return, o legacy session).
 */
export function getPostLoginReservaPath() {
  let parsed = null;
  try {
    const raw = sessionStorage.getItem(RESERVA_FORM_RESTORE_KEY);
    if (raw) parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }

  if (parsed?.v === RESERVA_FORM_RESTORE_VERSION) {
    const sp = urlSearchFromRestoreData(parsed);
    const qs = sp.toString();
    return `/reservar${qs ? `?${qs}` : ''}`;
  }

  try {
    const u = localStorage.getItem(RESERVA_RETURN_STORAGE_KEY)?.trim();
    if (u && u.startsWith('/reservar')) return u;
  } catch {
    /* ignore */
  }

  if (!parsed || typeof parsed !== 'object') {
    return '/';
  }

  try {
    const sid = parsed?.filtros?.sede_id;
    const fecha = parsed?.fecha != null ? String(parsed.fecha).trim() : '';
    const hora = parsed?.hora != null ? String(parsed.hora).trim() : '';
    const cancha = parsed?.cancha != null ? String(parsed.cancha).trim() : '';

    if (sid !== '' && sid != null && fecha && hora && cancha) {
      const sp = new URLSearchParams({
        sedeId: String(sid),
        fecha,
        hora,
        canchaId: cancha,
      });
      return `/reservar?${sp.toString()}`;
    }
    if (sid !== '' && sid != null) {
      return `/reservar?sedeId=${encodeURIComponent(String(sid).trim())}`;
    }
  } catch {
    /* ignore */
  }

  return '/';
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
