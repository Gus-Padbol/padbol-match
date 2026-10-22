import { padcoinsMovementDescription } from './padcoinsMovementPresentation';

test('keeps the commercial description and removes appended internal metadata', () => {
  expect(padcoinsMovementDescription('Reserva confirmada [meta:{"qa":true,"id":"private"}]')).toBe('Reserva confirmada');
  expect(padcoinsMovementDescription('{"descripcion":"Canje de premio","private":"secret"}')).toBe('Canje de premio');
});

test('does not expose metadata-only or malformed internal structures', () => {
  expect(padcoinsMovementDescription('[meta:{nested:[1,2]}]')).toBe('Movimiento registrado');
  expect(padcoinsMovementDescription('{"meta":broken')).toBe('Movimiento registrado');
  expect(padcoinsMovementDescription('E2E|registration|private-id')).toBe('Movimiento de prueba');
  expect(padcoinsMovementDescription('QA|Crédito por reserva: 150 PadCoins [meta:{"id":"private"}]')).toBe('Prueba: Crédito por reserva: 150 PadCoins');
});

test('preserves legitimate descriptions and does not misclassify longer words', () => {
  expect(padcoinsMovementDescription('Testamento deportivo')).toBe('Testamento deportivo');
  expect(padcoinsMovementDescription('Crédito por reserva: 150 PadCoins')).toBe('Crédito por reserva: 150 PadCoins');
});
