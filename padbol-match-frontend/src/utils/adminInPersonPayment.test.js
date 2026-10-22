import { confirmInPersonPayment } from './adminInPersonPayment';

test('la confirmación explícita envía ambos estados y devuelve la respuesta del servidor', async () => {
  const response = { ok: true, json: async () => ({ estado: 'confirmada', pago_estado: 'pagado' }) };
  const fetchImpl = jest.fn().mockResolvedValue(response);
  const result = await confirmInPersonPayment({ apiBaseUrl: 'https://example.invalid', reservaId: 42, accessToken: 'test', fetchImpl });
  expect(fetchImpl).toHaveBeenCalledWith('https://example.invalid/api/reservas/42', {
    method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test' },
    body: JSON.stringify({ estado: 'confirmada', pago_estado: 'pagado' }),
  });
  expect(await result.json()).toEqual({ estado: 'confirmada', pago_estado: 'pagado' });
});

test('no oculta un rechazo o fallo de comunicación', async () => {
  const denied = { ok: false, status: 403 };
  expect(await confirmInPersonPayment({ apiBaseUrl: '', reservaId: 42, fetchImpl: async () => denied })).toBe(denied);
  await expect(confirmInPersonPayment({ apiBaseUrl: '', reservaId: 42, fetchImpl: async () => { throw new Error('offline'); } })).rejects.toThrow('offline');
});
