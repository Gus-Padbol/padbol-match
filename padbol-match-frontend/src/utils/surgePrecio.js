const DEFAULT_API_BASE = 'https://padbol-backend.onrender.com';

function apiBaseUrl() {
  return (process.env.REACT_APP_API_BASE_URL || DEFAULT_API_BASE).replace(/\/$/, '');
}

/** ISO local para query `slot_inicio` (fecha YYYY-MM-DD + hora HH:mm). */
export function buildSurgeSlotInicio(fecha, hora) {
  const f = String(fecha || '').trim();
  const h = String(hora || '').trim().slice(0, 5);
  if (!f || !h) return null;
  return `${f}T${h}:00`;
}

/**
 * Badge de precio Surge (nunca muestra ocupación numérica al usuario).
 * @returns {{ label: string, color: string, background: string, borderColor: string }|null}
 */
export function surgeBadgeFromQuote(quote) {
  if (!quote?.surge_activo || quote.precio == null) return null;
  if (quote.last_minute_discount === true) {
    return {
      label: '🕐 Última hora',
      color: '#22c55e',
      background: 'rgba(34, 197, 94, 0.12)',
      borderColor: 'rgba(34, 197, 94, 0.35)',
    };
  }
  const occ = Number(quote.ocupacion_porcentaje) || 0;
  if (occ > 60) {
    return {
      label: '⚡ Alta demanda',
      color: '#f59e0b',
      background: 'rgba(245, 158, 11, 0.12)',
      borderColor: 'rgba(245, 158, 11, 0.35)',
    };
  }
  if (occ < 30) {
    return {
      label: '⚡ Precio especial',
      color: '#8b5cf6',
      background: 'rgba(139, 92, 246, 0.12)',
      borderColor: 'rgba(139, 92, 246, 0.35)',
    };
  }
  return null;
}

/**
 * Consulta precio Surge v2 para sede, deporte, duración y slot seleccionado.
 * @returns {Promise<{ precio: number|null, ocupacion_porcentaje: number, surge_activo: boolean, last_minute_discount: boolean }>}
 */
export async function fetchSurgePrecio(sedeId, deporte, duracionMin, fecha, hora) {
  const sid = parseInt(String(sedeId), 10);
  const dur = parseInt(String(duracionMin), 10);
  const dep = String(deporte || 'padbol').trim().toLowerCase();
  if (!Number.isFinite(sid) || sid <= 0 || !Number.isFinite(dur) || dur < 15) {
    return { precio: null, ocupacion_porcentaje: 0, surge_activo: false, last_minute_discount: false };
  }

  const slot = buildSurgeSlotInicio(fecha, hora);

  const qs = slot ? `?slot_inicio=${encodeURIComponent(slot)}` : '';
  const res = await fetch(
    `${apiBaseUrl()}/api/surge/${encodeURIComponent(sid)}/${encodeURIComponent(dep)}/${encodeURIComponent(dur)}${qs}`,
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'No se pudo obtener el precio dinámico');
  }
  return {
    precio: data.precio != null ? Number(data.precio) : null,
    ocupacion_porcentaje: Number(data.ocupacion_porcentaje) || 0,
    surge_activo: data.surge_activo === true,
    last_minute_discount: data.last_minute_discount === true,
  };
}
