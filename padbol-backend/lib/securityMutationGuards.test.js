import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const serverSource = fs.readFileSync(path.join(here, '../server.js'), 'utf8');

function routeBlock(method, route) {
  const marker = `app.${method}('${route}'`;
  const start = serverSource.indexOf(marker);
  assert.notEqual(start, -1, `No se encontró ${method.toUpperCase()} ${route}`);
  const rest = serverSource.slice(start + marker.length);
  const nextRoute = rest.search(/\napp\.(?:get|post|put|patch|delete)\('/);
  return serverSource.slice(
    start,
    nextRoute === -1 ? serverSource.length : start + marker.length + nextRoute,
  );
}

test('mutaciones administrativas de torneos exigen alcance sobre la sede', () => {
  [
    ['put', '/api/torneos/:id'],
    ['patch', '/api/torneos/:id'],
    ['delete', '/api/torneos/:id'],
    ['post', '/api/torneos/:id/generar-partidos'],
    ['post', '/api/torneos/:id/finalizar'],
  ].forEach(([method, route]) => {
    assert.match(
      routeBlock(method, route),
      /assertUsuarioPuedeAdministrarTorneo|handleTorneoPatchOrPut/,
      `${method.toUpperCase()} ${route} debe validar permisos`,
    );
  });
});

test('editar o eliminar reservas exige rol administrativo y alcance', () => {
  for (const method of ['put', 'delete']) {
    const block = routeBlock(method, '/api/reservas/:id');
    assert.match(block, /adminListScopeFromRequest/);
    assert.match(block, /assertReservaAccesibleHistorial/);
  }
});

test('listar reservas nunca usa service_role sin una sesión resuelta', () => {
  const block = routeBlock('get', '/api/reservas');
  const authIndex = block.indexOf("if (!scope) return res.status(401)");
  const privilegedQueryIndex = block.indexOf("supabaseAdmin.from('reservas').select('*')");
  assert.ok(authIndex >= 0, 'GET /api/reservas debe rechazar requests anónimos');
  assert.ok(
    authIndex < privilegedQueryIndex,
    'la sesión debe validarse antes de iniciar una consulta privilegiada de reservas',
  );
  assert.match(block, /query = query\.eq\('user_id', scope\.authUserId\)/);
});

test('ingresos y configuración de puntos quedan restringidos a super admin', () => {
  assert.match(routeBlock('get', '/api/ingresos'), /assertSuperAdminReq/);
  assert.match(routeBlock('put', '/api/config/puntos'), /assertSuperAdminReq/);
});

test('confirmar check-in revalida estado y fecha aunque el QR sea válido', () => {
  const block = routeBlock('post', '/api/checkin/confirmar/:qr_token');
  assert.match(block, /select\('id, fecha, estado, checkin_at'\)/);
  assert.match(block, /CHECKIN_RESERVA_CANCELADA/);
  assert.match(block, /ymdFromReservaFechaCheckin\(prev\.fecha\)/);
  assert.match(block, /CHECKIN_FECHA_INVALIDA/);
  assert.ok(
    block.indexOf('CHECKIN_RESERVA_CANCELADA') < block.indexOf(".update({ checkin_at, checkin_by })"),
    'la reserva cancelada debe rechazarse antes de escribir checkin_at',
  );
  assert.ok(
    block.indexOf('CHECKIN_FECHA_INVALIDA') < block.indexOf(".update({ checkin_at, checkin_by })"),
    'la fecha debe revalidarse antes de escribir checkin_at',
  );
});

test('liberar-slot-pendiente exige token y elimina sólo el ID firmado', () => {
  const block = routeBlock('post', '/api/reservas/liberar-slot-pendiente');
  assert.match(block, /verifyReservaReleaseToken\(req\.body\?\.release_token/);
  assert.match(block, /\.eq\('id', claims\.reservationId\)/);
  assert.doesNotMatch(block, /\.eq\('sede'/);
  assert.doesNotMatch(block, /\.eq\('fecha'/);
  assert.doesNotMatch(block, /\.eq\('hora'/);
  assert.doesNotMatch(block, /\.eq\('cancha'/);
  assert.doesNotMatch(block, /\.delete\(\)\.in\('id'/);
});
