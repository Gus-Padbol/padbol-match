import { reservaInicioMs, puedeCancelarReservaJugador, cancelarReservaJugador, fechaDesdeReservasJugador } from './reservaJugadorActions';

const reserva = { id: 21, fecha: '2026-11-22', hora: '18:00:00', estado: 'confirmada' };
test('seconds in database time stay valid, using venue timezone instead of device timezone', () => {
  expect(reservaInicioMs(reserva)).toBe(Date.parse('2026-11-22T21:00:00Z'));
  expect(reservaInicioMs({ ...reserva, timezone: 'Europe/Rome' })).toBe(Date.parse('2026-11-22T17:00:00Z'));
});
test('nearby future booking may be cancelled; past/cancelled booking cannot', () => {
  const start = reservaInicioMs(reserva);
  expect(puedeCancelarReservaJugador(reserva, start - 30 * 60 * 1000)).toBe(true);
  expect(puedeCancelarReservaJugador(reserva, start + 1)).toBe(false);
  expect(puedeCancelarReservaJugador({ ...reserva, estado: 'cancelada' }, start - 1)).toBe(false);
});
test('cancellation carries JWT and owned reservation, returning server result', async () => {
  const fetchImpl = jest.fn(async () => ({ ok: true, json: async () => ({ ok: true }) }));
  await expect(cancelarReservaJugador({ baseUrl: 'https://qa.invalid', reserva, session: { access_token: 'qa-token', user: { email: 'qa@example.invalid' } }, fetchImpl })).resolves.toEqual({ ok: true });
  expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe('Bearer qa-token');
  expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({ reservaId: 21, email: 'qa@example.invalid' });
});
test('missing session and server rejection cannot pretend cancellation succeeded', async () => {
  const fetchImpl = jest.fn(async () => ({ ok: false, json: async () => ({ error: 'No pertenece a este usuario' }) }));
  await expect(cancelarReservaJugador({ baseUrl: '', reserva, session: null, fetchImpl })).rejects.toThrow('sesión');
  expect(fetchImpl).not.toHaveBeenCalled();
  await expect(cancelarReservaJugador({ baseUrl: '', reserva, session: { access_token: 'qa' }, fetchImpl })).rejects.toThrow('No pertenece');
});

test('Italy midnight cannot exclude a future Argentina booking from yesterday date', () => {
  const now = Date.parse('2026-11-22T00:30:00+01:00');
  const row = { fecha: '2026-11-21', hora: '23:00:00', timezone: 'America/Argentina/Buenos_Aires' };
  expect(fechaDesdeReservasJugador(now)).toBe('2026-11-20');
  expect(row.fecha >= fechaDesdeReservasJugador(now)).toBe(true);
  expect(puedeCancelarReservaJugador(row, now)).toBe(true);
});
