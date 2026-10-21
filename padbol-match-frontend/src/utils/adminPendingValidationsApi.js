export async function fetchAdminPendingValidations({ apiBaseUrl, accessToken, signal }) {
  if (!accessToken) throw new Error('Sesión no disponible');
  const response = await fetch(`${String(apiBaseUrl).replace(/\/$/, '')}/api/admin/validaciones`, {
    headers: { Authorization: `Bearer ${accessToken}` }, signal,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !Array.isArray(data.validaciones)) throw new Error(data.error || 'No se pudieron cargar las validaciones');
  return data.validaciones;
}
