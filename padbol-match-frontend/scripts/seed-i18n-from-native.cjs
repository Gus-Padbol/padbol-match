const fs = require('fs');
const path = require('path');
const vm = require('vm');

const webRoot = path.resolve(__dirname, '..');
const nativeRootArg = process.argv.find((argument) => argument.startsWith('--native-root='));
const nativeRoot = path.resolve(
  nativeRootArg?.slice('--native-root='.length)
    || process.env.PADBOL_MATCH_NATIVE_ROOT
    // Production layout: <native>/.web-commercial-live/padbol-match-frontend.
    || path.resolve(webRoot, '../..'),
);
const outputPath = path.join(webRoot, 'src/i18n/nativeSharedLocaleOverrides.json');

const flatten = (value, prefix = '', output = {}) => {
  Object.entries(value || {}).forEach(([key, child]) => {
    const itemPath = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object' && !Array.isArray(child)) flatten(child, itemPath, output);
    else output[itemPath] = String(child);
  });
  return output;
};

const unflatten = (entries) => {
  const output = {};
  Object.entries(entries).forEach(([entryPath, value]) => {
    const parts = entryPath.split('.');
    let cursor = output;
    parts.forEach((part, index) => {
      if (index === parts.length - 1) cursor[part] = value;
      else cursor = cursor[part] ||= {};
    });
  });
  return output;
};

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const placeholders = (text) => [...String(text).matchAll(/{{\s*([^},\s]+)[^}]*}}/g)]
  .map((match) => match[1])
  .sort()
  .join('|');
