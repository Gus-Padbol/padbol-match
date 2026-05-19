import { useCallback } from 'react';
import { useTranslation as useTranslationBase } from 'react-i18next';
import es from './locales/es.json';
import en from './locales/en.json';
import { normalizePadbolLang } from '../utils/padbolLang';
import { usePadbolI18n } from '../context/PadbolI18nContext';

function flattenLocale(obj, prefix = '') {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, flattenLocale(v, key));
    } else {
      out[key] = String(v);
    }
  }
  return out;
}

/** Textos de respaldo por idioma (si falta clave o i18n aún no resolvió). */
export const ES_FALLBACKS = flattenLocale(es);
export const EN_FALLBACKS = flattenLocale(en);

export function getLocaleFallbacks(lang) {
  return normalizePadbolLang(lang) === 'en' ? EN_FALLBACKS : ES_FALLBACKS;
}

/**
 * Normaliza el valor devuelto por i18next (nunca devolver objetos a React).
 */
export function resolveTranslation(key, translated, explicitFallback, lang = 'es') {
  const k = String(key || '');
  const fallbacks = getLocaleFallbacks(lang);
  if (translated != null && typeof translated === 'object') {
    return explicitFallback || fallbacks[k] || k;
  }
  const s = translated != null ? String(translated) : '';
  if (s && s !== k) return s;
  if (explicitFallback) return explicitFallback;
  if (fallbacks[k]) return fallbacks[k];
  return k;
}

/**
 * Hook seguro: fallback al locale activo si falta la clave o i18n devuelve la key cruda.
 */
export function useSafeTranslation(ns) {
  const { t: tBase, i18n, ready } = useTranslationBase(ns);
  const { version: langVersion } = usePadbolI18n();
  const currentLang = normalizePadbolLang(i18n.language || i18n.resolvedLanguage);

  const t = useCallback(
    (key, defaultOrOpts, maybeOpts) => {
      const k = String(key || '');
      let explicitFallback;
      let opts = {};
      if (typeof defaultOrOpts === 'string') {
        explicitFallback = defaultOrOpts;
        if (maybeOpts && typeof maybeOpts === 'object') opts = maybeOpts;
      } else if (defaultOrOpts && typeof defaultOrOpts === 'object') {
        opts = defaultOrOpts;
        explicitFallback = opts.defaultValue != null ? String(opts.defaultValue) : undefined;
      }
      const fallbacks = getLocaleFallbacks(currentLang);
      const defaultValue = explicitFallback || fallbacks[k] || k;
      let raw;
      try {
        raw = tBase(k, { ...opts, defaultValue, lng: currentLang });
      } catch (err) {
        console.error('[i18n] t() falló para clave:', k, err);
        return resolveTranslation(k, null, explicitFallback, currentLang);
      }
      if (!ready && explicitFallback) return explicitFallback;
      return resolveTranslation(k, raw, explicitFallback, currentLang);
    },
    [tBase, ready, currentLang, langVersion],
  );

  return { t, i18n, ready, language: currentLang };
}

/** Alias para migración gradual desde react-i18next. */
export { useSafeTranslation as useTranslation };
