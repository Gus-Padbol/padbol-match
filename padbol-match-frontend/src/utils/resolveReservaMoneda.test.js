import { resolveReservaMoneda } from './resolveReservaMoneda';

const venues = {
  1: { id: 1, nombre: 'La Meca Padbol Club', moneda: 'ARS' },
  4: { id: 4, nombre: 'Madrid Padbol Point', moneda: 'EUR' },
};

test('Madrid name overrides both a wrong legacy ID and its ARS default', () => {
  const reserva = { sede_nombre: '  MADRID   PADBOL POINT ', sede_id: 1, moneda: 'ARS' };
  expect(resolveReservaMoneda(reserva, venues)).toBe('EUR');
  expect(reserva).toEqual({ sede_nombre: '  MADRID   PADBOL POINT ', sede_id: 1, moneda: 'ARS' });
});

test('known local venue resolves ARS, including when only its ID is available', () => {
  expect(resolveReservaMoneda({ sede_nombre: 'La Meca Padbol Club', moneda: 'EUR' }, venues)).toBe('ARS');
  expect(resolveReservaMoneda({ sede_id: '1', moneda: 'USD' }, venues)).toBe('ARS');
});

test('unknown venues use the stored currency and do not guess from a conflicting ID', () => {
  expect(resolveReservaMoneda({ sede_nombre: 'Club desconocido', sede_id: 1, moneda: 'USD' }, venues)).toBe('USD');
  expect(resolveReservaMoneda({ sede_id: 99, moneda: 'eur' }, venues)).toBe('EUR');
});

test('exact normalized names never match only a substring and missing currency falls back safely', () => {
  expect(resolveReservaMoneda({ sede_nombre: 'Madrid', moneda: 'USD' }, venues)).toBe('USD');
  expect(resolveReservaMoneda({}, venues)).toBe('ARS');
});
