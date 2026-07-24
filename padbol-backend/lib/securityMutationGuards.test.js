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

test('ingresos y configuración de puntos quedan restringidos a super admin', () => {
  assert.match(routeBlock('get', '/api/ingresos'), /assertSuperAdminReq/);
  assert.match(routeBlock('put', '/api/config/puntos'), /assertSuperAdminReq/);
});
