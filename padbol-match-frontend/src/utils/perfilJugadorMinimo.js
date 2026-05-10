import { whatsappDigitsValido } from './authIdentidad';

const GENEROS_PERFIL_OK = new Set(['masculino', 'femenino', 'otro', 'open']);

/**
 * Perfil de jugador con WhatsApp y género listos para usar la app (mismo criterio que el alta por email).
 */
export function perfilJugadorDatosMinimosCompletos(perfil) {
  if (!perfil || typeof perfil !== 'object') return false;
  const g = String(perfil.genero || '').trim().toLowerCase();
  if (!GENEROS_PERFIL_OK.has(g)) return false;
  if (!whatsappDigitsValido(perfil.whatsapp)) return false;
  return true;
}

/** Sesión iniciada con Google (u otro proveedor OAuth de Google). */
export function authSessionUsaProveedorGoogle(session) {
  const p = String(session?.user?.app_metadata?.provider || '').toLowerCase();
  if (p === 'google') return true;
  const idents = session?.user?.identities;
  if (Array.isArray(idents)) {
    return idents.some((i) => String(i?.provider || '').toLowerCase() === 'google');
  }
  return false;
}
