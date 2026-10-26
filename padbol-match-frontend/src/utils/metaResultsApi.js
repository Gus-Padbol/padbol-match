import {getApiBaseUrl} from './apiPublicBaseUrl';
export function createMetaResultsApi(token){
 const base=`${getApiBaseUrl()}/api/admin/content/workspace/meta`;
 async function request(path,method='GET',body,multipart=false){
  const response=await fetch(`${base}${path}`,{method,cache:'no-store',headers:{Authorization:`Bearer ${token}`,...(body&&!multipart?{'Content-Type':'application/json'}:{})},...(body?{body:multipart?body:JSON.stringify(body)}:{})});
  if(!response.ok){
   const data=await response.json().catch(()=>({}));
   const messages={OVERLAPPING_IMPORT:'Este período ya tiene una fuente activa. Revisa el archivo y elige reemplazarla si corresponde.',HASH_MISMATCH:'El archivo no coincide con la vista previa. Vuelve a validarlo antes de importar.',SOURCE_METADATA_CONFLICT:'Este archivo ya existe con otros datos de fuente. Revisa su exportación antes de continuar.',PREVIEW_EXPIRED:'La vista previa venció. Vuelve a validar el archivo.',META_READ_CONNECTION_NOT_CONFIGURED:'La conexión de lectura de Meta todavía no está configurada.',META_READ_ACCESS_FAILED:'No se pudo comprobar el acceso de lectura a Meta.',META_READ_ACCOUNT_MISMATCH:'La conexión no corresponde a la cuenta publicitaria autorizada.',META_READ_NO_DELIVERY:'Meta no devolvió registros de entrega para ese período.'};
   const safeValidation=response.status===400&&typeof data.error==='string'&&data.code;
   const message=response.status===403?'Tu cuenta no tiene acceso a los resultados de Meta.':messages[data.code]||(safeValidation?data.error:response.status===429?'Se alcanzó el límite temporal de consultas. Espera un momento antes de volver a intentar.':'No se pudo completar la consulta de Meta. Revisa el archivo, las fechas o la conexión e inténtalo de nuevo.');
   throw Object.assign(new Error(message),{status:response.status,code:data.code||null});
  }
  return response.json();
 }
 return {status:()=>request('/status'),insights:filters=>request(`/insights?${new URLSearchParams(Object.entries(filters).filter(([,v])=>v!==''&&v!==null&&v!==undefined))}`),preview:(file,metadata)=>{const body=new FormData();body.append('file',file);Object.entries(metadata).forEach(([key,value])=>{if(value)body.append(key,value);});return request('/imports/preview','POST',body,true);},commit:(id,body)=>request(`/imports/${encodeURIComponent(id)}/commit`,'POST',body),sync:body=>request('/sync','POST',body)};
}
