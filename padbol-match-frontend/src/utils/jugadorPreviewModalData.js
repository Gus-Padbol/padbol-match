import { nombreCompletoJugadorPerfil, formatAliasConArroba } from './jugadorPerfil';
import { jugadorTorneoFotoUrl, normalizeJugadorEmail } from './jugadorNombreTorneo';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function perfilRowDesdeCtx(p, ctx) {
  const em = normalizeJugadorEmail(p);
  if (em && ctx?.perfilByEmailLower instanceof Map && ctx.perfilByEmailLower.has(em)) {
    return ctx.perfilByEmailLower.get(em);
  }
  const uid = String(p?.user_id ?? p?.id ?? '').trim();
  if (uid && UUID_RE.test(uid) && ctx?.perfilByUserId instanceof Map && ctx.perfilByUserId.has(uid)) {
    return ctx.perfilByUserId.get(uid);
  }
  return null;
}

/**
 * Datos para {@link JugadorPreviewModal}: foto, nombre, alias, categoría, sede (club habitual).
 * @param {object|null} p jugador en JSON de equipo / listado
 * @param {import('./jugadorNombreTorneo').JugadorNombreTorneoCtx & { perfilByUserId?: Map<string, object> }|null} ctx opcional
 */
function esFilaRankingApi(p) {
  return (
    p &&
    typeof p === 'object' &&
    typeof p.puntos_total === 'number' &&
    Number.isFinite(p.puntos_total)
  );
}

export function buildJugadorPreviewModalData(p, ctx) {
  if (!p || typeof p !== 'object') {
    return {
      foto_url: '',
      nombreCompleto: '—',
      aliasLabel: '—',
      aliasSlug: '',
      categoria: '—',
      sede: '—',
      puntosTotal: null,
      torneosCount: null,
    };
  }
  const perfRow = perfilRowDesdeCtx(p, ctx);
  const rankingLike = esFilaRankingApi(p);

  const nombreCompleto =
    nombreCompletoJugadorPerfil(perfRow) ||
    [p.nombre, p.apellido].filter((x) => String(x || '').trim()).join(' ').trim() ||
    String(p.nombre || '').trim() ||
    '—';

  const foto =
    String(perfRow?.foto_url || '').trim() ||
    (ctx && jugadorTorneoFotoUrl(p, ctx)) ||
    String(p.foto_url || '').trim() ||
    '';

  const aliasRaw = String(perfRow?.alias || p.alias || '').trim();
  const aliasSlug = aliasRaw.replace(/^@+/u, '').trim();

  const categoria = String(perfRow?.nivel || p.nivel || '').trim() || '—';

  let sede = String(perfRow?.ciudad || p.ciudad || '').trim() || '—';
  if (rankingLike) {
    const pais = String(p.pais || '').trim();
    sede = pais || '—';
  }

  const puntosTotal =
    typeof p.puntos_total === 'number' && Number.isFinite(p.puntos_total) ? p.puntos_total : null;
  const torneosCount =
    typeof p.torneos_count === 'number' && Number.isFinite(p.torneos_count) ? p.torneos_count : null;

  return {
    foto_url: foto,
    nombreCompleto,
    aliasLabel: aliasRaw ? formatAliasConArroba(aliasRaw) : '—',
    aliasSlug,
    categoria: categoria || '—',
    sede: sede || '—',
    puntosTotal,
    torneosCount,
  };
}
