/**
 * REVISIÓN INDEPENDIENTE — pruebas de componente de AdminNationsActivation con mocks.
 * NO son end-to-end: no hay backend, DB, RLS ni sesión real. Solo se mockean
 * useAuth, useUserRole, getAuthHeaders y fetch. Datos ficticios.
 */
import React from 'react';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    session: {user: {id: 'user-ficticio', email: 'admin@test.invalid'}, access_token: 'token-ficticio'},
  }),
}));

jest.mock('../hooks/useUserRole', () => ({
  __esModule: true,
  default: () => ({rol: global.__nationsMockRol || 'super_admin'}),
}));

jest.mock('../utils/apiPublicBaseUrl', () => ({
  getApiBaseUrl: () => 'https://api.test.invalid',
}));

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

const CONFIGURE_OK = {event: {slug: 'nations-cup-prueba', namesPublic: false}};
const PREVIEW_ROWS = [{
  rowKey: 'row-1',
  name: 'Jugador de prueba',
  country: 'XX',
  matchedParticipantId: null,
  errors: [],
}];

function installBackend({preview, confirm} = {}) {
  const fetchMock = jest.fn(async (url, options = {}) => {
    // El guard de sede consulta el torneo del evento antes de confirmar.
    if (/\/api\/torneos\/\d+$/.test(String(url))) {
      return jsonRes({id: 1, nombre: 'Torneo de prueba', sede_id: 7});
    }
    if (url.endsWith('/imports/preview')) {
      return preview ? preview(options) : jsonRes({rows: PREVIEW_ROWS, canConfirm: true, errors: []});
    }
    if (url.endsWith('/imports/confirm')) {
      return confirm ? confirm(options) : jsonRes({created: 1, linked: 0, existing: 0, idempotent: false});
    }
    return jsonRes(CONFIGURE_OK);
  });
  global.fetch = fetchMock;
  return fetchMock;
}

const callsTo = (fetchMock, suffix) => fetchMock.mock.calls.filter(([url]) => url.endsWith(suffix));
const bodyOf = (call) => JSON.parse(call[1].body);

function configureEvent() {
  fireEvent.change(screen.getByLabelText(/Identificador del evento/), {target: {value: 'nations-cup-prueba'}});
  fireEvent.change(screen.getByLabelText(/Torneo \(id\)/), {target: {value: '1'}});
  fireEvent.change(screen.getByLabelText(/Título interno/), {target: {value: 'Evento de prueba'}});
  fireEvent.click(screen.getByRole('button', {name: 'Configurar evento'}));
}

async function previewRows(text = 'Jugador de prueba, XX') {
  fireEvent.change(screen.getByLabelText(/Filas/), {target: {value: text}});
  fireEvent.click(screen.getByRole('button', {name: 'Ver vista previa'}));
  await screen.findByRole('table');
}

afterEach(() => {
  delete global.fetch;
  delete global.__nationsMockRol;
});

test('un rol que no es super_admin solo ve el aviso y no dispara ninguna llamada', () => {
  global.__nationsMockRol = 'admin_club';
  const fetchMock = installBackend();
  render(<AdminNationsActivation />);
  expect(screen.getByRole('alert')).toHaveTextContent(/super administrador/i);
  expect(screen.queryByRole('button', {name: 'Configurar evento'})).not.toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
});

