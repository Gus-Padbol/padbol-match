/**
 * REVISIÓN INDEPENDIENTE — guard de "sede pendiente" en TorneoCrear (patch Nations).
 * Mocks de red/hooks: no es end-to-end. Datos ficticios.
 */
import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import TorneoCrear from './TorneoCrear';
import {getAuthHeaders} from '../utils/scoreboardApi';
import {readPointsConfig} from '../utils/pointsConfigApi';

jest.mock('../utils/scoreboardApi', () => ({getAuthHeaders: jest.fn()}));
jest.mock('../utils/pointsConfigApi', () => ({
  ...jest.requireActual('../utils/pointsConfigApi'),
  readPointsConfig: jest.fn(),
}));
jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({session: {user: {email: 'qa@fixture.invalid'}, access_token: 'fixture-only'}}),
}));
jest.mock('../context/HubNavLayoutContext', () => ({useHubNavLayout: () => ({navDock: 'bottom'})}));
jest.mock('../hooks/useUserRole', () => ({
  __esModule: true,
  default: () => ({rol: 'admin_club', sedeId: null}),
}));
jest.mock('../components/AppHeader', () => () => null);
jest.mock('../components/BottomNav', () => () => null);
jest.mock('../components/SedeSearchInput', () => (props) => (
  <button type="button" onClick={() => props.onChangeId(7)}>Elegir sede QA</button>
));
jest.mock('../i18n/tSafe', () => {
  const es = require('../i18n/locales/es.json');
  const t = (key, args) => key.split('.').reduce((value, k) => value?.[k], es) || args?.defaultValue || key;
  return {useSafeTranslation: () => ({t, i18n: {language: 'es'}})};
});

const policy = {
  niveles: {club_oficial: 30, club_no_oficial: 10, nacional: 100, internacional: 300, mundial: 1000},
  posiciones: {1: 100, 2: 60, 3: 40},
  tipos_custom: [],
  niveles_labels: {},
  niveles_hidden: ['mundial'],
};

beforeEach(() => {
  jest.clearAllMocks();
  getAuthHeaders.mockResolvedValue({Authorization: 'Bearer sdk-current'});
  readPointsConfig.mockResolvedValue(policy);
  global.fetch = jest.fn().mockResolvedValue({ok: true, json: async () => []});
});

afterEach(() => {
  delete global.fetch;
});

async function completeDraft(container) {
  await waitFor(() => expect(container.querySelector('select[name="nivel_torneo"]')).not.toBeDisabled());
  for (const [name, value] of Object.entries({
    nombre: 'Torneo de prueba',
    fecha_inicio: '2026-11-22',
    fecha_fin: '2026-11-22',
  })) {
    fireEvent.change(container.querySelector(`input[name="${name}"]`), {target: {value}});
  }
}

function createBackend() {
  let submitted;
  const fetchMock = jest.fn(async (url, opts) => {
    if (opts?.method === 'POST') {
      submitted = JSON.parse(opts.body);
      return {ok: true, status: 200, json: async () => [{...submitted, id: 91}]};
    }
    if (url.endsWith('/api/torneos/91')) {
      return {ok: true, status: 200, json: async () => ({...submitted, id: 91})};
    }
    return {ok: true, status: 200, json: async () => []};
  });
  global.fetch = fetchMock;
  return {fetchMock, getSubmitted: () => submitted};
}

test('super_admin puede crear sin sede: sede_id null y es_multisede false', async () => {
  const onCreated = jest.fn();
  const {fetchMock, getSubmitted} = createBackend();
  const {container} = render(
    <MemoryRouter><TorneoCrear embedded rol="super_admin" onCreated={onCreated} /></MemoryRouter>,
  );
  await completeDraft(container);
  fireEvent.submit(container.querySelector('form'));

  await waitFor(() => expect(onCreated).toHaveBeenCalledWith(91));
  const submitted = getSubmitted();
  expect(submitted).toMatchObject({sede_id: null, es_multisede: false, estado: 'planificacion'});
  expect(fetchMock.mock.calls.some(([, opts]) => opts?.method === 'POST')).toBe(true);
});

test('admin_club sigue bloqueado sin sede: no hay POST ni alta', async () => {
  const onCreated = jest.fn();
  const {fetchMock} = createBackend();
  const {container} = render(
    <MemoryRouter><TorneoCrear embedded rol="admin_club" onCreated={onCreated} /></MemoryRouter>,
  );
  await completeDraft(container);
  fireEvent.submit(container.querySelector('form'));

  expect(await screen.findByRole('alert')).toBeInTheDocument();
  expect(fetchMock.mock.calls.some(([, opts]) => opts?.method === 'POST')).toBe(false);
  expect(onCreated).not.toHaveBeenCalled();
});

test('admin_nacional tampoco puede crear con sede pendiente', async () => {
  const onCreated = jest.fn();
  const {fetchMock} = createBackend();
  const {container} = render(
    <MemoryRouter><TorneoCrear embedded rol="admin_nacional" onCreated={onCreated} /></MemoryRouter>,
  );
  await completeDraft(container);
  fireEvent.submit(container.querySelector('form'));

  expect(await screen.findByRole('alert')).toBeInTheDocument();
  expect(fetchMock.mock.calls.some(([, opts]) => opts?.method === 'POST')).toBe(false);
  expect(onCreated).not.toHaveBeenCalled();
});

test('super_admin con sede elegida conserva la sede en el payload', async () => {
  const onCreated = jest.fn();
  const {getSubmitted} = createBackend();
  const {container} = render(
    <MemoryRouter><TorneoCrear embedded rol="super_admin" onCreated={onCreated} /></MemoryRouter>,
  );
  await completeDraft(container);
  fireEvent.click(screen.getByRole('button', {name: 'Elegir sede QA'}));
  fireEvent.submit(container.querySelector('form'));

  await waitFor(() => expect(onCreated).toHaveBeenCalledWith(91));
  expect(getSubmitted()).toMatchObject({sede_id: 7, es_multisede: false});
});
