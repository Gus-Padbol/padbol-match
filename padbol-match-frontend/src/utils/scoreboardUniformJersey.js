/** Normaliza hex #RRGGBB o null si inválido/vacío. */
export function normalizeUniformColor(raw) {
  const value = String(raw ?? '').trim();
  if (!value) return null;
  if (/^#[0-9A-Fa-f]{6}$/.test(value)) return value;
  if (/^[0-9A-Fa-f]{6}$/.test(value)) return `#${value}`;
  return null;
}

/** Colores de camiseta para equipo A o B desde scoreboard_partidos. */
export function resolveUniformJerseyColors(partido, side) {
  const key = String(side || '').toUpperCase() === 'B' ? 'b' : 'a';
  return {
    color1: normalizeUniformColor(partido?.[`color_uniforme_${key}1`]),
    color2: normalizeUniformColor(partido?.[`color_uniforme_${key}2`]),
  };
}

export function hasUniformJerseyColors({ color1, color2 }) {
  return Boolean(color1 || color2);
}
