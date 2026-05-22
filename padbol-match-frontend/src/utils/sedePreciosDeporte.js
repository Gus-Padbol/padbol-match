import { parsePrecioDuracionField } from './sedePreciosDuracion';
import { precioSedeParaDuracionMin } from './sedePreciosDuracion';

/** Fila API precios_por_deporte */
export function precioDeporteFilaActiva(rows, deporteCanon) {
  const dep = String(deporteCanon || '').trim().toLowerCase();
  if (!dep || !Array.isArray(rows)) return null;
  return rows.find((r) => String(r?.deporte || '').trim().toLowerCase() === dep && r?.activo !== false) || null;
}

/** Monto configurado para la moneda de la sede (ARS → precio_ars, USD → precio_usd). */
export function precioDeporteParaMoneda(row, monedaSede) {
  if (!row) return null;
  const mon = String(monedaSede || 'ARS').trim().toUpperCase();
  const raw = mon === 'USD' ? row.precio_usd : row.precio_ars;
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

/**
 * Precio base 90 min con override por deporte; otras duraciones escalan con ratio de precios legacy de la sede.
 */
export function precioSedeParaDuracionConDeporte(sede, duracionMin, deporteCanon, preciosDeporteRows) {
  const row = precioDeporteFilaActiva(preciosDeporteRows, deporteCanon);
  const sport90 = precioDeporteParaMoneda(row, sede?.moneda);
  if (sport90 == null) return precioSedeParaDuracionMin(sede, duracionMin);
  const d = parseInt(String(duracionMin), 10);
  if (d === 90) return sport90;
  const ref90 = precioSedeParaDuracionMin(sede, 90);
  const refD = precioSedeParaDuracionMin(sede, d);
  if (ref90 != null && ref90 > 0 && refD != null) {
    return Math.round(sport90 * (refD / ref90));
  }
  return sport90;
}

/** Para precioReservaTurno: base por duración + deporte (sin franjas). */
export function precioBaseReservaConDeporte(sede, duracionMin, deporteCanon, preciosDeporteRows) {
  const v = precioSedeParaDuracionConDeporte(sede, duracionMin, deporteCanon, preciosDeporteRows);
  return v != null ? v : null;
}

export function parsePrecioDeporteInput(raw) {
  return parsePrecioDuracionField(raw);
}
