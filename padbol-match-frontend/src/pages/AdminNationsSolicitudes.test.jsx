import React from 'react';
import {render, screen, fireEvent, waitFor} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import AdminNationsSolicitudes from './AdminNationsSolicitudes';

const mockUseAuth = jest.fn();
const mockFetch = jest.fn();
jest.mock('../context/AuthContext', () => ({useAuth: () => mockUseAuth()}));

const mount = () => render(
  <MemoryRouter initialEntries={['/admin/nations-solicitudes/nations-cup-napoli-2026']}>
    <Routes><Route path="/admin/nations-solicitudes/:slug" element={<AdminNationsSolicitudes />} /></Routes>
  </MemoryRouter>,
);

const ok = (body) => ({ok: true, status: 200, json: async () => body});
const baseQueue = [{
  id: 'req-1', declared_name: 'Jugador Ficticio', declared_country: 'IT', age_status: 'adulto', status: 'pendiente',
}];

function routes({access = ok({access: {canConfigure: true}}), queue = ok({requests: baseQueue}),
  overview = ok({participants: [{id: 'p1', name: 'Jugador Ficticio', country: 'IT', linked: false}]}),
  review = ok({ok: true})} = {}) {
  mockFetch.mockImplementation(async (url) => {
    if (String(url).endsWith('/access')) return access;
    if (String(url).includes('/profile-requests/') && String(url).includes('/review')) return review;
    if (String(url).includes('/profile-requests')) return queue;
    return overview;
  });
}

beforeEach(() => {
  jest.clearAllMocks(); global.fetch = mockFetch;
  mockUseAuth.mockReturnValue({session: {user: {id: 'adm', email_confirmed_at: '2026-01-01'}, access_token: 'tok'}, loading: false});
  routes();
});

test('sin permiso muestra alerta y no lista solicitudes', async () => {
  routes({access: {ok: false, status: 403, json: async () => ({})}});
  mount();
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/Sin permiso/));
  expect(screen.queryByText(/Jugador Ficticio · IT/)).not.toBeInTheDocument();
});

test('lista la cola y exige evidencia de 20 caracteres para aprobar', async () => {
  mount();
  await waitFor(() => expect(screen.getByRole('button', {name: /Jugador Ficticio · IT/})).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', {name: /Jugador Ficticio · IT/}));
  fireEvent.click(screen.getByRole('button', {name: 'Aprobar'}));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/20 caracteres/));
  expect(mockFetch.mock.calls.filter(([, o]) => o?.method === 'POST')).toHaveLength(0);
});

test('edad desconocida no se puede aprobar aunque haya evidencia', async () => {
  routes({queue: ok({requests: [{...baseQueue[0], age_status: 'desconocido'}]})});
  mount();
  await waitFor(() => expect(screen.getByRole('button', {name: /Jugador Ficticio/})).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', {name: /Jugador Ficticio/}));
  fireEvent.change(screen.getByLabelText(/Evidencia/), {target: {value: 'Evidencia suficiente verificada en nomina'}});
  fireEvent.click(screen.getByLabelText(/Verifiqué la identidad/));
  fireEvent.click(screen.getByRole('button', {name: 'Aprobar'}));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/Edad desconocida/));
  expect(mockFetch.mock.calls.filter(([, o]) => o?.method === 'POST')).toHaveLength(0);
});

test('menor exige verificación central del responsable', async () => {
  routes({queue: ok({requests: [{...baseQueue[0], age_status: 'menor'}]})});
  mount();
  await waitFor(() => expect(screen.getByRole('button', {name: /Jugador Ficticio/})).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', {name: /Jugador Ficticio/}));
  fireEvent.change(screen.getByLabelText(/Evidencia/), {target: {value: 'Evidencia suficiente verificada en nomina'}});
  fireEvent.click(screen.getByLabelText(/Verifiqué la identidad/));
  fireEvent.click(screen.getByRole('button', {name: 'Aprobar'}));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/responsable/));
  expect(mockFetch.mock.calls.filter(([, o]) => o?.method === 'POST')).toHaveLength(0);
});

test('aprobación válida envía identity_verified, evidencia y persona elegida', async () => {
  mount();
  await waitFor(() => expect(screen.getByRole('button', {name: /Jugador Ficticio · IT/})).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', {name: /Jugador Ficticio · IT/}));
  fireEvent.change(screen.getByLabelText(/Persona existente/), {target: {value: 'p1'}});
  fireEvent.change(screen.getByLabelText(/Evidencia/), {target: {value: 'Evidencia suficiente verificada en nomina'}});
  fireEvent.click(screen.getByLabelText(/Verifiqué la identidad/));
  fireEvent.click(screen.getByRole('button', {name: 'Aprobar'}));
  await waitFor(() => {
    const post = mockFetch.mock.calls.find(([, o]) => o?.method === 'POST');
    expect(post).toBeTruthy();
    const payload = JSON.parse(post[1].body);
    expect(payload).toMatchObject({decision: 'aprobar', identity_verified: true, matched_participante_id: 'p1'});
    expect(payload.note.length).toBeGreaterThanOrEqual(20);
  });
});

test('409 muestra conflicto y permite recargar la cola', async () => {
  routes({review: {ok: false, status: 409, json: async () => ({code: 'REQUEST_ALREADY_REVIEWED'})}});
  mount();
  await waitFor(() => expect(screen.getByRole('button', {name: /Jugador Ficticio · IT/})).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', {name: /Jugador Ficticio · IT/}));
  fireEvent.change(screen.getByLabelText(/Persona existente/), {target: {value: 'p1'}});
  fireEvent.change(screen.getByLabelText(/Evidencia/), {target: {value: 'Evidencia suficiente verificada en nomina'}});
  fireEvent.click(screen.getByLabelText(/Verifiqué la identidad/));
  fireEvent.click(screen.getByRole('button', {name: 'Aprobar'}));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/cambió de estado/));
});

test('error de red al cargar es recuperable', async () => {
  mockFetch.mockRejectedValueOnce(new Error('network'));
  mount();
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/Error de red/));
});
