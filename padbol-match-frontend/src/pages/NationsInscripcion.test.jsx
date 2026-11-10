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
  expect(screen.getByText(/received immediately/)).toBeInTheDocument();
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
  mockFetch
    .mockResolvedValueOnce({ok: true, status: 200, json: async () => ({ok: true, requests: []})})
    .mockResolvedValueOnce({ok: true, status: 200, json: async () => ({ok: true, status: 'pendiente'})});
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
  expect(screen.getByText(/Your Nations link is still pending/)).toBeInTheDocument();
  expect(screen.getByText(/does not activate your Nations participation/)).toBeInTheDocument();
  expect(screen.getByText(/reconcile your Nations points and historical record later/)).toBeInTheDocument();
  expect(screen.getByText(/use your Padbol Match profile normally/)).toBeInTheDocument();
  expect(screen.getByRole('link', {name: 'Go to my profile'})).toHaveAttribute('href', '/mi-perfil');
  expect(document.body.textContent).not.toMatch(/reviews your registration before activation|Activation is not automatic|pending review by the organisation/i);
  expect(document.body.textContent).not.toMatch(/Nations participation is active|Nations participation activated/i);
  expect(document.body.textContent).not.toMatch(/activated automatically by name and country|match found/i);
});

test('el error ADULT_ONLY del backend se explica en inglés sin éxito falso', async () => {
  mockFetch
    .mockResolvedValueOnce({ok: true, status: 200, json: async () => ({ok: true, requests: []})})
    .mockResolvedValueOnce({ok: false, status: 400, json: async () => ({code: 'ADULT_ONLY'})});
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
  expect(screen.getByRole('link', {name: 'Go to my profile'})).toHaveAttribute('href', '/mi-perfil');
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
  mockFetch.mockRejectedValueOnce(new Error('network'));
  mount();
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/We could not check your request/));
});

test('doble click no duplica el envío y 409 se explica en inglés', async () => {
  mockFetch
    .mockResolvedValueOnce({ok: true, status: 200, json: async () => ({ok: true, requests: []})})
    .mockResolvedValueOnce({ok: false, status: 409, json: async () => ({code: 'REQUEST_CONFLICT'})});
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
  mockFetch
    .mockResolvedValueOnce({ok: false, status: 503, json: async () => ({})})
    .mockResolvedValue({ok: true, status: 200, json: async () => ({ok: true, requests: [{status: 'pendiente'}]})});
  mount();
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/We could not check your request/));
  expect(screen.getByRole('button', {name: 'Try again'})).toBeEnabled();
  fireEvent.click(screen.getByRole('button', {name: 'Try again'}));
  await waitFor(() => expect(screen.getByText(/Registration received/)).toBeInTheDocument());
  expect(mockFetch.mock.calls.filter(([, opts]) => !opts?.method)).toHaveLength(2);
  expect(mockFetch.mock.calls.filter(([, opts]) => opts?.method === 'POST')).toHaveLength(0);
});

test('una respuesta vieja de restauración no pisa el cambio de actor', async () => {
  let resolveOld;
  mockFetch.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
  const view = mount();
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Restoring your request…'));
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
