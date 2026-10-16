import React,{useEffect,useRef,useState} from 'react';

export default function TournamentFixturePlanner({torneo,equipos,apiBaseUrl,accessToken,onSaved}) {
 const [mode,setMode]=useState('automatico'),[pairs,setPairs]=useState({}),[review,setReview]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');const pending=useRef(false),generation=useRef(0);
 useEffect(()=>{const mine=++generation.current;setPairs({});setReview(false);setError('');setBusy(false);pending.current=false;return()=>{generation.current=mine+1;};},[torneo.id,accessToken]);
 const teams=(equipos||[]).filter(e=>['confirmado','confirmada'].includes(e.inscripcion_estado));
 const pairings=Array.from({length:Math.floor(teams.length/2)},(_,i)=>({equipo_a_id:Number(pairs[`${i}a`]),equipo_b_id:Number(pairs[`${i}b`])}));
 const ids=pairings.flatMap(p=>[p.equipo_a_id,p.equipo_b_id]);
 const validManual=[4,8,16].includes(teams.length)&&new Set(ids).size===teams.length&&ids.every(id=>teams.some(e=>Number(e.id)===id));
 const valid=teams.length===(equipos||[]).length&&teams.length>=2&&(torneo.tipo_torneo!=='knockout'||[4,8,16].includes(teams.length))&&(mode!=='manual'||validManual);
 const choose=(key,value)=>{setPairs(p=>({...p,[key]:value}));setReview(false);setError('');};
 async function save(){if(pending.current||!valid)return;pending.current=true;setBusy(true);setError('');const mine=generation.current;try{
  const response=await fetch(`${apiBaseUrl}/api/torneos/${torneo.id}/planificar-fixture`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${accessToken}`},body:JSON.stringify({origen:mode,...(mode==='manual'?{cruces:pairings}:{})})});
  const data=await response.json();if(!response.ok||data.ok!==true||!Array.isArray(data.partidos))throw new Error(data.error||'No se pudo comprobar el fixture.');
  if(mine!==generation.current)return;setReview(false);await onSaved?.(data);
 }catch(e){if(mine===generation.current)setError(e.message);}finally{if(mine===generation.current){pending.current=false;setBusy(false);}}}
 return <section className="tournament-planner" aria-label="Planificar fixture"><h3>Preparar y revisar fixture</h3><p>Guardar los cruces no inicia el torneo. Después podrás revisarlos e iniciar el torneo con una acción separada.</p>
 <label>Origen del sorteo<select value={mode} disabled={busy} onChange={e=>{setMode(e.target.value);setReview(false);}}><option value="automatico">Generar en la aplicación</option>{torneo.tipo_torneo==='knockout'?<option value="manual">Ya hice el sorteo: cargar cruces</option>:null}</select></label>
 {torneo.tipo_torneo==='knockout'?<p>Eliminación directa con 4, 8 o 16 equipos confirmados, sin libres. Cada equipo debe aparecer una sola vez.</p>:null}
 {mode==='manual'?pairings.map((_,i)=><fieldset key={i} disabled={busy}><legend>Cruce {i+1}</legend>{['a','b'].map(side=><label key={side}>Equipo {side.toUpperCase()}<select aria-label={`Cruce ${i+1} equipo ${side.toUpperCase()}`} value={pairs[`${i}${side}`]||''} onChange={e=>choose(`${i}${side}`,e.target.value)}><option value="">Seleccionar equipo</option>{teams.map(e=><option key={e.id} value={e.id}>{e.nombre}</option>)}</select></label>)}</fieldset>):null}
 {!valid?<p role="status">Confirma todos los equipos y completa los cruces sin duplicados ni omisiones para continuar.</p>:null}
 {review?<div role="group" aria-label="Confirmar fixture"><p>Se guardará el cuadro {mode==='manual'?'del sorteo externo':'generado por la aplicación'}; el torneo seguirá abierto. No se reemplazarán partidos existentes.</p>{mode==='manual'?<ol>{pairings.map((p,i)=><li key={i}>{teams.find(e=>Number(e.id)===p.equipo_a_id)?.nombre} contra {teams.find(e=>Number(e.id)===p.equipo_b_id)?.nombre}</li>)}</ol>:null}<button type="button" disabled={busy} onClick={save}>{busy?'Guardando…':'Confirmar y guardar fixture'}</button><button type="button" disabled={busy} onClick={()=>setReview(false)}>Volver a revisar</button></div>:<button type="button" disabled={!valid||busy} onClick={()=>setReview(true)}>Revisar fixture antes de guardar</button>}
 {error?<p role="alert">{error}</p>:null}</section>;
}
