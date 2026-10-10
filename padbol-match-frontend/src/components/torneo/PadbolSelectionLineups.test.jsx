import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import PadbolSelectionLineups from './PadbolSelectionLineups';
import { getAuthHeaders } from '../../utils/scoreboardApi';
jest.mock('../../utils/scoreboardApi',()=>({getAuthHeaders:jest.fn()}));
jest.mock('../../i18n/tSafe',()=>({useSafeTranslation:()=>({t:(key,opts)=>opts?.defaultValue||key,i18n:{language:'es'}})}));
const uuid=i=>`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`;
const players=offset=>Array.from({length:8},(_,i)=>({user_id:uuid(offset+i),nombre:`QA player ${offset+i}`,estado:'confirmado'}));
const equipos=[{id:71,nombre:'QA A'},{id:72,nombre:'QA B'}];
const props={apiBaseUrl:'https://fixture.invalid',torneoId:9,partido:{id:33,equipo_a_id:71,equipo_b_id:72},equipos};
let stored;let failure;let readonly;let delayed;
const dto=(match,team)=>({ok:true,torneo_id:9,partido_id:match,equipo_id:team,required:true,can_edit:!readonly,plantel:players(team===71?1:11),alineacion:stored.get(`${match}:${team}`)||null,alternancia:'games_impares'});
const response=(data,ok=true,status=200)=>({ok,status,json:async()=>data});
beforeEach(()=>{
 stored=new Map();failure=null;readonly=false;delayed=null;
 getAuthHeaders.mockResolvedValue({'Content-Type':'application/json',Authorization:'Bearer local-fixture'});
 global.fetch=jest.fn(async(url,options)=>{
  const m=url.match(/partidos\/(\d+)\/equipos\/(\d+)\/alineacion$/);if(!m)throw Error('Unexpected fixture route');const match=Number(m[1]);const team=Number(m[2]);
  if(options.method==='PUT'){
   if(delayed)return delayed;
   if(failure)return failure;
   const body=JSON.parse(options.body);stored.set(`${match}:${team}`,{iniciales:body.iniciales,suplentes:body.suplentes,revision:body.expected_revision+1});
  }
  return response(dto(match,team));
 });
});
const a=()=>screen.getByRole('form',{name:'Alineación QA A'});
const fillA=()=>{
 fireEvent.change(within(a()).getByLabelText('Inicial 1'),{target:{value:uuid(1)}});
 fireEvent.change(within(a()).getByLabelText('Inicial 2'),{target:{value:uuid(2)}});
 fireEvent.change(within(a()).getByLabelText('Suplente 1'),{target:{value:uuid(3)}});
 fireEvent.change(within(a()).getByLabelText('Suplente 2'),{target:{value:uuid(4)}});
};
const putCalls=()=>fetch.mock.calls.filter(([,opts])=>opts.method==='PUT');
const savedB=()=>stored.set('33:72',{iniciales:[uuid(11),uuid(12)],suplentes:[uuid(13),uuid(14)],revision:1});
test('stores only four players with revision and confirms by real GET before readiness; roster stays eight',async()=>{
 savedB();const ready=jest.fn();render(<PadbolSelectionLineups {...props} onReadyChange={ready}/>);
 await within(a()).findByLabelText('Inicial 1');fillA();fireEvent.submit(a());
 await within(a()).findByText('Alineación guardada y verificada.');expect(putCalls()).toHaveLength(1);
 expect(JSON.parse(putCalls()[0][1].body)).toEqual({iniciales:[uuid(1),uuid(2)],suplentes:[uuid(3),uuid(4)],expected_revision:0});
 await waitFor(()=>expect(ready).toHaveBeenLastCalledWith(true));expect(dto(33,71).plantel).toHaveLength(8);
 expect(screen.getByText(/Siempre juegan dos en cancha/)).toBeInTheDocument();expect(screen.getByText(/no registra los cambios game por game/)).toBeInTheDocument();
});
test('reload recovers persisted starting players and substitutes without asking to fill roster eight',async()=>{
 savedB();stored.set('33:71',{iniciales:[uuid(1),uuid(2)],suplentes:[uuid(3),uuid(4)],revision:2});const ready=jest.fn();const first=render(<PadbolSelectionLineups {...props} onReadyChange={ready}/>);
 await waitFor(()=>expect(ready).toHaveBeenLastCalledWith(true));first.unmount();ready.mockClear();render(<PadbolSelectionLineups {...props} onReadyChange={ready}/>);
 await waitFor(()=>expect(within(a()).getByLabelText('Suplente 2')).toHaveValue(uuid(4)));expect(putCalls()).toHaveLength(0);await waitFor(()=>expect(ready).toHaveBeenLastCalledWith(true));
});
test('duplicate or outsider forced declarations never issue a PUT',async()=>{
 render(<PadbolSelectionLineups {...props}/>);await within(a()).findByLabelText('Inicial 1');fillA();fireEvent.change(within(a()).getByLabelText('Suplente 2'),{target:{value:uuid(1)}});fireEvent.submit(a());
 expect(await within(a()).findByRole('alert')).toHaveTextContent(/no pueden repetirse/);expect(putCalls()).toHaveLength(0);
 const select=within(a()).getByLabelText('Suplente 2');const option=document.createElement('option');option.value=uuid(99);select.appendChild(option);fireEvent.change(select,{target:{value:uuid(99)}});fireEvent.submit(a());expect(await within(a()).findByRole('alert')).toHaveTextContent(/pertenecer/);expect(putCalls()).toHaveLength(0);
});
test('auditor/read-only permission cannot save even with forced form submission',async()=>{
 readonly=true;render(<PadbolSelectionLineups {...props}/>);await within(a()).findByLabelText('Inicial 1');expect(within(a()).getByLabelText('Inicial 1')).toBeDisabled();fireEvent.submit(a());expect(putCalls()).toHaveLength(0);expect(within(a()).queryByText('Guardar los cuatro presentados')).not.toBeInTheDocument();
});
test.each([403,409,503])('API error %s preserves composition and blocks result readiness',async status=>{
 failure=response({error:status===409?'La revisión cambió. Recarga.':'No se confirmó el guardado.'},false,status);const ready=jest.fn();render(<PadbolSelectionLineups {...props} onReadyChange={ready}/>);await within(a()).findByLabelText('Inicial 1');fillA();fireEvent.submit(a());await within(a()).findByRole('alert');expect(within(a()).getByLabelText('Inicial 1')).toHaveValue(uuid(1));expect(ready).toHaveBeenLastCalledWith(false);expect(within(a()).queryByText('Alineación guardada y verificada.')).not.toBeInTheDocument();
});
test('generic ok without matching persisted lineup is rejected without a success notice',async()=>{
 failure=response({ok:true});render(<PadbolSelectionLineups {...props}/>);await within(a()).findByLabelText('Inicial 1');fillA();fireEvent.submit(a());expect(await within(a()).findByRole('alert')).toHaveTextContent(/no confirmó/);expect(within(a()).queryByText('Alineación guardada y verificada.')).not.toBeInTheDocument();
});
test('double click claims one save, and an old-match error never leaks into the next match',async()=>{
 let reject;delayed=new Promise((_,no)=>{reject=no});const view=render(<PadbolSelectionLineups key="33" {...props}/>);await within(a()).findByLabelText('Inicial 1');fillA();fireEvent.submit(a());fireEvent.submit(a());await waitFor(()=>expect(putCalls()).toHaveLength(1));
 view.rerender(<PadbolSelectionLineups key="34" {...props} partido={{...props.partido,id:34}}/>);await within(a()).findByLabelText('Inicial 1');reject(Error('Old match error'));await waitFor(()=>expect(within(a()).getByLabelText('Inicial 1')).toHaveValue(''));expect(screen.queryByText('Old match error')).not.toBeInTheDocument();
});
