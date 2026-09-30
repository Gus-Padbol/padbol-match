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
  assert.throws(() => parseAdminPushDestination(), (error) => error?.code === 'ADMIN_PUSH_DESTINATION_REQUIRED');
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
        maybeSingle() {
          const rows = {
            partidos: this.id === '9' ? { id: 9 } : null,
            ng_inscripciones: this.id === 'reg-1' ? { id: 'reg-1', sesion_id: 'session-1' } : null,
            ng_crm_eventos: this.id === 'nextgen:event-1' ? { event_id: 'nextgen:event-1', session_id: 'session-1', registration_id: 'reg-1' } : null,
          };
          return Promise.resolve({ data: rows[table] || null, error: null });
        },
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
  const registration = await validateAdminPushDestination(supabase, { type: 'inscripcion', entityId: 'reg-1' });
  assert.equal(registration.deepLink, '/next-generation/jornada?session_id=session-1&registration_id=reg-1');
  const form = await validateAdminPushDestination(supabase, { type: 'formulario', entityId: 'nextgen:event-1' });
  assert.equal(form.deepLink, '/next-generation/jornada?session_id=session-1&registration_id=reg-1&crm_event_id=nextgen%3Aevent-1');
  assert.throws(() => buildAdminPushDestinationData(), (error) => error?.code === 'ADMIN_PUSH_DESTINATION_REQUIRED');
});
