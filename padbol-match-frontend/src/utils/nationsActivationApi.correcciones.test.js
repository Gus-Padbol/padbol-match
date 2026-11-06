/**
 * REVISIÓN INDEPENDIENTE — verificación de las correcciones (residuales).
 * Pruebas marcadas HALLAZGO se espera que FALLEN: documentan defectos que siguen abiertos.
 * Mocks de red. Datos ficticios. No se modifica código de producción.
 */
import {
  confirmImport, configureEvent, parseRows, previewImport, tournamentHasVenue,
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

describe('M-01 — mensajes accionables con cuerpos de error reales del backend', () => {
  test('HALLAZGO MEDIO: 403 FORBIDDEN sigue mostrando el código crudo', async () => {
    global.fetch = jest.fn(async () => jsonRes({error: 'FORBIDDEN', code: 'FORBIDDEN'}, 403));
    await expect(previewImport(ctx, {slug: 'nations-cup-prueba', rows: parseRows('Jugador de prueba, XX')}))
      .rejects.toThrow(/permiso|super administrador/i);
  });

  test('HALLAZGO MEDIO: 409 BATCH_CONFLICT sigue mostrando el código crudo', async () => {
    global.fetch = jest.fn(async () => jsonRes({error: 'BATCH_CONFLICT', code: 'BATCH_CONFLICT'}, 409));
    await expect(confirmImport(ctx, {
      slug: 'nations-cup-prueba',
      batchId: '11111111-1111-4111-8111-111111111111',
      rows: parseRows('Jugador de prueba, XX'),
    })).rejects.toThrow(/vista previa|conflicto/i);
  });

  test('HALLAZGO MEDIO: 401 VERIFIED_ACCOUNT_REQUIRED sigue mostrando el código crudo', async () => {
    global.fetch = jest.fn(async () => jsonRes({error: 'VERIFIED_ACCOUNT_REQUIRED', code: 'VERIFIED_ACCOUNT_REQUIRED'}, 401));
    await expect(previewImport(ctx, {slug: 'nations-cup-prueba', rows: parseRows('Jugador de prueba, XX')}))
      .rejects.toThrow(/sesión|ingresa nuevamente/i);
  });

  test('sin JSON de error sí usa el mensaje accionable de respaldo (404)', async () => {
    global.fetch = jest.fn(async () => ({ok: false, status: 404, json: async () => { throw new Error('HTML'); }}));
    await expect(previewImport(ctx, {slug: 'nations-cup-prueba', rows: parseRows('Jugador de prueba, XX')}))
      .rejects.toThrow(/no existe|no está habilitado/i);
  });
});

describe('M-05 — columna "menor"', () => {
  test('la tercera columna "menor" marca minor=true', () => {
    const rows = parseRows('Jugador de prueba, XX, menor');
    expect(rows[0].minor).toBe(true);
    expect(rows.errores).toHaveLength(0);
  });

  test('HALLAZGO MEDIO: un tercer valor desconocido se ignora en silencio y queda adulto', () => {
    const rows = parseRows('Jugador de prueba, XX, si');
    expect(rows.errores).toHaveLength(1);
    expect(rows[0]?.minor).not.toBe(false);
  });

  test('HALLAZGO BAJO: la etiqueta del formulario no menciona la columna opcional "menor"', () => {
    const source = require('fs').readFileSync(require('path').join(__dirname, '../pages/AdminNationsActivation.jsx'), 'utf8');
    expect(source).toMatch(/menor/i);
  });
});

describe('M-03 — límites de nombre del backend (2..100, sin < >) ', () => {
  test('HALLAZGO BAJO: nombre de 101 caracteres pasa el parser y lo rechazaría el backend', () => {
    const nombre = 'J'.repeat(101);
    const rows = parseRows(`${nombre}, XX`);
    expect(rows.errores).toHaveLength(1);
  });

  test('HALLAZGO BAJO: nombre con "<" pasa el parser y lo rechazaría el backend', () => {
    const rows = parseRows('Jugador <prueba>, XX');
    expect(rows.errores).toHaveLength(1);
  });
});

describe('M-04 — rowKey derivada del contenido', () => {
  test('insertar una fila arriba no cambia la clave de las existentes', () => {
    const antes = parseRows('Jugador Uno, XX');
    const despues = parseRows('Jugador Nuevo, ZZ\nJugador Uno, XX');
    expect(antes[0].rowKey).toMatch(/^r[a-z0-9]+(-\d+)?$/);
    expect(despues.find((r) => r.name === 'Jugador Uno').rowKey).toMatch(/^r[a-z0-9]+(-\d+)?$/);
  });

  test('HALLAZGO BAJO: dos nombres distintos pueden colisionar en la misma clave base (sufijo por orden)', () => {
    // "Ana-María" y "Ana María" son nombres distintos para el backend, pero ambos
    // normalizan a "ana-mar-a|xx": la clave depende del orden para desambiguar.
    const conGuion = parseRows('Ana-María, XX\nAna María, XX');
    const invertido = parseRows('Ana María, XX\nAna-María, XX');
    const clave = (rows, nombre) => rows.find((r) => r.name === nombre).rowKey;
    expect(clave(conGuion, 'Ana-María')).toBe(clave(invertido, 'Ana-María'));
  });
});

describe('tournamentHasVenue — guard de sede', () => {
  test('bloquea cuando el torneo devuelve sede_id null', async () => {
    global.fetch = jest.fn(async () => jsonRes({id: 1, nombre: 'Torneo de prueba', sede_id: null}));
    await expect(tournamentHasVenue(ctx, '1')).resolves.toBe(false);
    expect(global.fetch.mock.calls[0][0]).toBe('https://api.test.invalid/api/torneos/1');
  });

  test('permite cuando el torneo tiene sede', async () => {
    global.fetch = jest.fn(async () => jsonRes({id: 1, sede_id: 7}));
    await expect(tournamentHasVenue(ctx, '1')).resolves.toBe(true);
  });

  test('fail-closed: sin certeza de sede no habilita la importación', async () => {
    global.fetch = jest.fn(async () => jsonRes([{id: 1, sede_id: null}]));
    await expect(tournamentHasVenue(ctx, 1)).resolves.toBe(false);

    // Respuesta que no es un torneo: no hay certeza -> se bloquea (fail-closed).
    global.fetch = jest.fn(async () => jsonRes({error: 'sin torneo'}));
    await expect(tournamentHasVenue(ctx, 1)).resolves.toBe(false);

    // Error HTTP: tampoco hay certeza -> se bloquea.
    global.fetch = jest.fn(async () => ({ok: false, status: 500, json: async () => ({})}));
    await expect(tournamentHasVenue(ctx, 1)).resolves.toBe(false);

    // Falla de red: se bloquea.
    global.fetch = jest.fn(async () => { throw new Error('network'); });
    await expect(tournamentHasVenue(ctx, 1)).resolves.toBe(false);
  });
});

describe('configure — correcciones B-01/B-02', () => {
  test('pega en /configure con enabled=true y rosterPublicationApproved=false', async () => {
    global.fetch = jest.fn(async () => jsonRes({event: {slug: 'nations-cup-prueba'}}));
    await configureEvent(ctx, {slug: 'nations-cup-prueba', torneoId: 1, title: 'Evento de prueba', enabled: false});
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe('https://api.test.invalid/api/admin/nations-activation/events/nations-cup-prueba/configure');
    expect(JSON.parse(options.body)).toMatchObject({enabled: true, confirmed: true, rosterPublicationApproved: false});
  });
});
