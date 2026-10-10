// Presentation only: never infer an actionable redemption state or change role scope.
export function normalizeCanjeEstado(raw) {
  const value = String(raw ?? '').trim().toLowerCase();
  if (value === 'pendiente') return 'pendiente';
  if (value === 'entregado' || value === 'entregada') return 'entregado';
  if (value === 'cancelado' || value === 'cancelada') return 'cancelado';
  return value ? 'desconocido' : 'sin_estado';
}

export function adminRoleIdentity(row = {}) {
  const name = String(row.nombre ?? '').trim();
  if (name && !/^sin\s+nombre$/i.test(name)) return name;
  return String(row.email ?? '').trim() || 'Identidad no disponible';
}

export function adminRoleScopeMismatch(row = {}) {
  return String(row.role ?? '').trim().toLowerCase() === 'admin_nacional'
    && String(row.alcance ?? '').trim().toLowerCase() === 'sede';
}
