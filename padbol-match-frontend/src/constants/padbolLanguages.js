/**
 * Idiomas de la UI. Para agregar uno nuevo: una entrada aquí + locale en i18n + normalizePadbolLang.
 * @typedef {{ code: string, flags: string, label: string }} PadbolLanguageOption
 */

/** @type {PadbolLanguageOption[]} */
export const PADBOL_LANGUAGES = [
  { code: 'es', flags: '🇦🇷 🇪🇸', label: 'Español' },
  { code: 'en', flags: '🇺🇸', label: 'English' },
];

export function isPadbolLanguageCode(code) {
  return PADBOL_LANGUAGES.some((l) => l.code === code);
}
