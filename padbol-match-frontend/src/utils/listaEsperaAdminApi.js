import { getApiBaseUrl } from './apiPublicBaseUrl';
const DEFAULT_API_BASE = getApiBaseUrl();

/** GET /api/admin/lista-espera-general/:sede_id */
export async function fetchAdminListaEsperaGeneral({ sedeId, accessToken, apiBaseUrl, signal } = {}) {
  const sid = Number(sedeId);
  if (!Number.isFinite(sid)) {
    return { items: [], conteos_por_deporte: {} };
  }
  const base = String(apiBaseUrl || DEFAULT_API_BASE).replace(/\/$/, '');
  const options = {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    signal,
  };
  const fetchData = async (path) => {
    const res = await fetch(`${base}${path}`, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || 'No se pudo cargar la lista de espera');
    return data;
  };
  const [data, interestData] = await Promise.all([
    fetchData(`/api/admin/lista-espera-general/${encodeURIComponent(String(sid))}`),
    fetchData(`/api/admin/sedes/${encodeURIComponent(String(sid))}/torneo-interes`),
  ]);
  const items = Array.isArray(data.items) ? data.items : data.lista;
  if (!Array.isArray(items) || !Array.isArray(interestData.interesados)) throw new Error('No se pudo interpretar la lista de espera');
  const combined = [
    ...items.map((row) => ({ ...row, waitlistSource: 'sport' })),
    ...interestData.interesados.map((row) => ({ ...row, waitlistSource: 'venue' })),
  ];
  const conteos = {};
  for (const item of combined) {
    const deporte = String(item.deporte || '').trim().toLowerCase();
    if (deporte) conteos[deporte] = (conteos[deporte] || 0) + 1;
  }
  return {
    items: combined,
    conteos_por_deporte: conteos,
  };
}
