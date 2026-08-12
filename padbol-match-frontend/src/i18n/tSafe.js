import { useCallback } from 'react';
import { useTranslation as useTranslationBase } from 'react-i18next';
import es from './locales/es.json';
import en from './locales/en.json';
import it from './locales/it.json';
import ro from './locales/ro.json';
import de from './locales/de.json';
import fr from './locales/fr.json';
import pt from './locales/pt.json';
import ar from './locales/ar.json';
import { ADDITIONAL_LOCALE_OVERRIDES } from './additionalLocaleOverrides';
import PUBLIC_SITE_GENERATED_LOCALES from './publicSiteGeneratedLocales.json';
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
const mergeLocale = (base, override) => {
  const result = { ...(base || {}) };
  Object.entries(override || {}).forEach(([key, value]) => {
    result[key] = value && typeof value === 'object' && !Array.isArray(value)
      ? mergeLocale(result[key], value)
      : value;
  });
  return result;
};

// Los fallbacks también se arman desde el inglés completo. Esta capa es la
// que usan componentes antiguos que aún entregan defaults en español.
const completeLocale = (baseLocale, override, code) => flattenLocale(mergeLocale(
  mergeLocale(mergeLocale(en, baseLocale), { publicSite: PUBLIC_SITE_GENERATED_LOCALES[code] }),
  override,
));

export const ES_FALLBACKS = completeLocale(es);
export const EN_FALLBACKS = flattenLocale(en);
export const IT_FALLBACKS = completeLocale(it, undefined, 'it');
export const RO_FALLBACKS = completeLocale(ro, undefined, 'ro');
export const DE_FALLBACKS = completeLocale(de, undefined, 'de');
export const FR_FALLBACKS = completeLocale(fr, undefined, 'fr');
export const PT_FALLBACKS = completeLocale(pt, undefined, 'pt-BR');
export const AR_FALLBACKS = completeLocale(ar, undefined, 'ar');

const FALLBACKS_BY_LANG = {
  es: ES_FALLBACKS,
  en: EN_FALLBACKS,
  it: IT_FALLBACKS,
  ro: RO_FALLBACKS,
  de: DE_FALLBACKS,
  fr: FR_FALLBACKS,
  'pt-BR': PT_FALLBACKS,
  'pt-PT': completeLocale(pt, ADDITIONAL_LOCALE_OVERRIDES['pt-PT'], 'pt-PT'),
  ar: AR_FALLBACKS,
  'fa-IR': completeLocale({}, ADDITIONAL_LOCALE_OVERRIDES['fa-IR'], 'fa-IR'),
  'nl-BE': completeLocale({}, ADDITIONAL_LOCALE_OVERRIDES['nl-BE'], 'nl-BE'),
  'nl-NL': completeLocale({}, ADDITIONAL_LOCALE_OVERRIDES['nl-NL'], 'nl-NL'),
  sv: completeLocale({}, ADDITIONAL_LOCALE_OVERRIDES.sv, 'sv'),
  el: completeLocale({}, ADDITIONAL_LOCALE_OVERRIDES.el, 'el'),
  hu: completeLocale({}, ADDITIONAL_LOCALE_OVERRIDES.hu, 'hu'),
  he: completeLocale({}, ADDITIONAL_LOCALE_OVERRIDES.he, 'he'),
  pl: completeLocale({}, ADDITIONAL_LOCALE_OVERRIDES.pl, 'pl'),
  uk: completeLocale({}, ADDITIONAL_LOCALE_OVERRIDES.uk, 'uk'),
  af: completeLocale({}, ADDITIONAL_LOCALE_OVERRIDES.af, 'af'),
};

export function getLocaleFallbacks(lang) {
  const code = normalizePadbolLang(lang);
  return FALLBACKS_BY_LANG[code] || EN_FALLBACKS;
}

/**
 * Última barrera para que una variable de traducción nunca llegue cruda a la
 * interfaz (por ejemplo `{{filled}} of 4 spots`). i18next normalmente hace
 * esta interpolación, pero algunas vistas públicas llaman al traductor a
 * través de un helper y pueden renderizar antes de que el catálogo termine de
 * sincronizarse. En ese instante completamos los valores disponibles y no
 * exponemos la clave técnica si alguno todavía no llegó.
 */
export function interpolateTranslation(value, options = {}) {
  return String(value ?? '').replace(/{{\s*([^}\s]+)\s*}}/g, (token, name) => {
    const replacement = options?.[name];
    return replacement == null ? '' : String(replacement);
  });
}

/**
 * Normaliza el valor devuelto por i18next (nunca devolver objetos a React).
 */
export function resolveTranslation(key, translated, explicitFallback, lang = 'es', options = {}) {
  const k = String(key || '');
  const fallbacks = getLocaleFallbacks(lang);
  if (translated != null && typeof translated === 'object') {
    return interpolateTranslation(fallbacks[k] || explicitFallback || EN_FALLBACKS[k] || ES_FALLBACKS[k] || k, options);
  }
  const s = translated != null ? String(translated) : '';
  if (s && s !== k) return interpolateTranslation(s, options);
  if (fallbacks[k]) return interpolateTranslation(fallbacks[k], options);
  if (explicitFallback) return interpolateTranslation(explicitFallback, options);
  // Si un locale aún no tiene una clave nueva, el inglés es el respaldo
  // universal. Es preferible a mostrar `publicSite.algo` en pantalla.
  if (EN_FALLBACKS[k]) return interpolateTranslation(EN_FALLBACKS[k], options);
  if (ES_FALLBACKS[k]) return interpolateTranslation(ES_FALLBACKS[k], options);
  return interpolateTranslation(k, options);
}

/**
 * Hook seguro: fallback al locale activo si falta la clave o i18n devuelve la key cruda.
 */
export function useSafeTranslation(ns) {
  const { t: tBase, i18n, ready } = useTranslationBase(ns);
  usePadbolI18n();
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
      // Nunca usar primero un default del componente: muchos de los antiguos
      // están escritos en español. El catálogo del idioma activo (o su
      // fallback inglés completo) debe definir el idioma visual.
      const defaultValue = fallbacks[k] || explicitFallback || k;
      // i18next puede devolver el fallback en inglés cuando falta una clave del
      // idioma activo. Si el componente entregó una traducción explícita para
      // ese idioma, debe prevalecer: evita interfaces mixtas (p. ej. PadCoins).
      if (!fallbacks[k] && explicitFallback) return explicitFallback;
      let raw;
      try {
        raw = tBase(k, { ...opts, defaultValue, lng: currentLang });
      } catch (err) {
        console.error('[i18n] t() falló para clave:', k, err);
        return resolveTranslation(k, null, explicitFallback, currentLang, opts);
      }
      if (!ready && fallbacks[k]) return interpolateTranslation(fallbacks[k], opts);
      if (!ready && explicitFallback) return interpolateTranslation(explicitFallback, opts);
      return resolveTranslation(k, raw, explicitFallback, currentLang, opts);
    },
    [tBase, ready, currentLang],
  );

  return { t, i18n, ready, language: currentLang };
}

/** Alias para migración gradual desde react-i18next. */
export { useSafeTranslation as useTranslation };
