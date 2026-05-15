/** Duraciones de turno soportadas en reservas (minutos). */
export const RESERVA_DURACIONES_MIN = [60, 90, 120];

const PRECIO_COL = {
  60: 'precio_60min',
  90: 'precio_90min',
  120: 'precio_120min',
};

/** Parsea input admin (dígitos) o valor numérico de API → number | null. */
export function parsePrecioDuracionField(raw) {
  if (raw === '' || raw == null) return null;
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw >= 0 ? raw : null;
  }
  const digits = String(raw).replace(/\./g, '').replace(/[^\d]/g, '');
  if (!digits) return null;
  const n = parseInt(digits, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Precio numérico de la sede para una duración (sin franjas horarias). */
export function precioSedeParaDuracionMin(sede, duracionMin) {
  const d = parseInt(String(duracionMin), 10);
  const col = PRECIO_COL[d];
  if (!col) return null;
  const fromCol = parsePrecioDuracionField(sede?.[col]);
  if (fromCol != null) return fromCol;
  if (d === 90) {
    const legacy = parsePrecioDuracionField(sede?.precio_turno);
    if (legacy != null) return legacy;
    const ppr = parsePrecioDuracionField(sede?.precio_por_reserva);
    if (ppr != null) return ppr;
  }
  return null;
}

/** Duraciones que tienen precio cargado (ofrecidas en reservas). */
export function duracionesReservaDisponibles(sede) {
  if (!sede) return [];
  return RESERVA_DURACIONES_MIN.filter((min) => precioSedeParaDuracionMin(sede, min) != null);
}

/**
 * Precio del turno: franjas horarias (si aplican) > base por duración > legacy mañana/tarde.
 * @param {object} sede
 * @param {string} hora HH:MM
 * @param {string} fecha YYYY-MM-DD
 * @param {number} duracionMin
 * @param {function} precioDesdeFranjasFn inyectado para evitar ciclo con franjasHorarias
 */
export function precioReservaTurno(sede, hora, fecha, duracionMin, precioDesdeFranjasFn) {
  const baseDuracion = precioSedeParaDuracionMin(sede, duracionMin);
  const base = baseDuracion != null ? baseDuracion : 0;
  if (!hora || !sede) return base;
  if (typeof precioDesdeFranjasFn === 'function') {
    const desdeFranjas = precioDesdeFranjasFn(sede, hora, fecha);
    if (desdeFranjas != null) return desdeFranjas;
  }
  const h = parseInt(String(hora).split(':')[0], 10);
  if (!Number.isFinite(h)) return base;
  return h < 16
    ? Number(sede.precio_manana ?? base)
    : Number(sede.precio_tarde ?? base);
}

/** Body parcial PATCH sedes: precios por duración + precio_turno alineado a 90 min. */
export function preciosDuracionToApiPatch(form) {
  const p60 = parsePrecioDuracionField(form.precio_60min);
  const p90 = parsePrecioDuracionField(form.precio_90min);
  const p120 = parsePrecioDuracionField(form.precio_120min);
  return {
    precio_60min: p60,
    precio_90min: p90,
    precio_120min: p120,
    precio_turno: p90,
  };
}
