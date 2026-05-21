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
    return Number.isFinite(raw) && raw >= 0 ? Math.round(raw) : null;
  }
  const s = String(raw).trim();
  if (!s) return null;
  const normalized = s.replace(/\s/g, '');
  const asDecimal = Number(normalized.replace(',', '.'));
  if (Number.isFinite(asDecimal) && asDecimal >= 0) return Math.round(asDecimal);
  const digits = normalized.replace(/\./g, '').replace(/[^\d]/g, '');
  if (!digits) return null;
  const n = parseInt(digits, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Filas `duraciones_oferta` / `duraciones` del GET sedes (sedes_duraciones). */
export function duracionesOfertaFilasSede(sede) {
  if (!sede) return [];
  if (Array.isArray(sede.duraciones_oferta) && sede.duraciones_oferta.length) {
    return sede.duraciones_oferta;
  }
  if (Array.isArray(sede.duraciones) && sede.duraciones.length) {
    return sede.duraciones;
  }
  return [];
}

/** Minutos ofrecidos según filas de sedes_duraciones (aunque el precio venga como string decimal). */
export function duracionesOfertaMinutosReserva(sede) {
  const arr = duracionesOfertaFilasSede(sede);
  if (!arr.length) return [];
  const mins = arr
    .map((r) => parseInt(String(r?.duracion_minutos), 10))
    .filter((m) => RESERVA_DURACIONES_MIN.includes(m));
  return [...new Set(mins)].sort((a, b) => a - b);
}

/**
 * Precio desde `duraciones_oferta` (GET /api/sedes/:id) o alias `duraciones`: filas tipo sedes_duraciones.
 */
export function precioDesdeDuracionesOfertaSede(sede, duracionMin) {
  const arr = duracionesOfertaFilasSede(sede);
  if (!arr.length) return null;
  const d = parseInt(String(duracionMin), 10);
  if (!Number.isFinite(d)) return null;
  const hit = arr.find((r) => Number(r?.duracion_minutos) === d);
  if (!hit || hit.precio == null || hit.precio === '') return null;
  return parsePrecioDuracionField(hit.precio);
}

/** Columnas legacy en `sedes` (precio_60min / 90 / 120, precio_turno, precio_por_reserva). */
function precioSedeLegacyColumns(sede, duracionMin) {
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

/** Precio numérico de la sede para una duración (sin franjas): sedes_duraciones vía API primero, luego columnas sede. */
export function precioSedeParaDuracionMin(sede, duracionMin) {
  return precioDesdeDuracionesOfertaSede(sede, duracionMin) ?? precioSedeLegacyColumns(sede, duracionMin);
}

/** Duraciones que tienen precio cargado (ofrecidas en reservas). */
export function duracionesReservaDisponibles(sede) {
  if (!sede) return [];
  const desdeOferta = duracionesOfertaMinutosReserva(sede);
  if (desdeOferta.length) return desdeOferta;
  return RESERVA_DURACIONES_MIN.filter((min) => precioSedeParaDuracionMin(sede, min) != null);
}

/**
 * Precio del turno para checkout/resumen.
 * Si `precioBaseTabla` viene informado (p. ej. sedes_duraciones / disponibilidad-slots), ese monto
 * es autoritativo: no se pisa con franjas horarias ni con legacy mañana/tarde.
 * Si no: franjas (si aplican) > precio por duración en columnas de sede > legacy mañana/tarde.
 * @param {object} sede
 * @param {string} hora HH:MM
 * @param {string} fecha YYYY-MM-DD
 * @param {number} duracionMin
 * @param {function} precioDesdeFranjasFn inyectado para evitar ciclo con franjasHorarias
 */
export function precioReservaTurno(sede, hora, fecha, duracionMin, precioDesdeFranjasFn, precioBaseTabla = null) {
  const tienePrecioTablaExplicito =
    precioBaseTabla != null && Number.isFinite(Number(precioBaseTabla)) && Number(precioBaseTabla) >= 0;
  const fijoDuraciones = !tienePrecioTablaExplicito ? precioDesdeDuracionesOfertaSede(sede, duracionMin) : null;
  const baseDuracion = tienePrecioTablaExplicito
    ? Number(precioBaseTabla)
    : fijoDuraciones != null
      ? fijoDuraciones
      : precioSedeLegacyColumns(sede, duracionMin);
  const base = baseDuracion != null ? baseDuracion : 0;
  if (!hora || !sede) return base;
  if (tienePrecioTablaExplicito) return base;
  if (fijoDuraciones != null) return base;
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
