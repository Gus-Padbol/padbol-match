import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateIncentiveMetrics, monthPeriodBounds, normalizeIncentiveRules, reconcileExpiredSedeIncentives } from './sedeIncentives.js';

test('el mes solo se desbloquea cuando cumple todos los usos obligatorios', () => {
  const result = evaluateIncentiveMetrics({
    torneos_validos: 1,
    jugadores_registrados_torneos: 8,
    partidos_marcador_finalizados: 3,
    reservas_validas: 10,
    jugadores_activos: 10,
    movimientos_padcoins: 5,
  });
  assert.equal(result.cumplido, true);
  assert.equal(result.criterios.reservas, true);
});

test('una acción aislada sin torneo real no desbloquea el mes', () => {
  const result = evaluateIncentiveMetrics({ reservas_validas: 100, jugadores_activos: 100 });
  assert.equal(result.cumplido, false);
  assert.equal(result.criterios.torneos_integrales, false);
  assert.equal(result.criterios.reservas, true);
});

test('un torneo sin marcador y sin PadCoins no desbloquea el mes', () => {
  const result = evaluateIncentiveMetrics({
    torneos_validos: 1,
    jugadores_registrados_torneos: 8,
    reservas_validas: 10,
    jugadores_activos: 10,
  });
  assert.equal(result.cumplido, false);
  assert.equal(result.criterios.marcador, false);
  assert.equal(result.criterios.padcoins, false);
});

test('reglas configurables conservan todos los requisitos obligatorios', () => {
  const rules = normalizeIncentiveRules({ torneos_minimos: 2, reservas_minimas: -4, movimientos_padcoins_minimos: 0 });
  assert.equal(rules.torneos_minimos, 2);
  assert.equal(rules.reservas_minimas, 10);
  assert.equal(rules.movimientos_padcoins_minimos, 5);
});

test('período mensual usa límites UTC estables', () => {
  assert.deepEqual(monthPeriodBounds('2026-09-18'), {
    period: '2026-09-01',
    startDate: '2026-09-01',
    endDate: '2026-10-01',
    startIso: '2026-09-01T00:00:00.000Z',
    endIso: '2026-10-01T00:00:00.000Z',
  });
});

test('reconcilia beneficios vencidos con la fecha indicada y normaliza la respuesta', async () => {
  const calls = [];
  const supabase = {
    rpc: async (name, args) => {
      calls.push({ name, args });
      return { data: [{ programas_finalizados: 2, sedes_en_starter: 1 }], error: null };
    },
  };

  const result = await reconcileExpiredSedeIncentives(supabase, new Date('2026-09-04T18:30:00Z'));

  assert.deepEqual(calls, [{ name: 'reconciliar_beneficios_vencidos', args: { p_hoy: '2026-09-04' } }]);
  assert.deepEqual(result, { programas_finalizados: 2, sedes_en_starter: 1 });
});
