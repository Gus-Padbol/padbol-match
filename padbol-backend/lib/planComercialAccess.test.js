import test from 'node:test';
import assert from 'node:assert/strict';
import { createCheckSuscripcionActiva } from '../suscripciones/checkSuscripcionActiva.js';
import { checkMorasSedes } from '../suscripciones/checkMorasSedes.js';

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test('Starter conserva las operaciones base aunque exista un estado de mora anterior', async () => {
  const supabase = {
    from(table) {
      assert.equal(table, 'sedes');
      return {
        select() { return this; },
        eq() { return this; },
        async maybeSingle() {
          return { data: { id: 7, plan_comercial: 'starter', suscripcion_estado: 'cancelado' }, error: null };
        },
      };
    },
  };
  let continued = false;
  const middleware = createCheckSuscripcionActiva({
    supabase,
    authUserFromBearer: async () => ({ email: 'club@example.com' }),
    fetchUserRoleRow: async () => ({ role: 'admin_sede' }),
    isSuperAdminApi: () => false,
  });
  const res = responseRecorder();

  await middleware(
    { originalUrl: '/api/torneos', method: 'POST', body: { sede_id: 7 } },
    res,
    () => { continued = true; },
  );

  assert.equal(continued, true);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body, null);
});

test('Starter no entra en mora ni recibe avisos de deuda', async () => {
  let queriedBenefits = false;
  let updated = false;
  let messages = 0;
  const rows = [{
    id: 8,
    nombre: 'Club Starter',
    telefono: '+54911',
    suscripcion_estado: 'beneficio',
    suscripcion_proximo_cobro: '2026-08-01T00:00:00.000Z',
    metodo_pago: 'mercadopago',
    plan_comercial: 'starter',
  }];
  const supabase = {
    from(table) {
      if (table === 'sedes') {
        return {
          select() { return this; },
          not() { return this; },
          lt: async () => ({ data: rows, error: null }),
          update() { updated = true; return this; },
          eq: async () => ({ error: null }),
        };
      }
      queriedBenefits = true;
      throw new Error('Starter no debería consultar beneficios de pago');
    },
  };

  const result = await checkMorasSedes({
    supabase,
    sendWhatsApp: async () => { messages += 1; },
    now: new Date('2026-09-04T12:00:00.000Z'),
  });

  assert.deepEqual(result, { ok: true, actualizados: 0 });
  assert.equal(queriedBenefits, false);
  assert.equal(updated, false);
  assert.equal(messages, 0);
});
