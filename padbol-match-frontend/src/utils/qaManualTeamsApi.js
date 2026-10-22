import { getAuthHeaders } from './scoreboardApi';
async function request(base,id,body){
 const headers=await getAuthHeaders();if(!headers.Authorization)throw Object.assign(new Error('Inicia sesión.'),{status:401});
 const response=await fetch(`${String(base).replace(/\/+$/,'')}/api/torneos/${Number(id)}/inscripcion-qa`,{method:body?'POST':'GET',headers:{...headers,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 const data=await response.json().catch(()=>null);
 if(!response.ok||data?.ok!==true||Number(data.torneo_id)!==Number(id))throw Object.assign(new Error(data?.error||'No se pudo confirmar la operación.'),{status:response.status});
 if(body&&(!['created','idempotent'].includes(data.status)||!data.equipo?.id||Number(data.equipo.torneo_id)!==Number(id)))throw new Error('El servidor no confirmó la dupla.');
 if(!body&&(!Array.isArray(data.players)||data.can_manage!==true))throw new Error('No se pudo confirmar el catálogo QA.');
 return data;
}
export function readQaTeamEntry(base,id){return request(base,id);}
export function saveQaTeamEntry(base,id,body){return request(base,id,body);}
