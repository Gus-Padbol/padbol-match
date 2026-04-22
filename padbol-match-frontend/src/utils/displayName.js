import { nombreCompletoJugadorPerfil } from './jugadorPerfil';

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
