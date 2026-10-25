import React, {useEffect, useState} from 'react';
import './CommercialLeadManagement.css';
import CommercialDictation from './CommercialDictation';
import CommercialFollowupActivation from './CommercialFollowupActivation';

export function toLocalDateTime(value) {
  if (!value || !Number.isFinite(new Date(value).getTime())) return '';
  const date = new Date(value);
  return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);
}
export function parseReminderHours(value) {
  const parts=String(value).split(',').map(v=>v.trim());
  if(!parts.length || parts.length>5 || parts.some(v=>!/^\d+$/.test(v) || Number(v)<1 || Number(v)>720)) return null;
  return [...new Set(parts.map(Number))].sort((a,b)=>b-a);
}
const STATE_LABELS = {nuevo:'Nuevo',en_atencion:'En atención',en_espera:'En espera / seguimiento',cerrado:'Cerrado'};

// Match server identifiers only. Contact names, phone numbers and tickets cannot grant case access.
export async function resolveCommercialLead(api, conversation) {
  if (api.resolveConversation) return api.resolveConversation(conversation.id);
  if (conversation.source_channel !== 'whatsapp') {
    const item = await api.readCase(conversation.id, 'form');
    return {...item, channel: 'form'};
  }
  const result = await api.listCases();
  const item = (result.cases || []).find(c => c.channel === 'whatsapp' && c.conversationId === conversation.id);
  if (!item) throw new Error('CASE_NOT_LINKED');
  return item;
}

