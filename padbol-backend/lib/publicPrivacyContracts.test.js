import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LEGACY_PLAYER_PUBLIC_SELECT,
  PUBLIC_RESERVA_OCCUPANCY_SELECT,
  PUBLIC_TOURNAMENT_PLAYER_SELECT,
  PUBLIC_TOURNAMENT_TEAM_SELECT,
  buildPrivacyFeatureDisabledPayload,
  mapLegacyPlayerPublic,
  mapPublicReservaOccupancy,
  mapTournamentPlayerPublic,
  mapTournamentTeamPublic,
  normalizeEmailAddress,
  privacyFeatureDisabledHandler,
  resolveCreditAccess,
} from './publicPrivacyContracts.js';

const FORBIDDEN_KEYS = [
  'email',
  'telefono',
  'phone',
  'whatsapp',
  'documento',
  'fecha_nacimiento',
  'user_id',
  'creador_email',
  'solicitudes',
];

function assertNoForbiddenPii(value) {
  const json = JSON.stringify(value).toLowerCase();
  for (const key of FORBIDDEN_KEYS) {
    assert.equal(json.includes(`"${key}"`), false, `no debe exponer ${key}`);
  }
  assert.equal(json.includes('secret@example.com'), false);
  assert.equal(json.includes('5491100000000'), false);
  assert.equal(json.includes('30123456'), false);
}

test('jugador legacy usa allowlist estricta y no refleja PII adicional', () => {
  assert.equal(LEGACY_PLAYER_PUBLIC_SELECT.includes('email'), false);
  assert.equal(LEGACY_PLAYER_PUBLIC_SELECT.includes('documento'), false);
  assert.equal(LEGACY_PLAYER_PUBLIC_SELECT.includes('fecha_nacimiento'), false);
  const dto = mapLegacyPlayerPublic({
    id: 1,
    nombre: 'Ana',
    foto_url: 'https://example.com/a.jpg',
    nacionalidad: 'AR',
    pierna_habil: 'derecha',
    bio: 'Juego Padbol',
    estado: 'activo',
    email: 'secret@example.com',
    whatsapp: '5491100000000',
    documento: '30123456',
    fecha_nacimiento: '2000-01-01',
    user_id: 'auth-uuid',
  });
  assert.deepEqual(Object.keys(dto), ['id', 'nombre', 'foto_url', 'nacionalidad', 'pierna_habil', 'bio', 'estado']);
  assertNoForbiddenPii(dto);
});

test('disponibilidad pública conserva sólo datos de ocupación', () => {
  for (const key of ['email', 'whatsapp', 'nombre', 'payment_id']) {
    assert.equal(PUBLIC_RESERVA_OCCUPANCY_SELECT.includes(key), false);
  }
  const dto = mapPublicReservaOccupancy({
    id: 9,
    hora: '19:00',
    hora_inicio: '19:00',
    hora_fin: '20:30',
    cancha: 2,
    cancha_id: 22,
    estado: 'confirmada',
    created_at: '2026-09-07T12:00:00Z',
    sede: 'Club',
    sede_id: 3,
    duracion_minutos: 90,
    nombre: 'Persona',
    email: 'secret@example.com',
    whatsapp: '5491100000000',
    mp_payment_id: 'payment-secret',
  });
  assert.deepEqual(Object.keys(dto), [
    'id', 'hora', 'hora_inicio', 'hora_fin', 'cancha', 'cancha_id', 'estado',
    'created_at', 'sede', 'sede_id', 'duracion_minutos',
  ]);
  assertNoForbiddenPii(dto);
});

test('jugadores y equipos públicos de torneo eliminan contacto e identificadores internos', () => {
  for (const select of [PUBLIC_TOURNAMENT_PLAYER_SELECT, PUBLIC_TOURNAMENT_TEAM_SELECT]) {
    assert.equal(select.includes('email'), false);
    assert.equal(select.includes('creador_email'), false);
    assert.equal(select.includes('solicitudes'), false);
  }
  const player = mapTournamentPlayerPublic({
    id: 4,
    torneo_id: 8,
    nombre: 'secret@example.com',
    email: 'secret@example.com',
    user_id: 'auth-uuid',
    documento: '30123456',
  });
  assert.equal(player.nombre, 'Jugador');
  assertNoForbiddenPii(player);

  const team = mapTournamentTeamPublic({
    id: 2,
    torneo_id: 8,
    nombre: 'Equipo A',
    sede_id: 3,
    puntos_totales: 6,
    inscripcion_estado: 'confirmado',
    creador_email: 'secret@example.com',
    solicitudes: [{ email: 'secret@example.com' }],
    jugadores: [{
      id: 'auth-uuid',
      user_id: 'auth-uuid',
      nombre: 'Ana',
      alias: 'secret@example.com',
      email: 'secret@example.com',
      whatsapp: '5491100000000',
      documento: '30123456',
      es_capitan: true,
    }],
  }, { grupo: 'A' });
  assert.equal(team.grupo, 'A');
  assert.equal(team.capitan_nombre, 'Ana');
  assert.equal(team.jugadores[0].alias, null);
  assertNoForbiddenPii(team);
});

test('créditos sólo autoriza titular o rol administrador', () => {
  assert.equal(normalizeEmailAddress(' Owner@Example.com '), 'owner@example.com');
  assert.deepEqual(resolveCreditAccess({ requesterEmail: '', requestedEmail: 'a@example.com' }), {
    allowed: false,
    mode: 'unauthenticated',
  });
  assert.equal(resolveCreditAccess({ requesterEmail: 'a@example.com', requestedEmail: 'a@example.com' }).mode, 'owner');
  assert.equal(resolveCreditAccess({ requesterEmail: 'a@example.com', requestedEmail: 'b@example.com' }).allowed, false);
  assert.equal(resolveCreditAccess({ requesterEmail: 'a@example.com', requestedEmail: 'b@example.com', role: 'admin_club' }).mode, 'admin_scoped');
  assert.equal(resolveCreditAccess({ requesterEmail: 'a@example.com', requestedEmail: 'b@example.com', isSuperAdmin: true }).mode, 'admin_global');
});

test('features de contacto deshabilitadas informan estado estable sin PII', () => {
  assert.deepEqual(buildPrivacyFeatureDisabledPayload('matchmaking_contact'), {
    error: 'Esta función está temporalmente deshabilitada mientras completamos sus controles de privacidad.',
    code: 'FEATURE_DISABLED_PRIVACY_REVIEW',
    feature: 'matchmaking_contact',
  });

  const res = {
    statusCode: null,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };
  privacyFeatureDisabledHandler('team_external_invitation')({}, res);
  assert.equal(res.statusCode, 410);
  assert.equal(res.payload.code, 'FEATURE_DISABLED_PRIVACY_REVIEW');
  assert.equal(res.payload.feature, 'team_external_invitation');
});
