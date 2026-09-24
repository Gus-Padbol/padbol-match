import { TORNEO_CATEGORIAS_EDAD } from './torneoCategoriasEdad';

/**
 * Tipo de torneo por género de competencia: Masculino / Femenino / Mixto.
 * Columna canónica en BD: `tipo_competencia`. Columna espejo opcional: `tipo_torneo_genero` (mismo valor).
 * No confundir con `tipo_torneo` = formato del fixture (round_robin, grupos_knockout, etc.).
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

/**
 * Categoría de edad (`torneos.categoria_edad`).
 * Fuente única: `src/constants/torneoCategoriasEdad.js`.
 *
 * - Juveniles U13 / U15 / U17 → programa FIPA Next Generation (exclusivas del circuito juvenil).
 * - Open → sin límite de edad.
 * - Máster +30 / +40 / +50 → circuito adulto/familiar.
 * - Sub 18 → legado histórico (se mantiene, no se ofrece en altas nuevas).
 */
export const TORNEO_CATEGORIA_EDAD_DEFAULT = 'open';

/** Opciones planas: mantiene el shape `{ value, label }` que consumen los selects existentes. */
export const TORNEO_CATEGORIA_EDAD_OPTIONS = TORNEO_CATEGORIAS_EDAD.map((c) => ({
  value: c.value,
  label: c.labelEs,
  kind: c.kind,
  nextGeneration: c.nextGeneration,
}));

export {
  TORNEO_CATEGORIAS_EDAD,
  TORNEO_CATEGORIA_EDAD_GROUPS,
  TORNEO_CATEGORIA_EDAD_VALORES,
  TORNEO_CATEGORIA_EDAD_JUVENIL,
  TORNEO_CATEGORIA_EDAD_ADULTA,
  PROGRAMA_NEXT_GENERATION,
  esTorneoNextGeneration,
  esCategoriaJuvenil,
  esCategoriaAdulta,
} from './torneoCategoriasEdad';
