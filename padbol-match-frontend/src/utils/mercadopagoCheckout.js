/** sessionStorage: Public Key MP activa para checkout (por sede, desde backend). */
export const MP_PUBLIC_KEY_SESSION_KEY = 'padbol_mp_public_key';

/**
 * Resuelve la Public Key de Mercado Pago para checkout (nunca usa env hardcodeado).
 * @param {{ fromApi?: string; fromSede?: { mp_public_key?: string } | null; sedeId?: string|number }} [opts]
 */
export function resolveMercadoPagoPublicKey(opts = {}) {
  const fromApi = opts.fromApi != null ? String(opts.fromApi).trim() : '';
  if (fromApi) return fromApi;
  const fromSede = opts.fromSede?.mp_public_key != null ? String(opts.fromSede.mp_public_key).trim() : '';
  if (fromSede) return fromSede;
  const sid = opts.sedeId != null && String(opts.sedeId).trim() !== '' ? String(opts.sedeId).trim() : '';
  if (sid && typeof window !== 'undefined') {
    try {
      const scoped = sessionStorage.getItem(`${MP_PUBLIC_KEY_SESSION_KEY}_${sid}`);
      if (scoped && String(scoped).trim()) return String(scoped).trim();
    } catch {
      /* ignore */
    }
  }
  if (typeof window !== 'undefined') {
    try {
      const global = sessionStorage.getItem(MP_PUBLIC_KEY_SESSION_KEY);
      if (global && String(global).trim()) return String(global).trim();
    } catch {
      /* ignore */
    }
  }
  return '';
}

/** Guarda la Public Key devuelta por el backend antes del redirect a Checkout Pro. */
export function storeMercadoPagoPublicKey(publicKey, sedeId) {
  const key = String(publicKey || '').trim();
  if (!key || typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(MP_PUBLIC_KEY_SESSION_KEY, key);
    if (sedeId != null && String(sedeId).trim() !== '') {
      sessionStorage.setItem(`${MP_PUBLIC_KEY_SESSION_KEY}_${String(sedeId).trim()}`, key);
    }
  } catch {
    /* ignore */
  }
}

/**
 * Checkout Pro Mercado Pago: redirección completa al init_point (sin SDK, Brick ni iframe).
 * @param {string} initPoint
 * @param {{ mp_public_key?: string; sedeId?: string|number }} [meta]
 * @returns {boolean}
 */
export function redirectMercadoPagoCheckout(initPoint, meta) {
  const url = String(initPoint || '').trim();
  if (!url) return false;
  const pk = resolveMercadoPagoPublicKey({
    fromApi: meta?.mp_public_key,
    sedeId: meta?.sedeId,
  });
  if (pk) storeMercadoPagoPublicKey(pk, meta?.sedeId);
  window.location.replace(url);
  return true;
}

/**
 * @param {Response} res
 * @param {Record<string, unknown>} data
 * @param {{ sedeId?: string|number }} [opts]
 * @returns {{ redirected: boolean; data: Record<string, unknown>; mpPublicKey: string }}
 */
export function handleCrearPreferenciaResponse(res, data, opts) {
  const payload = data && typeof data === 'object' ? data : {};
  const mpPublicKey = resolveMercadoPagoPublicKey({
    fromApi: payload.mp_public_key,
    fromSede: opts?.fromSede,
    sedeId: opts?.sedeId,
  });
  if (res.ok && payload.init_point) {
    redirectMercadoPagoCheckout(String(payload.init_point), {
      mp_public_key: mpPublicKey || payload.mp_public_key,
      sedeId: opts?.sedeId,
    });
    return { redirected: true, data: payload, mpPublicKey };
  }
  return { redirected: false, data: payload, mpPublicKey };
}
