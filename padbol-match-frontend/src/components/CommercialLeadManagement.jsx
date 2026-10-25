import React, {useEffect, useState} from 'react';
import './CommercialLeadManagement.css';
import CommercialDictation from './CommercialDictation';

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

export default function CommercialLeadManagement({api, conversation}) {
  const [data, setData] = useState(null), [role, setRole] = useState(null), [advisors, setAdvisors] = useState([]);
  const [calls, setCalls] = useState([]), [activities, setActivities] = useState([]);
  const [state, setState] = useState('nuevo'), [next, setNext] = useState(''), [advisor, setAdvisor] = useState('');
  const [summary, setSummary] = useState(''), [situation, setSituation] = useState(''), [details, setDetails] = useState('');
  const [dictating, setDictating] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const pending = calls.find(c => c.status === 'pending');
  async function refresh(item) {
    const [read, callData, activityData] = await Promise.all([api.readCase(item.id,item.channel),api.listCalls(item.id,item.channel),api.listActivities(item.id,item.channel)]);
    const current = {...read, channel:item.channel};
    setData(current); setState(read.progressState || 'nuevo'); setNext(read.nextStep || ''); setAdvisor(read.assignedAdvisor?.id || '');
    setCalls(callData.calls || []); setActivities(activityData.activities || []);
    return current;
  }
  useEffect(() => {
    let active = true;
    setData(null); setRole(null); setError(''); setNotice(''); setCalls([]); setActivities([]); setSummary(''); setSituation(''); setDetails('');
    (async () => {
      const permission = await api.getRole();
      if (!['manager','advisor'].includes(permission.role)) throw new Error('FORBIDDEN');
      const item = await resolveCommercialLead(api, conversation);
      const [read, callData, activityData, advisorData] = await Promise.all([
        api.readCase(item.id,item.channel), api.listCalls(item.id,item.channel), api.listActivities(item.id,item.channel),
        permission.role === 'manager' ? api.listAdvisors() : Promise.resolve({advisors:[]}),
      ]);
      if (!active) return;
      setRole(permission.role); setData({...read,channel:item.channel}); setState(read.progressState || 'nuevo'); setNext(read.nextStep || '');
      setAdvisor(read.assignedAdvisor?.id || ''); setAdvisors(advisorData.advisors || []); setCalls(callData.calls || []); setActivities(activityData.activities || []);
    })().catch(() => { if(active) setError('No se pudo cargar la gestión de esta consulta. Actualiza la ficha para volver a intentarlo.'); });
    return () => {active=false;};
  }, [api, conversation.id, conversation.source_channel]);
  async function saveAssignment(event) {
    event.preventDefault(); if(busy || !data || !advisor || !Number.isSafeInteger(data.version)) return;
    setBusy(true); setError(''); setNotice('');
    try {await api.assign(data.channel,data.id,advisor,data.version); await refresh(data); setNotice('Asesor asignado.');}
    catch {setError('No se pudo confirmar la asignación. Actualiza la ficha antes de volver a intentarlo.');}
    finally {setBusy(false);}
  }
  async function save(event) {
    event.preventDefault(); if(busy || dictating || !data || !Number.isSafeInteger(data.version)) return;
    const needsSummary = !!pending || state !== 'nuevo' || [summary,situation,details].some(v=>v.trim());
    if(needsSummary && [summary,situation,details].some(v=>v.trim().length<3)) return;
    if(state !== 'nuevo' && next.trim().length<3) return;
    setBusy(true); setError(''); setNotice('');
    try {
      if(needsSummary) {
        // Opening first makes the server block any progress until the summary is committed.
        let call = pending;
        if(!call) {call=await api.startCall(data.id,data.channel); if(!call?.id) throw new Error('CALL_NOT_CONFIRMED'); setCalls(current=>[call,...current]);}
        await api.completeCall(data.id,call.id,{channel:data.channel,situation:situation.trim(),discussed:summary.trim(),distinguishing:details.trim()});
      }
      const current = await api.readCase(data.id,data.channel);
      await api.progress(data.id,data.channel,current.version,state,next.trim());
      await refresh(data); setSummary(''); setSituation(''); setDetails(''); setNotice('Atención registrada. Estado y próximo paso actualizados.');
    } catch {setError('No se pudo confirmar el registro completo. Actualiza la ficha y revisa el historial antes de volver a guardar.');}
    finally {setBusy(false);}
  }
  if(!data) return <section className="commercial-lead-management" aria-label="Gestión comercial"><h3>Gestión comercial</h3>{error?<p role="alert">{error}</p>:<p>Cargando gestión comercial…</p>}</section>;
  const needsSummary = !!pending || state !== 'nuevo' || [summary,situation,details].some(v=>v.trim());
  const validSummary = [summary,situation,details].every(v=>v.trim().length>=3);
  return <section className="commercial-lead-management" aria-label="Gestión comercial">
    <h3>Gestión comercial</h3>
    <p>Asesor: <strong>{data.assignedAdvisor?.name || 'Sin asignar'}</strong></p>
    {role==='manager' && <form onSubmit={saveAssignment}><label>Asignar asesor<select value={advisor} onChange={e=>setAdvisor(e.target.value)}><option value="">Selecciona un asesor</option>{advisors.filter(a=>a.active).map(a=><option key={a.id} value={a.id}>{a.name || a.email}</option>)}</select></label><button disabled={busy || !advisor || advisor===data.assignedAdvisor?.id || !Number.isSafeInteger(data.version)}>Guardar asignación</button></form>}
    {pending && <p role="status">Hay una atención pendiente de resumen. Complétala para avanzar.</p>}
    <form onSubmit={save}>
      <label>Estado comercial<select value={state} onChange={e=>setState(e.target.value)}><option value="nuevo">Nuevo</option><option value="en_atencion">En atención</option><option value="en_espera">En espera del cliente</option><option value="cerrado">Cerrado</option></select></label>
      <CommercialDictation onListeningChange={setDictating} onText={text=>setSummary(current=>[current.trim(),text].filter(Boolean).join(' ').slice(0,2000))}/>
      <label>Qué se habló<textarea maxLength={2000} value={summary} onChange={e=>setSummary(e.target.value)} required={needsSummary} placeholder="Resume la conversación con el cliente."/></label>
      <label>Situación actual<textarea maxLength={2000} value={situation} onChange={e=>setSituation(e.target.value)} required={needsSummary} placeholder="Qué decidió o qué está evaluando."/></label>
      <label>Detalles importantes<textarea maxLength={2000} value={details} onChange={e=>setDetails(e.target.value)} required={needsSummary} placeholder="Acuerdos, dudas o particularidades. Si no hay, indícalo."/></label>
      <label>Próximo paso<textarea maxLength={2000} value={next} onChange={e=>setNext(e.target.value)} required={state!=='nuevo'} placeholder="Qué se hará y cuándo; si cierras, indica el resultado."/></label>
      <p>Para avanzar o cerrar, registra la conversación y el próximo paso. Las llamadas desde tu teléfono se resumen aquí.</p>
      <button disabled={busy || dictating || !Number.isSafeInteger(data.version) || (needsSummary&&!validSummary) || (state!=='nuevo'&&next.trim().length<3)}>{busy?'Guardando…':'Guardar atención y próximo paso'}</button>
    </form>
    {(calls.some(c=>c.status==='completed') || activities.length>0) && <details><summary>Historial de atención</summary>{calls.filter(c=>c.status==='completed').map(c=><article key={c.id}><p><strong>Qué se habló:</strong> {c.discussed}</p><p><strong>Situación:</strong> {c.situation}</p><p><strong>Detalles:</strong> {c.distinguishing}</p></article>)}{activities.map(a=><p key={a.id}>{a.body}</p>)}</details>}
    {notice&&<p role="status">{notice}</p>}{error&&<p role="alert">{error}</p>}
  </section>;
}
