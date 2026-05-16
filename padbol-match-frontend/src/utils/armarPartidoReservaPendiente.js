/** sessionStorage: reserva armar-partido pendiente de login (paso 2 → login → paso 3). */
export const RESERVA_PENDIENTE_KEY = 'reserva_pendiente';

const PM_RESTORE_LOG = '[PM ArmarPartido restore]';

/** Normaliza y valida el payload guardado antes de restaurar el paso 3. */
export function parseReservaPendienteArmarPayload(data) {
  if (!data || typeof data !== 'object') return null;
  const sedeId = String(data.sede_id ?? '').trim();
  const canchaId = Number(data.cancha_id);
  const fecha = String(data.fecha ?? '').trim();
  const horaInicio = String(data.hora_inicio ?? data.hora ?? '')
    .trim()
    .split(' - ')[0]
    .trim();
  const duracion = Number(data.duracion_minutos ?? data.duracion);
  if (!sedeId || !Number.isFinite(canchaId) || canchaId < 1 || !fecha || !horaInicio) {
    return null;
  }
  return {
    sedeId,
    canchaId,
    fecha,
    horaInicio,
    duracion: Number.isFinite(duracion) && duracion > 0 ? duracion : 90,
  };
}

export function saveReservaPendienteArmar(payload) {
  try {
    if (typeof window === 'undefined') return;
    const parsed = parseReservaPendienteArmarPayload(payload);
    if (!parsed) {
      console.warn(`${PM_RESTORE_LOG} save omitido (payload inválido)`, payload);
      return;
    }
    const toStore = {
      sede_id: parsed.sedeId,
      cancha_id: parsed.canchaId,
      fecha: parsed.fecha,
      hora_inicio: parsed.horaInicio,
      duracion_minutos: parsed.duracion,
    };
    sessionStorage.setItem(RESERVA_PENDIENTE_KEY, JSON.stringify(toStore));
    console.log(`${PM_RESTORE_LOG} guardado`, toStore);
  } catch {
    /* ignore */
  }
}

export function readReservaPendienteArmar() {
  try {
    if (typeof window === 'undefined') return null;
    const raw = sessionStorage.getItem(RESERVA_PENDIENTE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    return data;
  } catch {
    return null;
  }
}

export function peekReservaPendienteArmar() {
  return Boolean(readReservaPendienteArmar());
}

export function clearReservaPendienteArmar() {
  try {
    if (typeof window === 'undefined') return;
    sessionStorage.removeItem(RESERVA_PENDIENTE_KEY);
  } catch {
    /* ignore */
  }
}

/** `?redirect=` seguro hacia /armar-partido (evita open redirect). */
export function safeArmarPartidoPathFromLoginRedirect(loginSearch) {
  if (loginSearch == null) return null;
  const q = String(loginSearch);
  try {
    const sp = new URLSearchParams(q.startsWith('?') ? q.slice(1) : q);
    const raw = sp.get('redirect');
    if (raw == null || raw === '') return null;
    let path;
    try {
      path = decodeURIComponent(String(raw).trim());
    } catch {
      path = String(raw).trim();
    }
    if (!path.startsWith('/') || path.startsWith('//')) return null;
    const pathOnly = path.split('?')[0].split('#')[0];
    if (pathOnly === '/armar-partido' || pathOnly === '/jugar/armar') return pathOnly;
    return null;
  } catch {
    return null;
  }
}
