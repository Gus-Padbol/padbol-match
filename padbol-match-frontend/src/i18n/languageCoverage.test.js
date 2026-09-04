import en from './locales/en.json';
import i18n from './index';
import { getLocaleFallbacks } from './tSafe';
import { PADBOL_LANGUAGE_CODES } from '../constants/padbolLanguages';

function flattenLocale(obj, prefix = '', out = {}) {
  Object.entries(obj || {}).forEach(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flattenLocale(value, path, out);
    } else {
      out[path] = String(value);
    }
  });
  return out;
}

describe('language coverage', () => {
  const englishKeys = Object.keys(flattenLocale(en));

  it('resuelve todas las claves conocidas para cada idioma publicado', () => {
    PADBOL_LANGUAGE_CODES.forEach((language) => {
      const fallbacks = getLocaleFallbacks(language);
      englishKeys.forEach((key) => {
        expect(fallbacks[key]).toBeTruthy();
      });
    });
  });

  it('no devuelve claves técnicas al cambiar entre los 20 idiomas', async () => {
    for (const language of PADBOL_LANGUAGE_CODES) {
      await i18n.changeLanguage(language);
      for (const key of englishKeys) {
        expect(i18n.t(key, { lng: language })).not.toBe(key);
      }
    }
  });

  it.each([
    ['es', 'Para jugadores'],
    ['it', 'Per i giocatori'],
    ['ro', 'Pentru jucători'],
    ['fr', 'Pour les joueurs'],
    ['cs', 'Pro hráče'],
  ])('cambia realmente el contenido público a %s', async (language, expected) => {
    await i18n.changeLanguage(language);
    expect(i18n.language).toBe(language);
    expect(i18n.t('publicSite.nav.players')).toBe(expected);
  });
});
