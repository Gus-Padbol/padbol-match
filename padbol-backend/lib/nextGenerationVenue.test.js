import test from 'node:test';
import assert from 'node:assert/strict';
import { canReadRegistrationStatus, hashCancellationToken, parseGroupInput, parseJornadaInput, summarizeRegistrations } from './nextGenerationVenue.js';

test('jornada acepta únicamente categorías, cupos y canchas válidos', () => {
  const parsed = parseJornadaInput({ nombre: 'Jornada U14', fecha_hora: '2026-11-01T12:00:00Z', coach: 'Fide', categoria: 'u14', cupo: 24, canchas: 2, estado: 'publicada' });
  assert.equal(parsed.categoria, 'U14');
  assert.equal(parsed.cupo, 24);
  assert.throws(() => parseJornadaInput({ ...parsed, categoria: 'U12' }), /Categoría/);
  assert.throws(() => parseJornadaInput({ ...parsed, cupo: 0 }), /Cupo/);
});

test('edición parcial no permite estados arbitrarios', () => {
  assert.deepEqual(parseJornadaInput({ estado: 'cerrada' }, { partial: true }), { estado: 'cerrada' });
  assert.throws(() => parseJornadaInput({ estado: 'eliminada' }, { partial: true }), /Estado/);
});

test('grupos de continuidad validan categoría y estado', () => {
  assert.deepEqual(parseGroupInput({ nombre: 'Continuidad A', categoria: 'U16', coach: 'Fide', estado: 'activo' }), { nombre: 'Continuidad A', categoria: 'U16', coach: 'Fide', estado: 'activo' });
  assert.throws(() => parseGroupInput({ estado: 'borrado' }, { partial: true }), /Estado/);
});

test('resumen separa confirmados, espera y cancelados', () => {
  assert.deepEqual(summarizeRegistrations([{ estado: 'confirmado' }, { estado: 'espera' }, { estado: 'cancelado' }, { estado: 'confirmado' }]), { confirmado: 2, espera: 1, cancelado: 1 });
});

test('estado de inscripción sólo se autoriza al jugador o con token de cancelación', () => {
  const registration = { user_id: 'player-1', cancel_token_hash: hashCancellationToken('private-token') };
  assert.equal(canReadRegistrationStatus(registration, { userId: 'player-1' }), true);
  assert.equal(canReadRegistrationStatus(registration, { userId: 'player-2' }), false);
  assert.equal(canReadRegistrationStatus(registration, { cancellationToken: 'private-token' }), true);
  assert.equal(canReadRegistrationStatus(registration, { cancellationToken: 'wrong-token' }), false);
});

test('contrato nativo usa el path canónico y prohíbe tokens en query', async () => {
  const fs = await import('node:fs/promises');
  const source = await fs.readFile(new URL('./nextGenerationVenue.js', import.meta.url), 'utf8');
  assert.match(source, /app\.get\('\/api\/next-generation\/registrations\/status'/);
  assert.match(source, /registrationId: req\.query\.registration_id/);
  assert.match(source, /sessionId: req\.query\.session_id/);
  assert.match(source, /req\.get\('x-ng-cancellation-token'\)/);
  assert.doesNotMatch(source, /req\.query\.(?:cancel_token|token)/);
  assert.match(source, /registration\.jornada_id\) !== safeSessionId/);
});

test('migración versionada incluye RLS por sede y las cuatro tablas', async () => {
  const fs = await import('node:fs/promises');
  const sql = await fs.readFile(new URL('../../supabase/migrations/20261001190000_fipa_next_generation_venue_operations.sql', import.meta.url), 'utf8');
  for (const table of ['ng_jornadas', 'ng_jornada_inscripciones', 'ng_grupos_continuidad', 'ng_grupo_miembros']) assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, 'i'));
  assert.match(sql, /ur\.role = 'super_admin'/i);
  assert.match(sql, /ur\.role in \('admin_club','empleado'\) and ur\.sede_id = p_sede_id/i);
  assert.match(sql, /cancel_token_hash text unique/i);
});
