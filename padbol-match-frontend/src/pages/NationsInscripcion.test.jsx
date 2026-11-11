import React from 'react';
import fs from 'fs';
import path from 'path';
import {render, screen, fireEvent, waitFor, act} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import NationsInscripcion from './NationsInscripcion';

const mockUseAuth = jest.fn();
const mockFetch = jest.fn();
let mockLanguage = 'es';

jest.mock('../context/AuthContext', () => ({useAuth: () => mockUseAuth()}));
jest.mock('../i18n/tSafe', () => ({
  useSafeTranslation: () => ({i18n: {language: mockLanguage}, t: (k) => k}),
}));

const appTree = (slug = 'nations-cup-napoli-2026') => (
  <MemoryRouter initialEntries={[`/nations-cup/${slug}/inscripcion`]}>
    <Routes><Route path="/nations-cup/:slug/inscripcion" element={<NationsInscripcion />} /></Routes>
  </MemoryRouter>
);
const mount = (slug = 'nations-cup-napoli-2026') => render(appTree(slug));
const waitReady = async (buttonName = 'Submit registration') => {
  await waitFor(() => expect(screen.getByRole('button', {name: buttonName})).toBeEnabled());
};
const emptySelector = {ok: true, status: 200, json: async () => ({ok: true, participants: []})};
const emptyProfile = {ok: true, status: 200, json: async () => ({ok: true, requests: []})};
const fillNaples = () => {
  fireEvent.change(screen.getByLabelText('Full name'), {target: {value: 'Synthetic Player'}});
  fireEvent.change(screen.getByLabelText('Country'), {target: {value: 'IT'}});
  fireEvent.click(screen.getByLabelText('I confirm that I am 18 or older'));
  fireEvent.click(screen.getByLabelText(/I agree to the use of my name/));
};

beforeEach(() => {
  jest.clearAllMocks();
  mockLanguage = 'es';
  sessionStorage.clear();
  global.fetch = mockFetch;
  mockFetch.mockResolvedValue({ok: true, status: 200, json: async () => ({ok: true, requests: []})});
  mockUseAuth.mockReturnValue({session: {user: {id: 'actor-1', email_confirmed_at: '2026-01-01'}, access_token: 'tok'}, loading: false});
});

test('el slug exacto fuerza inglés, header y subtítulo exactos aunque el idioma global sea español', async () => {
  mount();
  await waitReady();
  expect(screen.getByRole('heading', {level: 1})).toHaveTextContent('Complete your details for the 5th Nations Cup');
  expect(screen.getByText('Naples · Mostra d’Oltremare · November 20–22, 2026')).toBeInTheDocument();
  expect(screen.getByText(/Choose your name, complete your player profile and register/)).toBeInTheDocument();
  expect(screen.getByLabelText('Full name')).toBeInTheDocument();
  expect(screen.getByLabelText('Country')).toBeInTheDocument();
  expect(screen.getByLabelText('I confirm that I am 18 or older')).toBeInTheDocument();
  expect(screen.getByLabelText(/I agree to the use of my name, country, age confirmation and account details/)).toBeInTheDocument();
  expect(screen.getByRole('button', {name: 'Submit registration'})).toBeInTheDocument();
  expect(screen.queryByLabelText(/Minor|Prefer not to say|responsible adult/)).not.toBeInTheDocument();
  expect(document.body.textContent).not.toMatch(/Completa tus datos|Menor de edad|Prefiero no informar/);
});

test('el slug exacto también es inglés si el idioma global es italiano', async () => {
  mockLanguage = 'it';
  mount();
  await waitReady();
  expect(screen.getByRole('heading', {level: 1})).toHaveTextContent('Complete your details for the 5th Nations Cup');
  expect(screen.getByRole('button', {name: 'Submit registration'})).toBeInTheDocument();
  expect(document.body.textContent).not.toMatch(/Completa i tuoi dati/);
});

test('sin sesión el acceso y el retorno son en inglés', () => {
  mockUseAuth.mockReturnValue({session: null, loading: false});
  mount();
  expect(screen.getByRole('heading', {level: 1})).toHaveTextContent('Complete your details for the 5th Nations Cup');
  expect(screen.getByText('Sign in with your verified account to continue.')).toBeInTheDocument();
  expect(screen.getByRole('link', {name: 'Sign in'})).toHaveAttribute('href', expect.stringContaining('/login?redirect='));
  expect(screen.getByRole('link', {name: 'Sign in'})).toHaveAttribute('href', expect.stringContaining('lang=en'));
});

test('un slug genérico conserva el login en su idioma y sin lang=en', () => {
  mockUseAuth.mockReturnValue({session: null, loading: false});
  mount('nations-cup-otro-2026');
  const link = screen.getByRole('link', {name: 'Ingresar'});
  expect(link).toHaveAttribute('href', expect.stringContaining('/login?redirect='));
  expect(link).not.toHaveAttribute('href', expect.stringContaining('lang=en'));
});

test('recorrido sintético sin cuenta -> login verificado -> solicitud pendiente', async () => {
  mockUseAuth.mockReturnValue({session: null, loading: false});
  const view = mount();
  expect(screen.getByRole('link', {name: 'Sign in'})).toHaveAttribute('href', expect.stringContaining('lang=en'));
  mockUseAuth.mockReturnValue({session: {user: {id: 'new-player', email_confirmed_at: '2026-01-01'}, access_token: 'tok'}, loading: false});
  view.rerender(appTree());
  await waitReady();
  fillNaples();
  fireEvent.click(screen.getByRole('button', {name: 'Submit registration'}));
  await waitFor(() => expect(screen.getByText(/Registration received/)).toBeInTheDocument());
  expect(screen.queryByText(/approved|activated/i)).not.toBeInTheDocument();
});

