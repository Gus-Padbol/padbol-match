import React from 'react';
import {render,screen,fireEvent,act,within} from '@testing-library/react';
import {MemoryRouter,Routes,Route} from 'react-router-dom';
import NationsPracticePage from './NationsPracticePage';
import {consumePracticeControl,createNationsPracticeApi,practiceRequestId} from '../utils/nationsPracticeApi';

jest.mock('../i18n/tSafe',()=>({useSafeTranslation:()=>({language:'es'})}));
jest.mock('../context/AuthContext',()=>({useAuth:()=>({session:{user:{id:'normal-test-reader'}}})}));
const E='1000000000001', A='70726163-0000-4000-8000-000000000001', B='70726163-0000-4000-8000-000000000002', C='70726163-0000-4000-8000-000000000003';
const CAP='anonymous-practice-capability-123456789';
const player=(side,n)=>({id:`${side}${n}`,name:`Jugador ${side}${n}`,nombre:`Jugador ${side}${n}`,on_court:n<3,jersey:n});
const board=(id=A,score=0)=>({id,torneo_id:Number(E),cancha:id===A?'1':id===B?'2':'3',estado:'en_curso',cronometro_pausado:false,cronometro_inicio:'2026-11-16T10:00:00Z',equipo_a_nombre:'Azul',equipo_b_nombre:'Rojo',equipo_a_jugadores:[1,2,3,4].map(n=>player('A',n)),equipo_b_jugadores:[1,2,3,4].map(n=>player('B',n)),display:{displayA:score,displayB:0,cronometroSegundos:65,cronometroActivo:true},score_a:score,score_b:0,games_a:1,games_b:0,sets_a:0,sets_b:0,historial_sets:[],practice_revision:0});
const matches=[A,B,C].map((id,index)=>({id:1000000000101+index,torneo_id:Number(E),scoreboard_id:id,cancha:index+1,equipo_a_nombre:'Azul',equipo_b_nombre:'Rojo'}));
const control=()=>({board:board(),revision:0,lineups:{A:[1,2,3,4].map(n=>player('A',n)),B:[1,2,3,4].map(n=>player('B',n))},substitution_window:{allowed:true}});
function apiFor(){let current=control();return {event:jest.fn(async()=>({event:{id:E},matches})),board:jest.fn(async id=>board(id)),control:jest.fn(async()=>current),command:jest.fn(async(id,token,body)=>{current={...current,revision:current.revision+1,board:{...current.board,practice_revision:current.revision+1}};return {board:current.board,revision:current.revision};})};}
const flush=async()=>{await act(async()=>{await Promise.resolve();await Promise.resolve();});};
function mount(mode='viewer',api=apiFor()){
 const suffix=mode==='entry'?'':`/${mode==='control'?'arbitro':'partidos'}/${A}`;
 const path=`/practica/nations/${E}${suffix}`;
 window.history.replaceState({},'',`${path}${mode==='control'?'#control='+CAP:''}`);
 const view=render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/practica/nations/:eventId" element={<NationsPracticePage mode="entry" api={api}/>}/><Route path="/practica/nations/:eventId/partidos/:boardId" element={<NationsPracticePage mode="viewer" api={api}/>}/><Route path="/practica/nations/:eventId/arbitro/:boardId" element={<NationsPracticePage mode="control" api={api}/>}/></Routes></MemoryRouter>);
 return {...view,api};
}
beforeEach(()=>{Object.defineProperty(window,'crypto',{configurable:true,value:{randomUUID:require('node:crypto').randomUUID}});jest.useFakeTimers();sessionStorage.clear();Object.defineProperty(document,'hidden',{configurable:true,value:false});});
afterEach(()=>{jest.useRealTimers();});
test('entry exposes exactly three public viewers and TV links, no private capability',async()=>{
 mount('entry');await flush();expect(screen.getAllByRole('link',{name:'Watch match'})).toHaveLength(3);expect(screen.getAllByRole('link',{name:'Open display'})).toHaveLength(3);
 for(const link of screen.getAllByRole('link'))expect(link.href).not.toContain('control=');
});
test('normal signed-in reader sees on-court and folded bench, never control actions; failed refresh removes LIVE',async()=>{
 const api=apiFor();mount('viewer',api);await flush();expect(screen.getByText('LIVE')).toBeInTheDocument();expect(screen.queryByRole('button',{name:'Punto para A'})).toBeNull();const benchDetails=screen.getByText('Substitutes').closest('details');expect(benchDetails).not.toHaveAttribute('open');
 api.board.mockRejectedValueOnce(new Error('network'));
 await act(async()=>{jest.advanceTimersByTime(2000);});await flush();expect(screen.getByText('Reconnecting…')).toBeInTheDocument();expect(screen.queryByText('LIVE')).toBeNull();
});
test('pending practice starts from the tactical panel and never resumes as if already started',async()=>{
 const api=apiFor();const pending={...control(),board:{...control().board,estado:'pendiente',cronometro_inicio:null,display:{displayA:0,displayB:0},score_a:0,score_b:0}};api.control.mockResolvedValueOnce(pending);mount('control',api);await flush();const start=screen.getByRole('button',{name:'Start match'});expect(start).toBeEnabled();fireEvent.click(start);await flush();expect(api.command.mock.calls[0][2]).toMatchObject({kind:'start'});
});
test('after POST the page publishes authoritative lineups/window before releasing controls',async()=>{
 const api=apiFor();mount('control',api);await flush();
 const activeA=[{...player('A',1),on_court:false},{...player('A',2),on_court:true},{...player('A',3),on_court:true},{...player('A',4),on_court:false}]; // A1/A4 bench after swap
 api.command.mockResolvedValueOnce({board:{...board(),practice_revision:1},revision:1,state:'en_curso'});
 api.control.mockResolvedValue({board:{...board(),practice_revision:1},revision:1,lineups:{A:activeA,B:[1,2,3,4].map(n=>player('B',n))},substitution_window:{allowed:false}});
 fireEvent.click(screen.getByRole('button',{name:'+ Point Azul'}));await flush();
 const bench=screen.getByRole('region',{name:'Bench for Azul'});expect(within(bench).getByRole('button',{name:/Jugador A1/})).toBeInTheDocument();expect(screen.getByText(/Change players after an odd game/)).toBeInTheDocument();
});
test('authoritative GET failure after a valid POST keeps the same retry and does not publish stale lineups',async()=>{
 const api=apiFor();mount('control',api);await flush();
 api.control.mockRejectedValueOnce(new Error('network after POST'));
 fireEvent.click(screen.getByRole('button',{name:'+ Point Azul'}));await flush();
 const first=api.command.mock.calls[0][2];expect(screen.getByRole('button',{name:'Retry the same attempt'})).toBeInTheDocument();
 api.control.mockRejectedValueOnce(new Error('network after retry'));
 fireEvent.click(screen.getByRole('button',{name:'Retry the same attempt'}));await flush();
 expect(api.command.mock.calls[1][2]).toEqual(first);
});
test('stale cached board blocks point commands during refresh outage and recovers after authoritative GET',async()=>{
 const api=apiFor();mount('control',api);await flush();const point=screen.getByRole('button',{name:'+ Point Azul'});expect(point).toBeEnabled();
 api.control.mockRejectedValueOnce(new Error('network'));
 await act(async()=>{jest.advanceTimersByTime(2000);});await flush();
 expect(screen.getByRole('button',{name:'+ Point Azul'})).toBeDisabled();
 api.control.mockResolvedValueOnce(control());
 await act(async()=>{jest.advanceTimersByTime(2000);});await flush();
 expect(screen.getByRole('button',{name:'+ Point Azul'})).toBeEnabled();
});
test('private control removes fragment and synchronous double tap sends one CAS command',async()=>{
 const api=apiFor();let resolve;api.command.mockImplementation(()=>new Promise(r=>{resolve=r;}));mount('control',api);await flush();expect(window.location.hash).toBe('');expect(api.control).toHaveBeenCalledWith(A,CAP,expect.any(AbortSignal));
 const add=screen.getByRole('button',{name:'+ Point Azul'});fireEvent.click(add);fireEvent.click(add);expect(api.command).toHaveBeenCalledTimes(1);expect(api.command.mock.calls[0][2]).toMatchObject({kind:'point',team:'A',expectedRevision:0});
 expect(api.command.mock.calls[0][2].requestId).toMatch(/^[0-9a-f-]{36}$/);await act(async()=>{resolve({board:board(),revision:1});});await flush();
});
test('uncertain response retries the identical request id and blocks another point',async()=>{
 const api=apiFor();api.command.mockRejectedValueOnce(new Error('network'));mount('control',api);await flush();fireEvent.click(screen.getByRole('button',{name:'+ Point Azul'}));await flush();const original=api.command.mock.calls[0][2];
 expect(screen.getByRole('button',{name:'+ Point Rojo'})).toBeDisabled();fireEvent.click(screen.getByRole('button',{name:'Retry the same attempt'}));await flush();expect(api.command.mock.calls[1][2]).toEqual(original);
});
test('CAS conflict refreshes without repeating the point',async()=>{
 const api=apiFor();api.command.mockRejectedValueOnce(Object.assign(new Error('stale'),{status:409}));mount('control',api);await flush();fireEvent.click(screen.getByRole('button',{name:'+ Point Azul'}));await flush();expect(api.command).toHaveBeenCalledTimes(1);expect(screen.getAllByRole('alert').some(node => /el punto no se repitió/.test(node.textContent || ''))).toBe(true);
});
test('tactical court substitution sends one atomic CAS swap from a selected court player',async()=>{
 const api=apiFor();mount('control',api);await flush();fireEvent.click(screen.getByRole('button',{name:'Replace Jugador A1 for Azul'}));const bench=screen.getByRole('region',{name:'Bench for Azul'});fireEvent.click(within(bench).getByRole('button',{name:/Jugador A3/}));await flush();expect(api.command.mock.calls[0][2]).toMatchObject({kind:'substitution',team:'A',swaps:[{outId:'A1',inId:'A3'}]});
});
test('missing capability does not request control or offer scoring',async()=>{
 const api=apiFor();window.history.replaceState({},'',`/practica/nations/${E}/arbitro/${A}`);
 render(<MemoryRouter initialEntries={[`/practica/nations/${E}/arbitro/${A}`]}><Routes><Route path="/practica/nations/:eventId/arbitro/:boardId" element={<NationsPracticePage mode="control" api={api}/>}/></Routes></MemoryRouter>);await flush();expect(api.control).not.toHaveBeenCalled();expect(api.command).not.toHaveBeenCalled();expect(screen.getByRole('alert')).toHaveTextContent('enlace privado');
});
test('API keeps capability only in header and request id has secure UUID fallback',async()=>{
 const fetchImpl=jest.fn(async()=>({ok:true,status:200,json:async()=>board()}));const api=createNationsPracticeApi({baseUrl:'https://api.example.invalid',fetchImpl});await api.board(A);await api.control(A,CAP);expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBeUndefined();expect(fetchImpl.mock.calls[1][0]).not.toContain(CAP);expect(fetchImpl.mock.calls[1][1].headers.Authorization).toBe('Bearer '+CAP);expect(practiceRequestId({getRandomValues:bytes=>bytes.fill(1)})).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
 const history={state:{},replaceState:jest.fn()},storage={setItem:jest.fn()};expect(consumePracticeControl(A,{hash:'#control='+CAP,pathname:'/private',search:''},history,storage)).toBe(CAP);expect(history.replaceState).toHaveBeenCalledWith({},'','/private');
});
test('a hung refresh cannot keep the LIVE badge beyond freshness limit',async()=>{
 const api=apiFor();mount('viewer',api);await flush();api.board.mockImplementation(()=>new Promise(()=>{}));await act(async()=>{jest.advanceTimersByTime(7000);});await flush();expect(screen.queryByText('LIVE')).toBeNull();expect(screen.getByText('Reconnecting…')).toBeInTheDocument();
});
test('visibility resume cannot be overwritten by an old aborted request',async()=>{
 const api=apiFor(),pending=[];api.board.mockImplementation(id=>new Promise(resolve=>pending.push({id,resolve})));mount('viewer',api);await flush();
 await act(async()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});
 await act(async()=>{pending[1].resolve(board(A,30));});await flush();expect(screen.getByRole('group',{name:'Points'})).toHaveTextContent('30');
 await act(async()=>{pending[0].resolve(board(A,15));});await flush();expect(screen.getByRole('group',{name:'Points'})).not.toHaveTextContent('15');
});
test('reset is explicit and carries only practice format after confirmation',async()=>{
 const api=apiFor();mount('control',api);await flush();fireEvent.click(screen.getByRole('button',{name:'Reiniciar esta práctica'}));expect(api.command).not.toHaveBeenCalled();fireEvent.change(screen.getByLabelText('Formato'),{target:{value:'knockout'}});fireEvent.click(screen.getByRole('button',{name:'Sí, reiniciar'}));await flush();expect(api.command.mock.calls[0][2]).toMatchObject({kind:'reset',format:'knockout'});
});
test('server pause freezes the clock and is never labelled live',async()=>{
 const api=apiFor();api.board.mockResolvedValue({...board(),cronometro_pausado:true,display:{displayA:0,displayB:0,cronometroActivo:false,cronometroSegundos:65}});mount('viewer',api);await flush();expect(screen.getByText('PAUSED')).toBeInTheDocument();await act(async()=>{jest.advanceTimersByTime(10000);});await flush();expect(screen.queryByText('LIVE')).toBeNull();
});
test('super tiebreak columns use points while ordinary tie break keeps 6-6 games',async()=>{
 const api=apiFor(),history=[{a:6,b:4},{a:3,b:6}];api.board.mockResolvedValue({...board(),games_a:0,games_b:0,sets_a:1,sets_b:1,historial_sets:history,display:{mode:'super_tiebreak',displayA:9,displayB:9}});mount('viewer',api);await flush();expect(screen.getByText('STB')).toBeInTheDocument();
 api.board.mockResolvedValue({...board(),games_a:6,games_b:6,sets_a:1,sets_b:1,historial_sets:history,display:{mode:'tiebreak',displayA:9,displayB:9}});await act(async()=>{jest.advanceTimersByTime(2000);});await flush();expect(screen.queryByText('STB')).toBeNull();expect(screen.getByText('SET 3')).toBeInTheDocument();
});
