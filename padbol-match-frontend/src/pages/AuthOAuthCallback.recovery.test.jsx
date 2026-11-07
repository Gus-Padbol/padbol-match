import React from 'react';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import AuthOAuthCallback from './AuthOAuthCallback';

const mockNavigate = jest.fn();
const mockUpdateUser = jest.fn();
let authListener = null;
jest.mock('react-router-dom', () => ({...jest.requireActual('react-router-dom'), useNavigate: () => mockNavigate}));
jest.mock('../context/AuthContext', () => ({useAuth: () => ({session: null, loading: false})}));
jest.mock('../supabaseClient', () => ({supabase: {auth: {
  getSession: jest.fn(async () => ({data: {session: null}})),
  updateUser: (...a) => mockUpdateUser(...a),
  onAuthStateChange: (cb) => { authListener = cb; return {data: {subscription: {unsubscribe: jest.fn()}}}; },
}}}));
jest.mock('../utils/legalDocuments', () => ({flushPendingOAuthLegalAcceptance: jest.fn(async () => false), hasPendingOAuthLegalAcceptance: jest.fn(() => false)}));
jest.mock('../utils/postLoginDestination', () => ({resolveRoleAwarePostLoginPath: jest.fn(async (d) => d)}));

const mount = () => render(<MemoryRouter><AuthOAuthCallback /></MemoryRouter>);

beforeEach(() => { jest.clearAllMocks(); authListener = null; });

test('un enlace con type=recovery muestra la pantalla de contraseña y NO navega al hub', () => {
  window.history.replaceState({}, '', '/auth/callback?redirect=%2Fcrm-leads#type=recovery&access_token=fake');
  mount();
  expect(screen.getByRole('heading', {name: 'Establecer una contraseña'})).toBeInTheDocument();
  expect(mockNavigate).not.toHaveBeenCalled();
});

test('PASSWORD_RECOVERY del cliente activa la pantalla aunque el hash ya se haya limpiado', () => {
  window.history.replaceState({}, '', '/auth/callback?redirect=%2Fcrm-leads');
  mount();
  expect(screen.queryByRole('heading', {name: 'Establecer una contraseña'})).not.toBeInTheDocument();
  authListener && authListener('PASSWORD_RECOVERY');
  return waitFor(() => expect(screen.getByRole('heading', {name: 'Establecer una contraseña'})).toBeInTheDocument());
});

test('valida largo y coincidencia antes de llamar a updateUser', async () => {
  window.history.replaceState({}, '', '/auth/callback#type=recovery');
  mount();
  fireEvent.change(screen.getByLabelText(/Contraseña nueva/), {target: {value: 'corta'}});
  fireEvent.click(screen.getByRole('button', {name: 'Guardar contraseña'}));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/al menos 8/));
  expect(mockUpdateUser).not.toHaveBeenCalled();

  fireEvent.change(screen.getByLabelText(/Contraseña nueva/), {target: {value: 'password-larga'}});
  fireEvent.change(screen.getByLabelText(/Repetir contraseña/), {target: {value: 'otra-distinta'}});
  fireEvent.click(screen.getByRole('button', {name: 'Guardar contraseña'}));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/no coinciden/));
  expect(mockUpdateUser).not.toHaveBeenCalled();
});

test('guarda con updateUser y confirma sin redirigir al hub', async () => {
  mockUpdateUser.mockResolvedValue({error: null});
  window.history.replaceState({}, '', '/auth/callback#type=recovery');
  mount();
  fireEvent.change(screen.getByLabelText(/Contraseña nueva/), {target: {value: 'password-larga'}});
  fireEvent.change(screen.getByLabelText(/Repetir contraseña/), {target: {value: 'password-larga'}});
  fireEvent.click(screen.getByRole('button', {name: 'Guardar contraseña'}));
  await waitFor(() => expect(mockUpdateUser).toHaveBeenCalledWith({password: 'password-larga'}));
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/quedó guardada/));
  expect(mockNavigate).not.toHaveBeenCalled();
});

test('error del servidor es recuperable y no filtra detalles', async () => {
  mockUpdateUser.mockResolvedValue({error: {message: 'provider-secret-detail', status: 400}});
  window.history.replaceState({}, '', '/auth/callback#type=recovery');
  mount();
  fireEvent.change(screen.getByLabelText(/Contraseña nueva/), {target: {value: 'password-larga'}});
  fireEvent.change(screen.getByLabelText(/Repetir contraseña/), {target: {value: 'password-larga'}});
  fireEvent.click(screen.getByRole('button', {name: 'Guardar contraseña'}));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/Pedí un enlace nuevo/));
  expect(document.body.textContent).not.toContain('provider-secret-detail');
});
