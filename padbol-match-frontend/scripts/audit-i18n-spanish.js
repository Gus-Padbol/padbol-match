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

/** Nombres técnicos / deportes en inglés que no son UI traducible. */
const TECHNICAL_LITERALS = new Set([
  'round robin',
  'knockout',
  'grupos + knockout',
  'mercadopago',
  'stripe',
  'supabase',
  'delete',
  'enter',
  'yyyy-mm-dd',
  'app_usr-...',
  'acct_...',
  'acct_…',
  'plan_pricing.sql',
  'es-ar',
  'en-us',
]);

const SKIP_LINE = [
  /^\s*\/\//,
  /^\s*\*/,
  /console\./,
  /import\s/,
  /from\s+['"]/,
  /t\s*\(\s*['"`]/,
  /tSafe/,
  /tr\s*\(/,
  /defaultValue:/,
  /\/\*.*\*\//,
  /eslint/,
  /@type/,
  /padbol-backend/,
  /supabase/,
  /\.css['"]/,
  /className\s*=/,
  /className:/,
  /admin-[a-z0-9_-]+/i,
  /sede-admin-/i,
  /reservas-table/i,
  /ingreso-fila/i,
  /card\s+(reservas|torneos|ingresos)/i,
  /#[0-9a-f]{3,8}/i,
  /rgba?\(/,
  /https?:\/\//,
  /user_metadata/,
  /nombre_saludo/,
  /inscripcion_estado/,
  /fecha_inicio/,
  /\/api\//,
  /\/admin\//,
  /\/torneo\//,
  /\/public\//,
  /method:\s*['"]/i,
  /aria-label=\{t\(/,
  /placeholder=\{t\(/,
  /title=\{t\(/,
];

/**
 * Falsos positivos: clases CSS, medidas, fragmentos de código, IDs técnicos.
 */
function isFalsePositive(text, rawLine = '') {
  const s = String(text || '').trim();
  if (!s || s.length < 3) return true;

  const lower = s.toLowerCase();

  if (TECHNICAL_LITERALS.has(lower)) return true;

  // Solo código / identificadores
  if (/^[a-z0-9_.$/\-{}[\]()]+$/i.test(s) && !/[áéíóúñ¿¡]/i.test(s)) return true;
  if (/^\$\{/.test(s)) return true;
  if (/^var\(/.test(s)) return true;
  if (/^[#%0-9.\s,;:]+$/.test(s)) return true;
  if (/^\d+(\.\d+)?(px|em|rem|%|vh|vw|ms|s|dvh)?$/i.test(s)) return true;
  if (/^\d+\s*\/\s*-?\d+$/.test(s)) return true;
  if (/^\d+px\s+\d+px$/i.test(s)) return true;

  // Medidas sueltas o listas de medidas
  if (/^[\dpxemrem%\s./-]+$/i.test(s) && /\d/.test(s)) return true;

  // Clases CSS (admin-*, guiones, sin espacios naturales de frase)
  if (/^(admin|sede|reserva|hub|lang|card|section|ingreso|sedes)-[a-z0-9_-]+$/i.test(s)) return true;
  if (/^[a-z]+(-[a-z0-9_]+){2,}$/i.test(s) && !/\s/.test(s) && !/[áéíóúñ¿¡?]/.test(s)) return true;
  if (/__/.test(s) && !/\s/.test(s)) return true;

  // Fragmentos JSX / expresiones
  if (/^\)\.?\s*(trim|toLowerCase|includes|slice)/.test(s)) return true;
  if (/^[)?.\s]*(trim|toLowerCase|includes)/.test(s)) return true;
  if (/^\}\s*·/.test(s)) return true;
  if (/^\?\s*String/.test(s)) return true;
  if (/^[=<>!]+\s*/.test(s)) return true;
  if (/^\|\|/.test(s)) return true;
  if (/^\)\s*\|\|/.test(s)) return true;
  if (/inscripto\{/.test(s)) return true;
  if (/equipos_count/.test(s)) return true;
  if (/sedes-admin-/.test(lower)) return true;

  // País en mapas de normalización (datos, no UI)
  if (lower === 'españa' || lower === 'estados unidos' || lower === 'estados unidos de america') return true;

  // Línea mayormente código
  if (rawLine && /className|style=\{|onClick=\{|fetch\(|await |const |let |return /.test(rawLine)) {
    if (!/[áéíóúñ¿¡]/.test(s) && s.length < 40 && !/\s{2,}/.test(s)) {
      if (!/^(no hay|sin |selecciona|guardar|eliminar|editar|crear|distribución|invitado|obligatorio)/i.test(s)) {
        return true;
      }
    }
  }

  // String muy corto sin español claro
  if (s.length <= 4 && !/[áéíóúñ¿¡]/i.test(s)) return true;

  // Solo emoji + palabra técnica inglesa
  if (/^[✅⚠️🟢🟡💾🔗📱⚽🔐✉️🌍📝💰]?\s*(guardar|enter|delete)$/i.test(s)) return true;

  return false;
}

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
      if (!/\b(Selecciona|Ingresa|Guardar|Cancelar|Error|Cargando|Reserva|Torneo|Sede|Club|Confirmar|Eliminar|Buscar|Volver|Aceptar|Rechazar|Aprobar|Notificaci|Distribución|Invitado|obligatorio|Franja|Licencia|Recortar|Magic)\b/i.test(line)) {
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
        if (isFalsePositive(s, line)) continue;
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
