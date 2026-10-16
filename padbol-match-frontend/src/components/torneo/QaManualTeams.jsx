import React,{useCallback,useEffect,useRef,useState} from 'react';
import {readQaTeamEntry,saveQaTeamEntry} from '../../utils/qaManualTeamsApi';
export default function QaManualTeams({apiBaseUrl,torneoId,onSaved}){
 const [catalog,setCatalog]=useState(null),[error,setError]=useState(''),[name,setName]=useState(''),[selected,setSelected]=useState([]),[confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const request=useRef(null),pending=useRef(false),generation=useRef(0);
 const refresh=useCallback(async()=>{const mine=++generation.current;try{const data=await readQaTeamEntry(apiBaseUrl,torneoId);if(mine===generation.current)setCatalog(data);}catch(e){if(mine!==generation.current)return;if([401,403,404].includes(e.status))setCatalog(null);else setError(e.message);}},[apiBaseUrl,torneoId]);
 useEffect(()=>{setCatalog(null);setError('');setName('');setSelected([]);setConfirm(false);setMessage('');setBusy(false);pending.current=false;request.current=null;void refresh();return()=>{generation.current+=1;};},[refresh]);
 function change(ids){setSelected(ids);setConfirm(false);request.current=null;setMessage('');}
 async function save(){if(pending.current)return;pending.current=true;const mine=generation.current;setBusy(true);setError('');try{
  if(!request.current)request.current={nombre:name.trim(),user_ids:selected,request_id:crypto.randomUUID()};
  const payload=request.current;const saved=await saveQaTeamEntry(apiBaseUrl,torneoId,payload);
  if(mine!==generation.current)return;
  const fresh=await readQaTeamEntry(apiBaseUrl,torneoId);
  if(mine!==generation.current)return;
  if(!selected.every(id=>fresh.players.some(p=>p.user_id===id&&p.inscrito)))throw new Error('El guardado no se confirmó al volver a consultar. Recarga antes de repetir.');
  setCatalog(fresh);setName('');setSelected([]);setConfirm(false);request.current=null;setMessage('Dupla guardada y comprobada al volver a consultar.');onSaved?.(saved.equipo.id);
 }catch(e){if(mine===generation.current)setError(e.message);}finally{if(mine===generation.current){pending.current=false;setBusy(false);}}}
 if(!catalog)return error?<p role="alert">{error}</p>:null;
 return <section aria-label="Carga manual de jugadores QA" style={{padding:18,marginBottom:18,border:'1px solid #64748b',borderRadius:12}}>
  <h2>Carga manual de jugadores QA</h2><p>Selecciona dos jugadores ficticios para formar una dupla. Esta carga sólo corresponde a este torneo de prueba.</p>
  {!catalog.can_write?<p>Inscripción cerrada o fixture generado. No se pueden agregar duplas.</p>:<>
   <label htmlFor="qa-team-name">Nombre de la dupla</label><input id="qa-team-name" value={name} maxLength={80} onChange={e=>{setName(e.target.value);setConfirm(false);request.current=null;}} disabled={busy}/>
   <fieldset disabled={busy}><legend>Elige exactamente dos jugadores QA</legend>{catalog.players.map(p=><label key={p.user_id} style={{display:'block',padding:8}}><input type="checkbox" disabled={p.inscrito||(!selected.includes(p.user_id)&&selected.length===2)} checked={selected.includes(p.user_id)} onChange={()=>change(selected.includes(p.user_id)?selected.filter(id=>id!==p.user_id):[...selected,p.user_id])}/>{p.nombre} {p.apellido}{p.inscrito?' — ya inscrito':''}</label>)}</fieldset>
   {!catalog.players.length?<p>Todavía no hay jugadores QA disponibles para este torneo.</p>:null}
   {confirm?<div role="group" aria-label="Confirmar dupla QA"><p>Se inscribirán únicamente los dos jugadores seleccionados, sin cobro.</p><button type="button" onClick={save} disabled={busy}>Confirmar y guardar dupla</button><button type="button" onClick={()=>setConfirm(false)} disabled={busy}>Volver a elegir</button></div>:<button type="button" disabled={busy||selected.length!==2||!name.trim()} onClick={()=>setConfirm(true)}>Revisar dupla</button>}
  </>}
  {error?<p role="alert">{error}</p>:null}{message?<p role="status">{message}</p>:null}
 </section>;
}
