import {
  accionesDisponiblesParaEstado,
  computeVencimientoFromPlan,
  countActivosPorPlan,
  emptyPlanForm,
  filterMembresiasClient,
  parseMembresiasApiError,
  planToForm,
  resolveDuracionDiasPlan,
  validateAndBuildPlanPayload,
} from './membresiasAdminApi';

describe('membresiasAdminApi', () => {
  it('resuelve duración por tipo y días personalizados', () => {
    expect(resolveDuracionDiasPlan({ duracion_tipo: 'mensual' })).toBe(30);
    expect(resolveDuracionDiasPlan({ duracion_tipo: 'trimestral' })).toBe(90);
    expect(resolveDuracionDiasPlan({ duracion_tipo: 'semestral' })).toBe(180);
    expect(resolveDuracionDiasPlan({ duracion_tipo: 'anual' })).toBe(365);
    expect(resolveDuracionDiasPlan({ duracion_tipo: 'dias', duracion_dias: 14 })).toBe(14);
    expect(resolveDuracionDiasPlan({ duracion_tipo: 'dias', duracion_dias: 0 })).toBeNull();
  });

  it('valida payload de plan y rechaza valores inválidos', () => {
    const base = {
      ...emptyPlanForm('7'),
      nombre: 'Gold',
      precio: '100',
      descuento_porcentual: '10',
      reservas_incluidas_por_periodo: '2',
    };
    expect(validateAndBuildPlanPayload(base, { mode: 'create' }).ok).toBe(true);

    expect(validateAndBuildPlanPayload({ ...base, precio: '-1' }).ok).toBe(false);
    expect(validateAndBuildPlanPayload({ ...base, descuento_porcentual: '101' }).errorKey)
      .toBe('descuentoInvalid');
    expect(validateAndBuildPlanPayload({
      ...base,
      duracion_tipo: 'dias',
      duracion_dias: '',
    }).errorKey).toBe('duracionDiasInvalid');
    expect(validateAndBuildPlanPayload({ ...base, reservas_incluidas_por_periodo: '-2' }).errorKey)
      .toBe('reservasInvalid');
  });

  it('planToForm y computeVencimientoFromPlan', () => {
    const form = planToForm({
      id: 1,
      sede_id: 3,
      nombre: 'Silver',
      precio: 50,
      moneda: 'usd',
      duracion_tipo: 'mensual',
      beneficios: { descuento_porcentual: 5, reservas_incluidas_por_periodo: 1 },
    });
    expect(form.moneda).toBe('USD');
    expect(form.descuento_porcentual).toBe('5');

    const venc = computeVencimientoFromPlan('2026-01-01T00:00:00.000Z', {
      duracion_tipo: 'mensual',
    });
    expect(venc).toMatch(/^2026-01-31/);
  });

  it('acciones por estado y conteo de activos', () => {
    expect(accionesDisponiblesParaEstado('activa')).toEqual(['renovar', 'suspender', 'cancelar']);
    expect(accionesDisponiblesParaEstado('vencida')).toEqual(['renovar']);
    expect(accionesDisponiblesParaEstado('cancelada')).toEqual([]);
    expect(accionesDisponiblesParaEstado('suspendida')).toEqual(['renovar', 'cancelar']);

    const list = [
      { plan_id: 1, estado: 'activa' },
      { plan_id: 1, estado: 'cancelada' },
      { plan_id: 2, estado: 'activa' },
    ];
    expect(countActivosPorPlan(list, 1)).toBe(1);
  });

  it('filtra membresías en cliente y parsea 403', () => {
    const rows = [
      { plan_id: 1, email: 'a@x.com', user_id: 'u1', jugador_nombre: 'Ana' },
      { plan_id: 2, email: 'b@x.com', user_id: 'u2', jugador_nombre: 'Bruno' },
    ];
    expect(filterMembresiasClient(rows, { planId: '1' })).toHaveLength(1);
    expect(filterMembresiasClient(rows, { jugadorQ: 'bruno' })).toHaveLength(1);
    expect(parseMembresiasApiError(403, {})).toMatch(/403|permiso/i);
  });
});
