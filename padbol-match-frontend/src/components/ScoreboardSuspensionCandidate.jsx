import React, { useEffect, useRef, useState } from 'react';
import { fetchScoreboardCourts, scoreboardSuspensionAction, reconcileScoreboardSuspension } from '../utils/scoreboardApi';
import {listSuspensionPending,suspensionStoragePrefix} from '../utils/scoreboardSuspensionPending';

// Experimental. An uncertain response is deliberately not retried or unlocked:
// a slow server may still commit after a read returns the old state.
export default function ScoreboardSuspensionCandidate({partido, pending, onPending, onConfirmed, refresh, disabled, allowSuspend = true}) {
  const [reason,setReason]=useState(''); const [court,setCourt]=useState(''); const [duration,setDuration]=useState(90);
  const [courts,setCourts]=useState([]); const [error,setError]=useState(''); const [notice,setNotice]=useState(''); const [busy,setBusy]=useState(false);
  const suspended=String(partido.estado||'').toLowerCase()==='suspendido';
  const prefix=suspensionStoragePrefix(partido.id);
  const [operations,setOperations]=useState(()=>{try{return listSuspensionPending(partido.id)}catch{return [{key:null,operation:null}]}});
  const syncPending=()=>{try{const entries=listSuspensionPending(partido.id);setOperations(entries);onPending(entries.length>0);return entries;}catch{setOperations([{key:null,operation:null}]);onPending(true);return null;}};
  const mounted=useRef(true);
  const submitInFlight=useRef(false);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[]);
  useEffect(()=>{const changed=event=>{if(event.key===null || event.key===prefix || event.key?.startsWith(`${prefix}:action:`))syncPending();};window.addEventListener('storage',changed);return()=>window.removeEventListener('storage',changed);},[prefix]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>{let active=true;if(suspended && !pending) fetchScoreboardCourts(partido.sede_id).then(rows=>{if(active)setCourts(rows.filter(row=>row.id && !['inactiva','inactivo','cerrada','mantenimiento'].includes(String(row.estado||'').toLowerCase())))}).catch(()=>{if(active)setError('No se pudieron consultar las canchas.');});return()=>{active=false}},[suspended,pending,partido.sede_id]);
  const send=async ({action,body},operationKey,reconcile=false)=>{
    if(submitInFlight.current || busy || (!reconcile && (disabled || (action === 'suspend' && !allowSuspend))))return;
    submitInFlight.current=true;onPending(true);setBusy(true);setError('');setNotice('');
    try{
      const data=reconcile ? await reconcileScoreboardSuspension(partido.id,action,body.action_id) : await scoreboardSuspensionAction(partido.id,action,body);
      const receipt=data?.transition_receipt;
      if(String(data?.id)!==String(partido.id)||receipt?.action_id!==body.action_id||receipt?.action!==action||!(reconcile?['applied','cancelled']:['applied','replayed']).includes(receipt?.status))throw new Error('Respuesta no confirmada');
      if(mounted.current){
        onConfirmed(data);
        if(reconcile)setNotice(receipt.status==='applied'?'La operación ya se había realizado.':'La operación pendiente quedó cancelada y no se ejecutará.');
        // Another tab may have replaced this reference while the request was in flight.
        // Never erase a different operation or unblock controls while it remains pending.
        const saved=JSON.parse(window.localStorage.getItem(operationKey) || 'null');
        if(saved?.action===action && saved?.body?.action_id===body.action_id){
          window.localStorage.removeItem(operationKey);
          const entries=syncPending();
          if(entries?.length)setError('Hay otra referencia pendiente. Revisa la operación antes de continuar.');
        } else {
          syncPending();onPending(true);setError('Hay otra referencia pendiente. Revisa la operación antes de continuar.');
        }
      }
    }catch{if(mounted.current)setError('No se pudo confirmar el resultado. Puedes intentar recuperar la misma operación.');}
    finally{submitInFlight.current=false;if(mounted.current)setBusy(false)}
  };
  const submit=()=>{
    if(submitInFlight.current||busy||disabled||pending||(typeof partido.updated_at!=='string' || !Number.isFinite(Date.parse(partido.updated_at))))return;
    if(!suspended&&!reason.trim()){setError('Indica el motivo de la suspensión.');return;}
    if(suspended&&(!court||!Number.isInteger(Number(duration))||Number(duration)<1||Number(duration)>720)){setError('Elige una cancha y duración válidas.');return;}
    if(!window.crypto?.randomUUID){setError('Este dispositivo no puede generar una referencia segura.');return;}
    const action=suspended?'resume':'suspend';
    const body={action_id:window.crypto.randomUUID(),...(suspended?{updated_at:partido.updated_at,court_id:Number(court),duration_minutes:Number(duration)}:{updated_at:partido.updated_at,reason:reason.trim()})};
    const operationKey=`${prefix}:action:${body.action_id}`;
    try{if(listSuspensionPending(partido.id).length){syncPending();setError('Hay una operación pendiente. Recupera su referencia antes de continuar.');return;}window.localStorage.setItem(operationKey,JSON.stringify({action,body}));setOperations(listSuspensionPending(partido.id));}catch{setError('No se pudo guardar la referencia de seguridad en este dispositivo.');return;}
    void send({action,body},operationKey);
  };
  const recover=(entry,reconcile=false)=>{
    try{const saved=JSON.parse(window.localStorage.getItem(entry.key));if(!saved?.body?.action_id||!['suspend','resume'].includes(saved.action))throw new Error('missing');void send(saved,entry.key,reconcile);}
    catch{setError('Falta la referencia original. Contacta a soporte para revisar la operación.');}
  };
  if(pending)return <section role="alert"><p>Hay una suspensión o reanudación sin confirmar. Puedes verificarla y cancelar su ejecución pendiente. Cuando esté habilitada, también puedes recuperar la operación original; si todavía no se realizó, se ejecutará ahora.</p>{notice&&<p>{notice}</p>}{error&&<p>{error}</p>}{operations.map((entry,index)=><React.Fragment key={entry.key||index}><button type="button" disabled={busy||disabled||!entry.key||(!allowSuspend && entry.operation?.action !== 'resume')} onClick={()=>recover(entry)}>{operations.length===1?'Recuperar operación':`Recuperar operación ${index+1}`}</button><button type="button" disabled={busy||!entry.key} onClick={()=>recover(entry,true)}>{operations.length===1?'Verificar y cancelar si sigue pendiente':`Verificar y cancelar operación ${index+1} si sigue pendiente`}</button></React.Fragment>)}<button type="button" onClick={()=>void refresh().catch(()=>setError('No se pudo consultar el estado.'))}>Consultar estado</button></section>;
  return <section aria-label="Suspensión del partido">
    {suspended?<><p>Partido suspendido. Al reanudar, el reloj permanece pausado hasta que lo inicies.</p><label>Cancha <select value={court} onChange={e=>setCourt(e.target.value)}><option value="">Elige una cancha</option>{courts.map(row=><option key={row.id} value={row.id}>{row.nombre||`Cancha ${row.orden||row.id}`}</option>)}</select></label><label>Duración estimada en minutos <input type="number" min="1" max="720" value={duration} onChange={e=>setDuration(e.target.value)}/></label></>:<label>Motivo de suspensión <input maxLength={500} value={reason} onChange={e=>setReason(e.target.value)}/></label>}
    {notice&&<p role="status">{notice}</p>}{error&&<p role="alert">{error}</p>}<button type="button" disabled={busy||disabled} onClick={()=>void submit()}>{busy?'Confirmando…':suspended?'Reanudar en esta cancha':'Suspender partido'}</button>
  </section>;
}
