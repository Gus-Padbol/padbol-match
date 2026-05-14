#!/usr/bin/env node
/**
 * Genera `public/sw.js` desde la plantilla y `src/pwaBuildId.js` con el mismo id
 * (timestamp) para bust de caché del script del SW y del precache.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const tplPath = path.join(__dirname, 'pwa-sw.template.js');
const swOut = path.join(root, 'public', 'sw.js');
const metaOut = path.join(root, 'src', 'pwaBuildId.js');

const id = `pwa-${Date.now()}`;

if (!fs.existsSync(tplPath)) {
  console.error('[emit-pwa-build-id] Falta la plantilla:', tplPath);
  process.exit(1);
}

let tpl = fs.readFileSync(tplPath, 'utf8');
if (!tpl.includes('%%PWA_BUILD_ID%%')) {
  console.error('[emit-pwa-build-id] La plantilla debe contener %%PWA_BUILD_ID%%');
  process.exit(1);
}

tpl = tpl.replace(/%%PWA_BUILD_ID%%/g, id);
fs.writeFileSync(swOut, tpl, 'utf8');
fs.writeFileSync(
  metaOut,
  `/* Auto-generado por scripts/emit-pwa-build-id.js (prebuild/prestart) — no editar a mano */\nexport const PWA_BUILD_ID = ${JSON.stringify(id)};\n`,
  'utf8'
);
console.log('[emit-pwa-build-id]', id);
