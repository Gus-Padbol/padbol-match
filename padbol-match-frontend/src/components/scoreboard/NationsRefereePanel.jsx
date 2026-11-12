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
 if(loading)return <main className="sc-control nations-referee-panel"><p role="status">Loading the referee panel…</p></main>;
 if(!board)return <main className="sc-control nations-referee-panel"><p role="alert">{error||'Scoreboard unavailable.'}</p><button onClick={refresh}>Refresh scoreboard</button></main>;
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
 const teams=Object.fromEntries(['A','B'].map(s=>{const tid=context?.membership?.[s],m=snapshot.markers?.find(item=>String(item.teamId)===String(tid)),roster=context?.teams?.[tid]?.players||[],ids=m?.state?.active||[];return [s,{id:tid,name:board[`equipo_${s.toLowerCase()}_nombre`]||`Team ${s}`,active:roster.filter(p=>ids.includes(p.id)),bench:roster.filter(p=>!ids.includes(p.id))}];}));
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
  <header className="sc-header"><p className="sc-header__torneo">{board.torneo_nombre||'Scoreboard'}</p><h1 className={`sc-header__title${nations?' sr-only':''}`}>{board.equipo_a_nombre} vs {board.equipo_b_nombre}</h1><p className="sc-header__meta">{formatScoreboardVenueHeader(board)}</p>
   <div className="sc-timer-bar"><span className="sc-timer">{formatTimer(seconds)}</span>
    {(!nations||(!running&&!terminal))?<button className="sc-timer-btn sc-timer-btn--start" disabled={locked||terminal||running||!coherent||!clockReady||(nations&&!baseline&&!context.canStart)} onClick={()=>act(nations?(baseline?'resume':'start'):(paused?'resume':'start'))}>{nations&&!baseline?'Start match':paused?'Resume':'Start match'}</button>:null}
    {(!nations||running)?<button className="sc-timer-btn sc-timer-btn--pause" disabled={locked||!running||terminal||!coherent||!clockReady} onClick={()=>act('pause')}>Pause</button>:null}
   </div>
  </header>
  {error?<p className="sc-error" role="alert">{error}</p>:null}
  {pending?<div className="nations-referee-notice" role="alert"><p>The response is unconfirmed. The original attempt is saved.</p><button disabled={busy} onClick={()=>act('retry')}>Retry the same attempt</button></div>:null}
  {nations?<>
   <section className="nt-scores" aria-label="Match score">{['A','B'].map(s=><article key={s} className={`nt-score nt-score--${s.toLowerCase()}`}>
    <h2>{teams[s].name}{board.saque_actual===s?<span className="nt-serving"> · Serving</span>:null}</h2>
    <button className="nt-point" aria-label={`+ Point ${teams[s].name}`} disabled={!canScore} onClick={()=>act('point',{side:s})}><strong className="nt-score__points" aria-label={`Points for ${teams[s].name}`}>{formatGameScore(board.display||{},s)}</strong><span>+ Point</span></button>
    <p><b>{board[`games_${s.toLowerCase()}`]||0}</b> games <span>·</span> <b>{board[`sets_${s.toLowerCase()}`]||0}</b> sets</p>
   </article>)}</section>
   {terminal?<section className="nt-result" aria-label="Final result"><h2>Match finished</h2><p>{teams.A.name} {board.sets_a}–{board.sets_b} {teams.B.name}</p><p>The result is saved. No more points can be added.</p></section>:null}
   <section className="nt-tactics" aria-label="Substitutions">
    <div className="nt-tactics__heading"><h2>On court</h2><span>{paused?'Paused':terminal?'Finished':snapshot.window?.allowed?'Change of ends':'In play'}</span></div>
    <NationsTacticalCourt teams={teams} disabled={!canChange} selected={choice} onPlayer={choosePlayer}/>
    <p role="status" className="nt-window">{snapshot.window?.allowed&&!paused&&!terminal?`Game ${snapshot.window.completed_games} · set ${snapshot.window.set_number}. Tap player → substitute.`:'Substitute after an odd game (1, 3, 5, 7), never during a point, tie-break or pause.'}</p>
    <div className="nt-pair-actions">{['A','B'].map(s=><button key={s} type="button" disabled={!canChange||teams[s].bench.length<2||teams[s].active.length!==2} onClick={()=>{setChoice({side:s,mode:'pair'});setPair([]);}}>Change pair · {teams[s].name}</button>)}</div>
    {choice?<p className="nt-hint">{(choice.mode==='pair'?`Choose two substitutes for ${teams[choice.side].name}.`:`Choose who replaces ${teams[choice.side].active.find(p=>p.id===choice.outId)?.name||'the player'}.`)}</p>:null}
    {choice?<button className="nt-cancel" disabled={locked} onClick={()=>{setChoice(null);setPair([]);}}>Cancel substitution</button>:null}
    <div className="nt-benches">{['A','B'].map(s=><section key={s} className={`nt-bench nt-bench--${s.toLowerCase()}${choice?.side===s?' is-selected':''}`} aria-label={`Substitutes for ${teams[s].name}`}>
     <h3>Substitutes · {teams[s].name}</h3><div className="nt-bench__players">{teams[s].bench.map(p=><button key={p.id} disabled={!canChange||choice?.side!==s} aria-pressed={choice?.side===s&&pair.includes(p.id)} onClick={()=>chooseBench(p)}>{p.name}<small>{choice?.side===s&&pair.includes(p.id)?'Selected':'Substitute'}</small></button>)}</div>{!teams[s].bench.length?<p>No substitutes available.</p>:null}
    </section>)}</div>

   </section>
  </>:<ScoreboardTeamCards partido={view} disabled={!canScore} onPoint={s=>act('point',{side:s})}/>}
  <section className="sc-header nations-referee-actions">
   {nations&&terminal?<button disabled={locked||!baseline||!coherent||snapshot.markers.every(m=>['closed','corrected'].includes(m.state?.status))} onClick={()=>act('close')}>Close finished match tracking</button>:null}
   {!nations?<><button disabled={locked||!running||terminal||!coherent||!clockReady} onClick={()=>act('undo')}>Undo last point</button><button disabled={busy} onClick={refresh}>Refresh scoreboard</button></>:null}
   {nations?<button aria-expanded={more} aria-controls="nt-more" onClick={()=>setMore(!more)}>More</button>:null}
   {more?<div id="nt-more" className="nt-more"><button disabled={locked||!running||terminal||!coherent||!clockReady||(nations&&!baseline)} onClick={()=>act('undo')}>Undo last point</button><button disabled={busy} onClick={refresh}>Refresh scoreboard</button>
    {nations&&!terminal?<button disabled onClick={()=>act('close')}>Close finished match tracking</button>:null}
    {nations&&allowIssueLink?<NationsRefereeLink key={board.id} scoreboardId={board.id} disabled={locked} onIssued={refresh}/>:null}
   </div>:null}
  </section>
 </main>;
}
