import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const serverSource = fs.readFileSync(path.join(here, '..', 'server.js'), 'utf8');

test('Chivi receives guarded public-landing knowledge', () => {
  assert.match(serverSource, /client_surface === 'public_landing'/);
  assert.match(serverSource, /PUBLIC LANDING MODE \(critical\)/);
  assert.match(serverSource, /does NOT provide accounting, tax or legal services/);
  assert.match(serverSource, /mobile apps are not yet publicly available/);
  assert.match(serverSource, /intelligent camera-vision referee is in training/);
});
