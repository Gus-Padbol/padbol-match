import { fetchAdminListaEsperaGeneral } from './listaEsperaAdminApi';

const response = (body, ok = true) => ({ ok, json: async () => body });
afterEach(() => { delete global.fetch; });

test('reúne ambos intereses de la sede conservando su origen', async () => {
  global.fetch = jest.fn()
    .mockResolvedValueOnce(response({ lista: [{ id: 1, deporte: 'padbol', nombre: 'Jugador' }] }))
    .mockResolvedValueOnce(response({ interesados: [{ id: 1, deporte: null, nombre: 'Otra persona' }] }));
  const result = await fetchAdminListaEsperaGeneral({ sedeId: 7, accessToken: 'test', apiBaseUrl: 'https://example.test' });
  expect(result.items).toEqual([
    { id: 1, deporte: 'padbol', nombre: 'Jugador', waitlistSource: 'sport' },
    { id: 1, deporte: null, nombre: 'Otra persona', waitlistSource: 'venue' },
  ]);
  expect(global.fetch).toHaveBeenCalledWith('https://example.test/api/admin/sedes/7/torneo-interes', expect.objectContaining({ headers: { Authorization: 'Bearer test' } }));
});

test('admite también el formato anterior para interés por deporte', async () => {
  global.fetch = jest.fn().mockResolvedValueOnce(response({ items: [{ id: 1 }] })).mockResolvedValueOnce(response({ interesados: [] }));
  expect((await fetchAdminListaEsperaGeneral({ sedeId: 7 })).items).toEqual([{ id: 1, waitlistSource: 'sport' }]);
});

test('un fallo de cualquiera de las consultas se informa y no parece lista vacía', async () => {
  global.fetch = jest.fn().mockResolvedValueOnce(response({ lista: [] })).mockResolvedValueOnce(response({ error: 'Sin permiso' }, false));
  await expect(fetchAdminListaEsperaGeneral({ sedeId: 7 })).rejects.toThrow('Sin permiso');
});

test('una respuesta desconocida se informa como error', async () => {
  global.fetch = jest.fn().mockResolvedValueOnce(response({ lista: [] })).mockResolvedValueOnce(response({ unexpected: true }));
  await expect(fetchAdminListaEsperaGeneral({ sedeId: 7 })).rejects.toThrow('interpretar');
});
