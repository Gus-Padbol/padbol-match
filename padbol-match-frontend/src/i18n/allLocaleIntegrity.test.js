import i18n from './index';
import en from './locales/en.json';
import { PADBOL_LANGUAGE_CODES } from '../constants/padbolLanguages';

const flatten = (value, prefix = '', output = {}) => {
  Object.entries(value || {}).forEach(([key, child]) => {
    const itemPath = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object' && !Array.isArray(child)) flatten(child, itemPath, output);
    else output[itemPath] = String(child);
  });
  return output;
};

const placeholders = (value) => [...String(value).matchAll(/{{\s*([^},\s]+)[^}]*}}/g)]
  .map((match) => match[1])
  .sort();

describe('all locale catalogs', () => {
  const english = flatten(en);

  test.each(PADBOL_LANGUAGE_CODES)('%s preserves every key and interpolation variable', (code) => {
    const resolved = flatten(i18n.getResourceBundle(code, 'translation'));
    Object.entries(english).forEach(([key, source]) => {
      expect(resolved[key]).toBeTruthy();
      expect(placeholders(resolved[key])).toEqual(placeholders(source));
      expect(resolved[key]).not.toMatch(/ZXQ|\[9(?:0000\d|9999(?:8|9|0|1|2))\]/);
    });
  });
});
