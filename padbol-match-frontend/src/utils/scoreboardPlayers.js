export function scoreboardPlayerName(jugador) {
  return String(jugador?.nombre ?? jugador?.name ?? '').trim();
}

export function hasScoreboardPlayerName(jugador) {
  return Boolean(scoreboardPlayerName(jugador));
}

export function filterNamedScoreboardJugadores(jugadores) {
  return (Array.isArray(jugadores) ? jugadores : []).filter(hasScoreboardPlayerName);
}
