import React, {useCallback, useEffect, useState} from 'react';
import CrmReplyTextarea from './CrmReplyTextarea';
import CrmEmailHistory from './CrmEmailHistory';
import CommercialLeadManagement from './CommercialLeadManagement';

export default function CommercialCaseDetail({item, api}) {
  const [activities,setActivities]=useState([]);
  const [emailRevision,setEmailRevision]=useState(0);
  const loadEmailHistory=useCallback(id=>api.emailHistory(id,item.channel),[api,item.channel]);
  const [data,setData]=useState(null), [error,setError]=useState('');
  const [body,setBody]=useState(''), [busy,setBusy]=useState(false), [uncertain,setUncertain]=useState(false), [notice,setNotice]=useState('');
  async function load() {
    const [result, activityData]=await Promise.all([api.readCase(item.id,item.channel),api.listActivities(item.id,item.channel)]);
    setActivities(activityData.activities || []);
    setData(result);
  }
  useEffect(()=>{let active=true; setData(null);setError('');setBody('');setUncertain(false);setNotice('');
    Promise.all([api.readCase(item.id,item.channel),api.listActivities(item.id,item.channel)]).then(([result,activityData])=>{if(active){setActivities(activityData.activities || []);setData(result);}}).catch(()=>{if(active)setError('No se pudo abrir la consulta.');});
    return ()=>{active=false};},[item.id,item.channel,api]);
  async function send(event){event.preventDefault();if(!body.trim()||busy||uncertain||(data?.status==='suspended'||data?.progressState==='cerrado'))return;
    if(!window.crypto?.randomUUID){setError('No se puede enviar desde este navegador.');return;}
    setBusy(true);setError('');setNotice('');
    try{const result=await api.reply(item.id,item.channel,body.trim(),window.crypto.randomUUID());
      if(result?.status==='sent') {setEmailRevision(value=>value+1);setBody('');setNotice('Envío aceptado. La entrega aún debe confirmarse.');try { await load(); } catch { setError('El envío fue aceptado, pero no se pudo actualizar el historial.'); }}
      else {setUncertain(true);setError('No se pudo confirmar la entrega. Revisa el historial antes de volver a enviar.');}
    }catch{setUncertain(true);setError('No se pudo confirmar el envío. Revisa el historial antes de volver a enviar.');}finally{setBusy(false);}
  }
  async function download(eventId){try{const blob=await api.media(item.id,eventId);const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='archivo-recibido';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch{setError('No se pudo descargar el archivo.');}}
  if(error&&!data)return <p role="alert">{error}</p>;
  if(!data)return <p>Cargando consulta…</p>;
  return <section aria-label="Detalle de consulta comercial"><h3>{data.contact?.name || data.contact?.phone || data.contact?.email || 'Consulta'}</h3>
    <p>{data.contact?.phone && <>Teléfono: <a href={`tel:${data.contact.phone}`}>{data.contact.phone}</a> </>}{data.contact?.email && <>Correo: <a href={`mailto:${data.contact.email}`}>{data.contact.email}</a></>}</p><p>Puedes contactar a la persona desde tu dispositivo. Las conversaciones personales no aparecen automáticamente aquí; registra los detalles y el próximo paso.</p>
    {data.status==='suspended'&&<p role="status">Esta consulta está en revisión; no se puede responder por ahora.</p>}
    {data.subject&&<h4 translate="no" className="notranslate">{data.subject}</h4>}{data.body&&<p translate="no" className="notranslate" style={{whiteSpace:'pre-wrap'}}>{data.body}</p>}
    {(data.inbound||[]).map(m=><div key={m.id}><p translate="no" className="notranslate">{m.body}</p>{m.hasMedia === true && <button type="button" onClick={()=>download(m.id)}>Descargar archivo</button>}</div>)}
    {item.channel!=='whatsapp'&&<CrmEmailHistory key={item.id} recordId={item.id} loadHistory={loadEmailHistory} revision={emailRevision}/>}
    {(item.channel==='whatsapp'?(data.replies||[]):[]).map(m=><p translate="no" className="notranslate" key={m.id}>Respuesta: {m.body} · {m.status}</p>)}
    {(data.activities||[]).map(a=><p key={a.id}>Nota: {a.summary || a.body || ''} {a.next_step ? `· Próximo paso: ${a.next_step}` : ''}</p>)}
    {activities.map(a=><p key={`commercial-${a.id}`}>Nota: {a.body}</p>)}
    <CommercialLeadManagement key={`${item.channel}:${item.id}`} api={api} conversation={{id:item.conversationId || item.id,source_channel:item.channel==='whatsapp'?'whatsapp':'email'}} caseItem={item} showHistory={true} onUpdated={()=>load()}/>
    <form onSubmit={send}><label>Respuesta <CrmReplyTextarea aria-label="Respuesta" value={body} onChange={e=>setBody(e.target.value)} maxLength={4096}/></label><button disabled={busy||uncertain||data.status==='suspended'||data.progressState==='cerrado'||!body.trim()}>Enviar respuesta</button></form>
    {notice&&<p role="status">{notice}</p>}{error&&<p role="alert">{error}</p>}
  </section>;
}
