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

test('pantallas internas y Academy usan únicamente rutas de catálogo', () => {
  assert.equal(parseAdminPushDestination({ type: 'academy' }).deepLink, '/academy');
  assert.equal(parseAdminPushDestination({ type: 'pantalla', screen: 'notificaciones' }).deepLink, '/notificaciones');
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
    type: 'partido', partidoId: '9', deepLink: '/partido/9', destination,
  });
  const news = await validateAdminPushDestination(supabase, { type: 'noticia', entityId: 'news-1' });
  assert.equal(news.deepLink, '/noticias/gran-final');
  const nextGeneration = await validateAdminPushDestination(supabase, { type: 'next_generation', entityId: 'session-1' });
  assert.equal(nextGeneration.deepLink, '/next-generation/jornada?session_id=session-1');
  assert.throws(() => buildAdminPushDestinationData(), (error) => error?.code === 'ADMIN_PUSH_DESTINATION_REQUIRED');
});
