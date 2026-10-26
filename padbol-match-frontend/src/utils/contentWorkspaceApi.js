import {getApiBaseUrl} from './apiPublicBaseUrl';
export function createContentWorkspaceApi(token) {
 async function request(path='',method='GET',body) {
  const r=await fetch(`${getApiBaseUrl()}/api/admin/content/workspace${path}`,{method,cache:'no-store',headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  if(!r.ok) throw Object.assign(new Error(r.status===409?'La ficha cambió. Vuelve a abrirla antes de guardar.':r.status===403?'Tu cuenta no tiene acceso a contenido.':'No se pudo guardar. Revisa los datos e inténtalo de nuevo.'),{status:r.status});
  return r.json();
 }
 return {coordinator:body=>request('/coordinators','POST',body),promotion:(id,body)=>request(`/${encodeURIComponent(id)}/promotion`,'POST',body),editors:()=>request('/editors'),addPublication:(id,body)=>request(`/${encodeURIComponent(id)}/publications`,'POST',body),fileLink:(id,fileId)=>request(`/${encodeURIComponent(id)}/files/${encodeURIComponent(fileId)}`),upload:async(id,file)=>{const body=new FormData();body.append('file',file);const r=await fetch(`${getApiBaseUrl()}/api/admin/content/workspace/${encodeURIComponent(id)}/files`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body});if(!r.ok)throw new Error('No se pudo subir el archivo (máximo 50 MB).');return r.json();},list:()=>request(),read:id=>request(`/${encodeURIComponent(id)}`),create:body=>request('','POST',body),update:(id,body)=>request(`/${encodeURIComponent(id)}`,'PATCH',body)};
}
