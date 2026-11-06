/**
 * REVISIÓN INDEPENDIENTE — pruebas adicionales del cliente nationsActivationApi.
 * Cubren: 401/403/409, errores sin JSON, reintento del mismo lote,
 * compatibilidad de forma de filas y casos de parseo que hoy fallan en silencio.
 * Datos ficticios. No se modificó código de producción.
 */
import {
  confirmImport, configureEvent, newBatchId, parseRows, previewImport, rowsFingerprint, validSlug,
} from './nationsActivationApi';

const getAuthHeaders = async () => ({Authorization: 'Bearer ficticio'});
const ctx = {apiBaseUrl: 'https://api.test.invalid', getAuthHeaders};

const response = ({status = 200, payload = null, jsonThrows = false}) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => {
    if (jsonThrows) throw new Error('respuesta no JSON');
    return payload;
  },
});

afterEach(() => {
  delete global.fetch;
});

describe('errores del backend (401/403/409/429/503)', () => {
  test('propaga status y code de 401 VERIFIED_ACCOUNT_REQUIRED', async () => {
    global.fetch = jest.fn(async () => response({
      status: 401,
      payload: {error: 'VERIFIED_ACCOUNT_REQUIRED', code: 'VERIFIED_ACCOUNT_REQUIRED'},
    }));
    await expect(previewImport(ctx, {slug: 'nations-cup-prueba', rows: parseRows('Jugador de prueba, XX')}))
      .rejects.toMatchObject({status: 401, code: 'VERIFIED_ACCOUNT_REQUIRED'});
  });

  test('propaga status y code de 403 CENTRAL_ADMIN_REQUIRED en confirm', async () => {
    global.fetch = jest.fn(async () => response({
      status: 403,
      payload: {error: 'CENTRAL_ADMIN_REQUIRED', code: 'CENTRAL_ADMIN_REQUIRED'},
    }));
    await expect(confirmImport(ctx, {
      slug: 'nations-cup-prueba',
      batchId: newBatchId(),
      rows: parseRows('Jugador de prueba, XX'),
    })).rejects.toMatchObject({status: 403, code: 'CENTRAL_ADMIN_REQUIRED'});
  });

  test('propaga 409 BATCH_CONFLICT y 409 IMPORT_REVIEW_REQUIRED sin reintentar', async () => {
    global.fetch = jest.fn(async () => response({status: 409, payload: {error: 'BATCH_CONFLICT', code: 'BATCH_CONFLICT'}}));
    await expect(confirmImport(ctx, {
      slug: 'nations-cup-prueba',
      batchId: newBatchId(),
      rows: parseRows('Jugador de prueba, XX'),
    })).rejects.toMatchObject({status: 409, code: 'BATCH_CONFLICT'});
    expect(global.fetch).toHaveBeenCalledTimes(1);

    global.fetch = jest.fn(async () => response({
      status: 409,
      payload: {error: 'IMPORT_REVIEW_REQUIRED', code: 'IMPORT_REVIEW_REQUIRED'},
    }));
    await expect(confirmImport(ctx, {
      slug: 'nations-cup-prueba',
      batchId: newBatchId(),
      rows: parseRows('Jugador de prueba, XX'),
    })).rejects.toMatchObject({status: 409, code: 'IMPORT_REVIEW_REQUIRED'});
  });

  test('propaga 429 RATE_LIMITED y 503 NOT_READY', async () => {
    global.fetch = jest.fn(async () => response({status: 429, payload: {error: 'RATE_LIMITED', code: 'RATE_LIMITED'}}));
    await expect(previewImport(ctx, {slug: 'nations-cup-prueba', rows: parseRows('Jugador de prueba, XX')}))
      .rejects.toMatchObject({status: 429, code: 'RATE_LIMITED'});

    global.fetch = jest.fn(async () => response({status: 503, payload: {error: 'NOT_READY', code: 'NOT_READY'}}));
    await expect(configureEvent(ctx, {slug: 'nations-cup-prueba', torneoId: 1, title: 'Evento de prueba'}))
      .rejects.toMatchObject({status: 503, code: 'NOT_READY'});
  });

  test('respuesta de error sin JSON (ej. 404 HTML de Express) no rompe con excepción de parseo', async () => {
    global.fetch = jest.fn(async () => response({status: 404, jsonThrows: true}));
    await expect(confirmImport(ctx, {
      slug: 'nations-cup-prueba',
      batchId: newBatchId(),
      rows: parseRows('Jugador de prueba, XX'),
    })).rejects.toMatchObject({status: 404});
  });
});

