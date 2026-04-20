const KEY_EQUIPO = 'equipoActual';
const KEY_TORNEO = 'torneoActual';

export function setTorneoEquipoActual(torneoId, equipoId) {
  if (typeof window === 'undefined') return;
  try {
    if (torneoId != null && torneoId !== '') localStorage.setItem(KEY_TORNEO, String(torneoId));
    if (equipoId != null && equipoId !== '') localStorage.setItem(KEY_EQUIPO, String(equipoId));
  } catch {
    /* ignore */
  }
}

export function clearEquipoActual() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(KEY_EQUIPO);
  } catch {
    /* ignore */
  }
}

/** Id de equipo guardado solo si coincide el torneo persistido con `torneoId`. */
export function readEquipoActualForTorneo(torneoId) {
  if (typeof window === 'undefined') return null;
  try {
    const t = localStorage.getItem(KEY_TORNEO);
    if (t == null || String(t) !== String(torneoId)) return null;
    const e = localStorage.getItem(KEY_EQUIPO);
    return e != null && String(e).length > 0 ? String(e) : null;
  } catch {
    return null;
  }
}
