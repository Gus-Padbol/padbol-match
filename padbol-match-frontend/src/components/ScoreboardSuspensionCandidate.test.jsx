import React, {useState} from 'react';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import ScoreboardSuspensionCandidate from './ScoreboardSuspensionCandidate';
import {fetchScoreboardCourts,scoreboardSuspensionAction,reconcileScoreboardSuspension} from '../utils/scoreboardApi';
jest.mock('../utils/scoreboardApi',()=>({fetchScoreboardCourts:jest.fn(),scoreboardSuspensionAction:jest.fn(),reconcileScoreboardSuspension:jest.fn()}));
const key='padbol:scoreboard:suspension-uncertain:board-1';
const actionKey=`${key}:action:12345678-1234-4234-8234-123456789abc`;
function Harness({initial='en_curso'}){const [board,setBoard]=useState({id:'board-1',sede_id:8,estado:initial,updated_at:'2026-10-21T12:00:00Z'});const [pending,setPending]=useState(Boolean(localStorage.getItem(key)||localStorage.getItem(actionKey))); return <ScoreboardSuspensionCandidate partido={board} pending={pending} onPending={setPending} onConfirmed={setBoard} refresh={jest.fn(async()=>board)} />}
beforeEach(()=>{Object.defineProperty(window,'crypto',{configurable:true,value:{randomUUID:()=> '12345678-1234-4234-8234-123456789abc'}});localStorage.clear();jest.resetAllMocks();fetchScoreboardCourts.mockResolvedValue([{id:13,nombre:'Cancha 1',estado:'activa'}])});
test('suspends with reason and revision, then shows reactivation with real court',async()=>{
 scoreboardSuspensionAction.mockResolvedValue({id:'board-1',sede_id:8,estado:'suspendido',updated_at:'2026-10-21T12:01:00Z',transition_receipt:{action_id:'12345678-1234-4234-8234-123456789abc',action:'suspend',status:'applied'}});
 render(<Harness/>);fireEvent.change(screen.getByLabelText('Motivo de suspensión'),{target:{value:'Lluvia'}});fireEvent.click(screen.getByRole('button',{name:'Suspender partido'}));
 await screen.findByText(/Partido suspendido/);expect(scoreboardSuspensionAction).toHaveBeenCalledWith('board-1','suspend',{action_id:'12345678-1234-4234-8234-123456789abc',updated_at:'2026-10-21T12:00:00Z',reason:'Lluvia'});expect(localStorage.getItem(key)).toBeNull();expect(await screen.findByRole('option',{name:'Cancha 1'})).toBeInTheDocument();
});
test('uncertain response blocks another attempt even after reload',async()=>{
 scoreboardSuspensionAction.mockRejectedValue(new Error('lost response'));
 const first=render(<Harness/>);fireEvent.change(screen.getByLabelText('Motivo de suspensión'),{target:{value:'Lluvia'}});fireEvent.click(screen.getByRole('button',{name:'Suspender partido'}));
 await waitFor(()=>expect(screen.getByText(/No se pudo confirmar el resultado/)).toBeInTheDocument());expect(localStorage.getItem(actionKey)).not.toBeNull();first.unmount();render(<Harness/>);
 expect(screen.queryByRole('button',{name:'Suspender partido'})).not.toBeInTheDocument();expect(screen.getByText(/sin confirmar/)).toBeInTheDocument();expect(scoreboardSuspensionAction).toHaveBeenCalledTimes(1);
});
test('restarts on selected court without starting clock',async()=>{
 scoreboardSuspensionAction.mockResolvedValue({id:'board-1',sede_id:8,estado:'en_curso',updated_at:'2026-10-21T12:01:00Z',cronometro_pausado:true,transition_receipt:{action_id:'12345678-1234-4234-8234-123456789abc',action:'resume',status:'applied'}});
 render(<Harness initial="suspendido"/>);await screen.findByRole('option',{name:'Cancha 1'});fireEvent.change(screen.getByLabelText('Cancha'),{target:{value:'13'}});fireEvent.click(screen.getByRole('button',{name:'Reanudar en esta cancha'}));
 await waitFor(()=>expect(scoreboardSuspensionAction).toHaveBeenCalledWith('board-1','resume',{action_id:'12345678-1234-4234-8234-123456789abc',updated_at:'2026-10-21T12:00:00Z',court_id:13,duration_minutes:90}));await waitFor(()=>expect(localStorage.getItem(key)).toBeNull());
});

