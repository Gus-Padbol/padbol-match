import i18n, { STORAGE_KEY } from '../i18n';

export { STORAGE_KEY };

export function normalizePadbolLang(code) {
  return String(code || '').toLowerCase().startsWith('en') ? 'en' : 'es';
}

/** true si el usuario ya eligió idioma en la pantalla inicial o en ajustes. */
export function hasPadbolLangChosen() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'es' || v === 'en';
  } catch {
    return false;
  }
}

export function getPadbolLangStored() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'es' || v === 'en') return v;
  } catch {
    /* ignore */
  }
  return null;
}

/** Persiste en localStorage y aplica en i18next. */
export function setPadbolLanguage(code) {
  const lang = normalizePadbolLang(code);
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* ignore */
  }
  void i18n.changeLanguage(lang);
  return lang;
}
