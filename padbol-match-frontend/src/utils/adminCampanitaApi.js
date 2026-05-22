const API_BASE =
  typeof process !== 'undefined' && process.env.REACT_APP_API_BASE_URL
    ? String(process.env.REACT_APP_API_BASE_URL).replace(/\/$/, '')
    : 'https://padbol-backend.onrender.com';

/** GET /api/admin/alertas-campanita — conteos para campanita super_admin */
export async function fetchAdminCampanitaAlertas({ accessToken, signal } = {}) {
  const res = await fetch(`${API_BASE}/api/admin/alertas-campanita`, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    signal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'No se pudieron cargar las alertas');
  return {
    instructoresPendientes: Number(data.instructores_pendientes) || 0,
    sedesPendientes: Number(data.sedes_pendientes) || 0,
    pagosFallidos: Number(data.pagos_fallidos) || 0,
    cancelaciones24h: Number(data.cancelaciones_24h) || 0,
    updatedAt: data.updated_at || null,
  };
}
