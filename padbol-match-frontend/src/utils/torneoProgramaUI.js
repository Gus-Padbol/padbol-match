/**
 * Presentación y filtrado por PROGRAMA / EDAD / NIVEL para torneos.
 *
 * Dos ejes independientes:
 *  - Programa + categoría de edad: `categoria_edad` (u13/u15/u17 → Next Generation; open/+50 → Padbol).
 *  - Nivel deportivo: `torneos.categoria` (Libre, Principiante, 6ta … Elite).
 *
 * Regla: nunca mezclar rankings juveniles con adultos. Usar `programaDeTorneo` para segmentar.
 */

import {
  PROGRAMA_NEXT_GENERATION,
  PROGRAMA_PADBOL,
  esCategoriaJuvenil,
  getCategoriaEdad,
  normalizeCategoriaEdad,
} from '../constants/torneoCategoriasEdad';

export const PROGRAMA_FILTRO_TODOS = 'todos';

export { PROGRAMA_NEXT_GENERATION, PROGRAMA_PADBOL };

/** Programa de un torneo: `next_generation` (U13/U15/U17) o `padbol` (adultos). */
export function programaDeTorneo(torneo) {
  if (!torneo || typeof torneo !== 'object') return PROGRAMA_PADBOL;
  const explicito = String(torneo.programa ?? '').trim().toLowerCase();
  if (explicito === PROGRAMA_NEXT_GENERATION) return PROGRAMA_NEXT_GENERATION;
  const cat = normalizeCategoriaEdad(torneo.categoria_edad);
  return cat && esCategoriaJuvenil(cat) ? PROGRAMA_NEXT_GENERATION : PROGRAMA_PADBOL;
}

/** ¿El torneo pertenece a Next Generation? */
export function torneoEsNextGenerationUI(torneo) {
  return programaDeTorneo(torneo) === PROGRAMA_NEXT_GENERATION;
}

/** Clave i18n del programa (badge / etiqueta). */
export function programaI18nKey(programa) {
  return `torneos.vista.programa.${programa === PROGRAMA_NEXT_GENERATION ? PROGRAMA_NEXT_GENERATION : PROGRAMA_PADBOL}`;
}

/** Etiqueta legible de la categoría de edad (ES) con fallback al valor crudo. */
export function etiquetaCategoriaEdad(value) {
  const meta = getCategoriaEdad(value);
  return meta ? meta.labelEs : String(value ?? '').trim() || '—';
}

/** Programa al que pertenece una categoría de edad concreta. */
export function programaDeCategoriaEdad(value) {
  const cat = normalizeCategoriaEdad(value);
  return cat && esCategoriaJuvenil(cat) ? PROGRAMA_NEXT_GENERATION : PROGRAMA_PADBOL;
}

export function torneoPasaFiltroPrograma(torneo, filtro) {
  if (!filtro || filtro === PROGRAMA_FILTRO_TODOS) return true;
  return programaDeTorneo(torneo) === filtro;
}

export function torneoPasaFiltroCategoriaEdad(torneo, filtro) {
  if (!filtro || filtro === PROGRAMA_FILTRO_TODOS) return true;
  return normalizeCategoriaEdad(torneo?.categoria_edad) === normalizeCategoriaEdad(filtro);
}

/** Nivel deportivo del torneo (`torneos.categoria`). `Libre` se considera "sin restricción". */
export function torneoPasaFiltroNivel(torneo, filtro) {
  if (!filtro || filtro === PROGRAMA_FILTRO_TODOS) return true;
  const nivel = String(torneo?.categoria ?? '').trim();
  return nivel === filtro;
}

/** Aplica los tres filtros (programa, categoría de edad y nivel deportivo). */
export function filtrarTorneos(torneos, { programa, categoriaEdad, nivel } = {}) {
  const list = Array.isArray(torneos) ? torneos : [];
  return list.filter(
    (t) =>
      torneoPasaFiltroPrograma(t, programa) &&
      torneoPasaFiltroCategoriaEdad(t, categoriaEdad) &&
      torneoPasaFiltroNivel(t, nivel),
  );
}

/**
 * Separa torneos por programa para rankings/listados: nunca mezclar juveniles con adultos.
 * @returns {{ nextGeneration: any[], padbol: any[] }}
 */
export function separarTorneosPorPrograma(torneos) {
  const out = { nextGeneration: [], padbol: [] };
  (Array.isArray(torneos) ? torneos : []).forEach((t) => {
    if (programaDeTorneo(t) === PROGRAMA_NEXT_GENERATION) out.nextGeneration.push(t);
    else out.padbol.push(t);
  });
  return out;
}

/** Agrupa por programa + categoría de edad (clave de segmentación para rankings). */
export function agruparTorneosPorProgramaYCategoria(torneos) {
  const grupos = new Map();
  (Array.isArray(torneos) ? torneos : []).forEach((t) => {
    const programa = programaDeTorneo(t);
    const categoria = normalizeCategoriaEdad(t?.categoria_edad) || 'sin_categoria';
    const key = `${programa}::${categoria}`;
    if (!grupos.has(key)) grupos.set(key, { programa, categoriaEdad: categoria, torneos: [] });
    grupos.get(key).torneos.push(t);
  });
  return [...grupos.values()];
}
