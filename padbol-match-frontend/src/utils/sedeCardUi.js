import { precioMinimoFranjas } from './franjasHorarias';

/** Haversine: distancia en km entre dos puntos WGS84. */
export function getDistanceKm(lat1, lon1, lat2, lon2) {
  const a1 = Number(lat1);
  const o1 = Number(lon1);
  const a2 = Number(lat2);
  const o2 = Number(lon2);
  if (![a1, o1, a2, o2].every((x) => Number.isFinite(x))) return Infinity;
  const R = 6371;
  const dLat = (a2 - a1) * (Math.PI / 180);
  const dLon = (o2 - o1) * (Math.PI / 180);
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(a1 * (Math.PI / 180)) * Math.cos(a2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/** Primera URL de `fotos_urls` o imagen legacy (cards sede en /reservar y hub). */
export function primeraFotoSede(sede) {
  const arr = sede?.fotos_urls;
  if (Array.isArray(arr)) {
    for (const item of arr) {
      const u = String(item || '').trim();
      if (u) return u;
    }
  }
  const alt = String(sede?.imagen_url || sede?.foto_url || sede?.foto || '').trim();
  return alt || null;
}

export function horarioDisponibleTexto(sede) {
  const a = String(sede?.horario_apertura || '').trim() || '10:00';
  const c = String(sede?.horario_cierre || '').trim() || '23:00';
  return `Turnos ${a} – ${c}`;
}

/** Precio base por turno desde la fila `sedes` (prioriza `precio_turno` de Supabase). */
export function precioBaseTurnoDesdeSede(sede) {
  const pt = Number(sede?.precio_turno);
  if (Number.isFinite(pt) && pt >= 0) return pt;
  const ppr = Number(sede?.precio_por_reserva);
  if (Number.isFinite(ppr) && ppr >= 0) return ppr;
  return 0;
}

/** Precio mínimo por turno para mostrar en card (franjas JSONB, mañana/tarde o base). */
export function precioDesdeCard(sede) {
  const base = precioBaseTurnoDesdeSede(sede);
  const desdeFranjas = precioMinimoFranjas(sede);
  if (desdeFranjas != null && desdeFranjas >= 0) return desdeFranjas;
  const m = Number(sede?.precio_manana);
  const t = Number(sede?.precio_tarde);
  if (Number.isFinite(m) && m > 0 && Number.isFinite(t) && t > 0) return Math.min(m, t);
  if (Number.isFinite(m) && m > 0) return m;
  if (Number.isFinite(t) && t > 0) return t;
  return base;
}

const SEP = ' · ';

/**
 * Ubicación para cards / cabeceras de reserva: opcionalmente bandera al inicio de `pais`,
 * y siempre **ciudad primero**, **nombre de país después**, unidos con punto medio (` · `).
 * Ej.: pais `🇺🇸 Estados Unidos`, ciudad `Miami` → flag `🇺🇸`, linea `Miami · Estados Unidos`.
 */
export function ciudadPaisConBandera(sede) {
  const ciudad = String(sede?.ciudad || '').trim();
  const raw = String(sede?.pais || '').trim();
  if (!raw) return { linea: ciudad || '—', flag: '' };
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length >= 2 && String(parts[0]).length <= 8) {
    const paisSinBandera = parts.slice(1).join(' ').trim();
    const linea = [ciudad, paisSinBandera].filter(Boolean).join(SEP) || paisSinBandera || ciudad || '—';
    return {
      flag: parts[0],
      linea,
    };
  }
  const linea = [ciudad, raw].filter(Boolean).join(SEP) || raw;
  return { flag: '', linea };
}
