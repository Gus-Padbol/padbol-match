import { canonicalPadbolLanguageCode, isPadbolLanguageCode } from '../constants/padbolLanguages';

export const PADBOL_LANGUAGE_STORAGE_KEY = 'padbol_lang';
export const STORAGE_KEY = PADBOL_LANGUAGE_STORAGE_KEY;

function getI18n() {
  return require('../i18n').default;
}

function normalizeSupportedPadbolLang(code) {
  const s = String(code || '').trim().replace(/_/g, '-').toLowerCase();
  const exact = canonicalPadbolLanguageCode(s);
  if (exact) return exact;
  if (s.startsWith('en')) return 'en';
  if (s.startsWith('es')) return 'es';
  if (s.startsWith('it')) return 'it';
  if (s.startsWith('ro')) return 'ro';
  if (s.startsWith('de')) return 'de';
  if (s.startsWith('fr')) return 'fr';
  if (s.startsWith('pt-pt')) return 'pt-PT';
  if (s.startsWith('pt')) return 'pt-BR';
  if (s.startsWith('ar')) return 'ar';
  if (s.startsWith('fa')) return 'fa-IR';
  if (s.startsWith('nl-be')) return 'nl-BE';
  if (s.startsWith('nl')) return 'nl-NL';
  if (s.startsWith('sv')) return 'sv';
  if (s.startsWith('el')) return 'el';
  if (s.startsWith('hu')) return 'hu';
  if (s.startsWith('he') || s.startsWith('iw')) return 'he';
  if (s.startsWith('pl')) return 'pl';
  if (s.startsWith('uk') || s.startsWith('ua')) return 'uk';
  if (s.startsWith('af')) return 'af';
  if (s.startsWith('cs') || s.startsWith('cz')) return 'cs';
  return null;
}

export function normalizePadbolLang(code) {
  return normalizeSupportedPadbolLang(code) || 'en';
}

export function getNavigatorLanguageCandidates(navigatorLike = typeof navigator === 'undefined' ? null : navigator) {
  const preferred = Array.isArray(navigatorLike?.languages) ? navigatorLike.languages : [];
  const legacy = navigatorLike?.language;
  return [...preferred, legacy]
    .map((language) => String(language || '').trim())
    .filter((language, index, values) => language && values.indexOf(language) === index);
}

export function detectPadbolBrowserLanguage(navigatorLike = typeof navigator === 'undefined' ? null : navigator) {
  for (const language of getNavigatorLanguageCandidates(navigatorLike)) {
    const supported = normalizeSupportedPadbolLang(language);
    if (supported) return supported;
  }
  return 'en';
}

export function resolveInitialPadbolLanguage({
  storage = typeof localStorage === 'undefined' ? null : localStorage,
  navigatorLike = typeof navigator === 'undefined' ? null : navigator,
} = {}) {
  try {
    const stored = canonicalPadbolLanguageCode(storage?.getItem(STORAGE_KEY));
    if (stored) return stored;
  } catch {
    // Browser storage can be unavailable (privacy mode or security policy).
  }
  return detectPadbolBrowserLanguage(navigatorLike);
}

/** Locale BCP 47 para `Intl` / `toLocaleDateString` según idioma Padbol. */
export function padbolLangToIntlLocale(lang) {
  const code = normalizePadbolLang(lang);
  const map = {
    es: 'es-AR',
    en: 'en-US',
    ar: 'ar',
    de: 'de-DE',
    fr: 'fr-FR',
    it: 'it-IT',
    ro: 'ro-RO',
    'pt-BR': 'pt-BR',
    'pt-PT': 'pt-PT',
    'fa-IR': 'fa-IR',
    'nl-BE': 'nl-BE',
    'nl-NL': 'nl-NL',
    sv: 'sv-SE',
    el: 'el-GR',
    hu: 'hu-HU',
    he: 'he-IL',
    pl: 'pl-PL',
    uk: 'uk-UA',
    af: 'af-ZA',
    cs: 'cs-CZ',
  };
  return map[code] || code;
}

/** Etiquetas cortas Lun–Dom (calendario reserva). */
export function reservaWeekdayShortLabels(lang) {
  const locale = padbolLangToIntlLocale(lang);
  const fmt = new Intl.DateTimeFormat(locale, { weekday: 'short' });
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2024, 0, 1 + i, 12)));
}

/** Título mes + año del calendario de reserva. */
export function reservaMonthYearLabel(year, monthIndex, lang) {
  const locale = padbolLangToIntlLocale(lang);
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
    new Date(year, monthIndex, 15, 12),
  );
}

/** Aplica dirección RTL/LTR y clase de idioma en `<html>` / `<body>`. */
export function applyPadbolDocumentDirection(lang) {
  if (typeof document === 'undefined') return;
  const code = normalizePadbolLang(lang);
  const isRtl = code === 'ar' || code === 'he' || code === 'fa-IR';
  document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
  document.body.classList.toggle('lang-rtl', isRtl);
  document.body.classList.toggle('lang-ar', code === 'ar');
  document.body.classList.toggle('lang-he', code === 'he');
  document.body.classList.toggle('lang-fa', code === 'fa-IR');
}

/** true si el usuario ya eligió idioma (guardado en localStorage). */
export function hasPadbolLangChosen(storage = typeof localStorage === 'undefined' ? null : localStorage) {
  try {
    const v = storage?.getItem(STORAGE_KEY);
    return isPadbolLanguageCode(v);
  } catch {
    return false;
  }
}

export function getPadbolLangStored(storage = typeof localStorage === 'undefined' ? null : localStorage) {
  try {
    const v = storage?.getItem(STORAGE_KEY);
    if (isPadbolLanguageCode(v)) return normalizePadbolLang(v);
  } catch {
    /* ignore */
  }
  return null;
}

/** Aplica idioma en memoria sin persistir (visitante internacional en landing). */
export function applyPadbolLanguageInMemory(code) {
  const lang = normalizePadbolLang(code);
  void getI18n().changeLanguage(lang);
  return lang;
}

/** Persiste en localStorage y aplica en i18next (espera el cambio). */
export async function setPadbolLanguage(code) {
  const lang = normalizePadbolLang(code);
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* ignore */
  }
  await getI18n().changeLanguage(lang);
  applyPadbolDocumentDirection(lang);
  return lang;
}

/** Elección manual, primer idioma compatible del navegador o inglés. */
export function bootstrapPadbolLanguage(options) {
  const language = resolveInitialPadbolLanguage(options);
  void getI18n().changeLanguage(language);
  applyPadbolDocumentDirection(language);
  return language;
}
