/** Fuerza inglés sólo mientras se muestra el login solicitado con ?lang=en. */
export function applyRequestedEnglishLanguage(search, i18n) {
  if (new URLSearchParams(String(search || '')).get('lang') !== 'en') return () => {};
  if (!i18n || typeof i18n.changeLanguage !== 'function') return () => {};
  const previous = i18n.language;
  i18n.changeLanguage('en');
  return () => { i18n.changeLanguage(previous); };
}
