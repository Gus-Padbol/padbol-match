import React,{useEffect,useRef,useState} from 'react';
import './CommercialAgendaAlerts.css';

export function agendaItems(cases, now=Date.now()) {
  return (cases || []).filter(item=>item.progressState!=='cerrado' && item.nextContactAt && Number.isFinite(Date.parse(item.nextContactAt))).map(item=>{
    const at=Date.parse(item.nextContactAt);
    const due=(item.reminderHours || [24,8]).filter(hours=>now>=at-Number(hours)*3600000);
    return {...item,at,overdue:now>=at,reminder:due.length?Math.min(...due):null};
  }).sort((a,b)=>a.at-b.at);
}
export default function CommercialAgendaAlerts({api,onOpen}) {
  const [items,setItems]=useState([]),[error,setError]=useState(false),[now,setNow]=useState(Date.now());
  const panel=useRef(null);
  useEffect(()=>{
    let active=true;
    async function refresh(){try{const result=await api.listCases();if(active){setItems(result.cases || []);setError(false);setNow(Date.now());}}catch{if(active)setError(true);}}
    void refresh(); const timer=setInterval(refresh,60000);
    const onFocus=()=>void refresh(); window.addEventListener('focus',onFocus);window.addEventListener('commercial-agenda-updated',onFocus);
    return()=>{active=false;clearInterval(timer);window.removeEventListener('focus',onFocus);window.removeEventListener('commercial-agenda-updated',onFocus);};
  },[api]);
  const entries=agendaItems(items,now), due=entries.filter(item=>item.reminder!==null || item.overdue);
  return <details className="commercial-agenda" ref={panel}>
    <summary>Agenda {due.length>0&&<strong>{due.length} {due.length===1?'aviso':'avisos'}</strong>}</summary>
    <div className="commercial-agenda-panel"><h3>Próximas charlas</h3><p>Fechas en tu hora local: {Intl.DateTimeFormat().resolvedOptions().timeZone}.</p>
      {error&&<p role="alert">No se pudo actualizar la agenda. Vuelve a abrir el CRM para comprobarla.</p>}
      {!entries.length&&!error&&<p>No tienes charlas programadas.</p>}
      <ul>{entries.map(item=>{const name=item.contact?.name || item.contact?.phone || item.contact?.email || 'este contacto';return <li key={`${item.channel}:${item.id}`} className={item.overdue?'is-overdue':item.reminder!==null?'is-due':''}>
        <strong>{item.overdue?`Charla pendiente con ${name}`:item.reminder!==null?`Prepárate para tu charla con ${name}`:`Charla con ${name}`}</strong>
        <time dateTime={item.nextContactAt}>{new Date(item.at).toLocaleString()}</time>
        {item.overdue?<p>Revisa lo ocurrido y registra el resultado o programa una nueva fecha.</p>:item.reminder!==null?<p>Aviso de {item.reminder} horas antes. Revisa el historial antes de hablar.</p>:<p>Avisos: {(item.reminderHours || [24,8]).join(' y ')} horas antes.</p>}
        {item.nextStep&&<p>{item.nextStep}</p>}
        <button type="button" onClick={()=>{onOpen(item);if(panel.current)panel.current.open=false;}}>Abrir ficha e historial</button>
      </li>;})}</ul>
    </div>
  </details>;
}
