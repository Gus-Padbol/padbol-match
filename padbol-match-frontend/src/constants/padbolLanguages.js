/**
 * Idiomas de la UI. Para agregar uno nuevo:
 * 1. Entrada en este array (flags + label en idioma nativo)
 * 2. `locales/{code}.json` + `resources` en `src/i18n/index.js`
 * 3. Ampliar `normalizePadbolLang` / `supportedLngs` si hace falta
 *
 * @typedef {{ code: string, flags: string, label: string }} PadbolLanguageOption
 */

/** @type {PadbolLanguageOption[]} */
export const PADBOL_LANGUAGES = [
  { code: 'es', flags: '🇦🇷 🇪🇸', label: 'Español' },
  { code: 'en', flags: '🇺🇸', label: 'English' },
  // { code: 'it', flags: '🇮🇹', label: 'Italiano' },
  // { code: 'ro', flags: '🇷🇴', label: 'Română' },
];

export const PADBOL_LANGUAGE_CODES = PADBOL_LANGUAGES.map((l) => l.code);

export function isPadbolLanguageCode(code) {
  return PADBOL_LANGUAGE_CODES.includes(String(code || '').trim().toLowerCase());
}
