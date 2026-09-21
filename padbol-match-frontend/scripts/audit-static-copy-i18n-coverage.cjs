const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const generated = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/generatedStaticCopyLocales.json'), 'utf8'));
const languageSource = fs.readFileSync(path.join(root, 'src/constants/padbolLanguages.js'), 'utf8');
const languageBlock = languageSource.match(/export const PADBOL_LANGUAGES = \[([\s\S]*?)\];/)?.[1] || '';
const locales = [...languageBlock.matchAll(/code: '([^']+)'/g)].map((match) => match[1]);

const evaluateEnglishCopy = (file) => {
  let source = fs.readFileSync(path.join(root, file), 'utf8')
    .replace(/^import .*;\s*$/gm, '')
    .replace(/export function/g, 'function');
  source += '\nglobalThis.__englishCopy = EN;';
  const context = {};
  vm.runInNewContext(source, context, { filename: file });
  return context.__englishCopy;
};
const flatten = (value, prefix = '', output = {}) => {
  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, child]) => flatten(child, prefix ? `${prefix}.${key}` : key, output));
  } else output[prefix] = String(value);
  return output;
};

const sections = {
  venuePlans: {
    english: flatten(evaluateEnglishCopy('src/pages/adminLanding/venuePlansCopy.js')),
    human: new Set(['en', 'es', 'ro', 'cs', 'pt-BR', 'pt-PT', 'it', 'fr', 'de']),
  },
  commercialFlow: {
    english: flatten(evaluateEnglishCopy('src/pages/commercialFlowCopy.js')),
    human: new Set(['en', 'es', 'ro', 'cs']),
  },
};

let failed = false;
for (const locale of locales) {
  const summaries = [];
  for (const [section, definition] of Object.entries(sections)) {
    if (definition.human.has(locale)) {
      summaries.push(`${section}=human`);
      continue;
    }
    const translated = flatten(generated[locale]?.[section] || {});
    const missing = Object.keys(definition.english).filter((key) => !Object.hasOwn(translated, key));
    const extras = Object.keys(translated).filter((key) => !Object.hasOwn(definition.english, key));
    const markers = Object.values(translated).filter((value) => /ZXQ|\[9(?:0000\d|9999(?:8|9|0|1|2))\]/.test(value));
    if (missing.length || extras.length || markers.length) failed = true;
    summaries.push(`${section}=${Object.keys(translated).length}/${Object.keys(definition.english).length}`);
  }
  console.log(`${locale}: ${summaries.join(' · ')}`);
}

if (process.argv.includes('--strict') && failed) process.exitCode = 1;
