/**
 * REVISIÓN INDEPENDIENTE — DELTA de componente de AdminNationsActivation.
 * Pruebas marcadas HALLAZGO se espera que FALLEN. Mocks de red, no E2E.
 */
import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react';

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
  rowKey: 'r1a2b3c',
  name: 'Jugador de prueba',
  country: 'XX',
  minor: false,
  matchedParticipantId: null,
  existingParticipantId: null,
  errors: [],
}];

function installBackend({sedeByTorneo = {}, configureTorneoId = 1, getVenueStatus = 200, previewMinor = false} = {}) {
  const fetchMock = jest.fn(async (url, options = {}) => {
    if (/\/api\/torneos\/\d+$/.test(String(url))) {
      const id = Number(url.split('/').pop());
      if (getVenueStatus !== 200) return jsonRes({error: 'UNAVAILABLE'}, getVenueStatus);
      return jsonRes({id, nombre: 'Torneo de prueba', sede_id: sedeByTorneo[id] ?? null});
    }
    if (url.endsWith('/configure')) {
      return jsonRes({event: {slug: 'nations-cup-prueba', torneoId: configureTorneoId}});
    }
    if (url.endsWith('/imports/preview')) {
      return jsonRes({
        rows: [{...PREVIEW_ROWS[0], minor: previewMinor}],
        canConfirm: true,
        errors: [],
      });
    }
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

async function previewRows() {
  fireEvent.change(screen.getByLabelText(/Filas/), {target: {value: 'Jugador de prueba, XX'}});
  fireEvent.click(screen.getByRole('button', {name: 'Ver vista previa'}));
  await screen.findByRole('table');
}

afterEach(() => {
  delete global.fetch;
});

test('BAJO-3 corregido: al editar las filas después del preview aparece el aviso', async () => {
  installBackend({sedeByTorneo: {1: 7}});
  render(<AdminNationsActivation />);
  configureEvent('1');
  await screen.findByText(/Evento configurado/);
  await previewRows();

  fireEvent.change(screen.getByLabelText(/Filas/), {target: {value: 'Otro jugador, YY'}});

  expect(await screen.findByText(/Las filas cambiaron/i)).toBeInTheDocument();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});

test('MEDIO-5 corregido: la tabla muestra la columna Menor y el valor del backend', async () => {
  installBackend({sedeByTorneo: {1: 7}, previewMinor: true});
  render(<AdminNationsActivation />);
  configureEvent('1');
  await screen.findByText(/Evento configurado/);
  await previewRows();

  expect(screen.getByRole('columnheader', {name: 'Menor'})).toBeInTheDocument();
  expect(screen.getByText('Sí')).toBeInTheDocument();
});

test('MEDIO-2 corregido: el guard usa el torneo del evento, no el id del formulario', async () => {
  // El backend confirma que el evento quedó atado al torneo 9, aunque el formulario
  // tenía 1. El confirm debe consultar /api/torneos/9 (sede 7), no /1.
  const fetchMock = installBackend({sedeByTorneo: {1: null, 9: 7}, configureTorneoId: 9});
  render(<AdminNationsActivation />);
  configureEvent('1');
  await screen.findByText(/Evento configurado/);
  await previewRows();

  fireEvent.click(screen.getByRole('button', {name: 'Confirmar importación'}));

  expect(await screen.findByText(/Reintento idempotente: no/)).toBeInTheDocument();
  expect(fetchMock.mock.calls.some(([url]) => url === 'https://api.test.invalid/api/torneos/9')).toBe(true);
  expect(fetchMock.mock.calls.some(([url]) => url === 'https://api.test.invalid/api/torneos/1')).toBe(false);
  expect(callsTo(fetchMock, '/imports/confirm')).toHaveLength(1);
});

test('Guard fail-closed: si el GET del torneo falla, no se confirma', async () => {
  installBackend({sedeByTorneo: {1: 7}, getVenueStatus: 500});
  render(<AdminNationsActivation />);
  configureEvent('1');
  await screen.findByText(/Evento configurado/);
  await previewRows();

  fireEvent.click(screen.getByRole('button', {name: 'Confirmar importación'}));

  expect(await screen.findByText(/No se pudo comprobar la sede/i)).toBeInTheDocument();
  expect(callsTo(global.fetch, '/imports/confirm')).toHaveLength(0);
});
