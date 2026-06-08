export function scoreboardPlayerName(jugador) {
  return String(jugador?.nombre ?? jugador?.name ?? '').trim();
}

export function hasScoreboardPlayerName(jugador) {
  return Boolean(scoreboardPlayerName(jugador));
}

export function hasScoreboardJerseyInput(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return false;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 1 && n <= 99;
}

export function hasScoreboardJerseyField(value) {
  if (value == null || value === '') return false;
  const n = Number(value);
  return Number.isFinite(n) && n !== 0;
}

export function isScoreboardSlotEmptyForSave(jugador) {
  const nombre = scoreboardPlayerName(jugador);
  if (nombre) return false;
  return !hasScoreboardJerseyInput(jugador?.jersey ?? jugador?.numero);
}

export function isScoreboardSlotEmptyForDisplay(jugador, jerseyFieldValue) {
  if (hasScoreboardPlayerName(jugador)) return false;
  if (hasScoreboardJerseyField(jerseyFieldValue)) return false;
  if (hasScoreboardJerseyField(jugador?.jersey ?? jugador?.numero)) return false;
  return true;
}

export function filterNamedScoreboardJugadores(jugadores) {
  return (Array.isArray(jugadores) ? jugadores : []).filter(hasScoreboardPlayerName);
}
