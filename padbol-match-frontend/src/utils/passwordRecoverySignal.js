/**
 * Señal temprana de recuperación: Supabase puede emitir PASSWORD_RECOVERY al inicializarse
 * (detectSessionInUrl), antes de que React monte el callback. Se guarda en memoria y se avisa
 * a quien se suscriba después.
 */
let recuperacionPendiente = false;
const oyentes = new Set();

export function marcarRecuperacion() {
  recuperacionPendiente = true;
  for (const fn of oyentes) { try { fn(); } catch { /* noop */ } }
}
export function hayRecuperacionPendiente() { return recuperacionPendiente; }
export function consumirRecuperacion() { recuperacionPendiente = false; }
export function suscribirRecuperacion(fn) {
  oyentes.add(fn);
  if (recuperacionPendiente) { try { fn(); } catch { /* noop */ } }
  return () => oyentes.delete(fn);
}
export function vigilarRecuperacion(auth) {
  if (!auth || typeof auth.onAuthStateChange !== 'function') return;
  auth.onAuthStateChange((event) => { if (event === 'PASSWORD_RECOVERY') marcarRecuperacion(); });
}
