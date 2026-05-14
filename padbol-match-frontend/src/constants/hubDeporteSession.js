import { DEPORTES_CANCHA_SEDE_KEYS } from './deportesCanchaSede';

/** Misma clave que en UserHome / Jugar: filtro «Elegir deporte» entre pantallas del hub. */
export const HUB_DEPORTE_SESSION_KEY = 'padbol_hub_deporte_filter';

export function readHubDeporteFilterFromSession() {
  try {
    const raw = sessionStorage.getItem(HUB_DEPORTE_SESSION_KEY);
    const k = String(raw || '').trim().toLowerCase();
    return DEPORTES_CANCHA_SEDE_KEYS.includes(k) ? k : '';
  } catch {
    return '';
  }
}

export function writeHubDeporteFilterToSession(value) {
  try {
    const v = String(value || '').trim().toLowerCase();
    if (v && DEPORTES_CANCHA_SEDE_KEYS.includes(v)) {
      sessionStorage.setItem(HUB_DEPORTE_SESSION_KEY, v);
    } else {
      sessionStorage.removeItem(HUB_DEPORTE_SESSION_KEY);
    }
  } catch {
    /* ignore */
  }
}
