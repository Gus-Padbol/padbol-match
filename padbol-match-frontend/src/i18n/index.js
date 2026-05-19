import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import es from './locales/es.json';
import en from './locales/en.json';

const STORAGE_KEY = 'padbol_lang';

function readInitialLng() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'es' || v === 'en') return v;
  } catch {
    /* ignore */
  }
  return 'en';
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      es: { translation: es },
      en: { translation: en },
    },
    lng: readInitialLng(),
    fallbackLng: 'en',
    supportedLngs: ['es', 'en'],
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
