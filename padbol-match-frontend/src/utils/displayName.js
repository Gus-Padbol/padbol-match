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
