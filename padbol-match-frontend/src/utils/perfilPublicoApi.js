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

/**
 * Normaliza respuesta del backend (objeto plano o con `perfil` / `jugador` anidado).
 * @returns {{ api: object, perfil: object } | null}
 */
export function normalizePerfilPublicoApiResponse(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;

  const nestedPerfil = data.perfil || data.jugador || null;
  const torneosRecientes = data.torneos_recientes || data.historial_torneos || [];
  const avatarUrl = String(data.avatar_url || data.foto_url || nestedPerfil?.foto_url || '').trim() || null;

  if (nestedPerfil && typeof nestedPerfil === 'object') {
    return {
      api: {
        ...data,
        avatar_url: avatarUrl,
        username: data.username || nestedPerfil.alias || '',
        display_name: data.display_name || nestedPerfil.nombre || '',
        torneos_recientes: Array.isArray(torneosRecientes) ? torneosRecientes : [],
        estadisticas: data.estadisticas || {},
        deportes: Array.isArray(data.deportes) ? data.deportes : [],
        perfil: nestedPerfil,
      },
      perfil: nestedPerfil,
    };
  }

  const hasIdentity =
    data.user_id ||
    data.display_name ||
    data.username ||
    data.alias ||
    data.estadisticas ||
    avatarUrl;

  if (!hasIdentity) return null;

  const perfilSynth = {
    user_id: data.user_id,
    alias: data.username || data.alias || '',
    foto_url: data.foto_url || data.avatar_url || null,
    nombre: data.display_name || data.nombre || '',
    apellido: data.apellido || '',
    apodo: data.apodo || '',
    nivel: data.nivel,
    lateralidad: data.lateralidad,
    pais: data.pais,
    companero_id: data.companero_id,
    ultimo_companero_id: data.ultimo_companero_id,
    ciudad: data.ciudad,
    localidad: data.localidad,
    instagram_url: data.instagram_url,
    es_federado: data.es_federado,
    numero_fipa: data.numero_fipa,
    sede_id: data.sede_id,
    pendiente_validacion: data.pendiente_validacion,
    deportes_preferidos: data.deportes_preferidos,
  };

  return {
    api: {
      user_id: data.user_id,
      display_name: data.display_name || perfilSynth.nombre || '',
      username: perfilSynth.alias,
      avatar_url: avatarUrl,
      pais: data.pais ?? null,
      pais_flag: data.pais_flag ?? null,
      pais_nombre: data.pais_nombre ?? null,
      nivel: data.nivel ?? null,
      lateralidad: data.lateralidad ?? null,
      pendiente_validacion: Boolean(data.pendiente_validacion),
      estadisticas: data.estadisticas || {},
      deportes: Array.isArray(data.deportes) ? data.deportes : [],
      torneos_recientes: Array.isArray(torneosRecientes) ? torneosRecientes : [],
      perfil: perfilSynth,
      estadisticas_completas: data.estadisticas_completas || data.estadisticas || null,
    },
    perfil: perfilSynth,
  };
}
