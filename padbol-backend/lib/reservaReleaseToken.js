import crypto from 'crypto';

export const RESERVA_RELEASE_PENDING_STATES = Object.freeze([
  'pendiente_pago_manual',
  'pendiente_pago_efectivo',
  'pendiente_pago_mercadopago',
  'pendiente_mercadopago',
]);

const TOKEN_VERSION = 1;
const DEFAULT_TTL_SECONDS = 2 * 60 * 60;
const MAX_TTL_SECONDS = 24 * 60 * 60;

function tokenError(message, code, status = 401) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function signingKey(secret) {
  const value = String(secret || '').trim();
  if (!value) throw tokenError('Liberación segura no configurada', 'RESERVA_RELEASE_NOT_CONFIGURED', 503);
  return crypto.createHmac('sha256', value).update('padbol:reserva-release:v1').digest();
}

function normalizeSlot(reserva) {
  const sede = String(reserva?.sede || '').trim();
  const fecha = String(reserva?.fecha || '').trim();
  const hora = String(reserva?.hora || '').trim();
  const cancha = Number.parseInt(String(reserva?.cancha ?? ''), 10);
  if (!sede || !fecha || !hora || !Number.isFinite(cancha)) {
    throw tokenError('La reserva no tiene un slot válido', 'RESERVA_RELEASE_INVALID_SLOT', 500);
  }
  return `${sede}\u001f${fecha}\u001f${hora}\u001f${cancha}`;
}

export function reservaReleaseSlotHash(reserva) {
  return crypto.createHash('sha256').update(normalizeSlot(reserva), 'utf8').digest('base64url');
}

export function isReservaReleasePendingState(estado) {
  return RESERVA_RELEASE_PENDING_STATES.includes(String(estado || '').trim().toLowerCase());
}

export function createReservaReleaseToken({ reserva, secret, nowMs = Date.now(), ttlSeconds = DEFAULT_TTL_SECONDS }) {
  const reservationId = Number.parseInt(String(reserva?.id ?? ''), 10);
  if (!Number.isFinite(reservationId) || reservationId <= 0) {
    throw tokenError('La reserva no tiene un ID válido', 'RESERVA_RELEASE_INVALID_ID', 500);
  }
  if (!isReservaReleasePendingState(reserva?.estado)) {
    throw tokenError('La reserva no está pendiente de pago', 'RESERVA_RELEASE_INVALID_STATE', 409);
  }
  const ttl = Math.min(MAX_TTL_SECONDS, Math.max(60, Number.parseInt(String(ttlSeconds), 10) || DEFAULT_TTL_SECONDS));
  const expiresAtSeconds = Math.floor(nowMs / 1000) + ttl;
  const payload = {
    v: TOKEN_VERSION,
    rid: reservationId,
    slot: reservaReleaseSlotHash(reserva),
    exp: expiresAtSeconds,
    nonce: crypto.randomBytes(16).toString('base64url'),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = crypto.createHmac('sha256', signingKey(secret)).update(encodedPayload).digest('base64url');
  return {
    token: `${encodedPayload}.${signature}`,
    expiresAt: new Date(expiresAtSeconds * 1000).toISOString(),
  };
}

export function verifyReservaReleaseToken(token, { secret, nowMs = Date.now() }) {
  const raw = String(token || '').trim();
  const parts = raw.split('.');
  if (!raw || parts.length !== 2) {
    throw tokenError('Token de liberación requerido', 'RESERVA_RELEASE_TOKEN_REQUIRED');
  }
  const [encodedPayload, providedSignature] = parts;
  if (!/^[A-Za-z0-9_-]+$/.test(encodedPayload) || !/^[A-Za-z0-9_-]{43}$/.test(providedSignature)) {
    throw tokenError('Token de liberación inválido', 'RESERVA_RELEASE_TOKEN_INVALID');
  }
  const expectedSignature = crypto.createHmac('sha256', signingKey(secret)).update(encodedPayload).digest();
  let signature;
  try {
    signature = Buffer.from(providedSignature, 'base64url');
  } catch {
    throw tokenError('Token de liberación inválido', 'RESERVA_RELEASE_TOKEN_INVALID');
  }
  if (signature.length !== expectedSignature.length || !crypto.timingSafeEqual(signature, expectedSignature)) {
    throw tokenError('Token de liberación inválido', 'RESERVA_RELEASE_TOKEN_INVALID');
  }
  let payload;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
  } catch {
    throw tokenError('Token de liberación inválido', 'RESERVA_RELEASE_TOKEN_INVALID');
  }
  const reservationId = Number.parseInt(String(payload?.rid ?? ''), 10);
  if (
    payload?.v !== TOKEN_VERSION ||
    !Number.isFinite(reservationId) ||
    reservationId <= 0 ||
    typeof payload?.slot !== 'string' ||
    payload.slot.length < 20 ||
    typeof payload?.nonce !== 'string' ||
    payload.nonce.length < 16 ||
    !Number.isFinite(Number(payload?.exp))
  ) {
    throw tokenError('Token de liberación inválido', 'RESERVA_RELEASE_TOKEN_INVALID');
  }
  if (Number(payload.exp) <= Math.floor(nowMs / 1000)) {
    throw tokenError('Token de liberación expirado', 'RESERVA_RELEASE_TOKEN_EXPIRED', 410);
  }
  return { reservationId, slotHash: payload.slot, expiresAt: new Date(Number(payload.exp) * 1000).toISOString() };
}

export function assertReservaMatchesReleaseToken(reserva, claims) {
  if (Number(reserva?.id) !== Number(claims?.reservationId)) {
    throw tokenError('Token de liberación inválido', 'RESERVA_RELEASE_TOKEN_INVALID', 403);
  }
  const expected = Buffer.from(reservaReleaseSlotHash(reserva));
  const provided = Buffer.from(String(claims?.slotHash || ''));
  if (expected.length !== provided.length || !crypto.timingSafeEqual(expected, provided)) {
    throw tokenError('El token no corresponde al slot de la reserva', 'RESERVA_RELEASE_SLOT_MISMATCH', 403);
  }
  if (!isReservaReleasePendingState(reserva?.estado)) {
    throw tokenError('La reserva ya no está pendiente de pago', 'RESERVA_RELEASE_INVALID_STATE', 409);
  }
}
