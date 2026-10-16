import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import TournamentParticipantsPanel from './TournamentParticipantsPanel';
import { readTournamentParticipants, registerTournamentParticipants, tournamentParticipantRequest } from '../../utils/tournamentParticipantsApi';
jest.mock('../../i18n/tSafe', () => ({ useSafeTranslation: () => ({ i18n: { language: 'es' } }) }));
jest.mock('../../utils/tournamentParticipantsApi', () => ({ readTournamentParticipants: jest.fn(), registerTournamentParticipants: jest.fn(), tournamentParticipantRequest: jest.fn() }));
const catalog = { ok: true, torneo_id: 51, can_manage: false, can_register: true, current_actor: { user_id: 'captain', nombre: 'QA Capitán' }, limits: { min_jugadores: 2, max_jugadores: 2 }, participants: [], teams: [], link_requests: [] };
const team = { id: 99, nombre: 'QA Equipo', inscripcion_estado: 'confirmado', habilitacion_deportiva: { habilitado: false, minimos: 2, faltantes: 1 }, participants: [{ id: 'pending', tipo_identidad: 'plaza_pendiente', can_edit: true, ranking_oficial_elegible: false }] };
beforeEach(() => {
  jest.clearAllMocks(); Object.defineProperty(global, 'crypto', { configurable: true, value: { randomUUID: jest.fn(() => '11111111-1111-4111-8111-111111111111') } });
  readTournamentParticipants.mockResolvedValue(catalog);
  registerTournamentParticipants.mockResolvedValue({ ok: true, torneo_id: 51, status: 'created', equipo: team });
  tournamentParticipantRequest.mockResolvedValue({ ok: true });
});
const mount = (props = {}) => render(<TournamentParticipantsPanel apiBaseUrl="https://api.example" torneoId={51} authenticated {...props} />);
async function reviewCaptain() { await screen.findByLabelText('Nombre del equipo'); fireEvent.change(screen.getByLabelText('Nombre del equipo'), { target: { value: 'QA Equipo' } }); fireEvent.click(screen.getByRole('button', { name: 'Revisar inscripción' })); }
test('a captain registers with an unfilled teammate without an invitation or a fake account', async () => {
  const saved = jest.fn(); mount({ onSaved: saved }); await reviewCaptain();
  expect(registerTournamentParticipants).not.toHaveBeenCalled();
  readTournamentParticipants.mockResolvedValue({ ...catalog, teams: [team] });
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar y registrar equipo' }));
  await screen.findByText('Inscripción guardada y comprobada. Puedes completar el plantel después.');
  expect(registerTournamentParticipants).toHaveBeenCalledWith('https://api.example', 51, { nombre: 'QA Equipo', incluir_capitan: true, request_id: expect.any(String), participantes: [{ tipo_identidad: 'plaza_pendiente' }] });
  expect(saved).toHaveBeenCalledWith(99); expect(screen.getByText(/QA Equipo — Plantel por completar/)).toBeInTheDocument();
});
test('a club can register two named guests and does not insert itself as a player', async () => {
  readTournamentParticipants.mockResolvedValue({ ...catalog, can_manage: true }); mount(); await screen.findByLabelText('Nombre del equipo');
  fireEvent.change(screen.getByLabelText('Nombre del equipo'), { target: { value: 'QA Invitados' } });
  const names = screen.getAllByLabelText('Nombre para el torneo'); fireEvent.change(names[0], { target: { value: 'QA Uno' } }); fireEvent.change(names[1], { target: { value: 'QA Dos' } });
  fireEvent.click(screen.getByRole('button', { name: 'Revisar inscripción' }));
  readTournamentParticipants.mockResolvedValue({ ...catalog, can_manage: true, teams: [team] });
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar y registrar equipo' })); await waitFor(() => expect(registerTournamentParticipants).toHaveBeenCalled());
  expect(registerTournamentParticipants.mock.calls[0][2]).toMatchObject({ incluir_capitan: false, participantes: [{ tipo_identidad: 'generico', nombre: 'QA Uno' }, { tipo_identidad: 'generico', nombre: 'QA Dos' }] });
  expect(JSON.stringify(registerTournamentParticipants.mock.calls[0][2])).not.toMatch(/email|user_id/);
});
test('an accepted write whose reread fails is never announced as verified', async () => {
  const saved = jest.fn(); mount({ onSaved: saved }); await reviewCaptain(); readTournamentParticipants.mockRejectedValue(new Error('Sin conexión'));
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar y registrar equipo' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('falta comprobar'); expect(saved).not.toHaveBeenCalled();
  expect(screen.queryByText('Inscripción guardada y comprobada. Puedes completar el plantel después.')).not.toBeInTheDocument();
});
test('double click shares one submission and the same id is retained after an unconfirmed response', async () => {
  let finish; registerTournamentParticipants.mockImplementation(() => new Promise(resolve => { finish = resolve; })); mount(); await reviewCaptain();
  const button = screen.getByRole('button', { name: 'Confirmar y registrar equipo' }); fireEvent.click(button); fireEvent.click(button); expect(registerTournamentParticipants).toHaveBeenCalledTimes(1);
  readTournamentParticipants.mockResolvedValue({ ...catalog, teams: [team] }); await act(async () => finish({ equipo: team })); await screen.findByRole('status');
});
test('an old tournament response cannot replace the next tournament catalog', async () => {
  let finish; readTournamentParticipants.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValue({ ...catalog, torneo_id: 52, can_register: false });
  const { rerender } = mount(); rerender(<TournamentParticipantsPanel apiBaseUrl="https://api.example" torneoId={52} authenticated />);
  await screen.findByText('La inscripción está cerrada. Puedes consultar los equipos y sus estados.');
  await act(async () => finish({ ...catalog, teams: [team] })); expect(screen.queryByText(/QA Equipo —/)).not.toBeInTheDocument();
});
test('linking requests never select a target account or mark ranking accredited in the browser', async () => {
  const guest = { id: 'guest', nombre: 'QA Invitado', tipo_identidad: 'generico', estado_vinculacion: 'sin_cuenta', can_claim: true, ranking_oficial_elegible: false };
  readTournamentParticipants.mockResolvedValue({ ...catalog, can_register: false, teams: [{ ...team, participants: [guest] }] }); mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Solicitar vinculación a mi perfil' })); await waitFor(() => expect(tournamentParticipantRequest).toHaveBeenCalled());
  expect(tournamentParticipantRequest.mock.calls[0][2]).toBe('/participantes/guest/vinculacion'); expect(tournamentParticipantRequest.mock.calls[0][3]).toEqual({ request_id: expect.any(String) });
  expect(screen.getByText(/Sin acreditación para ranking oficial/)).toBeInTheDocument(); expect(screen.queryByText('Ranking oficial acreditado')).not.toBeInTheDocument();
});
test('logged out and forbidden catalogs do not invent administrative controls', async () => {
  const login = jest.fn(); const first = mount({ authenticated: false, onSignIn: login }); fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión para inscribir' })); expect(login).toHaveBeenCalled(); expect(readTournamentParticipants).not.toHaveBeenCalled(); first.unmount();
  readTournamentParticipants.mockRejectedValue(Object.assign(new Error('Sin permiso para este torneo'), { status: 403 })); mount(); await screen.findByRole('alert'); expect(screen.queryByLabelText('Nombre del equipo')).not.toBeInTheDocument();
});

