/** Token de prueba (sandbox). En producción usar APP_USR-… de la cuenta del club. */
export function isMercadoPagoTestAccessToken(token) {
  const t = String(token || '').trim();
  return /^TEST-/i.test(t);
}

/** Respuesta global MP en Render (webhooks / fallback). */
export function mercadoPagoGlobalAccessToken() {
  return String(process.env.MERCADOPAGO_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN || '').trim();
}

/**
 * Checkout Pro: redirección directa (sin Brick/iframe).
 * Producción → init_point; sandbox → sandbox_init_point.
 */
export function resolveMercadoPagoInitPoint(preference, accessToken) {
  const pref = preference || {};
  const initPoint = String(pref.init_point || '').trim();
  const sandboxInitPoint = String(pref.sandbox_init_point || '').trim();
  const test = isMercadoPagoTestAccessToken(accessToken);
  if (test) return sandboxInitPoint || initPoint || null;
  if (initPoint) return initPoint;
  if (sandboxInitPoint && process.env.NODE_ENV !== 'production') return sandboxInitPoint;
  return null;
}
