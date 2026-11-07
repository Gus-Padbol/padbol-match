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

test('C-01: dos decisiones consecutivas sin recargar (busy se libera)', async () => {
  let queue = [
    {id: 'r1', declared_name: 'Jugador Ficticio Uno', declared_country: 'IT', age_status: 'adulto', status: 'pendiente'},
    {id: 'r2', declared_name: 'Jugador Ficticio Dos', declared_country: 'IT', age_status: 'adulto', status: 'pendiente', actor_user_id: 'acc-2', actor_email: 'dos@sintetico.invalid', actor_email_verified: true},
  ];
  mockFetch.mockImplementation(async (url, opts) => {
    if (String(url).endsWith('/access')) return ok({access: {canConfigure: true}});
    if (String(url).includes('/review')) { queue = queue.slice(1); return ok({ok: true}); }
    if (String(url).includes('/profile-requests')) return ok({requests: queue});
    return ok({participants: [{id: 'p1', name: 'Jugador Ficticio', country: 'IT', linked: false}]});
  });
  mount();
  await waitFor(() => expect(screen.getByRole('button', {name: /Jugador Ficticio Uno · IT/})).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', {name: /Jugador Ficticio Uno · IT/}));
  fireEvent.change(screen.getByLabelText(/Persona existente/), {target: {value: 'p1'}});
  fireEvent.change(screen.getByLabelText(/Evidencia/), {target: {value: 'Evidencia suficiente para la primera decision'}});
  fireEvent.click(screen.getByLabelText(/Verifiqué la identidad/));
  fireEvent.click(screen.getByRole('button', {name: 'Aprobar'}));
  await waitFor(() => expect(screen.getByRole('button', {name: /Jugador Ficticio Dos · IT/})).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', {name: /Jugador Ficticio Dos · IT/}));
  // Si busy no se libera, este boton queda disabled y la cola se traba.
  expect(screen.getByRole('button', {name: 'Aprobar'})).toBeEnabled();
  expect(screen.getByRole('button', {name: 'Rechazar'})).toBeEnabled();
});

test('C-03: 409 recarga la cola de verdad', async () => {
  let llamadasCola = 0;
  mockFetch.mockImplementation(async (url) => {
    if (String(url).endsWith('/access')) return ok({access: {canConfigure: true}});
    if (String(url).includes('/review')) return {ok: false, status: 409, json: async () => ({code: 'REQUEST_ALREADY_REVIEWED'})};
    if (String(url).includes('/profile-requests')) {
      llamadasCola += 1;
      return ok({requests: [{id: 'r1', declared_name: 'Jugador Ficticio', declared_country: 'IT', age_status: 'adulto', status: 'pendiente'}]});
    }
    return ok({participants: [{id: 'p1', name: 'Jugador Ficticio', country: 'IT', linked: false}]});
  });
  mount();
  await waitFor(() => expect(screen.getByRole('button', {name: /Jugador Ficticio · IT/})).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', {name: /Jugador Ficticio · IT/}));
  fireEvent.change(screen.getByLabelText(/Persona existente/), {target: {value: 'p1'}});
  fireEvent.change(screen.getByLabelText(/Evidencia/), {target: {value: 'Evidencia suficiente para el intento con conflicto'}});
  fireEvent.click(screen.getByLabelText(/Verifiqué la identidad/));
  fireEvent.click(screen.getByRole('button', {name: 'Aprobar'}));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/cambió de estado/));
  expect(llamadasCola).toBeGreaterThanOrEqual(2);
});

test('muestra la CUENTA solicitante (email verificado + id) para poder contrastar evidencia', async () => {
  routes({queue: ok({requests: [{id: 'r1', declared_name: 'Jugador Ficticio', declared_country: 'IT', age_status: 'adulto', status: 'pendiente', actor_user_id: 'acc-1', actor_email: 'uno@sintetico.invalid', actor_email_verified: true}]})});
  mount();
  await waitFor(() => expect(screen.getByRole('button', {name: /Jugador Ficticio · IT/})).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', {name: /Jugador Ficticio · IT/}));
  expect(screen.getByText(/uno@sintetico.invalid/)).toBeInTheDocument();
  expect(screen.getByText(/email verificado/)).toBeInTheDocument();
  expect(screen.getByText('acc-1')).toBeInTheDocument();
});
