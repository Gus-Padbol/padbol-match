import en from './locales/en.json';
import generated from './publicSiteGeneratedLocales.json';
import { PADBOL_LANGUAGE_CODES } from '../constants/padbolLanguages';

const flatten = (value, prefix = '', output = {}) => {
  Object.entries(value || {}).forEach(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object' && !Array.isArray(child)) flatten(child, path, output);
    else output[path] = String(child);
  });
  return output;
};

describe('public site translated catalogs', () => {
  const englishKeys = Object.keys(flatten(en.publicSite)).sort();
  const generatedCodes = PADBOL_LANGUAGE_CODES.filter((code) => !['es', 'en'].includes(code));

  it.each(generatedCodes)('%s covers every public-site key without raw i18n keys', (code) => {
    const catalog = flatten(generated[code]);
    expect(Object.keys(catalog).sort()).toEqual(englishKeys);
    expect(Object.values(catalog).join(' ')).not.toMatch(/publicSite\.[A-Za-z]/);
  });

  it('keeps the reported Hebrew experience section fully translated', () => {
    expect(generated.he.experiences.title).toBe('חמש חוויות. פלטפורמה אחת');
    expect(generated.he.experiences.text).not.toMatch(/[A-Za-z]{4,}/);
    expect(generated.he.experiences.items.signature.text).not.toMatch(/[A-Za-z]{4,}/);
  });

  it.each(generatedCodes)('%s does not end public titles with a period', (code) => {
    const titles = Object.entries(flatten(generated[code]))
      .filter(([key]) => /\.(title|claim|kicker)$/.test(`.${key}`))
      .map(([, value]) => value);
    expect(titles.filter((value) => value.endsWith('.'))).toEqual([]);
  });
});
