const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const locale = process.argv[2];
const resultsDirectory = process.argv[3];
if (!locale || !resultsDirectory) {
  throw new Error('Usage: node merge-i18n-gap-results.cjs LOCALE RESULTS_DIRECTORY');
}

const outputFile = path.join(root, 'src/i18n/generatedLocaleGapOverrides.json');
const catalog = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
const flatten = (value, prefix = '', output = {}) => {
  Object.entries(value || {}).forEach(([key, child]) => {
    const itemPath = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object' && !Array.isArray(child)) flatten(child, itemPath, output);
    else output[itemPath] = String(child);
  });
  return output;
};
const english = flatten(JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/en.json'), 'utf8')));
const flat = {};
let skipped = 0;
const resultFiles = fs.readdirSync(resultsDirectory)
  .filter((name) => name.startsWith(`${locale}-`) && name.endsWith('-translated.json'))
  .sort();

for (const file of resultFiles) {
  const results = JSON.parse(fs.readFileSync(path.join(resultsDirectory, file), 'utf8'));
  for (const item of results) {
    const requiredMarkers = item.source.match(/\[(?:90000\d|9999(?:88|89|90|91|92))\]/g) || [];
    if (requiredMarkers.some((marker) => !item.translation.includes(marker))) {
      skipped += 1;
      console.warn(`Skipped altered marker ${locale}:${item.key}`);
      continue;
    }
    const originalSource = english[item.key];
    if (typeof originalSource !== 'string') throw new Error(`Unknown English key ${item.key}`);
    const originalVariables = [...originalSource.matchAll(/\{\{[^{}]+\}\}/g)].map((match) => match[0]);
    let translation = item.translation
      .replaceAll('ZXQCOURTSZXQ', 'Courts')
      .replaceAll('ZXQCOURTZXQ', 'Court')
      .replaceAll('[999992]', 'Courts')
      .replaceAll('[999991]', 'Court')
      .replaceAll('[999990]', 'Padbol Match')
      .replaceAll('[999989]', 'PadCoins')
      .replaceAll('[999988]', 'Padbol');
    originalVariables.forEach((variable, index) => {
      translation = translation
        .replaceAll(`ZXQVARIABLE${index}ZXQ`, variable)
        .replaceAll(`[${900000 + index}]`, variable);
    });
    const sourceVariables = [...originalSource.matchAll(/\{\{[^{}]+\}\}/g)].map((match) => match[0]).sort();
    const targetVariables = [...translation.matchAll(/\{\{[^{}]+\}\}/g)].map((match) => match[0]).sort();
    if (JSON.stringify(sourceVariables) !== JSON.stringify(targetVariables)) {
      skipped += 1;
      console.warn(`Skipped variable mismatch ${locale}:${item.key}`);
      continue;
    }
    if (/ZXQ|\[9(?:0000\d|9999(?:8|9|0|1|2))\]/.test(translation)) {
      skipped += 1;
      console.warn(`Skipped unresolved marker ${locale}:${item.key}`);
      continue;
    }
    flat[item.key] = translation;
  }
}

const unflatten = (entries) => {
  const output = {};
  Object.entries(entries).forEach(([key, value]) => {
    const segments = key.split('.');
    let cursor = output;
    segments.forEach((segment, index) => {
      if (index === segments.length - 1) cursor[segment] = value;
      else cursor = cursor[segment] ||= {};
    });
  });
  return output;
};

catalog[locale] = unflatten({
  ...flatten(catalog[locale] || {}),
  ...flat,
});
fs.writeFileSync(outputFile, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`${locale}: merged ${Object.keys(flat).length} translations from ${resultFiles.length} batches · skipped ${skipped}`);
