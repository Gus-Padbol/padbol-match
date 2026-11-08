import { supabase } from '../supabaseClient';

/**
 * Busca fila propia: primero `user_id`, luego email de sesión (filas legacy sin user_id).
 */
export async function findJugadorPerfilPorSesion(userId, email) {
  const uid = String(userId || '').trim();
  const em = String(email || '').trim().toLowerCase();
  if (uid) {
    const { data, error } = await supabase
      .from('jugadores_perfil')
      .select('id, user_id, email, nombre, apellido')
      .eq('user_id', uid)
      .maybeSingle();
    if (error) return { data: null, error };
    if (data?.id) return { data, error: null };
  }
  if (em) {
    const { data, error } = await supabase
      .from('jugadores_perfil')
      .select('id, user_id, email, nombre, apellido')
      .eq('email', em)
      .is('user_id', null)
      .maybeSingle();
    if (error) return { data: null, error };
    if (data?.user_id != null && String(data.user_id) !== uid) {
      const conflict = new Error('El email pertenece a otra cuenta.');
      conflict.code = 'PROFILE_EMAIL_OTHER_USER';
      return { data: null, error: conflict };
    }
    return { data, error: null };
  }
  return { data: null, error: null };
}

/**
 * INSERT … ON CONFLICT (user_id) o actualización por fila existente (id / email legacy).
 * Requiere índice único `jugadores_perfil_user_id_unique` en Supabase.
 */
export async function upsertJugadorPerfilPorSesion({ userId, email, row, isCurrent }) {
  const uid = String(userId || '').trim();
  if (!uid) {
    return { data: null, error: new Error('Sesión inválida (sin user_id).') };
  }
  const em = String(email || '').trim().toLowerCase() || null;
  const patch = { ...row, user_id: uid };
  if (em) patch.email = em;

  const { data: existing, error: findErr } = await findJugadorPerfilPorSesion(uid, em);
  if (findErr) return { data: null, error: findErr };
  const stillCurrent = isCurrent || (async () => {
    try {
      const result = await supabase.auth.getSession();
      if (!result || result.error) return false;
      return String(result.data?.session?.user?.id || '') === uid;
    } catch {
      return false;
    }
  });
  if (!(await stillCurrent())) {
    const changed = new Error('La sesión cambió durante la lectura del perfil.');
    changed.code = 'PROFILE_SESSION_CHANGED';
    return { data: null, error: changed };
  }

  if (existing?.id) {
    const nombreActual = String(existing.nombre || '').trim();
    const updatePayload = { ...patch };
    if (nombreActual && patch.nombre && nombreActual !== 'Jugador') {
      delete updatePayload.nombre;
    }
    if (existing.apellido && patch.apellido == null) {
      delete updatePayload.apellido;
    }
    // A confirmed own legacy NULL is linked to this UUID in the same conditional update.
    let updateQuery = supabase.from('jugadores_perfil').update(updatePayload).eq('id', existing.id);
    if (existing.user_id == null) {
      if (!em) return { data: null, error: new Error('Falta el email de sesión para vincular la fila legacy.') };
      updateQuery = updateQuery.is('user_id', null).eq('email', em);
    } else {
      updateQuery = updateQuery.eq('user_id', uid);
    }
    return updateQuery.select().single();
  }

  // UUID-only conflict target. An email conflict is surfaced; never resolved by email.
  return supabase
    .from('jugadores_perfil')
    .upsert(patch, { onConflict: 'user_id' })
    .select()
    .single();
}
