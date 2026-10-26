import {getApiBaseUrl} from './apiPublicBaseUrl';
export function createMetaResultsApi(token){
 const base=`${getApiBaseUrl()}/api/admin/content/workspace/meta`;
 async function request(path,method='GET',body,multipart=false){
  const response=await fetch(`${base}${path}`,{method,cache:'no-store',headers:{Authorization:`Bearer ${token}`,...(body&&!multipart?{'Content-Type':'application/json'}:{})},...(body?{body:multipart?body:JSON.stringify(body)}:{})});
  if(!response.ok){const data=await response.json().catch(()=>({}));throw Object.assign(new Error(response.status===403?'Tu cuenta no tiene acceso a los resultados de Meta.':response.status===409?'Este período ya tiene una importación activa. Puedes revisar y reemplazar su fuente.':response.status===429?'Se alcanzó el límite temporal de consultas. Espera un momento antes de volver a intentar.':'No se pudo completar la consulta de Meta. Revisa el archivo, las fechas o la conexión e inténtalo de nuevo.'),{status:response.status,code:data.error||data.code});}
  return response.json();
 }
 return {status:()=>request('/status'),insights:filters=>request(`/insights?${new URLSearchParams(Object.entries(filters).filter(([,v])=>v!==''&&v!==null&&v!==undefined))}`),preview:(file,metadata)=>{const body=new FormData();body.append('file',file);Object.entries(metadata).forEach(([key,value])=>{if(value)body.append(key,value);});return request('/imports/preview','POST',body,true);},commit:(id,body)=>request(`/imports/${encodeURIComponent(id)}/commit`,'POST',body),sync:body=>request('/sync','POST',body)};
}
