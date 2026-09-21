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
import ROMANIAN_GENERATED_OVERRIDES from './romanianGeneratedOverrides.json';
import ROMANIAN_ADMIN_OVERRIDES from './romanianAdminOverrides.json';
import ROMANIAN_OPERATIONS_OVERRIDES from './romanianOperationsOverrides.json';
import ROMANIAN_ADMIN_LANDING_OVERRIDES from './romanianAdminLandingOverrides.json';
import ROMANIAN_PADCOINS_OVERRIDES from './romanianPadcoinsOverrides.json';
import ROMANIAN_ENGLISH_LEAK_OVERRIDES from './romanianEnglishLeakOverrides.json';
import ROMANIAN_POLISH_OVERRIDES from './romanianPolishOverrides.json';
import CZECH_POLISH_OVERRIDES from './czechPolishOverrides.json';
import SPANISH_PADCOINS_CORE_OVERRIDES from './spanishPadcoinsCoreOverrides.json';
import SPANISH_PADCOINS_EXPERIENCE_OVERRIDES from './spanishPadcoinsExperienceOverrides.json';
import SPANISH_POLISH_OVERRIDES from './spanishPolishOverrides.json';
import PUBLIC_SITE_GENERATED_LOCALES from './publicSiteGeneratedLocales.json';
import NATIVE_SHARED_LOCALE_OVERRIDES from './nativeSharedLocaleOverrides.json';
import CROSS_LOCALE_POLISH_OVERRIDES from './crossLocalePolishOverrides.json';
import GENERATED_LOCALE_GAP_OVERRIDES from './generatedLocaleGapOverrides.json';
import GENERATED_QUALITY_OVERRIDES from './generatedQualityOverrides.json';
import { PADBOL_LANGUAGE_CODES } from '../constants/padbolLanguages';
import {
  PADBOL_LANGUAGE_STORAGE_KEY,
  resolveInitialPadbolLanguage,
} from '../utils/padbolLang';

const STORAGE_KEY = PADBOL_LANGUAGE_STORAGE_KEY;

export function readInitialLng(options) {
  return resolveInitialPadbolLanguage(options);
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

function fillEnglishGaps(resolved, generated, english) {
  const result = { ...(resolved || {}) };
  Object.entries(generated || {}).forEach(([key, value]) => {
    const generatedIsObject = value && typeof value === 'object' && !Array.isArray(value);
    if (generatedIsObject) {
      result[key] = fillEnglishGaps(result[key], value, english?.[key]);
      return;
    }
    if (result[key] == null || result[key] === english?.[key]) result[key] = value;
  });
  return result;
}

function safeAccountDeletionCopy(code, polished) {
  const existing = polished?.accountDeletion || {};
  if (code === 'es') return es.accountDeletion;
  if (code === 'ro') {
    return {
      ...existing,
      confirmMessage: 'Această acțiune înregistrează o solicitare și, după afișarea dovezii, te deconectează. Nu confirmă încă ștergerea sau anonimizarea datelor. Vom verifica obligațiile legale de păstrare și îți vom comunica rezultatul.',
      confirm: 'Da, trimite solicitarea',
    };
  }
  if (code === 'cs') {
    return {
      ...existing,
      confirmMessage: 'Tato akce zaregistruje žádost a po zobrazení potvrzení vás odhlásí. Zatím nepotvrzuje odstranění ani anonymizaci údajů. Prověříme zákonné povinnosti uchování a sdělíme vám výsledek.',
      confirm: 'Ano, odeslat žádost',
    };
  }
  if (code === 'pt-BR') {
    return {
      ...existing,
      confirmMessage: 'Esta ação registra uma solicitação e, após mostrar o comprovante, encerra sua sessão. Ela ainda não confirma a exclusão nem a anonimização dos dados. Analisaremos as retenções legais aplicáveis e informaremos o resultado.',
      confirm: 'Sim, enviar solicitação',
    };
  }
  if (code === 'pt-PT') {
    return {
      ...existing,
      confirmMessage: 'Esta ação regista um pedido e, depois de apresentar o comprovativo, termina a sua sessão. Ainda não confirma o apagamento nem a anonimização dos dados. Analisaremos as retenções legais aplicáveis e comunicaremos o resultado.',
      confirm: 'Sim, enviar o pedido',
    };
  }
  return en.accountDeletion;
}

const ROMANIAN_LOCALE_LAYERS = [
  ROMANIAN_GENERATED_OVERRIDES,
  ROMANIAN_ADMIN_OVERRIDES,
  ROMANIAN_OPERATIONS_OVERRIDES,
  ROMANIAN_ADMIN_LANDING_OVERRIDES,
  ROMANIAN_PADCOINS_OVERRIDES,
  ROMANIAN_LOCALE_OVERRIDES,
  ROMANIAN_ENGLISH_LEAK_OVERRIDES,
  ROMANIAN_POLISH_OVERRIDES,
];

// Todo idioma se construye sobre el catálogo inglés completo. Así, una clave
// que todavía no tenga versión editorial local conserva una frase legible en
// inglés y nunca hereda el texto por defecto en español de un componente.
// Esto evita pantallas mezcladas (por ejemplo, interfaz inglesa con acciones
// o estados en español) mientras se mantienen las traducciones existentes.
const englishBackedLocale = (code, baseLocale = {}) => {
  // Shared app copy is only generated when its English source matches this
  // web catalog exactly. Existing web catalogs and editorial layers always win.
  const withNativeSharedCopy = mergeLocale(en, NATIVE_SHARED_LOCALE_OVERRIDES[code]);
  const base = mergeLocale(withNativeSharedCopy, baseLocale);
  const withPublicSite = PUBLIC_SITE_GENERATED_LOCALES[code]
    ? mergeLocale(base, { publicSite: PUBLIC_SITE_GENERATED_LOCALES[code] })
    : base;
  const withAdditionalOverrides = mergeLocale(withPublicSite, ADDITIONAL_LOCALE_OVERRIDES[code]);
  const withCrossLocalePolish = mergeLocale(withAdditionalOverrides, CROSS_LOCALE_POLISH_OVERRIDES[code]);
  let editorial = withCrossLocalePolish;
  if (code === 'ro') {
    editorial = ROMANIAN_LOCALE_LAYERS.reduce((locale, layer) => mergeLocale(locale, layer), editorial);
  }
  if (code === 'cs') editorial = mergeLocale(editorial, CZECH_POLISH_OVERRIDES);
  if (code === 'es') {
    editorial = [SPANISH_PADCOINS_CORE_OVERRIDES, SPANISH_PADCOINS_EXPERIENCE_OVERRIDES, SPANISH_POLISH_OVERRIDES]
      .reduce((locale, layer) => mergeLocale(locale, layer), editorial);
  }
  // Generated copy is applied only where the resolved edition still equals
  // English. Human translations keep priority, including future corrections.
  const completed = fillEnglishGaps(editorial, GENERATED_LOCALE_GAP_OVERRIDES[code], en);
  const polished = mergeLocale(completed, GENERATED_QUALITY_OVERRIDES[code]);
  // Prevent older translations from promising deletion before the executor
  // has actually completed it. Non-Spanish locales use the accurate English
  // fallback until their legal copy receives a professional review.
  return mergeLocale(polished, { accountDeletion: safeAccountDeletionCopy(code, polished) });
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
    detection: { order: ['localStorage', 'navigator'], caches: [], lookupLocalStorage: STORAGE_KEY },
  });

export { STORAGE_KEY };
export default i18n;