test('exige confirmar 18+ y consentimiento; no envía sin ambos', async () => {
  mount();
  await waitReady();
  fireEvent.change(screen.getByLabelText('Full name'), {target: {value: 'Synthetic Player'}});
  fireEvent.change(screen.getByLabelText('Country'), {target: {value: 'IT'}});
  fireEvent.click(screen.getByLabelText(/I agree to the use of my name/));
  fireEvent.click(screen.getByRole('button', {name: 'Submit registration'}));
  expect(screen.getByRole('alert')).toHaveTextContent(/18 or older/);
  expect(screen.getByRole('alert')).not.toHaveTextContent(/Complete your name, country and confirm/);
  expect(mockFetch.mock.calls.filter(([, opts]) => opts?.method === 'POST')).toHaveLength(0);

  fireEvent.click(screen.getByLabelText('I confirm that I am 18 or older'));
  fireEvent.click(screen.getByLabelText(/I agree to the use of my name/));
  fireEvent.click(screen.getByRole('button', {name: 'Submit registration'}));
  expect(screen.getByRole('alert')).toHaveTextContent(/consent to the use of your data/);
  expect(mockFetch.mock.calls.filter(([, opts]) => opts?.method === 'POST')).toHaveLength(0);
});

test('envía age_status adulto, booleanos seguros y muestra recibida con acceso al perfil sin prometer activación', async () => {
  mockFetch.mockImplementation(async (url, opts) => {
    if (String(url).includes('/selector')) return emptySelector;
    if (opts?.method === 'POST') return {ok: true, status: 200, json: async () => ({ok: true, status: 'pendiente'})};
    return emptyProfile;
  });
  mount();
  await waitReady();
  fillNaples();
  fireEvent.click(screen.getByRole('button', {name: 'Submit registration'}));
  await waitFor(() => expect(screen.getByText(/Registration received/)).toBeInTheDocument());
  const post = mockFetch.mock.calls.find(([, opts]) => opts?.method === 'POST');
  const payload = JSON.parse(post[1].body);
  expect(payload).toMatchObject({
    declared_name: 'Synthetic Player',
    declared_country: 'IT',
    age_status: 'adulto',
    guardian_consent: false,
    profile_consent: true,
  });
  expect(payload.request_id).toMatch(/^[A-Za-z0-9_-]{8,120}$/);
  expect(screen.getByText(/Your selection is saved/)).toBeInTheDocument();
  expect(screen.getByText(/does not activate your Nations participation/)).toBeInTheDocument();
  expect(screen.getByText(/Solicitud recibida\. Tu selección está guardada; no necesitas enviarla otra vez\./)).toBeInTheDocument();
  expect(screen.getByRole('link', {name: 'Go to my profile'})).toHaveAttribute('href', expect.stringContaining('/mi-perfil?redirect='));
  expect(document.body.textContent).not.toMatch(/reviews your registration before activation|Activation is not automatic|pending review by the organisation/i);
  expect(document.body.textContent).not.toMatch(/Nations participation is active|Nations participation activated/i);
  expect(document.body.textContent).not.toMatch(/activated automatically by name and country|match found/i);
});

