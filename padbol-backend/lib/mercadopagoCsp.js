/** Hosts Mercado Pago para CSP (Checkout Pro + SDK). */
export const MP_CSP_SCRIPT_HOSTS = [
  'https://sdk.mercadopago.com',
  'https://www.mercadopago.com',
  'https://www.mercadopago.com.ar',
  'https://api.mercadopago.com',
  'https://*.mercadopago.com',
];

/**
 * script-src con strict-dynamic + nonce por request (sin unsafe-inline / unsafe-eval).
 * @param {(req: import('express').Request, res: import('express').Response) => string} getNonce
 */
export function buildMpCspScriptSrcDirectives(getNonce) {
  return [
    "'strict-dynamic'",
    (req, res) => `'nonce-${getNonce(req, res)}'`,
    ...MP_CSP_SCRIPT_HOSTS,
  ];
}

export const MP_CSP_FRAME_SRC = [
  "'self'",
  'https://www.mercadopago.com',
  'https://www.mercadopago.com.ar',
  'https://api.mercadopago.com',
  'https://*.mercadopago.com',
];

export const MP_CSP_CONNECT_SRC = [
  "'self'",
  'https://api.mercadopago.com',
  'https://www.mercadopago.com',
  'https://www.mercadopago.com.ar',
  'https://*.mercadopago.com',
];

export const MP_CSP_FORM_ACTION = [
  "'self'",
  'https://www.mercadopago.com',
  'https://www.mercadopago.com.ar',
  'https://*.mercadopago.com',
];

/** script-src estático (Vercel / SPA): strict-dynamic + hosts, sin nonce. */
export const MP_CSP_SCRIPT_SRC_STATIC = ["'strict-dynamic'", ...MP_CSP_SCRIPT_HOSTS];
