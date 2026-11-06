/**
 * REVISIÓN INDEPENDIENTE — verificación del DELTA (segunda tanda).
 * Pruebas marcadas HALLAZGO se espera que FALLEN: documentan residuales.
 * Mocks de red. Datos ficticios.
 */
import {
  configureEvent, confirmImport, parseRows, previewImport, readTournamentVenue, tournamentHasVenue,
} from './nationsActivationApi';

const getAuthHeaders = async () => ({Authorization: 'Bearer ficticio'});
const ctx = {apiBaseUrl: 'https://api.test.invalid', getAuthHeaders};
const jsonRes = (payload, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => payload,
});

afterEach(() => {
  delete global.fetch;
});

describe('MEDIO-1 — mensajes por código (verificación independiente)', () => {
  test.each([
    ['VERIFIED_ACCOUNT_REQUIRED', 401, /cuenta|verific/i],
    ['FORBIDDEN', 403, /permiso/i],
    ['CENTRAL_ADMIN_REQUIRED', 403, /administrador central/i],
    ['EVENT_NOT_AVAILABLE', 404, /evento/i],
    ['BATCH_CONFLICT', 409, /lote|vista previa/i],
    ['IMPORT_REVIEW_REQUIRED', 409, /revisión/i],
    ['ROW_KEY_CONFLICT', 409, /fila/i],
    ['MATCH_ALREADY_IMPORTED', 409, /ya fue importada/i],
    ['RATE_LIMITED', 429, /espera/i],
    ['NOT_READY', 503, /no está disponible/i],
    ['INVALID_ROW', 400, /filas|inválid/i],
  ])('%s (%i) muestra un mensaje accionable y conserva el código', async (code, status, message) => {
    global.fetch = jest.fn(async () => jsonRes({error: code, code}, status));
    const promise = previewImport(ctx, {slug: 'nations-cup-prueba', rows: parseRows('Jugador de prueba, XX')});
    await expect(promise).rejects.toMatchObject({code, status});
    await expect(previewImport(ctx, {slug: 'nations-cup-prueba', rows: parseRows('Jugador de prueba, XX')}))
      .rejects.toThrow(message);
  });

  test('HALLAZGO BAJO: códigos de configure/registro sin entrada específica caen en un mensaje genérico', async () => {
    // El backend puede devolver estos códigos en configure/confirm. El mapa no los
    // cubre; el fallback por status es genérico (y en configure habla de "vista previa").
    global.fetch = jest.fn(async () => jsonRes({error: 'OFFICIAL_EVENT_REQUIRED', code: 'OFFICIAL_EVENT_REQUIRED'}, 409));
    await expect(configureEvent(ctx, {slug: 'nations-cup-prueba', torneoId: 1, title: 'Evento de prueba'}))
      .rejects.toThrow(/oficial|selecciones|padbol/i);

    global.fetch = jest.fn(async () => jsonRes({error: 'REGISTRATION_CLOSED', code: 'REGISTRATION_CLOSED'}, 409));
    await expect(confirmImport(ctx, {
      slug: 'nations-cup-prueba',
      batchId: '11111111-1111-4111-8111-111111111111',
      rows: parseRows('Jugador de prueba, XX'),
    })).rejects.toThrow(/cerrad|inscripción|partidos/i);

    global.fetch = jest.fn(async () => jsonRes({error: 'INVALID_EVENT_CONFIG', code: 'INVALID_EVENT_CONFIG'}, 400));
    await expect(configureEvent(ctx, {slug: 'nations-cup-prueba', torneoId: 1, title: 'Evento de prueba'}))
      .rejects.toThrow(/configuración|título|evento/i);
  });
});

describe('BAJO-1 — nombre 2..100 y sin < >', () => {
  test('rechaza 101 caracteres, "<" y ">"', () => {
    expect(parseRows(`${'J'.repeat(101)}, XX`).errores).toHaveLength(1);
    expect(parseRows('Jugador <prueba>, XX').errores).toHaveLength(1);
    expect(parseRows('Jugador >prueba>, XX').errores).toHaveLength(1);
  });

  test('HALLAZGO BAJO: caracteres de control no se rechazan en el cliente (el backend sí)', () => {
    const rows = parseRows('Jugador\u0007prueba, XX');
    expect(rows.errores).toHaveLength(1);
  });
});

describe('BAJO-2 — rowKey opaca y estable', () => {
  test('no contiene el nombre y es estable al insertar/reordenar', () => {
    const antes = parseRows('Jugador de prueba, XX');
    const despues = parseRows('Jugador Nuevo, ZZ\nJugador de prueba, XX');
    const clave = (rows, nombre) => rows.find((r) => r.name === nombre).rowKey;
    expect(clave(antes, 'Jugador de prueba')).toBe(clave(despues, 'Jugador de prueba'));
    expect(clave(antes, 'Jugador de prueba')).toMatch(/^r[a-z0-9]+$/);
    expect(clave(antes, 'Jugador de prueba')).not.toMatch(/jugador|prueba/i);
  });

  test('nombres distintos que antes colisionaban por normalización ahora tienen claves distintas', () => {
    const rows = parseRows('Ana-María, XX\nAna María, XX');
    expect(rows[0].rowKey).not.toBe(rows[1].rowKey);
  });

  test('duplicados exactos reciben sufijo determinista por orden', () => {
    const rows = parseRows('Jugador de prueba, XX\nJugador de prueba, XX');
    expect(rows[0].rowKey).not.toBe(rows[1].rowKey);
    expect(rows[1].rowKey).toMatch(/-2$/);
  });
});

describe('MEDIO-5 — tercera columna "menor"', () => {
  test('acepta "menor" y rechaza cualquier otro valor', () => {
    expect(parseRows('Jugador de prueba, XX, menor')[0].minor).toBe(true);
    expect(parseRows('Jugador de prueba, XX, Menor')[0].minor).toBe(true);
    expect(parseRows('Jugador de prueba, XX, si').errores).toHaveLength(1);
    expect(parseRows('Jugador de prueba, XX, 1').errores).toHaveLength(1);
  });
});

describe('Guard de sede — fail-closed (verificación independiente)', () => {
  test('sin certeza (HTTP error, red, respuesta no-torneo, id inválido) no habilita', async () => {
    global.fetch = jest.fn(async () => ({ok: false, status: 500, json: async () => ({})}));
    await expect(readTournamentVenue(ctx, 1)).resolves.toEqual({known: false, hasVenue: false});

    global.fetch = jest.fn(async () => { throw new Error('network'); });
    await expect(readTournamentVenue(ctx, 1)).resolves.toEqual({known: false, hasVenue: false});

    global.fetch = jest.fn(async () => jsonRes({error: 'x'}));
    await expect(readTournamentVenue(ctx, 1)).resolves.toEqual({known: false, hasVenue: false});

    await expect(readTournamentVenue(ctx, 0)).resolves.toEqual({known: false, hasVenue: false});
    await expect(tournamentHasVenue(ctx, 0)).resolves.toBe(false);
  });

  test('con tourneo y sede devuelve certeza', async () => {
    global.fetch = jest.fn(async () => jsonRes({id: 7, sede_id: 3}));
    await expect(readTournamentVenue(ctx, '7')).resolves.toEqual({known: true, hasVenue: true});
  });
});
