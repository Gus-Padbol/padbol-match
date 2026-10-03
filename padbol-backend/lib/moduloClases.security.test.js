import assert from 'node:assert/strict';
import test from 'node:test';

import { isProfesorCertificatePathForSede, registerModuloClasesRoutes } from './moduloClases.js';

function routeApp() {
  const routes = new Map();
  const register = (method) => (path, handler) => routes.set(`${method} ${path}`, handler);
  return {
    routes,
    app: {
      get: register('GET'),
      post: register('POST'),
      put: register('PUT'),
      patch: register('PATCH'),
      delete: register('DELETE'),
    },
  };
}

function responseRecorder() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };
}

function baseDeps({ supabase, supabaseAdmin }) {
  return {
    supabase,
    supabaseAdmin,
    authUserFromBearer: async () => ({ id: 'user-1', email: 'player@example.test' }),
    adminListScopeFromRequest: async () => ({ superA: true, rol: 'super_admin' }),
    assertUsuarioPuedeAdministrarSede: async () => true,
    assertSuperAdminReq: async () => true,
    canchasConNumeroReserva: (rows) => rows,
    assertReservaSinSolapeBackend: async () => true,
  };
}

test('el path privado del diploma queda ligado al prefijo exacto de la sede', () => {
  assert.equal(isProfesorCertificatePathForSede('sede-7/diploma.pdf', 7), true);
  assert.equal(isProfesorCertificatePathForSede('sede-8/diploma.pdf', 7), false);
  assert.equal(isProfesorCertificatePathForSede('sede-7/../sede-8/diploma.pdf', 7), false);
  assert.equal(isProfesorCertificatePathForSede('sede-7\\diploma.pdf', 7), false);
});

test('no firma un certificado cuyo objeto pertenece a otra sede', async () => {
  let signed = false;
  const { app, routes } = routeApp();
  const profesorQuery = {
    select() { return this; },
    eq() { return this; },
    async maybeSingle() {
      return { data: { id: 11, sede_id: 7, certificado_url: 'sede-8/diploma.pdf' }, error: null };
    },
  };
  const supabaseAdmin = {
    from(table) {
      assert.equal(table, 'profesores');
      return profesorQuery;
    },
    storage: {
      from() {
        return {
          async createSignedUrl() { signed = true; return { data: { signedUrl: 'unexpected' }, error: null }; },
        };
      },
    },
  };
  registerModuloClasesRoutes(app, baseDeps({ supabase: supabaseAdmin, supabaseAdmin }));
  const response = responseRecorder();

  await routes.get('GET /api/admin/profesores/:id/certificado-url')({ params: { id: '11' } }, response);

  assert.equal(response.statusCode, 409);
  assert.equal(response.payload.code, 'PROFESOR_CERTIFICADO_SEDE_INVALIDA');
  assert.equal(signed, false);
});

function cancellationFixture({ auditError = null } = {}) {
  const selections = [];
  const auditRows = [];
  const deletedIds = [];
  const supabase = {
    from(table) {
      assert.equal(table, 'clases');
      return {
        select(columns) { selections.push(columns); return this; },
        eq() { return this; },
        async maybeSingle() {
          return { data: { id: 21, sede_id: 7, horas_cancelacion: 0 }, error: null };
        },
      };
    },
  };
  const supabaseAdmin = {
    from(table) {
      if (table === 'inscripciones_clases') {
        return {
          select() { return this; },
          eq() { return this; },
          async maybeSingle() {
            return {
              data: {
                id: 31,
                clase_id: 21,
                user_id: 'user-1',
                fecha: '2099-10-10',
                hora_inicio: '10:00',
                estado: 'confirmada',
                reserva_id: null,
              },
              error: null,
            };
          },
          delete() {
            return {
              async eq(_column, value) { deletedIds.push(value); return { error: null }; },
            };
          },
        };
      }
      if (table === 'clases_eventos_internos') {
        return {
          async insert(rows) {
            auditRows.push(...rows);
            return { error: auditError };
          },
        };
      }
      throw new Error(`Tabla inesperada: ${table}`);
    },
  };
  return { supabase, supabaseAdmin, selections, auditRows, deletedIds };
}

test('cancelar selecciona sede_id e inserta la auditoría con esa sede', async () => {
  const fixture = cancellationFixture();
  const { app, routes } = routeApp();
  registerModuloClasesRoutes(app, baseDeps(fixture));
  const response = responseRecorder();

  await routes.get('DELETE /api/clases/inscripcion/:inscripcion_id')({ params: { inscripcion_id: '31' } }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.ok, true);
  assert.match(fixture.selections[0], /sede_id/);
  assert.deepEqual(fixture.deletedIds, [31]);
  assert.equal(fixture.auditRows.length, 1);
  assert.equal(fixture.auditRows[0].sede_id, 7);
  assert.equal(fixture.auditRows[0].tipo, 'cancelacion');
});

test('un fallo de auditoría en cancelación no se silencia', async () => {
  const fixture = cancellationFixture({ auditError: new Error('audit insert failed') });
  const { app, routes } = routeApp();
  registerModuloClasesRoutes(app, baseDeps(fixture));
  const response = responseRecorder();

  await routes.get('DELETE /api/clases/inscripcion/:inscripcion_id')({ params: { inscripcion_id: '31' } }, response);

  assert.equal(response.statusCode, 500);
  assert.match(response.payload.error, /audit insert failed/);
  assert.equal(fixture.auditRows.length, 1);
  assert.equal(fixture.auditRows[0].sede_id, 7);
});
