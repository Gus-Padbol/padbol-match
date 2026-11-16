import React,{useState} from 'react';
import './PracticeNations.css';
import PracticeSpectatorView from './PracticeSpectatorView';
import {practiceCopy} from './practiceCopy';

const teams=['Spain','Italy','Romania','France','Portugal','Argentina'];
const player=(team,index,onCourt)=>({nombre:(team===1?['Luca Rossi','Marco Bianchi']:['Luis Sánchez','Diego Ruiz'])[index],on_court:onCourt});
const fixture=(id,a,b,scoreA=0,scoreB=0)=>({id,estado:'en_curso',torneo_nombre:'NATIONS CUP',torneo_edicion:'Italy 2026',display:{displayA:String(scoreA),displayB:String(scoreB),cronometroActivo:true},score_a:scoreA,score_b:scoreB,games_a:3,games_b:2,sets_a:0,sets_b:0,saque_actual:'A',equipo_a_nombre:teams[a],equipo_b_nombre:teams[b],equipo_a_pais_iso:['ES','RO','PT'][Math.floor(a/2)]||'ES',equipo_b_pais_iso:['IT','FR','AR'][Math.floor(b/2)]||'IT',equipo_a_jugadores:[player(a,0,true),player(a,1,true),{nombre:'Suplente Spain',on_court:false},{nombre:'Suplente Spain 2',on_court:false}],equipo_b_jugadores:[player(b,0,true),player(b,1,true),{nombre:'Suplente Italy',on_court:false},{nombre:'Suplente Italy 2',on_court:false}],historial_sets:[]});
const boards=[fixture('91111111-1111-4111-8111-111111111101',0,1,30,15),fixture('91111111-1111-4111-8111-111111111102',2,3,0,0),fixture('91111111-1111-4111-8111-111111111103',4,5,15,30)];
export default function PracticeSpectatorPreview(){
 const [selected,setSelected]=useState(0);const copy=practiceCopy('en');
 return <main className="np-page"><div className="np-shell">
  <PracticeSpectatorView board={boards[selected]} status="ready" copy={{...copy,serve:'Serving'}} courts={boards.map((board,index)=>({id:board.id,label:`Court ${index+1}`,onSelect:()=>setSelected(index)}))} activeCourt={selected+1}/>
  <p style={{textAlign:'center',color:'#b5ad98',fontStyle:'italic'}}>Example data · design preview</p>
 </div></main>;
}
