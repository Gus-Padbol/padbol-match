import { getAuthHeaders } from './scoreboardApi';
import { selectionPlayerId, validateSelectionLineup } from './padbolSelectionRoster';

function positive(value) {
  if (!Number.isSafeInteger(Number(value)) || Number(value) <= 0) throw new Error('Identificador de torneo, partido o equipo inválido.');
  return String(value);
}
function revision(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Recarga la ficha para confirmar su revisión antes de guardar.');
  return value;
}
function validRoster(players, capacity) {
  if (!Array.isArray(players) || players.length < 1 || players.length > capacity) return false;
  const ids = players.map(selectionPlayerId);
  return ids.every(Boolean) && new Set(ids).size === ids.length
    && players.every(player => player.estado === 'confirmado');
}
async function request(base, path, method = 'GET', body) {
  const headers = await getAuthHeaders();
  if (!headers.Authorization) throw Object.assign(new Error('Inicia sesión para gestionar el plantel o la alineación.'), { status: 401 });
  const response = await fetch(`${String(base || '').replace(/\/+$/, '')}/api/torneos/${path}`, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.ok !== true) throw Object.assign(new Error(data?.error || 'No se pudo confirmar la operación. Recarga la ficha antes de intentar nuevamente.'), { status: response.status, code: data?.code });
  return data;
}
function teamReceipt(data, torneoId, equipoId, mutation = false) {
  if (Number(data.torneo_id) !== Number(torneoId) || !Number.isSafeInteger(Number(data.equipo_id)) || Number(data.equipo_id) <= 0
    || (equipoId != null && Number(data.equipo_id) !== Number(equipoId)) || !Array.isArray(data.jugadores) || !Array.isArray(data.solicitudes)
    || !selectionPlayerId({ id: data.creador_id }) || !Number.isInteger(data.cupo_maximo) || data.cupo_maximo < 4 || data.cupo_maximo > 8
    || !validRoster(data.jugadores, data.cupo_maximo)
    || !data.jugadores.some(player => selectionPlayerId(player) === String(data.creador_id).toLowerCase())
    || data.solicitudes.some(player => !selectionPlayerId(player))
    || typeof data.can_confirm !== 'boolean' || (mutation && !['saved','idempotent'].includes(data.status))) {
    throw new Error('El servidor no confirmó el plantel de este equipo. Recarga para comprobarlo.');
  }
  revision(data.plantel_revision);
  return data;
}
export async function listSelectionTeams({ apiBaseUrl, torneoId }) {
  const data = await request(apiBaseUrl, `${positive(torneoId)}/selecciones`);
  if (Number(data.torneo_id) !== Number(torneoId) || !Array.isArray(data.equipos)) throw new Error('No se pudo confirmar la lista de equipos de este torneo.');
  if (data.equipos.some(team => !Number.isSafeInteger(Number(team.id)) || Number(team.id) <= 0
    || !Number.isInteger(team.cupo_maximo) || team.cupo_maximo < 4 || team.cupo_maximo > 8
    || !selectionPlayerId({ id: team.creador_id }) || !validRoster(team.jugadores, team.cupo_maximo)
    || typeof team.equipo_abierto !== 'boolean')) throw new Error('La lista contiene un plantel que no se pudo confirmar. Recarga la ficha.');
  return data.equipos;
}
export async function readSelectionTeam({ apiBaseUrl, torneoId, equipoId }) {
  return teamReceipt(await request(apiBaseUrl, `${positive(torneoId)}/selecciones/${positive(equipoId)}`), torneoId, equipoId);
}
export async function createSelectionTeam({ apiBaseUrl, torneoId, nombre, cupo_maximo, equipo_abierto }) {
  if (!String(nombre || '').trim() || !Number.isInteger(cupo_maximo) || cupo_maximo < 4 || cupo_maximo > 8) throw new Error('El equipo necesita nombre y un cupo de cuatro a ocho jugadores.');
  return teamReceipt(await request(apiBaseUrl, `${positive(torneoId)}/selecciones`, 'POST', { nombre: String(nombre).trim(), cupo_maximo, equipo_abierto: equipo_abierto === true }), torneoId, undefined, true);
}
export async function requestSelectionMembership({ apiBaseUrl, torneoId, equipoId }) {
  return teamReceipt(await request(apiBaseUrl, `${positive(torneoId)}/selecciones/${positive(equipoId)}/solicitudes`, 'POST', {}), torneoId, equipoId, true);
}
export async function saveSelectionRoster({ apiBaseUrl, torneoId, equipoId, user_ids, expected_revision }) {
  if (!Array.isArray(user_ids) || user_ids.length < 1 || user_ids.length > 8 || user_ids.some(id => !selectionPlayerId({ id })) || new Set(user_ids.map(id => String(id).toLowerCase())).size !== user_ids.length) throw new Error('El plantel debe contener entre uno y ocho jugadores únicos.');
  return teamReceipt(await request(apiBaseUrl, `${positive(torneoId)}/selecciones/${positive(equipoId)}/plantel`, 'PUT', { user_ids, expected_revision: revision(expected_revision) }), torneoId, equipoId, true);
}
export async function confirmSelectionRegistration({ apiBaseUrl, torneoId, equipoId, expected_revision }) {
  const dto = teamReceipt(await request(apiBaseUrl, `${positive(torneoId)}/selecciones/${positive(equipoId)}/confirmar`, 'POST', { expected_revision: revision(expected_revision) }), torneoId, equipoId, true);
  if (dto.inscripcion_estado !== 'confirmado') throw new Error('El servidor no confirmó la inscripción. Recarga para comprobarlo.');
  return dto;
}
function lineupReceipt(data, torneoId, partidoId, equipoId) {
  if (Number(data.torneo_id) !== Number(torneoId) || Number(data.partido_id) !== Number(partidoId) || Number(data.equipo_id) !== Number(equipoId)
    || typeof data.required !== 'boolean' || typeof data.can_edit !== 'boolean' || !Array.isArray(data.plantel)
    || (data.alineacion !== null && typeof data.alineacion !== 'object')) throw new Error('El servidor no confirmó la alineación de este partido. Recarga para comprobarlo.');
  if (data.alineacion) {
    validateSelectionLineup(data.alineacion, data.plantel);
    revision(data.alineacion.revision);
  }
  return data;
}
export async function readSelectionLineup({ apiBaseUrl, torneoId, partidoId, equipoId }) {
  const path = `${positive(torneoId)}/partidos/${positive(partidoId)}/equipos/${positive(equipoId)}/alineacion`;
  return lineupReceipt(await request(apiBaseUrl, path), torneoId, partidoId, equipoId);
}
export async function saveSelectionLineup({ apiBaseUrl, torneoId, partidoId, equipoId, alineacion, plantel, expected_revision }) {
  const body = { ...validateSelectionLineup(alineacion, plantel), expected_revision: revision(expected_revision) };
  const path = `${positive(torneoId)}/partidos/${positive(partidoId)}/equipos/${positive(equipoId)}/alineacion`;
  const data = lineupReceipt(await request(apiBaseUrl, path, 'PUT', body), torneoId, partidoId, equipoId);
  if (!data.alineacion || data.alineacion.revision <= expected_revision || ['iniciales','suplentes'].some(key => data.alineacion[key].map(String).join() !== body[key].join())) throw new Error('La alineación enviada no quedó confirmada. Recarga para comprobar el estado.');
  return data;
}
