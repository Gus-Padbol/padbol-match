import {buildSedePayload, TIPO_SEDE_RESERVABLE, TIPO_SEDE_TORNEO} from './NuevaSedeSuperBottomSheet';

const st = {nombre: 'Mostra d Oltremare (ficticia)', pais: '🇮🇹 Italia', ciudad: 'Napoli', direccion: 'Via J.F. Kennedy 54', timezone: 'Europe/Rome', email_contacto: '', telefonoLocal: '', moneda: 'EUR', latitud: null, longitud: null};
const configuration = {fields: {precio_turno: 1000, horario_apertura: '08:00', horario_cierre: '23:00'}};
const paisSinBandera = (p) => String(p || '').replace(/^[^\sA-Za-zÁÉÍÓÚÑ]+/, '').trim();

describe('alta de sede por tipo', () => {
  test('sede de torneo envía tipo_sede torneo y los cinco campos de reserva en null', () => {
    const body = buildSedePayload({st, configuration, totalCanchas: 3, paisSinBandera, telefonoFull: ' +39 000', tipoSede: TIPO_SEDE_TORNEO});
    expect(body.tipo_sede).toBe(TIPO_SEDE_TORNEO);
    expect(body.cantidad_canchas).toBeNull();
    expect(body.horario_apertura).toBeNull();
    expect(body.horario_cierre).toBeNull();
    expect(body.precio_turno).toBeNull();
    expect(body.telefono).toBeNull();
    expect(body.nombre).toBe('Mostra d Oltremare (ficticia)');
    expect(body.ciudad).toBe('Napoli');
    expect(body.timezone).toBe('Europe/Rome');
  });

  test('sede reservable conserva los cinco campos y el tipo reservable', () => {
    const body = buildSedePayload({st: {...st, email_contacto: 'a@test.invalid', telefonoLocal: '123'}, configuration, totalCanchas: 2, paisSinBandera, telefonoFull: '+39 123', tipoSede: TIPO_SEDE_RESERVABLE});
    expect(body.tipo_sede).toBe(TIPO_SEDE_RESERVABLE);
    expect(body.cantidad_canchas).toBe(2);
    expect(body.horario_apertura).toBe('08:00');
    expect(body.horario_cierre).toBe('23:00');
    expect(body.precio_turno).toBe(1000);
    expect(body.telefono).toBe('+39 123');
  });

  test('reservable no acepta los campos omitidos (los deja en undefined/null)', () => {
    const body = buildSedePayload({st: {...st, email_contacto: '', telefonoLocal: ''}, configuration: {fields: {}}, totalCanchas: null, paisSinBandera, telefonoFull: '', tipoSede: TIPO_SEDE_RESERVABLE});
    expect(body.tipo_sede).toBe(TIPO_SEDE_RESERVABLE);
    // La validación de seguridad es del componente (alerta y bloqueo), no del builder:
    // aquí se refleja que el payload NO inventa valores por defecto.
    expect(body.cantidad_canchas).toBeNull();
    expect(body.horario_apertura).toBeUndefined();
    expect(body.precio_turno).toBeUndefined();
  });
});
