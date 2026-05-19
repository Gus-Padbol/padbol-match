import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import i18n from '../i18n';
import { normalizePadbolLang, setPadbolLanguage as persistPadbolLanguage } from '../utils/padbolLang';

const PadbolI18nContext = createContext({
  language: 'en',
  version: 0,
  setLanguage: async () => 'en',
});

/** Proveedor global: incrementa `version` en cada cambio de idioma para re-renderizar toda la app. */
export function PadbolI18nProvider({ children }) {
  const [language, setLanguageState] = useState(() =>
    normalizePadbolLang(i18n.language || i18n.resolvedLanguage),
  );
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const sync = (lng) => {
      const next = normalizePadbolLang(lng);
      setLanguageState(next);
      setVersion((v) => v + 1);
      try {
        if (typeof document !== 'undefined') {
          document.documentElement.lang = next;
        }
      } catch {
        /* ignore */
      }
    };
    sync(i18n.language);
    i18n.on('languageChanged', sync);
    return () => i18n.off('languageChanged', sync);
  }, []);

  const setLanguage = useCallback(async (code) => {
    const lang = await persistPadbolLanguage(code);
    setLanguageState(lang);
    setVersion((v) => v + 1);
    return lang;
  }, []);

  const value = useMemo(
    () => ({ language, version, setLanguage }),
    [language, version, setLanguage],
  );

  return <PadbolI18nContext.Provider value={value}>{children}</PadbolI18nContext.Provider>;
}

export function usePadbolI18n() {
  return useContext(PadbolI18nContext);
}
