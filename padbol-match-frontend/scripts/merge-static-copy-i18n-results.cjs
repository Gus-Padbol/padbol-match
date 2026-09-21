const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const locale = process.argv[2];
const resultFile = process.argv[3];
if (!locale || !resultFile) {
  throw new Error('Usage: node merge-static-copy-i18n-results.cjs LOCALE RESULT_FILE');
}

const outputFile = path.join(root, 'src/i18n/generatedStaticCopyLocales.json');
const catalog = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
const localeCopy = catalog[locale] || {};
const results = JSON.parse(fs.readFileSync(resultFile, 'utf8'));
const markerPattern = /\[(?:90000\d|9999(?:88|89|90|91|92))\]/g;

const assignPath = (rootObject, dottedPath, value) => {
  const segments = dottedPath.split('.');
  let cursor = rootObject;
  segments.forEach((segment, index) => {
    const last = index === segments.length - 1;
    if (last) cursor[segment] = value;
    else {
      const nextIsIndex = /^\d+$/.test(segments[index + 1]);
      cursor = cursor[segment] ||= nextIsIndex ? [] : {};
    }
  });
};

let merged = 0;
for (const item of results) {
  const required = item.source.match(markerPattern) || [];
  if (required.some((marker) => !item.translation.includes(marker))) {
    throw new Error(`Altered protected marker ${locale}:${item.key}`);
  }
  const translation = item.translation
    .replaceAll('[999992]', 'Courts')
    .replaceAll('[999991]', 'Court')
    .replaceAll('[999990]', 'Padbol Match')
    .replaceAll('[999989]', 'PadCoins')
    .replaceAll('[999988]', 'Padbol');
  if (/ZXQ|\[9(?:0000\d|9999(?:8|9|0|1|2))\]/.test(translation)) {
    throw new Error(`Unresolved protected marker ${locale}:${item.key}`);
  }
  assignPath(localeCopy, item.key, translation);
  merged += 1;
}

catalog[locale] = localeCopy;
fs.writeFileSync(outputFile, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`${locale}: merged ${merged} static-copy translations`);
