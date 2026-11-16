import React,{useState} from 'react';
import PracticeSpectatorView from './PracticeSpectatorView';
import {practiceCopy} from './practiceCopy';

const teams=['Equipo Práctica 1','Equipo Práctica 2','Equipo Práctica 3','Equipo Práctica 4','Equipo Práctica 5','Equipo Práctica 6'];
const player=(team,index,onCourt)=>({nombre:['Titular '+team+' A','Titular '+team+' B','Suplente '+team+' A','Suplente '+team+' B'][index],on_court:onCourt});
const fixture=(id,a,b,scoreA=0,scoreB=0)=>({id,estado:'en_curso',display:{displayA:String(scoreA),displayB:String(scoreB),cronometroActivo:true},score_a:scoreA,score_b:scoreB,games_a:2,games_b:1,sets_a:1,sets_b:0,saque_actual:'A',equipo_a_nombre:teams[a],equipo_b_nombre:teams[b],equipo_a_jugadores:[player(a,0,true),player(a,1,true),player(a,2,false),player(a,3,false)],equipo_b_jugadores:[player(b,0,true),player(b,1,true),player(b,2,false),player(b,3,false)],historial_sets:[{set:1,a:6,b:4}]});
const boards=[fixture('91111111-1111-4111-8111-111111111101',0,1,30,15),fixture('91111111-1111-4111-8111-111111111102',2,3,0,0),fixture('91111111-1111-4111-8111-111111111103',4,5,15,30)];
export default function PracticeSpectatorPreview(){
 const [selected,setSelected]=useState(0);const copy=practiceCopy('es');
 return <main className="np-page" style={{paddingTop:24}}><div className="np-shell">
  <header className="np-header"><img className="np-brand" src="/brand/padbol-match-logo-white-practice.svg" alt="Padbol Match"/><h1>Práctica Nations</h1><p>Vista pública simplificada · fixture local</p></header>
  <nav className="np-court-tabs" aria-label="Elegí una cancha" style={{justifyContent:'center'}}>{boards.map((board,index)=><button key={board.id} type="button" className={`np-court-tab${index===selected?' is-selected':''}`} onClick={()=>setSelected(index)}>Cancha {index+1}</button>)}</nav>
  <h2 className="np-mode" style={{textAlign:'center'}}>Vista de espectador</h2>
  <PracticeSpectatorView board={boards[selected]} status="ready" copy={copy}/>
 </div></main>;
}