test('selector de nombres envía id opaco, permite reportar duplicado y no expone cuenta', async () => {
  const selectionId = 'a'.repeat(32);
  const seen = [];
  mockFetch.mockImplementation(async (url, opts) => {
    seen.push(String(url));
    if (String(url).includes('/selector/report')) return {ok: true, status: 200, json: async () => ({ok: true, reported: true})};
    if (String(url).includes('/selector')) return {ok: true, status: 200, json: async () => ({ok: true, participants: [{selectionId, name: 'List Player', country: 'IT'}]})};
    if (opts?.method === 'POST') return {ok: true, status: 200, json: async () => ({ok: true, status: 'pendiente', selectionStatus: 'declarada'})};
    return emptyProfile;
  });
  mount();
  await waitReady();
  expect(screen.getByRole('heading', {name: 'Find your name on the list'})).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Filter by country'), {target: {value: 'IT'}});
  fireEvent.change(screen.getByLabelText('Select your name'), {target: {value: selectionId}});
  expect(screen.getByLabelText('Full name')).toHaveValue('List Player');
  fireEvent.click(screen.getByLabelText('I confirm that I am 18 or older'));
  fireEvent.click(screen.getByLabelText(/I agree to the use of my name/));
  fireEvent.click(screen.getByRole('button', {name: 'Report duplicate'}));
  await waitFor(() => expect(screen.getByText(/Report received/)).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', {name: 'Submit registration'}));
  await waitFor(() => expect(screen.getByText(/Registration received/)).toBeInTheDocument());
  const post = mockFetch.mock.calls.find(([url, opts]) => String(url).endsWith('/profile-request') && opts?.method === 'POST');
  const payload = JSON.parse(post[1].body);
  expect(payload.selection_id).toBe(selectionId);
  expect(payload.declared_name).toBe('List Player');
  expect(payload.declared_country).toBe('IT');
  expect(payload).not.toHaveProperty('participant_id');
  expect(payload).not.toHaveProperty('linked_user_id');
});

test('cambiar país o volver al placeholder limpia la selección y no envía el jugador anterior', async () => {
  const selectionId = 'b'.repeat(32);
  mockFetch.mockImplementation(async (url, opts) => {
    if (String(url).includes('/selector')) return {ok: true, status: 200, json: async () => ({ok: true, participants: [{selectionId, name: 'List Player', country: 'IT'}]})};
    return opts?.method === 'POST' ? emptyProfile : emptyProfile;
  });
  mount();
  await waitReady();
  fireEvent.change(screen.getByLabelText('Filter by country'), {target: {value: 'IT'}});
  fireEvent.change(screen.getByLabelText('Select your name'), {target: {value: selectionId}});
  expect(screen.getByLabelText('Full name')).toHaveValue('List Player');
  fireEvent.change(screen.getByLabelText('Filter by country'), {target: {value: 'RO'}});
  expect(screen.getByLabelText('Full name')).toHaveValue('');
  expect(screen.getByLabelText('Country')).toHaveValue('');
  expect(screen.queryByText(/Selected:/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByLabelText('I confirm that I am 18 or older'));
  fireEvent.click(screen.getByLabelText(/I agree to the use of my name/));
  fireEvent.click(screen.getByRole('button', {name: 'Submit registration'}));
  expect(screen.getByRole('alert')).toHaveTextContent(/Select your name from the list/);
  expect(mockFetch.mock.calls.filter(([, opts]) => opts?.method === 'POST')).toHaveLength(0);
});

test('reporte falla con error visible y permite reintentar; no marca recibido en el primer fallo', async () => {
  const selectionId = 'c'.repeat(32);
  let reportCalls = 0;
  mockFetch.mockImplementation(async (url, opts) => {
    if (String(url).includes('/selector/report')) {
      reportCalls += 1;
      return reportCalls === 1 ? {ok: false, status: 500, json: async () => ({})} : {ok: true, status: 200, json: async () => ({ok: true, reported: true})};
    }
    if (String(url).includes('/selector')) return {ok: true, status: 200, json: async () => ({ok: true, participants: [{selectionId, name: 'List Player', country: 'IT'}]})};
    return emptyProfile;
  });
  mount();
  await waitReady();
  fireEvent.change(screen.getByLabelText('Select your name'), {target: {value: selectionId}});
  fireEvent.click(screen.getByRole('button', {name: 'Report duplicate'}));
  await waitFor(() => expect(screen.getByText(/We could not send the report/)).toBeInTheDocument());
  expect(screen.queryByText(/Report received/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', {name: 'Retry report'}));
  await waitFor(() => expect(screen.getByText(/Report received/)).toBeInTheDocument());
  expect(reportCalls).toBe(2);
});

test('una respuesta vieja de reporte no marca recibido en la cuenta nueva', async () => {
  const selectionId = 'd'.repeat(32);
  let resolveReport;
  mockFetch.mockImplementation(async (url) => {
    if (String(url).includes('/selector/report')) return new Promise((resolve) => { resolveReport = resolve; });
    if (String(url).includes('/selector')) return {ok: true, status: 200, json: async () => ({ok: true, participants: [{selectionId, name: 'List Player', country: 'IT'}]})};
    return emptyProfile;
  });
  const view = mount();
  await waitReady();
  fireEvent.change(screen.getByLabelText('Select your name'), {target: {value: selectionId}});
  fireEvent.click(screen.getByRole('button', {name: 'Report duplicate'}));
  mockUseAuth.mockReturnValue({session: {user: {id: 'actor-2', email_confirmed_at: '2026-01-01'}, access_token: 'tok2'}, loading: false});
  view.rerender(appTree());
  await waitReady();
  await act(async () => {
    resolveReport({ok: true, status: 200, json: async () => ({ok: true, reported: true})});
    await Promise.resolve();
  });
  expect(screen.queryByText(/Report received/)).not.toBeInTheDocument();
});

test('muestra conflicto genérico tras submit y al restaurar sin revelar otro actor', async () => {
  mockFetch.mockImplementation(async (url, opts) => {
    if (String(url).includes('/selector')) return emptySelector;
    if (opts?.method === 'POST') return {ok: true, status: 200, json: async () => ({ok: true, status: 'pendiente', selectionStatus: 'en_conflicto'})};
    return emptyProfile;
  });
  const view = mount();
  await waitReady();
  fillNaples();
  fireEvent.click(screen.getByRole('button', {name: 'Submit registration'}));
  await waitFor(() => expect(screen.getByText(/more than one declaration/)).toBeInTheDocument());
  expect(screen.getByText(/no account or linked profile/)).toBeInTheDocument();
  expect(screen.getByRole('link', {name: 'Go to my profile'})).toHaveAttribute('href', expect.stringContaining('/mi-perfil?redirect='));
  view.unmount();

  mockFetch.mockResolvedValue({ok: true, status: 200, json: async () => ({ok: true, requests: [{status: 'pendiente', selection_status: 'en_conflicto'}]})});
  mount();
  await waitFor(() => expect(screen.getByText(/more than one declaration/)).toBeInTheDocument());
});

test('cambiar nombre con reporte pendiente resetea reporting y no marca la selección nueva', async () => {
  const selectionId = 'e'.repeat(32);
  let resolveReport;
  mockFetch.mockImplementation(async (url) => {
    if (String(url).includes('/selector/report')) return new Promise((resolve) => { resolveReport = resolve; });
    if (String(url).includes('/selector')) return {ok: true, status: 200, json: async () => ({ok: true, participants: [{selectionId, name: 'List Player', country: 'IT'}]})};
    return emptyProfile;
  });
  mount();
  await waitReady();
  fireEvent.change(screen.getByLabelText('Select your name'), {target: {value: selectionId}});
  expect(screen.getByLabelText('Full name')).toHaveAttribute('readonly');
  expect(screen.getByLabelText('Country')).toBeDisabled();
  fireEvent.click(screen.getByRole('button', {name: 'Report duplicate'}));
  fireEvent.change(screen.getByLabelText('Select your name'), {target: {value: ''}});
  fireEvent.change(screen.getByLabelText('Select your name'), {target: {value: selectionId}});
  expect(screen.getByRole('button', {name: 'Report duplicate'})).toBeEnabled();
  await act(async () => {
    resolveReport({ok: true, status: 200, json: async () => ({ok: true, reported: true})});
    await Promise.resolve();
  });
  expect(screen.queryByText(/Report received/)).not.toBeInTheDocument();
});

test('permite ver y seleccionar el nombre antes del login y lo restaura al volver', async () => {
  const selectionId = 'f'.repeat(32);
  mockUseAuth.mockReturnValue({session: null, loading: false});
  mockFetch.mockImplementation(async (url, opts) => {
    if (String(url).includes('/selector')) return {ok: true, status: 200, json: async () => ({ok: true, participants: [{selectionId, name: 'Pre Login Player', country: 'IT'}]})};
    if (opts?.method === 'POST') return {ok: true, status: 200, json: async () => ({ok: true, status: 'pendiente'})};
    return emptyProfile;
  });
  const view = mount();
  expect(await screen.findByRole('heading', {name: 'Find your name on the list'})).toBeInTheDocument();
  await waitFor(() => expect(screen.getByLabelText('Select your name')).toBeEnabled());
  fireEvent.change(screen.getByLabelText('Select your name'), {target: {value: selectionId}});
  expect(screen.getAllByText(/Pre Login Player/).length).toBeGreaterThan(0);
  expect(sessionStorage.getItem('nationsSelector:nations-cup-napoli-2026')).toContain(selectionId);
  expect(screen.getByRole('link', {name: 'Sign in'})).toHaveAttribute('href', expect.stringContaining('lang=en'));

  mockUseAuth.mockReturnValue({session: {user: {id: 'new-player', email_confirmed_at: '2026-01-01'}, access_token: 'tok'}, loading: false});
  view.rerender(appTree());
  await waitReady();
  expect(screen.getByLabelText('Full name')).toHaveValue('Pre Login Player');
  expect(screen.getByLabelText('Select your name')).toHaveValue(selectionId);
  fireEvent.click(screen.getByLabelText('I confirm that I am 18 or older'));
  fireEvent.click(screen.getByLabelText(/I agree to the use of my name/));
  fireEvent.click(screen.getByRole('button', {name: 'Submit registration'}));
  await waitFor(() => expect(screen.getByText(/Registration received/)).toBeInTheDocument());
  const post = mockFetch.mock.calls.find(([url, opts]) => String(url).endsWith('/profile-request') && opts?.method === 'POST');
  expect(JSON.parse(post[1].body).selection_id).toBe(selectionId);
});

test('selector autenticado persiste A→B y el vacío borra la selección al remontar', async () => {
  const a = '1'.repeat(32);
  const b = '2'.repeat(32);
  mockFetch.mockImplementation(async (url) => {
    if (String(url).includes('/selector')) return {ok: true, status: 200, json: async () => ({ok: true, participants: [{selectionId: a, name: 'Player A', country: 'IT'}, {selectionId: b, name: 'Player B', country: 'IT'}]})};
    return emptyProfile;
  });
  const view = mount();
  await waitReady();
  await waitFor(() => expect(screen.getByLabelText('Select your name')).toBeEnabled());
  fireEvent.change(screen.getByLabelText('Select your name'), {target: {value: a}});
  expect(sessionStorage.getItem('nationsSelector:nations-cup-napoli-2026')).toContain(a);
  fireEvent.change(screen.getByLabelText('Select your name'), {target: {value: b}});
  expect(sessionStorage.getItem('nationsSelector:nations-cup-napoli-2026')).toContain(b);
  view.unmount();

  const remounted = mount();
  await waitReady();
  await waitFor(() => expect(screen.getByLabelText('Select your name')).toHaveValue(b));
  expect(screen.getByLabelText('Full name')).toHaveValue('Player B');
  fireEvent.change(screen.getByLabelText('Select your name'), {target: {value: ''}});
  expect(sessionStorage.getItem('nationsSelector:nations-cup-napoli-2026')).toBeNull();
  remounted.unmount();

  mount();
  await waitReady();
  await waitFor(() => expect(screen.getByLabelText('Select your name')).toHaveValue(''));
  expect(screen.getByLabelText('Full name')).toHaveValue('');
});

test('selección guardada obsoleta se limpia con lista vacía y el fallback no envía selection_id', async () => {
  const stale = '9'.repeat(32);
  sessionStorage.setItem('nationsSelector:nations-cup-napoli-2026', JSON.stringify({selectionId: stale, name: 'Stale Player', country: 'IT'}));
  mockFetch.mockImplementation(async (url, opts) => {
    if (String(url).includes('/selector')) return {ok: true, status: 200, json: async () => ({ok: true, participants: []})};
    if (opts?.method === 'POST') return {ok: true, status: 200, json: async () => ({ok: true, status: 'pendiente'})};
    return emptyProfile;
  });
  const view = mount();
  await waitReady();
  await waitFor(() => expect(screen.getByLabelText('Select your name')).toHaveValue(''));
  expect(screen.getByLabelText('Full name')).toHaveValue('');
  expect(sessionStorage.getItem('nationsSelector:nations-cup-napoli-2026')).toBeNull();
  fireEvent.change(screen.getByLabelText('Full name'), {target: {value: 'Fallback Player'}});
  fireEvent.change(screen.getByLabelText('Country'), {target: {value: 'IT'}});
  fireEvent.click(screen.getByLabelText('I confirm that I am 18 or older'));
  fireEvent.click(screen.getByLabelText(/I agree to the use of my name/));
  fireEvent.click(screen.getByRole('button', {name: 'Submit registration'}));
  await waitFor(() => expect(screen.getByText(/Registration received/)).toBeInTheDocument());
  const post = mockFetch.mock.calls.find(([url, opts]) => String(url).endsWith('/profile-request') && opts?.method === 'POST');
  expect(JSON.parse(post[1].body)).not.toHaveProperty('selection_id');
  view.unmount();

  const valid = '8'.repeat(32);
  sessionStorage.setItem('nationsSelector:nations-cup-napoli-2026', JSON.stringify({selectionId: valid, name: 'Valid Player', country: 'IT'}));
  mockFetch.mockImplementation(async (url, opts) => {
    if (String(url).includes('/selector')) return {ok: true, status: 200, json: async () => ({ok: true, participants: [{selectionId: valid, name: 'Valid Player', country: 'IT'}]})};
    if (opts?.method === 'POST') return {ok: true, status: 200, json: async () => ({ok: true, status: 'pendiente'})};
    return emptyProfile;
  });
  mount();
  await waitReady();
  await waitFor(() => expect(screen.getByLabelText('Select your name')).toHaveValue(valid));
  expect(screen.getByLabelText('Full name')).toHaveValue('Valid Player');
  fireEvent.click(screen.getByLabelText('I confirm that I am 18 or older'));
  fireEvent.click(screen.getByLabelText(/I agree to the use of my name/));
  fireEvent.click(screen.getByRole('button', {name: 'Submit registration'}));
  await waitFor(() => expect(screen.getByText(/Registration received/)).toBeInTheDocument());
  const validPost = mockFetch.mock.calls.filter(([url, opts]) => String(url).endsWith('/profile-request') && opts?.method === 'POST').at(-1);
  expect(JSON.parse(validPost[1].body).selection_id).toBe(valid);
});

test('un refetch fallido tras lista válida limpia la selección y no envía id obsoleto', async () => {
  const selectionId = '7'.repeat(32);
  let selectorCalls = 0;
  mockFetch.mockImplementation(async (url, opts) => {
    if (String(url).includes('/selector') && !String(url).includes('/history')) {
      selectorCalls += 1;
      if (selectorCalls === 1) return {ok: true, status: 200, json: async () => ({ok: true, participants: [{selectionId, name: 'Player Loaded', country: 'IT'}]})};
      throw new Error('refetch failed');
    }
    if (opts?.method === 'POST') return {ok: true, status: 200, json: async () => ({ok: true, status: 'pendiente'})};
    return emptyProfile;
  });
  const view = mount();
  await waitReady();
  await waitFor(() => expect(screen.getByLabelText('Select your name')).toBeEnabled());
  fireEvent.change(screen.getByLabelText('Select your name'), {target: {value: selectionId}});
  expect(sessionStorage.getItem('nationsSelector:nations-cup-napoli-2026')).toContain(selectionId);
  mockUseAuth.mockReturnValue({session: {user: {id: 'actor-1', email_confirmed_at: '2026-01-01'}, access_token: 'tok-2'}, loading: false});
  view.rerender(appTree());
  await waitFor(() => expect(screen.getByText(/could not load the player list/i)).toBeInTheDocument());
  await waitFor(() => expect(screen.getByLabelText('Select your name')).toHaveValue(''));
  await waitFor(() => expect(screen.getByLabelText('Full name')).toHaveValue(''));
  expect(sessionStorage.getItem('nationsSelector:nations-cup-napoli-2026')).toBeNull();
  fireEvent.change(screen.getByLabelText('Full name'), {target: {value: 'Fallback After Error'}});
  fireEvent.change(screen.getByLabelText('Country'), {target: {value: 'IT'}});
  fireEvent.click(screen.getByLabelText('I confirm that I am 18 or older'));
  fireEvent.click(screen.getByLabelText(/I agree to the use of my name/));
  fireEvent.click(screen.getByRole('button', {name: 'Submit registration'}));
  await waitFor(() => expect(screen.getByText(/Registration received/)).toBeInTheDocument());
  const post = mockFetch.mock.calls.find(([url, opts]) => String(url).endsWith('/profile-request') && opts?.method === 'POST');
  expect(JSON.parse(post[1].body)).not.toHaveProperty('selection_id');
  expect(selectorCalls).toBe(2);
});

test('lista adulta vacía ofrece verificación individual sin activar ni convertir edad', async () => {
  mockFetch.mockImplementation(async (url, opts) => {
    if (String(url).includes('/selector')) return {ok: true, status: 200, json: async () => ({ok: true, participants: []})};
    if (opts?.method === 'POST') return {ok: true, status: 200, json: async () => ({ok: true, status: 'pendiente', selectionStatus: 'sin_seleccion'})};
    return emptyProfile;
  });
  mount();
  await waitReady();
  expect(screen.getByText(/individual age verification/)).toBeInTheDocument();
  expect(screen.getByText(/does not activate participation/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Full name'), {target: {value: 'Unknown Age Player'}});
  fireEvent.change(screen.getByLabelText('Country'), {target: {value: 'IT'}});
  fireEvent.click(screen.getByLabelText('I confirm that I am 18 or older'));
  fireEvent.click(screen.getByLabelText(/I agree to the use of my name/));
  fireEvent.click(screen.getByRole('button', {name: 'Submit registration'}));
  await waitFor(() => expect(screen.getByText(/Registration received/)).toBeInTheDocument());
  const post = mockFetch.mock.calls.find(([url, opts]) => String(url).endsWith('/profile-request') && opts?.method === 'POST');
  const payload = JSON.parse(post[1].body);
  expect(payload).not.toHaveProperty('selection_id');
  expect(payload.age_status).toBe('adulto');
});

test('recorrido completo 54/15: buscar, seleccionar desconocido, login, ficha y verificación pendiente', async () => {
  const countries = ['RO','ES','PT','QA','IT','DE','FR','BE','AT','EG','AE','MX','SE','UA','DK'];
  const participants = Array.from({length: 54}, (_, i) => {
    const n = String(i + 1).padStart(2, '0');
    return {selectionId: `${String(i + 101).padStart(32, '0')}`, name: `Player ${n}`, country: countries[i % countries.length]};
  });
  const chosen = participants[41];
  mockUseAuth.mockReturnValue({session: null, loading: false});
  mockFetch.mockImplementation(async (url, opts) => {
    if (String(url).includes('/selector')) return {ok: true, status: 200, json: async () => ({ok: true, participants})};
    if (opts?.method === 'POST') return {ok: true, status: 200, json: async () => ({ok: true, status: 'pendiente', selectionStatus: 'verificacion_pendiente'})};
    return emptyProfile;
  });
  const view = mount();
  await waitFor(() => expect(screen.getByLabelText('Search by name or country')).toBeInTheDocument());
  await waitFor(() => expect(screen.getByLabelText('Select your name').querySelectorAll('option')).toHaveLength(55));
  fireEvent.change(screen.getByLabelText('Search by name or country'), {target: {value: 'Player 42'}});
  expect(screen.getByLabelText('Select your name').querySelectorAll('option')).toHaveLength(2);
  fireEvent.change(screen.getByLabelText('Select your name'), {target: {value: chosen.selectionId}});
  expect(screen.getAllByText(/Player 42/).length).toBeGreaterThan(0);
  mockUseAuth.mockReturnValue({session: {user: {id: 'new-player', email_confirmed_at: '2026-01-01'}, access_token: 'tok'}, loading: false});
  view.rerender(appTree());
  await waitReady();
  expect(screen.getByLabelText('Full name')).toHaveValue('Player 42');
  fireEvent.click(screen.getByLabelText('I confirm that I am 18 or older'));
  fireEvent.click(screen.getByLabelText(/I agree to the use of my name/));
  fireEvent.click(screen.getByRole('button', {name: 'Submit registration'}));
  await waitFor(() => expect(screen.getByText(/Age verification is pending/)).toBeInTheDocument());
  expect(screen.getByText(/not active yet/)).toBeInTheDocument();
  expect(screen.queryByText(/participation is active/i)).not.toBeInTheDocument();
  const post = mockFetch.mock.calls.find(([url, opts]) => String(url).endsWith('/profile-request') && opts?.method === 'POST');
  const payload = JSON.parse(post[1].body);
  expect(payload.selection_id).toBe(chosen.selectionId);
  expect(payload.declared_name).toBe('Player 42');
  expect(payload.declared_country).toBe(chosen.country);
});

test('ficha incompleta bloquea la inscripción y ofrece completar perfil propio sin FIPA', async () => {
  mockFetch.mockImplementation(async (url, opts) => {
    if (String(url).includes('/selector')) return emptySelector;
    if (opts?.method === 'POST') return {ok: false, status: 409, json: async () => ({code: 'PLAYER_PROFILE_INCOMPLETE', missing: ['ciudad']})};
    return emptyProfile;
  });
  mount();
  await waitReady();
  fillNaples();
  fireEvent.click(screen.getByRole('button', {name: 'Submit registration'}));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/official player profile is incomplete/));
  const cta = screen.getByRole('link', {name: 'Complete player profile'});
  expect(cta).toHaveAttribute('href', expect.stringContaining('/mi-perfil?redirect='));
  expect(cta.getAttribute('href')).not.toContain('fipa');
  expect(screen.queryByText(/Registration received/)).not.toBeInTheDocument();
  expect(mockFetch.mock.calls.filter(([, opts]) => opts?.method === 'POST')).toHaveLength(1);
});

test('solicitud previa pendiente conserva receipt y muestra ficha incompleta editable sin duplicar', async () => {
  mockFetch.mockResolvedValue({ok: true, status: 200, json: async () => ({
    ok: true, requests: [{status: 'pendiente'}],
    profile_readiness: {complete: false, missing: ['ciudad', 'fecha_nacimiento']},
  })});
  const view = mount();
  await waitFor(() => expect(screen.getByText(/Registration received/)).toBeInTheDocument());
  expect(screen.getByText(/Your official player profile is incomplete/)).toBeInTheDocument();
  expect(screen.getByText(/City, Date of birth/)).toBeInTheDocument();
  const cta = screen.getByRole('link', {name: 'Complete player profile'});
  expect(cta).toHaveAttribute('href', expect.stringContaining('/mi-perfil?redirect='));
  expect(cta.getAttribute('href')).not.toContain('fipa');
  expect(screen.getByRole('link', {name: 'Go to my profile'})).toBeInTheDocument();
  expect(mockFetch.mock.calls.filter(([, opts]) => opts?.method === 'POST')).toHaveLength(0);
  view.unmount();

  mockFetch.mockResolvedValue({ok: true, status: 200, json: async () => ({
    ok: true, requests: [{status: 'pendiente'}],
    profile_readiness: {complete: true, missing: []},
  })});
  mount();
  await waitFor(() => expect(screen.getByText(/Registration received/)).toBeInTheDocument());
  expect(screen.queryByText(/Your official player profile is incomplete/)).not.toBeInTheDocument();
});

test('historial por convocado muestra exacto, cero y ambiguo sin IDs ni FIPA link', async () => {
  const id = 'a1'.repeat(16);
  let history = {ok: true, status: 'matched', puntos: 2180, posicion: 3};
  mockFetch.mockImplementation(async (url) => {
    if (String(url).includes('/history')) return {ok: true, status: 200, json: async () => history};
    if (String(url).includes('/selector')) return {ok: true, status: 200, json: async () => ({ok: true, participants: [{selectionId: id, name: 'History Player', country: 'IT'}]})};
    return emptyProfile;
  });
  mount();
  await waitReady();
  fireEvent.change(screen.getByLabelText('Select your name'), {target: {value: id}});
  await waitFor(() => expect(screen.getByText(/Official FIPA history: 2180 pts/)).toBeInTheDocument());
  expect(document.body.textContent).not.toMatch(/source_key|user_id|fipa\/reclamar/);
  history = {ok: true, status: 'zero', puntos: 0, posicion: null};
  fireEvent.change(screen.getByLabelText('Select your name'), {target: {value: ''}});
  fireEvent.change(screen.getByLabelText('Select your name'), {target: {value: id}});
  await waitFor(() => expect(screen.getByText(/No prior FIPA history: 0 points/)).toBeInTheDocument());
  history = {ok: true, status: 'ambiguous', puntos: null, posicion: null};
  fireEvent.change(screen.getByLabelText('Select your name'), {target: {value: ''}});
  fireEvent.change(screen.getByLabelText('Select your name'), {target: {value: id}});
  await waitFor(() => expect(screen.getByText(/will review this history/)).toBeInTheDocument());
});

test('el error ADULT_ONLY del backend se explica en inglés sin éxito falso', async () => {
  mockFetch.mockImplementation(async (url, opts) => {
    if (String(url).includes('/selector')) return emptySelector;
    if (opts?.method === 'POST') return {ok: false, status: 400, json: async () => ({code: 'ADULT_ONLY'})};
    return emptyProfile;
  });
  mount();
  await waitReady();
  fillNaples();
  fireEvent.click(screen.getByRole('button', {name: 'Submit registration'}));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/Only players aged 18 or older/));
  expect(screen.queryByText(/Registration received/)).not.toBeInTheDocument();
});

test('países de Nápoles en inglés: exactamente 15 + placeholder', async () => {
  mount();
  await waitReady();
  const options = Array.from(screen.getByLabelText('Country').querySelectorAll('option'));
  expect(options).toHaveLength(16);
  expect(options[0].value).toBe('');
  expect(options[0].textContent).toBe('Select your country');
  expect(options.slice(1).map((o) => o.value)).toEqual(['RO','ES','PT','QA','IT','DE','FR','BE','AT','EG','AE','MX','SE','UA','DK']);
  const labels = options.slice(1).map((o) => o.textContent).join(' ');
  expect(labels).toMatch(/Romania/);
  expect(labels).toMatch(/United Arab Emirates/);
  expect(labels).not.toMatch(/Rumania|Catar/);
});

test('otros slugs conservan el formulario, catálogo e idioma anteriores', async () => {
  mount('nations-cup-otro-2026');
  await waitReady('Enviar solicitud');
  expect(screen.getByRole('heading', {level: 1})).toHaveTextContent('Completa tus datos para la Nations Cup');
  expect(screen.getByLabelText('Nombre y apellido')).toBeInTheDocument();
  expect(screen.getByRole('group', {name: 'Edad'})).toBeInTheDocument();
  expect(screen.getByLabelText('Menor de edad')).toBeInTheDocument();
  expect(screen.getByLabelText(/Autorizo el uso de mis datos/)).toBeInTheDocument();
  const values = Array.from(screen.getByLabelText('País').querySelectorAll('option')).map((o) => o.value);
  expect(values).toContain('US');
  expect(values).toContain('AR');
  expect(values).not.toContain('QA');
});

test('estados pendiente, aprobada y rechazada en inglés', async () => {
  mockFetch.mockResolvedValue({ok: true, status: 200, json: async () => ({ok: true, requests: [{status: 'pendiente'}]})});
  const first = mount();
  await waitFor(() => expect(screen.getByText(/Registration received/)).toBeInTheDocument());
  first.unmount();
  sessionStorage.clear();

  mockFetch.mockResolvedValue({ok: true, status: 200, json: async () => ({ok: true, requests: [{status: 'aprobada'}]})});
  const second = mount();
  await waitFor(() => expect(screen.getByText(/Your request was approved/)).toBeInTheDocument());
  expect(screen.getByRole('link', {name: 'Go to my profile'})).toHaveAttribute('href', expect.stringContaining('/mi-perfil?redirect='));
  second.unmount();
  sessionStorage.clear();

  mockFetch.mockResolvedValue({ok: true, status: 200, json: async () => ({ok: true, requests: [{status: 'rechazada'}]})});
  mount();
  await waitFor(() => expect(screen.getByText(/request was not approved/)).toBeInTheDocument());
  expect(screen.getByRole('button', {name: 'Send a new request'})).toBeInTheDocument();
});

test('email no verificado y error de restauración en inglés', async () => {
  mockUseAuth.mockReturnValue({session: {user: {id: 'actor-3'}, access_token: 'tok3'}, loading: false});
  const first = mount();
  await waitFor(() => expect(mockFetch).toHaveBeenCalled());
  expect(screen.getByRole('alert')).toHaveTextContent(/Verify your email/);
  expect(screen.getByRole('button', {name: 'Submit registration'})).toBeDisabled();
  first.unmount();

  mockUseAuth.mockReturnValue({session: {user: {id: 'actor-4', email_confirmed_at: '2026-01-01'}, access_token: 'tok4'}, loading: false});
  mockFetch.mockImplementation(async (url) => {
    if (String(url).includes('/selector')) return emptySelector;
    throw new Error('network');
  });
  mount();
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/We could not check your request/));
});

