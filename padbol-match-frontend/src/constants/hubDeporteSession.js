import { DEPORTES_CANCHA_SEDE_KEYS } from './deportesCanchaSede';
import { normalizeDeportesPreferidosArray } from './deportesPreferidos';

/** Misma clave en sessionStorage y localStorage: filtro «Elegir deporte» del hub. */
export const HUB_DEPORTE_SESSION_KEY = 'padbol_hub_deporte_filter';
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

export function readHubDeporteFilterFromLocalStorage() {
  try {
    const raw = localStorage.getItem(HUB_DEPORTE_LOCAL_KEY);
    const k = String(raw || '').trim().toLowerCase();
    return isHubDeporteKeyValid(k) ? k : '';
  } catch {
    return '';
  }
}

/** sessionStorage primero, luego localStorage (persiste entre logins en el mismo dispositivo). */
export function readHubDeporteFilterPersisted() {
  const fromSession = readHubDeporteFilterFromSession();
  if (fromSession) return fromSession;
  return readHubDeporteFilterFromLocalStorage();
}

export function writeHubDeporteFilterToSession(value) {
  try {
    const v = String(value || '').trim().toLowerCase();
    if (v && DEPORTES_CANCHA_SEDE_KEYS.includes(v)) {
      sessionStorage.setItem(HUB_DEPORTE_SESSION_KEY, v);
      localStorage.setItem(HUB_DEPORTE_LOCAL_KEY, v);
    } else {
      sessionStorage.removeItem(HUB_DEPORTE_SESSION_KEY);
      localStorage.removeItem(HUB_DEPORTE_LOCAL_KEY);
    }
  } catch {
    /* ignore */
  }
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
 * Deporte activo del hub: elección actual → sesión → perfil (logueado) → localStorage.
 * @param {{ current?: string, userProfile?: object|null }} opts
 */
export function resolveHubDeporteElegido({ current = '', userProfile = null } = {}) {
  const cur = String(current || '').trim().toLowerCase();
  if (isHubDeporteKeyValid(cur)) return cur;
  const fromSession = readHubDeporteFilterFromSession();
  if (fromSession) return fromSession;
  const fromProfile = pickHubDeporteFromProfile(userProfile);
  if (fromProfile) return fromProfile;
  return readHubDeporteFilterFromLocalStorage();
}
