/** Valores permitidos en `jugadores_perfil.genero`. */
export const GENERO_JUGADOR_VALUES = ['masculino', 'femenino', 'otro', 'open'];

/** Categoría deportiva masculina (columna `nivel`): lista histórica completa. */
export const CATEGORIAS_NIVEL_MASCULINO = ['Principiante', '5ta', '4ta', '3ra', '2da', '1ra', 'Elite'];

/** Categorías femeninas (lista aparte). */
export const CATEGORIAS_NIVEL_FEMENINO = ['Principiante', '3ra', '2da', '1ra', 'Elite'];

/** Orden de presentación para la lista combinada (Otro / Open) y filtros globales. */
const ORDEN_CATEGORIAS = ['Principiante', '5ta', '4ta', '3ra', '2da', '1ra', 'Elite'];

function categoriasCombinadas() {
  const set = new Set([...CATEGORIAS_NIVEL_MASCULINO, ...CATEGORIAS_NIVEL_FEMENINO]);
  return ORDEN_CATEGORIAS.filter((x) => set.has(x));
}

/** Unión masculinas + femeninas (ranking / admin). */
export const CATEGORIAS_NIVEL_TODAS = categoriasCombinadas();

/**
 * @param {string | null | undefined} generoRaw
 * @returns {string[]}
 */
export function categoriasNivelPorGenero(generoRaw) {
  const g = String(generoRaw || '').trim().toLowerCase();
  if (g === 'femenino') return CATEGORIAS_NIVEL_FEMENINO;
  if (g === 'otro' || g === 'open') return categoriasCombinadas();
  return CATEGORIAS_NIVEL_MASCULINO;
}