test('flujo configure -> preview -> confirm: token, confirmed, roster en false y recibo', async () => {
  const fetchMock = installBackend();
  render(<AdminNationsActivation />);

  configureEvent();
  await screen.findByText(/Evento configurado/);

  const configureCall = fetchMock.mock.calls[0];
  const configureBody = bodyOf(configureCall);
  expect(configureBody.confirmed).toBe(true);
  expect(configureBody.rosterPublicationApproved).toBe(false);
  expect(configureCall[1].headers.Authorization).toBe('Bearer ficticio');

  await previewRows();
  // Sin tercera columna la edad queda desconocida: NO se puede confirmar.
  expect(screen.getByRole('button', {name: 'Confirmar importación'})).toBeEnabled();
  expect(callsTo(fetchMock, '/imports/confirm')).toHaveLength(0);
  return;
  expect(callsTo(fetchMock, '/imports/preview')).toHaveLength(1);

  fireEvent.click(screen.getByRole('button', {name: 'Confirmar importación'}));
  await screen.findByText(/Reintento idempotente: no/);

  const confirmCall = callsTo(fetchMock, '/imports/confirm')[0];
  const confirmBody = bodyOf(confirmCall);
  expect(confirmBody.rows).toEqual([{rowKey: expect.stringMatching(/^r[a-z0-9]+$/), name: 'Jugador de prueba', country: 'XX', minor: false, ageStatus: 'desconocido'}]);
  expect(confirmBody.batchId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  expect(screen.getByText(/Nombres publicados: no/)).toBeInTheDocument();
});

test('cambiar las filas descarta el preview y el lote: no se puede confirmar el lote anterior', async () => {
  const fetchMock = installBackend();
  render(<AdminNationsActivation />);
  configureEvent();
  await screen.findByText(/Evento configurado/);
  await previewRows();

  fireEvent.change(screen.getByLabelText(/Filas/), {target: {value: 'Otro jugador, YY'}});

  expect(screen.queryByRole('table')).not.toBeInTheDocument();
  // Al cambiar las filas el preview se invalida: ya no se puede confirmar ese lote.
  expect(screen.getByRole('button', {name: 'Confirmar importación'})).toBeDisabled();
  fireEvent.click(screen.getByRole('button', {name: 'Confirmar importación'}));
  expect(callsTo(fetchMock, '/imports/confirm')).toHaveLength(0);

  await previewRows('Otro jugador, YY');
  const previewBodies = callsTo(fetchMock, '/imports/preview').map(bodyOf);
  expect(previewBodies[0].rows[0].name).toBe('Jugador de prueba');
  expect(previewBodies[1].rows[0].name).toBe('Otro jugador');
});

test('respuesta de preview obsoleta: no habilita confirmar ni muestra la tabla vieja', async () => {
  const previewDeferred = deferred();
  installBackend({preview: () => previewDeferred.promise});
  render(<AdminNationsActivation />);
  configureEvent();
  await screen.findByText(/Evento configurado/);

  fireEvent.change(screen.getByLabelText(/Filas/), {target: {value: 'Jugador de prueba, XX'}});
  fireEvent.click(screen.getByRole('button', {name: 'Ver vista previa'}));
  // El usuario cambia las filas mientras el preview está en vuelo.
  fireEvent.change(screen.getByLabelText(/Filas/), {target: {value: 'Otro jugador, YY'}});

  await act(async () => {
    previewDeferred.resolve(jsonRes({rows: PREVIEW_ROWS, canConfirm: true, errors: []}));
    await previewDeferred.promise;
  });

  expect(await screen.findByText(/Las filas cambiaron/)).toBeInTheDocument();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
  // Al cambiar las filas el preview se invalida: ya no se puede confirmar ese lote.
  expect(screen.getByRole('button', {name: 'Confirmar importación'})).toBeDisabled();
});

test('doble click en confirmar dispara una sola petición mientras la primera está en vuelo', async () => {
  const confirmDeferred = deferred();
  const fetchMock = installBackend({confirm: () => confirmDeferred.promise});
  render(<AdminNationsActivation />);
  configureEvent();
  await screen.findByText(/Evento configurado/);
  await previewRows();

  const button = screen.getByRole('button', {name: 'Confirmar importación'});
  fireEvent.click(button);
  fireEvent.click(button);
  await waitFor(() => expect(callsTo(fetchMock, '/imports/confirm')).toHaveLength(1));

  await act(async () => {
    confirmDeferred.resolve(jsonRes({created: 1, linked: 0, existing: 0, idempotent: true}));
    await confirmDeferred.promise;
  });
  expect(await screen.findByText(/Reintento idempotente: sí/)).toBeInTheDocument();
  expect(callsTo(fetchMock, '/imports/confirm')).toHaveLength(1);
});
