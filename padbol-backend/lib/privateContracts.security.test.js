import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(here, '..');
const repositoryRoot = path.resolve(backendRoot, '..');
const serverSource = fs.readFileSync(path.join(backendRoot, 'server.js'), 'utf8');
const migration = fs.readFileSync(
  path.join(repositoryRoot, 'supabase/migrations/20260921170000_private_contract_documents.sql'),
  'utf8',
);

test('los contratos se almacenan en bucket privado y sólo se entregan con URL firmada breve', () => {
  assert.match(migration, /insert into storage\.buckets[\s\S]*values \('contratos', 'contratos', false\)[\s\S]*set public = false/i);
  assert.match(migration, /revoke all on table public\.contratos_sedes from anon, authenticated/i);
  assert.match(migration, /create policy contratos_backend_only[\s\S]*as restrictive[\s\S]*to anon, authenticated/i);
  assert.match(serverSource, /supabaseAdmin\.from\('contratos_sedes'\)\.insert/);
  assert.match(serverSource, /supabaseAdmin\.from\('contratos_sedes'\)\.select/);
  assert.match(serverSource, /supabaseAdmin\.storage\.from\('contratos'\)\.upload/);
  assert.match(serverSource, /\.from\('contratos'\)[\s\S]*\.createSignedUrl\(storagePath, 300/);
  assert.doesNotMatch(serverSource, /supabase\.storage\.from\('contratos'\)\.getPublicUrl/);
});
