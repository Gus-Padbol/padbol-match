import { supabase } from '../supabaseClient';
import { nombreCompletoJugadorPerfil } from './jugadorPerfil';
import { nombreDesdeSesionSinEmail } from './displayName';

/**
 * @typedef {{
 *   perfilByEmailLower?: Map<string, object>;
 *   jugadoresTorneo?: object[];
 *   authSessionEmail?: string | null;
 *   perfilSesion?: object | null;
 *   authSession?: object | null;
 *   authUserId?: string | null;
 * }} JugadorNombreTorneoCtx
 */

function looksLikeEmail(s) {
  return typeof s === 'string' && s.includes('@');
}

function etiquetaConAlias(nombreCompleto, aliasTrim) {
  const n = String(nombreCompleto || '').trim();
  const a = String(aliasTrim || '').trim();
  if (n && a) return `${n} (${a})`;
  return n || a || '';
}

function nombreDesdePerfil(perfil) {
  if (!perfil || typeof perfil !== 'object') return '';
  const full = nombreCompletoJugadorPerfil(perfil);
  const soloNombre = String(perfil.nombre || '').trim();
  const base = full || soloNombre;
  return etiquetaConAlias(base, perfil.alias);
}

/**
 * Email listo para matchear con jugadores_perfil / jugadores_torneo (trim + minúsculas + sin espacios internos).
 * Usar SIEMPRE antes de mapas y consultas.
 */
export function normalizeEmailStr(raw) {
  if (raw == null || raw === '') return '';
  return String(raw).replace(/\s+/g, '').trim().toLowerCase();
}

/** Email normalizado desde un jugador (objeto con `email`). */
export function normalizeJugadorEmail(p) {
  if (!p || typeof p !== 'object') return '';
  return normalizeEmailStr(p.email);
}

/** Evita mostrar como nombre la parte local del mail del jugador (p. ej. padbolmatchsaas). */
function candidatoNombreNoEsSoloLocalDelEmail(p, candidato) {
  const n = String(candidato || '').trim();
  if (!n || looksLikeEmail(n)) return false;
  const raw = String(p?.email || '').trim();
  if (!raw.includes('@')) return true;
  const loc = normalizeEmailStr(raw.split('@')[0]);
  return normalizeEmailStr(n) !== loc;
}

function nombreDesdeJugadoresTorneoPorEmail(emailNorm, jugadoresTorneo) {
  if (!emailNorm || !Array.isArray(jugadoresTorneo) || !jugadoresTorneo.length) return '';
  const row = jugadoresTorneo.find((j) => normalizeEmailStr(j.email) === emailNorm);
  if (!row) return '';
  const n = String(row.nombre || '').trim();
  if (!n || looksLikeEmail(n)) return '';
  return candidatoNombreNoEsSoloLocalDelEmail({ email: row.email }, n) ? n : '';
}

/** Misma cuenta que la sesión: por `p.id` auth o por email igual al del usuario logueado. */
function esMismaCuentaQueSesion(p, ctx) {
  const authUid =
    ctx?.authUserId != null && ctx.authUserId !== '' ? String(ctx.authUserId).trim() : '';
  const pid = p?.id != null && p.id !== '' ? String(p.id).trim() : '';
  if (authUid && pid && pid === authUid) return true;
  const email = normalizeJugadorEmail(p);
  const sessionEmailNorm = normalizeEmailStr(ctx?.authSessionEmail ?? '');
  return Boolean(email && sessionEmailNorm && email === sessionEmailNorm);
}

/**
 * Si es el usuario logueado → solo perfil en contexto + metadata OAuth (sin lookups).
 * Para el resto → jugadores_perfil, jugadores_torneo, nombre en fila, etc.
 */
export function nombreDisplayJugadorTorneo(p, ctx) {
  if (!p || typeof p !== 'object') return '';

  if (esMismaCuentaQueSesion(p, ctx)) {
    return nombreDesdeSesionSinEmail(
      ctx?.perfilSesion,
      ctx?.authSession ?? null,
      String(p?.nombre || '').trim()
    );
  }

  const email = normalizeJugadorEmail(p);
  const byEm = ctx?.perfilByEmailLower;

  if (email && byEm instanceof Map && byEm.has(email)) {
    const t = nombreDesdePerfil(byEm.get(email));
    if (t) return t;
  }

  const desdeTorneo = nombreDesdeJugadoresTorneoPorEmail(email, ctx?.jugadoresTorneo);
  if (desdeTorneo) return desdeTorneo;

  const rawNombre = String(p.nombre || '').trim();
  if (rawNombre && candidatoNombreNoEsSoloLocalDelEmail(p, rawNombre)) {
    const ap = String(p.apellido || '').trim();
    if (ap) return `${rawNombre} ${ap}`.trim();
    return rawNombre;
  }

  return '';
}

/**
 * Etiqueta para listados (sin mostrar email como nombre).
 */
export function jugadorNombreTorneoEtiqueta(p, ctx) {
  const fromCtx = nombreDisplayJugadorTorneo(p, ctx);
  if (fromCtx) return fromCtx;

  if (esMismaCuentaQueSesion(p, ctx)) return 'Jugador';

  const nombre = String(p?.nombre || '').trim();
  const alias = String(p?.alias || '').trim();
  if (nombre && candidatoNombreNoEsSoloLocalDelEmail(p, nombre)) {
    if (alias && candidatoNombreNoEsSoloLocalDelEmail(p, alias)) return `${nombre} (${alias})`;
    return nombre;
  }
  if (alias && candidatoNombreNoEsSoloLocalDelEmail(p, alias)) return alias;

  return 'Jugador';
}

/** Mapa email normalizado → fila jugadores_perfil. */
export function buildJugadorPerfilLookupMaps(perfiles) {
  const byEmailLower = new Map();
  if (!Array.isArray(perfiles)) return { perfilByEmailLower: byEmailLower };
  for (const row of perfiles) {
    if (!row || typeof row !== 'object') continue;
    const e = normalizeEmailStr(row.email);
    if (e) byEmailLower.set(e, row);
  }
  return { perfilByEmailLower: byEmailLower };
}

/**
 * Carga jugadores_perfil por cada email (ILIKE exacto, insensible a mayúsculas).
 * Evita `.in('email', …)` cuando en BD el email no coincide en casing con el JSON.
 */
export async function fetchJugadoresPerfilPorJugadores(players) {
  const list = Array.isArray(players) ? players : [];
  const emailsNorm = [...new Set(list.map((p) => normalizeJugadorEmail(p)).filter(Boolean))];
  if (!emailsNorm.length) return [];

  const merged = new Map();

  await Promise.all(
    emailsNorm.map(async (em) => {
      const { data, error } = await supabase
        .from('jugadores_perfil')
        .select('user_id, nombre, apellido, alias, email, whatsapp')
        .ilike('email', em)
        .limit(3);

      if (error) {
        console.error('fetchJugadoresPerfilPorJugadores', em, error);
        return;
      }
      for (const row of data || []) {
        const k = normalizeEmailStr(row.email);
        if (k && !merged.has(k)) merged.set(k, row);
      }
    })
  );

  return Array.from(merged.values());
}
