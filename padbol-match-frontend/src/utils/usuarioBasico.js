const STORAGE_KEY = 'padbolUsuarioBasico';

export function getOrCreateUsuarioBasico() {
  if (typeof window === 'undefined') {
    return { id: 'temp', nombre: 'Jugador' };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const u = JSON.parse(raw);
      if (u && typeof u.id === 'string' && u.id.length > 0) {
        return { id: u.id, nombre: typeof u.nombre === 'string' && u.nombre.trim() ? u.nombre.trim() : 'Jugador' };
      }
    }
  } catch {
    /* ignore */
  }
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `jug_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
  const usuario = { id, nombre: 'Jugador' };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(usuario));
  } catch {
    /* ignore */
  }
  return usuario;
}
