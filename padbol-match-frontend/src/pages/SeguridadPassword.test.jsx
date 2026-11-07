import React from 'react';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import SeguridadPassword from './SeguridadPassword';

const mockUpdateUser = jest.fn();
const mockUseAuth = jest.fn();
jest.mock('react-router-dom', () => ({...jest.requireActual('react-router-dom'), useNavigate: () => jest.fn()}));
jest.mock('../context/AuthContext', () => ({useAuth: () => mockUseAuth()}));
jest.mock('../supabaseClient', () => ({supabase: {auth: {
  getSession: jest.fn(async () => ({data: {session: {user: {id: 'u-1'}}}})),
  updateUser: (...a) => mockUpdateUser(...a),
}}}));

const mount = () => render(<MemoryRouter><SeguridadPassword /></MemoryRouter>);
beforeEach(() => { jest.clearAllMocks(); mockUseAuth.mockReturnValue({session: {user: {id: 'u-1'}}, loading: false}); });

test('usuario autenticado por OTP puede establecer su propia contraseña', async () => {
  mockUpdateUser.mockResolvedValue({error: null});
  const {supabase} = require('../supabaseClient');
  supabase.auth.getSession.mockResolvedValue({data: {session: {user: {id: 'u-1'}}}});
  mount();
  fireEvent.change(screen.getByLabelText(/Contraseña nueva/), {target: {value: 'password-larga'}});
  fireEvent.change(screen.getByLabelText(/Repetir contraseña/), {target: {value: 'password-larga'}});
  fireEvent.click(screen.getByRole('button', {name: 'Guardar contraseña'}));
  await waitFor(() => expect(mockUpdateUser).toHaveBeenCalledWith({password: 'password-larga'}));
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/quedó guardada/));
});

test('valida fortaleza y confirmación sin llamar a updateUser', async () => {
  mount();
  fireEvent.change(screen.getByLabelText(/Contraseña nueva/), {target: {value: 'corta'}});
  fireEvent.click(screen.getByRole('button', {name: 'Guardar contraseña'}));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/al menos 8/));
  fireEvent.change(screen.getByLabelText(/Contraseña nueva/), {target: {value: 'password-larga'}});
  fireEvent.change(screen.getByLabelText(/Repetir contraseña/), {target: {value: 'otra-cosa'}});
  fireEvent.click(screen.getByRole('button', {name: 'Guardar contraseña'}));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/no coinciden/));
  expect(mockUpdateUser).not.toHaveBeenCalled();
});

test('sin sesión no permite escribir y ofrece ingresar', () => {
  mockUseAuth.mockReturnValue({session: null, loading: false});
  mount();
  expect(screen.queryByRole('button', {name: 'Guardar contraseña'})).not.toBeInTheDocument();
  expect(screen.getByRole('link', {name: 'Ir a ingresar'})).toBeInTheDocument();
});

test('si la sesión cambió, no escribe y pide reintentar', async () => {
  const {supabase} = require('../supabaseClient');
  supabase.auth.getSession.mockResolvedValue({data: {session: {user: {id: 'otro'}}}});
  mount();
  fireEvent.change(screen.getByLabelText(/Contraseña nueva/), {target: {value: 'password-larga'}});
  fireEvent.change(screen.getByLabelText(/Repetir contraseña/), {target: {value: 'password-larga'}});
  fireEvent.click(screen.getByRole('button', {name: 'Guardar contraseña'}));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/sesión cambió/));
  expect(mockUpdateUser).not.toHaveBeenCalled();
});

test('error del proveedor no filtra detalles', async () => {
  mockUpdateUser.mockResolvedValue({error: {message: 'provider-private-detail'}});
  mount();
  fireEvent.change(screen.getByLabelText(/Contraseña nueva/), {target: {value: 'password-larga'}});
  fireEvent.change(screen.getByLabelText(/Repetir contraseña/), {target: {value: 'password-larga'}});
  fireEvent.click(screen.getByRole('button', {name: 'Guardar contraseña'}));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/Reintenta/));
  expect(document.body.textContent).not.toContain('provider-private-detail');
});
