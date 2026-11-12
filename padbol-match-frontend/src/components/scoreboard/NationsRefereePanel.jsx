import React,{useState,useEffect} from 'react';
import NationsTacticalCourt from './NationsTacticalCourt';
import {formatGameScore} from '../../pages/ScoreboardControl';
import ScoreboardTeamCards from './ScoreboardTeamCards';
import {formatTimer} from '../../pages/ScoreboardControl';
import useServerCronometro from '../../hooks/useServerCronometro';
import {formatScoreboardVenueHeader} from '../../utils/scoreboardVenueLabels';
import '../../styles/ScoreboardControl.css';
import './NationsRefereePanel.css';
import NationsRefereeLink from './NationsRefereeLink';

export default function NationsRefereePanel({controller,allowIssueLink=false}) {
 const {snapshot,loading,busy,error,pending,act,refresh}=controller;
 const [choice,setChoice]=useState(null),[pair,setPair]=useState([]),[more,setMore]=useState(false);
 const board=snapshot?.board;
 const selectionKey=JSON.stringify([board?.id,snapshot?.epoch,snapshot?.window,snapshot?.markers?.map(m=>[m.teamId,m.state?.revision,m.state?.active])]);
 useEffect(()=>{setChoice(null);setPair([]);},[selectionKey]);
 const seconds=useServerCronometro(board);
 if(loading)return <main className="sc-control nations-referee-panel"><p role="status">Cargando el panel del árbitro…</p></main>;
 if(!board)return <main className="sc-control nations-referee-panel"><p role="alert">{error||'Marcador no disponible.'}</p><button onClick={refresh}>Actualizar marcador</button></main>;
 const nations=snapshot.mode==='nations',context=snapshot.context,baseline=context?.hasBaseline;
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
 const teams=Object.fromEntries(['A','B'].map(s=>{const tid=context?.membership?.[s],m=snapshot.markers?.find(item=>String(item.teamId)===String(tid)),roster=context?.teams?.[tid]?.players||[],ids=m?.state?.active||[];return [s,{id:tid,name:board[`equipo_${s.toLowerCase()}_nombre`]||`Equipo ${s}`,active:roster.filter(p=>ids.includes(p.id)),bench:roster.filter(p=>!ids.includes(p.id))}];}));
 const canChange=!locked&&nations&&baseline&&coherent&&clockReady&&running&&!terminal&&snapshot.window?.allowed===true;
 const choosePlayer=(s,outId)=>{if(!canChange)return;setChoice({side:s,outId,mode:'single'});setPair([]);};
 const chooseBench=async player=>{
  if(!canChange||!choice)return;
  const team=teams[choice.side];
  if(!team.bench.some(p=>p.id===player.id))return;
  if(choice.mode==='pair'){
   const next=pair.includes(player.id)?pair.filter(id=>id!==player.id):[...pair,player.id];setPair(next);
   if(next.length===2&&team.active.length===2){if(await act('substitution',{teamId:team.id,swaps:team.active.map((p,i)=>({outId:p.id,inId:next[i]}))})){setChoice(null);setPair([]);}}
  }else if(team.active.some(p=>p.id===choice.outId)){
   if(await act('substitution',{teamId:team.id,swaps:[{outId:choice.outId,inId:player.id}]}))setChoice(null);
  }
 };
 return <main className={`sc-control nations-referee-panel${nations?' nations-referee-panel--tactical':''}`}>
  <header className="sc-header"><p className="sc-header__torneo">{board.torneo_nombre||'Marcador'}</p><h1 className={`sc-header__title${nations?' sr-only':''}`}>{board.equipo_a_nombre} vs {board.equipo_b_nombre}</h1><p className="sc-header__meta">{formatScoreboardVenueHeader(board)}</p>
   <div className="sc-timer-bar"><span className="sc-timer">{formatTimer(seconds)}</span>
    {(!nations||(!running&&!terminal))?<button className="sc-timer-btn sc-timer-btn--start" disabled={locked||terminal||running||!coherent||!clockReady||(nations&&!baseline&&!context.canStart)} onClick={()=>act(nations?(baseline?'resume':'start'):(paused?'resume':'start'))}>{nations&&!baseline?'Iniciar partido':paused?'Reanudar':'Iniciar partido'}</button>:null}
    {(!nations||running)?<button className="sc-timer-btn sc-timer-btn--pause" disabled={locked||!running||terminal||!coherent||!clockReady} onClick={()=>act('pause')}>Pausar</button>:null}
   </div>
  </header>
  {error?<p className="sc-error" role="alert">{error}</p>:null}
  {pending?<div className="nations-referee-notice" role="alert"><p>La respuesta no está confirmada. Conservamos exactamente el mismo intento.</p><button disabled={busy} onClick={()=>act('retry')}>Reintentar el mismo intento</button></div>:null}
  {nations?<>
   <section className="nt-scores" aria-label="Tanteo del partido">{['A','B'].map(s=><article key={s} className={`nt-score nt-score--${s.toLowerCase()}`}>
    <h2>{teams[s].name}{board.saque_actual===s?<span className="nt-serving"> · Saca</span>:null}</h2>
    <button className="nt-point" aria-label={`+ Punto ${teams[s].name}`} disabled={!canScore} onClick={()=>act('point',{side:s})}><strong className="nt-score__points" aria-label={`Puntos de ${teams[s].name}`}>{formatGameScore(board.display||{},s)}</strong><span>+ Punto</span></button>
    <p><b>{board[`games_${s.toLowerCase()}`]||0}</b> games <span>·</span> <b>{board[`sets_${s.toLowerCase()}`]||0}</b> sets</p>
   </article>)}</section>
   {terminal?<section className="nt-result" aria-label="Resultado final"><h2>Partido terminado</h2><p>{teams.A.name} {board.sets_a}–{board.sets_b} {teams.B.name}</p><p>El resultado se conserva. No se pueden añadir puntos.</p></section>:null}
   <section className="nt-tactics" aria-label="Sustituciones">
    <div className="nt-tactics__heading"><h2>En cancha</h2><span>{paused?'En pausa':terminal?'Finalizado':snapshot.window?.allowed?'Cambio de lado':'En juego'}</span></div>
    <NationsTacticalCourt teams={teams} disabled={!canChange} selected={choice} onPlayer={choosePlayer}/>
    <p role="status" className="nt-window">{snapshot.window?.allowed&&!paused&&!terminal?`Game ${snapshot.window.completed_games} · set ${snapshot.window.set_number}. Toca jugador → suplente.`:'Cambios: al terminar game impar (1, 3, 5, 7). No durante punto, tie-break o pausa.'}</p>
    <div className="nt-pair-actions">{['A','B'].map(s=><button key={s} type="button" disabled={!canChange||teams[s].bench.length<2||teams[s].active.length!==2} onClick={()=>{setChoice({side:s,mode:'pair'});setPair([]);}}>Cambiar pareja · {teams[s].name}</button>)}</div>
    {choice?<p className="nt-hint">{(choice.mode==='pair'?`Elige dos suplentes de ${teams[choice.side].name}.`:`Elige quién entra por ${teams[choice.side].active.find(p=>p.id===choice.outId)?.name||'el jugador'}.`)}</p>:null}
    {choice?<button className="nt-cancel" disabled={locked} onClick={()=>{setChoice(null);setPair([]);}}>Cancelar cambio</button>:null}
    <div className="nt-benches">{['A','B'].map(s=><section key={s} className={`nt-bench nt-bench--${s.toLowerCase()}${choice?.side===s?' is-selected':''}`} aria-label={`Suplentes de ${teams[s].name}`}>
     <h3>Suplentes · {teams[s].name}</h3><div className="nt-bench__players">{teams[s].bench.map(p=><button key={p.id} disabled={!canChange||choice?.side!==s} aria-pressed={choice?.side===s&&pair.includes(p.id)} onClick={()=>chooseBench(p)}>{p.name}<small>{choice?.side===s&&pair.includes(p.id)?'Seleccionado':'Suplente'}</small></button>)}</div>{!teams[s].bench.length?<p>No hay suplentes disponibles.</p>:null}
    </section>)}</div>

   </section>
  </>:<ScoreboardTeamCards partido={view} disabled={!canScore} onPoint={s=>act('point',{side:s})}/>}
  <section className="sc-header nations-referee-actions">
   {nations&&terminal?<button disabled={locked||!baseline||!coherent||snapshot.markers.every(m=>['closed','corrected'].includes(m.state?.status))} onClick={()=>act('close')}>Cerrar seguimiento del partido terminado</button>:null}
   {!nations?<><button disabled={locked||!running||terminal||!coherent||!clockReady} onClick={()=>act('undo')}>Deshacer último punto</button><button disabled={busy} onClick={refresh}>Actualizar marcador</button></>:null}
   {nations?<button aria-expanded={more} aria-controls="nt-more" onClick={()=>setMore(!more)}>Más</button>:null}
   {more?<div id="nt-more" className="nt-more"><button disabled={locked||!running||terminal||!coherent||!clockReady||(nations&&!baseline)} onClick={()=>act('undo')}>Deshacer último punto</button><button disabled={busy} onClick={refresh}>Actualizar marcador</button>
    {nations&&!terminal?<button disabled onClick={()=>act('close')}>Cerrar seguimiento del partido terminado</button>:null}
    {nations&&allowIssueLink?<NationsRefereeLink key={board.id} scoreboardId={board.id} disabled={locked} onIssued={refresh}/>:null}
   </div>:null}
  </section>
 </main>;
}
