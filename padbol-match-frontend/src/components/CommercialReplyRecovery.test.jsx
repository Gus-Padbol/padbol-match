import React from 'react';
import {render,screen,fireEvent,waitFor,act} from '@testing-library/react';
import CommercialCaseDetail from './CommercialCaseDetail';
import CommercialTeamWorkspace from './CommercialTeamWorkspace';
jest.mock('./CommercialLeadManagement',()=>()=>null);
jest.mock('./CommercialAgendaAlerts',()=>()=>null);
jest.mock('./CommercialAssignments',()=>()=>null);
jest.mock('./CrmEmailHistory',()=>()=>null);
const item={id:'case',channel:'form'};
const makeApi=()=>({readCase:jest.fn().mockResolvedValue({contact:{name:'Cliente'},status:'open'}),listActivities:jest.fn().mockResolvedValue({activities:[]}),reply:jest.fn().mockResolvedValue({status:'sent'}),getRole:jest.fn().mockResolvedValue({role:'advisor'}),listCases:jest.fn().mockResolvedValue({cases:[{...item,contact:{name:'Cliente'}}]})});
beforeEach(()=>{Object.defineProperty(window,'crypto',{configurable:true,value:{randomUUID:jest.fn().mockReturnValue('11111111-1111-4111-8111-111111111111')}});});
async function compose(){await screen.findByLabelText('Respuesta');fireEvent.change(screen.getByLabelText('Respuesta'),{target:{value:'Borrador de respuesta'}});fireEvent.click(screen.getByText('Enviar respuesta'));}
test.each([[401,'UNAUTHENTICATED'],[403,'FORBIDDEN'],[400,'INVALID_REPLY'],[400,'INVALID_CHANNEL'],[409,'CHANNEL_UNAVAILABLE']])('known pre-dispatch rejection %s/%s preserves draft and stable ID for a manual retry',async(status,code)=>{
 const api=makeApi();api.reply.mockRejectedValueOnce({status,code});render(<CommercialCaseDetail item={item} api={api}/>);await compose();
 await waitFor(()=>expect(screen.getByRole('alert')).toBeInTheDocument());expect(screen.getByLabelText('Respuesta')).toHaveValue('Borrador de respuesta');expect(screen.getByText('Enviar respuesta')).toBeEnabled();expect(api.reply).toHaveBeenCalledTimes(1);
 fireEvent.click(screen.getByText('Enviar respuesta'));await waitFor(()=>expect(api.reply).toHaveBeenCalledTimes(2));expect(api.reply.mock.calls[1]).toEqual(api.reply.mock.calls[0]);expect(window.crypto.randomUUID).toHaveBeenCalledTimes(1);
});
test.each([[401,'UNAVAILABLE'],[403,'PROVIDER_FORBIDDEN'],[403,undefined],[409,'REPLY_PENDING'],[503,'UNAUTHENTICATED'],[503,'UNAVAILABLE'],[undefined,undefined]])('ambiguous rejection %s/%s remains blocked without resending',async(status,code)=>{
 const api=makeApi();api.reply.mockRejectedValue({status,code});render(<CommercialCaseDetail item={item} api={api}/>);await compose();
 await waitFor(()=>expect(screen.getByText('Enviar respuesta')).toBeDisabled());expect(screen.getByLabelText('Respuesta')).toHaveValue('Borrador de respuesta');fireEvent.click(screen.getByText('Enviar respuesta'));expect(api.reply).toHaveBeenCalledTimes(1);
});
test.each(['uncertain','already_attempted','cancelled'])('non-confirmed result %s stays blocked',async status=>{const api=makeApi();api.reply.mockResolvedValue({status});render(<CommercialCaseDetail item={item} api={api}/>);await compose();await waitFor(()=>expect(screen.getByText('Enviar respuesta')).toBeDisabled());expect(api.reply).toHaveBeenCalledTimes(1);});
test('API renewal preserves draft, request ID and uncertainty without automatic sending',async()=>{
 const api=makeApi();api.reply.mockRejectedValueOnce({status:401,code:'UNAUTHENTICATED'});const view=render(<CommercialCaseDetail item={item} api={api}/>);await compose();await screen.findByText(/Tu sesión no es válida/);
 const renewed=makeApi();renewed.reply.mockResolvedValue({status:'uncertain'});await act(async()=>{view.rerender(<CommercialCaseDetail item={item} api={renewed}/>);});expect(screen.getByLabelText('Respuesta')).toHaveValue('Borrador de respuesta');expect(renewed.reply).not.toHaveBeenCalled();
 fireEvent.click(screen.getByText('Enviar respuesta'));await waitFor(()=>expect(screen.getByText('Enviar respuesta')).toBeDisabled());expect(renewed.reply.mock.calls[0]).toEqual(api.reply.mock.calls[0]);
 const third=makeApi();await act(async()=>{view.rerender(<CommercialCaseDetail item={item} api={third}/>);});expect(screen.getByText('Enviar respuesta')).toBeDisabled();expect(screen.getByRole('alert')).toHaveTextContent('Revisa el historial');expect(third.reply).not.toHaveBeenCalled();
});
test('workspace keeps selected detail and draft when API renews for the same user',async()=>{
 const api=makeApi();const view=render(<CommercialTeamWorkspace api={api} currentUserId="nico"/>);fireEvent.click(await screen.findByRole('button',{name:/Cliente/}));await screen.findByLabelText('Respuesta');fireEvent.change(screen.getByLabelText('Respuesta'),{target:{value:'Conservar'}});
 const renewed=makeApi();view.rerender(<CommercialTeamWorkspace api={renewed} currentUserId="nico"/>);await waitFor(()=>expect(renewed.readCase).toHaveBeenCalled());expect(screen.getByLabelText('Respuesta')).toHaveValue('Conservar');expect(renewed.reply).not.toHaveBeenCalled();
 view.rerender(<CommercialTeamWorkspace api={renewed} currentUserId="otro"/>);expect(screen.queryByLabelText('Respuesta')).not.toBeInTheDocument();
});
test('changed text or case gets a fresh ID after a confirmed rejection',async()=>{
 window.crypto.randomUUID.mockReturnValueOnce('first').mockReturnValueOnce('second').mockReturnValueOnce('third');
 const api=makeApi();api.reply.mockRejectedValue({status:400,code:'INVALID_REPLY'});const view=render(<CommercialCaseDetail item={item} api={api}/>);await compose();await screen.findByRole('alert');
 fireEvent.change(screen.getByLabelText('Respuesta'),{target:{value:'Texto corregido'}});fireEvent.click(screen.getByText('Enviar respuesta'));await waitFor(()=>expect(api.reply).toHaveBeenCalledTimes(2));expect(api.reply.mock.calls[1][3]).toBe('second');
 await act(async()=>{view.rerender(<CommercialCaseDetail item={{id:'other',channel:'form'}} api={api}/>);});expect(screen.getByLabelText('Respuesta')).toHaveValue('');await compose();await waitFor(()=>expect(api.reply).toHaveBeenCalledTimes(3));expect(api.reply.mock.calls[2][0]).toBe('other');expect(api.reply.mock.calls[2][3]).toBe('third');
});
test.each(['forbidden','unknown','excluded'])('renewal with %s access hides the previous selected case',async mode=>{
 const api=makeApi();const view=render(<CommercialTeamWorkspace api={api} currentUserId="nico"/>);fireEvent.click(await screen.findByRole('button',{name:/Cliente/}));await screen.findByLabelText('Respuesta');
 const renewed=makeApi();if(mode==='forbidden')renewed.getRole.mockRejectedValue({status:403,code:'FORBIDDEN'});if(mode==='unknown')renewed.getRole.mockResolvedValue({role:'unknown'});if(mode==='excluded')renewed.listCases.mockResolvedValue({cases:[]});
 await act(async()=>{view.rerender(<CommercialTeamWorkspace api={renewed} currentUserId="nico"/>);});expect(screen.queryByLabelText('Respuesta')).not.toBeInTheDocument();expect(renewed.reply).not.toHaveBeenCalled();
});
test('temporary auth failure preserves draft but disables actions until revalidation succeeds',async()=>{
 const api=makeApi();const view=render(<CommercialTeamWorkspace api={api} currentUserId="nico"/>);fireEvent.click(await screen.findByRole('button',{name:/Cliente/}));await screen.findByLabelText('Respuesta');fireEvent.change(screen.getByLabelText('Respuesta'),{target:{value:'Conservar'}});
 const failed=makeApi();failed.getRole.mockRejectedValue({status:401,code:'UNAUTHENTICATED'});await act(async()=>{view.rerender(<CommercialTeamWorkspace api={failed} currentUserId="nico"/>);});expect(screen.getByLabelText('Respuesta')).toHaveValue('Conservar');expect(screen.getByText('Enviar respuesta')).toBeDisabled();fireEvent.click(screen.getByText('Enviar respuesta'));expect(failed.reply).not.toHaveBeenCalled();
 const renewed=makeApi();await act(async()=>{view.rerender(<CommercialTeamWorkspace api={renewed} currentUserId="nico"/>);});expect(screen.getByLabelText('Respuesta')).toHaveValue('Conservar');expect(screen.getByText('Enviar respuesta')).toBeEnabled();expect(screen.queryByRole('alert')).not.toBeInTheDocument();expect(renewed.reply).not.toHaveBeenCalled();
});
test('a forbidden detail revalidation hides confidential previous data',async()=>{
 const api=makeApi();const view=render(<CommercialCaseDetail item={item} api={api}/>);await screen.findByLabelText('Respuesta');const renewed=makeApi();renewed.readCase.mockRejectedValue({status:403,code:'FORBIDDEN'});await act(async()=>{view.rerender(<CommercialCaseDetail item={item} api={renewed}/>);});expect(screen.queryByText('Cliente')).not.toBeInTheDocument();expect(screen.queryByLabelText('Respuesta')).not.toBeInTheDocument();expect(renewed.reply).not.toHaveBeenCalled();
});
