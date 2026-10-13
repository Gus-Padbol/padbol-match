import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import NationsCupPanel from './NationsCupPanel';
import { readNationsCup, readNationsCupPublic, mutateNationsCup, nationsCupRequestId } from '../../utils/nationsCupApi';
jest.mock('../../i18n/tSafe',()=>({useSafeTranslation:()=>({i18n:{language:'es'}})}));
jest.mock('../../utils/nationsCupApi',()=>({NATIONS_STANDINGS_RULES:['points','set_difference','sets_for','game_difference','games_for'],readNationsCup:jest.fn(),readNationsCupPublic:jest.fn(),mutateNationsCup:jest.fn(),nationsCupRequestId:jest.fn(),createNationsScoreboard:jest.fn(),readNationsCupActa:jest.fn()}));
const equipos=Array.from({length:15},(_,i)=>({id:i+1,nombre:`Selección QA ${i+1}`,inscripcion_estado:'confirmado'}));
const state={ok:true,torneo_id:7,revision:1,config:{format:'nations_3x5',timezone:'Europe/Rome',rules:{standings:['points','set_difference'],placement_policy:'group_seed'}},status:'rules_pending',capabilities:{can_configure:true,can_draw:false,can_advance:false,can_schedule:false,can_close:false},groups:[],standings:[],thirds:[],qualified:[],bracket:[],matches:[],ties:[],courts:[]};
const props={apiBaseUrl:'https://fixture.invalid',torneo:{id:7},equipos,accessToken:'fixture-only',management:true};
beforeEach(()=>{jest.clearAllMocks();readNationsCup.mockResolvedValue(state);readNationsCupPublic.mockResolvedValue({...state,capabilities:Object.fromEntries(Object.keys(state.capabilities).map(k=>[k,false]))});nationsCupRequestId.mockReturnValue('00000000-0000-4000-8000-000000000001');});
test('rules require explicit approval and errors retain selection and the same request identity',async()=>{
 mutateNationsCup.mockRejectedValue(new Error('Respuesta ambigua'));render(<NationsCupPanel {...props}/>);const button=await screen.findByRole('button',{name:'Aprobar reglamento'});expect(button).toBeDisabled();fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(button);await screen.findByRole('alert');expect(screen.getByRole('checkbox')).toBeChecked();await waitFor(()=>expect(button).not.toBeDisabled());fireEvent.click(button);await waitFor(()=>expect(mutateNationsCup).toHaveBeenCalledTimes(2));expect(mutateNationsCup.mock.calls[0][2]).toEqual(mutateNationsCup.mock.calls[1][2]);expect(screen.queryByText(/Guardado y comprobado/)).not.toBeInTheDocument();
});
test('failed state query prevents every write and does not show empty successful competition',async()=>{readNationsCup.mockRejectedValue(new Error('Servicio no disponible'));render(<NationsCupPanel {...props}/>);await screen.findByRole('alert');expect(screen.queryByRole('button',{name:'Confirmar sorteo de tres grupos'})).not.toBeInTheDocument();expect(mutateNationsCup).not.toHaveBeenCalled();});
test('readonly public view never uses the private endpoint or enables mutations',async()=>{render(<NationsCupPanel {...props} management={false}/>);await screen.findByText(/Estado confirmado/);expect(readNationsCupPublic).toHaveBeenCalled();expect(readNationsCup).not.toHaveBeenCalled();expect(screen.queryByRole('button',{name:'Aprobar reglamento'})).not.toBeInTheDocument();expect(screen.getByRole('button',{name:'Confirmar avance de fase'})).toBeDisabled();});
test('draw requires exactly five confirmed teams per group and preserves every team once',async()=>{
 readNationsCup.mockResolvedValue({...state,status:'rules_approved',capabilities:{...state.capabilities,can_draw:true}});mutateNationsCup.mockResolvedValue({...state,revision:2,groups:['A','B','C'].map((label,i)=>({label,team_ids:equipos.slice(i*5,i*5+5).map(e=>e.id)}))});render(<NationsCupPanel {...props}/>);const button=await screen.findByRole('button',{name:'Confirmar sorteo de tres grupos'});fireEvent.click(button);await screen.findByRole('alert');expect(mutateNationsCup).not.toHaveBeenCalled();screen.getAllByRole('combobox').forEach((select,i)=>fireEvent.change(select,{target:{value:['A','B','C'][Math.floor(i/5)]}}));fireEvent.click(button);await screen.findByText(/Guardado y comprobado/);expect(mutateNationsCup.mock.calls[0][2].groups).toEqual([[1,2,3,4,5],[6,7,8,9,10],[11,12,13,14,15]]);
});
test('authoritative tie requires an explicit unique order and reason, never auto orders by name or ID',async()=>{
 readNationsCup.mockResolvedValue({...state,capabilities:{...state.capabilities,can_configure:false,can_advance:true,can_resolve_ties:true},groups:[{label:'A',team_ids:[1,2,3,4,5]}],ties:[{scope:'thirds',team_ids:[1,2],criteria:['points']}]});render(<NationsCupPanel {...props}/>);fireEvent.click(await screen.findByRole('button',{name:'Guardar decisiones de desempate'}));await screen.findByRole('alert');expect(mutateNationsCup).not.toHaveBeenCalled();const choices=screen.getAllByRole('combobox');fireEvent.change(choices[0],{target:{value:'2'}});fireEvent.change(choices[1],{target:{value:'1'}});fireEvent.change(screen.getByRole('textbox'),{target:{value:'Decisión deportiva aprobada en acta QA'}});mutateNationsCup.mockResolvedValue({...state,revision:2});fireEvent.click(screen.getByRole('button',{name:'Guardar decisiones de desempate'}));await waitFor(()=>expect(mutateNationsCup).toHaveBeenCalled());expect(mutateNationsCup.mock.calls[0][2].tie_resolutions[0].ordered_team_ids).toEqual([2,1]);
});
test('match schedule stores the event zone and server court, not browser zone or names',async()=>{
 const match={id:37,equipo_a_id:1,equipo_b_id:2,grupo:'A',estado:'pendiente',fecha_hora:null,cancha:null,duration_minutes:null};readNationsCup.mockResolvedValue({...state,groups:[{label:'A',team_ids:[1,2]}],capabilities:{...state.capabilities,can_schedule:true},matches:[match],courts:[{id:44,nombre:'Cancha QA'}]});mutateNationsCup.mockResolvedValue({...state,revision:2});const {container}=render(<NationsCupPanel {...props}/>);await screen.findByText('Cancha QA');fireEvent.change(container.querySelector('input[type="datetime-local"]'),{target:{value:'2026-11-22T10:30'}});fireEvent.change(screen.getByLabelText('Cancha'),{target:{value:'44'}});fireEvent.change(screen.getByLabelText('Duración (minutos)'),{target:{value:'60'}});fireEvent.click(screen.getByRole('button',{name:'Guardar programación editada'}));await waitFor(()=>expect(mutateNationsCup).toHaveBeenCalled());expect(mutateNationsCup.mock.calls[0][2].matches).toEqual([{partido_id:37,fecha_hora:'2026-11-22T09:30:00Z',court_id:44,duration_minutes:60}]);
});
test('late responses for a previous match context cannot update a new tournament',async()=>{
 let resolve;readNationsCup.mockImplementationOnce(()=>new Promise(done=>{resolve=done}));const callback=jest.fn();const rendered=render(<NationsCupPanel {...props} onState={callback}/>);rendered.unmount();await act(async()=>{resolve(state);});expect(callback).not.toHaveBeenCalled();
});

