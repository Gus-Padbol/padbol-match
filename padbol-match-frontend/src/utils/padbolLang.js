import i18n, { STORAGE_KEY } from '../i18n';
import { isPadbolLanguageCode, PADBOL_LANGUAGE_CODES } from '../constants/padbolLanguages';

export { STORAGE_KEY };

export function normalizePadbolLang(code) {
  const s = String(code || '').trim().toLowerCase();
  if (isPadbolLanguageCode(s)) return s;
  if (s.startsWith('en')) return 'en';
  if (s.startsWith('es')) return 'es';
  if (s.startsWith('it')) return 'it';
  if (s.startsWith('ro')) return 'ro';
  if (s.startsWith('de')) return 'de';
  if (s.startsWith('fr')) return 'fr';
  if (s.startsWith('pt')) return 'pt';
  if (s.startsWith('ar')) return 'ar';
  return PADBOL_LANGUAGE_CODES[0] || 'en';
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
    pt: 'pt-BR',
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
  const isAr = code === 'ar';
  document.documentElement.dir = isAr ? 'rtl' : 'ltr';
  document.body.classList.toggle('lang-ar', isAr);
}

/** true si el usuario ya eligió idioma (guardado en localStorage). */
export function hasPadbolLangChosen() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return isPadbolLanguageCode(v);
  } catch {
    return false;
  }
}

export function getPadbolLangStored() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (isPadbolLanguageCode(v)) return v;
  } catch {
    /* ignore */
  }
  return null;
}

/** Aplica idioma en memoria sin persistir (visitante internacional en landing). */
export function applyPadbolLanguageInMemory(code) {
  const lang = normalizePadbolLang(code);
  void i18n.changeLanguage(lang);
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
  await i18n.changeLanguage(lang);
  applyPadbolDocumentDirection(lang);
  return lang;
}

/** Sin `padbol_lang`: inglés por defecto; si existe, restaurar elección. */
export function bootstrapPadbolLanguage() {
  const stored = getPadbolLangStored();
  if (stored) {
    void i18n.changeLanguage(stored);
    applyPadbolDocumentDirection(stored);
    return stored;
  }
  void i18n.changeLanguage('en');
  applyPadbolDocumentDirection('en');
  return 'en';
}
