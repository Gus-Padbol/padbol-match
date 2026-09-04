/** Opciones disponibles en el selector público y en la aplicación web. */
export const PADBOL_LANGUAGES = [
  { code: 'de', flags: '🇩🇪', label: 'Deutsch' },
  { code: 'es', flags: '🇪🇸', label: 'Español' },
  { code: 'en', flags: '🇬🇧', label: 'English' },
  { code: 'ar', flags: '🇸🇦', label: 'العربية' },
  { code: 'fa-IR', flags: '🇮🇷', label: 'فارسی' },
  { code: 'nl-BE', flags: '🇧🇪', label: 'Nederlands (België)' },
  { code: 'fr', flags: '🇫🇷', label: 'Français' },
  { code: 'it', flags: '🇮🇹', label: 'Italiano' },
  { code: 'ro', flags: '🇷🇴', label: 'Română' },
  { code: 'nl-NL', flags: '🇳🇱', label: 'Nederlands (Nederland)' },
  { code: 'sv', flags: '🇸🇪', label: 'Svenska' },
  { code: 'pt-BR', flags: '🇧🇷', label: 'Português (Brasil)' },
  { code: 'pt-PT', flags: '🇵🇹', label: 'Português (Portugal)' },
  { code: 'el', flags: '🇬🇷', label: 'Ελληνικά' },
  { code: 'hu', flags: '🇭🇺', label: 'Magyar' },
  { code: 'he', flags: '🇮🇱', label: 'עברית' },
  { code: 'pl', flags: '🇵🇱', label: 'Polski' },
  { code: 'uk', flags: '🇺🇦', label: 'Українська' },
  { code: 'af', flags: '🇿🇦', label: 'Afrikaans' },
  { code: 'cs', flags: '🇨🇿', label: 'Čeština' },
];

export const PADBOL_LANGUAGE_CODES = PADBOL_LANGUAGES.map((language) => language.code);

const CODE_BY_NORMALIZED_VALUE = Object.fromEntries(
  PADBOL_LANGUAGE_CODES.map((code) => [code.toLowerCase(), code]),
);

const LEGACY_LANGUAGE_ALIASES = { pt: 'pt-BR', nl: 'nl-NL', iw: 'he', fa: 'fa-IR', cz: 'cs', 'cs-cz': 'cs' };

export function canonicalPadbolLanguageCode(code) {
  const normalized = String(code || '').trim().replace(/_/g, '-').toLowerCase();
  return CODE_BY_NORMALIZED_VALUE[normalized] || LEGACY_LANGUAGE_ALIASES[normalized] || null;
}

export function isPadbolLanguageCode(code) {
  return canonicalPadbolLanguageCode(code) != null;
}