test('partial tie decisions are persisted before the next tie stage and cannot advance a provisional bracket',async()=>{
 const first={...state,capabilities:{...state.capabilities,can_configure:false,can_resolve_ties:true},groups:[{label:'A',team_ids:[1,2]}],ties:[{scope:'group:A:1-2',team_ids:[1,2],criteria:['points']}]};
 const second={...first,revision:2,ties:[{scope:'thirds:3-8-13',team_ids:[3,8,13],criteria:['points']}]};readNationsCup.mockResolvedValue(first);mutateNationsCup.mockResolvedValue(second);render(<NationsCupPanel {...props}/>);await screen.findByText(/group:A:1-2/);expect(screen.getByRole('button',{name:'Confirmar avance de fase'})).toBeDisabled();const choices=screen.getAllByRole('combobox');fireEvent.change(choices[0],{target:{value:'2'}});fireEvent.change(choices[1],{target:{value:'1'}});fireEvent.change(screen.getByRole('textbox'),{target:{value:'Decisión deportiva QA aprobada'}});fireEvent.click(screen.getByRole('button',{name:'Guardar decisiones de desempate'}));await screen.findByText(/thirds:3-8-13/);expect(mutateNationsCup.mock.calls[0][1]).toBe('resolveTies');expect(screen.getByRole('button',{name:'Confirmar avance de fase'})).toBeDisabled();expect(screen.getAllByRole('combobox')).toHaveLength(3);expect(screen.getByRole('textbox')).toHaveValue('');
});

