import test from 'node:test';
import assert from 'node:assert/strict';

import {
  assertAdminPushRateLimit,
  buildAdminPushDestinationData,
  getAdminPushQuota,
  parseAdminPushDestination,
} from './adminPushNotifications.js';

test('super_admin is unlimited and does not query or consume weekly quota', async () => {
  const neverQuery = new Proxy({}, {
    get() { throw new Error('super_admin quota must not query the database'); },
  });
  const scope = { superA: true, rol: 'super_admin', authUserId: 'qa-super' };
  const quota = await getAdminPushQuota(neverQuery, scope);
  assert.equal(quota.unlimited, true);
  assert.equal(quota.limit, null);
  assert.equal(quota.remaining, null);
  await assertAdminPushRateLimit(neverQuery, scope, { type: 'todos_usuarios' });
});

test('lower roles keep the configured weekly limits', async () => {
  const rows = [{ id: 1, segmento: { type: 'sede' } }];
  const terminal = { then(resolve) { return Promise.resolve(resolve({ data: rows, error: null })); } };
  const chain = new Proxy(terminal, {
    get(target, prop) {
      if (prop === 'then') return target.then.bind(target);
      return () => chain;
    },
  });
  const supabase = { from: () => chain };
  const quota = await getAdminPushQuota(supabase, { rol: 'admin_club', authUserId: 'qa-club' });
  assert.equal(quota.unlimited, undefined);
  assert.equal(quota.limit, 3);
  assert.equal(quota.used, 1);
  assert.equal(quota.remaining, 2);
});

test('push requires a concrete safe destination and builds navigation data', () => {
  assert.throws(() => parseAdminPushDestination({}), /destino concreto/i);
  assert.throws(
    () => parseAdminPushDestination({ type: 'pantalla', entityId: 'https://evil.example' }),
    /pantalla.*válid/i,
  );
  const destination = parseAdminPushDestination({ type: 'pantalla', entityId: 'rankings' });
  assert.equal(destination.nativeScreen, 'Rankings');
  assert.equal(buildAdminPushDestinationData(destination).route, 'Rankings');
});
