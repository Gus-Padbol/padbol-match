import { nombreCompletoJugadorPerfil } from './jugadorPerfil';

function esNombrePlaceholderJugador(s) {
  return String(s || '').trim().toLowerCase() === 'jugador';
}

function capitalizarPrimeraLetraSaludo(s) {
  const t = String(s || '').trim();
  if (!t) return '';
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function looksLikeEmailStr(s) {
  return typeof s === 'string' && s.includes('@');
}

function parteLocalEmailLower(email) {
  const em = String(email || '').trim();
  if (!em.includes('@')) return '';
  return em.split('@')[0].toLowerCase();
}

/**
 * Nombre legible solo desde fila `jugadores_perfil` (nombre + apellido).
 * No deriva nada del email en código: solo evita mostrar la parte local del mail
 * o un string que sea el email completo como si fuera nombre.
 */
export function nombreDesdeFilaJugadoresPerfil(row, userEmail) {
  if (!row || typeof row !== 'object') return '';
  const nc = nombreCompletoJugadorPerfil(row).trim();
  const n = String(row.nombre || '').trim();
  const candidato = nc || n;
  if (!candidato) return '';
  if (looksLikeEmailStr(candidato)) return '';
  const local = parteLocalEmailLower(userEmail);
  if (local && candidato.toLowerCase() === local) return '';
  return candidato;
}

/**
 * Nombre para UI cuando hay `perfil` en contexto y sesión (email en `session.user`).
 * Únicamente `jugadores_perfil`; si no hay nombre útil → "Jugador".
 */
export function getDisplayName(perfil, session) {
  const em = String(session?.user?.email || perfil?.email || '').trim();
  return nombreDesdeFilaJugadoresPerfil(perfil, em) || 'Jugador';
}

/**
 * Igual que {@link getDisplayName} pero devuelve cadena vacía si no hay nombre (sin "Jugador").
 * Útil para combinar con `nombreFallback` en formularios.
 */
export function nombreDesdeSesionSinEmail(perfil, session, nombreFallback = '') {
  const em = String(session?.user?.email || perfil?.email || '').trim();
  const fromDb = nombreDesdeFilaJugadoresPerfil(perfil, em);
  if (fromDb) return fromDb;
  const fb = String(nombreFallback || '').trim();
  if (!fb || looksLikeEmailStr(fb)) return '';
  const local = parteLocalEmailLower(em);
  if (local && fb.toLowerCase() === local) return '';
  return fb;
}

/**
 * Nombre legal o de registro sin usar `alias`: perfil Supabase y, si falta, metadata de auth
 * (`full_name` / `name` de Google u otros proveedores).
 */
export function nombreRealDesdePerfilOauth(perfil, session) {
  const em = String(session?.user?.email || perfil?.email || '').trim();
  let fromDb = nombreDesdeSesionSinEmail(perfil, session, '');
  if (fromDb && esNombrePlaceholderJugador(fromDb)) fromDb = '';
  if (fromDb) return fromDb;

  const meta = session?.user?.user_metadata || {};
  const full = String(meta.full_name || '').trim();
  const local = parteLocalEmailLower(em);
  if (full && !looksLikeEmailStr(full) && !(local && full.toLowerCase() === local)) return full;

  const n = String(meta.nombre || '').trim();
  const a = String(meta.apellido || '').trim();
  const joined = [n, a].filter(Boolean).join(' ').trim();
  if (joined && !esNombrePlaceholderJugador(joined)) return joined;

  const nameMeta = String(meta.name || '').trim();
  if (nameMeta && !looksLikeEmailStr(nameMeta) && !(local && nameMeta.toLowerCase() === local)) return nameMeta;

  return '';
}

/**
 * Texto de identidad en el header: `jugadores_perfil.apodo` si existe;
 * si no, nombre real (tabla o metadata de auth). No usa `alias`.
 */
export function headerNombreVisible(perfil, session) {
  const apodo = String(perfil?.apodo ?? '').trim();
  if (apodo) return capitalizarPrimeraLetraSaludo(apodo);

  const real = nombreRealDesdePerfilOauth(perfil, session);
  if (real) return real;

  const em = String(session?.user?.email || perfil?.email || '').trim();
  return em || 'Cuenta';
}
