import {scoreboardPlayerName, listVisibleScoreboardJugadores} from './scoreboardPlayers';

/** Role assignments come only from the server's public, sanitized match projection. */
export function nationsTvLineup(partido) {
  const isNations = ['current', 'unavailable'].includes(partido?.nations_lineup_status);
  const teams = ['equipo_a_jugadores', 'equipo_b_jugadores'].map(key => listVisibleScoreboardJugadores(partido?.[key], 4));
  const valid = partido?.nations_lineup_status === 'current' && teams.every(players =>
    players.length === 4 && players.every(p => scoreboardPlayerName(p) && ['on_court', 'bench'].includes(p.role))
    && players.filter(p => p.role === 'on_court').length === 2
    && players.filter(p => p.role === 'bench').length === 2);
  return {isNations, current: valid, teams: teams.map(players => ({
    roster: players,
    active: valid ? players.filter(p => p.role === 'on_court') : [],
    bench: valid ? players.filter(p => p.role === 'bench') : [],
  }))};
}

export function scoreboardPublicPollInterval(partido, connected) {
  return connected ? null : nationsTvLineup(partido).isNations ? 30000 : 3000;
}
