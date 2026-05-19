import i18n, { STORAGE_KEY } from '../i18n';
import { isPadbolLanguageCode, PADBOL_LANGUAGE_CODES } from '../constants/padbolLanguages';

export { STORAGE_KEY };

export function normalizePadbolLang(code) {
  const s = String(code || '').trim().toLowerCase();
  if (isPadbolLanguageCode(s)) return s;
  if (s.startsWith('en')) return 'en';
  return PADBOL_LANGUAGE_CODES[0] || 'es';
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
  return lang;
}

/** Sin `padbol_lang`: inglés por defecto; si existe, restaurar elección. */
export function bootstrapPadbolLanguage() {
  const stored = getPadbolLangStored();
  if (stored) {
    void i18n.changeLanguage(stored);
    return stored;
  }
  void i18n.changeLanguage('en');
  return 'en';
}
