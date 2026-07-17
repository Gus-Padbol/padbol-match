/**
 * Tests — conexión FE a GET /api/admin/torneos/resumen-stats (sin N+1).
 */
import fs from 'fs';
import path from 'path';
import {
  TORNEOS_RESUMEN_STATS_MAX_IDS,
  canRoleFetchTorneosResumenStats,
  collectValidTorneoIds,
  buildTorneosResumenStatsFlightKey,
  normalizeTorneoResumenStatsItem,
  normalizeTorneosResumenStatsResponse,
  getTorneoResumenStat,
  fetchAdminTorneosResumenStats,
  __clearTorneosResumenStatsInflight,
  __getTorneosResumenStatsInflightSize,
} from './adminTorneosResumenStats';

const dashboardPath = path.join(__dirname, '../pages/AdminDashboard.jsx');
const dashboardSrc = fs.readFileSync(dashboardPath, 'utf8');
const membresiasApiPath = path.join(__dirname, 'membresiasAdminApi.js');
const membresiasSectionPath = path.join(__dirname, '../components/AdminMembresiasSection.jsx');

beforeEach(() => {
  __clearTorneosResumenStatsInflight();
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.resetAllMocks();
  __clearTorneosResumenStatsInflight();
});

function okPayload(items) {
  return { ok: true, data: { items } };
}

