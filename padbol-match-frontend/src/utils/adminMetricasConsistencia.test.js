import {
  isReservaEstadoIngresoValido,
  isReservaEstadoActiva,
  sumIngresosReservas,
  sumIngresosReservasPorMoneda,
  countReservasActivas,
  filterReservasEnBounds,
  resolvePeriodBounds,
  previousEqualDurationBounds,
  daysInclusiveISO,
  isoInInclusiveRange,
  buildPeriodoCompare,
  buildReservasPorHorario,
  hoyISOArgentina,
  addDaysISO,
  safeMoney,
  periodLabelKey,
} from './adminMetricasConsistencia';
import fs from 'fs';
import path from 'path';
import es from '../i18n/locales/es.json';
import en from '../i18n/locales/en.json';

const dashboardPath = path.join(__dirname, '../pages/AdminDashboard.jsx');
const dashboardSrc = fs.readFileSync(dashboardPath, 'utf8');

function r(partial) {
  return { precio: 100, estado: 'confirmada', fecha: '2026-07-10', hora: '10:00 - 11:30', ...partial };
}

describe('adminMetricasConsistencia — ingresos y estados', () => {
  it('1. cancelada no suma ingresos', () => {
    expect(sumIngresosReservas([r({ estado: 'cancelada', precio: 500 })])).toBe(0);
  });

  it('2. anulada no suma ingresos', () => {
    expect(sumIngresosReservas([r({ estado: 'anulada', precio: 500 })])).toBe(0);
    expect(sumIngresosReservas([r({ estado: 'anulada_por_admin', precio: 500 })])).toBe(0);
  });

  it('3. rechazada no suma ingresos', () => {
    expect(sumIngresosReservas([r({ estado: 'rechazada', precio: 500 })])).toBe(0);
  });

  it('4. confirmada suma ingresos', () => {
    expect(sumIngresosReservas([r({ estado: 'confirmada', precio: 200 })])).toBe(200);
  });

  it('5. pagada suma ingresos', () => {
    expect(isReservaEstadoIngresoValido('pagada')).toBe(true);
    expect(sumIngresosReservas([r({ estado: 'pagada', precio: 150 })])).toBe(150);
  });

  it('6. completada suma ingresos', () => {
    expect(sumIngresosReservas([r({ estado: 'completada', precio: 80 })])).toBe(80);
  });

  it('7. estado desconocido no suma por defecto', () => {
    expect(isReservaEstadoIngresoValido('mystery_state')).toBe(false);
    expect(sumIngresosReservas([r({ estado: 'mystery_state', precio: 999 })])).toBe(0);
  });

  it('8. monedas distintas se mantienen separadas', () => {
    const sum = sumIngresosReservasPorMoneda(
      [
        r({ estado: 'confirmada', precio: 100, moneda: 'ARS' }),
        r({ estado: 'confirmada', precio: 50, moneda: 'USD' }),
        r({ estado: 'cancelada', precio: 1000, moneda: 'USD' }),
      ],
      { resolveMoneda: (row) => row.moneda },
    );
    expect(sum.ARS).toBe(100);
    expect(sum.USD).toBe(50);
    expect(sum.EUR).toBe(0);
  });

  it('9. cancelada no cuenta como activa', () => {
    expect(isReservaEstadoActiva('cancelada')).toBe(false);
    expect(countReservasActivas([r({ estado: 'cancelada' })])).toBe(0);
  });

  it('10. confirmada cuenta como activa', () => {
    expect(isReservaEstadoActiva('confirmada')).toBe(true);
    expect(countReservasActivas([r({ estado: 'confirmada' }), r({ estado: 'cancelada' })])).toBe(1);
  });
});