test('a completed write from the old tournament cannot refresh or replace the next catalog', async () => {
  let finish; registerTournamentParticipants.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const { rerender } = mount(); await reviewCaptain(); fireEvent.click(screen.getByRole('button', { name: 'Confirmar y registrar equipo' }));
  readTournamentParticipants.mockResolvedValue({ ...catalog, torneo_id: 52, can_register: false });
  rerender(<TournamentParticipantsPanel apiBaseUrl="https://api.example" torneoId={52} authenticated />);
  await screen.findByText('La inscripción está cerrada. Puedes consultar los equipos y sus estados.');
  const count = readTournamentParticipants.mock.calls.length;
  await act(async () => finish({ equipo: team }));
  expect(readTournamentParticipants).toHaveBeenCalledTimes(count); expect(screen.queryByText(/QA Equipo —/)).not.toBeInTheDocument();
});
test('switching accounts clears administrative capabilities and reloads the catalog', async () => {
  readTournamentParticipants.mockResolvedValueOnce({ ...catalog, can_manage: true });
  const { rerender } = mount({ authIdentityKey: 'admin' }); await screen.findByText('Equipos y participantes');
  readTournamentParticipants.mockResolvedValue({ ...catalog, can_manage: false, can_register: false });
  rerender(<TournamentParticipantsPanel apiBaseUrl="https://api.example" torneoId={51} authenticated authIdentityKey="player" />);
  await screen.findByText('La inscripción está cerrada. Puedes consultar los equipos y sus estados.');
  expect(screen.queryByText('Equipos y participantes')).not.toBeInTheDocument();
});