describe('adminTorneosResumenStats — ids y batch', () => {
  it('1. sin torneos no llama al batch', async () => {
    const map = await fetchAdminTorneosResumenStats({
      apiBaseUrl: 'https://api.test',
      accessToken: 'tok',
      torneoIds: [],
    });
    expect(map).toEqual({});
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('2. un torneo genera una sola llamada batch', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => okPayload([{ torneo_id: '1', equipos_count: 2 }]),
    });
    await fetchAdminTorneosResumenStats({
      apiBaseUrl: 'https://api.test',
      accessToken: 'tok',
      torneoIds: [1],
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(String(global.fetch.mock.calls[0][0])).toContain('/api/admin/torneos/resumen-stats');
    expect(String(global.fetch.mock.calls[0][0])).toContain('torneo_ids=1');
  });

  it('3. diez torneos generan una sola llamada batch', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => okPayload(Array.from({ length: 10 }, (_, i) => ({ torneo_id: String(i + 1) }))),
    });
    await fetchAdminTorneosResumenStats({
      apiBaseUrl: 'https://api.test',
      accessToken: 'tok',
      torneoIds: Array.from({ length: 10 }, (_, i) => i + 1),
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const url = String(global.fetch.mock.calls[0][0]);
    expect(url).toMatch(/torneo_ids=1%2C2%2C3/);
  });

  it('4. cincuenta torneos generan una sola llamada batch', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => okPayload([]),
    });
    await fetchAdminTorneosResumenStats({
      apiBaseUrl: 'https://api.test',
      accessToken: 'tok',
      torneoIds: Array.from({ length: 50 }, (_, i) => i + 1),
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('5. torneo_ids se deduplican', () => {
    expect(collectValidTorneoIds([{ id: 5 }, { id: '5' }, { id: 7 }, { id: 5 }])).toEqual([5, 7]);
  });

  it('6. ids inválidos se excluyen', () => {
    expect(collectValidTorneoIds([{ id: 'abc' }, { id: -1 }, { id: 0 }, { id: 3.2 }, { id: 9 }])).toEqual([9]);
  });

  it('7. más de 200 ids se manejan de forma segura (cap)', () => {
    const many = Array.from({ length: 250 }, (_, i) => ({ id: i + 1 }));
    const ids = collectValidTorneoIds(many);
    expect(ids).toHaveLength(TORNEOS_RESUMEN_STATS_MAX_IDS);
    expect(ids[0]).toBe(1);
    expect(ids[ids.length - 1]).toBe(200);
  });
});

describe('adminTorneosResumenStats — normalización', () => {
  it('8. respuesta se normaliza a mapa', () => {
    const map = normalizeTorneosResumenStatsResponse(
      okPayload([
        { torneo_id: 10, equipos_count: 3, partidos_total: 4 },
        { torneo_id: '11', equipos_count: 1 },
      ]),
    );
    expect(Object.keys(map).sort()).toEqual(['10', '11']);
    expect(map['10'].equipos_count).toBe(3);
    expect(map['10'].partidos_total).toBe(4);
  });

  it('9. numéricos inválidos se convierten a 0', () => {
    const item = normalizeTorneoResumenStatsItem({
      torneo_id: '1',
      equipos_count: 'x',
      partidos_jugados: null,
      partidos_total: -5,
    });
    expect(item.equipos_count).toBe(0);
    expect(item.partidos_jugados).toBe(0);
    expect(item.partidos_total).toBe(0);
  });

  it('10. booleanos inválidos se convierten a false', () => {
    const item = normalizeTorneoResumenStatsItem({
      torneo_id: '1',
      tiene_grupos: 'yes',
      sorteo_realizado: 1,
    });
    expect(item.tiene_grupos).toBe(false);
    expect(item.sorteo_realizado).toBe(false);
  });

  it('11. ganador ausente queda null', () => {
    const item = normalizeTorneoResumenStatsItem({
      torneo_id: '1',
      winner_equipo_id: null,
      winner_nombre: 'Hack',
    });
    expect(item.winner_nombre).toBeNull();
    expect(item.winner).toBeNull();
  });

  it('12. items duplicados se resuelven de forma determinística (último gana)', () => {
    const map = normalizeTorneosResumenStatsResponse(
      okPayload([
        { torneo_id: '1', equipos_count: 1 },
        { torneo_id: '1', equipos_count: 9 },
      ]),
    );
    expect(map['1'].equipos_count).toBe(9);
  });

  it('13. respuesta inválida produce error controlado', () => {
    expect(() => normalizeTorneosResumenStatsResponse(null)).toThrow(/inválida/i);
    expect(() => normalizeTorneosResumenStatsResponse({ ok: true, data: {} })).toThrow(/inválida/i);
  });
});

describe('adminTorneosResumenStats — cableado AdminDashboard', () => {
  it('14. no se llama a /equipos por torneo en carga de listado', () => {
    expect(dashboardSrc).not.toMatch(
      /Promise\.all\(\s*torneos\.map\([\s\S]*?\/api\/torneos\/\$\{t\.id\}\/equipos/,
    );
    expect(dashboardSrc).toMatch(/fetchAdminTorneosResumenStats/);
  });

  it('15. no se llama a /partidos por torneo en carga de listado', () => {
    expect(dashboardSrc).not.toMatch(
      /Promise\.all\(\s*torneos\.map\([\s\S]*?\/api\/torneos\/\$\{t\.id\}\/partidos/,
    );
  });

  it('16. abrir modal de sorteo conserva su request individual', () => {
    expect(dashboardSrc).toMatch(
      /abrirModalSorteoGrupos[\s\S]*?\/api\/torneos\/\$\{torneoRow\.id\}\/equipos/,
    );
  });

  it('17. abrir detalle conserva navegación a vista torneo', () => {
    expect(dashboardSrc).toMatch(/navigate\(`\/torneo\/\$\{torneo\.id\}`/);
  });

  it('30. no se modifican endpoints de detalle (rutas individuales siguen existiendo bajo demanda)', () => {
    expect(dashboardSrc).toMatch(/\/api\/torneos\/\$\{torneoRow\.id\}\/equipos/);
  });

  it('31. no se modifican reglas de torneos (crear/editar/borrar intactos)', () => {
    expect(dashboardSrc).toMatch(/abrirEditTorneo/);
    expect(dashboardSrc).toMatch(/method:\s*'DELETE'/);
  });

  it('32. no se toca Membresías de forma incorrecta (paginación server-side intacta)', () => {
    const memApi = fs.readFileSync(path.join(__dirname, 'membresiasAdminApi.js'), 'utf8');
    const memSec = fs.readFileSync(path.join(__dirname, '../components/AdminMembresiasSection.jsx'), 'utf8');
    expect(memApi).toMatch(/MEMBRESIAS_PAGE_SIZE = 15/);
    expect(memApi).toMatch(/fetchAdminMembresias/);
    expect(memSec).toMatch(/PAGE_SIZE = MEMBRESIAS_PAGE_SIZE|MEMBRESIAS_PAGE_SIZE/);
    expect(memSec).not.toMatch(/limit:\s*100/);
    expect(dashboardSrc).not.toMatch(/membresiasAdminApi.*resumen-stats|resumen-stats.*membresias/);
  });
});

describe('adminTorneosResumenStats — errores, dedupe, roles', () => {
  it('18. error batch no vacía listado (fetch lanza; caller conserva torneos)', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'boom' }),
    });
    await expect(
      fetchAdminTorneosResumenStats({
        apiBaseUrl: 'https://api.test',
        accessToken: 'tok',
        torneoIds: [1],
      }),
    ).rejects.toThrow();
    // El listado de torneos vive fuera de esta función; el error es controlado.
  });

  it('19. error batch: normalización previa se puede conservar (mapa no se muta)', () => {
    const prev = normalizeTorneosResumenStatsResponse(
      okPayload([{ torneo_id: '1', equipos_count: 4 }]),
    );
    expect(() => normalizeTorneosResumenStatsResponse({ bad: true })).toThrow();
    expect(prev['1'].equipos_count).toBe(4);
  });

  it('20. reintento hace una sola llamada por intento', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => okPayload([{ torneo_id: '1' }]),
    });
    await fetchAdminTorneosResumenStats({
      apiBaseUrl: 'https://api.test',
      accessToken: 'tok',
      torneoIds: [1],
    });
    await fetchAdminTorneosResumenStats({
      apiBaseUrl: 'https://api.test',
      accessToken: 'tok',
      torneoIds: [1],
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('21. requests simultáneos iguales se deduplican', async () => {
    let resolveJson;
    global.fetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveJson = () =>
            resolve({
              ok: true,
              json: async () => okPayload([{ torneo_id: '1', equipos_count: 2 }]),
            });
        }),
    );
    const p1 = fetchAdminTorneosResumenStats({
      apiBaseUrl: 'https://api.test',
      accessToken: 'tok',
      torneoIds: [1],
    });
    const p2 = fetchAdminTorneosResumenStats({
      apiBaseUrl: 'https://api.test',
      accessToken: 'tok',
      torneoIds: [1],
    });
    expect(__getTorneosResumenStatsInflightSize()).toBe(1);
    resolveJson();
    const [a, b] = await Promise.all([p1, p2]);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(a['1'].equipos_count).toBe(2);
    expect(b['1'].equipos_count).toBe(2);
  });

  it('22. respuesta stale: flight key distinta no comparte promesa', async () => {
    expect(buildTorneosResumenStatsFlightKey({ torneoIds: [1] })).not.toBe(
      buildTorneosResumenStatsFlightKey({ torneoIds: [1, 2] }),
    );
  });

  it('23. torneoStatsTick cableado a batch (no a 2N)', () => {
    expect(dashboardSrc).toMatch(/torneoStatsTick/);
    expect(dashboardSrc).toMatch(/fetchAdminTorneosResumenStats/);
    expect(dashboardSrc).not.toMatch(
      /torneos\.map\(async \(t\) => \{[\s\S]*?\/equipos[\s\S]*?\/partidos/,
    );
  });

  it('24. admin_club usa batch', () => {
    expect(canRoleFetchTorneosResumenStats('admin_club')).toBe(true);
    expect(dashboardSrc).toMatch(/canRoleFetchTorneosResumenStats\(rolPanel\)/);
  });

  it('25. super_admin usa batch', () => {
    expect(canRoleFetchTorneosResumenStats('super_admin')).toBe(true);
  });

  it('26. admin_nacional no dispara batch (evita 403)', () => {
    expect(canRoleFetchTorneosResumenStats('admin_nacional')).toBe(false);
  });

  it('27. empleado no dispara batch (evita 403)', () => {
    expect(canRoleFetchTorneosResumenStats('empleado')).toBe(false);
  });

  it('28. stats faltantes no rompen card (getter null-safe)', () => {
    expect(getTorneoResumenStat({}, 99)).toBeNull();
    expect(getTorneoResumenStat(null, 1)).toBeNull();
  });

  it('29. ganador null no se inventa', () => {
    const item = normalizeTorneoResumenStatsItem({
      torneo_id: '1',
      winner_equipo_id: '',
      winner_nombre: 'X',
    });
    expect(item.winner).toBeNull();
    expect(item.winner_nombre).toBeNull();
  });
});
