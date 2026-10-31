// These functions never create a checkout, confirm a payment or retry a charge.
export async function readPaymentConfirmation({fetchImpl=fetch,url,signal,maxAttempts=8,pauseMs=2000,requestTimeoutMs=5000,wait=abortableWait}) {
 for(let attempt=0;attempt<maxAttempts;attempt++){
  const {response,data}=await readOnce(fetchImpl,url,signal,requestTimeoutMs);
  if(!response.ok||data?.ok!==true)throw new Error('No se pudo consultar el estado del pago.');
  if(data.confirmed===true)return {confirmed:true,data};
  if(attempt+1<maxAttempts)await wait(pauseMs,signal);
 }
 return {confirmed:false};
}
function abortableWait(ms,signal){return new Promise((resolve,reject)=>{
 if(signal?.aborted){reject(Object.assign(new Error('Aborted'),{name:'AbortError'}));return;}
 const abort=()=>{clearTimeout(timer);reject(Object.assign(new Error('Aborted'),{name:'AbortError'}));};
 const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},ms);
 signal?.addEventListener('abort',abort,{once:true});
});}
export async function releasePendingReservation({fetchImpl=fetch,apiBase,pending,signal,requestTimeoutMs=5000}) {
 if(!pending?.release_token)throw new Error('No se puede liberar esta reserva desde aquí. Revisa su estado en Mis reservas.');
 const {response,data}=await readOnce(fetchImpl,`${apiBase}/api/reservas/liberar-slot-pendiente`,signal,requestTimeoutMs,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({release_token:pending.release_token})});
 if(!response.ok||data?.ok!==true||data.deleted!==1)throw new Error('No se confirmó la liberación. Conservamos la referencia de la reserva; revisa Mis reservas antes de intentar nuevamente.');
 return data;
}

async function readOnce(fetchImpl,url,signal,timeoutMs,init={}){
 const controller=new AbortController();let timer,rejectDeadline;
 const deadline=new Promise((_,reject)=>{rejectDeadline=reject;timer=setTimeout(()=>{controller.abort();reject(new Error('No pudimos comprobar el resultado a tiempo. Conserva la referencia y revisa Mis reservas.'));},timeoutMs);});
 const abort=()=>{controller.abort();rejectDeadline(Object.assign(new Error('Aborted'),{name:'AbortError'}));};
 signal?.addEventListener('abort',abort,{once:true});
 try{
  if(signal?.aborted){abort();return await deadline;}
  return await Promise.race([(async()=>{const response=await fetchImpl(url,{...init,signal:controller.signal});return {response,data:await response.json()};})(),deadline]);
 }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
