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
      .maybeSingle();
    return { data, error };
  }
  return { data: null, error: null };
}

/**
 * INSERT … ON CONFLICT (user_id) o actualización por fila existente (id / email legacy).
 * Requiere índice único `jugadores_perfil_user_id_unique` en Supabase.
 */
export async function upsertJugadorPerfilPorSesion({ userId, email, row }) {
  const uid = String(userId || '').trim();
  if (!uid) {
    return { data: null, error: new Error('Sesión inválida (sin user_id).') };
  }
  const em = String(email || '').trim().toLowerCase() || null;
  const patch = { ...row, user_id: uid };
  if (em) patch.email = em;

  const { data: existing, error: findErr } = await findJugadorPerfilPorSesion(uid, em);
  if (findErr) return { data: null, error: findErr };

  if (existing?.id) {
    const nombreActual = String(existing.nombre || '').trim();
    const updatePayload = { ...patch };
    if (nombreActual && patch.nombre && nombreActual !== 'Jugador') {
      delete updatePayload.nombre;
    }
    if (existing.apellido && patch.apellido == null) {
      delete updatePayload.apellido;
    }
    return supabase.from('jugadores_perfil').update(updatePayload).eq('id', existing.id).select().single();
  }

  let result = await supabase
    .from('jugadores_perfil')
    .upsert(patch, { onConflict: 'user_id' })
    .select()
    .single();

  if (!result.error || !em) return result;

  const dup = String(result.error.message || '').toLowerCase();
  if (dup.includes('duplicate') || String(result.error.code || '') === '23505') {
    result = await supabase
      .from('jugadores_perfil')
      .upsert(patch, { onConflict: 'email' })
      .select()
      .single();
  }
  return result;
}
