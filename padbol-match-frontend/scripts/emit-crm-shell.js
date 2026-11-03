#!/usr/bin/env node
// Genera build/crm.html a partir del index.html YA compilado, para que las
// rutas de los assets sean las reales (el template crudo tiene %PUBLIC_URL%).
// /crm-leads se sirve con este shell, que declara el manifest de PADBOL CRM.
const fs = require('fs');
const path = require('path');
const build = path.join(__dirname, '..', 'build');
const src = path.join(build, 'index.html');
if (!fs.existsSync(src)) { console.error('[crm-shell] falta build/index.html'); process.exit(1); }
let html = fs.readFileSync(src, 'utf8');
html = html.replace(/<title>[^<]*<\/title>/, '<title>PADBOL CRM</title>');
if (/rel="manifest"/.test(html)) {
  html = html.replace(/<link[^>]+rel="manifest"[^>]*>/i, '<link rel="manifest" href="/crm-manifest.json">');
} else {
  html = html.replace('</head>', '  <link rel="manifest" href="/crm-manifest.json">\n</head>');
}
// Marca la app instalada como CRM: el login la usa para volver siempre aca.
html = html.replace('</head>', '<script>try{localStorage.setItem("padbol_crm_app","1")}catch(e){}</script>\n</head>');
fs.writeFileSync(path.join(build, 'crm.html'), html);
console.log('[crm-shell] build/crm.html generado');