describe('adminMetricasConsistencia — períodos y comparación', () => {
  it('11-13. totales respetan fecha_desde/hasta sin duplicar', () => {
    const list = [
      r({ id: 1, fecha: '2026-07-01', estado: 'confirmada' }),
      r({ id: 2, fecha: '2026-07-05', estado: 'confirmada' }),
      r({ id: 3, fecha: '2026-07-10', estado: 'confirmada' }),
      r({ id: 3, fecha: '2026-07-10', estado: 'confirmada' }), // misma fila dos veces en lista = dos registros
    ];
    const filtered = filterReservasEnBounds(list, '2026-07-01', '2026-07-10');
    expect(filtered).toHaveLength(4);
    expect(filterReservasEnBounds(list, '2026-07-01', '2026-07-01')).toHaveLength(1);
    expect(isoInInclusiveRange('2026-07-01', '2026-07-01', '2026-07-10')).toBe(true);
    expect(isoInInclusiveRange('2026-07-10', '2026-07-01', '2026-07-10')).toBe(true);
    expect(isoInInclusiveRange('2026-06-30', '2026-07-01', '2026-07-10')).toBe(false);
  });

  it('14. hoy se compara contra ayer', () => {
    const bounds = resolvePeriodBounds('hoy', '', '', '2026-07-15');
    expect(bounds).toEqual({ startISO: '2026-07-15', endISO: '2026-07-15', periodo: 'hoy' });
    const prev = previousEqualDurationBounds(bounds.startISO, bounds.endISO);
    expect(prev).toEqual({ startISO: '2026-07-14', endISO: '2026-07-14', days: 1 });
    const cmp = buildPeriodoCompare(
      [
        r({ fecha: '2026-07-15', estado: 'confirmada', precio: 100 }),
        r({ fecha: '2026-07-14', estado: 'confirmada', precio: 40 }),
      ],
      bounds,
    );
    expect(cmp.compareLabelKey).toBe('admin.metrics.compareTodayVsYesterday');
    expect(cmp.ingresosActual).toBe(100);
    expect(cmp.ingresosAnterior).toBe(40);
  });

  it('15. siete días vs siete anteriores', () => {
    const bounds = resolvePeriodBounds('semana', '', '', '2026-07-15'); // Wed → week Mon 13 - Sun 19
    expect(bounds.startISO).toBe('2026-07-13');
    expect(bounds.endISO).toBe('2026-07-19');
    expect(daysInclusiveISO(bounds.startISO, bounds.endISO)).toBe(7);
    const prev = previousEqualDurationBounds(bounds.startISO, bounds.endISO);
    expect(prev.days).toBe(7);
    expect(prev.endISO).toBe('2026-07-12');
    expect(prev.startISO).toBe('2026-07-06');
  });

  it('16. rango personalizado vs rango anterior igual duración', () => {
    const bounds = resolvePeriodBounds('rango', '2026-07-01', '2026-07-03', '');
    expect(daysInclusiveISO(bounds.startISO, bounds.endISO)).toBe(3);
    const prev = previousEqualDurationBounds(bounds.startISO, bounds.endISO);
    expect(prev).toEqual({ startISO: '2026-06-28', endISO: '2026-06-30', days: 3 });
  });

  it('17. no se comparan períodos de distinta duración', () => {
    const a = previousEqualDurationBounds('2026-07-01', '2026-07-07');
    expect(a.days).toBe(7);
    expect(daysInclusiveISO(a.startISO, a.endISO)).toBe(7);
    const cmp = buildPeriodoCompare([], resolvePeriodBounds('rango', '2026-07-01', '2026-07-07', ''));
    expect(cmp.equalDuration).toBe(true);
  });

  it('18. zona horaria ART no usa toISOString UTC para hoy', () => {
    const iso = hoyISOArgentina(new Date('2026-07-15T03:30:00.000Z')); // 00:30 ART
    expect(iso).toBe('2026-07-15');
    const isoPrev = hoyISOArgentina(new Date('2026-07-15T02:30:00.000Z')); // 23:30 ART day before
    expect(isoPrev).toBe('2026-07-14');
  });
});