describe('idempotencia y lote', () => {
  test('el reintento manual reutiliza el mismo batchId (soporte de recibo idempotente del backend)', async () => {
    const batchId = newBatchId();
    global.fetch = jest.fn(async () => response({status: 200, payload: {created: 1, idempotent: true}}));
    const rows = parseRows('Jugador de prueba, XX');
    await confirmImport(ctx, {slug: 'nations-cup-prueba', batchId, rows});
    await confirmImport(ctx, {slug: 'nations-cup-prueba', batchId, rows});
    const bodies = global.fetch.mock.calls.map(([, options]) => JSON.parse(options.body));
    expect(bodies[0].batchId).toBe(batchId);
    expect(bodies[1].batchId).toBe(batchId);
    expect(bodies[1].rows).toEqual(bodies[0].rows);
  });

  test('un lote nuevo para el mismo contenido es un batchId distinto', () => {
    const a = newBatchId();
    const b = newBatchId();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(b).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  test('el contenido distinto cambia la huella (invalidación de preview)', () => {
    const base = parseRows('Jugador de prueba, XX\nOtro jugador, YY');
    expect(rowsFingerprint(base)).toBe(rowsFingerprint(parseRows('Jugador de prueba, XX\nOtro jugador, YY')));
    expect(rowsFingerprint(base)).not.toBe(rowsFingerprint(parseRows('Jugador de prueba, XX\nOtro jugador, ZZ')));
    expect(rowsFingerprint(base)).not.toBe(rowsFingerprint(parseRows('Otro jugador, YY\nJugador de prueba, XX')));
  });
});

describe('forma de filas y parseo', () => {
  test('las filas enviadas son compatibles con normalizeActivationRows (rowKey/name/country)', async () => {
    global.fetch = jest.fn(async () => response({status: 200, payload: {rows: [], canConfirm: true, errors: []}}));
    await previewImport(ctx, {slug: 'nations-cup-prueba', rows: parseRows('  Jugador   de prueba , xx  ')});
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.rows).toEqual([{rowKey: expect.stringMatching(/^r[a-z0-9]+$/), name: 'Jugador   de prueba', country: 'XX', minor: false}]);
    // El backend colapsa espacios en name; el cliente no. No rompe el contrato, pero
    // el nombre mostrado en el preview puede diferir del que confirma.
    expect(body.rows[0].name).toBe('Jugador   de prueba');
  });

  test('una coma extra en la línea descarta país real en silencio (dato inválido para el backend)', () => {
    // Esto es evidencia de un riesgo de MEDIO: "Nombre, segundo apellido, XX"
    // termina con country "SEGUNDO APELLIDO" -> el backend responde INVALID_ROW.
    // Corregido: una coma de más ahora es un error visible, no un dato silencioso.
    const rows = parseRows('Jugador, de prueba, XX');
    expect(rows).toHaveLength(0);
    expect(rows.errores[0].motivo).toMatch(/país/i);
  });

  test('filas sin país o con país de una letra pasan el parser pero el backend las rechaza', () => {
    // Corregido: país inválido o ausente ya no se envía; se informa como error.
    const rows = parseRows('Jugador de prueba' + String.fromCharCode(10) + 'Otro jugador, X');
    expect(rows).toHaveLength(0);
    expect(rows.errores).toHaveLength(2);
  });

  test('no hay tope de 500 filas en el cliente (el backend sí lo aplica)', () => {
    const rows = parseRows(Array.from({length: 501}, (_, i) => `Jugador de prueba ${i + 1}, XX`).join('\n'));
    // Corregido: el cliente corta en 500 y avisa.
    expect(rows).toHaveLength(500);
    expect(rows.errores[0].motivo).toMatch(/máximo/i);
  });

  test('validSlug exige minúsculas y guiones del contrato', () => {
    expect(validSlug('nations-cup-prueba')).toBe(true);
    expect(validSlug('Nations-Cup')).toBe(false);
    expect(validSlug('ab')).toBe(false);
    expect(validSlug('nations_cup')).toBe(false);
    expect(validSlug(' nations-cup-prueba ')).toBe(true);
  });
});
