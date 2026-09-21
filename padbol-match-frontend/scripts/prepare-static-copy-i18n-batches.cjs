const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const locale = process.argv[2];
const outputDirectory = process.argv[3];
if (!locale || !outputDirectory) {
  throw new Error('Usage: node prepare-static-copy-i18n-batches.cjs LOCALE OUTPUT_DIRECTORY');
}

const evaluateEnglishCopy = (file) => {
  let source = fs.readFileSync(path.join(root, file), 'utf8')
    .replace(/^import .*;\s*$/gm, '')
    .replace(/export function/g, 'function');
  source += '\nglobalThis.__englishCopy = EN;';
  const context = {};
  vm.runInNewContext(source, context, { filename: file });
  return context.__englishCopy;
};

const flatten = (value, prefix, output = {}) => {
  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, child]) => flatten(child, `${prefix}.${key}`, output));
  } else output[prefix] = String(value);
  return output;
};

const protectedEnglish = (text) => text
  .replaceAll('Padbol Match', '[999990]')
  .replaceAll('PadCoins', '[999989]')
  .replaceAll('Padbol', '[999988]')
  .replace(/\bMatches\b/g, 'Games')
  .replace(/\bmatches\b/g, 'games')
  .replace(/\bMatch\b/g, 'Game')
  .replace(/\bmatch\b/g, 'game')
  .replace(/\bVenues\b/g, 'Sports clubs')
  .replace(/\bvenues\b/g, 'sports clubs')
  .replace(/\bVenue\b/g, 'Sports club')
  .replace(/\bvenue\b/g, 'sports club')
  .replace(/\bCourts\b/g, '[999992]')
  .replace(/\bcourts\b/g, '[999992]')
  .replace(/\bCourt\b/g, '[999991]')
  .replace(/\bcourt\b/g, '[999991]');

const existing = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/generatedStaticCopyLocales.json'), 'utf8'));
const venueHuman = new Set(['en', 'es', 'ro', 'cs', 'pt-BR', 'pt-PT', 'it', 'fr', 'de']);
const commercialHuman = new Set(['en', 'es', 'ro', 'cs']);
const sources = {};
if (!venueHuman.has(locale)) sources.venuePlans = evaluateEnglishCopy('src/pages/adminLanding/venuePlansCopy.js');
if (!commercialHuman.has(locale)) sources.commercialFlow = evaluateEnglishCopy('src/pages/commercialFlowCopy.js');

const existingFlat = flatten(existing[locale] || {}, locale);
const items = [];
Object.entries(sources).forEach(([section, copy]) => {
  Object.entries(flatten(copy, `${locale}.${section}`)).forEach(([fullKey, text]) => {
    if (Object.hasOwn(existingFlat, fullKey)) return;
    items.push({ key: fullKey.slice(locale.length + 1), text: protectedEnglish(text) });
  });
});

fs.mkdirSync(outputDirectory, { recursive: true });
fs.writeFileSync(path.join(outputDirectory, `${locale}-static-all.json`), `${JSON.stringify(items, null, 2)}\n`);
console.log(`${locale}: prepared ${items.length} static-copy strings`);
