import { supabase } from '../supabaseClient';
import { normalizeUserRole } from './adminPanelRoles';

function mapUserRoleRow(row, fallbackEmail) {
  if (!row) return null;
  const email = String(row.email || fallbackEmail || '')
    .trim()
    .toLowerCase();
  const sedeIdRaw = row.sede_id;
  const sedeIdNum = sedeIdRaw != null && sedeIdRaw !== '' ? Number(sedeIdRaw) : null;
  const rol = normalizeUserRole(row.role ?? row.rol);
  if (!rol) return null;
  return {
    email: email || fallbackEmail,
    rol,
    nombre: row.nombre ?? null,
    pais: row.pais ?? null,
    sedeId: Number.isFinite(sedeIdNum) ? sedeIdNum : null,
    torneosOficialesHabilitados: Boolean(row.torneos_oficiales_habilitados),
    source: 'supabase',
  };
}

function rowFromSupabaseResult(data, error, fallbackEmail) {
  if (error) {
    if (error.code === 'PGRST116') return null;
    console.warn('fetchUserRoleFromSupabase:', error.message || error);
    return null;
  }
  return mapUserRoleRow(data, fallbackEmail);
}

/**
 * Respaldo directo a `user_roles` (RLS: fila con `user_id` = auth.uid()).
 * @param {{ id?: string, email?: string }|null} authUser — `session.user`
 */
export async function fetchUserRoleFromSupabase(authUser) {
  const userId = authUser?.id ? String(authUser.id).trim() : '';
  const userEmail = String(authUser?.email || '').trim().toLowerCase();
  if (!userId && !userEmail) return null;

  if (userId) {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role, sede_id, nombre, pais, email, torneos_oficiales_habilitados')
      .eq('user_id', userId)
      .maybeSingle();
    const byUserId = rowFromSupabaseResult(data, error, userEmail);
    if (byUserId) return byUserId;
  }

  if (userEmail) {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role, sede_id, nombre, pais, email, torneos_oficiales_habilitados')
      .eq('email', userEmail)
      .maybeSingle();
    const byEmail = rowFromSupabaseResult(data, error, userEmail);
    if (byEmail) return byEmail;
  }

  return null;
}
