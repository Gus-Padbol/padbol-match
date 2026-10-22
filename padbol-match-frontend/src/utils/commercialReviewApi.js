import {getApiBaseUrl} from './apiPublicBaseUrl';
export function createCommercialReviewApi(token) {
 async function request(path, options={}) {
  const response=await fetch(`${getApiBaseUrl()}${path}`,{cache:'no-store',...options,headers:{Authorization:`Bearer ${token}`,...(options.body?{'Content-Type':'application/json'}:{})}});
  if (!response.ok) throw Object.assign(new Error('REVIEW_UNAVAILABLE'),{status:response.status});
  return response.json();
 }
 return {
  list:()=>request('/api/admin/crm/commercial-review'),
  decide:(caseId,eventId,version,decision)=>{
   if(!Number.isSafeInteger(version)||version<0||!['commercial','other'].includes(decision))return Promise.reject(new Error('INVALID_REVIEW'));
   return request(`/api/admin/crm/commercial-review/${encodeURIComponent(caseId)}/${encodeURIComponent(eventId)}`,{method:'POST',body:JSON.stringify({version,decision})});
  }
 };
}
