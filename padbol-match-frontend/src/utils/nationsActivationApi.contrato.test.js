/**
 * REVISIÓN INDEPENDIENTE — pruebas de contrato frontend <-> backend nationsActivation.
 *
 * Contrato de referencia (NO se desplegó nada):
 *   .../padbol-backend-canonical/.worktrees/commercial-activation-20261105/routes/nationsActivation.js
 *   .../padbol-backend-canonical/.worktrees/commercial-activation-20261105/lib/nationsActivation.js
 *
 * Los dos primeros tests de este archivo se espera que FALLEN con el código actual:
 * documentan hallazgos bloqueantes. No se modificó código de producción.
 * Datos ficticios: "Jugador de prueba", país "XX".
 */
import {configureEvent, confirmImport, newBatchId, parseRows, previewImport} from './nationsActivationApi';

const getAuthHeaders = async () => ({Authorization: 'Bearer ficticio'});
const ctx = {apiBaseUrl: 'https://api.test.invalid', getAuthHeaders};

const ok = (payload, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => payload,
});

afterEach(() => {
  delete global.fetch;
});

describe('contrato de rutas con routes/nationsActivation.js', () => {
  test('HALLAZGO BLOQUEANTE: configure debe apuntar a /events/:slug/configure (backend linea 9)', async () => {
    global.fetch = jest.fn(async () => ok({event: {slug: 'nations-cup-prueba'}}));

    await configureEvent(ctx, {slug: 'nations-cup-prueba', torneoId: 1, title: 'Evento de prueba'});

    expect(global.fetch.mock.calls[0][0]).toBe(
      'https://api.test.invalid/api/admin/nations-activation/events/nations-cup-prueba/configure',
    );
  });

  test('HALLAZGO BLOQUEANTE: el evento recién configurado debe quedar habilitado para poder previsualizar (lib linea 15)', async () => {
    global.fetch = jest.fn(async () => ok({event: {slug: 'nations-cup-prueba'}}));

    await configureEvent(ctx, {slug: 'nations-cup-prueba', torneoId: 1, title: 'Evento de prueba'});

    // lib/nationsActivation.js:15 -> event() lanza EVENT_NOT_AVAILABLE 404 si !enabled.
    // Si configure manda enabled=false, preview y confirm son inalcanzables.
    expect(JSON.parse(global.fetch.mock.calls[0][1].body).enabled).toBe(true);
  });

  test('HALLAZGO MEDIO: validSlug recorta espacios pero la URL se envía con el slug sin recortar', async () => {
    global.fetch = jest.fn(async () => ok({rows: [], canConfirm: true, errors: []}));
    await previewImport(ctx, {slug: ' nations-cup-prueba ', rows: parseRows('Jugador de prueba, XX')});
    expect(global.fetch.mock.calls[0][0]).toBe(
      'https://api.test.invalid/api/admin/nations-activation/events/nations-cup-prueba/imports/preview',
    );
  });

  test('preview y confirm respetan las rutas del contrato', async () => {
    global.fetch = jest.fn(async () => ok({rows: [], canConfirm: true, errors: []}));
    await previewImport(ctx, {slug: 'nations-cup-prueba', rows: [{rowKey: 'row-1', name: 'Jugador de prueba', country: 'XX'}]});
    expect(global.fetch.mock.calls[0][0]).toBe(
      'https://api.test.invalid/api/admin/nations-activation/events/nations-cup-prueba/imports/preview',
    );

    global.fetch = jest.fn(async () => ok({created: 1, idempotent: false}));
    await confirmImport(ctx, {
      slug: 'nations-cup-prueba',
      batchId: newBatchId(),
      rows: [{rowKey: 'row-1', name: 'Jugador de prueba', country: 'XX'}],
    });
    expect(global.fetch.mock.calls[0][0]).toBe(
      'https://api.test.invalid/api/admin/nations-activation/events/nations-cup-prueba/imports/confirm',
    );
  });

  test('configure envía confirmed=true, rosterPublicationApproved=false y torneoId numérico', async () => {
    global.fetch = jest.fn(async () => ok({event: {slug: 'nations-cup-prueba'}}));

    await configureEvent(ctx, {
      slug: 'nations-cup-prueba',
      torneoId: '7',
      title: '  Evento de prueba  ',
      rosterPublicationApproved: true,
    });

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body).toMatchObject({
      torneoId: 7,
      title: 'Evento de prueba',
      confirmed: true,
      rosterPublicationApproved: false,
    });
    expect(body).not.toHaveProperty('roster_publication_approved');
    const [, options] = global.fetch.mock.calls[0];
    expect(options.headers.Authorization).toBe('Bearer ficticio');
    expect(options.headers['Content-Type']).toBe('application/json');
  });
});
