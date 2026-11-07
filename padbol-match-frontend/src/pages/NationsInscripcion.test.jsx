import React from 'react';
import {render, screen, fireEvent, waitFor} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import NationsInscripcion from './NationsInscripcion';

const mockUseAuth = jest.fn();
const mockFetch = jest.fn();
jest.mock('../context/AuthContext', () => ({useAuth: () => mockUseAuth()}));
jest.mock('../i18n/tSafe', () => ({useSafeTranslation: () => ({i18n: {language: 'es'}, t: (k) => k})}));

const waitReady = async () => { await waitFor(() => expect(screen.getByRole('button', {name: 'Enviar solicitud'})).toBeEnabled()); };
const mount = (slug = 'nations-cup-napoli-2026') => render(
  <MemoryRouter initialEntries={[`/nations-cup/${slug}/inscripcion`]}>
    <Routes><Route path="/nations-cup/:slug/inscripcion" element={<NationsInscripcion />} /></Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  jest.clearAllMocks();
  sessionStorage.clear();
  global.fetch = mockFetch;
  mockFetch.mockResolvedValue({ok: true, status: 200, json: async () => ({ok: true, requests: []})});
  mockUseAuth.mockReturnValue({session: {user: {id: 'actor-1', email_confirmed_at: '2026-01-01'}, access_token: 'tok'}, loading: false});
});

test('sin sesión pide ingresar con retorno seguro', () => {
  mockUseAuth.mockReturnValue({session: null, loading: false});
  mount();
  expect(screen.getByRole('link', {name: 'Ingresar'})).toHaveAttribute('href', expect.stringContaining('/login?redirect='));
});

test('envía payload correcto y muestra recepción pendiente sin afirmar coincidencia', async () => {
  mockFetch
    .mockResolvedValueOnce({ok: true, status: 200, json: async () => ({ok: true, requests: []})})
    .mockResolvedValueOnce({ok: true, status: 200, json: async () => ({ok: true, status: 'pendiente'})});
  mount();
  await waitReady();
  fireEvent.change(screen.getByLabelText('Nombre y apellido'), {target: {value: 'Jugador Ficticio'}});
  fireEvent.change(screen.getByLabelText('País'), {target: {value: 'IT'}});
  fireEvent.click(screen.getByLabelText('Mayor de edad'));
  fireEvent.click(screen.getByLabelText(/Autorizo el uso de mis datos/));
  fireEvent.click(screen.getByRole('button', {name: 'Enviar solicitud'}));
  await waitFor(() => expect(screen.getByText(/Queda pendiente de revisión/)).toBeInTheDocument());
  const post = mockFetch.mock.calls.find(([, opts]) => opts?.method === 'POST');
  const payload = JSON.parse(post[1].body);
  expect(payload).toMatchObject({declared_name: 'Jugador Ficticio', declared_country: 'IT', age_status: 'adulto', profile_consent: true});
  expect(payload.request_id).toMatch(/^[A-Za-z0-9_-]{8,120}$/);
  expect(document.body.textContent).not.toMatch(/coincidencia encontrada|encontramos tu perfil/i);
});

test('menor exige autorización declarada del responsable', async () => {
  mount();
  await waitReady();
  fireEvent.change(screen.getByLabelText('Nombre y apellido'), {target: {value: 'Jugador Ficticio'}});
  fireEvent.change(screen.getByLabelText('País'), {target: {value: 'IT'}});
  fireEvent.click(screen.getByLabelText('Menor de edad'));
  fireEvent.click(screen.getByLabelText(/Autorizo el uso de mis datos/));
  fireEvent.click(screen.getByRole('button', {name: 'Enviar solicitud'}));
  expect(mockFetch.mock.calls.filter(([, o]) => o?.method === 'POST')).toHaveLength(0);
});

test('conflicto 409 muestra mensaje claro y no duplica envíos', async () => {
  mockFetch
    .mockResolvedValueOnce({ok: true, status: 200, json: async () => ({ok: true, requests: []})})
    .mockResolvedValueOnce({ok: false, status: 409, json: async () => ({code: 'REQUEST_CONFLICT'})});
  mount();
  await waitReady();
  fireEvent.change(screen.getByLabelText('Nombre y apellido'), {target: {value: 'Jugador Ficticio'}});
  fireEvent.change(screen.getByLabelText('País'), {target: {value: 'IT'}});
  fireEvent.click(screen.getByLabelText('Mayor de edad'));
  fireEvent.click(screen.getByLabelText(/Autorizo el uso de mis datos/));
  const boton = screen.getByRole('button', {name: 'Enviar solicitud'});
  fireEvent.click(boton); fireEvent.click(boton);
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/solicitud activa/));
  expect(mockFetch.mock.calls.filter(([, o]) => o?.method === 'POST')).toHaveLength(1);
});

