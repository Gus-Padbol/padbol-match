import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const serverSource = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');

function between(start, end) {
  const from = serverSource.indexOf(start);
  const to = serverSource.indexOf(end, from + start.length);
  assert.ok(from >= 0, `no se encontró inicio: ${start}`);
  assert.ok(to > from, `no se encontró fin: ${end}`);
  return serverSource.slice(from, to);
}

test('las rutas legacy de jugadores bloquean escrituras y usan DTO público', () => {
  assert.match(
    serverSource,
    /app\.post\('\/api\/jugadores', privacyFeatureDisabledHandler\('legacy_player_create'\)\)/,
  );
  assert.match(
    serverSource,
    /app\.put\('\/api\/jugadores\/:id', privacyFeatureDisabledHandler\('legacy_player_update'\)\)/,
  );

  const listRoute = between("app.get('/api/jugadores',", "app.get('/api/jugadores/buscar',");
  assert.match(listRoute, /select\(LEGACY_PLAYER_PUBLIC_SELECT\)/);
  assert.match(listRoute, /mapLegacyPlayerPublic/);
  assert.doesNotMatch(listRoute, /select\('\*'\)/);

  const idRoute = between("app.get('/api/jugadores/:id',", "app.put('/api/jugadores/:id',");
  assert.match(idRoute, /select\(LEGACY_PLAYER_PUBLIC_SELECT\)/);
  assert.match(idRoute, /mapLegacyPlayerPublic/);
  assert.doesNotMatch(idRoute, /select\('\*'\)/);
});

test('disponibilidad pública consulta y devuelve sólo ocupación', () => {
  const route = between("app.get('/api/disponibilidad/:sede/:fecha',", 'function parsePrecioMonedaBackend');
  assert.match(route, /select\(PUBLIC_RESERVA_OCCUPANCY_SELECT\)/);
  assert.match(route, /mapPublicReservaOccupancy/);
  assert.match(route, /in\('estado', \['confirmada', 'pendiente', 'prereserva'\]\)/);
  assert.doesNotMatch(route, /select\('\*'\)/);
});

test('contactos externos permanecen deshabilitados sin código de extracción de números', () => {
  assert.match(
    serverSource,
    /'\/api\/jugadores\/disponibles-matchmaking',[\s\S]{0,120}privacyFeatureDisabledHandler\('matchmaking_contact'\)/,
  );
  assert.match(
    serverSource,
    /'\/api\/equipos\/:id\/invitar',[\s\S]{0,120}privacyFeatureDisabledHandler\('team_external_invitation'\)/,
  );
  assert.doesNotMatch(serverSource, /whatsapp_me_digits|fetchWhatsappDesdeReservasPorUserOEmail/);
});

test('listados públicos de torneo usan allowlist y sanitización', () => {
  const playerCreate = between("app.post('/api/torneos/:torneo_id/jugadores',", "app.get('/api/torneos/:torneo_id/jugadores',");
  assert.match(playerCreate, /mapTournamentPlayerPublic/);
  assert.doesNotMatch(playerCreate, /res\.json\(data\)/);

  const players = between("app.get('/api/torneos/:torneo_id/jugadores',", "app.delete('/api/jugadores_torneo/:id',");
  assert.match(players, /select\(PUBLIC_TOURNAMENT_PLAYER_SELECT\)/);
  assert.match(players, /mapTournamentPlayerPublic/);
  assert.doesNotMatch(players, /select\('\*'\)/);

  const teams = between("app.get('/api/torneos/:torneo_id/equipos',", "app.put('/api/equipos/:id',");
  assert.match(teams, /select\(PUBLIC_TOURNAMENT_TEAM_SELECT\)/);
  assert.match(teams, /mapTournamentTeamPublic/);
  assert.doesNotMatch(teams, /return \{ \.\.\.eq/);
  assert.doesNotMatch(teams, /select\('\*'\)/);

  const teamCreate = between("app.post('/api/torneos/:torneo_id/equipos',", "app.post('/api/inscripciones',");
  assert.match(teamCreate, /mapTournamentTeamPublic/);
  const teamUpdate = between("app.put('/api/equipos/:id',", '// Invitaciones por contacto externo');
  assert.match(teamUpdate, /mapTournamentTeamPublic/);
});

test('créditos exige identidad y alcance sin registrar el email solicitado', () => {
  const route = between("app.get('/api/creditos/:email',", 'function equipoIncluyeUsuario');
  assert.match(route, /adminListScopeFromRequest\(req\)/);
  assert.match(route, /resolveCreditAccess/);
  assert.match(route, /sedesPermitidasPorScope/);
  assert.match(route, /supabaseAdmin[\s\S]*from\('creditos'\)/);
  assert.doesNotMatch(route, /GET creditos \$\{email\}/);
  assert.doesNotMatch(route, /json\(\{ error: err\.message/);
});
