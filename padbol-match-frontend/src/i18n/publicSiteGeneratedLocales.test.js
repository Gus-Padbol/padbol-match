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

const mergeCatalog = (base, override) => {
  const result = { ...(base || {}) };
  Object.entries(override || {}).forEach(([key, value]) => {
    result[key] = value && typeof value === 'object' && !Array.isArray(value)
      ? mergeCatalog(result[key], value)
      : value;
  });
  return result;
};

describe('public site translated catalogs', () => {
  const englishCatalog = flatten(en.publicSite);
  const englishKeys = Object.keys(englishCatalog).sort();
  const generatedCodes = PADBOL_LANGUAGE_CODES.filter((code) => !['es', 'en', 'cs'].includes(code));

  it.each(generatedCodes)('%s covers every public-site key without raw i18n keys', (code) => {
    // Producción construye cada idioma sobre el catálogo inglés completo y
    // luego aplica su traducción. El control debe validar ese catálogo efectivo.
    const catalog = flatten(mergeCatalog(en.publicSite, generated[code]));
    expect(Object.keys(catalog).sort()).toEqual(englishKeys);
    const copy = Object.values(catalog).join(' ');
    expect(copy).not.toMatch(/publicSite\.[A-Za-z]/);
    expect(copy).not.toMatch(/<[^>]*>|data-i=|data-var=|span=/i);
    const placeholders = (value) => [...String(value).matchAll(/{{\s*([^}\s]+)\s*}}/g)]
      .map((match) => match[1]).sort();
    Object.entries(catalog).forEach(([key, value]) => {
      expect(placeholders(value)).toEqual(placeholders(englishCatalog[key]));
    });
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

  it.each([
    ['it', 'Per i giocatori'],
    ['ro', 'Pentru jucători'],
    ['fr', 'Pour les joueurs'],
  ])('%s does not inherit the old Spanish navigation', (code, expected) => {
    expect(generated[code].nav.players).toBe(expected);
    expect(generated[code].nav.players).not.toBe('Para jugadores');
    expect(generated[code].playerPath.items.book.title).not.toBe('Reservar');
  });
});