test('finished fixtures cannot create a scoreboard and knockout origins remain explicit through schedule filtering',async()=>{
 const match=(id,round,position,estado='pendiente')=>({id,equipo_a_id:null,equipo_b_id:null,grupo:null,bracket_round:round,bracket_position:position,estado,fecha_hora:'2026-11-22T09:30:00Z',cancha:44,duration_minutes:60});
 readNationsCup.mockResolvedValue({...state,config:{...state.config,timezone:'Europe/Rome'},capabilities:{...state.capabilities,can_schedule:true},matches:[{...match(31,1,1,'finalizado'),equipo_a_id:1,equipo_b_id:2},match(35,2,1),match(36,2,2),match(37,3,1)],courts:[{id:44,nombre:'Cancha QA'}]});
 const {container}=render(<NationsCupPanel {...props} navigate={jest.fn()}/>);
 await screen.findByText('Ganador de cuarto 1 — Ganador de cuarto 2');
 expect(screen.getByText('Ganador de cuarto 3 — Ganador de cuarto 4')).toBeInTheDocument();
 expect(screen.getByText('Ganador de semifinal 1 — Ganador de semifinal 2')).toBeInTheDocument();
 expect(screen.getAllByRole('button',{name:'Abrir marcador de este partido'})[0]).toBeDisabled();
 expect(container.querySelector('input[type="datetime-local"]')).toBeDisabled();
 fireEvent.change(screen.getByLabelText('Filtrar programación por fase o grupo'),{target:{value:'round:3'}});
 expect(screen.queryByText('Ganador de cuarto 1 — Ganador de cuarto 2')).not.toBeInTheDocument();
 expect(screen.getByText('Ganador de semifinal 1 — Ganador de semifinal 2')).toBeInTheDocument();
 expect(screen.getAllByRole('button',{name:'Abrir marcador de este partido'})).toHaveLength(1);
});

test('public group fixtures use only revealed safe team names before standings exist',async()=>{
 readNationsCupPublic.mockResolvedValue({...state,teams:[{id:1,nombre:'País QA A'},{id:2,nombre:'País QA B'}],standings:[],matches:[{id:1,equipo_a_id:1,equipo_b_id:2,grupo:'A',estado:'pendiente'}]});
 render(<NationsCupPanel {...props} management={false}/>);expect(await screen.findByText('País QA A — País QA B')).toBeInTheDocument();expect(screen.queryByText('Selección QA 1 — Selección QA 2')).not.toBeInTheDocument();
});
test('court identity survives saved refetch, then a closed fixture is excluded from the next draft',async()=>{
 const match=id=>({id,equipo_a_id:1,equipo_b_id:2,grupo:'A',estado:'pendiente',fecha_hora:'2026-11-22T09:30:00Z',court_id:71101,cancha:'1',duration_minutes:60});
 const current={...state,capabilities:{...state.capabilities,can_schedule:true},matches:[match(1),match(2)],courts:[{id:71101,nombre:'Cancha QA ordinal 1'}]};
 readNationsCup.mockResolvedValue(current);mutateNationsCup.mockResolvedValue({...current,revision:2});const {container,rerender}=render(<NationsCupPanel {...props}/>);await screen.findAllByText('Selección QA 1 — Selección QA 2');
 expect(screen.getAllByLabelText('Cancha')[0]).toHaveValue('71101');
 fireEvent.change(container.querySelector('input[type="datetime-local"]'),{target:{value:'2026-11-22T11:30'}});fireEvent.click(screen.getByRole('button',{name:'Guardar programación editada'}));await waitFor(()=>expect(mutateNationsCup).toHaveBeenCalledTimes(1));expect(mutateNationsCup.mock.calls[0][2].matches[0].court_id).toBe(71101);
 await waitFor(()=>expect(screen.getByRole('button',{name:'Guardar programación editada'})).toBeDisabled());
 readNationsCup.mockResolvedValue({...current,revision:3,matches:[{...match(1),estado:'finalizado'},match(2)]});rerender(<NationsCupPanel {...props} refreshKey="closed"/>);await waitFor(()=>expect(container.querySelector('input[type="datetime-local"]')).toBeDisabled());
 fireEvent.change(container.querySelectorAll('input[type="datetime-local"]')[1],{target:{value:'2026-11-22T12:30'}});fireEvent.click(screen.getByRole('button',{name:'Guardar programación editada'}));await waitFor(()=>expect(mutateNationsCup).toHaveBeenCalledTimes(2));expect(mutateNationsCup.mock.calls[1][2].matches).toEqual([{partido_id:2,fecha_hora:'2026-11-22T11:30:00Z',court_id:71101,duration_minutes:60}]);
});