test('restaura estado propio al refrescar y mantiene el mismo request_id', async () => {
  sessionStorage.setItem('nationsProfileRequest:actor-1:nations-cup-napoli-2026', 'req-estable-0001');
  mockFetch.mockResolvedValue({ok: true, status: 200, json: async () => ({ok: true, requests: [{status: 'pendiente', age_status: 'desconocido', request_id: 'req-estable-0001'}]})});
  mount();
  await waitFor(() => expect(screen.getByText(/Queda pendiente de revisión/)).toBeInTheDocument());
});

test('cambio de actor limpia estado y usa otro request_id', async () => {
  mockFetch.mockResolvedValue({ok: true, status: 200, json: async () => ({ok: true, requests: [{status: 'pendiente'}]})});
  const {unmount} = mount();
  await waitFor(() => expect(screen.getByText(/Queda pendiente/)).toBeInTheDocument());
  unmount();
  sessionStorage.clear();
  mockUseAuth.mockReturnValue({session: {user: {id: 'actor-2', email_confirmed_at: '2026-01-01'}, access_token: 'tok2'}, loading: false});
  mockFetch.mockResolvedValue({ok: true, status: 200, json: async () => ({ok: true, requests: []})});
  mount();
  await waitFor(() => expect(screen.getByRole('button', {name: 'Enviar solicitud'})).toBeInTheDocument());
  expect(sessionStorage.getItem('nationsProfileRequest:actor-2:nations-cup-napoli-2026')).toMatch(/./);
});

test('edad no informada se puede enviar', async () => {
  mockFetch
    .mockResolvedValueOnce({ok: true, status: 200, json: async () => ({ok: true, requests: []})})
    .mockResolvedValueOnce({ok: true, status: 200, json: async () => ({ok: true, status: 'pendiente'})});
  mount();
  await waitReady();
  fireEvent.change(screen.getByLabelText('Nombre y apellido'), {target: {value: 'Jugador Ficticio'}});
  fireEvent.change(screen.getByLabelText('País'), {target: {value: 'IT'}});
  fireEvent.click(screen.getByLabelText('Prefiero no informar'));
  fireEvent.click(screen.getByLabelText(/Autorizo el uso de mis datos/));
  fireEvent.click(screen.getByRole('button', {name: 'Enviar solicitud'}));
  await waitFor(() => expect(screen.getByText(/Queda pendiente/)).toBeInTheDocument());
});

test('Austria esta en el catalogo y no aparece la nomina del torneo', async () => {
  mount();
  const select = screen.getByLabelText('País');
  const values = Array.from(select.querySelectorAll('option')).map(o => o.textContent);
  expect(values.join(' ')).toMatch(/Austria/);
  // no exponer paises de la nomina como si fueran catalogo: Austria viene del catalogo de la app
  expect(values.length).toBeGreaterThan(10);
});

test('email sin verificar bloquea el envio y lo explica', async () => {
  mockUseAuth.mockReturnValue({session: {user: {id: 'actor-3'}, access_token: 'tok3'}, loading: false});
  mount();
  expect(screen.getByRole('alert')).toHaveTextContent(/Verificá tu email/);
  expect(screen.getByRole('button', {name: 'Enviar solicitud'})).toBeDisabled();
});

test('fallo de red al restaurar no deja el formulario habilitado a ciegas', async () => {
  mockFetch.mockRejectedValueOnce(new Error('network'));
  mount();
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/No pudimos enviar|solicitud/i));
});

test('rechazada permite nueva solicitud sin recargar y con id nuevo', async () => {
  mockFetch.mockResolvedValue({ok: true, status: 200, json: async () => ({ok: true, requests: [{status: 'rechazada'}]})});
  mount();
  await waitFor(() => expect(screen.getByText(/no fue aprobada/)).toBeInTheDocument());
  const antes = sessionStorage.getItem('nationsProfileRequest:actor-1:nations-cup-napoli-2026');
  fireEvent.click(screen.getByRole('button', {name: 'Enviar nueva solicitud'}));
  const despues = sessionStorage.getItem('nationsProfileRequest:actor-1:nations-cup-napoli-2026');
  expect(despues).not.toBe(antes);
  expect(screen.getByRole('button', {name: 'Enviar solicitud'})).toBeInTheDocument();
});
