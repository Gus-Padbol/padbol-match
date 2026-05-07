/** Valores permitidos en `jugadores_perfil.genero`. */
export const GENERO_JUGADOR_VALUES = ['masculino', 'femenino', 'otro'];

/** Categoría deportiva (columna `nivel` en `jugadores_perfil`) según reglas actuales. */
export const CATEGORIAS_NIVEL_MASCULINO = ['Principiante', '4ta', '3ra', '2da', '1ra', 'Elite'];

export const CATEGORIAS_NIVEL_FEMENINO = ['Principiante', '3ra', '2da', '1ra', 'Elite'];

/** Listado para filtros (ranking) y overrides admin: todas las categorías posibles. */
export const CATEGORIAS_NIVEL_TODAS = ['Principiante', '4ta', '3ra', '2da', '1ra', 'Elite'];

/**
 * @param {string | null | undefined} generoRaw
 * @returns {string[]}
 */
export function categoriasNivelPorGenero(generoRaw) {
  const g = String(generoRaw || '').trim().toLowerCase();
  if (g === 'femenino') return CATEGORIAS_NIVEL_FEMENINO;
  return CATEGORIAS_NIVEL_MASCULINO;
}
