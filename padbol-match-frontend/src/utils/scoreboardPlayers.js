export function scoreboardPlayerName(jugador) {
  return String(jugador?.nombre ?? jugador?.name ?? '').trim();
}

/** Nombres que no representan un jugador real (placeholders / residuales). */
const PLACEHOLDER_PLAYER_NAME_RE =
  /^(?:[—–−-]{1,3}|sin\s*jugador|jugador\s*[1-4]|n\/?a|null|undefined|\.)$/i;

export function isPlaceholderScoreboardPlayerName(raw) {
  const name = String(raw ?? '').trim();
  if (!name) return true;
  return PLACEHOLDER_PLAYER_NAME_RE.test(name);
}

export function hasScoreboardPlayerName(jugador) {
  const name = scoreboardPlayerName(jugador);
  return Boolean(name) && !isPlaceholderScoreboardPlayerName(name);
}

/**
 * Identidad real comprobable para mostrar en el marcador.
 * - nombre real no vacío y no placeholder; o
 * - id de jugador/usuario/perfil asociado (no confundir con slot 1–4).
 * Un dorsal, índice o objeto estructural solo NO alcanza.
 */
export function hasRealScoreboardPlayerIdentity(jugador) {
  if (jugador == null || typeof jugador !== 'object') return false;

  const nameOk = hasScoreboardPlayerName(jugador);

  const explicitIds = [
    jugador.jugador_id,
    jugador.user_id,
    jugador.perfil_id,
    jugador.usuario_id,
  ];
  for (const raw of explicitIds) {
    if (isUsablePlayerId(raw, { allowSmallNumeric: true })) {
      return true;
    }
  }

  // `id` genérico: aceptar UUID / ids grandes; rechazar 1–4 (suelen ser slot).
  if (isUsablePlayerId(jugador.id, { allowSmallNumeric: false })) {
    return true;
  }

  return nameOk;
}

function isUsablePlayerId(raw, { allowSmallNumeric }) {
  if (raw == null || raw === '') return false;
  const idStr = String(raw).trim();
  if (!idStr || idStr === '0') return false;
  if (/^[0-9a-f]{8}-[0-9a-f-]+$/i.test(idStr)) return true;
  if (/^\d+$/.test(idStr)) {
    const n = Number(idStr);
    if (!Number.isFinite(n) || n <= 0) return false;
    if (!allowSmallNumeric && n >= 1 && n <= 4) return false;
    return true;
  }
  // ids no numéricos (p. ej. códigos internos)
  if (idStr.length >= 6) return true;
  return false;
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
  const raw = jugador?.jersey ?? jugador?.numero ?? jugador?.number ?? jugador?.dorsal;
  if (!hasScoreboardJerseyInput(raw) && !hasScoreboardJerseyField(raw)) return null;
  const parsed = parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 99) return null;
  return String(parsed);
}

export function isScoreboardSlotEmptyForSave(jugador) {
  const nombre = scoreboardPlayerName(jugador);
  if (nombre && !isPlaceholderScoreboardPlayerName(nombre)) return false;
  return !hasScoreboardJerseyInput(jugador?.jersey ?? jugador?.numero);
}

export function isScoreboardSlotEmptyForDisplay(jugador, jerseyFieldValue) {
  if (hasRealScoreboardPlayerIdentity(jugador)) return false;
  if (hasScoreboardJerseyField(jerseyFieldValue)) return false;
  if (hasScoreboardJerseyField(jugador?.jersey ?? jugador?.numero)) return false;
  return true;
}

export function filterNamedScoreboardJugadores(jugadores) {
  return (Array.isArray(jugadores) ? jugadores : []).filter(hasScoreboardPlayerName);
}

/**
 * Jugadores registrados a mostrar en el marcador (hasta 4).
 * Exige identidad real; no rellena plazas; ignora slots residuales con solo dorsal/índice/guion.
 */
export function listVisibleScoreboardJugadores(jugadores, max = 4) {
  const limit = Number.isFinite(max) && max > 0 ? Math.min(4, Math.floor(max)) : 4;
  return (Array.isArray(jugadores) ? jugadores : [])
    .filter((j) => hasRealScoreboardPlayerIdentity(j))
    .slice(0, limit);
}