test('doble click no duplica el envío y 409 se explica en inglés', async () => {
  mockFetch.mockImplementation(async (url, opts) => {
    if (String(url).includes('/selector')) return emptySelector;
    if (opts?.method === 'POST') return {ok: false, status: 409, json: async () => ({code: 'REQUEST_CONFLICT'})};
    return emptyProfile;
  });
  mount();
  await waitReady();
  fillNaples();
  const button = screen.getByRole('button', {name: 'Submit registration'});
  fireEvent.click(button); fireEvent.click(button);
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/already have an active request/));
  expect(mockFetch.mock.calls.filter(([, opts]) => opts?.method === 'POST')).toHaveLength(1);
});


test('cambiar de actor limpia la confirmación 18+ y no la hereda', async () => {
  const view = mount();
  await waitReady();
  fireEvent.click(screen.getByLabelText('I confirm that I am 18 or older'));
  expect(screen.getByLabelText('I confirm that I am 18 or older')).toBeChecked();
  mockUseAuth.mockReturnValue({session: {user: {id: 'actor-2', email_confirmed_at: '2026-01-01'}, access_token: 'tok2'}, loading: false});
  view.rerender(appTree());
  await waitReady();
  expect(screen.getByLabelText('I confirm that I am 18 or older')).not.toBeChecked();
});

