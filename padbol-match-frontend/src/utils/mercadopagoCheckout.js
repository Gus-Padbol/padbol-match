/**
 * Checkout Pro Mercado Pago: redirección completa al init_point (sin SDK, Brick ni iframe).
 * @param {string} initPoint
 * @returns {boolean}
 */
export function redirectMercadoPagoCheckout(initPoint) {
  const url = String(initPoint || '').trim();
  if (!url) return false;
  window.location.replace(url);
  return true;
}

/**
 * @param {Response} res
 * @param {Record<string, unknown>} data
 * @returns {{ redirected: boolean, data: Record<string, unknown> }}
 */
export function handleCrearPreferenciaResponse(res, data) {
  const payload = data && typeof data === 'object' ? data : {};
  if (res.ok && payload.init_point) {
    redirectMercadoPagoCheckout(String(payload.init_point));
    return { redirected: true, data: payload };
  }
  return { redirected: false, data: payload };
}
