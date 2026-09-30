import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertAdminPushRateLimit,
  buildAdminPushDestinationData,
  getAdminPushQuota,
  parseAdminPushDestination,
  validateAdminPushDestination,
} from './adminPushNotifications.js';

test('destino torneo genera solamente un deep link interno seguro', () => {
  assert.deepEqual(parseAdminPushDestination({ type: 'torneo', torneoId: 42 }), {
    type: 'torneo', entityId: '42', torneoId: '42', label: 'Torneo #42', deepLink: '/torneo/42',
  });
  assert.throws(() => parseAdminPushDestination({ type: 'url', entityId: 'https://evil.test' }), /no permitido/);
  assert.throws(() => parseAdminPushDestination({ type: 'torneo', torneoId: '../admin' }), /válido/);
});

test('super_admin no consulta ni aplica cuota semanal', async () => {
  const supabase = { from() { throw new Error('no debe consultar la base'); } };
  const scope = { superA: true, rol: 'super_admin', authUserId: 'sa-1' };
  const quota = await getAdminPushQuota(supabase, scope);
  assert.equal(quota.unlimited, true);
  assert.equal(quota.limit, null);
  await assertAdminPushRateLimit(supabase, scope, { type: 'todos_usuarios' });
});

test('admin_club conserva límite semanal', async () => {
  const chain = {
    select() { return this; }, eq() { return this; }, gte() { return Promise.resolve({ data: [{ id: 1 }, { id: 2 }, { id: 3 }], error: null }); },
  };
  const supabase = { from() { return chain; } };
  await assert.rejects(
    assertAdminPushRateLimit(supabase, { rol: 'admin_club', authUserId: 'club-1' }, { type: 'sede_mia' }),
    (error) => error?.status === 429,
  );
});

test('valida existencia y genera datos nativos sólo para destinos permitidos', async () => {
  const supabase = {
    from(table) {
      return {
        select() { return this; },
        eq(_column, id) { this.id = id; return this; },
        maybeSingle() { return Promise.resolve({ data: table === 'partidos' && this.id === '9' ? { id: 9 } : null, error: null }); },
      };
    },
  };
  const destination = await validateAdminPushDestination(supabase, { type: 'partido', entityId: 9 });
  assert.deepEqual(buildAdminPushDestinationData(destination), {
    type: 'partido', partidoId: '9', deepLink: '/partido/9', destination,
  });
  await assert.rejects(
    validateAdminPushDestination(supabase, { type: 'reserva', entityId: 404 }),
    (error) => error?.code === 'ADMIN_PUSH_DESTINATION_NOT_FOUND',
  );
  assert.deepEqual(buildAdminPushDestinationData(parseAdminPushDestination()), {
    type: 'admin_message', route: 'Notificaciones', deepLink: '/notificaciones', destination: { type: 'none' },
  });
});
