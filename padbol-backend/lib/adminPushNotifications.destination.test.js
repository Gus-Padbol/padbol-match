import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertAdminPushRateLimit,
  buildAdminPushDestinationData,
  getAdminPushQuota,
  parseAdminPushDestination,
  validateAdminPushDestination,
} from './adminPushNotifications.js';
import { createMobilePushService, sanitizePushData } from './mobilePushNotifications.js';

test('destino torneo genera solamente navegación nativa segura', () => {
  assert.deepEqual(parseAdminPushDestination({ type: 'torneo', torneoId: 42 }), {
    type: 'torneo', entityId: '42', torneoId: '42', label: 'Torneo #42', nativeScreen: 'TorneoDetalle',
  });
  assert.throws(() => parseAdminPushDestination({ type: 'url', entityId: 'https://evil.test' }), /no permitido/);
  assert.throws(() => parseAdminPushDestination({ type: 'torneo', torneoId: '../admin' }), /válido/);
  assert.throws(() => parseAdminPushDestination(), (error) => error?.code === 'ADMIN_PUSH_DESTINATION_REQUIRED');
});

test('pantallas internas y Academy usan únicamente rutas de catálogo', () => {
  assert.equal(parseAdminPushDestination({ type: 'academy' }).nativeScreen, 'Clases');
  assert.equal(parseAdminPushDestination({ type: 'pantalla', screen: 'notificaciones' }).nativeScreen, 'Notificaciones');
  assert.throws(
    () => parseAdminPushDestination({ type: 'pantalla', screen: '../admin' }),
    (error) => error?.code === 'ADMIN_PUSH_DESTINATION_INVALID',
  );
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

test('el envío individual no consume ni queda bloqueado por el cupo de campañas', async () => {
  const chain = {
    select() { return this; }, eq() { return this; }, gte() { return Promise.resolve({ data: [{ id: 1 }, { id: 2 }, { id: 3 }], error: null }); },
  };
  const supabase = { from() { return chain; } };
  await assert.doesNotReject(
    assertAdminPushRateLimit(supabase, { rol: 'admin_club', authUserId: 'club-1' }, { type: 'jugador' }),
  );
  const quota = await getAdminPushQuota(supabase, { rol: 'admin_club', authUserId: 'club-1' });
  assert.equal(quota.unlimitedTargeted, true);
});

test('valida existencia y genera datos nativos sólo para destinos permitidos', async () => {
  const supabase = {
    from(table) {
      return {
        select() { return this; },
        eq(_column, id) { this.id = id; return this; },
        limit() { return this; },
        maybeSingle() {
          const rows = {
            partidos: this.id === '9' ? { id: 9 } : null,
            news_articles: this.id === 'news-1' ? { id: 'news-1', slug: 'gran-final', status: 'published' } : null,
            ng_crm_eventos: this.id === 'session-1' ? { session_id: 'session-1' } : null,
          };
          return Promise.resolve({ data: rows[table] || null, error: null });
        },
      };
    },
  };
  const destination = await validateAdminPushDestination(supabase, { type: 'partido', entityId: 9 });
  assert.deepEqual(buildAdminPushDestinationData(destination), {
    type: 'admin_message', route: 'PartidoDetalle', params: { partidoId: '9' }, destination,
  });
  const news = await validateAdminPushDestination(supabase, { type: 'noticia', entityId: 'news-1' });
  assert.equal(news.nativeScreen, 'Notificaciones');
  const nextGeneration = await validateAdminPushDestination(supabase, { type: 'next_generation', entityId: 'session-1' });
  assert.equal(nextGeneration.nativeScreen, 'NextGenerationRegistration');
  assert.throws(() => buildAdminPushDestinationData(), (error) => error?.code === 'ADMIN_PUSH_DESTINATION_REQUIRED');
});

test('builder administrativo atraviesa dispatch y registra el job sin contactar Expo', async () => {
  let networkCalls = 0;
  let loggedPayload = null;
  const destination = parseAdminPushDestination({ type: 'pantalla', screen: 'notificaciones' });
  const built = buildAdminPushDestinationData(destination);
  assert.deepEqual(sanitizePushData(built).destination, {
    type: 'pantalla', entityId: 'notificaciones', screen: 'notificaciones', nativeScreen: 'Notificaciones',
  });
  const supabaseAdmin = {
    from(table) {
      if (table === 'push_delivery_jobs') {
        return {
          insert(row) {
            loggedPayload = row.payload;
            return { select: () => ({ single: async () => ({ data: { id: 'job-admin-1', ...row }, error: null }) }) };
          },
          update() { return { eq: async () => ({ error: null }) }; },
        };
      }
      if (table === 'push_tokens') {
        return {
          select() { return this; }, in() { return this; }, eq() { return this; }, is() { return this; },
          range: async () => ({ data: [], error: null }),
        };
      }
      if (table === 'push_notification_preferences') {
        return { select() { return this; }, in: async () => ({ data: [], error: null }) };
      }
      throw new Error(`tabla inesperada: ${table}`);
    },
  };
  const service = createMobilePushService({
    serviceRoleConfigured: true,
    supabaseAdmin,
    fetchImpl: async () => { networkCalls += 1; throw new Error('no debe contactar Expo'); },
  });
  const result = await service.dispatch({
    idempotencyKey: 'admin:admin-1:1234567890abcdef',
    userIds: ['player-1'],
    title: 'Novedad',
    body: 'Revisa tus notificaciones.',
    category: 'marketing',
    data: built,
    source: 'admin_panel',
    actorUserId: 'admin-1',
  });
  assert.equal(result.status, 'no_tokens');
  assert.equal(loggedPayload.type, 'admin_message');
  assert.equal(loggedPayload.destination.nativeScreen, 'Notificaciones');
  assert.equal(networkCalls, 0);
});
