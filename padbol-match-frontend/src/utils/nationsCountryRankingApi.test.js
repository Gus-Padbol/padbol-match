import { fetchNationsCountryRanking, NATIONS_COUNTRY_RANKING_PATH } from './nationsCountryRankingApi';

const payload = {
  ok: true,
  items: [{
    pais: 'AR',
    puntos_total: 300,
    torneos_count: 1,
    torneos_pendientes: 0,
    posicion: 1,
    pendiente: false,
    torneos: [{ torneo_id: 1, posicion: 1, puntos: 300 }],
  }, {
    pais: 'IT',
    puntos_total: 0,
    torneos_count: 0,
    torneos_pendientes: 1,
    posicion: null,
    pendiente: true,
    torneos: [],
  }],
};

test('reads the accumulated country endpoint instead of the individual ranking contract', async () => {
  const fetchImpl = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => payload });
  const items = await fetchNationsCountryRanking({ baseUrl: 'https://api.example', fetchImpl });

  expect(fetchImpl).toHaveBeenCalledTimes(1);
  expect(fetchImpl.mock.calls[0][0]).toBe(`https://api.example${NATIONS_COUNTRY_RANKING_PATH}`);
  expect(items).toHaveLength(2);
  expect(items[0]).toMatchObject({ pais: 'AR', puntos_total: 300, posicion: 1, pendiente: false });
  expect(items[1]).toMatchObject({ pais: 'IT', posicion: null, pendiente: true, torneos_pendientes: 1 });
});

test('network and payload failures are surfaced, never treated as an empty ranking', async () => {
  await expect(fetchNationsCountryRanking({
    baseUrl: 'https://api.example',
    fetchImpl: jest.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) }),
  })).rejects.toThrow('Country ranking 503');

  for (const invalid of [
    { ok: false, items: [] },
    { ok: true, items: 'nope' },
    { ok: true, items: [{ ...payload.items[0], pais: 'ar' }] },
    { ok: true, items: [{ ...payload.items[0], puntos_total: -1 }] },
    { ok: true, items: [{ ...payload.items[0], posicion: 0 }] },
  ]) {
    await expect(fetchNationsCountryRanking({
      baseUrl: 'https://api.example',
      fetchImpl: jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => invalid }),
    })).rejects.toThrow('Country ranking payload invalid');
  }
});

test('pending positions remain null and are normalized explicitly', async () => {
  const fetchImpl = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => payload });
  const items = await fetchNationsCountryRanking({ baseUrl: '', fetchImpl });
  expect(items[1].posicion).toBeNull();
  expect(items[1].torneos).toEqual([]);
});
