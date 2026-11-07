/**
 * Señal de recuperación asociada a una identidad: Supabase puede emitir PASSWORD_RECOVERY al
 * inicializarse (antes de montar React). Se guarda SOLO el user.id (nunca tokens ni emails).
 */
let usuarioRecuperacion = null;
const oyentes = new Set();

export function marcarRecuperacion(userId) {
  usuarioRecuperacion = userId ? String(userId) : null;
  for (const fn of oyentes) { try { fn(); } catch { /* noop */ } }
}
export function usuarioEnRecuperacion() { return usuarioRecuperacion; }
export function limpiarRecuperacion() { usuarioRecuperacion = null; }
export function suscribirRecuperacion(fn) {
  oyentes.add(fn);
  if (usuarioRecuperacion) { try { fn(); } catch { /* noop */ } }
  return () => oyentes.delete(fn);
}
export function vigilarRecuperacion(auth) {
  if (!auth || typeof auth.onAuthStateChange !== 'function') return;
  auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') marcarRecuperacion(session?.user?.id);
    else if (event === 'SIGNED_OUT') limpiarRecuperacion();
    else if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED') {
      if (usuarioRecuperacion && session?.user?.id && String(session.user.id) !== usuarioRecuperacion) limpiarRecuperacion();
    }
  });
}
