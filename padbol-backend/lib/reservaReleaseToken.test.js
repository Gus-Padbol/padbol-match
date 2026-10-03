import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertReservaMatchesReleaseToken,
  createReservaReleaseToken,
  verifyReservaReleaseToken,
} from './reservaReleaseToken.js';

const secret = 'qa-test-secret-with-enough-entropy-0123456789';
const nowMs = Date.parse('2026-10-03T12:00:00.000Z');
const pending = {
  id: 812,
  sede: 'Padbol Norte',
  fecha: '2026-10-04',
  hora: '18:30',
  cancha: 2,
  estado: 'pendiente_pago_manual',
};

test('emite y valida una capacidad ligada a reserva, slot y expiración', () => {
  const issued = createReservaReleaseToken({ reserva: pending, secret, nowMs, ttlSeconds: 600 });
  const claims = verifyReservaReleaseToken(issued.token, { secret, nowMs: nowMs + 1_000 });
  assert.equal(claims.reservationId, pending.id);
  assert.doesNotThrow(() => assertReservaMatchesReleaseToken(pending, claims));
  assert.equal(issued.expiresAt, '2026-10-03T12:10:00.000Z');
});

test('rechaza ausencia, manipulación y secreto incorrecto', () => {
  assert.throws(
    () => verifyReservaReleaseToken('', { secret, nowMs }),
    (error) => error.code === 'RESERVA_RELEASE_TOKEN_REQUIRED' && error.status === 401,
  );
  const { token } = createReservaReleaseToken({ reserva: pending, secret, nowMs });
  assert.throws(
    () => verifyReservaReleaseToken(`${token.slice(0, -1)}x`, { secret, nowMs }),
    (error) => error.code === 'RESERVA_RELEASE_TOKEN_INVALID' && error.status === 401,
  );
  assert.throws(
    () => verifyReservaReleaseToken(`${token}!`, { secret, nowMs }),
    (error) => error.code === 'RESERVA_RELEASE_TOKEN_INVALID',
  );
  assert.throws(
    () => verifyReservaReleaseToken(token, { secret: `${secret}-other`, nowMs }),
    (error) => error.code === 'RESERVA_RELEASE_TOKEN_INVALID',
  );
});

test('rechaza token expirado y cambios de slot o estado', () => {
  const { token } = createReservaReleaseToken({ reserva: pending, secret, nowMs, ttlSeconds: 60 });
  assert.throws(
    () => verifyReservaReleaseToken(token, { secret, nowMs: nowMs + 60_000 }),
    (error) => error.code === 'RESERVA_RELEASE_TOKEN_EXPIRED' && error.status === 410,
  );
  const claims = verifyReservaReleaseToken(token, { secret, nowMs: nowMs + 1_000 });
  assert.throws(
    () => assertReservaMatchesReleaseToken({ ...pending, cancha: 3 }, claims),
    (error) => error.code === 'RESERVA_RELEASE_SLOT_MISMATCH' && error.status === 403,
  );
  assert.throws(
    () => assertReservaMatchesReleaseToken({ ...pending, estado: 'confirmada' }, claims),
    (error) => error.code === 'RESERVA_RELEASE_INVALID_STATE' && error.status === 409,
  );
});

test('no emite capacidades para reservas confirmadas', () => {
  assert.throws(
    () => createReservaReleaseToken({ reserva: { ...pending, estado: 'confirmada' }, secret, nowMs }),
    (error) => error.code === 'RESERVA_RELEASE_INVALID_STATE',
  );
});
