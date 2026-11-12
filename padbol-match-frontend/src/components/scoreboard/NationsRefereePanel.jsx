import React,{useState} from 'react';
import ScoreboardTeamCards from './ScoreboardTeamCards';
import {formatTimer} from '../../pages/ScoreboardControl';
import useServerCronometro from '../../hooks/useServerCronometro';
import {formatScoreboardVenueHeader} from '../../utils/scoreboardVenueLabels';
import '../../styles/ScoreboardControl.css';
import './NationsRefereePanel.css';
import NationsRefereeLink from './NationsRefereeLink';

export default function NationsRefereePanel({controller,allowIssueLink=false}) {
 const {snapshot,loading,busy,error,pending,act,refresh}=controller;
 const [side,setSide]=useState('A'),[second,setSecond]=useState(false),[out1,setOut1]=useState(''),[in1,setIn1]=useState(''),[out2,setOut2]=useState(''),[in2,setIn2]=useState('');
 const board=snapshot?.board;
 const seconds=useServerCronometro(board);
 if(loading)return <main className="sc-control nations-referee-panel"><p role="status">Cargando el panel del árbitro…</p></main>;
 if(!board)return <main className="sc-control nations-referee-panel"><p role="alert">{error||'Marcador no disponible.'}</p><button onClick={refresh}>Actualizar marcador</button></main>;
 const nations=snapshot.mode==='nations',context=snapshot.context,baseline=context?.hasBaseline;
 const id=context?.membership?.[side],marker=snapshot.markers?.find(m=>String(m.teamId)===String(id));
 const players=context?.teams?.[id]?.players||[],active=marker?.state?.active||[];
 const starters=players.filter(p=>active.includes(p.id)),bench=players.filter(p=>!active.includes(p.id));
 const terminal=['terminado','finalizado'].includes(board.estado)||board.sets_a>=2||board.sets_b>=2;
 const paused=board.cronometro_pausado===true;
 const running=board.estado==='en_curso'&&!paused&&Boolean(board.cronometro_inicio);
 const locked=busy||Boolean(pending),coherent=!nations||snapshot.coherent;
 const clockReady=!nations||snapshot.clockSynced!==false;
 const canScore=!locked&&!terminal&&running&&coherent&&clockReady&&(!nations||baseline);
 const view={...board};
 if(nations)for(const s of ['A','B']){
  const tid=context.membership[s],m=snapshot.markers?.find(item=>String(item.teamId)===String(tid));
  if(m?.state?.active)view[`equipo_${s.toLowerCase()}_jugadores`]=(context.teams[tid]?.players||[]).filter(p=>m.state.active.includes(p.id));
 }
 const options=(list,exclude)=>list.filter(p=>p.id!==exclude).map(p=><option key={p.id} value={p.id}>{p.name}{p.dorsal?` · ${p.dorsal}`:''}</option>);
 const submit=async()=>{
  const swaps=[{outId:out1,inId:in1},...(second?[{outId:out2,inId:in2}]:[])];
  if(swaps.some(s=>!s.outId||!s.inId))return;
  if(await act('substitution',{teamId:id,swaps})){setOut1('');setIn1('');setOut2('');setIn2('');setSecond(false);}
 };
 return <main className="sc-control nations-referee-panel">
  <header className="sc-header"><p className="sc-header__torneo">{board.torneo_nombre||'Marcador'}</p><h1 className="sc-header__title">{board.equipo_a_nombre} vs {board.equipo_b_nombre}</h1><p className="sc-header__meta">{formatScoreboardVenueHeader(board)}</p>
   <div className="sc-timer-bar"><span className="sc-timer">{formatTimer(seconds)}</span>
    <button className="sc-timer-btn sc-timer-btn--start" disabled={locked||terminal||running||!coherent||!clockReady||(nations&&!baseline&&!context.canStart)} onClick={()=>act(nations?(baseline?'resume':'start'):(paused?'resume':'start'))}>{nations&&!baseline?'Iniciar partido':paused?'Reanudar':'Iniciar partido'}</button>
    <button className="sc-timer-btn sc-timer-btn--pause" disabled={locked||!running||terminal||!coherent||!clockReady} onClick={()=>act('pause')}>Pausar</button>
   </div>
  </header>
  {error?<p className="sc-error" role="alert">{error}</p>:null}
  {pending?<div className="nations-referee-notice" role="alert"><p>La respuesta no está confirmada. Conservamos exactamente el mismo intento.</p><button disabled={busy} onClick={()=>act('retry')}>Reintentar el mismo intento</button></div>:null}
  {nations&&allowIssueLink?<NationsRefereeLink key={board.id} scoreboardId={board.id} disabled={locked} onIssued={refresh}/>:null}
  <ScoreboardTeamCards partido={view} disabled={!canScore} onPoint={s=>act('point',{side:s})}/>
  {nations?<section className="sc-header nations-referee-substitutions" aria-label="Sustituciones"><h2>Cambio de lado</h2>
   <p role="status">{snapshot.window?.allowed?`Game ${snapshot.window.completed_games} del set ${snapshot.window.set_number} terminado. Puedes sustituir uno o ambos jugadores.`:'Espera al final de un game impar del set. No se hacen cambios durante un punto, un tie-break o una pausa.'}</p>
   <label>Selección <select value={side} disabled={locked} onChange={e=>{setSide(e.target.value);setOut1('');setIn1('');setOut2('');setIn2('');setSecond(false);}}>{['A','B'].map(s=><option key={s} value={s}>{board[`equipo_${s.toLowerCase()}_nombre`]}</option>)}</select></label>
   <p>En cancha: {starters.map(p=>p.name).join(' · ')||'Alineación pendiente'}</p>
   {bench.length?<><label>Sale <select aria-label="Jugador que sale" disabled={locked} value={out1} onChange={e=>setOut1(e.target.value)}><option value="">Seleccionar jugador</option>{options(starters,out2)}</select></label>
    <label>Entra <select aria-label="Jugador que entra" disabled={locked} value={in1} onChange={e=>setIn1(e.target.value)}><option value="">Seleccionar suplente</option>{options(bench,in2)}</select></label>
    {bench.length>=2?<label className="nations-referee-both"><input type="checkbox" checked={second} disabled={locked} onChange={e=>{setSecond(e.target.checked);setOut2('');setIn2('');}}/>Sustituir ambos jugadores</label>:null}
    {second?<><label>Segundo jugador que sale <select aria-label="Segundo jugador que sale" disabled={locked} value={out2} onChange={e=>setOut2(e.target.value)}><option value="">Seleccionar jugador</option>{options(starters,out1)}</select></label><label>Segundo jugador que entra <select aria-label="Segundo jugador que entra" disabled={locked} value={in2} onChange={e=>setIn2(e.target.value)}><option value="">Seleccionar suplente</option>{options(bench,in1)}</select></label></>:null}
    <button disabled={locked||!snapshot.window?.allowed||!out1||!in1||(second&&(!out2||!in2))} onClick={submit}>Registrar cambio</button></>:<p>No hay suplentes disponibles en esta alineación.</p>}
  </section>:null}
  <section className="sc-header nations-referee-actions"><button disabled={locked||!running||terminal||!coherent||!clockReady||(nations&&!baseline)} onClick={()=>act('undo')}>Deshacer último punto</button>
   {nations?<button disabled={locked||!terminal||!baseline||!coherent||snapshot.markers.every(m=>['closed','corrected'].includes(m.state?.status))} onClick={()=>act('close')}>Cerrar seguimiento del partido terminado</button>:null}
   <button disabled={busy} onClick={refresh}>Actualizar marcador</button>
  </section>
 </main>;
}