export default function CommercialLeadManagement({api, conversation, onUpdated, showHistory=false, caseItem}) {
  const [data, setData] = useState(null), [role, setRole] = useState(null), [advisors, setAdvisors] = useState([]);
  const [calls, setCalls] = useState([]), [activities, setActivities] = useState([]);
  const [state, setState] = useState('nuevo'), [next, setNext] = useState(''), [advisor, setAdvisor] = useState('');
  const [summary, setSummary] = useState(''), [details, setDetails] = useState('');
  const [dictating, setDictating] = useState(false);
  const [nextContact, setNextContact] = useState(''), [reminders, setReminders] = useState('24, 8');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const pending = calls.find(c => c.status === 'pending');
  async function refresh(item) {
    const [read, callData, activityData] = await Promise.all([api.readCase(item.id,item.channel),api.listCalls(item.id,item.channel),api.listActivities(item.id,item.channel)]);
    const current = {...read, channel:item.channel};
    setData(current); setState(read.progressState || 'nuevo'); setNext(read.nextStep || ''); setAdvisor(read.assignedAdvisor?.id || ''); setNextContact(toLocalDateTime(read.nextContactAt)); setReminders((read.reminderHours || [24,8]).join(', '));
    setCalls(callData.calls || []); setActivities(activityData.activities || []);
    return current;
  }
  useEffect(() => {
    let active = true;
    setData(null); setRole(null); setError(''); setNotice(''); setCalls([]); setActivities([]); setSummary(''); setDetails('');
    (async () => {
      const permission = await api.getRole();
      if (!['manager','advisor'].includes(permission.role)) throw new Error('FORBIDDEN');
      const item = caseItem?.id && caseItem?.channel ? {id:caseItem.id,channel:caseItem.channel} : await resolveCommercialLead(api, {id: conversation.id, source_channel: conversation.source_channel});
      const [read, callData, activityData, advisorData] = await Promise.all([
        api.readCase(item.id,item.channel), api.listCalls(item.id,item.channel), api.listActivities(item.id,item.channel),
        permission.role === 'manager' ? api.listAdvisors() : Promise.resolve({advisors:[]}),
      ]);
      if (!active) return;
      setRole(permission.role); setData({...read,channel:item.channel}); setState(read.progressState || 'nuevo'); setNext(read.nextStep || '');
      setAdvisor(read.assignedAdvisor?.id || ''); setNextContact(toLocalDateTime(read.nextContactAt)); setReminders((read.reminderHours || [24,8]).join(', ')); setAdvisors(advisorData.advisors || []); setCalls(callData.calls || []); setActivities(activityData.activities || []);
    })().catch(() => { if(active) setError('No se pudo cargar la gestión de esta consulta. Actualiza la ficha para volver a intentarlo.'); });
    return () => {active=false;};
  }, [api, conversation.id, conversation.source_channel, caseItem?.id, caseItem?.channel]);
  async function saveAssignment(event) {
    event.preventDefault(); if(busy || !data || !advisor || !Number.isSafeInteger(data.version)) return;
    setBusy(true); setError(''); setNotice('');
    try {await api.assign(data.channel,data.id,advisor,data.version); await refresh(data); await onUpdated?.(); window.dispatchEvent(new Event('commercial-agenda-updated')); setNotice('Asesor asignado.');}
    catch {setError('No se pudo confirmar la asignación. Actualiza la ficha antes de volver a intentarlo.');}
    finally {setBusy(false);}
  }
  async function save(event) {
    event.preventDefault(); if(busy || dictating || !data || !Number.isSafeInteger(data.version)) return;
    if(summary.trim().length<3 || next.trim().length<3 || (details.trim() && details.trim().length<3)) return;
    const date = state==='cerrado' || !nextContact ? null : new Date(nextContact);
    const hours = parseReminderHours(reminders);
    if(date && (!Number.isFinite(date.getTime()) || date.getTime()<=Date.now())) {setError('Elige una fecha y hora futuras para la próxima charla.');return;}
    if(date && !hours) {setError('Indica las horas de aviso, separadas por comas. Ej.: 24, 8.');return;}
    setBusy(true); setError(''); setNotice('');
    try {
      // Opening first makes the server block any progress until the summary is committed.
        let call = pending;
        if(!call) {call=await api.startCall(data.id,data.channel); if(!call?.id) throw new Error('CALL_NOT_CONFIRMED'); setCalls(current=>[call,...current]);}
        await api.completeCall(data.id,call.id,{channel:data.channel,situation:`Estado seleccionado: ${STATE_LABELS[state]}`,discussed:summary.trim(),distinguishing:details.trim() || 'No se agregaron detalles adicionales.'});
      const current = await api.readCase(data.id,data.channel);
      await api.progress(data.id,data.channel,current.version,state,next.trim(),date?.toISOString() || null,hours || [24,8]);
      await refresh(data); await onUpdated?.(); window.dispatchEvent(new Event('commercial-agenda-updated')); setSummary(''); setDetails(''); setNotice('Atención registrada. Estado y próximo paso actualizados.');
    } catch {setError('No se pudo confirmar el registro completo. Actualiza la ficha y revisa el historial antes de volver a guardar.');}
    finally {setBusy(false);}
  }
  if(!data) return <section className="commercial-lead-management" aria-label="Gestión comercial"><h3>Gestión comercial</h3>{error?<p role="alert">{error}</p>:<p>Cargando gestión comercial…</p>}</section>;
  const validSummary = summary.trim().length>=3 && (!details.trim() || details.trim().length>=3);
  return <section className="commercial-lead-management" aria-label="Gestión comercial">
    <h3>Gestión comercial</h3>
    <p>Asesor: <strong>{data.assignedAdvisor?.name || 'Sin asignar'}</strong></p>
    {role==='manager' && <details className="commercial-advisor-change"><summary>Cambiar asesor</summary><form onSubmit={saveAssignment}><label>Asignar asesor<select value={advisor} onChange={e=>setAdvisor(e.target.value)}><option value="">Selecciona un asesor</option>{advisors.filter(a=>a.active).map(a=><option key={a.id} value={a.id}>{a.name || a.email}</option>)}</select></label><button disabled={busy || !advisor || advisor===data.assignedAdvisor?.id || !Number.isSafeInteger(data.version)}>Guardar asignación</button></form></details>}
    {pending && <p role="status">Hay una atención pendiente de resumen. Complétala para avanzar.</p>}
    <form onSubmit={save}>
      <label>Resumen de la conversación<textarea maxLength={2000} value={summary} onChange={e=>setSummary(e.target.value)} required placeholder="Qué hablaron, qué decidió el cliente y los acuerdos importantes."/></label>
      <CommercialDictation onListeningChange={setDictating} onText={text=>setSummary(current=>[current.trim(),text].filter(Boolean).join(' ').slice(0,2000))}/>
      <label>Estado comercial<select value={state} onChange={e=>setState(e.target.value)}>{Object.entries(STATE_LABELS).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
      <label>{state==='cerrado'?'Resultado del cierre':'Próximo paso'}<textarea maxLength={2000} value={next} onChange={e=>setNext(e.target.value)} required placeholder={state==='cerrado'?'Cómo terminó la consulta.':'Qué vas a hacer y cuándo. Ej.: llamar el martes a las 15 h.'}/></label>
      {state!=='cerrado' && <div className="commercial-next-chat"><label>Próxima charla (opcional)<input type="datetime-local" value={nextContact} onChange={e=>setNextContact(e.target.value)}/></label><small>Hora local: {Intl.DateTimeFormat().resolvedOptions().timeZone}</small>{nextContact && <label>Avisarme estas horas antes<input aria-label="Avisarme estas horas antes" value={reminders} onChange={e=>setReminders(e.target.value)} placeholder="24, 8"/><small>Por defecto: 24 y 8 horas antes. Puedes cambiarlo, por ejemplo a 48, 24, 1.</small></label>}</div>}
      <details><summary>Agregar detalles adicionales (opcional)</summary><label>Detalles adicionales<textarea maxLength={2000} value={details} onChange={e=>setDetails(e.target.value)} placeholder="Solo si necesitas ampliar el resumen."/></label></details>
      <button disabled={busy || dictating || !Number.isSafeInteger(data.version) || !validSummary || next.trim().length<3}>{busy?'Guardando…':'Guardar gestión'}</button>
    </form>
    {state==='en_espera' && data.progressState!=='en_espera' && <p>Guarda el resumen y el próximo paso para habilitar el seguimiento por WhatsApp.</p>}
    {data.progressState==='en_espera' && state==='en_espera' && !pending && <CommercialFollowupActivation caseId={data.id} channel={data.channel} api={api} active={data.followup?.status==='waiting'} onChanged={()=>refresh(data).then(()=>onUpdated?.()).catch(()=>setError('No se pudo actualizar el seguimiento. Actualiza la ficha.'))}/>}
    {data.nextContactAt && <p className="commercial-scheduled">Próxima charla guardada: <strong>{new Date(data.nextContactAt).toLocaleString()}</strong></p>}
    {(calls.some(c=>c.status==='completed') || activities.length>0) && <details open={showHistory || undefined}><summary>Historial de atención</summary>{calls.filter(c=>c.status==='completed').map(c=><article key={c.id}><p><strong>Qué se habló:</strong> {c.discussed}</p><p><strong>Situación:</strong> {c.situation}</p><p><strong>Detalles:</strong> {c.distinguishing}</p></article>)}{activities.map(a=><p key={a.id}>{a.body}</p>)}</details>}
    {notice&&<p role="status">{notice}</p>}{error&&<p role="alert">{error}</p>}
  </section>;
}
