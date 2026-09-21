import { buildResultadoManualTorneoBody, guardarResultadoManualTorneo } from './torneoResultadoManualApi';
import { getAuthHeaders } from './scoreboardApi';

jest.mock('./scoreboardApi', () => ({ getAuthHeaders: jest.fn() }));
const originalFetch = global.fetch;
const options = {
  apiBaseUrl: 'https://qa.example.test/', torneoId: 28, partidoId: 45,
  resultado: { set1: '6-4', set2: '3-6', set3: '7-5' },
};
const response = {
  ok: true, status: 'finalized', torneo_id: 28, partido_id: 45, ganador_equipo_id: 71,
  resultado: { goles_a: 2, goles_b: 1, historial_sets: [{ set: 1, a: 6, b: 4 }, { set: 2, a: 3, b: 6 }, { set: 3, a: 7, b: 5 }] },
};

beforeEach(() => {
  getAuthHeaders.mockResolvedValue({ 'Content-Type': 'application/json', Authorization: 'Bearer test-session' });
  global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => response });
});
afterEach(() => { global.fetch = originalFetch; jest.clearAllMocks(); });

test.each([
  [{ set1: '6-4', set2: '6-0' }, 2, 0],
  [{ set1: '3-6', set2: '2-6' }, 0, 2],
  [{ set1: '6-4', set2: '3-6', set3: '7-5' }, 2, 1],
])('goles_a/b son sets ganados; los games se conservan en historial_sets', (input, winsA, winsB) => {
  const body = buildResultadoManualTorneoBody(input);
  expect(body.goles_a).toBe(winsA);
  expect(body.goles_b).toBe(winsB);
  expect(body.historial_sets[0]).toEqual({ set: 1, a: Number(input.set1[0]), b: Number(input.set1[2]) });
  expect(body.historial_sets).toHaveLength(winsA + winsB);
});

test('envía POST autenticado al torneo y partido correctos sin asignar ganador o fuente desde el cliente', async () => {
  await expect(guardarResultadoManualTorneo(options)).resolves.toEqual(response);
  const [url, request] = global.fetch.mock.calls[0];
  expect(url).toBe('https://qa.example.test/api/torneos/28/partidos/45/resultado');
  expect(request.method).toBe('POST');
  expect(request.headers.Authorization).toBe('Bearer test-session');
  expect(JSON.parse(request.body)).toEqual(response.resultado);
  expect(getAuthHeaders).toHaveBeenCalledTimes(1);
});

test.each([
  { set1: '6-4', set2: '' },
  { set1: '6-4', set2: '4-6' },
  { set1: '6-4', set2: '6-3', set3: '1-6' },
  { set1: '6-6', set2: '6-3' },
  { set1: '6.5-4', set2: '6-3' },
  { set1: '8-4', set2: '6-3' },
])('no envía resultados incompletos, empatados o con un tercer set de más', async resultado => {
  await expect(guardarResultadoManualTorneo({ ...options, resultado })).rejects.toThrow();
  expect(global.fetch).not.toHaveBeenCalled();
});

test('sin sesión detiene el envío antes de tocar el servidor', async () => {
  getAuthHeaders.mockResolvedValue({ 'Content-Type': 'application/json' });
  await expect(guardarResultadoManualTorneo(options)).rejects.toMatchObject({ status: 401 });
  expect(global.fetch).not.toHaveBeenCalled();
});

test.each([401, 403, 409, 500])('conserva el error HTTP %i para que no se confirme un guardado fallido', async status => {
  global.fetch.mockResolvedValue({ ok: false, status, json: async () => ({ error: 'Resultado no autorizado', code: 'QA_REJECTED' }) });
  await expect(guardarResultadoManualTorneo(options)).rejects.toMatchObject({ message: 'Resultado no autorizado', status, code: 'QA_REJECTED' });
});

test('una respuesta ilegible o de otro partido no se toma como confirmación', async () => {
  global.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => { throw new Error('HTML'); } });
  await expect(guardarResultadoManualTorneo(options)).rejects.toThrow();
  global.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ ...response, partido_id: 99 }) });
  await expect(guardarResultadoManualTorneo(options)).rejects.toThrow(/no confirmó/);
});

test('un reintento idempotente se acepta sin cambiar el contrato', async () => {
  global.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ ...response, status: 'idempotent' }) });
  await expect(guardarResultadoManualTorneo(options)).resolves.toMatchObject({ status: 'idempotent' });
});
