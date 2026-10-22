import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ScoreboardControl from './ScoreboardControl';
import { fetchPartido, scoreboardAction } from '../utils/scoreboardApi';

jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn(), useParams: () => ({ partidoId: 'match-1' }) }));
jest.mock('../i18n/tSafe', () => { const t = (_key, fallback) => fallback; return { useSafeTranslation: () => ({ t }) }; });
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ session: { user: { email: 'operator@example.test' }, access_token: 'test' } }) }));
jest.mock('../hooks/useUserRole', () => () => ({ rol: 'super_admin', loading: false }));
jest.mock('../hooks/useScoreboardSocket', () => () => ({}));
jest.mock('../hooks/useServerCronometro', () => () => 0);
jest.mock('../utils/scoreboardApi', () => ({ fetchPartido: jest.fn(), scoreboardAction: jest.fn() }));
const match = (running) => ({ id: 'match-1', sede_id: 1, estado: running ? 'en_curso' : 'pendiente', equipo_a_nombre: 'A', equipo_b_nombre: 'B', games_a: 0, games_b: 0, sets_a: 0, sets_b: 0, historial_puntos: [], cronometro_pausado: !running, display: { cronometroActivo: running } });

beforeEach(() => { jest.clearAllMocks(); });
test('does not allow points before starting or while paused', async () => {
  fetchPartido.mockResolvedValue(match(false));
  render(<ScoreboardControl />);
  const buttons = await screen.findAllByText('+ POINT');
  expect(buttons[0]).toBeDisabled();
  expect(buttons[1]).toBeDisabled();
});
test('does not duplicate an in-flight point and requires refresh after an uncertain failure', async () => {
  fetchPartido.mockResolvedValue(match(true));
  let reject;
  scoreboardAction.mockImplementation(() => new Promise((_, r) => { reject = r; }));
  render(<ScoreboardControl />);
  const button = (await screen.findAllByText('+ POINT'))[0];
  fireEvent.click(button); fireEvent.click(button);
  expect(scoreboardAction).toHaveBeenCalledTimes(1);
  reject(new Error('Sin conexión'));
  await screen.findByText(/No se pudo confirmar la operación/);
  expect(button).toBeDisabled();
  fireEvent.click(screen.getByText('Actualizar marcador'));
  await waitFor(() => expect(button).not.toBeDisabled());
  expect(fetchPartido).toHaveBeenCalledTimes(2);
});
