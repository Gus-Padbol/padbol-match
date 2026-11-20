import React,{useEffect,useState} from 'react';
import {fetchScoreboardCourts,createPartido} from '../../utils/scoreboardApi';
import '../../pages/NationsOperator.css';

const SEDE_ID=9;
const emptyPlayers=()=>['','','',''];
export default function NationsContingencyScoreboard(){
 const [courts,setCourts]=useState([]),[court,setCourt]=useState(''),[teamA,setTeamA]=useState(''),[teamB,setTeamB]=useState(''),[playersA,setPlayersA]=useState(emptyPlayers),[playersB,setPlayersB]=useState(emptyPlayers),[busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState(null);
 useEffect(()=>{let active=true;fetchScoreboardCourts(SEDE_ID).then(rows=>{if(active)setCourts(Array.isArray(rows)?rows:[]);}).catch(e=>{if(active)setError(e.message||'No se pudieron cargar las canchas.');});return()=>{active=false;};},[]);
 const changePlayer=(setter,index,value)=>setter(list=>list.map((item,i)=>i===index?value:item));
 const create=async()=>{if(busy)return;setError('');setResult(null);const namesA=playersA.map(n=>n.trim()).filter(Boolean),namesB=playersB.map(n=>n.trim()).filter(Boolean);if(!court||!teamA.trim()||!teamB.trim()||namesA.length<2||namesB.length<2){setError('Completá cancha, dos equipos y al menos dos jugadores por equipo.');return;}setBusy(true);try{
  const partido=await createPartido({sede_id:SEDE_ID,cancha:String(court),equipo_a_nombre:teamA.trim(),equipo_b_nombre:teamB.trim(),equipo_a_jugadores:namesA.map(nombre=>({nombre})),equipo_b_jugadores:namesB.map(nombre=>({nombre}))});
  if(partido?.id==null)throw new Error('El marcador no fue confirmado.');
  // Authenticated control link only; never mint a legacy contingency token.
  setResult({id:String(partido.id),controlPath:`/admin/scoreboard/${encodeURIComponent(String(partido.id))}`,publicPath:`/display/${SEDE_ID}/scoreboard/${encodeURIComponent(String(partido.id))}`});
 }catch(e){setError(e.message||'No se pudo crear el marcador.');}finally{setBusy(false);}};
 return <details className="nations-operator__private" style={{display:'block'}}><summary>Marcador independiente de contingencia</summary><p>Plan B para un partido sin marcador asignado. Se crea sólo en Mostra d’Oltremare (sede 9), sin asociarlo al torneo 57 ni a resultados oficiales.</p>
  <label>Cancha<select value={court} disabled={busy} onChange={e=>setCourt(e.target.value)}><option value="">Seleccionar cancha</option>{courts.map(item=><option key={item.id} value={item.nombre||item.id}>{item.nombre||`Cancha ${item.id}`}</option>)}</select></label>
  <label>Equipo A<input value={teamA} maxLength={80} disabled={busy} onChange={e=>setTeamA(e.target.value)} /></label>
  <div className="nations-operator__players">{playersA.map((name,index)=><input key={`a${index}`} aria-label={`Jugador A${index+1}`} placeholder={`Jugador A${index+1}`} value={name} disabled={busy} onChange={e=>changePlayer(setPlayersA,index,e.target.value)} />)}</div>
  <label>Equipo B<input value={teamB} maxLength={80} disabled={busy} onChange={e=>setTeamB(e.target.value)} /></label>
  <div className="nations-operator__players">{playersB.map((name,index)=><input key={`b${index}`} aria-label={`Jugador B${index+1}`} placeholder={`Jugador B${index+1}`} value={name} disabled={busy} onChange={e=>changePlayer(setPlayersB,index,e.target.value)} />)}</div>
  <button type="button" disabled={busy} onClick={create}>{busy?'Creando…':'Crear marcador independiente'}</button>
  {error?<p role="alert">{error}</p>:null}{result?<div role="status"><p>Marcador listo. Compartí estos enlaces:</p><p><a href={result.controlPath} target="_blank" rel="noreferrer">Control privado del árbitro</a></p><p><a href={result.publicPath} target="_blank" rel="noreferrer">Pantalla pública / TV</a></p></div>:null}
 </details>;
}
