import React,{useState} from 'react';
import PracticeSpectatorView from './PracticeSpectatorView';
import {practiceCopy} from './practiceCopy';

const teams=['Spain','Italy','Romania','France','Portugal','Argentina'];
const player=(team,index,onCourt)=>({nombre:['Luis Sánchez','Diego Ruiz','Marco Bianchi','Luca Rossi'][index],on_court:onCourt});
const fixture=(id,a,b,scoreA=0,scoreB=0)=>({id,estado:'en_curso',torneo_nombre:'NATIONS CUP',torneo_edicion:'Italia 2026',display:{displayA:String(scoreA),displayB:String(scoreB),cronometroActivo:true},score_a:scoreA,score_b:scoreB,games_a:3,games_b:2,sets_a:0,sets_b:0,saque_actual:'A',equipo_a_nombre:teams[a],equipo_b_nombre:teams[b],equipo_a_pais_iso:['ES','RO','PT'][Math.floor(a/2)]||'ES',equipo_b_pais_iso:['IT','FR','AR'][Math.floor(b/2)]||'IT',equipo_a_jugadores:[player(a,0,true),player(a,1,true),{nombre:'Suplente Spain',on_court:false},{nombre:'Suplente Spain 2',on_court:false}],equipo_b_jugadores:[player(b,0,true),player(b,1,true),{nombre:'Suplente Italy',on_court:false},{nombre:'Suplente Italy 2',on_court:false}],historial_sets:[]});
const boards=[fixture('91111111-1111-4111-8111-111111111101',0,1,30,15),fixture('91111111-1111-4111-8111-111111111102',2,3,0,0),fixture('91111111-1111-4111-8111-111111111103',4,5,15,30)];
export default function PracticeSpectatorPreview(){
 const [selected,setSelected]=useState(0);const copy=practiceCopy('en');
 return <main className="np-page" style={{paddingTop:24}}><div className="np-shell">
  <header className="np-header"><img className="np-brand" src="/brand/padbol-match-logo-white-practice.svg" alt="Padbol Match"/><h1>Práctica Nations</h1><p>Vista pública simplificada · fixture local</p></header>
  <nav className="np-court-tabs" aria-label="Elegí una cancha" style={{justifyContent:'center'}}>{boards.map((board,index)=><button key={board.id} type="button" className={`np-court-tab${index===selected?' is-selected':''}`} onClick={()=>setSelected(index)}>Court {index+1}</button>)}</nav>
  <h2 className="np-mode" style={{textAlign:'center'}}>Vista de espectador</h2>
  <PracticeSpectatorView board={boards[selected]} status="ready" copy={copy}/>
 </div></main>;
}
