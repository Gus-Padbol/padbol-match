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
import ROMANIAN_LOCALE_OVERRIDES from './romanianLocaleOverrides';
import PUBLIC_SITE_GENERATED_LOCALES from './publicSiteGeneratedLocales.json';
import { canonicalPadbolLanguageCode, PADBOL_LANGUAGE_CODES } from '../constants/padbolLanguages';

const STORAGE_KEY = 'padbol_lang';

function readInitialLng() {
  try {
    return canonicalPadbolLanguageCode(localStorage.getItem(STORAGE_KEY)) || 'en';
  } catch {
    return 'en';
  }
}

function mergeLocale(base, override) {
  const result = { ...(base || {}) };
  Object.entries(override || {}).forEach(([key, value]) => {
    result[key] = value && typeof value === 'object' && !Array.isArray(value)
      ? mergeLocale(result[key], value)
      : value;
  });
  return result;
}

// Todo idioma se construye sobre el catálogo inglés completo. Así, una clave
// que todavía no tenga versión editorial local conserva una frase legible en
// inglés y nunca hereda el texto por defecto en español de un componente.
// Esto evita pantallas mezcladas (por ejemplo, interfaz inglesa con acciones
// o estados en español) mientras se mantienen las traducciones existentes.
const englishBackedLocale = (code, baseLocale = {}) => {
  const base = mergeLocale(en, baseLocale);
  const withPublicSite = PUBLIC_SITE_GENERATED_LOCALES[code]
    ? mergeLocale(base, { publicSite: PUBLIC_SITE_GENERATED_LOCALES[code] })
    : base;
  const withAdditionalOverrides = mergeLocale(withPublicSite, ADDITIONAL_LOCALE_OVERRIDES[code]);
  return code === 'ro'
    ? mergeLocale(withAdditionalOverrides, ROMANIAN_LOCALE_OVERRIDES)
    : withAdditionalOverrides;
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      es: { translation: englishBackedLocale('es', es) }, en: { translation: en },
      it: { translation: englishBackedLocale('it', it) }, ro: { translation: englishBackedLocale('ro', ro) },
      de: { translation: englishBackedLocale('de', de) }, fr: { translation: englishBackedLocale('fr', fr) },
      'pt-BR': { translation: englishBackedLocale('pt-BR', pt) },
      'pt-PT': { translation: englishBackedLocale('pt-PT', pt) },
      ar: { translation: englishBackedLocale('ar', ar) }, 'fa-IR': { translation: englishBackedLocale('fa-IR') },
      'nl-BE': { translation: englishBackedLocale('nl-BE') }, 'nl-NL': { translation: englishBackedLocale('nl-NL') },
      sv: { translation: englishBackedLocale('sv') }, el: { translation: englishBackedLocale('el') },
      hu: { translation: englishBackedLocale('hu') }, he: { translation: englishBackedLocale('he') },
      pl: { translation: englishBackedLocale('pl') }, uk: { translation: englishBackedLocale('uk') },
      af: { translation: englishBackedLocale('af') }, cs: { translation: englishBackedLocale('cs') },
    },
    lng: readInitialLng(), fallbackLng: 'en', supportedLngs: [...PADBOL_LANGUAGE_CODES], load: 'currentOnly',
    interpolation: { escapeValue: false }, returnNull: false, returnEmptyString: false,
    react: { useSuspense: false, bindI18n: 'languageChanged loaded', bindI18nStore: 'added removed' },
    detection: { order: ['localStorage'], caches: [], lookupLocalStorage: STORAGE_KEY },
  });

export { STORAGE_KEY };
export default i18n;
