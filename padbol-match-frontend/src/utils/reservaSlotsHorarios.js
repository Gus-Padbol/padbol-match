import { horaAMinutos } from './franjasHorarias';
import { parsePrecioDuracionField } from './sedePreciosDuracion';

export const RESERVA_SLOT_STEP_MIN = 30;
export const RESERVA_DURACION_SLOT_DEFAULT_MIN = 90;
const MINUTOS_DIA = 24 * 60;
const DEFAULT_APERTURA = '10:00';
const DEFAULT_CIERRE = '23:00';

/** Columnas `sedes`: horario_apertura / horario_cierre. */
export function horarioAperturaCierreSede(sede) {
  return {
    horario_apertura: sede?.horario_apertura,
    horario_cierre: sede?.horario_cierre,
  };
}

export function minutosAHoraReserva(totalMin) {
  const t = ((Number(totalMin) % MINUTOS_DIA) + MINUTOS_DIA) % MINUTOS_DIA;
  const h = Math.floor(t / 60);
  const m = t % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Ventana de turnos desde horario_apertura / horario_cierre de la sede.
 */
export function ventanasHorarioReserva(sede) {
  const { horario_apertura, horario_cierre } = horarioAperturaCierreSede(sede);
  const startMin = horaAMinutos(horario_apertura) ?? horaAMinutos(DEFAULT_APERTURA);
  let endMin = horaAMinutos(horario_cierre) ?? horaAMinutos(DEFAULT_CIERRE);
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

function duracionSlotReservaMin(duracionMin) {
  const dur = parseInt(String(duracionMin), 10);
  if (!Number.isFinite(dur) || dur < 15) return RESERVA_DURACION_SLOT_DEFAULT_MIN;
  return dur;
}

/**
 * Minutos de inicio de turno (0–1439) entre apertura y cierre de la sede.
 * @param {string} [_fechaISO] reservado; no afecta la grilla (solo horario sede).
 */
export function generarIniciosMinutosSlotReserva(sede, _fechaISO, duracionMin, stepMin = RESERVA_SLOT_STEP_MIN) {
  const dur = duracionSlotReservaMin(duracionMin);
  const ventanas = ventanasHorarioReserva(sede);
  const inicios = new Set();
  for (const v of ventanas) {
    agregarIniciosEnVentana(inicios, v, dur, stepMin);
  }
  return [...inicios].sort((a, b) => a - b);
}

/** Un turno [inicioMin, inicioMin+duracion) cae dentro del horario de la sede. */
export function turnoCabeEnVentanasReserva(inicioMin, duracionMin, ventanas) {
  const start = Number(inicioMin);
  const dur = duracionSlotReservaMin(duracionMin);
  if (!Number.isFinite(start)) return false;
  const end = start + dur;
  return (ventanas || []).some(({ startMin, endMin, cruzaMedianoche }) => {
    if (!cruzaMedianoche) {
      return start >= startMin && end <= endMin;
    }
    if (start >= startMin) return end <= MINUTOS_DIA;
    return start < endMin && end <= endMin;
  });
}

/** Precio por duración en columnas sede o precio_turno / precio_por_reserva. */
export function precioReservaFallbackSinFranjas(sede, duracionMin) {
  const d = duracionSlotReservaMin(duracionMin);
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
  const dur = duracionSlotReservaMin(duracionMin);
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
