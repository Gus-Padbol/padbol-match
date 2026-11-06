import {esSedeTorneo, filtrarSedesReservables, puedeReservarSede} from './sedeTipo';

describe('tipo de sede y reserva', () => {
  test('una sede de torneo no ofrece reservar por hora', () => {
    expect(esSedeTorneo({tipo_sede: 'torneo'})).toBe(true);
    expect(puedeReservarSede({tipo_sede: 'torneo'})).toBe(false);
  });
  test('una sede reservable conserva el flujo de reserva', () => {
    expect(esSedeTorneo({tipo_sede: 'reservable'})).toBe(false);
    expect(puedeReservarSede({tipo_sede: 'reservable'})).toBe(true);
    expect(puedeReservarSede({})).toBe(true);
    expect(puedeReservarSede(null)).toBe(true);
  });
  test('la sede de torneo NO se excluye del catálogo: solo se bloquea el CTA', () => {
    const sedes = [{id: 1, tipo_sede: 'reservable'}, {id: 2, tipo_sede: 'torneo'}];
    expect(sedes.filter(puedeReservarSede).map((s) => s.id)).toEqual([1]);
    expect(sedes.map((s) => s.id)).toEqual([1, 2]); // sigue en la lista
  });
});

describe('catálogo de reserva', () => {
  test('la lista principal excluye sedes de torneo y conserva las reservables', () => {
    const sedes = [
      {id: 1, nombre: 'Reservable', tipo_sede: 'reservable'},
      {id: 2, nombre: 'Torneo', tipo_sede: 'torneo'},
      {id: 3, nombre: 'Sin tipo'},
    ];
    expect(filtrarSedesReservables(sedes).map((s) => s.id)).toEqual([1, 3]);
    expect(filtrarSedesReservables(null)).toEqual([]);
  });
});
