import { nombreDesdeSesionSinEmail } from './displayName';
import { normalizeEmailStr } from './jugadorNombreTorneo';

function samePerson(a, b) {
  if (!a || !b) return false;
  if (a.id != null && b.id != null && String(a.id) === String(b.id)) return true;
  const ea = String(a.email || '').trim().toLowerCase();
  const eb = String(b.email || '').trim().toLowerCase();
  if (ea && eb && ea === eb) return true;
  const na = String(a.nombre || '').trim().toLowerCase();
  const nb = String(b.nombre || '').trim().toLowerCase();
  return Boolean(na && na === nb);
}

function jugadorCoincideConYoEquipo(p, yo, authUserId) {
  if (!p || !yo) return false;
  if (samePerson(p, yo)) return true;
  const pid = p.id != null && p.id !== '' ? String(p.id) : '';
  if (authUserId && pid && pid === String(authUserId)) return true;
  return false;
}

/** Fila JSON en `equipos.jugadores` para el usuario que crea el equipo (jugador 1). Siempre id + email + nombre (no solo id). */
export function buildCreadorJugadorParaEquipo(sess, userProfile, yo) {
  if (!sess?.user) return null;
  const user = sess.user;
  const userId = String(user.id || '').trim();
  if (!userId) return null;

  const emailAuth = String(user.email || '').trim();
  const emailRaw = String(emailAuth || (yo?.email != null ? String(yo.email) : '') || '').trim();
  const emailJugador = normalizeEmailStr(emailRaw) || emailRaw;

  const nombreJugador = String(
    nombreDesdeSesionSinEmail(userProfile, sess, String(yo?.nombre || '').trim())
  ).trim() || 'Jugador';

  const creadorJugador = {
    id: userId,
    email: emailJugador,
    nombre: nombreJugador,
    estado: 'confirmado',
    rol: 'creador',
  };
  const aliasTrim = String(userProfile?.alias || '').trim();
  if (aliasTrim) creadorJugador.alias = aliasTrim;
  return creadorJugador;
}

/** Una sola entrada del creador, siempre al inicio (dedupe por yo / auth id). */
export function ensureCreadorPrimeroEnLista(players, creadorJugador, yo, authUserId) {
  const list = Array.isArray(players) ? players : [];
  if (!creadorJugador || !authUserId) return list;
  const rest = list.filter((p) => !jugadorCoincideConYoEquipo(p, yo, authUserId));
  return [creadorJugador, ...rest];
}
