import React,{useEffect,useState} from 'react';
import './CrmEmailHistory.css';
const statuses={sent:'Aceptado por el servicio de correo',pending:'Pendiente de confirmación',cancelled:'Envío cancelado'};
const date=value=>Number.isFinite(Date.parse(value))?new Date(value).toLocaleString('es'):'Fecha no informada';
export default function CrmEmailHistory({recordId,loadHistory,revision=0,initialBody,initialMessage}){
 const [snapshot,setSnapshot]=useState(null),[refresh,setRefresh]=useState(0);
 useEffect(()=>{
  if(!recordId)return undefined;
  let active=true,pending=false;
  const read=async(initial=false)=>{
   if(pending||(!initial&&document.visibilityState==='hidden'))return;
   pending=true;
   if(initial)setSnapshot({recordId,loader:loadHistory,loading:true,data:null,error:false});
   try{if(typeof loadHistory!=='function')throw Error('HISTORY_UNAVAILABLE');const data=await loadHistory(recordId);if(active)setSnapshot({recordId,loader:loadHistory,loading:false,data:{messages:Array.isArray(data?.messages)?data.messages:[],truncated:data?.truncated===true},error:false});}
   catch{if(active)setSnapshot({recordId,loader:loadHistory,loading:false,data:null,error:true});}
   finally{pending=false;}
  };
  void read(true);
  const timer=window.setInterval(()=>void read(),60000),focus=()=>void read();
  window.addEventListener('focus',focus);
  return()=>{active=false;window.clearInterval(timer);window.removeEventListener('focus',focus)};
 },[recordId,loadHistory,revision,refresh]);
 const current=snapshot?.recordId===recordId&&snapshot?.loader===loadHistory;
 const state=current?snapshot:{loading:true,data:null,error:false};
 const normalize=value=>String(value||'').replace(/\r\n/g,'\n').trim();
 const originals=[initialBody,initialMessage].map(normalize).filter(Boolean);
 // Hide only the initial inbound copy already displayed in the lead card.
 // Later messages, including repeated customer wording, remain in the thread.
 const visibleMessages=(state.data?.messages||[]).filter((message,index)=>{
  if(index!==0||message.direction!=='inbound'||state.data?.truncated)return true;
  return !originals.includes(normalize(message.body));
 });
 return <section className="crm-email-history" aria-label="Conversación por correo"><header><div><h3>Conversación</h3></div><button type="button" disabled={state.loading} onClick={()=>setRefresh(value=>value+1)}>Actualizar correos</button></header>
 {state.loading&&<p role="status">Cargando la correspondencia…</p>}
 {state.error&&<p role="status" className="crm-email-history__notice">No se pudo consultar la correspondencia. Actualiza los correos para volver a intentarlo.</p>}
 {state.data&&<>{visibleMessages.length===0?<p>{originals.length ? 'Todavía no hay respuestas a esta consulta.' : 'Todavía no hay correspondencia registrada en esta consulta.'}</p>:<div className="crm-email-history__messages">{visibleMessages.map(message=><article key={`${message.direction}:${message.id}`} className={`crm-email-history__message crm-email-history__message--${message.direction==='outbound'?'outbound':'inbound'}`}><header><strong>{message.direction==='outbound'?'Respuesta del equipo':'Correo recibido'}</strong><time dateTime={message.at||undefined}>{date(message.at)}</time></header>{message.subject&&<h4 translate="no" className="notranslate">{message.subject}</h4>}<p translate="no" className="notranslate crm-email-history__body">{message.body||'Sin contenido de texto.'}</p>{message.direction==='outbound'&&<small>{statuses[message.status]||'Estado de envío no disponible'}</small>}</article>)}</div>}
 {state.data.truncated&&<p role="status" className="crm-email-history__notice">Se muestra una parte del historial. Hay mensajes anteriores conservados en el sistema.</p>}
 </>}
 </section>;
}
