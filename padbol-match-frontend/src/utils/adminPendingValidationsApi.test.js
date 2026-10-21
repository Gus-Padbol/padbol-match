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

test('exige confirmación de la fila actualizada y detecta fallo o cero filas', async () => {
  const { updatePendingValidation } = require('./adminPendingValidationsApi');
  const result = { data: { email: 'p@example.test' }, error: null };
  const query = { update: jest.fn(), eq: jest.fn(), select: jest.fn(), maybeSingle: jest.fn() };
  query.update.mockReturnValue(query); query.eq.mockReturnValue(query); query.select.mockReturnValue(query); query.maybeSingle.mockResolvedValue(result);
  const db = { from: jest.fn().mockReturnValue(query) };
  await expect(updatePendingValidation(db, 'p@example.test', { pendiente_validacion: false })).resolves.toBeUndefined();
  expect(query.eq).toHaveBeenCalledWith('pendiente_validacion', true);
  query.maybeSingle.mockResolvedValue({ data: null, error: null });
  await expect(updatePendingValidation(db, 'p@example.test', { pendiente_validacion: false })).rejects.toThrow('confirmar');
  query.maybeSingle.mockResolvedValue({ data: null, error: { message: 'denied' } });
  await expect(updatePendingValidation(db, 'p@example.test', { pendiente_validacion: false })).rejects.toThrow('confirmar');
});
