import { nombreCompletoJugadorPerfil } from './jugadorPerfil';

function looksLikeEmailStr(s) {
  return typeof s === 'string' && s.includes('@');
}

/**
 * Nombre visible: alias DB → primer token nombre DB → metadata auth → email local → "Jugador".
 */
export function getDisplayName(perfil, session) {
  const alias = String(perfil?.alias ?? '').trim();
  if (alias) return alias;

  const fromNombre = String(perfil?.nombre ?? '').trim().split(/\s+/).filter(Boolean)[0];
  if (fromNombre) return fromNombre;

  const meta = session?.user?.user_metadata?.nombre;
  const fromMeta = String(meta ?? '').trim().split(/\s+/).filter(Boolean)[0];
  if (fromMeta) return fromMeta;

  if (session?.user?.email) {
    return session.user.email.split('@')[0];
  }

  return 'Jugador';
}

/**
 * Nombre del usuario logueado solo desde `jugadores_perfil` en contexto + metadatos OAuth.
 * No usa email ni parte local del email como nombre visible; no hace lookups externos.
 * Orden: `perfil.nombre` → nombre+apellido en perfil → `user_metadata.full_name` → otros metadatos → `nombreFallback` (si no es el slug del mail).
 */
export function nombreDesdeSesionSinEmail(perfil, session, nombreFallback = '') {
  if (perfil && typeof perfil === 'object') {
    const soloNombre = String(perfil.nombre || '').trim();
    if (soloNombre) return soloNombre;
    const nc = nombreCompletoJugadorPerfil(perfil).trim();
    if (nc) return nc;
    const alias = String(perfil.alias || '').trim();
    if (alias && !looksLikeEmailStr(alias)) return alias;
  }

  const u = session?.user;
  const emailLocal = (() => {
    const em = String(u?.email || '').trim();
    if (!em.includes('@')) return '';
    return em.split('@')[0].toLowerCase();
  })();

  if (u) {
    const fullName = String(u.user_metadata?.full_name || '').trim();
    if (fullName && !looksLikeEmailStr(fullName)) return fullName;
    const meta = String(
      u.user_metadata?.name ||
        u.user_metadata?.given_name ||
        u.user_metadata?.preferred_username ||
        u.user_metadata?.nombre ||
        ''
    ).trim();
    if (meta && !looksLikeEmailStr(meta)) return meta;
  }

  const fb = String(nombreFallback || '').trim();
  if (fb && !looksLikeEmailStr(fb)) {
    const fbl = fb.toLowerCase();
    if (!emailLocal || fbl !== emailLocal) return fb;
  }

  return '';
}
