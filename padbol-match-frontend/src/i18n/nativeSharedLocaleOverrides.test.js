import english from './locales/en.json';
import shared from './nativeSharedLocaleOverrides.json';
import { PADBOL_LANGUAGE_CODES } from '../constants/padbolLanguages';

const flatten = (value, prefix = '', output = {}) => {
  Object.entries(value || {}).forEach(([key, child]) => {
    const itemPath = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object' && !Array.isArray(child)) flatten(child, itemPath, output);
    else output[itemPath] = String(child);
  });
  return output;
};

const placeholders = (text) => [...String(text).matchAll(/{{\s*([^},\s]+)[^}]*}}/g)]
  .map((match) => match[1])
  .sort();

test('the native translation-memory bridge is complete and structurally safe', () => {
  expect(Object.keys(shared).sort()).toEqual(
    PADBOL_LANGUAGE_CODES.filter((code) => !['en', 'es'].includes(code)).sort(),
  );
  const englishFlat = flatten(english);
  Object.entries(shared).forEach(([code, catalog]) => {
    const entries = flatten(catalog);
    // The bridge may grow whenever the native and web catalogues gain another
    // safely matching phrase. Guard against coverage regressions without
    // making every legitimate expansion require a new magic exact count.
    expect(Object.keys(entries).length).toBeGreaterThanOrEqual(328);
    Object.entries(entries).forEach(([key, value]) => {
      expect(Object.hasOwn(englishFlat, key)).toBe(true);
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
      expect(placeholders(value)).toEqual(placeholders(englishFlat[key]));
    });
    expect(code).not.toBe('en');
  });
});
