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
test('pending suspension from a previous session blocks scoring', async () => {
  const key='padbol:scoreboard:suspension-uncertain:match-1:action:12345678-1234-4234-8234-123456789abc';
  localStorage.setItem(key,JSON.stringify({action:'suspend',body:{action_id:'12345678-1234-4234-8234-123456789abc',updated_at:'2026-10-21T12:00:00Z',reason:'Lluvia'}}));
  fetchPartido.mockResolvedValue({...match(true),updated_at:'2026-10-21T12:00:00Z',scoreboard_suspension_candidate_enabled:true});
  render(<ScoreboardControl/>);
  expect((await screen.findAllByText('+ POINT'))[0]).toBeDisabled();
  expect(screen.getByText(/sin confirmar/)).toBeInTheDocument();
  fireEvent.click(screen.getAllByText('+ POINT')[0]);
  expect(scoreboardAction).not.toHaveBeenCalled();
  localStorage.removeItem(key);
});

test('recovery remains visible with capability disabled or finished match', async () => {
 const key='padbol:scoreboard:suspension-uncertain:match-1:action:12345678-1234-4234-8234-123456789abc';
 localStorage.setItem(key,JSON.stringify({action:'suspend',body:{action_id:'12345678-1234-4234-8234-123456789abc',updated_at:'2026-10-21T12:00:00Z',reason:'Lluvia'}}));
 fetchPartido.mockResolvedValue({...match(true),estado:'terminado',updated_at:'2026-10-21T12:00:00Z',scoreboard_suspension_candidate_enabled:false});
 render(<ScoreboardControl/>);
 expect(await screen.findByRole('button',{name:'Verificar y cancelar si sigue pendiente'})).not.toBeDisabled();
 expect(screen.getByRole('button',{name:'Recuperar operación'})).toBeDisabled();
 localStorage.removeItem(key);
});

test('a reference created in another tab blocks scoring even when capability is off',async()=>{
 fetchPartido.mockResolvedValue({...match(true),updated_at:'2026-10-21T12:00:00Z',scoreboard_suspension_candidate_enabled:false});
 render(<ScoreboardControl/>);const point=(await screen.findAllByText('+ POINT'))[0];expect(point).not.toBeDisabled();
 const key='padbol:scoreboard:suspension-uncertain:match-1:action:12345678-1234-4234-8234-123456789abc';
 const value=JSON.stringify({action:'suspend',body:{action_id:'12345678-1234-4234-8234-123456789abc',updated_at:'2026-10-21T12:00:00Z',reason:'Lluvia'}});
 localStorage.setItem(key,value);fireEvent(window,new StorageEvent('storage',{key,newValue:value,storageArea:localStorage}));
 expect(await screen.findByRole('button',{name:'Verificar y cancelar si sigue pendiente'})).not.toBeDisabled();expect(point).toBeDisabled();
 localStorage.removeItem(key);
});
