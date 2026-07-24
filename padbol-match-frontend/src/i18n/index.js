import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import es from './locales/es.json';
import en from './locales/en.json';
import it from './locales/it.json';
import ro from './locales/ro.json';
import de from './locales/de.json';
import fr from './locales/fr.json';
import pt from './locales/pt.json';
import ar from './locales/ar.json';
import { ADDITIONAL_LOCALE_OVERRIDES } from './additionalLocaleOverrides';
import {
  canonicalPadbolLanguageCode,
  PADBOL_LANGUAGE_CODES,
} from '../constants/padbolLanguages';

const STORAGE_KEY = 'padbol_lang';

function readInitialLng() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    const canonical = canonicalPadbolLanguageCode(v);
    if (canonical) return canonical;
  } catch {
    /* ignore */
  }
  return 'en';
}

function mergeLocale(base, override) {
  const result = { ...(base || {}) };
  Object.entries(override || {}).forEach(([key, value]) => {
    result[key] =
      value && typeof value === 'object' && !Array.isArray(value)
        ? mergeLocale(result[key], value)
        : value;
  });
  return result;
}

const englishBackedLocale = (code) => mergeLocale(en, ADDITIONAL_LOCALE_OVERRIDES[code]);

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      es: { translation: es },
      en: { translation: en },
      it: { translation: it },
      ro: { translation: ro },
      de: { translation: de },
      fr: { translation: fr },
      'pt-BR': { translation: pt },
      'pt-PT': { translation: mergeLocale(pt, ADDITIONAL_LOCALE_OVERRIDES['pt-PT']) },
      ar: { translation: ar },
      'nl-BE': { translation: englishBackedLocale('nl-BE') },
      'nl-NL': { translation: englishBackedLocale('nl-NL') },
      sv: { translation: englishBackedLocale('sv') },
      el: { translation: englishBackedLocale('el') },
      hu: { translation: englishBackedLocale('hu') },
      he: { translation: englishBackedLocale('he') },
      pl: { translation: englishBackedLocale('pl') },
      uk: { translation: englishBackedLocale('uk') },
      af: { translation: englishBackedLocale('af') },
    },
    lng: readInitialLng(),
    fallbackLng: 'en',
    supportedLngs: [...PADBOL_LANGUAGE_CODES],
    load: 'currentOnly',
    interpolation: { escapeValue: false },
    returnNull: false,
    returnEmptyString: false,
    react: {
      useSuspense: false,
      bindI18n: 'languageChanged loaded',
      bindI18nStore: 'added removed',
    },
    detection: {
      /** Solo `padbol_lang` explícito (pantalla inicial o selector); no autoguardar idioma del navegador. */
      order: ['localStorage'],
      caches: [],
      lookupLocalStorage: STORAGE_KEY,
    },
  });

export { STORAGE_KEY };
export default i18n;
