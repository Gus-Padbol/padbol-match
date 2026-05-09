/** UUID v4 de Auth (relajado) para fallback de URL pública. */
function esUuidAuthProbable(s) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s || '').trim());
}

/**
 * Segmento de ruta para `/jugador/:slug`: alias público si existe; si no, `user_id`.
 * @param {{ alias?: string; user_id?: string; id?: string }} p jugador normalizado o fila perfil
 * @returns {string} slug sin encode, o '' si no hay forma de abrir perfil
 */
export function slugPerfilPublicoJugador(p) {
  if (!p || typeof p !== 'object') return '';
  const alias = String(p.alias || '').trim();
  if (alias) return alias;
  const uid = String(p.user_id || p.id || '').trim();
  if (esUuidAuthProbable(uid)) return uid;
  return '';
}

/** Ruta relativa lista para `<a href>` o `window.open`. */
export function pathJugadorPerfilPublico(p) {
  const slug = slugPerfilPublicoJugador(p);
  if (!slug) return null;
  return `/jugador/${encodeURIComponent(slug)}`;
}