test('an explicitly chosen reveal time uses the event zone and is not presumed from the ceremony',async()=>{
 readNationsCup.mockResolvedValue({...state,config:null});mutateNationsCup.mockResolvedValue({...state,revision:2});render(<NationsCupPanel {...props}/>);
 fireEvent.change(await screen.findByLabelText('Zona horaria del evento (IANA)'),{target:{value:'Europe/Rome'}});
 fireEvent.change(screen.getByLabelText('Revelación pública (opcional, hora del evento)'),{target:{value:'2026-11-20T18:00'}});
 screen.getAllByLabelText(/país ISO de dos letras/).forEach(input=>fireEvent.change(input,{target:{value:'IT'}}));
 fireEvent.click(screen.getByRole('button',{name:'Guardar configuración propuesta'}));await waitFor(()=>expect(mutateNationsCup).toHaveBeenCalled());expect(mutateNationsCup.mock.calls[0][2].config.reveal_at).toBe('2026-11-20T17:00:00Z');
});


test('third place is an explicit saved rule; editing an existing 37-match plan preserves false',async()=>{
 readNationsCup.mockResolvedValue({...state,config:null});mutateNationsCup.mockResolvedValue({...state,revision:2,config:{...state.config,rules:{...state.config.rules,third_place_match:true}}});render(<NationsCupPanel {...props}/>);
 fireEvent.change(await screen.findByLabelText('Zona horaria del evento (IANA)'),{target:{value:'Europe/Rome'}});
 screen.getAllByLabelText(/país ISO de dos letras/).forEach(input=>fireEvent.change(input,{target:{value:'IT'}}));
 const checkbox=screen.getByRole('checkbox',{name:/Incluir partido por el tercer puesto/});expect(checkbox).not.toBeChecked();fireEvent.click(checkbox);fireEvent.click(screen.getByRole('button',{name:'Guardar configuración propuesta'}));
 await waitFor(()=>expect(mutateNationsCup).toHaveBeenCalled());expect(mutateNationsCup.mock.calls[0][2].config.rules.third_place_match).toBe(true);await screen.findByText(/Tercer puesto incluido: 38 partidos/);
});
test('bronze displays semifinal losers and shares the final scheduling stage without confusing its outcome',async()=>{
 const matches=[{id:37,bracket_round:3,bracket_position:1,estado:'pendiente'},{id:38,bracket_round:3,bracket_position:2,estado:'pendiente'}];
 readNationsCup.mockResolvedValue({...state,config:{...state.config,rules:{...state.config.rules,third_place_match:true}},matches});render(<NationsCupPanel {...props}/>);
 await screen.findByText('Perdedor de semifinal 1 — Perdedor de semifinal 2');expect(screen.getByText('Ganador de semifinal 1 — Ganador de semifinal 2')).toBeInTheDocument();expect(screen.getByRole('option',{name:'Final y tercer puesto'})).toBeInTheDocument();fireEvent.change(screen.getByLabelText('Filtrar programación por fase o grupo'),{target:{value:'round:3'}});expect(screen.getAllByRole('button',{name:'Abrir marcador de este partido'})).toHaveLength(2);
});
