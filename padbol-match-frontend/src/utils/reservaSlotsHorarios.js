import { horaAMinutos, franjaAplicaAFecha } from './franjasHorarias';
import { parsePrecioDuracionField } from './sedePreciosDuracion';

export const RESERVA_SLOT_STEP_MIN = 30;
const MINUTOS_DIA = 24 * 60;
const DEFAULT_APERTURA = '10:00';
const DEFAULT_CIERRE = '23:00';

export function minutosAHoraReserva(totalMin) {
  const t = ((Number(totalMin) % MINUTOS_DIA) + MINUTOS_DIA) % MINUTOS_DIA;
  const h = Math.floor(t / 60);
  const m = t % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** True si la sede tiene al menos una franja con horario y precio válidos. */
export function sedeUsaFranjasHorarias(sede) {
  const franjas = sede?.franjas_horarias;
  if (!Array.isArray(franjas) || franjas.length === 0) return false;
  return franjas.some((f) => {
    const i = horaAMinutos(f?.hora_inicio);
    const fi = horaAMinutos(f?.hora_fin);
    const p = Number(f?.precio);
    return i != null && fi != null && Number.isFinite(p) && p >= 0;
  });
}

function ventanaDesdeFranja(f) {
  const startMin = horaAMinutos(f?.hora_inicio);
  const endMin = horaAMinutos(f?.hora_fin);
  if (startMin == null || endMin == null) return null;
  return {
    startMin,
    endMin,
    cruzaMedianoche: endMin <= startMin,
  };
}

/**
 * Ventanas { startMin, endMin, cruzaMedianoche } para generar turnos en una fecha.
 * Con franjas → unión de franjas que aplican; sin franjas → horario_apertura / horario_cierre.
 */
export function ventanasHorarioReserva(sede, fechaISO) {
  if (sedeUsaFranjasHorarias(sede)) {
    const franjas = sede.franjas_horarias;
    const ordenadas = [
      ...franjas.filter((f) => String(f?.tipo || '') === 'fecha_especial'),
      ...franjas.filter((f) => String(f?.tipo || '') !== 'fecha_especial'),
    ];
    const ventanas = [];
    for (const f of ordenadas) {
      if (!franjaAplicaAFecha(f, fechaISO)) continue;
      const v = ventanaDesdeFranja(f);
      if (v) ventanas.push(v);
    }
    if (ventanas.length) return ventanas;
  }

  const startMin = horaAMinutos(sede?.horario_apertura) ?? horaAMinutos(DEFAULT_APERTURA);
  let endMin = horaAMinutos(sede?.horario_cierre) ?? horaAMinutos(DEFAULT_CIERRE);
  if (startMin == null || endMin == null) {
    return [{ startMin: 10 * 60, endMin: 23 * 60, cruzaMedianoche: false }];
  }
  if (endMin <= startMin) endMin += MINUTOS_DIA;
  return [{ startMin, endMin, cruzaMedianoche: endMin > MINUTOS_DIA }];
}

function agregarIniciosEnVentana(out, ventana, duracionMin, stepMin) {
  const { startMin, endMin, cruzaMedianoche } = ventana;
  const pushRango = (from, to) => {
    for (let start = from; start + duracionMin <= to; start += stepMin) {
      out.add(start % MINUTOS_DIA);
    }
  };
  if (!cruzaMedianoche) {
    pushRango(startMin, endMin);
    return;
  }
  pushRango(startMin, MINUTOS_DIA);
  pushRango(0, endMin);
}

/**
 * Minutos de inicio de turno (0–1439) que caben en las ventanas para la duración dada.
 */
export function generarIniciosMinutosSlotReserva(sede, fechaISO, duracionMin, stepMin = RESERVA_SLOT_STEP_MIN) {
  const dur = parseInt(String(duracionMin), 10);
  if (!Number.isFinite(dur) || dur < 15) return [];
  const ventanas = ventanasHorarioReserva(sede, fechaISO);
  const inicios = new Set();
  for (const v of ventanas) {
    agregarIniciosEnVentana(inicios, v, dur, stepMin);
  }
  return [...inicios].sort((a, b) => a - b);
}

/** Un turno [inicioMin, inicioMin+duracion) cae dentro de alguna ventana. */
export function turnoCabeEnVentanasReserva(inicioMin, duracionMin, ventanas) {
  const start = Number(inicioMin);
  const dur = Number(duracionMin);
  if (!Number.isFinite(start) || !Number.isFinite(dur)) return false;
  const end = start + dur;
  return (ventanas || []).some(({ startMin, endMin, cruzaMedianoche }) => {
    if (!cruzaMedianoche) {
      return start >= startMin && end <= endMin;
    }
    if (start >= startMin) return end <= MINUTOS_DIA;
    return start < endMin && end <= endMin;
  });
}

/** Precio cuando no hay franjas: precio por duración en columnas sede o precio_turno / precio_por_reserva. */
export function precioReservaFallbackSinFranjas(sede, duracionMin) {
  const d = parseInt(String(duracionMin), 10);
  const col =
    d === 60 ? 'precio_60min' : d === 90 ? 'precio_90min' : d === 120 ? 'precio_120min' : null;
  if (col) {
    const fromCol = parsePrecioDuracionField(sede?.[col]);
    if (fromCol != null) return fromCol;
  }
  if (d === 90) {
    const turno = parsePrecioDuracionField(sede?.precio_turno);
    if (turno != null) return turno;
    const ppr = parsePrecioDuracionField(sede?.precio_por_reserva);
    if (ppr != null) return ppr;
  }
  const turno = parsePrecioDuracionField(sede?.precio_turno);
  if (turno != null) return turno;
  return parsePrecioDuracionField(sede?.precio_por_reserva);
}

/**
 * Filas de UI / API: { horaInicio, horaFin, horario, startMin, endMin }.
 */
export function generarSlotsHorarioReserva(sede, fechaISO, duracionMin, stepMin = RESERVA_SLOT_STEP_MIN) {
  const dur = parseInt(String(duracionMin), 10);
  const inicios = generarIniciosMinutosSlotReserva(sede, fechaISO, dur, stepMin);
  return inicios.map((startMin) => {
    const endMin = startMin + dur;
    const horaInicio = minutosAHoraReserva(startMin);
    const horaFin = minutosAHoraReserva(endMin);
    return {
      startMin,
      endMin,
      horaInicio,
      horaFin,
      horario: `${horaInicio} - ${horaFin}`,
      hora: horaInicio,
    };
  });
}
