import { normalizeUserRole, readCachedUserRoleData } from './adminPanelRoles';

/** Aplica caché local solo si el email coincide con el de la sesión. */
export function readCachedUserRoleForEmail(email) {
  const em = String(email || '').trim().toLowerCase();
  if (!em) return null;
  const cached = readCachedUserRoleData();
  const cachedEmail = String(cached?.email || '').trim().toLowerCase();
  if (!cachedEmail || cachedEmail !== em) return null;
  const rol = normalizeUserRole(cached?.rol);
  if (!rol) return null;
  const sedeIdRaw = cached.sedeId;
  const sedeIdNum = sedeIdRaw != null && sedeIdRaw !== '' ? Number(sedeIdRaw) : null;
  return {
    email: cachedEmail,
    rol,
    nombre: cached.nombre ?? null,
    pais: cached.pais ?? null,
    sedeId: Number.isFinite(sedeIdNum) ? sedeIdNum : null,
    torneosOficialesHabilitados: cached.torneosOficialesHabilitados ?? false,
    source: 'cache',
  };
}

/**
 * Prioridad: API → Supabase → caché (mismo email). No devuelve fila con `rol` vacío si el caché tiene rol de panel.
 * @param {{ apiResult?: object|null, supabaseResult?: object|null, email: string }} params
 */
export function mergeUserRoleResults({ apiResult, supabaseResult, email }) {
  const em = String(email || '').trim().toLowerCase();
  const candidates = [apiResult, supabaseResult, readCachedUserRoleForEmail(em)].filter(Boolean);
  for (const c of candidates) {
    const rol = normalizeUserRole(c.rol);
    if (rol) {
      return {
        email: String(c.email || em).trim().toLowerCase(),
        rol,
        nombre: c.nombre ?? null,
        pais: c.pais ?? null,
        sedeId: c.sedeId ?? null,
        torneosOficialesHabilitados: c.torneosOficialesHabilitados ?? false,
      };
    }
  }
  return apiResult?.email || supabaseResult?.email || em
    ? {
        email: em,
        rol: null,
        nombre: apiResult?.nombre ?? supabaseResult?.nombre ?? null,
        pais: apiResult?.pais ?? supabaseResult?.pais ?? null,
        sedeId: apiResult?.sedeId ?? supabaseResult?.sedeId ?? null,
        torneosOficialesHabilitados: false,
      }
    : null;
}
