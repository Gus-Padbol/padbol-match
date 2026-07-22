import { useSafeTranslation } from '../../i18n/tSafe';

/** Textos de /plataforma vía catálogo i18n (sin fallback ES hardcodeado). */
export function usePublicSiteText() {
  const { t } = useSafeTranslation();
  return (key) => t(key);
}
