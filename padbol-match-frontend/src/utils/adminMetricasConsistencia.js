/**
 * Consistencia de métricas del panel Admin (ingresos, reservas activas, períodos, comparación).
 * Zona operativa: America/Argentina/Buenos_Aires (días calendario YYYY-MM-DD).
 * No toca Backend ni analytics globales.
 */

export const ADMIN_METRICAS_TZ = 'America/Argentina/Buenos_Aires';

/** Estados que generan ingreso real (whitelist). */
export const ESTADOS_INGRESO_VALIDOS = Object.freeze([
  'confirmada',
  'completada',
  'pagada',
  'finalizada',
]);

/** Estados que nunca suman ingresos ni cuentan como activas. */
export const ESTADOS_EXCLUIDOS_INGRESO_Y_ACTIVAS = Object.freeze([
  'cancelada',
  'cancelado',
  'anulada',
  'anulada_por_usuario',
  'anulada_por_admin',
  'anulada por usuario',
  'anulada por admin',
  'rechazada',
  'rechazado',
  'vencida',
  'vencido',
]);

const INGRESO_SET = new Set(ESTADOS_INGRESO_VALIDOS);
const EXCLUIDO_SET = new Set(ESTADOS_EXCLUIDOS_INGRESO_Y_ACTIVAS);

export function normalizeEstadoReservaAdmin(raw, canceladaFlag = false) {
  if (canceladaFlag) return 'cancelada';
  return String(raw || '').trim().toLowerCase();
}

/** Solo whitelist de ingreso. Desconocido / pendiente → no suma. */
export function isReservaEstadoIngresoValido(raw, canceladaFlag = false) {
  const e = normalizeEstadoReservaAdmin(raw, canceladaFlag);
  if (!e || EXCLUIDO_SET.has(e)) return false;
  return INGRESO_SET.has(e);
}

/** Operativa: no cancelada/anulada/rechazada/vencida. */
export function isReservaEstadoActiva(raw, canceladaFlag = false) {
  const e = normalizeEstadoReservaAdmin(raw, canceladaFlag);
  if (!e) return false;
  if (EXCLUIDO_SET.has(e)) return false;
  return true;
}

export function safeMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

export function safePct(part, total) {
  const p = Number(part) || 0;
  const t = Number(total) || 0;
  if (t <= 0) return 0;
  return Math.round((p / t) * 100);
}

export function pctCambioPeriodo(actual, anterior) {
  const a = Number(actual) || 0;
  const p = Number(anterior) || 0;
  if (p === 0) return a > 0 ? 100 : 0;
  return Math.round(((a - p) / p) * 100);
}

