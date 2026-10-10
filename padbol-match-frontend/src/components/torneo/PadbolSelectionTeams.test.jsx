import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import PadbolSelectionTeams from './PadbolSelectionTeams';
import { getAuthHeaders } from '../../utils/scoreboardApi';
jest.mock('../../utils/scoreboardApi', () => ({ getAuthHeaders: jest.fn() }));
jest.mock('../../i18n/tSafe', () => ({ useSafeTranslation: () => ({ i18n: { language: 'es' } }) }));
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const player = n => ({ user_id: id(n), id: id(n), nombre: `Jugador ${n}`, estado: 'confirmado' });
const torneo = { id: 9, deporte: 'padbol', modalidad_plantel: 'selecciones', estado: 'abierto' };
let dto, teams, failure;
const response = (body, status = 200) => Promise.resolve({ ok: status < 400, status, json: async () => body });
beforeEach(() => {
  getAuthHeaders.mockResolvedValue({ Authorization: 'Bearer synthetic-fixture', 'Content-Type': 'application/json' });
  dto = { ok: true, torneo_id: 9, equipo_id: 71, creador_id: id(1), jugadores: [1,2,3,4].map(player), solicitudes: [player(5)], cupo_maximo: 8, plantel_revision: 0, inscripcion_estado: 'pendiente', can_confirm: true, status: 'saved' };
  teams = [{ ...dto, id: 71, nombre: 'Equipo QA', equipo_abierto: true }]; failure = null;
  global.fetch = jest.fn((url, options = {}) => {
    const method = options.method || 'GET';
    if (failure && method !== 'GET') return response({ error: failure }, 409);
    if (url.endsWith('/selecciones') && method === 'GET') return response({ ok: true, torneo_id: 9, equipos: teams });
    if (url.endsWith('/plantel')) { const body = JSON.parse(options.body); dto = { ...dto, jugadores: body.user_ids.map(user_id => player(Number(user_id.slice(-12)))), plantel_revision: dto.plantel_revision + 1 }; return response(dto); }
    if (url.endsWith('/confirmar')) { dto = { ...dto, inscripcion_estado: 'confirmado', can_confirm: false }; return response(dto); }
    if (url.endsWith('/solicitudes')) return response(dto);
    if (url.endsWith('/selecciones') && method === 'POST') return response(dto);
    if (url.endsWith('/selecciones/71')) return response(dto);
    throw new Error(`Unexpected fixture request ${url}`);
  });
});
afterEach(() => delete global.fetch);
const props = { apiBaseUrl: 'https://fixture.invalid', torneo, userId: id(1), profileReady: true };
const mutations = () => fetch.mock.calls.filter(([, options]) => options.method && options.method !== 'GET');
test('four confirmed members are ready with capacity eight; captain accepts a real request and verifies reload', async () => {
  render(<PadbolSelectionTeams {...props} />);
  await screen.findByText(/Al menos cuatro jugadores confirmados/);
  fireEvent.click(screen.getByText('Gestionar plantel'));
  const form = await screen.findByRole('form', { name: 'Gestionar plantel registrado' });
  const request = await within(form).findByLabelText(/Jugador 5/);
  fireEvent.click(request); fireEvent.submit(form);
  await screen.findByText('Plantel guardado y verificado.');
  expect(JSON.parse(mutations()[0][1].body)).toEqual({ user_ids: [1,2,3,4,5].map(id), expected_revision: 0 });
  expect(dto.jugadores).toHaveLength(5);
  expect(within(form).getByLabelText(/Jugador 1/)).toBeDisabled();
});
test('unrelated authenticated viewer has no roster manager and cannot submit a roster update', async () => {
  render(<PadbolSelectionTeams {...props} userId={id(20)} />);
  await screen.findByText('Equipo QA');
  expect(screen.queryByText('Gestionar plantel')).not.toBeInTheDocument();
  expect(mutations()).toHaveLength(0);
});
test('revision error preserves chosen roster and does not display success', async () => {
  failure = 'El plantel cambió. Recarga la ficha.';
  render(<PadbolSelectionTeams {...props} />);
  fireEvent.click(await screen.findByText('Gestionar plantel'));
  const form = await screen.findByRole('form', { name: 'Gestionar plantel registrado' });
  const request = await within(form).findByLabelText(/Jugador 5/); fireEvent.click(request); fireEvent.submit(form);
  await screen.findByRole('alert');
  expect(request).toBeChecked(); expect(screen.queryByText('Plantel guardado y verificado.')).not.toBeInTheDocument();
});
test('unpersisted membership changes must be saved before confirming even when server previously allowed confirmation', async () => {
  render(<PadbolSelectionTeams {...props} />);
  fireEvent.click(await screen.findByText('Gestionar plantel'));
  const form = await screen.findByRole('form', { name: 'Gestionar plantel registrado' });
  fireEvent.click(await within(form).findByLabelText(/Jugador 5/));
  fireEvent.click(screen.getByText('Confirmar inscripción sin costo'));
  await screen.findByText('Guarda el plantel antes de confirmar la inscripción.'); expect(mutations()).toHaveLength(0);
});
test('free confirmation requires authoritative permission and reads confirmed state after POST', async () => {
  render(<PadbolSelectionTeams {...props} />);
  fireEvent.click(await screen.findByText('Gestionar plantel'));
  fireEvent.click(await screen.findByText('Confirmar inscripción sin costo'));
  await screen.findByText('Inscripción confirmada sin pago.');
  expect(JSON.parse(mutations()[0][1].body)).toEqual({ expected_revision: 0 });
  expect(mutations()[0][0]).toMatch(/\/confirmar$/);
});
test('paid/unknown costs represented by can_confirm false do not expose a free confirmation action', async () => {
  dto.can_confirm = false;
  render(<PadbolSelectionTeams {...props} />);
  fireEvent.click(await screen.findByText('Gestionar plantel'));
  await screen.findByText('La inscripción al torneo todavía no está confirmada.');
  expect(screen.queryByText('Confirmar inscripción sin costo')).not.toBeInTheDocument(); expect(mutations()).toHaveLength(0);
});
test('creation uses only tournament roster fields, never participant names or payment payloads', async () => {
  teams = [];
  render(<PadbolSelectionTeams {...props} />);
  const form = await screen.findByRole('form', { name: 'Crear equipo de selección' });
  fireEvent.change(within(form).getByLabelText('Nombre del equipo'), { target: { value: 'Selección QA' } });
  fireEvent.submit(form);
  await screen.findByText(/Equipo creado/);
  expect(JSON.parse(mutations()[0][1].body)).toEqual({ nombre: 'Selección QA', cupo_maximo: 8, equipo_abierto: true });
});
test('initial list failure is visible and cannot be mistaken for an empty list permitting creation', async () => {
  fetch.mockImplementation(() => response({ error: 'No se pudo leer la lista.' }, 503));
  render(<PadbolSelectionTeams {...props} />);
  await screen.findByRole('alert');
  expect(screen.queryByRole('form', { name: 'Crear equipo de selección' })).not.toBeInTheDocument();
  expect(screen.queryByText('Todavía no hay equipos registrados.')).not.toBeInTheDocument(); expect(mutations()).toHaveLength(0);
});
