/**
 * Listados en contexto torneo: nombre completo; si hay alias, "Nombre completo (Alias)".
 */
export function jugadorNombreTorneoEtiqueta(p) {
  if (!p || typeof p !== 'object') return '';
  const nombre = String(p.nombre || '').trim();
  const alias = String(p.alias || '').trim();
  if (nombre && alias) return `${nombre} (${alias})`;
  if (nombre) return nombre;
  if (alias) return alias;
  const em = String(p.email || '').trim();
  if (em) {
    const base = em.split('@')[0] || '';
    if (base) return base.charAt(0).toUpperCase() + base.slice(1);
  }
  return 'Jugador';
}
