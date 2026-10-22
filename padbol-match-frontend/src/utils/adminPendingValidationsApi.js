export async function fetchAdminPendingValidations({ apiBaseUrl, accessToken, signal }) {
  if (!accessToken) throw new Error('Sesión no disponible');
  const response = await fetch(`${String(apiBaseUrl).replace(/\/$/, '')}/api/admin/validaciones`, {
    headers: { Authorization: `Bearer ${accessToken}` }, signal,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !Array.isArray(data.validaciones)) throw new Error(data.error || 'No se pudieron cargar las validaciones');
  return data.validaciones;
}

export async function updatePendingValidation({ apiBaseUrl, accessToken, id, accion, nivel, motivo }) {
  if (!accessToken) throw new Error('Sesión no disponible');
  if (!/^[1-9]\d*$/.test(String(id)) || (typeof id === 'number' && !Number.isSafeInteger(id))) throw new Error('Perfil inválido');
  const response = await fetch(`${String(apiBaseUrl).replace(/\/$/, '')}/api/admin/validaciones/perfil/${encodeURIComponent(String(id))}`, {
    method: 'PATCH', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ accion, nivel, motivo }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok !== true) throw new Error(data.error || 'No se pudo confirmar el cambio de validación.');
}
