import {getApiBaseUrl} from './apiPublicBaseUrl';
export function createNationsOperatorApi(accessToken,{fetchImpl=fetch,baseUrl=getApiBaseUrl()}={}){
 async function request(path,{method='GET',body,signal}={}){
  if(!accessToken)throw new Error('Inicia sesión con tu cuenta de Padbol Match.');
  const response=await fetchImpl(baseUrl+path,{method,headers:{Authorization:`Bearer ${accessToken}`,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal,cache:'no-store'});
  const data=await response.json().catch(()=>({}));if(!response.ok||data.ok===false)throw Object.assign(new Error(data.error||'No se pudo confirmar la operación. Actualiza y reintenta.'),{status:response.status,code:data.code});return data;
 }
 const event='/api/nations/operator/torneos/57';
 const match=id=>{if(!Number.isSafeInteger(Number(id))||Number(id)<=0)throw Error('Partido inválido.');return event+'/partidos/'+Number(id);};
 return {access:signal=>request('/api/nations/operator/access',{signal}),dashboard:signal=>request(event,{signal}),
  schedule:body=>request(event+'/nations-cup/programacion',{method:'PUT',body}),
  open:(id,court)=>request(event+'/nations-cup/partidos/'+Number(id)+'/marcador',{method:'POST',body:{court_id:Number(court)}}),
  lineup:(id,team,body)=>request(match(id)+'/equipos/'+Number(team)+'/alineacion',{method:'PUT',body}),
  control:id=>request(match(id)+'/control-token',{method:'POST',body:{}}),
  manualResult:(id,golesA,golesB)=>request(match(id)+'/resultado',{method:'POST',body:{goles_a:Number(golesA),goles_b:Number(golesB)}}),
  revokeControl:id=>request(match(id)+'/revoke-control-token',{method:'POST',body:{}}),
  grants:signal=>request('/api/admin/nations/operator-grants',{signal}),
  grant:email=>request('/api/admin/nations/operator-grants',{method:'POST',body:{torneo_id:57,email}}),
  revoke:id=>request('/api/admin/nations/operator-grants/'+encodeURIComponent(id),{method:'DELETE'}),
 };
}
