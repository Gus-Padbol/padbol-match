/** UUID Auth (relajado). */
export function esUuidPerfilPublico(s) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s || '').trim());
}

/**
 * URL de GET perfil público agregado según slug de ruta (UUID o alias).
 * @param {string} slug segmento decodificado de /perfil/:userId o /jugador/:alias
 * @param {string} apiBase base sin trailing slash
 */
export function buildPerfilPublicoFetchUrl(slug, apiBase) {
  const raw = String(slug || '').trim();
  const base = String(apiBase || '').replace(/\/$/, '');
  if (!raw || !base) return null;
  if (esUuidPerfilPublico(raw)) {
    return `${base}/api/jugador/perfil-publico/${encodeURIComponent(raw)}`;
  }
  return `${base}/api/jugadores/perfil-publico/${encodeURIComponent(raw)}`;
}
