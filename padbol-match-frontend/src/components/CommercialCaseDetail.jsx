import React, {useEffect, useState} from 'react';
import CommercialCallSummary from './CommercialCallSummary';

export default function CommercialCaseDetail({item, api}) {
  const [activities,setActivities]=useState([]);
  const [data,setData]=useState(null), [pendingCall,setPendingCall]=useState(null), [error,setError]=useState('');
  const [note,setNote]=useState(''), [noteBusy,setNoteBusy]=useState(false);
  const [nextStep,setNextStep]=useState(''), [state,setState]=useState('en_atencion'), [progressBusy,setProgressBusy]=useState(false);
  const [body,setBody]=useState(''), [busy,setBusy]=useState(false), [uncertain,setUncertain]=useState(false), [notice,setNotice]=useState('');
  async function load() {
    const [result, calls, activityData]=await Promise.all([api.readCase(item.id,item.channel),api.listCalls(item.id,item.channel),api.listActivities(item.id,item.channel)]);
    setActivities(activityData.activities || []);
    setData(result); setState(result.progressState || 'nuevo'); setNextStep(result.nextStep || ''); setPendingCall((calls.calls || []).find(c=>c.status==='pending') || null);
  }
  useEffect(()=>{let active=true; setData(null);setError('');setBody('');setUncertain(false);setNotice('');
    Promise.all([api.readCase(item.id,item.channel),api.listCalls(item.id,item.channel),api.listActivities(item.id,item.channel)]).then(([result,calls,activityData])=>{if(active){setActivities(activityData.activities || []);setData(result);setState(result.progressState || 'nuevo');setNextStep(result.nextStep || '');setPendingCall((calls.calls||[]).find(c=>c.status==='pending')||null);}}).catch(()=>{if(active)setError('No se pudo abrir la consulta.');});
    return ()=>{active=false};},[item.id,item.channel,api]);
  async function send(event){event.preventDefault();if(!body.trim()||busy||uncertain||(data?.status==='suspended'||data?.progressState==='cerrado'))return;
    if(!window.crypto?.randomUUID){setError('No se puede enviar desde este navegador.');return;}
    setBusy(true);setError('');setNotice('');
    try{const result=await api.reply(item.id,item.channel,body.trim(),window.crypto.randomUUID());
      if(result?.status==='sent') {setBody('');setNotice('Envío aceptado. La entrega aún debe confirmarse.');try { await load(); } catch { setError('El envío fue aceptado, pero no se pudo actualizar el historial.'); }}
      else {setUncertain(true);setError('No se pudo confirmar la entrega. Revisa el historial antes de volver a enviar.');}
    }catch{setUncertain(true);setError('No se pudo confirmar el envío. Revisa el historial antes de volver a enviar.');}finally{setBusy(false);}
  }
  async function addNote(e){e.preventDefault();if(!note.trim()||noteBusy||pendingCall)return;setNoteBusy(true);try{await api.addActivity(item.id,item.channel,note.trim());setNote('');await load();}catch{setError('No se pudo guardar la nota. Actualiza la consulta antes de intentar otra vez.');}finally{setNoteBusy(false);}}
  async function updateProgress(e){e.preventDefault();if(progressBusy||pendingCall||!Number.isSafeInteger(data?.version))return;setProgressBusy(true);setError('');try{await api.progress(item.id,item.channel,data.version,state,nextStep.trim());await load();setNotice('Seguimiento actualizado.');}catch{setError('No se pudo confirmar el cambio. Actualiza la consulta antes de volver a intentarlo.');}finally{setProgressBusy(false);}}
  async function download(eventId){try{const blob=await api.media(item.id,eventId);const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='archivo-recibido';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch{setError('No se pudo descargar el archivo.');}}
  if(error&&!data)return <p role="alert">{error}</p>;
  if(!data)return <p>Cargando consulta…</p>;
  return <section aria-label="Detalle de consulta comercial"><h3>{data.contact?.name || data.contact?.phone || data.contact?.email || 'Consulta'}</h3>
    <p>{data.contact?.phone && <>Teléfono: <a href={`tel:${data.contact.phone}`}>{data.contact.phone}</a> </>}{data.contact?.email && <>Correo: <a href={`mailto:${data.contact.email}`}>{data.contact.email}</a></>}</p><p>Puedes contactar a la persona desde tu dispositivo. Las conversaciones personales no aparecen automáticamente aquí; registra los detalles y el próximo paso.</p>
    {data.status==='suspended'&&<p role="status">Esta consulta está en revisión; no se puede responder por ahora.</p>}
    {data.subject&&<h4>{data.subject}</h4>}{data.body&&<p>{data.body}</p>}
    {(data.inbound||[]).map(m=><div key={m.id}><p>{m.body}</p>{m.hasMedia === true && <button type="button" onClick={()=>download(m.id)}>Descargar archivo</button>}</div>)}
    {(data.replies||[]).map(m=><p key={m.id}>Respuesta: {m.body} · {m.status}</p>)}
    {(data.activities||[]).map(a=><p key={a.id}>Nota: {a.summary || a.body || ''} {a.next_step ? `· Próximo paso: ${a.next_step}` : ''}</p>)}
    {activities.map(a=><p key={`commercial-${a.id}`}>Nota: {a.body}</p>)}
    <form onSubmit={addNote}><label>Nota y próximo paso <textarea value={note} maxLength={2000} onChange={e=>setNote(e.target.value)}/></label><button disabled={noteBusy || !!pendingCall || !note.trim()}>Guardar nota</button></form>
    <CommercialCallSummary key={`${item.channel}:${item.id}:${pendingCall?.id || 'new'}`} caseId={item.id} channel={item.channel} callId={pendingCall?.id} api={api} onSaved={()=>load().catch(()=>setError('No se pudo actualizar la consulta.'))}/>
    <form onSubmit={updateProgress}><h3>Estado y próximo paso</h3><label>Estado <select value={state} onChange={e=>setState(e.target.value)}><option value="nuevo">Nuevo</option><option value="en_atencion">En atención</option><option value="en_espera">En espera</option><option value="cerrado">Cerrado</option></select></label><label>Próximo paso <textarea maxLength={2000} value={nextStep} onChange={e=>setNextStep(e.target.value)}/></label><button disabled={progressBusy || !!pendingCall || !Number.isSafeInteger(data.version)}>Guardar estado</button><p>El estado en espera no envía mensajes automáticamente.</p></form>
    <form onSubmit={send}><label>Respuesta <textarea value={body} onChange={e=>setBody(e.target.value)} maxLength={4096}/></label><button disabled={busy||uncertain||data.status==='suspended'||data.progressState==='cerrado'||!body.trim()}>Enviar respuesta</button></form>
    {notice&&<p role="status">{notice}</p>}{error&&<p role="alert">{error}</p>}
  </section>;
}
