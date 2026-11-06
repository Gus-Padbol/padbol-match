/**
 * REVISIÓN INDEPENDIENTE — guard de sede de AdminNationsActivation (corrección nueva).
 * Pruebas marcadas HALLAZGO se espera que FALLEN. Mocks de red: NO es end-to-end.
 */
import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';

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

const PREVIEW_ROWS = [{
  rowKey: 'jugador-de-prueba|xx',
  name: 'Jugador de prueba',
  country: 'XX',
  matchedParticipantId: null,
  existingParticipantId: null,
  errors: [],
}];

function installBackend({sedeByTorneo = {}} = {}) {
  const fetchMock = jest.fn(async (url, options = {}) => {
    const method = options.method || 'GET';
    if (method === 'GET' && /\/api\/torneos\/\d+$/.test(url)) {
      const id = Number(url.split('/').pop());
      return jsonRes({id, nombre: 'Torneo de prueba', sede_id: sedeByTorneo[id] ?? null});
    }
    if (url.endsWith('/configure')) return jsonRes({event: {slug: 'nations-cup-prueba', torneoId: 1}});
    if (url.endsWith('/imports/preview')) return jsonRes({rows: PREVIEW_ROWS, canConfirm: true, errors: []});
    if (url.endsWith('/imports/confirm')) return jsonRes({created: 1, idempotent: false});
    return jsonRes({});
  });
  global.fetch = fetchMock;
  return fetchMock;
}

const callsTo = (fetchMock, suffix) => fetchMock.mock.calls.filter(([url]) => url.endsWith(suffix));

function configureEvent(torneoId = '1') {
  fireEvent.change(screen.getByLabelText(/Identificador del evento/), {target: {value: 'nations-cup-prueba'}});
  fireEvent.change(screen.getByLabelText(/Torneo \(id\)/), {target: {value: torneoId}});
  fireEvent.change(screen.getByLabelText(/Título interno/), {target: {value: 'Evento de prueba'}});
  fireEvent.click(screen.getByRole('button', {name: 'Configurar evento'}));
}

async function fillRows() {
  fireEvent.change(screen.getByLabelText(/Filas/), {target: {value: 'Jugador de prueba, XX'}});
}

afterEach(() => {
  delete global.fetch;
});

test('MEDIO-3 corregido: sin sede se permite preparar la vista previa, no confirmar', async () => {
  const fetchMock = installBackend({sedeByTorneo: {1: null}});
  render(<AdminNationsActivation />);
  configureEvent('1');
  await screen.findByText(/Evento configurado/);
  await fillRows();

  fireEvent.click(screen.getByRole('button', {name: 'Ver vista previa'}));
  expect(await screen.findByRole('table')).toBeInTheDocument();
  expect(callsTo(fetchMock, '/imports/preview')).toHaveLength(1);

  fireEvent.click(screen.getByRole('button', {name: 'Confirmar importación'}));
  expect(await screen.findByText(/no tiene sede asignada/i)).toBeInTheDocument();
  expect(callsTo(fetchMock, '/imports/confirm')).toHaveLength(0);
});

test('permite el preview cuando el torneo tiene sede', async () => {
  const fetchMock = installBackend({sedeByTorneo: {1: 7}});
  render(<AdminNationsActivation />);
  configureEvent('1');
  await screen.findByText(/Evento configurado/);
  await fillRows();

  fireEvent.click(screen.getByRole('button', {name: 'Ver vista previa'}));

  expect(await screen.findByRole('table')).toBeInTheDocument();
  expect(callsTo(fetchMock, '/imports/preview')).toHaveLength(1);
  // La vista previa no consulta la sede (es lectura); el guard corre al confirmar.
  expect(fetchMock.mock.calls.some(([url]) => url === 'https://api.test.invalid/api/torneos/1')).toBe(false);
  fireEvent.click(screen.getByRole('button', {name: 'Confirmar importación'}));
  await waitFor(() => expect(callsTo(fetchMock, '/imports/confirm')).toHaveLength(1));
  expect(fetchMock.mock.calls.some(([url]) => url === 'https://api.test.invalid/api/torneos/1')).toBe(true);
});

test('CORREGIDO: el torneo queda fijo tras configurar y el confirm se bloquea sin sede', async () => {
  // MEDIO-2: el input de torneo se deshabilita al configurar y el guard usa el torneo
  // del evento (respuesta del backend), no el valor del formulario.
  // MEDIO-3: la vista previa es de lectura y se permite sin sede; solo confirm exige sede.
  const fetchMock = installBackend({sedeByTorneo: {1: null, 2: 7}});
  render(<AdminNationsActivation />);
  configureEvent('1');
  await screen.findByText(/Evento configurado/);

  expect(screen.getByLabelText(/Torneo \(id\)/)).toBeDisabled();

  await fillRows();
  fireEvent.click(screen.getByRole('button', {name: 'Ver vista previa'}));
  expect(await screen.findByRole('table')).toBeInTheDocument();
  expect(callsTo(fetchMock, '/imports/preview')).toHaveLength(1);

  fireEvent.click(screen.getByRole('button', {name: 'Confirmar importación'}));
  expect(await screen.findByText(/no tiene sede asignada/i)).toBeInTheDocument();
  expect(callsTo(fetchMock, '/imports/confirm')).toHaveLength(0);
});

test('vuelve a verificar la sede antes de confirmar y bloquea si se perdió', async () => {
  const sedeByTorneo = {1: 7};
  const fetchMock = installBackend({sedeByTorneo});
  render(<AdminNationsActivation />);
  configureEvent('1');
  await screen.findByText(/Evento configurado/);
  await fillRows();
  fireEvent.click(screen.getByRole('button', {name: 'Ver vista previa'}));
  await screen.findByRole('table');

  sedeByTorneo[1] = null;
  fireEvent.click(screen.getByRole('button', {name: 'Confirmar importación'}));

  expect(await screen.findByText(/no tiene sede asignada/i)).toBeInTheDocument();
  expect(callsTo(fetchMock, '/imports/confirm')).toHaveLength(0);
});
