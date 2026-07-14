import {
  buildReservaManualPostPayload,
  mapReservaManualApiError,
  parseReservaManualCreateResponse,
  validateReservaManualForm,
  validationErrorMessage,
  buildAdminReservaEstadoPutBody,
  slotsReservaManualDisponibles,
} from './adminReservaManual';

describe('validateReservaManualForm', () => {
  const base = {
    sede_id: '1',
    cancha: '1',
    fecha: '2026-07-20',
    hora: '18:00',
    duracion: 90,
    nombre: 'Juan',
    telefono: '',
    estado: 'confirmada',
  };

  it('acepta formulario válido', () => {
    const r = validateReservaManualForm(base);
    expect(r.ok).toBe(true);
    expect(r.hora).toBe('18:00');
  });

  it('rechaza datos incompletos', () => {
    const r = validateReservaManualForm({ ...base, nombre: '' });
    expect(r.ok).toBe(false);
    expect(validationErrorMessage(r.errors)).toMatch(/nombre/i);
  });
});

describe('buildReservaManualPostPayload', () => {
  it('envía duracion_minutos y no duracion', () => {
    const validated = validateReservaManualForm({
      sede_id: '2',
      cancha: '1',
      fecha: '2026-07-20',
      hora: '10:00',
      duracion: 60,
      nombre: 'Ana',
      estado: 'pendiente',
    });
    const payload = buildReservaManualPostPayload(validated, {
      sedeNombre: 'Sede Test',
      email: 'admin@test.com',
    });
    expect(payload.duracion_minutos).toBe(60);
    expect(payload.duracion).toBeUndefined();
    expect(payload.estado).toBeUndefined();
    expect(payload.sede_id).toBe(2);
    expect(payload.cancha).toBe(1);
  });
});

describe('mapReservaManualApiError', () => {
  it('mapea 409 a horario ocupado', () => {
    expect(mapReservaManualApiError(409, { error: 'Este horario ya está reservado' }))
      .toMatch(/ocupad|reservad/i);
  });

  it('mapea 403 a permisos', () => {
    expect(mapReservaManualApiError(403, {})).toMatch(/permiso/i);
  });

  it('mapea 500 sin ocultar mensaje del servidor', () => {
    expect(mapReservaManualApiError(500, { error: 'DB timeout' })).toBe('DB timeout');
  });
});

describe('parseReservaManualCreateResponse', () => {
  it('lee array de POST /api/reservas', () => {
    const row = parseReservaManualCreateResponse([{ id: 99, estado: 'pendiente' }]);
    expect(row.id).toBe(99);
  });
});

describe('buildAdminReservaEstadoPutBody', () => {
  it('confirma con pago pagado', () => {
    expect(buildAdminReservaEstadoPutBody('confirmada')).toEqual({
      estado: 'confirmada',
      pago_estado: 'pagado',
    });
  });
});

describe('slotsReservaManualDisponibles', () => {
  const sedeRow = {
    id: 1,
    nombre: 'Club',
    horario_apertura: '10:00',
    horario_cierre: '12:00',
  };

  it('excluye horarios ocupados', () => {
    const slots = slotsReservaManualDisponibles({
      sedeRow: {
        ...sedeRow,
        horario_cierre: '14:00',
      },
      reservas: [{
        sede_id: 1,
        sede: 'Club',
        fecha: '2026-07-20',
        hora: '10:00',
        duracion_minutos: 90,
        cancha: 1,
        estado: 'confirmada',
      }],
      fecha: '2026-07-20',
      cancha: '1',
      duracion: 90,
      ctx: { hoyISO: '2026-07-01', minutesNow: 0 },
    });
    expect(slots).not.toContain('10:00');
    expect(slots).toContain('11:30');
  });
});
