/**
 * REVISIÓN INDEPENDIENTE — pruebas que documentan HALLAZGOS de AdminNationsActivation.
 * Se espera que estas pruebas FALLEN con el código actual: cada fallo es la evidencia
 * de un defecto reportado. Mocks de red/hooks: NO es end-to-end. Datos ficticios.
 */
import React from 'react';
import {act, fireEvent, render, screen} from '@testing-library/react';

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    session: {user: {id: 'user-ficticio', email: 'admin@test.invalid'}, access_token: 'token-ficticio'},
  }),
}));
jest.mock('../hooks/useUserRole', () => ({
  __esModule: true,
  default: () => ({rol: 'super_admin'}),
}));
jest.mock('../utils/apiPublicBaseUrl', () => ({getApiBaseUrl: () => 'https://api.test.invalid'}));
jest.mock('../utils/scoreboardApi', () => ({
  getAuthHeaders: async () => ({Authorization: 'Bearer ficticio'}),
}));

// eslint-disable-next-line import/first
import AdminNationsActivation from './AdminNationsActivation';

const jsonRes = (payload, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => payload,
});
const deferred = () => {
  let resolve;
  const promise = new Promise((res) => { resolve = res; });
  return {promise, resolve};
};
const configureOk = {event: {slug: 'nations-cup-prueba', namesPublic: false}};

function installBackend({preview, confirm, strictRoutes = false} = {}) {
  const fetchMock = jest.fn(async (url, options = {}) => {
    // El guard de sede consulta el torneo del evento antes de confirmar.
    if (/\/api\/torneos\/\d+$/.test(String(url))) {
      return jsonRes({id: 1, nombre: 'Torneo de prueba', sede_id: 7});
    }
    if (url.endsWith('/imports/preview')) {
      return preview ? preview(options) : jsonRes({rows: [], canConfirm: true, errors: []});
    }
    if (url.endsWith('/imports/confirm')) {
      return confirm ? confirm(options) : jsonRes({created: 1, idempotent: false});
    }
    if (url.endsWith('/configure')) return jsonRes(configureOk);
    if (strictRoutes) return jsonRes({error: 'Not Found', code: 'NOT_FOUND'}, 404);
    return jsonRes(configureOk);
  });
  global.fetch = fetchMock;
  return fetchMock;
}

function configureEvent() {
  fireEvent.change(screen.getByLabelText(/Identificador del evento/), {target: {value: 'nations-cup-prueba'}});
  fireEvent.change(screen.getByLabelText(/Torneo \(id\)/), {target: {value: '1'}});
  fireEvent.change(screen.getByLabelText(/Título interno/), {target: {value: 'Evento de prueba'}});
  fireEvent.click(screen.getByRole('button', {name: 'Configurar evento'}));
}

async function previewRows() {
  fireEvent.change(screen.getByLabelText(/Filas/), {target: {value: 'Jugador de prueba, XX'}});
  fireEvent.click(screen.getByRole('button', {name: 'Ver vista previa'}));
  await screen.findByRole('table');
}

afterEach(() => {
  delete global.fetch;
});

test('HALLAZGO BLOQUEANTE: configure solo funciona si la URL incluye /configure (contrato del backend)', async () => {
  installBackend({strictRoutes: true});
  render(<AdminNationsActivation />);

  configureEvent();

  // routes/nationsActivation.js:9 expone POST .../events/:slug/configure.
  // El cliente postea a .../events/:slug -> 404 y la pantalla queda inutilizable.
  expect(await screen.findByText(/Evento configurado/)).toBeInTheDocument();
});

test('HALLAZGO ALTO: canConfirm=false y errores por fila del preview se ignoran; confirmar queda habilitado', async () => {
  installBackend({
    preview: () => jsonRes({
      rows: [{
        rowKey: 'row-1',
        name: 'Jugador de prueba',
        country: 'XX',
        matchedParticipantId: null,
        errors: ['MATCH_REVIEW_REQUIRED'],
      }],
      canConfirm: false,
      errors: ['MATCH_REVIEW_REQUIRED'],
    }),
  });
  render(<AdminNationsActivation />);
  configureEvent();
  await screen.findByText(/Evento configurado/);
  await previewRows();

  // El backend avisó que este lote NO se puede confirmar (lib/nationsActivation.js:33,46).
  expect(screen.getByRole('button', {name: 'Confirmar importación'})).toBeDisabled();
});

test('HALLAZGO ALTO: cambiar el slug/evento después del preview no invalida el lote ni la confirmación', async () => {
  const fetchMock = installBackend({
    preview: () => jsonRes({
      rows: [{rowKey: 'row-1', name: 'Jugador de prueba', country: 'XX', errors: []}],
      canConfirm: true,
      errors: [],
    }),
  });
  render(<AdminNationsActivation />);
  configureEvent();
  await screen.findByText(/Evento configurado/);
  await previewRows();

  fireEvent.change(screen.getByLabelText(/Identificador del evento/), {target: {value: 'nations-cup-otro'}});

  // La vista previa mostrada es del evento anterior; confirmar apuntaría a otro evento.
  expect(screen.getByRole('button', {name: 'Confirmar importación'})).toBeDisabled();
  expect(fetchMock.mock.calls.some(([url]) => url.includes('nations-cup-otro'))).toBe(false);
});

test('HALLAZGO BAJO: una fila ya importada se muestra como "Nueva" (existingParticipantId ignorado)', async () => {
  installBackend({
    preview: () => jsonRes({
      rows: [{
        rowKey: 'row-1',
        name: 'Jugador de prueba',
        country: 'XX',
        existingParticipantId: '00000000-0000-4000-8000-000000000009',
        matchedParticipantId: null,
        errors: [],
      }],
      canConfirm: true,
      errors: [],
    }),
  });
  render(<AdminNationsActivation />);
  configureEvent();
  await screen.findByText(/Evento configurado/);
  await previewRows();

  expect(screen.getByText(/Existente/)).toBeInTheDocument();
});

test('HALLAZGO BAJO: un recibo de confirmación en vuelo se muestra después de cambiar las filas, sin lote', async () => {
  const confirmDeferred = deferred();
  installBackend({confirm: () => confirmDeferred.promise});
  render(<AdminNationsActivation />);
  configureEvent();
  await screen.findByText(/Evento configurado/);
  await previewRows();

  fireEvent.click(screen.getByRole('button', {name: 'Confirmar importación'}));
  fireEvent.change(screen.getByLabelText(/Filas/), {target: {value: 'Otro jugador, YY'}});

  await act(async () => {
    confirmDeferred.resolve(jsonRes({created: 1, idempotent: false}));
    await confirmDeferred.promise;
  });

  // El recibo aparece con "Lote:" vacío porque cambiarTexto limpió el lote.
  expect(screen.getByText(/Lote:/)).toHaveTextContent(/[0-9a-f]{8}-[0-9a-f]{4}-/);
});
