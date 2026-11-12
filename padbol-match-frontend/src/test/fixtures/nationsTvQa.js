// Synthetic QA-only fixture. Never imported by production routes.
export const QA_NATIONS_BOARD_ID = '60ccb50a-7556-4920-9fd9-dd7ccb6244e9';
export const QA_NATIONS_VARIANT = 'qa';

const players = (names) => names.map((nombre, index) => ({
  nombre,
  role: index < 2 ? 'on_court' : 'bench',
  numero: index + 1,
  jersey: index + 1,
}));

export const QA_NATIONS_TV_FIXTURE = Object.freeze({
  variant: QA_NATIONS_VARIANT,
  mode: 'nations',
  id: QA_NATIONS_BOARD_ID,
  nations_lineup_status: 'current',
  nations_lineup_revision: 1,
  estado: 'en_curso',
  torneo_nombre: 'Nations Cup · Demo',
  cancha_nombre: 'Naples · Court 1',
  sede_nombre: '',
  equipo_a_nombre: 'Italy',
  equipo_b_nombre: 'Spain',
  equipo_a_jugadores: players(['Marco Rossi', 'Luca Bianchi', 'Paolo Conti', 'Andrea Ricci']),
  equipo_b_jugadores: players(['Carlos Martín', 'Javier López', 'Pablo García', 'Diego Ruiz']),
  display: {displayA: '40', displayB: '30'},
  games_a: 2, games_b: 1, sets_a: 1, sets_b: 0,
  historial_sets: [{a: 6, b: 4}], saque_actual: 'A',
  timerSeconds: 754,
});

export function isQaNationsTvFixture({variant, mode, scoreboardId} = {}) {
  return variant === QA_NATIONS_VARIANT
    && mode === 'nations'
    && scoreboardId === QA_NATIONS_BOARD_ID;
}

export function canChangeQaPair(team) {
  return Boolean(team && team.active?.length === 2 && team.bench?.length === 2);
}

export function changeQaPair(team) {
  if (!canChangeQaPair(team)) return null;
  return {
    ...team,
    active: team.active.map((player, index) => ({...player, role: 'bench', ...team.bench[index]})),
    bench: team.bench.map((player, index) => ({...player, role: 'on_court', ...team.active[index]})),
  };
}
