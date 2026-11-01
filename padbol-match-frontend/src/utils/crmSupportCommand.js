// Stores only a request identity and payload fingerprint, never the message body or token.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const rejectedBeforeCommit = new Set(['CRM_ACTIVITY_INVALID','CRM_SUPPORT_TRANSITION_INVALID','CRM_SUPPORT_REFERENCE_REQUIRED','CRM_ADMIN_FORBIDDEN','CRM_ADMIN_UNAUTHENTICATED']);
const sorted = value => Array.isArray(value) ? value.map(sorted) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, sorted(value[key])])) : value;
export async function runCrmSupportCommand({actorId,conversationId,action,payload,execute,storage=typeof window==='undefined'?null:window.sessionStorage,cryptoApi=typeof window==='undefined'?null:window.crypto}) {
  if (!actorId || !conversationId || !['assignment','activity'].includes(action) || !storage || !cryptoApi?.subtle || !cryptoApi?.getRandomValues) throw new Error('No se pudo conservar la referencia del seguimiento. No se envió ningún cambio.');
  const key = `padbol.crm.support.v1:${encodeURIComponent(actorId)}:${encodeURIComponent(conversationId.toLowerCase())}:${action}`;
  const digest = await cryptoApi.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(sorted(payload))));
  const fingerprint = Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
  let pending;
  try { pending = JSON.parse(storage.getItem(key) || 'null'); } catch { throw new Error('No se pudo leer la referencia pendiente. Revisá el seguimiento antes de continuar.'); }
  if (pending && (!UUID.test(pending.requestId || '') || pending.fingerprint !== fingerprint)) throw Object.assign(new Error('Hay un seguimiento pendiente de confirmar. Conservá su contenido y revisá el historial antes de cambiarlo.'),{code:'CRM_SUPPORT_PENDING_REVIEW'});
  if (!pending) {
    const bytes=cryptoApi.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
    const h=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
    pending={requestId:`${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`,fingerprint};
    try { storage.setItem(key,JSON.stringify(pending));if(storage.getItem(key)!==JSON.stringify(pending))throw new Error('not durable'); } catch { throw new Error('No se pudo conservar la referencia del seguimiento. No se envió ningún cambio.'); }
  }
  const clear = () => { try { if (JSON.parse(storage.getItem(key) || 'null')?.requestId === pending.requestId) storage.removeItem(key); } catch {} };
  try {
    const result=await execute(pending.requestId);
    if (!(action==='assignment' ? result?.ok===true&&UUID.test(result.activityId || '') : UUID.test(result?.id || ''))) throw Object.assign(new Error('No se confirmó el seguimiento. Se conserva la referencia para consultar o reintentar.'),{code:'CRM_SUPPORT_ACK_UNCONFIRMED'});
    clear();return result;
  } catch(error) { if(rejectedBeforeCommit.has(error?.code))clear();throw error; }
}
