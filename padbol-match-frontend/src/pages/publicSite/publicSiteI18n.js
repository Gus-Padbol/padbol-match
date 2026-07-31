import { useSafeTranslation } from '../../i18n/tSafe';

/** Textos de /plataforma vía catálogo i18n (sin fallback ES hardcodeado). */
export function usePublicSiteText() {
  const { t } = useSafeTranslation();
  // Algunas piezas de la demo pública interpolan valores de estado
  // (por ejemplo, plazas confirmadas y porcentaje de ocupación). No
  // descartamos esas opciones al pasar por este helper.
  return (key, options) => t(key, options);
}
