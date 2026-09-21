import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(here, '..');
const repositoryRoot = path.resolve(backendRoot, '..');
const routeSource = fs.readFileSync(path.join(backendRoot, 'routes/scoreboard.js'), 'utf8');
const joinSource = fs.readFileSync(
  path.join(repositoryRoot, 'padbol-match-frontend/src/pages/ScoreboardJoin.jsx'),
  'utf8',
);

test('el QR sólo ocupa lugares libres y nunca confía en el user_id enviado', () => {
  assert.match(routeSource, /const userId = auth\.user\?\.id \|\| null/);
  assert.match(routeSource, /if \(!canReplace\)[\s\S]*status\(409\)/);
  assert.doesNotMatch(routeSource, /\.upsert\(row, \{ onConflict: 'partido_id,equipo,slot' \}\)/);
  assert.match(joinSource, /postJugadorTemp\([\s\S]*session\?\.access_token\)/);
});
