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

const codesSource = fs.readFileSync(path.join(root, 'src/constants/padbolLanguages.js'), 'utf8');
const codesBlock = codesSource.match(/export const PADBOL_LANGUAGES = \[([\s\S]*?)\];/)?.[1] || '';
const codes = [...codesBlock.matchAll(/code: '([^']+)'/g)].map((match) => match[1]);
const english = flatten(readJson('src/i18n/locales/en.json'));
const englishKeys = Object.keys(english);
const publicSite = readJson('src/i18n/publicSiteGeneratedLocales.json');
const nativeShared = readJson('src/i18n/nativeSharedLocaleOverrides.json');
const additional = evaluateExport('src/i18n/additionalLocaleOverrides.js', 'export const ADDITIONAL_LOCALE_OVERRIDES =');
const romanianEditorial = evaluateExport('src/i18n/romanianLocaleOverrides.js', 'export default');
const baseFiles = {
  de: 'de', es: 'es', en: 'en', ar: 'ar', fr: 'fr', it: 'it', ro: 'ro',
  'pt-BR': 'pt', 'pt-PT': 'pt',
};
const jsonLayers = {
  es: ['spanishPadcoinsCoreOverrides.json', 'spanishPadcoinsExperienceOverrides.json', 'spanishPolishOverrides.json'],
  ro: [
    'romanianGeneratedOverrides.json', 'romanianAdminOverrides.json', 'romanianOperationsOverrides.json',
    'romanianAdminLandingOverrides.json', 'romanianPadcoinsOverrides.json',
  ],
  cs: ['czechPolishOverrides.json'],
};

const directByCode = {};
const report = codes.map((code) => {
  const direct = {};
  Object.assign(direct, flatten(nativeShared[code] || {}));
  if (baseFiles[code]) Object.assign(direct, flatten(readJson(`src/i18n/locales/${baseFiles[code]}.json`)));
  if (publicSite[code]) Object.assign(direct, flatten({ publicSite: publicSite[code] }));
  Object.assign(direct, flatten(additional[code] || {}));
  for (const file of jsonLayers[code] || []) Object.assign(direct, flatten(readJson(`src/i18n/${file}`)));
  if (code === 'ro') {
    Object.assign(direct, flatten(romanianEditorial));
    Object.assign(direct, flatten(readJson('src/i18n/romanianEnglishLeakOverrides.json')));
    Object.assign(direct, flatten(readJson('src/i18n/romanianPolishOverrides.json')));
  }
  directByCode[code] = direct;
  const covered = englishKeys.filter((key) => Object.hasOwn(direct, key));
  return {
    code,
    covered: covered.length,
    total: englishKeys.length,
    missing: englishKeys.length - covered.length,
    identicalToEnglish: covered.filter((key) => direct[key] === english[key]).length,
  };
});

const dumpArgument = process.argv.find((argument) => argument.startsWith('--dump='));
const dumpCode = dumpArgument?.slice('--dump='.length);
if (dumpCode) {
  if (!directByCode[dumpCode]) throw new Error(`Unknown locale: ${dumpCode}`);
  console.log(JSON.stringify(directByCode[dumpCode], null, 2));
} else if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2));
else report.forEach(({ code, covered, total, missing, identicalToEnglish }) => {
  console.log(`${code}: ${covered}/${total} direct · ${missing} English fallbacks · ${identicalToEnglish} identical`);
});

if (process.argv.includes('--strict') && report.some(({ missing }) => missing > 0)) process.exitCode = 1;
