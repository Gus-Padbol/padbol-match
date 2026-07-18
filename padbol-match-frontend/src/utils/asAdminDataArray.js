/**
 * Normaliza valores de entrada del Panel Admin a array.
 * Usado por memos de métricas/resumen antes de .map/.filter.
 */

const CONTAINER_KEYS = Object.freeze(['data', 'items', 'reservas', 'torneos', 'equipos', 'results']);

/**
 * @param {*} value
 * @returns {array}
 */
export function asAdminDataArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  if (typeof value === 'object') {
    for (const key of CONTAINER_KEYS) {
      if (Array.isArray(value[key])) return value[key];
    }
  }
  return [];
}