test('estado de carga de auth se muestra en inglés y sin formulario', () => {
  mockUseAuth.mockReturnValue({session: null, loading: true});
  mount();
  expect(screen.getByRole('status')).toHaveTextContent('Restoring your request…');
  expect(document.querySelector('form')).toBeNull();
});

test('503 al restaurar avisa en inglés, reintenta sólo GET y puede recuperar pendiente', async () => {
  let profileGetCalls = 0;
  mockFetch.mockImplementation(async (url) => {
    if (String(url).includes('/selector')) return emptySelector;
    profileGetCalls += 1;
    if (profileGetCalls === 1) return {ok: false, status: 503, json: async () => ({})};
    return {ok: true, status: 200, json: async () => ({ok: true, requests: [{status: 'pendiente'}]})};
  });
  mount();
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/We could not check your request/));
  expect(screen.getByRole('button', {name: 'Try again'})).toBeEnabled();
  fireEvent.click(screen.getByRole('button', {name: 'Try again'}));
  await waitFor(() => expect(screen.getByText(/Registration received/)).toBeInTheDocument());
  expect(mockFetch.mock.calls.filter(([url, opts]) => !opts?.method && !String(url).includes('/selector'))).toHaveLength(2);
  expect(mockFetch.mock.calls.filter(([, opts]) => opts?.method === 'POST')).toHaveLength(0);
});

