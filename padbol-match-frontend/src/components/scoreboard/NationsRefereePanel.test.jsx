import React from 'react';
import {render,screen,fireEvent,act,within} from '@testing-library/react';
import NationsRefereePanel from './NationsRefereePanel';
jest.mock('./NationsRefereeLink',()=>()=> <div>Staff issuer</div>);
jest.mock('../../hooks/useServerCronometro',()=>()=>22);
jest.mock('../../pages/ScoreboardControl',()=>({formatTimer:()=> '00:00:22',TeamNameRow:({name})=><h2>{name}</h2>,TeamPlayersBlock:({jugadores=[]})=><div>{jugadores.map(p=>p.name).join(', ')}</div>,gameScoreClassName:()=>'',formatGameScore:()=> '0'}));
const players=[{id:'private-a',name:'Ana'},{id:'private-b',name:'Bea'},{id:'private-c',name:'Clara'},{id:'private-d',name:'Dina'}];
const snapshot={mode:'nations',board:{id:'board',estado:'en_curso',cronometro_inicio:'2026-11-11T12:00:00Z',cronometro_pausado:false,equipo_a_nombre:'Italia',equipo_b_nombre:'España',games_a:1,games_b:0,sets_a:0,sets_b:0},context:{hasBaseline:true,membership:{A:'1',B:'2'},teams:{1:{players},2:{players}}},markers:[{teamId:'1',state:{active:['private-a','private-b'],status:'open'}},{teamId:'2',state:{active:['private-a','private-b'],status:'open'}}],window:{allowed:true,completed_games:1,set_number:1},coherent:true,clockSynced:true};
const controller=extra=>({snapshot,act:jest.fn(async()=>true),refresh:jest.fn(),busy:false,pending:null,error:'',...extra});
test('tap court player then named bench player sends one atomic substitution, without ID inputs',async()=>{
 const c=controller();render(<NationsRefereePanel controller={c}/>);
 expect(screen.getByRole('heading',{level:1})).toHaveTextContent('Italia vs España');expect(screen.queryByText(/private-/)).toBeNull();expect(screen.queryByRole('combobox')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Replace Ana for Italia'}));
 const bench=screen.getByRole('region',{name:'Substitutes for Italia'});
 await act(async()=>fireEvent.click(within(bench).getByRole('button',{name:/Clara/})));
 expect(c.act).toHaveBeenCalledWith('substitution',{teamId:'1',swaps:[{outId:'private-a',inId:'private-c'}]});
});
test('Change pair chooses two bench players and emits exactly one two-swap command',async()=>{
 const c=controller();render(<NationsRefereePanel controller={c}/>);
 fireEvent.click(screen.getByRole('button',{name:'Change pair · España'}));
 const bench=screen.getByRole('region',{name:'Substitutes for España'});
 await act(async()=>fireEvent.click(within(bench).getByRole('button',{name:/Clara/})));
 expect(c.act).not.toHaveBeenCalled();
 await act(async()=>fireEvent.click(within(bench).getByRole('button',{name:/Dina/})));
 expect(c.act).toHaveBeenCalledTimes(1);expect(c.act).toHaveBeenCalledWith('substitution',{teamId:'2',swaps:[{outId:'private-a',inId:'private-c'},{outId:'private-b',inId:'private-d'}]});
});
test.each([
 ['mid-game',{window:{allowed:false}}],['paused',{board:{...snapshot.board,cronometro_pausado:true}}],['drift',{clockSynced:false}],['incoherent',{coherent:false}],['terminal',{board:{...snapshot.board,estado:'terminado',sets_a:2}}],['no baseline',{context:{...snapshot.context,hasBaseline:false}}]
])('%s closes court even if stale window says allowed',(_label,delta)=>{
 const c=controller({snapshot:{...snapshot,...delta}});render(<NationsRefereePanel controller={c}/>);
 expect(screen.getByRole('button',{name:'Replace Ana for Italia'})).toBeDisabled();expect(screen.getByRole('button',{name:'Change pair · Italia'})).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:'Replace Ana for Italia'}));expect(c.act).not.toHaveBeenCalled();
});
test('uncertain command freezes court and retries same controller intent, not a new swap',()=>{
 const c=controller({pending:{body:{}}});render(<NationsRefereePanel controller={c}/>);
 expect(screen.getByRole('button',{name:'Replace Ana for Italia'})).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:'Retry the same attempt'}));expect(c.act).toHaveBeenCalledWith('retry');
});
test('an authoritative revision change clears draft bench before another selection',()=>{
 const c=controller();const {rerender}=render(<NationsRefereePanel controller={c}/>);
 fireEvent.click(screen.getByRole('button',{name:'Replace Ana for Italia'}));expect(screen.getByRole('region',{name:'Substitutes for Italia'})).toBeInTheDocument();
 rerender(<NationsRefereePanel controller={controller({snapshot:{...snapshot,markers:snapshot.markers.map(m=>({...m,state:{...m.state,revision:2}}))}})}/>);
 expect(within(screen.getByRole('region',{name:'Substitutes for Italia'})).getByRole('button',{name:/Clara/})).toBeDisabled();
});
test('natural terminal shows final result and close action despite frozen clock; points stay disabled',()=>{
 const c=controller({snapshot:{...snapshot,clockSynced:false,window:null,board:{...snapshot.board,estado:'terminado',sets_a:2}}});render(<NationsRefereePanel controller={c}/>);
 expect(screen.getByRole('heading',{name:'Match finished'})).toBeInTheDocument();expect(screen.getByRole('button',{name:'Close finished match tracking'})).toBeEnabled();
 expect(screen.getByRole('button',{name:'+ Point Italia'})).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:'Close finished match tracking'}));expect(c.act).toHaveBeenCalledWith('close');
});
test('secondary menu preserves undo/refresh and staff-only link issuance',()=>{
 const c=controller();const {rerender}=render(<NationsRefereePanel controller={c}/>);fireEvent.click(screen.getByRole('button',{name:'More'}));
 expect(screen.queryByText('Staff issuer')).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Undo last point'}));expect(c.act).toHaveBeenCalledWith('undo');
 fireEvent.click(screen.getByRole('button',{name:'Refresh scoreboard'}));expect(c.refresh).toHaveBeenCalledTimes(1);
 rerender(<NationsRefereePanel controller={c} allowIssueLink/>);expect(screen.getByText('Staff issuer')).toBeInTheDocument();
});
test('legacy mode keeps old team cards and never renders tactical court',()=>{
 render(<NationsRefereePanel controller={controller({snapshot:{...snapshot,mode:'legacy-token'}})}/>);
 expect(screen.queryByLabelText('Padbol court, two players per side')).toBeNull();expect(screen.getAllByRole('button',{name:'+ POINT'})).toHaveLength(2);
});

