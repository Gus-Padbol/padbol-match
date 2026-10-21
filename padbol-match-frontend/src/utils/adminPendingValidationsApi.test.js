import { fetchAdminPendingValidations } from './adminPendingValidationsApi';
afterEach(() => { delete global.fetch; });
test('usa sesión autorizada y devuelve las validaciones del servidor', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ validaciones: [{ id: 1 }] }) });
  expect(await fetchAdminPendingValidations({ apiBaseUrl: 'https://example.test', accessToken: 'test' })).toEqual([{ id: 1 }]);
  expect(global.fetch).toHaveBeenCalledWith('https://example.test/api/admin/validaciones', expect.objectContaining({ headers: { Authorization: 'Bearer test' } }));
});
test('un permiso denegado o respuesta inválida no se convierte en lista vacía', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'Sin permiso' }) });
  await expect(fetchAdminPendingValidations({ apiBaseUrl: 'https://example.test', accessToken: 'test' })).rejects.toThrow('Sin permiso');
  global.fetch.mockResolvedValue({ ok: true, json: async () => ({}) });
  await expect(fetchAdminPendingValidations({ apiBaseUrl: 'https://example.test', accessToken: 'test' })).rejects.toThrow();
  await expect(fetchAdminPendingValidations({ apiBaseUrl: 'https://example.test' })).rejects.toThrow('Sesión');
});
