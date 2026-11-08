const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function profileError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function assertUid(userId) {
  const uid = String(userId || '').trim();
  if (!UUID_RE.test(uid)) throw profileError('PROFILE_SESSION_INVALID', 'Sesión de usuario inválida.');
  return uid;
}

/** Pure resolver over the two lookup results. Errors are never treated as "no row". */
export function resolveCanonicalProfileRow({ userId, byUserId, byEmail }) {
  const uid = assertUid(userId);
  if (byUserId?.error) throw byUserId.error;
  if (byUserId?.data) {
    if (String(byUserId.data.user_id || '') !== uid) {
      throw profileError('PROFILE_UUID_MISMATCH', 'La fila del UUID de sesión no coincide.');
    }
    return byUserId.data;
  }
  if (byEmail?.error) throw byEmail.error;
  const emailRow = byEmail?.data ?? null;
  if (!emailRow) return null;
  // Email is a fallback only for an unowned legacy row. A row already owned by
  // any UUID (including the current one) must come from the UUID lookup.
  if (emailRow.user_id != null) {
    throw profileError('PROFILE_EMAIL_OTHER_USER', 'El email no es una fila legacy sin UUID.');
  }
  return emailRow;
}

/** UUID-authoritative read; email is only an unambiguous legacy fallback. */
export async function loadCanonicalProfile({ supabase, userId, email }) {
  const uid = assertUid(userId);
  const byUserId = await supabase
    .from('jugadores_perfil')
    .select('*')
    .eq('user_id', uid)
    .maybeSingle();
  if (byUserId?.error) throw byUserId.error;
  if (byUserId?.data) {
    const row = resolveCanonicalProfileRow({ userId: uid, byUserId });
    return { row, source: 'user_id' };
  }
  const em = String(email || '').trim();
  if (!em) return { row: null, source: null };
  const byEmail = await supabase
    .from('jugadores_perfil')
    .select('*')
    .eq('email', em)
    .is('user_id', null)
    .maybeSingle();
  const row = resolveCanonicalProfileRow({ userId: uid, byEmail });
  return { row, source: row ? 'email_fallback' : null };
}

function countError() {
  return profileError('PROFILE_ROW_COUNT', 'La operación de perfil no afectó exactamente una fila propia.');
}

/**
 * Update by id + ownership. A confirmed legacy NULL row is linked to this UUID
 * in the same conditional update (id AND user_id IS NULL AND session email),
 * so the deployed CHECK auth.uid()=user_id passes. Never merges another UUID.
 */
export async function updateOwnProfileRow({ supabase, row, userId, email, patch, select = '*' }) {
  const uid = assertUid(userId);
  if (!row || row.id == null) throw profileError('PROFILE_ROW_ID_MISSING', 'Falta la fila propia para actualizar.');
  let query;
  if (row.user_id == null) {
    const em = String(email || '').trim();
    if (!em) throw profileError('PROFILE_EMAIL_MISSING', 'Falta el email de sesión para vincular la fila legacy.');
    query = supabase
      .from('jugadores_perfil')
      .update({ ...patch, user_id: uid })
      .eq('id', row.id)
      .is('user_id', null)
      .eq('email', em);
  } else if (String(row.user_id) === uid) {
    query = supabase.from('jugadores_perfil').update(patch).eq('id', row.id).eq('user_id', uid);
  } else {
    throw profileError('PROFILE_OTHER_OWNER', 'No se puede actualizar una fila de otra cuenta.');
  }
  const { data, error } = await query.select(select);
  if (error) return { data: null, error };
  if (!Array.isArray(data) || data.length !== 1) return { data: null, error: countError() };
  const saved = data[0];
  if (String(saved.id) !== String(row.id) || String(saved.user_id) !== uid) {
    return { data: null, error: profileError('PROFILE_ROW_CHANGED', 'La actualización devolvió otra fila/propietario.') };
  }
  return { data: saved, error: null };
}

/** Insert a new own row; conflicts must be shown, never resolved by email upsert. */
export async function insertOwnProfileRow({ supabase, userId, payload, select = '*' }) {
  const uid = assertUid(userId);
  const row = { ...payload, user_id: uid };
  const { data, error } = await supabase.from('jugadores_perfil').insert(row).select(select);
  if (error) return { data: null, error };
  if (!Array.isArray(data) || data.length !== 1) return { data: null, error: countError() };
  if (data[0]?.id == null || String(data[0].user_id) !== uid) return { data: null, error: profileError('PROFILE_ROW_CHANGED', 'El insert devolvió otro propietario.') };
  return { data: data[0], error: null };
}

/** Reload and require the same row id/owner; zero rows is an error. */
export async function reloadOwnProfile({ supabase, userId, expectedId }) {
  const uid = assertUid(userId);
  if (expectedId == null) return { data: null, error: profileError('PROFILE_ROW_ID_MISSING', 'Falta el id esperado.') };
  const { data, error } = await supabase
    .from('jugadores_perfil')
    .select('*')
    .eq('id', expectedId)
    .eq('user_id', uid)
    .maybeSingle();
  if (error) return { data: null, error };
  if (!data) return { data: null, error: profileError('PROFILE_ROW_ZERO', 'No se releyó la fila propia.') };
  if (String(data.id) !== String(expectedId) || String(data.user_id) !== uid) {
    return { data: null, error: profileError('PROFILE_ROW_CHANGED', 'La relectura devolvió otra fila/propietario.') };
  }
  return { data, error: null };
}
