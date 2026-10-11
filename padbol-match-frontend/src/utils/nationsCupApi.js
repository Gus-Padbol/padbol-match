import { getAuthHeaders } from './scoreboardApi';

const CAPABILITIES = ['can_configure', 'can_draw', 'can_advance', 'can_schedule', 'can_close'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const NATIONS_STANDINGS_RULES = ['points', 'set_difference', 'sets_for', 'game_difference', 'games_for'];

export function validateNationsReceipt(data, torneoId) {
  if (!data || data.ok !== true || String(data.torneo_id) !== String(torneoId)
    || !Number.isSafeInteger(data.revision) || data.revision < 0
    || !data.capabilities || CAPABILITIES.some(key => typeof data.capabilities[key] !== 'boolean')
    || ['groups','standings','thirds','qualified','bracket','matches','ties'].some(key => !Array.isArray(data[key]))
    || typeof data.status !== 'string' || !Object.prototype.hasOwnProperty.call(data, 'config')) {
    throw new Error('No se pudo confirmar el estado de Nations Cup. Actualiza antes de continuar.');
  }
  const idValid = id => Number.isSafeInteger(Number(id)) && Number(id) > 0;
  const rowsValid = rows => rows.every(row => row && idValid(row.equipo_id) && typeof row.nombre === 'string');
  if ((data.config !== null && (typeof data.config !== 'object' || data.config.format !== 'nations_3x5' || typeof data.config.timezone !== 'string'))
    || data.groups.some(group => typeof group?.label !== 'string' || !Array.isArray(group.team_ids) || group.team_ids.some(id=>!idValid(id)))
    || data.standings.some(group => typeof group?.group !== 'string' || !Array.isArray(group.rows) || !rowsValid(group.rows))
    || !rowsValid(data.thirds) || !rowsValid(data.qualified)
    || [...data.matches,...data.bracket].some(match=>!idValid(match?.id) || typeof match.estado !== 'string')
    || data.ties.some(tie=>typeof tie?.scope !== 'string' || !Array.isArray(tie.team_ids) || tie.team_ids.some(id=>!idValid(id)))
    || (data.teams !== undefined && (!Array.isArray(data.teams)||data.teams.some(team=>!idValid(team?.id)||typeof team.nombre!=='string')))
    || (data.courts !== undefined && (!Array.isArray(data.courts) || data.courts.some(court=>!idValid(court?.id) || typeof court.nombre !== 'string')))) {
    throw new Error('La respuesta de Nations Cup está incompleta. Actualiza antes de continuar.');
  }
  return data;
}

async function request({ apiBaseUrl, torneoId, accessToken, signal }, suffix = '', options = {}) {
  if (!Number.isSafeInteger(Number(torneoId)) || Number(torneoId) <= 0) throw new Error('Torneo inválido.');
  const headers = await getAuthHeaders(accessToken);
  if (!headers.Authorization) throw Object.assign(new Error('Ingresa nuevamente para gestionar Nations Cup.'), {status:401});
  const response = await fetch(`${String(apiBaseUrl).replace(/\/+$/, '')}/api/torneos/${torneoId}/nations-cup${suffix}`, {
    ...options, headers: {...headers, 'Content-Type':'application/json'}, signal,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw Object.assign(new Error(data?.error || 'No se pudo completar la operación. Consulta el estado antes de repetir.'), {
    status: response.status, code: data?.code, ties: Array.isArray(data?.ties) ? data.ties : [],
  });
  return validateNationsReceipt(data, torneoId);
}

export function readNationsCup(context) { return request(context); }
export async function readNationsCupPublic({apiBaseUrl,torneoId,signal}) {
  const response=await fetch(`${String(apiBaseUrl).replace(/\/+$/, '')}/api/torneos/${torneoId}/nations-cup/publico`,{signal});
  const data=await response.json().catch(()=>null);
  if(!response.ok)throw new Error(data?.error || 'La información pública de Nations Cup todavía no está disponible.');
  return validateNationsReceipt({...data,capabilities:Object.fromEntries(CAPABILITIES.map(key=>[key,false]))},torneoId);
}
export async function mutateNationsCup(context, action, body) {
  const routes = { config:['PUT','/config'], draw:['POST','/sorteo'], advance:['POST','/avanzar'], schedule:['PUT','/programacion'], approveRules:['POST','/aprobar-reglas'], close:['POST','/finalizar'], resolveTies:['POST','/desempates'] };
  if (!routes[action]) throw new Error('Acción de Nations Cup inválida.');
  if (!Number.isSafeInteger(body?.expected_revision) || body.expected_revision < 0 || !UUID.test(body?.request_id || '')) {
    throw new Error('Actualiza el estado y confirma la identidad del intento antes de guardar.');
  }
  const [method, suffix] = routes[action];
  const saved = await request(context, suffix, { method, body:JSON.stringify(body) });
  if (saved.revision <= body.expected_revision) throw new Error('El servicio no confirmó una revisión guardada. Consulta el estado antes de repetir.');
  const confirmed = await readNationsCup(context);
  if (confirmed.revision !== saved.revision || ['config','groups','standings','thirds','qualified','bracket','matches','ties','status'].some(key => nationsCupStateValue(confirmed[key], key) !== nationsCupStateValue(saved[key], key))) {
    throw new Error('La lectura posterior no confirmó lo guardado. Actualiza el torneo antes de repetir.');
  }
  return confirmed;
}

export function nationsCupRequestId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  if (typeof crypto === 'undefined' || !crypto.getRandomValues) throw new Error('Este navegador no puede crear un intento seguro.');
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2,'0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

export async function createNationsScoreboard(context, partidoId) {
  if (!Number.isSafeInteger(Number(partidoId)) || Number(partidoId)<=0) throw new Error('Partido inválido.');
  const headers=await getAuthHeaders(context.accessToken);
  if(!headers.Authorization)throw new Error('Ingresa nuevamente para abrir el marcador.');
  const response=await fetch(`${String(context.apiBaseUrl).replace(/\/+$/,'')}/api/torneos/${context.torneoId}/nations-cup/partidos/${partidoId}/marcador`,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:'{}'});
  const data=await response.json().catch(()=>null);
  if(!response.ok)throw new Error(data?.error||'No se pudo abrir el marcador de este partido.');
  if(data?.ok!==true||String(data.torneo_id)!==String(context.torneoId)||String(data.partido_id)!==String(partidoId)||typeof data.scoreboard_id!=='string'||!UUID.test(data.scoreboard_id)||typeof data.status!=='string')throw new Error('No se confirmó el marcador del partido.');
  // Authentication is provided by the actual control route; never expose a control token.
  return {scoreboard_id:data.scoreboard_id,status:data.status};
}

function canonical(value) {
  if(Array.isArray(value))return value.map(canonical);
  if(value && typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));
  return value;
}
function nationsCupStateValue(value, key) {
  if(!Array.isArray(value))return JSON.stringify(canonical(value));
  const normalized=value.map(item=>{
    const row=canonical(item);
    if(key==='groups' && Array.isArray(row.team_ids))row.team_ids=[...row.team_ids].sort((a,b)=>Number(a)-Number(b));
    if(key==='standings' && Array.isArray(row.rows))row.rows=[...row.rows].sort((a,b)=>Number(a.equipo_id)-Number(b.equipo_id));
    return row;
  });
  // IDs are used solely to compare receipts, never to resolve sporting order.
  normalized.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return JSON.stringify(normalized);
}

export async function readNationsCupActa(context, expectedRevision) {
  const headers=await getAuthHeaders(context.accessToken);
  if(!headers.Authorization)throw new Error('Ingresa nuevamente para revisar el acta.');
  const response=await fetch(`${String(context.apiBaseUrl).replace(/\/+$/,'')}/api/torneos/${context.torneoId}/nations-cup/acta`,{headers});
  const data=await response.json().catch(()=>null);
  if(!response.ok)throw new Error(data?.error||'No se pudo preparar el acta.');
  if(data?.ok!==true||String(data.torneo_id)!==String(context.torneoId)||data.revision!==expectedRevision||data.type!=='event_review_draft'||data.official_fipa_points!==null||data.official_fipa_status!=='external_review_required'||!Array.isArray(data.placements)||!Array.isArray(data.matches)||!Array.isArray(data.declared_participants))throw new Error('El acta no confirmó el estado actual o su condición de borrador. Actualiza antes de exportar.');
  return data;
}
