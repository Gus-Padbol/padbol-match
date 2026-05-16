/** sessionStorage: reserva armar-partido pendiente de login (paso 2 → login → paso 3). */
export const RESERVA_PENDIENTE_KEY = 'reserva_pendiente';

export function saveReservaPendienteArmar(payload) {
  try {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(RESERVA_PENDIENTE_KEY, JSON.stringify(payload));
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