test('una respuesta vieja de restauración no pisa el cambio de actor', async () => {
  let resolveOld;
  let profileStarted = false;
  mockFetch.mockImplementation((url) => {
    if (String(url).includes('/selector')) return Promise.resolve(emptySelector);
    if (!profileStarted) {
      profileStarted = true;
      return new Promise((resolve) => { resolveOld = resolve; });
    }
    return Promise.resolve(emptyProfile);
  });
  const view = mount();
  await waitFor(() => expect(screen.getByText('Restoring your request…')).toBeInTheDocument());
  mockUseAuth.mockReturnValue({session: {user: {id: 'actor-2', email_confirmed_at: '2026-01-01'}, access_token: 'tok2'}, loading: false});
  view.rerender(appTree());
  await waitReady();
  await act(async () => {
    resolveOld({ok: true, status: 200, json: async () => ({ok: true, requests: [{status: 'rechazada'}]})});
    await Promise.resolve();
  });
  expect(screen.queryByText(/request was not approved/)).not.toBeInTheDocument();
  expect(screen.getByLabelText('I confirm that I am 18 or older')).not.toBeChecked();
});

test('rechazo permite nueva solicitud con request_id distinto y conserva el flujo inglés', async () => {
  mockFetch.mockImplementation(async (url, opts) => {
    if (opts?.method === 'POST') {
      const body = JSON.parse(opts.body);
      if (body.request_id === 'req-rechazado-01') return {ok: false, status: 409, json: async () => ({code: 'REQUEST_CONFLICT'})};
      return {ok: true, status: 200, json: async () => ({ok: true, status: 'pendiente'})};
    }
    return {ok: true, status: 200, json: async () => ({ok: true, requests: [{status: 'rechazada', request_id: 'req-rechazado-01'}]})};
  });
  sessionStorage.setItem('nationsProfileRequest:actor-1:nations-cup-napoli-2026', 'req-rechazado-01');
  mount();
  await waitFor(() => expect(screen.getByText(/request was not approved/)).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', {name: 'Send a new request'}));
  fillNaples();
  fireEvent.click(screen.getByRole('button', {name: 'Submit registration'}));
  await waitFor(() => expect(screen.getByText(/Registration received/)).toBeInTheDocument());
  const posts = mockFetch.mock.calls.filter(([, opts]) => opts?.method === 'POST').map(([, opts]) => JSON.parse(opts.body).request_id);
  expect(posts).toHaveLength(1);
  expect(posts[0]).not.toBe('req-rechazado-01');
  expect(sessionStorage.getItem('nationsProfileRequest:actor-1:nations-cup-napoli-2026')).toBe(posts[0]);
});

test('reintento tras error de red reutiliza el mismo request_id', async () => {
  const sent = [];
  mockFetch.mockImplementation(async (url, opts) => {
    if (opts?.method === 'POST') {
      sent.push(JSON.parse(opts.body).request_id);
      if (sent.length === 1) throw new Error('network');
      return {ok: true, status: 200, json: async () => ({ok: true, status: 'pendiente'})};
    }
    return {ok: true, status: 200, json: async () => ({ok: true, requests: []})};
  });
  mount();
  await waitReady();
  fillNaples();
  fireEvent.click(screen.getByRole('button', {name: 'Submit registration'}));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/We could not send the request/));
  fireEvent.click(screen.getByRole('button', {name: 'Submit registration'}));
  await waitFor(() => expect(screen.getByText(/Registration received/)).toBeInTheDocument());
  expect(sent).toHaveLength(2);
  expect(sent[0]).toBe(sent[1]);
});

test('tema oscuro conserva el contraste scoped del formulario', () => {
  const css = fs.readFileSync(path.join(__dirname, 'NationsInscripcion.css'), 'utf8');
  expect(css).toMatch(/html\.theme-dark \.nations-eyebrow[\s\S]*?#ff8d91/i);
  expect(css).toMatch(/html\.theme-dark \.nations-event-chip\s*\{[^}]*#ff8d91/i);
});
