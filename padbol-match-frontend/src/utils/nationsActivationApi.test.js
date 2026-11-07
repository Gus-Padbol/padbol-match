import {confirmImport, configureEvent, newBatchId, parseRows, previewImport, rowsFingerprint, validSlug} from './nationsActivationApi';

const getAuthHeaders = async () => ({Authorization: 'Bearer ficticio'});
const ctx = {apiBaseUrl: 'https://api.test.invalid', getAuthHeaders};

function mockFetch(payload, ok = true, status = 200) {
  return jest.fn(async () => ({ok, status, json: async () => payload}));
}

describe('nationsActivationApi', () => {
  afterEach(() => { delete global.fetch; });

  test('parsea filas ficticias y normaliza el país en mayúsculas', () => {
    const rows = parseRows('Jugador Uno, xx\n\nJugador Dos,yy ');
    expect([...rows]).toEqual([
      {rowKey: expect.stringMatching(/^r[a-z0-9]+(-\d+)?$/), name: 'Jugador Uno', country: 'XX', minor: false, ageStatus: 'desconocido'},
      {rowKey: expect.stringMatching(/^r[a-z0-9]+(-\d+)?$/), name: 'Jugador Dos', country: 'YY', minor: false, ageStatus: 'desconocido'},
    ]);
  });

  test('la huella cambia cuando cambian las filas e invalida el preview', () => {
    const a = parseRows('Jugador Uno, XX');
    const b = parseRows('Jugador Uno, XX\nJugador Dos, YY');
    expect(rowsFingerprint(a)).not.toEqual(rowsFingerprint(b));
    expect(rowsFingerprint(a)).toEqual(rowsFingerprint(parseRows('Jugador Uno, XX')));
  });

  test('la clave de fila no depende del orden: insertar arriba no la cambia', () => {
    const antes = parseRows('Jugador Uno, XX');
    const despues = parseRows('Jugador Nuevo, ZZ\nJugador Uno, XX');
    const clave = (rows, nombre) => rows.find((r) => r.name === nombre).rowKey;
    expect(clave(antes, 'Jugador Uno')).toBe(clave(despues, 'Jugador Uno'));
    expect(clave(despues, 'Jugador Nuevo')).not.toBe(clave(despues, 'Jugador Uno'));
  });

  test('el lote es estable al reintentar el mismo contenido', () => {
    const uno = newBatchId();
    const dos = newBatchId();
    expect(uno).not.toEqual(dos);
    expect(uno).toMatch(/^[0-9a-f-]{36}$/);
  });

  test('configurar pega en /configure, habilita el evento y nunca aprueba la nómina', async () => {
    global.fetch = mockFetch({event: {slug: 'nations-cup-prueba'}});
    await configureEvent(ctx, {slug: 'nations-cup-prueba', torneoId: 1, title: 'Evento de prueba'});
    const url = global.fetch.mock.calls[0][0];
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(url).toBe('https://api.test.invalid/api/admin/nations-activation/events/nations-cup-prueba/configure');
    expect(body.confirmed).toBe(true);
    expect(body.enabled).toBe(true);
    expect(body.rosterPublicationApproved).toBe(false);
  });

  test('preview rechaza filas vacías sin llamar a la API', async () => {
    global.fetch = mockFetch({});
    await expect(previewImport(ctx, {slug: 'nations-cup-prueba', rows: []})).rejects.toMatchObject({code: 'EMPTY_ROWS'});
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('confirmar exige lote y propaga el recibo idempotente', async () => {
    global.fetch = mockFetch({idempotent: true, inserted: 2});
    const data = await confirmImport(ctx, {slug: 'nations-cup-prueba', batchId: newBatchId(), rows: parseRows('Jugador Uno, XX')});
    expect(data.idempotent).toBe(true);
    const url = global.fetch.mock.calls[0][0];
    expect(url).toBe('https://api.test.invalid/api/admin/nations-activation/events/nations-cup-prueba/imports/confirm');
    await expect(confirmImport(ctx, {slug: 'nations-cup-prueba', batchId: '', rows: []})).rejects.toMatchObject({code: 'MISSING_BATCH'});
  });

  test('sin sesión no se llama a la API', async () => {
    global.fetch = mockFetch({});
    await expect(previewImport({apiBaseUrl: 'https://api.test.invalid', getAuthHeaders: async () => ({})}, {slug: 'nations-cup-prueba', rows: parseRows('Jugador de prueba, XX')}))
      .rejects.toMatchObject({code: 'NO_SESSION'});
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('slug inválido se rechaza antes de salir a la red', () => {
    expect(validSlug('Nations')).toBe(false);
    expect(validSlug('nations-cup-prueba')).toBe(true);
  });
});
