export const PADBOL_SELECTION_MODE = 'selecciones';
export function isPadbolSelection(torneo) {
  return String(torneo?.deporte || '').trim().toLowerCase() === 'padbol'
    && torneo?.modalidad_plantel === PADBOL_SELECTION_MODE;
}
export function selectionRosterCapacityOptions(torneo) {
  return isPadbolSelection(torneo) ? [4, 5, 6, 7, 8] : [2, 3, 4];
}
export function selectionRosterPlayers(raw) {
  let rows = raw;
  if (typeof rows === 'string') {
    try { rows = JSON.parse(rows); } catch { rows = []; }
  }
  return Array.isArray(rows) ? rows : [];
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function selectionPlayerId(player) {
  const id = String(player?.user_id || player?.id || '').trim().toLowerCase();
  return UUID.test(id) ? id : null;
}
export function confirmedSelectionPlayers(raw) {
  const seen = new Set();
  return selectionRosterPlayers(raw).filter(player => {
    const id = selectionPlayerId(player);
    if (!id || seen.has(id) || (player?.estado != null && String(player.estado).toLowerCase() !== 'confirmado')) return false;
    seen.add(id);
    return true;
  });
}
export function selectionTeamReady(equipo, torneo) {
  if (!isPadbolSelection(torneo)) return null;
  const all = selectionRosterPlayers(equipo?.jugadores);
  const valid = confirmedSelectionPlayers(all);
  const capacity = Number(equipo?.cupo_maximo);
  return Number.isInteger(capacity) && capacity >= 4 && capacity <= 8
    && all.length >= 4 && all.length <= capacity && valid.length === all.length
    && all.every(player => String(player.estado || '').toLowerCase() === 'confirmado');
}
export function validateSelectionLineup({ iniciales, suplentes }, plantel) {
  if (!Array.isArray(iniciales) || iniciales.length !== 2 || !Array.isArray(suplentes) || suplentes.length !== 2) {
    throw new Error('Presenta exactamente dos jugadores iniciales y dos suplentes.');
  }
  const ids = [...iniciales, ...suplentes].map(id => String(id || '').trim().toLowerCase());
  if (ids.some(id => !UUID.test(id)) || new Set(ids).size !== 4) {
    throw new Error('Los cuatro jugadores deben estar identificados y no pueden repetirse.');
  }
  const allowed = new Set(confirmedSelectionPlayers(plantel).map(selectionPlayerId));
  if (ids.some(id => !allowed.has(id))) throw new Error('Todos los jugadores presentados deben pertenecer al plantel confirmado.');
  return { iniciales: ids.slice(0, 2), suplentes: ids.slice(2) };
}
