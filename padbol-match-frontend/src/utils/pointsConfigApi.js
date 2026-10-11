import { getAuthHeaders } from './scoreboardApi';

function object(value){return value&&typeof value==='object'&&!Array.isArray(value);}
export function validatePointsConfig(data){
  if(!object(data)||!object(data.niveles)||!object(data.posiciones)||!Array.isArray(data.tipos_custom)||!object(data.niveles_labels)||!Array.isArray(data.niveles_hidden)
    ||!['persisted','defaults'].includes(data.source)||!/^([0-9a-f]{64})$/i.test(data.policy_version||'')
    ||Object.values(data.niveles).some(value=>!Number.isFinite(value)||value<0)
    ||Object.entries(data.posiciones).some(([key,value])=>!/^[1-9]\d*$/.test(key)||!Number.isFinite(value)||value<0||value>100)
    ||Object.values(data.niveles_labels).some(value=>typeof value!=='string')
    ||data.niveles_hidden.some(value=>typeof value!=='string')
    ||data.tipos_custom.some(value=>!object(value)||typeof value.id!=='string'||typeof value.nombre!=='string'||!Number.isFinite(value.puntos)||value.puntos<0))throw new Error('No se pudo confirmar la política de puntos guardada.');
  return data;
}
function canonical(value){if(Array.isArray(value))return value.map(canonical);if(object(value))return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));return value;}
const FIELDS=['niveles','posiciones','tipos_custom','niveles_labels','niveles_hidden'];
function matches(a,b){return FIELDS.every(key=>JSON.stringify(canonical(a[key]))===JSON.stringify(canonical(b[key])));}
export async function readPointsConfig({apiBaseUrl,signal}){
  const response=await fetch(`${String(apiBaseUrl).replace(/\/+$/,'')}/api/config/puntos`,{signal});const data=await response.json().catch(()=>null);
  if(!response.ok)throw new Error(data?.error||'No se pudo cargar la política de puntos.');return validatePointsConfig(data);
}
export async function savePointsConfig(context,body){
  const headers=await getAuthHeaders();if(!headers.Authorization)throw new Error('Ingresa nuevamente para guardar la configuración.');
  const response=await fetch(`${String(context.apiBaseUrl).replace(/\/+$/,'')}/api/config/puntos`,{method:'PUT',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const receipt=await response.json().catch(()=>null);if(!response.ok)throw new Error(receipt?.error||'No se guardó la configuración. El borrador permanece disponible.');
  if(receipt?.ok!==true)throw new Error('El servidor no confirmó el guardado de la configuración.');
  const saved=validatePointsConfig(receipt.config);if(!matches(saved,body))throw new Error('El recibo no coincide con la configuración enviada.');
  const confirmed=await readPointsConfig(context);if(saved.policy_version!==confirmed.policy_version||!matches(saved,confirmed))throw new Error('La lectura posterior no confirmó la configuración guardada.');
  return confirmed;
}
export async function readTournamentPointsPolicy({apiBaseUrl,torneoId,signal}){
  const response=await fetch(`${String(apiBaseUrl).replace(/\/+$/,'')}/api/torneos/${torneoId}/politica-puntos`,{signal});const data=await response.json().catch(()=>null);
  if(!response.ok)throw new Error(data?.error||'No se pudo confirmar la política del torneo.');
  if(data?.ok!==true||String(data.torneo_id)!==String(torneoId)||!Number.isFinite(data.base_points)||data.base_points<0||!['approved_snapshot','current_config'].includes(data.source))throw new Error('La política del torneo no fue confirmada.');
  return {...data,policy:validatePointsConfig(data.policy)};
}
export function pointsBaseForLevel(policy,level){
  if(!policy||!Array.isArray(policy.tipos_custom)||!object(policy.niveles))return null;
  const key=level==='club'?'club_oficial':level;
  const custom=policy.tipos_custom.find(row=>row.id===key);
  const value=custom?.puntos??policy.niveles[key];return Number.isFinite(value)&&value>=0?value:null;
}
