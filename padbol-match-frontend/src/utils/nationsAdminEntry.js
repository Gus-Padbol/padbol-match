const DURABLE_STAFF = new Set(['super_admin', 'admin_club', 'admin_sede']);

/** Visible entry only for roles accepted by the durable panel; admin_nacional needs an explicit policy first. */
export function canShowNationsAdminEntry({torneo, rol, isAdmin, fromAdmin} = {}) {
  if (!torneo || fromAdmin === true) return false;
  const normalized = String(rol || '').trim().toLowerCase();
  if (normalized === 'admin_nacional') return false;
  return isAdmin === true || DURABLE_STAFF.has(normalized);
}
