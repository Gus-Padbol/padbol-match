import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.resolve(
  here,
  '../../supabase/migrations/20260909143000_secure_mobile_push_delivery.sql',
);
const legacySqlPath = path.resolve(
  here,
  '../../padbol-match-frontend/sql/add_notificaciones_admin_log.sql',
);

test('la migración push deja tokens, preferencias y auditoría fuera de acceso cliente directo', async () => {
  const sql = await readFile(migrationPath, 'utf8');
  for (const table of [
    'push_tokens',
    'push_notification_preferences',
    'push_token_audit',
    'push_preference_audit',
    'push_delivery_jobs',
    'push_delivery_attempts',
    'notificaciones_admin_log',
  ]) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, 'i'));
    assert.match(sql, new RegExp(`revoke all on public\\.${table} from anon, authenticated`, 'i'));
  }
  assert.match(sql, /grant execute on function public\.register_mobile_push_token[\s\S]+to service_role/i);
  assert.match(sql, /grant execute on function public\.revoke_mobile_push_token[\s\S]+to service_role/i);
  assert.match(sql, /marketing_enabled boolean not null default false/i);
  assert.match(sql, /idempotency_key text not null unique/i);
  assert.match(sql, /push_tokens_expo_token_uidx/i);
  assert.match(
    sql,
    /foreign key \(user_id\) references auth\.users\(id\) on delete cascade not valid/i,
  );
  assert.equal(
    (sql.match(/v_token text := trim\(coalesce\(p_token, ''\)\);/g) || []).length,
    1,
    'la función de registro debe declarar v_token una sola vez',
  );
});

test('la receta SQL anterior falla cerrada y remite a la migración canónica', async () => {
  const sql = await readFile(legacySqlPath, 'utf8');
  assert.match(sql, /DEPRECADO: no ejecutar/i);
  assert.match(sql, /20260909143000_secure_mobile_push_delivery\.sql/i);
  assert.match(sql, /raise exception/i);
  assert.doesNotMatch(sql, /create table if not exists push_tokens/i);
});
