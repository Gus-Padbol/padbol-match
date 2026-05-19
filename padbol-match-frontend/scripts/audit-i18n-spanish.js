#!/usr/bin/env node
/**
 * Audita strings en español probablemente hardcodeados en JSX/JS.
 * Uso: node scripts/audit-i18n-spanish.js [glob paths...]
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'src');

const DEFAULT_GLOBS = [
  'pages/AdminDashboard.jsx',
  'pages/ReservaForm.jsx',
  'pages/MiPerfil.jsx',
  'components/ChatbotIA.jsx',
  'components/Admin*.jsx',
];

const SPANISH_MARKERS = /[áéíóúñÁÉÍÓÚÑ¿¡]|(\b(el|la|los|las|de|del|para|con|sin|que|por|una|uno|está|están|todos|todas|guardar|cancelar|selecciona|ingresa|error|aviso|confirmar|volver|cargando|buscar|torneo|reserva|sede|club|jugador|equipo|cancha|inscripción|notificación)\b)/i;

const SKIP_LINE = [
  /^\s*\/\//,
  /^\s*\*/,
  /console\./,
  /import\s/,
  /from\s+['"]/,
  /t\s*\(\s*['"`]/,
  /tSafe/,
  /defaultValue:/,
  /\/\*.*\*\//,
  /eslint/,
  /@type/,
  /padbol-backend/,
  /supabase/,
  /\.css['"]/,
  /#[0-9a-f]{3,8}/i,
  /rgba?\(/,
  /https?:\/\//,
  /user_metadata/,
  /nombre_saludo/,
  /inscripcion_estado/,
  /fecha_inicio/,
];

function expandGlob(rel) {
  if (!rel.includes('*')) {
    const p = path.join(ROOT, rel);
    return fs.existsSync(p) ? [p] : [];
  }
  const dir = path.dirname(rel);
  const base = path.basename(rel).replace(/\*/g, '.*');
  const re = new RegExp(`^${base}$`);
  const fullDir = path.join(ROOT, dir);
  if (!fs.existsSync(fullDir)) return [];
  return fs.readdirSync(fullDir).filter((f) => re.test(f)).map((f) => path.join(fullDir, f));
}

function extractStrings(content) {
  const found = [];
  const patterns = [
    />([^<{][^<]*[áéíóúñÁÉÍÓÚÑ¿¡][^<]*)</g,
    /['"`]([^'"`\\]*(?:\\.[^'"`\\]*)*[áéíóúñÁÉÍÓÚÑ¿¡][^'"`\\]*)['"`]/g,
    /['"`]([^'"`\\]{4,}(?:\\.[^'"`\\]*)*)['"`]/g,
  ];

  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (SKIP_LINE.some((re) => re.test(line))) return;
    if (!SPANISH_MARKERS.test(line) && !/[áéíóúñ¿¡]/.test(line)) {
      if (!/\b(Selecciona|Ingresa|Guardar|Cancelar|Error|Cargando|Reserva|Torneo|Sede|Club|Confirmar|Eliminar|Buscar|Volver|Aceptar|Rechazar|Aprobar|Notificaci)/i.test(line)) {
        return;
      }
    }
    for (const re of patterns) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(line)) !== null) {
        const s = m[1].trim();
        if (s.length < 3 || s.length > 200) continue;
        if (/^[a-z_]+$/.test(s)) continue;
        if (/^\$\{/.test(s)) continue;
        if (/^var\(/.test(s)) continue;
        if (/^[#%0-9.\s]+$/.test(s)) continue;
        if (s.includes('${')) continue;
        found.push({ line: idx + 1, text: s, raw: line.trim().slice(0, 120) });
      }
    }
  });
  return found;
}

function main() {
  const args = process.argv.slice(2);
  const rels = args.length ? args : DEFAULT_GLOBS;
  const files = [...new Set(rels.flatMap(expandGlob))].sort();

  const byFile = {};
  let total = 0;
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const hits = extractStrings(content);
    const uniq = [];
    const seen = new Set();
    for (const h of hits) {
      const k = h.text;
      if (seen.has(k)) continue;
      seen.add(k);
      uniq.push(h);
    }
    if (uniq.length) {
      byFile[path.relative(path.join(ROOT, '..'), file)] = uniq;
      total += uniq.length;
    }
  }

  console.log(JSON.stringify({ total, files: Object.keys(byFile).length, byFile }, null, 2));
}

main();
