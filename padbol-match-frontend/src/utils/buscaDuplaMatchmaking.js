import { CATEGORIAS_NIVEL_TODAS } from '../constants/jugadorCategoria';

const MAP_DIGITO_A_CAT = {
  1: '1ra',
  2: '2da',
  3: '3ra',
  4: '4ta',
  5: '5ta',
};

/**
 * Alinea texto de `jugadores_perfil.nivel` con etiquetas del orden global (p. ej. "3" → "3ra").
 */
export function normalizarCategoriaNivelBuscaDupla(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (CATEGORIAS_NIVEL_TODAS.includes(s)) return s;
  const n = parseInt(s, 10);
  if (String(n) === s && MAP_DIGITO_A_CAT[n]) return MAP_DIGITO_A_CAT[n];
  const lower = s.toLowerCase();
  for (const c of CATEGORIAS_NIVEL_TODAS) {
    if (c.toLowerCase() === lower) return c;
  }
  return s;
}

/** Índice en la escala combinada, o -1 si no está en la lista (p. ej. categoría custom). */
export function indiceCategoriaNivelBuscaDupla(catRaw) {
  const c = normalizarCategoriaNivelBuscaDupla(catRaw);
  return CATEGORIAS_NIVEL_TODAS.indexOf(c);
}

/**
 * 0 = misma categoría en escala, 1 = adyacente (±1), 2 = más lejano, 3 = sin datos para comparar.
 */
export function tierCompatibilidadNivelBuscaDupla(miNivel, otroNivel) {
  const mi = indiceCategoriaNivelBuscaDupla(miNivel);
  const ot = indiceCategoriaNivelBuscaDupla(otroNivel);
  if (mi < 0 || ot < 0) return 3;
  if (mi === ot) return 0;
  if (Math.abs(mi - ot) === 1) return 1;
  return 2;
}

/** Texto del badge de compatibilidad (null si no aplica mostrar). */
export function etiquetaCompatibilidadBuscaDupla(tier) {
  if (tier === 0) return 'Mismo nivel';
  if (tier === 1) return 'Nivel similar';
  if (tier === 2) return 'Diferente nivel';
  return 'Diferente nivel';
}

export function etiquetaLateralidadBuscaDupla(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return '';
  if (s === 'diestro' || s === 'derecho' || s === 'right') return 'Diestro';
  if (s === 'zurdo' || s === 'izquierdo' || s === 'left') return 'Zurdo';
  return String(raw || '').trim();
}

/**
 * Orden: mismo nivel → nivel similar (±1) → resto; dentro del grupo por distancia en la escala;
 * empate por fecha de anuncio. Sin categoría propia comparable → orden solo por `created_at`.
 */
export function ordenarBuscaDuplaPorCompatibilidad(rows, miNivel) {
  const arr = [...(rows || [])];
  const mi = indiceCategoriaNivelBuscaDupla(miNivel);
  if (mi < 0) {
    return arr.sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')));
  }
  return arr.sort((a, b) => {
    const ta = tierCompatibilidadNivelBuscaDupla(miNivel, a.categoria);
    const tb = tierCompatibilidadNivelBuscaDupla(miNivel, b.categoria);
    if (ta !== tb) return ta - tb;
    const ia = indiceCategoriaNivelBuscaDupla(a.categoria);
    const ib = indiceCategoriaNivelBuscaDupla(b.categoria);
    if (ia >= 0 && ib >= 0) {
      const da = Math.abs(mi - ia);
      const db = Math.abs(mi - ib);
      if (da !== db) return da - db;
    }
    return String(a.created_at || '').localeCompare(String(b.created_at || ''));
  });
}
