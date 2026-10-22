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

test('actualiza por id autenticado y exige confirmación', async () => {
  const { updatePendingValidation } = require('./adminPendingValidationsApi');
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
  const request = {apiBaseUrl:'https://example.test', accessToken:'test', id:12, accion:'categoria', nivel:'3ra'};
  await updatePendingValidation(request);
  expect(global.fetch).toHaveBeenCalledWith('https://example.test/api/admin/validaciones/perfil/12', expect.objectContaining({method:'PATCH',body:JSON.stringify({accion:'categoria',nivel:'3ra'})}));
  global.fetch.mockResolvedValue({ok:false,json:async()=>({error:'conflicto'})});
  await expect(updatePendingValidation(request)).rejects.toThrow('conflicto');
  await expect(updatePendingValidation({...request,id:9007199254740992})).rejects.toThrow('Perfil inválido');
});

test('rechaza por identificador estable usando sesión y motivo', async () => {
  const { updatePendingValidation } = require('./adminPendingValidationsApi');
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ok:true}) });
  await updatePendingValidation({apiBaseUrl:'https://example.test',accessToken:'test',id:42,accion:'rechazar',motivo:'Solicitud rechazada'});
  expect(global.fetch).toHaveBeenCalledWith('https://example.test/api/admin/validaciones/perfil/42', expect.objectContaining({
    method:'PATCH', headers:expect.objectContaining({Authorization:'Bearer test'}),
    body:JSON.stringify({accion:'rechazar',motivo:'Solicitud rechazada'})
  }));
});
