import React from 'react';
import {render,screen,fireEvent,act} from '@testing-library/react';
import NationsRefereePanel from './NationsRefereePanel';
jest.mock('./NationsRefereeLink',()=>()=> <div>Staff issuer</div>);
jest.mock('../../hooks/useServerCronometro',()=>()=>22);
jest.mock('../../pages/ScoreboardControl',()=>({formatTimer:()=> '00:00:22',TeamNameRow:({name})=><h2>{name}</h2>,TeamPlayersBlock:({jugadores})=><div>{jugadores.map(p=>p.name).join(', ')}</div>,gameScoreClassName:()=>'',formatGameScore:()=> '0'}));
const players=[{id:'private-a',name:'Ana'},{id:'private-b',name:'Bea'},{id:'private-c',name:'Clara'},{id:'private-d',name:'Dina'}];
const snapshot={mode:'nations',board:{id:'board',estado:'en_curso',cronometro_inicio:'2026-11-11T12:00:00Z',cronometro_pausado:false,equipo_a_nombre:'Italia',equipo_b_nombre:'España',games_a:1,games_b:0,sets_a:0,sets_b:0},context:{hasBaseline:true,membership:{A:'1',B:'2'},teams:{1:{players},2:{players}}},markers:[{teamId:'1',state:{active:['private-a','private-b'],status:'open'}},{teamId:'2',state:{active:['private-a','private-b'],status:'open'}}],window:{allowed:true,completed_games:1,set_number:1},coherent:true,clockSynced:true};
const controller=extra=>({snapshot,act:jest.fn(async()=>true),refresh:jest.fn(),busy:false,pending:null,error:'',...extra});
test('visual customer panel names active/bench, sends one or both swaps without printing identifiers',async()=>{
 const c=controller();render(<NationsRefereePanel controller={c}/>);
 expect(screen.getByRole('heading',{level:1})).toHaveTextContent('Italia vs España');expect(screen.queryByText(/private-/)).toBeNull();
 fireEvent.change(screen.getByLabelText('Jugador que sale'),{target:{value:'private-a'}});fireEvent.change(screen.getByLabelText('Jugador que entra'),{target:{value:'private-c'}});
 fireEvent.click(screen.getByLabelText('Sustituir ambos jugadores'));fireEvent.change(screen.getByLabelText('Segundo jugador que sale'),{target:{value:'private-b'}});fireEvent.change(screen.getByLabelText('Segundo jugador que entra'),{target:{value:'private-d'}});
 await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Registrar cambio'}));});expect(c.act).toHaveBeenCalledWith('substitution',{teamId:'1',swaps:[{outId:'private-a',inId:'private-c'},{outId:'private-b',inId:'private-d'}]});
});
test('closed window/paused deny changes; uncertain retry freezes editor and close requires natural terminal',()=>{
 const c=controller({snapshot:{...snapshot,window:null,board:{...snapshot.board,cronometro_pausado:true}},pending:{body:{}}});render(<NationsRefereePanel controller={c}/>);
 expect(screen.getByRole('button',{name:'Registrar cambio'})).toBeDisabled();expect(screen.getByLabelText('Jugador que sale')).toBeDisabled();expect(screen.getByRole('button',{name:'Cerrar seguimiento del partido terminado'})).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:'Reintentar el mismo intento'}));expect(c.act).toHaveBeenCalledWith('retry');
});
test('one replacement uses one named pair and terminal close remains available after clock freezes',async()=>{
 const c=controller();const {rerender}=render(<NationsRefereePanel controller={c}/>);
 fireEvent.change(screen.getByLabelText('Jugador que sale'),{target:{value:'private-a'}});fireEvent.change(screen.getByLabelText('Jugador que entra'),{target:{value:'private-c'}});
 await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Registrar cambio'}));});
 expect(c.act).toHaveBeenCalledWith('substitution',{teamId:'1',swaps:[{outId:'private-a',inId:'private-c'}]});
 rerender(<NationsRefereePanel controller={controller({snapshot:{...snapshot,clockSynced:false,window:null,board:{...snapshot.board,estado:'terminado',sets_a:2}}})}/>);
 expect(screen.getByRole('button',{name:'Cerrar seguimiento del partido terminado'})).toBeEnabled();
 expect(screen.getAllByRole('button',{name:'+ POINT'}).every(button=>button.disabled)).toBe(true);
});
test('link issuance is absent unless staff entry explicitly enables it',()=>{
 const {rerender}=render(<NationsRefereePanel controller={controller()}/>);expect(screen.queryByText('Staff issuer')).toBeNull();
 rerender(<NationsRefereePanel controller={controller()} allowIssueLink/>);expect(screen.getByText('Staff issuer')).toBeInTheDocument();
});
