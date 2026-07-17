/**
 * Mi Sede — Configuración de pagos (adaptación write-only).
 *
 * Las credenciales de pago nunca se leen del Backend hacia un input:
 * el Backend productivo ya no las devuelve (commit 436d7e1) y este módulo
 * garantiza que tampoco se retengan en el estado del panel.
 *
 * Indicadores configurado/no configurado:
 * - Tras guardar: vienen de `response.pagos` del PATCH /api/sedes/:id
 *   ({ mercadopago_configurado, stripe_configurado }).
 * - Carga inicial: la fila de `sedes` que Mi Sede ya lee vía Supabase (RLS)
 *   se usa SOLO para derivar los booleanos en memoria; los campos sensibles
 *   se descartan antes de guardar la fila en el estado. Si esas columnas no
 *   vienen en la respuesta, el indicador queda `null` (estado desconocido),
 *   nunca se interpreta como "no configurado".
 */

/** Campos que jamás deben persistirse en el estado del panel. */
export const SEDE_SECRET_FIELDS = [
  'mp_access_token',
  'mercadopago_access_token',
  'mp_client_secret',
  'mp_public_key',
  'stripe_secret_key',
  'stripe_api_key',
  'stripe_account_id',
  'webhook_secret',
];

export const SEDE_SECRET_FIELD_PATTERN = /(token|secret|api_key|apikey|private|credencial|credential|password|client_id)/i;

function esCampoSensible(key) {
  return SEDE_SECRET_FIELDS.includes(key) || SEDE_SECRET_FIELD_PATTERN.test(key);
}

/**
 * Copia una fila de sede excluyendo credenciales/secretos, para que el
 * estado de React (y por lo tanto el DOM/devtools) nunca los contenga.
 */
export function sanitizeSedeRowForState(row) {
  if (!row || typeof row !== 'object') return row ?? null;
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    if (esCampoSensible(key)) continue;
    out[key] = value;
  }
  return out;
}

const hasText = (v) => typeof v === 'string' && v.trim().length > 0;

/**
 * Deriva los indicadores booleanos desde una fila de sede sin retener el
 * valor. `null` significa "estado desconocido" (la columna no vino en la
 * respuesta); no debe interpretarse como false.
 */
export function deriveSedePagosIndicadores(row) {
  if (!row || typeof row !== 'object') {
    return { mercadopago_configurado: null, stripe_configurado: null };
  }
  return {
    mercadopago_configurado: Object.prototype.hasOwnProperty.call(row, 'mp_access_token')
      ? hasText(row.mp_access_token)
      : null,
    stripe_configurado: Object.prototype.hasOwnProperty.call(row, 'stripe_account_id')
      ? hasText(row.stripe_account_id)
      : null,
  };
}

/**
 * Normaliza `response.pagos` del PATCH. Solo acepta booleanos reales;
 * ante ausencia conserva el indicador previo (o desconocido).
 */
export function normalizePagosIndicadores(pagos, prev = {}) {
  const pick = (key) => {
    if (pagos && typeof pagos[key] === 'boolean') return pagos[key];
    if (typeof prev[key] === 'boolean') return prev[key];
    return prev[key] ?? null;
  };
  return {
    mercadopago_configurado: pick('mercadopago_configurado'),
    stripe_configurado: pick('stripe_configurado'),
  };
}

/**
 * Una credencial escrita es válida para enviarse solo si:
 * - no queda vacía después de trim;
 * - no coincide con ningún placeholder de la interfaz.
 */
export function esCredencialNuevaValida(value, placeholders = []) {
  const v = String(value ?? '').trim();
  if (!v) return false;
  for (const p of placeholders) {
    if (p && v === String(p).trim()) return false;
  }
  return true;
}

/**
 * Construye el payload del PATCH de pagos. Incluye cada credencial
 * únicamente cuando el administrador escribió un valor nuevo válido.
 * Nunca envía campos secretos vacíos, null ni placeholders.
 */
export function buildPagosPatchPayload({
  mpAccessToken,
  mpPublicKey,
  stripeAccountId,
  placeholders = [],
} = {}) {
  const payload = {};
  if (esCredencialNuevaValida(mpAccessToken, placeholders)) {
    payload.mp_access_token = String(mpAccessToken).trim();
  }
  if (esCredencialNuevaValida(mpPublicKey, placeholders)) {
    payload.mp_public_key = String(mpPublicKey).trim();
  }
  if (esCredencialNuevaValida(stripeAccountId, placeholders)) {
    payload.stripe_account_id = String(stripeAccountId).trim();
  }
  return payload;
}

/**
 * Filtra un partial de pagos: descarta secretos vacíos/null/placeholders.
 * Campos no secretos (método / instrucciones) se pasan tal cual.
 */
export function sanitizePagosPartialPayload(partial, placeholders = []) {
  if (!partial || typeof partial !== 'object') return {};
  const out = {};
  for (const [key, value] of Object.entries(partial)) {
    if (key === 'metodo_pago' || key === 'pago_manual_instrucciones') {
      out[key] = value;
      continue;
    }
    if (esCampoSensible(key)) {
      if (esCredencialNuevaValida(value, placeholders)) {
        out[key] = String(value).trim();
      }
      continue;
    }
    out[key] = value;
  }
  return out;
}

/**
 * Fuerza los campos write-only del formulario a cadena vacía.
 */
export function clearPagosCredentialFields(form) {
  if (!form || typeof form !== 'object') return form ?? {};
  return {
    ...form,
    mp_access_token: '',
    mp_public_key: '',
    stripe_account_id: '',
  };
}

/**
 * Procesa la respuesta del PATCH /api/sedes/:id.
 * - Envelope nuevo: { sede, pagos } → usa response.sede y response.pagos.
 * - Compatibilidad temporal con una sede plana (respuestas seguras
 *   anteriores): se sanitiza igualmente, sin aceptar secretos.
 */
export function parseSedePatchResponse(json, prevIndicadores = {}) {
  const raw = json && typeof json === 'object' ? json : null;
  const rawSede = raw
    ? (raw.sede && typeof raw.sede === 'object' ? raw.sede : (raw.pagos ? null : raw))
    : null;
  return {
    sede: rawSede ? sanitizeSedeRowForState(rawSede) : null,
    pagos: normalizePagosIndicadores(raw?.pagos, prevIndicadores),
  };
}

/** Clave de estado para textos: 'configurado' | 'no_configurado' | 'desconocido'. */
export function pagosEstadoKey(indicador) {
  if (indicador === true) return 'configurado';
  if (indicador === false) return 'no_configurado';
  return 'desconocido';
}
