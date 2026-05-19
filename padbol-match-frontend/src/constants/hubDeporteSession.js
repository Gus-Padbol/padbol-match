import { DEPORTES_CANCHA_SEDE_KEYS } from './deportesCanchaSede';
import { normalizeDeportesPreferidosArray } from './deportesPreferidos';

/** Deporte por defecto en hub y pantallas con selector. */
export const HUB_DEPORTE_DEFAULT = 'padbol';

/** Preferencia persistente del usuario (localStorage). */
export const HUB_DEPORTE_PREFERIDO_KEY = 'padbol_deporte_preferido';

/** Filtro de sesión actual (sessionStorage). */
export const HUB_DEPORTE_SESSION_KEY = 'padbol_hub_deporte_filter';

/** Clave legacy (migración). */
export const HUB_DEPORTE_LOCAL_KEY = HUB_DEPORTE_SESSION_KEY;

function isHubDeporteKeyValid(raw) {
  const k = String(raw || '').trim().toLowerCase();
  return Boolean(k && DEPORTES_CANCHA_SEDE_KEYS.includes(k));
}

export function readHubDeporteFilterFromSession() {
  try {
    const raw = sessionStorage.getItem(HUB_DEPORTE_SESSION_KEY);
    const k = String(raw || '').trim().toLowerCase();
    return isHubDeporteKeyValid(k) ? k : '';
  } catch {
    return '';
  }
}

/** `padbol_deporte_preferido` (y legacy) → padbol si no hay valor válido. */
export function readHubDeportePreferidoLocal() {
  try {
    const keys = [HUB_DEPORTE_PREFERIDO_KEY, HUB_DEPORTE_LOCAL_KEY];
    for (const key of keys) {
      const raw = localStorage.getItem(key);
      const k = String(raw || '').trim().toLowerCase();
      if (isHubDeporteKeyValid(k)) return k;
    }
  } catch {
    /* ignore */
  }
  return HUB_DEPORTE_DEFAULT;
}

/** sessionStorage primero, luego preferencia guardada (o padbol). */
export function readHubDeporteFilterPersisted() {
  const fromSession = readHubDeporteFilterFromSession();
  if (fromSession) return fromSession;
  return readHubDeportePreferidoLocal();
}

export function writeHubDeportePreferido(value) {
  try {
    const v = String(value || '').trim().toLowerCase();
    if (v && DEPORTES_CANCHA_SEDE_KEYS.includes(v)) {
      localStorage.setItem(HUB_DEPORTE_PREFERIDO_KEY, v);
      sessionStorage.setItem(HUB_DEPORTE_SESSION_KEY, v);
    } else {
      localStorage.removeItem(HUB_DEPORTE_PREFERIDO_KEY);
      sessionStorage.removeItem(HUB_DEPORTE_SESSION_KEY);
    }
  } catch {
    /* ignore */
  }
}

/** Alias usado en hub / jugar / clases / partidos. */
export function writeHubDeporteFilterToSession(value) {
  writeHubDeportePreferido(value);
}

/** @deprecated use readHubDeportePreferidoLocal */
export function readHubDeporteFilterFromLocalStorage() {
  return readHubDeportePreferidoLocal();
}

/** Primer deporte del perfil válido para el hub (deportes_preferidos). */
export function pickHubDeporteFromProfile(userProfile) {
  if (!userProfile) return '';
  const prefs = normalizeDeportesPreferidosArray(userProfile.deportes_preferidos);
  for (const k of prefs) {
    if (DEPORTES_CANCHA_SEDE_KEYS.includes(k)) return k;
  }
  return '';
}

/**
 * Deporte activo: elección en pantalla → sesión → preferencia local → padbol.
 */
export function resolveHubDeporteElegido({ current = '' } = {}) {
  const cur = String(current || '').trim().toLowerCase();
  if (isHubDeporteKeyValid(cur)) return cur;
  const fromSession = readHubDeporteFilterFromSession();
  if (fromSession) return fromSession;
  return readHubDeportePreferidoLocal();
}
