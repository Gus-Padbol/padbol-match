import React from 'react';
import {render, screen, fireEvent, waitFor} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import AdminNationsMarkerDurable from './AdminNationsMarkerDurable';

let mockRole = 'super_admin';
jest.mock('../context/AuthContext', () => ({useAuth: () => ({session: {access_token: 'jwt-token', user: {id: 'u1', email: 'u@example.invalid'}}, loading: false})}));
jest.mock('../hooks/useUserRole', () => ({__esModule: true, default: () => ({rol: mockRole, loading: false})}));
jest.mock('../utils/apiPublicBaseUrl', () => ({getApiBaseUrl: () => 'https://qa.example.invalid'}));

const context = {canStart: true, teamIds: ['team-a'], teams: {'team-a': {lineup: {iniciales: ['p1'], suplentes: ['p2']}}}};
function mount() {
  return render(<MemoryRouter initialEntries={['/admin/nations-marker/sb-1']}><Routes><Route path="/admin/nations-marker/:scoreboardId" element={<AdminNationsMarkerDurable />} /></Routes></MemoryRouter>);
}
beforeEach(() => {
  mockRole = 'super_admin';
  global.fetch = jest.fn(async (url, opts) => {
    if (String(url).endsWith('/context')) return {ok: true, json: async () => context};
    return {ok: true, json: async () => ({ok: true, revision: 1})};
  });
});
test('staff ve contexto y start sin actor ni token en body', async () => {
  mount();
  await waitFor(() => expect(screen.getByText(/Marcador durable Nations/)).toBeInTheDocument());
  await waitFor(() => expect(screen.getByRole('button', {name: 'Iniciar marcador durable'})).toBeEnabled());
  fireEvent.click(screen.getByRole('button', {name: 'Iniciar marcador durable'}));
  await waitFor(() => expect(global.fetch.mock.calls.some(([, o]) => o?.method === 'POST')).toBe(true));
  const post = global.fetch.mock.calls.find(([url, o]) => String(url).endsWith('/start') && o?.method === 'POST');
  const body = JSON.parse(post[1].body);
  expect(body).toHaveProperty('idempotencyKey');
  expect(body).toHaveProperty('payload');
  expect(body).not.toHaveProperty('actor');
  expect(post[1].headers.Authorization).toBe('Bearer jwt-token');
});

test('rol no staff queda bloqueado', async () => {
  mockRole = 'jugador';
  mount();
  expect(screen.getByRole('alert')).toHaveTextContent('Sin permiso para operar el marcador durable.');
});

test('substitución exige equipo/sale/entra y envía el contrato', async () => {
  mount();
  await waitFor(() => expect(screen.getByText(/Marcador durable Nations/)).toBeInTheDocument());
  fireEvent.change(screen.getByLabelText('Equipo'), {target: {value: 'team-a'}});
  fireEvent.change(screen.getByLabelText('Sale'), {target: {value: 'p1'}});
  fireEvent.change(screen.getByLabelText('Entra'), {target: {value: 'p2'}});
  fireEvent.click(screen.getByRole('button', {name: 'Registrar cambio'}));
  await waitFor(() => expect(global.fetch.mock.calls.some(([url]) => String(url).includes('/team/team-a/commands'))).toBe(true));
  const post = global.fetch.mock.calls.find(([url]) => String(url).includes('/team/team-a/commands'));
  const body = JSON.parse(post[1].body);
  expect(body).toMatchObject({type: 'substitution', outId: 'p1', inId: 'p2', expectedRevision: 0});
  expect(body).toHaveProperty('eventId');
  expect(body).toHaveProperty('idempotencyKey');
});
