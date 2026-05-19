import { usePadbolI18n } from '../context/PadbolI18nContext';

/** Idioma activo + suscripción al tick global de re-render (cambio ES/EN). */
export function usePadbolLang() {
  const { language, version } = usePadbolI18n();
  return language;
}

/** Fuerza re-render cuando cambia el idioma (usar en hooks que memorizan traducciones). */
export function usePadbolLangVersion() {
  return usePadbolI18n().version;
}
