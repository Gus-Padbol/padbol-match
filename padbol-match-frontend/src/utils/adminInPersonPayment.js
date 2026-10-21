export async function confirmInPersonPayment({ apiBaseUrl, reservaId, accessToken, fetchImpl = fetch }) {
  const headers = { 'Content-Type': 'application/json' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return fetchImpl(`${apiBaseUrl}/api/reservas/${reservaId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ estado: 'confirmada', pago_estado: 'pagado' }),
  });
}