/** Hoy calendario en ART como YYYY-MM-DD. */
export function hoyISOArgentina(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ADMIN_METRICAS_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (t) => parts.find((p) => p.type === t)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function parseISODateParts(iso) {
  const s = String(iso || '').trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

export function addDaysISO(iso, deltaDays) {
  const p = parseISODateParts(iso);
  if (!p) return '';
  const dt = new Date(Date.UTC(p.y, p.m - 1, p.d));
  dt.setUTCDate(dt.getUTCDate() + Number(deltaDays) || 0);
  const y = dt.getUTCFullYear();
  const mo = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const da = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

export function daysInclusiveISO(startISO, endISO) {
  const a = parseISODateParts(startISO);
  const b = parseISODateParts(endISO);
  if (!a || !b) return 0;
  const t0 = Date.UTC(a.y, a.m - 1, a.d);
  const t1 = Date.UTC(b.y, b.m - 1, b.d);
  if (t1 < t0) return 0;
  return Math.round((t1 - t0) / 86400000) + 1;
}

export function isoInInclusiveRange(diaISO, startISO, endISO) {
  const d = String(diaISO || '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(startISO || ''))) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(endISO || ''))) return false;
  return d >= startISO && d <= endISO;
}

/** Lunes de la semana (ISO-like local calendar) del día ancla. */
export function startOfWeekMondayISO(anclaISO) {
  const p = parseISODateParts(anclaISO);
  if (!p) return '';
  const dt = new Date(Date.UTC(p.y, p.m - 1, p.d));
  const day = dt.getUTCDay(); // 0 Sun .. 6 Sat
  const diffToMonday = day === 0 ? 6 : day - 1;
  return addDaysISO(anclaISO, -diffToMonday);
}

export function endOfWeekSundayISO(mondayISO) {
  return addDaysISO(mondayISO, 6);
}

/**
 * Límites inclusivos del selector activo.
 * @returns {{ startISO: string, endISO: string, periodo: string } | null}
 */
export function resolvePeriodBounds(periodo, fechaDesde, fechaHasta, anclaISO) {
  const p = String(periodo || '').trim();
  if (p === 'rango') {
    const desde = String(fechaDesde || '').trim();
    const hasta = String(fechaHasta || '').trim();
    if (!parseISODateParts(desde) || !parseISODateParts(hasta)) return null;
    if (hasta < desde) return null;
    return { startISO: desde, endISO: hasta, periodo: 'rango' };
  }

  const ancla = String(anclaISO || '').trim() || hoyISOArgentina();
  if (!parseISODateParts(ancla)) return null;

  if (p === 'hoy') {
    return { startISO: ancla, endISO: ancla, periodo: 'hoy' };
  }
  if (p === 'semana') {
    const startISO = startOfWeekMondayISO(ancla);
    return { startISO, endISO: endOfWeekSundayISO(startISO), periodo: 'semana' };
  }
  if (p === 'mes') {
    const parts = parseISODateParts(ancla);
    const startISO = `${parts.y}-${String(parts.m).padStart(2, '0')}-01`;
    const nextMonth = parts.m === 12
      ? `${parts.y + 1}-01-01`
      : `${parts.y}-${String(parts.m + 1).padStart(2, '0')}-01`;
    const endISO = addDaysISO(nextMonth, -1);
    return { startISO, endISO, periodo: 'mes' };
  }
  if (p === 'anio') {
    const parts = parseISODateParts(ancla);
    return {
      startISO: `${parts.y}-01-01`,
      endISO: `${parts.y}-12-31`,
      periodo: 'anio',
    };
  }
  return null;
}

/** Período anterior de la misma duración (días inclusivos). */
export function previousEqualDurationBounds(startISO, endISO) {
  const days = daysInclusiveISO(startISO, endISO);
  if (days <= 0) return null;
  const prevEndISO = addDaysISO(startISO, -1);
  const prevStartISO = addDaysISO(prevEndISO, -(days - 1));
  if (!prevStartISO || !prevEndISO) return null;
  return {
    startISO: prevStartISO,
    endISO: prevEndISO,
    days,
  };
}

export function fechaReservaDiaISO(fechaRaw) {
  const s = String(fechaRaw ?? '').trim();
  if (!s) return '';
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  // Prefer calendar prefix already handled; fallback local parts only if needed
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

export function fechaReservaDiaOCreatedISO(r) {
  return fechaReservaDiaISO(r?.fecha) || fechaReservaDiaISO(r?.created_at);
}

export function filterReservasEnBounds(list, startISO, endISO, diaFn = fechaReservaDiaOCreatedISO) {
  const rows = Array.isArray(list) ? list : [];
  return rows.filter((r) => isoInInclusiveRange(diaFn(r), startISO, endISO));
}

export function bucketMonedaMetricas(raw) {
  const u = String(raw || '').trim().toUpperCase();
  if (u.includes('EUR') || u === '€') return 'EUR';
  if (u.includes('USD') || u.includes('US$') || u === 'U$S' || u === '$US') return 'USD';
  return 'ARS';
}

/**
 * Suma ingresos por moneda solo de estados válidos.
 * @param {object} opts.resolveMoneda (r) => 'ARS'|'USD'|'EUR'
 */
export function sumIngresosReservasPorMoneda(list, opts = {}) {
  const resolveMoneda = opts.resolveMoneda || (() => 'ARS');
  const out = { ARS: 0, USD: 0, EUR: 0 };
  for (const r of Array.isArray(list) ? list : []) {
    if (!isReservaEstadoIngresoValido(r?.estado, r?.cancelada)) continue;
    const mon = bucketMonedaMetricas(resolveMoneda(r));
    out[mon] = (out[mon] || 0) + safeMoney(r?.precio);
  }
  return out;
}

export function sumIngresosReservas(list) {
  let total = 0;
  for (const r of Array.isArray(list) ? list : []) {
    if (!isReservaEstadoIngresoValido(r?.estado, r?.cancelada)) continue;
    total += safeMoney(r?.precio);
  }
  return total;
}

export function countReservasActivas(list) {
  let n = 0;
  for (const r of Array.isArray(list) ? list : []) {
    if (isReservaEstadoActiva(r?.estado, r?.cancelada)) n += 1;
  }
  return n;
}

export function horaFranjaReserva(horaRaw) {
  const start = String(horaRaw || '').split(' - ')[0].trim();
  const m = /^(\d{1,2}):(\d{2})/.exec(start);
  if (!m) return null;
  const h = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  return `${String(h).padStart(2, '0')}:00`;
}

/**
 * Distribución de reservas válidas (activas) por franja horaria.
 * No es ocupación de canchas.
 */
export function buildReservasPorHorario(list) {
  const byHora = {};
  const valid = (Array.isArray(list) ? list : []).filter((r) =>
    isReservaEstadoActiva(r?.estado, r?.cancelada),
  );
  for (const r of valid) {
    const slot = horaFranjaReserva(r?.hora);
    if (!slot) continue;
    byHora[slot] = (byHora[slot] || 0) + 1;
  }
  const total = valid.length;
  const rows = Object.keys(byHora)
    .sort((a, b) => a.localeCompare(b))
    .map((hora) => {
      const count = byHora[hora];
      return { hora, count, pct: safePct(count, total) };
    });
  return { rows, total, empty: rows.length === 0 };
}

/**
 * Comparativa período actual vs anterior de igual duración.
 */
export function buildPeriodoCompare(list, bounds, opts = {}) {
  if (!bounds?.startISO || !bounds?.endISO) {
    return {
      ok: false,
      reservasActual: 0,
      reservasAnterior: 0,
      reservasPct: 0,
      ingresosActual: 0,
      ingresosAnterior: 0,
      ingresosPct: 0,
      compareLabelKey: 'admin.metrics.compareUnavailable',
      equalDuration: false,
    };
  }
  const prev = previousEqualDurationBounds(bounds.startISO, bounds.endISO);
  if (!prev) {
    return {
      ok: false,
      reservasActual: 0,
      reservasAnterior: 0,
      reservasPct: 0,
      ingresosActual: 0,
      ingresosAnterior: 0,
      ingresosPct: 0,
      compareLabelKey: 'admin.metrics.compareUnavailable',
      equalDuration: false,
    };
  }

  const curDays = daysInclusiveISO(bounds.startISO, bounds.endISO);
  const prevDays = daysInclusiveISO(prev.startISO, prev.endISO);
  const equalDuration = curDays > 0 && curDays === prevDays;

  const actualRows = filterReservasEnBounds(list, bounds.startISO, bounds.endISO);
  const prevRows = filterReservasEnBounds(list, prev.startISO, prev.endISO);

  const activasActual = actualRows.filter((r) => isReservaEstadoActiva(r?.estado, r?.cancelada));
  const activasPrev = prevRows.filter((r) => isReservaEstadoActiva(r?.estado, r?.cancelada));

  const ingresosActual = sumIngresosReservas(activasActual);
  const ingresosAnterior = sumIngresosReservas(activasPrev);

  let compareLabelKey = 'admin.metrics.comparePreviousEqual';
  if (bounds.periodo === 'hoy') compareLabelKey = 'admin.metrics.compareTodayVsYesterday';
  else if (bounds.periodo === 'semana') compareLabelKey = 'admin.metrics.compareWeekVsPrevious';
  else if (bounds.periodo === 'rango') compareLabelKey = 'admin.metrics.compareCustomPrevious';
  else if (bounds.periodo === 'mes') compareLabelKey = 'admin.metrics.compareMonthPreviousEqual';
  else if (bounds.periodo === 'anio') compareLabelKey = 'admin.metrics.compareYearPreviousEqual';

  return {
    ok: true,
    equalDuration,
    bounds,
    previous: prev,
    reservasActual: activasActual.length,
    reservasAnterior: activasPrev.length,
    reservasPct: pctCambioPeriodo(activasActual.length, activasPrev.length),
    ingresosActual,
    ingresosAnterior,
    ingresosPct: pctCambioPeriodo(ingresosActual, ingresosAnterior),
    compareLabelKey,
  };
}

/** Etiqueta i18n key del período seleccionado. */
export function periodLabelKey(periodo) {
  const p = String(periodo || '').trim();
  if (p === 'hoy') return 'admin.metrics.periodToday';
  if (p === 'semana') return 'admin.metrics.periodWeek';
  if (p === 'mes') return 'admin.metrics.periodMonth';
  if (p === 'anio') return 'admin.metrics.periodYear';
  if (p === 'rango') return 'admin.metrics.periodCustomRange';
  return 'admin.metrics.periodSelected';
}
