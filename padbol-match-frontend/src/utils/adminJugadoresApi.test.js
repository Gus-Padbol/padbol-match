import {
  filterAdminJugadoresByVinculacion,
  formatJugadorActivity,
  normalizeAdminJugadoresSearchItems,
  parseAdminJugadoresApiError,
  sortAdminJugadoresItems,
} from './adminJugadoresApi';

describe('adminJugadoresApi helpers', () => {
  it('normaliza items de búsqueda en varios shapes', () => {
    expect(normalizeAdminJugadoresSearchItems({ items: [{ user_id: '1' }] })).toHaveLength(1);
    expect(normalizeAdminJugadoresSearchItems([{ user_id: '2' }])).toHaveLength(1);
    expect(normalizeAdminJugadoresSearchItems({ jugadores: [{ user_id: '3' }] })).toHaveLength(1);
    expect(normalizeAdminJugadoresSearchItems({})).toEqual([]);
  });

  it('mensajes de error 401/403/500', () => {
    expect(parseAdminJugadoresApiError(401, {})).toMatch(/401|sesión/i);
    expect(parseAdminJugadoresApiError(403, {})).toMatch(/403|permiso/i);
    expect(parseAdminJugadoresApiError(500, { error: 'boom' })).toBe('boom');
  });

  it('formatea la actividad con la región elegida', () => {
    const iso = '2026-06-15T12:00:00Z';
    expect(formatJugadorActivity(iso, 'de-DE')).toBe('15.06.2026');
    expect(formatJugadorActivity(iso, 'de-DE')).not.toBe(formatJugadorActivity(iso, 'en-US'));
  });

  it('ordena y filtra por vinculación', () => {
    const rows = [
      { display_name: 'Bruno', vinculacion: 'registrado', last_activity_at: '2026-01-01' },
      { display_name: 'Ana', vinculacion: 'con_historial', last_activity_at: '2026-06-01' },
    ];
    expect(sortAdminJugadoresItems(rows, 'name_asc')[0].display_name).toBe('Ana');
    expect(filterAdminJugadoresByVinculacion(rows, 'con_historial')).toHaveLength(1);
  });
});

import {
  fetchAdminJugadoresList,
  normalizeAdminJugadoresListResponse,
} from './adminJugadoresApi';

describe('adminJugadoresApi listado', () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; });

  it('normaliza el sobre del listado y marca el alcance global', () => {
    expect(normalizeAdminJugadoresListResponse({
      items: [{ user_id: '1' }], total: '2', total_pages: '3', page: '2', limit: '20', scope: 'global',
    })).toEqual({
      items: [{ user_id: '1' }], total: 2, total_pages: 3, page: 2, limit: 20, scope: 'global',
    });
    expect(normalizeAdminJugadoresListResponse({}).scope).toBe('sede');
    expect(normalizeAdminJugadoresListResponse(null).total_pages).toBe(1);
  });

  it('omite sede_id en Todos y envía q, orden y página', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [], total: 0, total_pages: 1, scope: 'global' }),
    });
    await fetchAdminJugadoresList({
      apiBaseUrl: 'https://api.test/',
      accessToken: 'token',
      sedeId: undefined,
      q: 'ana',
      page: 2,
      limit: 20,
      orden: 'name_desc',
    });
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe('https://api.test/api/admin/jugadores?q=ana&orden=name_desc&page=2&limit=20');
    expect(options.headers.Authorization).toBe('Bearer token');
  });

  it('incluye sede_id y vinculacion cuando hay filtro de sede', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [], total: 0, total_pages: 1 }),
    });
    await fetchAdminJugadoresList({
      apiBaseUrl: 'https://api.test',
      accessToken: 'token',
      sedeId: 7,
      q: '',
      page: 1,
      limit: 20,
      vinculacion: 'vinculado',
      orden: 'name_asc',
    });
    expect(global.fetch.mock.calls[0][0]).toBe(
      'https://api.test/api/admin/jugadores?sede_id=7&vinculacion=vinculado&orden=name_asc&page=1&limit=20',
    );
  });

  it('sin token rechaza 401 sin llamar a fetch', async () => {
    global.fetch = jest.fn();
    await expect(fetchAdminJugadoresList({ accessToken: '' })).rejects.toMatchObject({ status: 401 });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('propaga 403 con código del backend', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: 'No podés consultar jugadores de otra sede', code: 'FORBIDDEN' }),
    });
    await expect(fetchAdminJugadoresList({ apiBaseUrl: 'https://api.test', accessToken: 'token' }))
      .rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
  });
});
