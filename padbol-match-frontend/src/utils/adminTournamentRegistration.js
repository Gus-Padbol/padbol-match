import {getAuthHeaders} from './scoreboardApi';
const rowOf=value=>Array.isArray(value)&&value.length===1?value[0]:value;
const confirmed=(row,id)=>String(row?.id)===String(id)&&['abierto','inscripcion_abierta'].includes(row?.estado);
export async function openConfirmedTournamentRegistration({apiBaseUrl,torneoId}) {
 const headers=await getAuthHeaders();if(!headers.Authorization)throw new Error('Ingresa nuevamente antes de abrir la inscripción.');
 const url=`${String(apiBaseUrl).replace(/\/+$/,'')}/api/torneos/${torneoId}`;
 const response=await fetch(url,{method:'PUT',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({estado:'abierto'})});
 const saved=rowOf(await response.json().catch(()=>null));
 if(!response.ok)throw new Error(saved?.error||'No se confirmó la apertura de inscripción.');
 if(!confirmed(saved,torneoId))throw new Error('El recibo no confirma la apertura de inscripción. Consulta el estado antes de repetir.');
 const reread=await fetch(url,{headers});const row=rowOf(await reread.json().catch(()=>null));
 if(!reread.ok||!confirmed(row,torneoId))throw new Error('La lectura posterior no confirmó la inscripción abierta. Consulta el estado antes de repetir.');
 return row;
}
