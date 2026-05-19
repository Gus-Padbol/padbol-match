import { useCallback } from 'react';
import { useTranslation as useTranslationBase } from 'react-i18next';
import es from './locales/es.json';

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

/** Textos en español para claves faltantes o cuando i18n aún no resolvió. */
export const ES_FALLBACKS = flattenLocale(es);

/**
 * Normaliza el valor devuelto por i18next (nunca devolver objetos a React).
 */
export function resolveTranslation(key, translated, explicitFallback) {
  const k = String(key || '');
  if (translated != null && typeof translated === 'object') {
    return explicitFallback || ES_FALLBACKS[k] || k;
  }
  const s = translated != null ? String(translated) : '';
  if (s && s !== k) return s;
  if (explicitFallback) return explicitFallback;
  if (ES_FALLBACKS[k]) return ES_FALLBACKS[k];
  return k;
}

/**
 * Hook seguro: fallback a español (es.json) si falta la clave o i18n devuelve la key cruda.
 * Uso: t('nav.jugar') o t('nav.jugar', 'Jugar') o t('key', { defaultValue: '…' }).
 */
export function useSafeTranslation(ns) {
  const { t: tBase, i18n, ready } = useTranslationBase(ns);

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
      const defaultValue = explicitFallback || ES_FALLBACKS[k] || k;
      let raw;
      try {
        raw = tBase(k, { ...opts, defaultValue });
      } catch (err) {
        console.error('[i18n] t() falló para clave:', k, err);
        return resolveTranslation(k, null, explicitFallback);
      }
      if (!ready && explicitFallback) return explicitFallback;
      return resolveTranslation(k, raw, explicitFallback);
    },
    [tBase, ready],
  );

  return { t, i18n, ready };
}

/** Alias para migración gradual desde react-i18next. */
export { useSafeTranslation as useTranslation };
