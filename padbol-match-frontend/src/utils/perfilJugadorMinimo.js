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

/** Sesión iniciada con Google. */
export function authSessionUsaProveedorGoogle(session) {
  const p = String(session?.user?.app_metadata?.provider || '').toLowerCase();
  if (p === 'google') return true;
  const idents = session?.user?.identities;
  if (Array.isArray(idents)) {
    return idents.some((i) => String(i?.provider || '').toLowerCase() === 'google');
  }
  return false;
}

/** Sesión iniciada con Facebook (mismo flujo de completar perfil que Google). */
export function authSessionUsaProveedorFacebook(session) {
  const p = String(session?.user?.app_metadata?.provider || '').toLowerCase();
  if (p === 'facebook') return true;
  const idents = session?.user?.identities;
  if (Array.isArray(idents)) {
    return idents.some((i) => String(i?.provider || '').toLowerCase() === 'facebook');
  }
  return false;
}

/**
 * OAuth social (Google / Facebook): no crear `jugadores_perfil` vacío desde AuthContext;
 * el usuario puede completar WhatsApp y género en `/completar-perfil` al usar una acción que lo exija.
 */
export function authSessionUsaOAuthProveedorSocial(session) {
  return authSessionUsaProveedorGoogle(session) || authSessionUsaProveedorFacebook(session);
}

/** Rutas que exigen género + WhatsApp antes de continuar (no el hub ni /reservar: el pago valida en ReservaForm). */
export function rutaExigePerfilJugadorMinimo(pathname) {
  const p = String(pathname || '')
    .split('?')[0]
    .split('#')[0]
    .replace(/\/+$/, '') || '/';
  if (p === '/jugar/armar' || p.startsWith('/jugar/armar/')) return true;
  return false;
}

/** Hub / jugar: claves de acción con el mismo requisito al navegar (sin reservar: explorar sin login). */
const HUB_ACCIONES_PERFIL_MINIMO = new Set(['armar_partido']);

export function hubAccionExigePerfilJugadorMinimo(actionKey) {
  return HUB_ACCIONES_PERFIL_MINIMO.has(String(actionKey || '').trim());
}

/**
 * Navega a `targetPath` o a completar perfil si faltan datos mínimos.
 * @returns {boolean} true si navegó al destino; false si redirigió a completar perfil.
 */
export function intentarNavegarConPerfilJugadorMinimo(navigate, userProfile, targetPath) {
  const dest = String(targetPath || '').trim();
  if (!dest) return false;
  const pathOnly = dest.split('?')[0].split('#')[0];
  if (!rutaExigePerfilJugadorMinimo(pathOnly)) {
    navigate(dest);
    return true;
  }
  if (perfilJugadorDatosMinimosCompletos(userProfile)) {
    navigate(dest);
    return true;
  }
  navigate('/completar-perfil', { state: { from: pathOnly } });
  return false;
}

/** Variante para cards del hub: valida por clave de acción y path destino. */
export function intentarNavegarHubConPerfilJugadorMinimo(navigate, userProfile, actionKey, targetPath) {
  const dest = String(targetPath || '').trim();
  if (!dest) return false;
  const pathOnly = dest.split('?')[0].split('#')[0];
  const exige =
    hubAccionExigePerfilJugadorMinimo(actionKey) || rutaExigePerfilJugadorMinimo(pathOnly);
  if (!exige) {
    navigate(dest);
    return true;
  }
  if (perfilJugadorDatosMinimosCompletos(userProfile)) {
    navigate(dest);
    return true;
  }
  navigate('/completar-perfil', { state: { from: pathOnly } });
  return false;
}
