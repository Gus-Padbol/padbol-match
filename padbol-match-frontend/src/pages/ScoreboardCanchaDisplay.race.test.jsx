import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import ScoreboardCanchaDisplay from './ScoreboardCanchaDisplay';
import { fetchPartido, fetchPartidoByCancha, fetchSponsors } from '../utils/scoreboardApi';

let socketUpdate;
jest.mock('react-router-dom', () => ({ useParams: () => ({ sedeId: '1', cancha: '2' }) }));
jest.mock('../i18n/tSafe', () => { const t = (v) => v; return { useSafeTranslation: () => ({ t }) }; });
jest.mock('../hooks/useScoreboardSocket', () => (_id, cb) => { socketUpdate = cb; return { connected: true, reconnect: jest.fn() }; });
jest.mock('../hooks/useServerCronometro', () => () => 0);
jest.mock('../utils/scoreboardApi', () => ({ fetchPartido: jest.fn(), fetchPartidoByCancha: jest.fn(), fetchSponsors: jest.fn() }));
jest.mock('../components/scoreboard/ScoreboardBoard', () => ({ partido }) => <div>{partido.equipo_a_nombre}</div>);

const match = (time, cancha = '2', estado = 'en_curso', name = 'Vigente') => ({ id: 'abc', sede_id: 1, cancha, estado, updated_at: time, equipo_a_nombre: name });
beforeEach(() => { jest.clearAllMocks(); fetchSponsors.mockResolvedValue([]); });

test('ignora eventos anteriores y libera la pantalla al suspender el partido', async () => {
  fetchPartidoByCancha.mockResolvedValue(match('2026-10-21T12:00:00.000001Z'));
  fetchPartido.mockResolvedValue(match('2026-10-21T12:00:00.000001Z'));
  render(<ScoreboardCanchaDisplay />);
  await screen.findByText('Vigente');
  await waitFor(() => expect(screen.queryByText('scoreboardDisplay.loading')).not.toBeInTheDocument());
  await act(async () => {});
  act(() => socketUpdate(match('2026-10-21T12:00:00.000002Z', '2', 'en_curso', 'Actualizado')));
  expect(screen.getByText('Actualizado')).toBeInTheDocument();
  act(() => socketUpdate(match('2026-10-21T12:00:00.000001Z', '2', 'en_curso', 'Atrasado')));
  expect(screen.queryByText('Atrasado')).not.toBeInTheDocument();
  act(() => socketUpdate(match('2026-10-21T12:00:00.000003Z', '2', 'suspendido')));
  expect(screen.getByText('scoreboardDisplay.waiting')).toBeInTheDocument();
  act(() => socketUpdate(match('2026-10-21T12:00:00.000002Z')));
  expect(screen.getByText('scoreboardDisplay.waiting')).toBeInTheDocument();
});

test('una respuesta anterior al cambio de cancha no revive el marcador suspendido', async () => {
  let resolveOld;
  fetchPartidoByCancha.mockResolvedValue(match('2026-10-21T12:00:00.000001Z'));
  fetchPartido.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }))
    .mockResolvedValue(match('2026-10-21T12:00:00.000002Z'));
  render(<ScoreboardCanchaDisplay />);
  await screen.findByText('Vigente');
  act(() => socketUpdate(match('2026-10-21T12:00:00.000003Z', '3', 'en_curso')));
  expect(screen.getByText('scoreboardDisplay.waiting')).toBeInTheDocument();
  await act(async () => resolveOld(match('2026-10-21T12:00:00.000001Z')));
  expect(screen.getByText('scoreboardDisplay.waiting')).toBeInTheDocument();
});