const comparable = (text) => String(text ?? '')
  .normalize('NFKC')
  .toLocaleLowerCase('und')
  .replace(/[“”«»]/g, '"')
  .replace(/’/g, "'")
  .replace(/(?:…|\.{3})/g, '')
  .replace(/[.!?:;,\s]+$/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const indexByComparableSource = (entries) => {
  const index = {};
  Object.entries(entries).forEach(([key, source]) => {
    (index[comparable(source)] ||= []).push(key);
  });
  return index;
};

function carryDisplayStyle(translation, nativeSource, webSource) {
  let value = String(translation).trim();
  const webPunctuation = String(webSource).match(/(?:\.{3}|…|[.!?:])+$/u)?.[0] ?? '';
  value = value.replace(/(?:\.{3}|…|[.!?:])+$/u, '') + webPunctuation;

  const webLetters = String(webSource).replace(/[^\p{L}]/gu, '');
  const nativeLetters = String(nativeSource).replace(/[^\p{L}]/gu, '');
  if (webLetters && webLetters === webLetters.toLocaleUpperCase('und')
    && nativeLetters !== nativeLetters.toLocaleUpperCase('und')) {
    return value.toLocaleUpperCase('und');
  }
  if (/^\p{Lu}/u.test(String(webSource).trim()) && /^\p{Ll}/u.test(String(nativeSource).trim())) {
    return value.replace(/\p{L}/u, (letter) => letter.toLocaleUpperCase('und'));
  }
  return value;
}

const nativeEnglishPath = path.join(nativeRoot, 'src/i18n/locales/en.json');
const parityTestPath = path.join(nativeRoot, 'scripts/test-i18n-parity.cjs');
if (!fs.existsSync(nativeEnglishPath) || !fs.existsSync(parityTestPath)) {
  throw new Error(
    `No se encontró una copia compatible de Padbol Match nativo en ${nativeRoot}. `
      + 'Usá --native-root=/ruta/al/repositorio o PADBOL_MATCH_NATIVE_ROOT.',
  );
}

// Reuse the same runtime layer declaration that the native parity test verifies.
// This prevents the web seed from silently drifting away from the complete app bundles.
const paritySource = fs.readFileSync(parityTestPath, 'utf8');
const supplementsStart = paritySource.indexOf('const runtimeSupplements =');
const supplementsEnd = paritySource.indexOf('\n\nconst spanish =', supplementsStart);
if (supplementsStart < 0 || supplementsEnd < 0) {
  throw new Error('No se pudo leer la composición verificada de idiomas de la app nativa.');
}
const supplementsExpression = paritySource.slice(
  supplementsStart + 'const runtimeSupplements ='.length,
  supplementsEnd,
);
const context = {
  fs,
  path,
  __dirname: path.dirname(parityTestPath),
  flatten,
};
vm.createContext(context);
vm.runInContext(`globalThis.__runtimeSupplements = ${supplementsExpression}`, context, {
  filename: parityTestPath,
});

const webEnglish = flatten(readJson(path.join(webRoot, 'src/i18n/locales/en.json')));
const webSpanish = flatten(readJson(path.join(webRoot, 'src/i18n/locales/es.json')));
const nativeEnglish = flatten(readJson(nativeEnglishPath));
const nativeSpanish = flatten(readJson(path.join(nativeRoot, 'src/i18n/locales/es.json')));
const nativeKeysBySource = {};
Object.entries(nativeEnglish).forEach(([key, source]) => {
  (nativeKeysBySource[source] ||= []).push(key);
});
const nativeKeysBySpanishSource = {};
Object.entries(nativeSpanish).forEach(([key, source]) => {
  (nativeKeysBySpanishSource[source] ||= []).push(key);
});
const nativeKeysByComparableEnglish = indexByComparableSource(nativeEnglish);
const nativeKeysByComparableSpanish = indexByComparableSource(nativeSpanish);

const webToNativeCodes = {
  de: 'de',
  ar: 'ar',
  'fa-IR': 'fa',
  'nl-BE': 'nl',
  fr: 'fr',
  it: 'it',
  ro: 'ro',
  'nl-NL': 'nl',
  sv: 'sv',
  'pt-BR': 'pt-BR',
  'pt-PT': 'pt-PT',
  el: 'el',
  hu: 'hu',
  he: 'he',
  pl: 'pl',
  uk: 'uk',
  af: 'af',
  cs: 'cs',
};

const output = {};
for (const [webCode, nativeCode] of Object.entries(webToNativeCodes)) {
  const nativeBase = flatten(readJson(path.join(nativeRoot, `src/i18n/locales/${nativeCode}.json`)));
  const nativeResolved = {
    ...nativeBase,
    ...(context.__runtimeSupplements[nativeCode] || {}),
  };
  const shared = {};

  Object.entries(webEnglish).forEach(([webKey, englishSource]) => {
    const spanishSource = webSpanish[webKey];
    let spanishNativeKey = null;
    let englishNativeKey = null;
    if (spanishSource && nativeSpanish[webKey] === spanishSource) spanishNativeKey = webKey;
    else if (spanishSource && nativeKeysBySpanishSource[spanishSource]?.length === 1) {
      [spanishNativeKey] = nativeKeysBySpanishSource[spanishSource];
    }
    if (nativeEnglish[webKey] === englishSource) englishNativeKey = webKey;
    else if (nativeKeysBySource[englishSource]?.length === 1) [englishNativeKey] = nativeKeysBySource[englishSource];

    // Spanish is the editorial source of truth for the ecosystem. English is
    // a safe secondary bridge when the Spanish phrase has no unique match.
    let nativeKey = spanishNativeKey || englishNativeKey;
    let normalizedMatch = false;
    if (!nativeKey && spanishSource) {
      const spanishMatches = nativeKeysByComparableSpanish[comparable(spanishSource)] || [];
      const englishMatches = nativeKeysByComparableEnglish[comparable(englishSource)] || [];
      if (spanishMatches.length === 1 && englishMatches.length === 1 && spanishMatches[0] === englishMatches[0]) {
        [nativeKey] = spanishMatches;
        normalizedMatch = true;
      }
    }
    if (!nativeKey || !Object.hasOwn(nativeResolved, nativeKey)) return;

    const translation = normalizedMatch
      ? carryDisplayStyle(nativeResolved[nativeKey], nativeEnglish[nativeKey], englishSource)
      : nativeResolved[nativeKey];
    if (placeholders(translation) !== placeholders(englishSource)) {
      throw new Error(`${webCode}:${webKey} no conserva las variables del texto de origen.`);
    }
    shared[webKey] = translation;
  });

  output[webCode] = unflatten(shared);
  console.log(`${webCode}: ${Object.keys(shared).length} traducciones compartidas seguras`);
}

fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Catálogo generado: ${path.relative(webRoot, outputPath)}`);
