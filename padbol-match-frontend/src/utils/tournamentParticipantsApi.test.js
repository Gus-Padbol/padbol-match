import { getAuthHeaders } from './scoreboardApi';
import { readTournamentParticipants, registerTournamentParticipants, tournamentParticipantRequest } from './tournamentParticipantsApi';
jest.mock('./scoreboardApi', () => ({ getAuthHeaders: jest.fn() }));
const catalog = { ok: true, torneo_id: 51, limits: { min_jugadores: 2, max_jugadores: 2 }, participants: [], teams: [] };
beforeEach(() => { jest.clearAllMocks(); getAuthHeaders.mockResolvedValue({ Authorization: 'Bearer current' }); global.fetch = jest.fn(); });
test('uses the current session and refuses a catalog for a different tournament', async () => {
  fetch.mockResolvedValue({ ok: true, json: async () => catalog });
  await readTournamentParticipants('https://api.example/', 51);
  expect(fetch.mock.calls[0][0]).toBe('https://api.example/api/torneos/51/participantes');
  expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer current');
  fetch.mockResolvedValue({ ok: true, json: async () => ({ ...catalog, torneo_id: 52 }) });
  await expect(readTournamentParticipants('', 51)).rejects.toThrow('catálogo');
});
test('anonymous requests never reach registration and malformed limits do not enable a form', async () => {
  getAuthHeaders.mockResolvedValue({});
  await expect(registerTournamentParticipants('', 51, {})).rejects.toMatchObject({ status: 401 });
  expect(fetch).not.toHaveBeenCalled();
  getAuthHeaders.mockResolvedValue({ Authorization: 'Bearer current' });
  fetch.mockResolvedValue({ ok: true, json: async () => ({ ...catalog, limits: { min_jugadores: 2, max_jugadores: 1 } }) });
  await expect(readTournamentParticipants('', 51)).rejects.toThrow('catálogo');
});
test('a creation must have a same-tournament receipt and confirmed status', async () => {
  fetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true, torneo_id: 52, status: 'created', equipo: { id: 8 } }) });
  await expect(registerTournamentParticipants('', 51, {})).rejects.toThrow('confirmada');
  fetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true, torneo_id: 51, status: 'pending' }) });
  await expect(registerTournamentParticipants('', 51, {})).rejects.toThrow('confirmada');
});
test('server denial is not replaced with a successful local state; patch uses its explicit method', async () => {
  fetch.mockResolvedValue({ ok: false, status: 403, json: async () => ({ error: 'No puedes vincular este perfil.', code: 'DENIED' }) });
  await expect(tournamentParticipantRequest('', 51, '/participantes/a', { nombre: 'QA' }, 'PATCH')).rejects.toMatchObject({ status: 403, code: 'DENIED' });
  expect(fetch.mock.calls[0][1].method).toBe('PATCH');
});
