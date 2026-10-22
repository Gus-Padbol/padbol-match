import React, {useEffect,useState} from 'react';

const isValidVersion = value => typeof value === 'string' && /^[a-f0-9]{32}$/.test(value);

// The server exclusively authorizes the global administrator and classifies one event at a time.
export default function CommercialReview({api}) {
 const [items,setItems]=useState([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 async function refresh(){setLoading(true);setError('');try{const result=await api.list();setItems(result.items||[]);}catch{setItems([]);setError('No se pudieron cargar los mensajes para revisar.');throw new Error('REVIEW_REFRESH_FAILED');}finally{setLoading(false);}}
 useEffect(()=>{let active=true;api.list().then(r=>{if(active){setItems(r.items||[]);setLoading(false);}}).catch(()=>{if(active){setError('No se pudieron cargar los mensajes para revisar.');setLoading(false);}});return ()=>{active=false};},[api]);
 async function decide(item,decision){if(busy||loading||!isValidVersion(item.version))return;setBusy(true);setError('');setNotice('');try{const result=await api.decide(item.caseId,item.eventId,item.version,decision);if(result?.decision!==decision||!['open','suspended','closed'].includes(result?.status)||(decision==='other'&&result.status!==item.caseStatus))throw new Error('UNCONFIRMED_REVIEW');await refresh();setNotice(result.status==='open' ? 'Clasificación guardada. La consulta comercial quedó disponible.' : result.status==='closed' ? 'Clasificación guardada. La consulta permanece cerrada.' : 'Clasificación guardada. La conversación permanece en revisión.');}catch{setError('No se pudo confirmar la clasificación. Actualiza la lista antes de volver a intentarlo.');setItems([]);}finally{setBusy(false);}}
 return <section aria-label="Revisar mensajes sin clasificar"><h2>Mensajes pendientes de clasificación</h2><p>Revisa cada mensaje por separado. Las consultas comerciales se comparten solo con el equipo autorizado; las demás permanecen fuera de esa área.</p>
 <button type="button" disabled={busy||loading} onClick={()=>refresh().catch(()=>{})}>Actualizar lista</button>{loading&&<p>Cargando…</p>}{error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
 {!loading&&!error&&!items.length&&<p>No hay mensajes pendientes.</p>}
 {items.map(item=><article key={`${item.caseId}:${item.eventId}`}><p>{item.body || 'Mensaje sin texto'}</p>{item.receivedAt&&<p>Recibido: {item.receivedAt}</p>}<button type="button" disabled={busy||loading||!isValidVersion(item.version)||item.caseStatus!=='suspended'} onClick={()=>decide(item,'commercial')}>Es comercial</button><button type="button" disabled={busy||loading||!isValidVersion(item.version)||!['suspended','closed'].includes(item.caseStatus)} onClick={()=>decide(item,'other')}>Es de otra área</button></article>)}
 </section>;
}
