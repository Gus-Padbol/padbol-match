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

/**
 * Respaldo directo a `user_roles` (RLS: fila con `user_id` = auth.uid()).
 * Si la API `/api/auth/mi-rol` falla o devuelve rol null, intenta leer el rol aquí.
 * @param {{ id?: string, email?: string }|null} authUser — `session.user`
 */
export async function fetchUserRoleFromSupabase(authUser) {
  const uid = authUser?.id ? String(authUser.id).trim() : '';
  const email = String(authUser?.email || '').trim().toLowerCase();
  if (!uid && !email) return null;

  const selectFull =
    'role, sede_id, nombre, pais, email, torneos_oficiales_habilitados, user_id';
  const selectMin = 'role, sede_id, nombre, pais, email';

  async function runSelect(cols, filter) {
    let q = await supabase.from('user_roles').select(cols);
    q = filter(q);
    if (q.error && /colum|column/i.test(String(q.error.message || ''))) {
      let q2 = await supabase.from('user_roles').select(selectMin);
      q2 = filter(q2);
      return q2;
    }
    return q;
  }

  if (uid) {
    const byUid = await runSelect(selectFull, (q) => q.eq('user_id', uid).maybeSingle());
    const mapped = mapUserRoleRow(byUid.data, email);
    if (mapped) return mapped;
  }

  if (email) {
    const byEmail = await runSelect(selectFull, (q) => q.eq('email', email).maybeSingle());
    const mapped = mapUserRoleRow(byEmail.data, email);
    if (mapped) return mapped;
  }

  return null;
}