test('una respuesta tardía no borra otra referencia pendiente del mismo marcador',async()=>{
 let resolve;scoreboardSuspensionAction.mockReturnValue(new Promise(r=>{resolve=r}));
 render(<Harness/>);fireEvent.change(screen.getByLabelText('Motivo de suspensión'),{target:{value:'Lluvia'}});fireEvent.click(screen.getByRole('button',{name:'Suspender partido'}));
 const other={action:'resume',body:{action_id:'99999999-9999-4999-8999-999999999999',updated_at:'2026-10-21T12:01:00Z',court_id:13,duration_minutes:90}};localStorage.setItem(key,JSON.stringify(other));
 resolve({id:'board-1',sede_id:8,estado:'suspendido',updated_at:'2026-10-21T12:01:00Z',transition_receipt:{action_id:'12345678-1234-4234-8234-123456789abc',action:'suspend',status:'applied'}});
 await screen.findByText(/otra referencia pendiente/);expect(JSON.parse(localStorage.getItem(key))).toEqual(other);expect(screen.getByRole('button',{name:'Recuperar operación'})).toBeInTheDocument();
});
test('no reemplaza una referencia que ya existe al confirmar',async()=>{
 render(<Harness/>);fireEvent.change(screen.getByLabelText('Motivo de suspensión'),{target:{value:'Lluvia'}});
 const other={action:'suspend',body:{action_id:'99999999-9999-4999-8999-999999999999',updated_at:'2026-10-21T12:00:00Z',reason:'Lluvia'}};localStorage.setItem(key,JSON.stringify(other));
 fireEvent.click(screen.getByRole('button',{name:'Suspender partido'}));expect(JSON.parse(localStorage.getItem(key))).toEqual(other);expect(scoreboardSuspensionAction).not.toHaveBeenCalled();expect(screen.getByRole('button',{name:'Recuperar operación'})).toBeInTheDocument();
});
test('dos referencias simultáneas quedan separadas y se recuperan sin perder ninguna',async()=>{
 const a='12345678-1234-4234-8234-123456789abc',b='99999999-9999-4999-8999-999999999999';
 const first={action:'suspend',body:{action_id:a,updated_at:'2026-10-21T12:00:00Z',reason:'Lluvia'}};
 const second={action:'resume',body:{action_id:b,updated_at:'2026-10-21T12:01:00Z',court_id:13,duration_minutes:90}};
 localStorage.setItem(`${key}:action:${a}`,JSON.stringify(first));localStorage.setItem(`${key}:action:${b}`,JSON.stringify(second));
 scoreboardSuspensionAction.mockImplementation(async (_id,action,body)=>({id:'board-1',sede_id:8,estado:action==='suspend'?'suspendido':'en_curso',updated_at:'2026-10-21T12:01:00Z',transition_receipt:{action_id:body.action_id,action,status:'replayed'}}));
 render(<Harness/>);fireEvent.click(screen.getByRole('button',{name:'Recuperar operación 1'}));
 await waitFor(()=>expect(localStorage.getItem(`${key}:action:${a}`)).toBeNull());expect(localStorage.getItem(`${key}:action:${b}`)).not.toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Recuperar operación'}));await waitFor(()=>expect(localStorage.getItem(`${key}:action:${b}`)).toBeNull());expect(scoreboardSuspensionAction).toHaveBeenCalledTimes(2);
});
test('una operación creada en otra pestaña bloquea la nueva acción',async()=>{
 render(<Harness/>);const other={action:'suspend',body:{action_id:'99999999-9999-4999-8999-999999999999',updated_at:'2026-10-21T12:00:00Z',reason:'Lluvia'}};
 const otherKey=`${key}:action:${other.body.action_id}`;localStorage.setItem(otherKey,JSON.stringify(other));
 fireEvent(window,new StorageEvent('storage',{key:otherKey,newValue:JSON.stringify(other),storageArea:localStorage}));
 expect(await screen.findByRole('button',{name:'Recuperar operación'})).toBeInTheDocument();expect(screen.queryByRole('button',{name:'Suspender partido'})).not.toBeInTheDocument();expect(scoreboardSuspensionAction).not.toHaveBeenCalled();
});
test.each([['cancelled','quedó cancelada'],['applied','ya se había realizado']])('conciliación %s informa el resultado y libera solo la referencia confirmada',async(status,message)=>{
 const id='12345678-1234-4234-8234-123456789abc';localStorage.setItem(actionKey,JSON.stringify({action:'suspend',body:{action_id:id,updated_at:'2026-10-21T12:00:00Z',reason:'Lluvia'}}));
 reconcileScoreboardSuspension.mockResolvedValue({id:'board-1',sede_id:8,estado:status==='applied'?'suspendido':'en_curso',updated_at:'2026-10-21T12:01:00Z',transition_receipt:{action_id:id,action:'suspend',status}});
 render(<Harness/>);fireEvent.click(screen.getByRole('button',{name:'Verificar y cancelar si sigue pendiente'}));
 expect(await screen.findByText(new RegExp(message))).toBeInTheDocument();expect(localStorage.getItem(actionKey)).toBeNull();expect(reconcileScoreboardSuspension).toHaveBeenCalledWith('board-1','suspend',id);
});
test('una conciliación sin respuesta conserva la referencia',async()=>{
 const id='12345678-1234-4234-8234-123456789abc';localStorage.setItem(actionKey,JSON.stringify({action:'suspend',body:{action_id:id,updated_at:'2026-10-21T12:00:00Z',reason:'Lluvia'}}));reconcileScoreboardSuspension.mockRejectedValue(new Error('offline'));
 render(<Harness/>);fireEvent.click(screen.getByRole('button',{name:'Verificar y cancelar si sigue pendiente'}));await screen.findByText(/No se pudo confirmar el resultado/);expect(localStorage.getItem(actionKey)).not.toBeNull();
});
