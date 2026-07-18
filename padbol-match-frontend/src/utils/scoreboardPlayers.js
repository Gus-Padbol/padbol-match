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

/**
 * Número de camiseta solo si está cargado (1–99).
 * No inventa dorsales por índice de slot.
 */
export function getScoreboardJerseyLabel(jugador) {
  const raw = jugador?.jersey ?? jugador?.numero ?? jugador?.number;
  if (!hasScoreboardJerseyInput(raw) && !hasScoreboardJerseyField(raw)) return null;
  const parsed = parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 99) return null;
  return String(parsed);
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

/**
 * Jugadores registrados a mostrar en el marcador (2–4).
 * Excluye null/undefined y entradas sin nombre válido; no rellena plazas vacías.
 */
export function listVisibleScoreboardJugadores(jugadores, max = 4) {
  const limit = Number.isFinite(max) && max > 0 ? Math.min(4, Math.floor(max)) : 4;
  return filterNamedScoreboardJugadores(jugadores).slice(0, limit);
}
