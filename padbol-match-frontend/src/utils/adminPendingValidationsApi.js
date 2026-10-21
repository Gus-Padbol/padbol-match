export async function fetchAdminPendingValidations({ apiBaseUrl, accessToken, signal }) {
  if (!accessToken) throw new Error('Sesión no disponible');
  const response = await fetch(`${String(apiBaseUrl).replace(/\/$/, '')}/api/admin/validaciones`, {
    headers: { Authorization: `Bearer ${accessToken}` }, signal,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !Array.isArray(data.validaciones)) throw new Error(data.error || 'No se pudieron cargar las validaciones');
  return data.validaciones;
}

export async function updatePendingValidation(db, email, changes) {
  const { data, error } = await db.from('jugadores_perfil').update(changes)
    .eq('email', email).eq('pendiente_validacion', true).select('email').maybeSingle();
  if (error || !data) throw new Error('No se pudo confirmar el cambio de validación.');
}
