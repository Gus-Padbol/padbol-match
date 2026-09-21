import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.resolve(
  here,
  '..',
  '..',
  'supabase',
  'migrations',
  '20260905203000_fipa_ranking_oficial_reclamable.sql',
);
const sql = fs.readFileSync(migrationPath, 'utf8');
const invitationsMigrationPath = path.resolve(
  here,
  '..',
  '..',
  'supabase',
  'migrations',
  '20260906150000_fipa_invitaciones_jugadores.sql',
);
const invitationsSql = fs.readFileSync(invitationsMigrationPath, 'utf8');

test('separa jugadores oficiales FIPA de las cuentas registradas', () => {
  assert.match(sql, /create table if not exists public\.fipa_jugadores_oficiales/i);
  assert.match(sql, /user_id uuid unique references auth\.users\(id\) on delete set null/i);
  assert.doesNotMatch(sql, /insert\s+into\s+auth\.users/i);
  assert.match(sql, /estado_vinculacion in \('no_reclamado', 'invitado', 'reclamacion_pendiente', 'vinculado'\)/i);
});

test('conserva instantáneas y una única publicación vigente', () => {
  assert.match(sql, /fipa_ranking_instantaneas/i);
  assert.match(sql, /fipa_ranking_entradas/i);
  assert.match(sql, /unique \(instantanea_id, jugador_fipa_id\)/i);
  assert.match(sql, /where vigente/i);
});

test('reclamaciones y resoluciones dejan auditoría obligatoria', () => {
  assert.match(sql, /fipa_jugador_reclamaciones/i);
  assert.match(sql, /fipa_jugador_vinculacion_auditoria/i);
  assert.match(sql, /La justificación es obligatoria/i);
  assert.match(sql, /revoke all on function public\.resolver_reclamacion_jugador_fipa/i);
  assert.match(sql, /grant execute on function public\.resolver_reclamacion_jugador_fipa[\s\S]*to service_role/i);
});

test('las invitaciones conservan contactos privados y no crean usuarios ficticios', () => {
  assert.match(invitationsSql, /create table if not exists public\.fipa_jugador_invitaciones/i);
  assert.match(invitationsSql, /token_hash text not null unique/i);
  assert.match(invitationsSql, /enable row level security/i);
  assert.doesNotMatch(invitationsSql, /create policy/i);
  assert.doesNotMatch(invitationsSql, /insert\s+into\s+auth\.users/i);
});

test('aceptar una invitación vincula y audita mediante service role', () => {
  assert.match(invitationsSql, /aceptar_invitacion_jugador_fipa/i);
  assert.match(invitationsSql, /aceptar_invitacion/i);
  assert.match(invitationsSql, /fipa_jugador_vinculacion_auditoria/i);
  assert.match(invitationsSql, /grant execute on function public\.aceptar_invitacion_jugador_fipa[\s\S]*to service_role/i);
});
