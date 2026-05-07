/** Género / tipo de competencia del torneo (`torneos.genero_competencia`). */
export const TORNEO_GENERO_COMPETENCIA_DEFAULT = 'mixto';

export const TORNEO_GENERO_COMPETENCIA_OPTIONS = [
  { value: 'masculino', label: 'Masculino' },
  { value: 'femenino', label: 'Femenino' },
  { value: 'mixto', label: 'Mixto' },
];

/** Categoría de edad (`torneos.categoria_edad`). */
export const TORNEO_CATEGORIA_EDAD_DEFAULT = 'open';

export const TORNEO_CATEGORIA_EDAD_OPTIONS = [
  { value: 'sub_18', label: 'Sub 18' },
  { value: 'open', label: 'Open' },
  { value: 'master_40', label: 'Máster +40' },
  { value: 'master_50', label: 'Máster +50' },
];
