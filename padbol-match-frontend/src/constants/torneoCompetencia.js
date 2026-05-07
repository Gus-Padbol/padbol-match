/**
 * Tipo de competencia del torneo: Masculino / Femenino / Mixto.
 * Columna en BD: `tipo_competencia` (no confundir con `tipo_torneo` = formato round robin, etc.).
 */
export const TORNEO_TIPO_COMPETENCIA_DEFAULT = 'masculino';

export const TORNEO_TIPO_COMPETENCIA_OPTIONS = [
  { value: 'masculino', label: 'Masculino' },
  { value: 'femenino', label: 'Femenino' },
  { value: 'mixto', label: 'Mixto' },
];

/** Alias usados en payloads / forms (mismo significado). */
export const TORNEO_GENERO_COMPETENCIA_DEFAULT = TORNEO_TIPO_COMPETENCIA_DEFAULT;
export const TORNEO_GENERO_COMPETENCIA_OPTIONS = TORNEO_TIPO_COMPETENCIA_OPTIONS;

/** Categoría de edad (`torneos.categoria_edad`). */
export const TORNEO_CATEGORIA_EDAD_DEFAULT = 'open';

export const TORNEO_CATEGORIA_EDAD_OPTIONS = [
  { value: 'sub_18', label: 'Sub 18' },
  { value: 'open', label: 'Open' },
  { value: 'master_40', label: 'Máster +40' },
  { value: 'master_50', label: 'Máster +50' },
];
