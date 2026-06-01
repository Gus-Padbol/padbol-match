const DEFAULT_API_BASE =
  typeof process !== 'undefined' && process.env.REACT_APP_API_BASE_URL
    ? String(process.env.REACT_APP_API_BASE_URL).replace(/\/$/, '')
    : 'https://padbol-backend.onrender.com';

/** GET /api/admin/lista-espera-general/:sede_id */
export async function fetchAdminListaEsperaGeneral({ sedeId, accessToken, apiBaseUrl, signal } = {}) {
  const sid = Number(sedeId);
  if (!Number.isFinite(sid)) {
    return { items: [], conteos_por_deporte: {} };
  }
  const base = String(apiBaseUrl || DEFAULT_API_BASE).replace(/\/$/, '');
  const res = await fetch(`${base}/api/admin/lista-espera-general/${encodeURIComponent(String(sid))}`, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    signal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'No se pudo cargar la lista de espera');
  return {
    items: Array.isArray(data.items) ? data.items : [],
    conteos_por_deporte:
      data.conteos_por_deporte && typeof data.conteos_por_deporte === 'object' ? data.conteos_por_deporte : {},
  };
}
