import React from 'react';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import CommercialLeadManagement,{resolveCommercialLead} from './CommercialLeadManagement';
function apiFixture(){return {getRole:jest.fn().mockResolvedValue({role:'manager'}),resolveConversation:jest.fn().mockResolvedValue({id:'case',channel:'form'}),readCase:jest.fn().mockResolvedValue({id:'case',version:4,progressState:'nuevo',assignedAdvisor:{id:'nico',name:'Nico'}}),listCalls:jest.fn().mockResolvedValue({calls:[]}),listActivities:jest.fn().mockResolvedValue({activities:[]}),listAdvisors:jest.fn().mockResolvedValue({advisors:[{id:'nico',name:'Nico',active:true},{id:'claire',name:'Claire',active:true}]}),startCall:jest.fn().mockResolvedValue({id:'call',status:'pending'}),completeCall:jest.fn().mockResolvedValue({status:'completed'}),progress:jest.fn().mockResolvedValue({}),assign:jest.fn().mockResolvedValue({})};}
const conversation={id:'conversation',source_channel:'email'};
test('advance requires summary, situation, details and next step; saves summary before progress',async()=>{
 const api=apiFixture();render(<CommercialLeadManagement conversation={conversation} api={api}/>);await screen.findByText('Nico',{selector:'strong'});
 fireEvent.change(screen.getByLabelText('Estado comercial'),{target:{value:'en_espera'}});expect(screen.getByText('Guardar atención y próximo paso')).toBeDisabled();
 for(const [label,value] of [['Qué se habló','Quiere dos canchas'],['Situación actual','Evaluando presupuesto'],['Detalles importantes','Proyecto en Texas'],['Próximo paso','Llamar el martes']])fireEvent.change(screen.getByLabelText(label),{target:{value}});
 fireEvent.click(screen.getByText('Guardar atención y próximo paso'));
 await waitFor(()=>expect(api.progress).toHaveBeenCalledWith('case','form',4,'en_espera','Llamar el martes'));
 expect(api.completeCall).toHaveBeenCalledWith('case','call',{channel:'form',situation:'Evaluando presupuesto',discussed:'Quiere dos canchas',distinguishing:'Proyecto en Texas'});
 expect(api.startCall.mock.invocationCallOrder[0]).toBeLessThan(api.completeCall.mock.invocationCallOrder[0]);expect(api.completeCall.mock.invocationCallOrder[0]).toBeLessThan(api.progress.mock.invocationCallOrder[0]);
});
test('failed summary never advances the case',async()=>{
 const api=apiFixture();api.completeCall.mockRejectedValue(new Error('failed'));render(<CommercialLeadManagement conversation={conversation} api={api}/>);await screen.findByLabelText('Estado comercial');
 fireEvent.change(screen.getByLabelText('Estado comercial'),{target:{value:'cerrado'}});for(const label of ['Qué se habló','Situación actual','Detalles importantes','Próximo paso'])fireEvent.change(screen.getByLabelText(label),{target:{value:'Datos de atención'}});fireEvent.click(screen.getByText('Guardar atención y próximo paso'));await screen.findByRole('alert');expect(api.progress).not.toHaveBeenCalled();
});
test('assignment uses server case and current version',async()=>{
 const api=apiFixture();render(<CommercialLeadManagement conversation={conversation} api={api}/>);await screen.findByLabelText('Asignar asesor');fireEvent.change(screen.getByLabelText('Asignar asesor'),{target:{value:'claire'}});fireEvent.click(screen.getByText('Guardar asignación'));await waitFor(()=>expect(api.assign).toHaveBeenCalledWith('form','case','claire',4));
});
test('advisor does not receive management controls or advisor list',async()=>{
 const api=apiFixture();api.getRole.mockResolvedValue({role:'advisor'});render(<CommercialLeadManagement conversation={conversation} api={api}/>);await screen.findByLabelText('Estado comercial');expect(api.listAdvisors).not.toHaveBeenCalled();expect(screen.queryByLabelText('Asignar asesor')).not.toBeInTheDocument();
});
test('does not match WhatsApp cases by phone, name or raw case id',async()=>{
 const api={listCases:jest.fn().mockResolvedValue({cases:[{id:'conversation',channel:'whatsapp',contact:{phone:'123'}}]})};await expect(resolveCommercialLead(api,{id:'conversation',source_channel:'whatsapp',phone:'123'})).rejects.toThrow('CASE_NOT_LINKED');
});
test('switching leads ignores earlier slow response',async()=>{
 const api=apiFixture();let resolve;api.resolveConversation.mockImplementationOnce(()=>new Promise(r=>{resolve=r}));const view=render(<CommercialLeadManagement conversation={conversation} api={api}/>);await waitFor(()=>expect(resolve).toBeDefined());view.rerender(<CommercialLeadManagement conversation={{id:'new',source_channel:'email'}} api={api}/>);await screen.findByLabelText('Estado comercial');resolve({id:'old',channel:'form'});await waitFor(()=>expect(api.readCase).toHaveBeenCalledWith('old','form'));expect(screen.getByLabelText('Estado comercial')).toHaveValue('nuevo');
});