test('both benches remain visible before selecting a player, names readable but no accidental change',()=>{
 const c=controller();render(<NationsRefereePanel controller={c}/>);
 for(const team of ['Italia','España']){const bench=screen.getByRole('region',{name:`Substitutes for ${team}`});expect(within(bench).getByRole('button',{name:/Clara/})).toBeDisabled();expect(within(bench).getByRole('button',{name:/Dina/})).toBeDisabled();}
 expect(c.act).not.toHaveBeenCalled();
});

test('court swaps immediately during a delayed save, then rolls back a rejected change without sending twice',async()=>{
 let finish;const c=controller({act:jest.fn(()=>new Promise(resolve=>{finish=resolve;}))});
 render(<NationsRefereePanel controller={c}/>);
 fireEvent.click(screen.getByRole('button',{name:'Replace Ana for Italia'}));
 fireEvent.click(within(screen.getByRole('region',{name:'Substitutes for Italia'})).getByRole('button',{name:/Clara/}));
 expect(screen.queryByRole('button',{name:'Replace Ana for Italia'})).toBeNull();
 expect(screen.getByRole('button',{name:'Replace Clara for Italia'})).toBeDisabled();
 expect(screen.getByRole('status')).toHaveTextContent('Saving change');
 expect(c.act).toHaveBeenCalledTimes(1);
 await act(async()=>{finish(false);});
 expect(screen.getByRole('button',{name:'Replace Ana for Italia'})).toBeEnabled();
 expect(c.act).toHaveBeenCalledTimes(1);
});
test('two players enter the court together immediately while one atomic pair save is pending',async()=>{
 let finish;const c=controller({act:jest.fn(()=>new Promise(resolve=>{finish=resolve;}))});render(<NationsRefereePanel controller={c}/>);
 fireEvent.click(screen.getByRole('button',{name:'Change pair · España'}));
 const bench=screen.getByRole('region',{name:'Substitutes for España'});
 fireEvent.click(within(bench).getByRole('button',{name:/Clara/}));
 expect(screen.getByRole('button',{name:'Replace Ana for España'})).toBeEnabled();
 fireEvent.click(within(bench).getByRole('button',{name:/Dina/}));
 expect(screen.getByRole('button',{name:'Replace Clara for España'})).toBeDisabled();
 expect(screen.getByRole('button',{name:'Replace Dina for España'})).toBeDisabled();
 expect(c.act).toHaveBeenCalledTimes(1);
 await act(async()=>{finish(false);});
});
test('a request in flight says Saving and never offers the uncertain retry warning',()=>{
 render(<NationsRefereePanel controller={controller({busy:true,pending:{body:{}},feedback:'Saving change…'})}/>);
 expect(screen.queryByRole('button',{name:'Retry the same attempt'})).toBeNull();
 expect(screen.getByRole('status')).toHaveTextContent('Saving change');
});
