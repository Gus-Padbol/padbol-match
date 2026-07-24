import i18n from '../i18n';
import en from '../i18n/locales/en.json';
import {
  PADBOL_LANGUAGES,
  PADBOL_LANGUAGE_CODES,
  canonicalPadbolLanguageCode,
} from '../constants/padbolLanguages';
import {
  applyPadbolDocumentDirection,
  normalizePadbolLang,
  padbolLangToIntlLocale,
} from './padbolLang';

function flattenKeys(value, prefix = '', output = []) {
  Object.entries(value || {}).forEach(([key, child]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object' && !Array.isArray(child)) {
      flattenKeys(child, fullKey, output);
    } else {
      output.push(fullKey);
    }
  });
  return output;
}

describe('idiomas internacionales de Padbol Match', () => {
  test('registra las 19 opciones solicitadas con códigos regionales inequívocos', () => {
    expect(PADBOL_LANGUAGE_CODES).toEqual([
      'de',
      'es',
      'en',
      'ar',
      'fa-IR',
      'nl-BE',
      'fr',
      'it',
      'ro',
      'nl-NL',
      'sv',
      'pt-BR',
      'pt-PT',
      'el',
      'hu',
      'he',
      'pl',
      'uk',
      'af',
    ]);
    expect(new Set(PADBOL_LANGUAGE_CODES).size).toBe(19);
    expect(PADBOL_LANGUAGES.every(({ label, flags }) => label && flags)).toBe(true);
  });

  test('migra códigos antiguos y normaliza variantes del navegador', () => {
    expect(canonicalPadbolLanguageCode('pt')).toBe('pt-BR');
    expect(canonicalPadbolLanguageCode('nl')).toBe('nl-NL');
    expect(canonicalPadbolLanguageCode('fa')).toBe('fa-IR');
    expect(normalizePadbolLang('nl_BE')).toBe('nl-BE');
    expect(normalizePadbolLang('pt-PT')).toBe('pt-PT');
    expect(normalizePadbolLang('pt')).toBe('pt-BR');
    expect(normalizePadbolLang('iw-IL')).toBe('he');
    expect(normalizePadbolLang('fa_IR')).toBe('fa-IR');
    expect(normalizePadbolLang('uk-UA')).toBe('uk');
    expect(normalizePadbolLang('unknown')).toBe('en');
  });

  test('asigna locales Intl correctos para fechas y calendarios', () => {
    expect(padbolLangToIntlLocale('nl-BE')).toBe('nl-BE');
    expect(padbolLangToIntlLocale('pt-PT')).toBe('pt-PT');
    expect(padbolLangToIntlLocale('hu')).toBe('hu-HU');
    expect(padbolLangToIntlLocale('he')).toBe('he-IL');
    expect(padbolLangToIntlLocale('fa')).toBe('fa-IR');
    expect(padbolLangToIntlLocale('uk')).toBe('uk-UA');
  });

  test('aplica RTL a árabe, hebreo y persa, y restaura LTR en los demás', () => {
    applyPadbolDocumentDirection('he');
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.body.classList.contains('lang-rtl')).toBe(true);
    expect(document.body.classList.contains('lang-he')).toBe(true);

    applyPadbolDocumentDirection('ar');
    expect(document.body.classList.contains('lang-ar')).toBe(true);
    expect(document.body.classList.contains('lang-he')).toBe(false);

    applyPadbolDocumentDirection('fa-IR');
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.body.classList.contains('lang-rtl')).toBe(true);
    expect(document.body.classList.contains('lang-fa')).toBe(true);
    expect(document.body.classList.contains('lang-ar')).toBe(false);

    applyPadbolDocumentDirection('hu');
    expect(document.documentElement.dir).toBe('ltr');
    expect(document.body.classList.contains('lang-rtl')).toBe(false);
  });

  test.each(PADBOL_LANGUAGE_CODES)(
    '%s resuelve todas las claves inglesas sin mostrar identificadores técnicos',
    (code) => {
      for (const key of flattenKeys(en)) {
        expect(i18n.exists(key, { lng: code })).toBe(true);
      }
    },
  );

  test.each(['fa-IR', 'nl-BE', 'nl-NL', 'sv', 'pt-PT', 'el', 'hu', 'he', 'pl', 'uk', 'af'])(
    '%s incluye navegación básica traducida y no sólo fallback inglés',
    (code) => {
      expect(i18n.t('general.language', { lng: code })).not.toBe(en.general.language);
      expect(i18n.t('nav.myProfile', { lng: code })).not.toBe(en.nav.myProfile);
      expect(i18n.t('publicSite.hero.claim', { lng: code })).not.toBe(
        en.publicSite.hero.claim
      );
    },
  );
});
