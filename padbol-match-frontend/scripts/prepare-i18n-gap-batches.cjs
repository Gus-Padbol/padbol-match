const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const flatten = (value, prefix = '', output = {}) => {
  Object.entries(value || {}).forEach(([key, child]) => {
    const itemPath = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object' && !Array.isArray(child)) flatten(child, itemPath, output);
    else output[itemPath] = String(child);
  });
  return output;
};
const evaluateExport = (file, marker) => {
  const context = {};
  const source = fs.readFileSync(path.join(root, file), 'utf8').replace(marker, 'globalThis.__catalog =');
  vm.runInNewContext(source, context, { filename: file });
  return context.__catalog;
};

const locale = process.argv[2];
const outputDirectory = process.argv[3];
const chunkSize = Number(process.argv[4] || 50);
if (!locale || !outputDirectory) {
  throw new Error('Usage: node prepare-i18n-gap-batches.cjs LOCALE OUTPUT_DIRECTORY [CHUNK_SIZE]');
}

const english = flatten(readJson('src/i18n/locales/en.json'));
const publicSite = readJson('src/i18n/publicSiteGeneratedLocales.json');
const nativeShared = readJson('src/i18n/nativeSharedLocaleOverrides.json');
const crossLocalePolish = readJson('src/i18n/crossLocalePolishOverrides.json');
const generatedGaps = readJson('src/i18n/generatedLocaleGapOverrides.json');
const additional = evaluateExport('src/i18n/additionalLocaleOverrides.js', 'export const ADDITIONAL_LOCALE_OVERRIDES =');
const baseFiles = {
  de: 'de', es: 'es', en: 'en', ar: 'ar', fr: 'fr', it: 'it', ro: 'ro',
  'pt-BR': 'pt', 'pt-PT': 'pt',
};

const direct = {};
Object.assign(direct, flatten(generatedGaps[locale] || {}));
Object.assign(direct, flatten(nativeShared[locale] || {}));
if (baseFiles[locale]) Object.assign(direct, flatten(readJson(`src/i18n/locales/${baseFiles[locale]}.json`)));
if (publicSite[locale]) Object.assign(direct, flatten({ publicSite: publicSite[locale] }));
Object.assign(direct, flatten(additional[locale] || {}));
Object.assign(direct, flatten(crossLocalePolish[locale] || {}));

const normalizeSportsEnglish = (text) => {
  const variables = [];
  const protectedText = text
    .replaceAll('Padbol Match', '[999990]')
    .replaceAll('PadCoins', '[999989]')
    .replaceAll('Padbol', '[999988]')
    .replace(/\{\{[^{}]+\}\}/g, (variable) => {
    const token = `[${900000 + variables.length}]`;
    variables.push(variable);
    return token;
    });
  const normalized = protectedText
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
  return normalized;
};

const shouldTranslateIdenticalEnglish = (text) => {
  if (text.length < 16 || /https?:|\bwww\.|@[A-Za-z0-9]|APP_USR|#[0-9A-F]{3,8}/i.test(text)) return false;
  const withoutProtectedNames = text
    .replace(/Padbol Match|PadCoins|Padbol|Court|Courts|Mercado Pago|Stripe|WhatsApp|Instagram|Facebook|YouTube|API/gi, ' ')
    .replace(/\{\{[^{}]+\}\}/g, ' ');
  return (withoutProtectedNames.match(/[A-Za-z]{3,}/g) || []).length >= 2;
};

const items = Object.entries(english)
  .filter(([key, text]) => !Object.hasOwn(direct, key)
    || (direct[key] === text && shouldTranslateIdenticalEnglish(text)))
  .map(([key, text]) => ({ key, text: normalizeSportsEnglish(text) }));

fs.mkdirSync(outputDirectory, { recursive: true });
fs.writeFileSync(
  path.join(outputDirectory, `${locale}-all.json`),
  `${JSON.stringify(items, null, 2)}\n`,
);
for (let offset = 0; offset < items.length; offset += chunkSize) {
  const number = String(Math.floor(offset / chunkSize) + 1).padStart(4, '0');
  fs.writeFileSync(
    path.join(outputDirectory, `${locale}-${number}.json`),
    `${JSON.stringify(items.slice(offset, offset + chunkSize), null, 2)}\n`,
  );
}
fs.writeFileSync(
  path.join(outputDirectory, `${locale}-manifest.json`),
  `${JSON.stringify({ locale, total: items.length, chunkSize, chunks: Math.ceil(items.length / chunkSize) }, null, 2)}\n`,
);
console.log(`${locale}: prepared ${items.length} strings in ${Math.ceil(items.length / chunkSize)} batches`);
