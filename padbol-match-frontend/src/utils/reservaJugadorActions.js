import { slotStartMsParaReservaSede } from './reservaTimezone';

export function reservaInicioMs(reserva) {
  return slotStartMsParaReservaSede(reserva?.fecha, reserva?.hora_inicio || reserva?.hora, reserva);
}

export function puedeCancelarReservaJugador(reserva, ahora = Date.now()) {
  const inicio = reservaInicioMs(reserva);
  return inicio != null && inicio > ahora && String(reserva?.estado || '').trim().toLowerCase() !== 'cancelada';
}

export async function cancelarReservaJugador({ baseUrl, reserva, session, fetchImpl = fetch }) {
  if (!session?.access_token) throw new Error('Tu sesión venció. Volvé a ingresar para cancelar la reserva.');
  const response = await fetchImpl(`${baseUrl}/api/cancelar-reserva`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ reservaId: reserva.id, email: session.user?.email }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'No se pudo cancelar la reserva.');
  return result;
}

/** Query a conservative date window before comparing venue-local instants. */
export function fechaDesdeReservasJugador(ahora = Date.now()) {
  return new Date(ahora - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
