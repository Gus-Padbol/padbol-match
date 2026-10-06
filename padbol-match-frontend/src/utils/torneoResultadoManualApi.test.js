/**
 * Cobertura de la llamada que reemplazó a `PUT /api/partidos/:id` en Torneo Express:
 * `POST /api/torneos/:torneoId/partidos/:partidoId/resultado` (ruta autorizada).
 */
import { buildResultadoManualTorneoBody, guardarResultadoManualTorneo } from './torneoResultadoManualApi';
import { getAuthHeaders } from './scoreboardApi';

jest.mock('./scoreboardApi', () => ({
  getAuthHeaders: jest.fn(),
}));

describe('buildResultadoManualTorneoBody', () => {
  it('traduce set1/set2 a sets ganados e historial de sets', () => {
    expect(buildResultadoManualTorneoBody({ set1: '6-3', set2: '6-4', set3: '' })).toEqual({
      goles_a: 2,
      goles_b: 0,
      historial_sets: [
        { set: 1, a: 6, b: 3 },
        { set: 2, a: 6, b: 4 },
      ],
    });
  });

  it('cuenta bien un 2-1 a tres sets', () => {
    const body = buildResultadoManualTorneoBody({ set1: '4-6', set2: '6-3', set3: '6-2' });
    expect(body.goles_a).toBe(2);
    expect(body.goles_b).toBe(1);
    expect(body.historial_sets).toHaveLength(3);
  });

  it('exige al menos dos sets', () => {
    expect(() => buildResultadoManualTorneoBody({ set1: '6-3' })).toThrow(/2 sets/);
  });

  it('rechaza un set empatado', () => {
    expect(() => buildResultadoManualTorneoBody({ set1: '6-6', set2: '6-4' })).toThrow();
  });
});

describe('guardarResultadoManualTorneo', () => {
  const okBody = {
    ok: true,
    status: 'finalized',
    partido_id: 34,
    torneo_id: 7,
    resultado: { set1: '6-3', set2: '6-4' },
  };

  beforeEach(() => {
    getAuthHeaders.mockResolvedValue({ Authorization: 'Bearer token-qa', 'Content-Type': 'application/json' });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => okBody,
    });
  });

  afterEach(() => jest.resetAllMocks());

  it('publica en la ruta autorizada del torneo y no en /api/partidos/:id', async () => {
    const data = await guardarResultadoManualTorneo({
      apiBaseUrl: 'http://localhost:3001/',
      torneoId: 7,
      partidoId: 34,
      resultado: { set1: '6-3', set2: '6-4' },
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, opciones] = global.fetch.mock.calls[0];
    expect(url).toBe('http://localhost:3001/api/torneos/7/partidos/34/resultado');
    expect(opciones.method).toBe('POST');
    expect(JSON.parse(opciones.body)).toEqual({
      goles_a: 2,
      goles_b: 0,
      historial_sets: [{ set: 1, a: 6, b: 3 }, { set: 2, a: 6, b: 4 }],
    });
    expect(data.status).toBe('finalized');
  });

  it('acepta la respuesta idempotente', async () => {
    global.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ ...okBody, status: 'idempotent' }) });
    const data = await guardarResultadoManualTorneo({
      apiBaseUrl: 'http://localhost:3001',
      torneoId: 7,
      partidoId: 34,
      resultado: { set1: '6-3', set2: '6-4' },
    });
    expect(data.status).toBe('idempotent');
  });

  it('exige sesión antes de llamar al backend', async () => {
    getAuthHeaders.mockResolvedValue({ 'Content-Type': 'application/json' });
    await expect(
      guardarResultadoManualTorneo({ apiBaseUrl: 'http://localhost:3001', torneoId: 7, partidoId: 34, resultado: { set1: '6-3', set2: '6-4' } })
    ).rejects.toThrow(/Inicia sesión/);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('propaga el error del backend', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 403, json: async () => ({ ok: false, error: 'No autorizado para administrar este torneo' }) });
    await expect(
      guardarResultadoManualTorneo({ apiBaseUrl: 'http://localhost:3001', torneoId: 7, partidoId: 34, resultado: { set1: '6-3', set2: '6-4' } })
    ).rejects.toThrow(/No autorizado/);
  });
});
