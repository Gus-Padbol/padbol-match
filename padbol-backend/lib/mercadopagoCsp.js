/** Orígenes Mercado Pago para CSP (Checkout Pro + SDK). Sin nonce ni strict-dynamic. */
export const MP_CSP_SCRIPT_SRC = [
  "'self'",
  "'unsafe-inline'",
  "'unsafe-eval'",
  'https://sdk.mercadopago.com',
  'https://www.mercadopago.com',
  'https://www.mercadopago.com.ar',
  'https://api.mercadopago.com',
  'https://*.mercadopago.com',
];

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
