import { useEffect, useState } from 'react';
import i18n from '../i18n';
import { normalizePadbolLang } from '../utils/padbolLang';

/** Suscribe al idioma activo de i18next (re-render al cambiar ES/EN). */
export function usePadbolLang() {
  const [lang, setLang] = useState(() => normalizePadbolLang(i18n.language || i18n.resolvedLanguage));

  useEffect(() => {
    const sync = (lng) => setLang(normalizePadbolLang(lng));
    sync(i18n.language);
    i18n.on('languageChanged', sync);
    return () => i18n.off('languageChanged', sync);
  }, []);

  return lang;
}
