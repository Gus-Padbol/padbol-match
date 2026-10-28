import {getApiBaseUrl} from './apiPublicBaseUrl';
export function createWebAnalyticsApi(token) {
 const base=`${getApiBaseUrl()}/api/admin/content/workspace/analytics`;
 async function get(path) {
  const response=await fetch(base+path,{method:'GET',cache:'no-store',headers:{Authorization:`Bearer ${token}`}});
  if(!response.ok){
   const data=await response.json().catch(()=>({}));
   const messages={GA4_READ_CONNECTION_NOT_CONFIGURED:'La lectura de Google Analytics todavía no está conectada.',GA4_READ_AUTHORIZATION_FAILED:'Google Analytics no permitió leer los informes. Revisa la autorización de lectura.',GA4_PARTIAL_DAY_NOT_ALLOWED:'El período debe contener únicamente días completos del horario del informe.',GA4_PROPERTY_MISMATCH:'La conexión no corresponde a la propiedad autorizada.',GA4_INVALID_DATE:'Elige un período válido de hasta 92 días completos.'};
   const message=response.status===403?'Tu cuenta no tiene acceso a la analítica web.':messages[data.code]|| (response.status===429?'Se alcanzó el límite temporal de consultas. Espera un momento y vuelve a intentar.':'No se pudo consultar Google Analytics. Inténtalo nuevamente.');
   throw Object.assign(new Error(message),{status:response.status,code:data.code||null});
  }
  return response.json();
 }
 return {status:()=>get('/status'),summary:filters=>get('/summary?'+new URLSearchParams(Object.entries(filters||{}).filter(([,value])=>value)))};
}
