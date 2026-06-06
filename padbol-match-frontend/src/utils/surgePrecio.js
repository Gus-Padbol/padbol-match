const DEFAULT_API_BASE = 'https://padbol-backend.onrender.com';

function apiBaseUrl() {
  return (process.env.REACT_APP_API_BASE_URL || DEFAULT_API_BASE).replace(/\/$/, '');
}

/**
 * Consulta precio Surge para una sede y duración (minutos).
 * @returns {Promise<{ precio: number|null, ocupacion_porcentaje: number, surge_activo: boolean }>}
 */
export async function fetchSurgePrecio(sedeId, duracionMin) {
  const sid = parseInt(String(sedeId), 10);
  const dur = parseInt(String(duracionMin), 10);
  if (!Number.isFinite(sid) || sid <= 0 || !Number.isFinite(dur) || dur < 15) {
    return { precio: null, ocupacion_porcentaje: 0, surge_activo: false };
  }

  const res = await fetch(`${apiBaseUrl()}/api/surge/${encodeURIComponent(sid)}/${encodeURIComponent(dur)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'No se pudo obtener el precio dinámico');
  }
  return {
    precio: data.precio != null ? Number(data.precio) : null,
    ocupacion_porcentaje: Number(data.ocupacion_porcentaje) || 0,
    surge_activo: data.surge_activo === true,
  };
}