describe('adminMetricasConsistencia — horario, vacíos, cableado', () => {
  it('19. reservas por horario usa solo válidas/activas', () => {
    const dist = buildReservasPorHorario([
      r({ estado: 'confirmada', hora: '10:00 - 11:30' }),
      r({ estado: 'cancelada', hora: '10:00 - 11:30' }),
      r({ estado: 'completada', hora: '18:00 - 19:30' }),
    ]);
    expect(dist.total).toBe(2);
    expect(dist.rows.find((x) => x.hora === '10:00').count).toBe(1);
  });

  it('20. AdminDashboard ya no titula ocupación real engañosa', () => {
    expect(dashboardSrc).toMatch(/admin\.metrics\.bookingsByHour|Reservas por horario/);
    expect(dashboardSrc).not.toMatch(/>Ocupación por horario</);
  });

  it('21. sin datos devuelve 0 y no NaN', () => {
    expect(sumIngresosReservas([])).toBe(0);
    expect(countReservasActivas([])).toBe(0);
    expect(Number.isNaN(safeMoney(undefined))).toBe(false);
    expect(safeMoney(null)).toBe(0);
    expect(buildReservasPorHorario([]).rows).toEqual([]);
  });

  it('22. error de carga no se interpreta como 0 en el util (null list → 0 métrica, distinto de error UI)', () => {
    expect(sumIngresosReservas(null)).toBe(0);
    expect(countReservasActivas(undefined)).toBe(0);
    // El cableado debe conservar analyticsGlobales null como loading, no como 0 forzado en ese bloque
    expect(dashboardSrc).toMatch(/!analyticsGlobales\s*\?/);
  });

  it('23. valores monetarios nulos no rompen', () => {
    expect(sumIngresosReservas([r({ precio: null }), r({ precio: 'abc' }), r({ precio: 10 })])).toBe(10);
  });

  it('24. selector de período afecta widgets dependientes (cableado)', () => {
    expect(dashboardSrc).toMatch(/buildPeriodoCompare|resolvePeriodBounds/);
    expect(dashboardSrc).toMatch(/isReservaEstadoIngresoValido|sumIngresosReservas/);
    expect(dashboardSrc).toMatch(/adminClubMetricasExtra/);
    expect(dashboardSrc).toMatch(/cifrasFinanzasResumen/);
  });

  it('25. widgets all-time / 30d quedan etiquetados', () => {
    expect(en.admin.metrics.bookings30dHint || es.admin.metrics.bookings30dHint).toBeTruthy();
    expect(String(es.admin.metrics.bookings30dHint).toLowerCase()).toMatch(/30|último/);
    expect(es.admin.metrics.historicalTotalHint || en.admin.metrics.historicalTotalHint).toBeTruthy();
  });

  it('26. textos ES e EN existen', () => {
    const keys = [
      'periodRevenue',
      'periodActiveBookings',
      'bookingsByHour',
      'compareTodayVsYesterday',
      'comparePreviousEqual',
      'noActivityInPeriod',
      'periodToday',
      'last30Days',
      'historicalTotal',
    ];
    for (const k of keys) {
      expect(es.admin.metrics[k]).toBeTruthy();
      expect(en.admin.metrics[k]).toBeTruthy();
    }
  });

  it('27. no se modifican métricas de PadCoins', () => {
    expect(dashboardSrc).toMatch(/padcoins/);
    const utilSrc = fs.readFileSync(path.join(__dirname, 'adminMetricasConsistencia.js'), 'utf8');
    expect(utilSrc).not.toMatch(/from ['"].*padcoin/i);
    expect(utilSrc).not.toMatch(/padcoinsReportes/i);
  });

  it('28. no se modifican analytics globales del Backend', () => {
    expect(dashboardSrc).toMatch(/analyticsGlobales\.reservas_ultimo_mes_total/);
    expect(dashboardSrc).toMatch(/admin-analytics-globales/);
  });

  it('periodLabelKey cubre selector', () => {
    expect(periodLabelKey('hoy')).toBe('admin.metrics.periodToday');
    expect(periodLabelKey('rango')).toBe('admin.metrics.periodCustomRange');
  });

  it('addDaysISO estable en límites de mes', () => {
    expect(addDaysISO('2026-07-01', -1)).toBe('2026-06-30');
  });
});
