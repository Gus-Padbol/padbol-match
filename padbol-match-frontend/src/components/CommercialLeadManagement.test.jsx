import React from 'react';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import CommercialLeadManagement,{resolveCommercialLead} from './CommercialLeadManagement';
function apiFixture(){return {getRole:jest.fn().mockResolvedValue({role:'manager'}),resolveConversation:jest.fn().mockResolvedValue({id:'case',channel:'form'}),readCase:jest.fn().mockResolvedValue({id:'case',version:4,progressState:'nuevo',assignedAdvisor:{id:'nico',name:'Nico'}}),listCalls:jest.fn().mockResolvedValue({calls:[]}),listActivities:jest.fn().mockResolvedValue({activities:[]}),listAdvisors:jest.fn().mockResolvedValue({advisors:[{id:'nico',name:'Nico',active:true},{id:'claire',name:'Claire',active:true}]}),startCall:jest.fn().mockResolvedValue({id:'call',status:'pending'}),completeCall:jest.fn().mockResolvedValue({status:'completed'}),progress:jest.fn().mockResolvedValue({}),assign:jest.fn().mockResolvedValue({})};}
const conversation={id:'conversation',source_channel:'email'};
test('advance requires one summary and next step; preserves the selected state and saves summary before progress',async()=>{
 const api=apiFixture();render(<CommercialLeadManagement conversation={conversation} api={api}/>);await screen.findByText('Nico',{selector:'strong'});
 fireEvent.change(screen.getByLabelText('Estado comercial'),{target:{value:'en_espera'}});expect(screen.getByText('Guardar gestión')).toBeDisabled();
 for(const [label,value] of [['Resumen de la conversación','Quiere dos canchas; está evaluando presupuesto'],['Próximo paso','Llamar el martes']])fireEvent.change(screen.getByLabelText(label),{target:{value}});
 fireEvent.click(screen.getByText('Guardar gestión'));
 await waitFor(()=>expect(api.progress).toHaveBeenCalledWith('case','form',4,'en_espera','Llamar el martes',null,[24,8]));
 expect(api.completeCall).toHaveBeenCalledWith('case','call',{channel:'form',situation:'Estado seleccionado: En espera / seguimiento',discussed:'Quiere dos canchas; está evaluando presupuesto',distinguishing:'No se agregaron detalles adicionales.'});
 expect(api.startCall.mock.invocationCallOrder[0]).toBeLessThan(api.completeCall.mock.invocationCallOrder[0]);expect(api.completeCall.mock.invocationCallOrder[0]).toBeLessThan(api.progress.mock.invocationCallOrder[0]);
});
test('failed summary never advances the case',async()=>{
 const api=apiFixture();api.completeCall.mockRejectedValue(new Error('failed'));render(<CommercialLeadManagement conversation={conversation} api={api}/>);await screen.findByLabelText('Estado comercial');
 fireEvent.change(screen.getByLabelText('Estado comercial'),{target:{value:'cerrado'}});fireEvent.change(screen.getByLabelText('Resultado comercial'),{target:{value:'no_avanzo'}});for(const label of ['Resumen de la conversación','Detalle del cierre'])fireEvent.change(screen.getByLabelText(label),{target:{value:'Datos de atención'}});fireEvent.click(screen.getByText('Guardar gestión'));await screen.findByRole('alert');expect(api.progress).not.toHaveBeenCalled();
});
test('assignment uses server case and current version',async()=>{
 const api=apiFixture();render(<CommercialLeadManagement conversation={conversation} api={api}/>);await screen.findByText('Cambiar asesor');fireEvent.click(screen.getByText('Cambiar asesor'));fireEvent.change(screen.getByLabelText('Asignar asesor'),{target:{value:'claire'}});fireEvent.click(screen.getByText('Guardar asignación'));await waitFor(()=>expect(api.assign).toHaveBeenCalledWith('form','case','claire',4));
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

test('summary and next step are required even when the state is unchanged',async()=>{
 const api=apiFixture();render(<CommercialLeadManagement conversation={conversation} api={api}/>);await screen.findByLabelText('Estado comercial');
 expect(screen.getByText('Guardar gestión')).toBeDisabled();
 fireEvent.change(screen.getByLabelText('Resumen de la conversación'),{target:{value:'El cliente está evaluando dos canchas.'}});
 expect(screen.getByText('Guardar gestión')).toBeDisabled();
 fireEvent.change(screen.getByLabelText('Próximo paso'),{target:{value:'Contactar el viernes.'}});
 expect(screen.getByText('Guardar gestión')).toBeEnabled();
 expect(screen.queryByLabelText('Situación actual')).not.toBeInTheDocument();
});

test('calendar persists a UTC appointment with default alerts 24 and 8 hours',async()=>{
 const api=apiFixture();render(<CommercialLeadManagement conversation={conversation} api={api}/>);await screen.findByLabelText('Estado comercial');
 fireEvent.change(screen.getByLabelText('Resumen de la conversación'),{target:{value:'Solicitó retomar la charla.'}});
 fireEvent.change(screen.getByLabelText('Próximo paso'),{target:{value:'Videollamada para revisar propuesta.'}});
 fireEvent.change(screen.getByLabelText('Próxima charla (opcional)'),{target:{value:'2099-06-20T14:30'}});
 expect(screen.getByLabelText('Avisarme estas horas antes')).toHaveValue('24, 8');
 fireEvent.click(screen.getByText('Guardar gestión'));
 await waitFor(()=>expect(api.progress).toHaveBeenCalledWith('case','form',4,'nuevo','Videollamada para revisar propuesta.',new Date('2099-06-20T14:30').toISOString(),[24,8]));
});
test('closing clears an existing appointment',async()=>{
 const api=apiFixture();api.readCase.mockResolvedValue({id:'case',version:4,progressState:'en_espera',nextContactAt:'2099-06-20T14:30:00Z',reminderHours:[48,1],assignedAdvisor:{name:'Nico'}});
 render(<CommercialLeadManagement conversation={conversation} api={api}/>);await screen.findByLabelText('Estado comercial');
 fireEvent.change(screen.getByLabelText('Estado comercial'),{target:{value:'cerrado'}});fireEvent.change(screen.getByLabelText('Resultado comercial'),{target:{value:'no_avanzo'}});
 expect(screen.queryByLabelText('Próxima charla (opcional)')).not.toBeInTheDocument();
 fireEvent.change(screen.getByLabelText('Resumen de la conversación'),{target:{value:'El cliente decidió no continuar.'}});fireEvent.change(screen.getByLabelText('Detalle del cierre'),{target:{value:'Cerrado sin operación.'}});fireEvent.click(screen.getByText('Guardar gestión'));
 await waitFor(()=>expect(api.progress).toHaveBeenCalledWith('case','form',4,'cerrado','Cerrado sin operación.',null,[48,1],'no_avanzo'));
});

test('saved WhatsApp waiting state exposes explicit consent-based followup, draft state never activates it',async()=>{
 const api=apiFixture();api.resolveConversation.mockResolvedValue({id:'case',channel:'whatsapp'});api.readCase.mockResolvedValue({id:'case',version:4,progressState:'nuevo',assignedAdvisor:{id:'nico',name:'Nico'}});
 const {unmount}=render(<CommercialLeadManagement conversation={{id:'wa',source_channel:'whatsapp'}} api={api}/>);await screen.findByLabelText('Estado comercial');fireEvent.change(screen.getByLabelText('Estado comercial'),{target:{value:'en_espera'}});expect(screen.queryByRole('button',{name:'Activar seguimiento'})).not.toBeInTheDocument();unmount();
 api.readCase.mockResolvedValue({id:'case',version:4,progressState:'en_espera',assignedAdvisor:{id:'nico',name:'Nico'}});render(<CommercialLeadManagement conversation={{id:'wa',source_channel:'whatsapp'}} api={api}/>);expect(await screen.findByRole('button',{name:'Activar seguimiento'})).toBeDisabled();expect(screen.getByLabelText(/Confirmo que autorizó/)).not.toBeChecked();
});

test('nuevo cierre requiere clasificar resultado y conserva el resumen libre',async()=>{const api=apiFixture();render(<CommercialLeadManagement conversation={conversation} api={api}/>);await screen.findByLabelText('Estado comercial');fireEvent.change(screen.getByLabelText('Estado comercial'),{target:{value:'cerrado'}});fireEvent.change(screen.getByLabelText('Resumen de la conversación'),{target:{value:'Confirmó la compra de dos canchas.'}});fireEvent.change(screen.getByLabelText('Detalle del cierre'),{target:{value:'Acuerdo confirmado, coordinar entrega.'}});expect(screen.getByText('Guardar gestión')).toBeDisabled();fireEvent.change(screen.getByLabelText('Resultado comercial'),{target:{value:'venta_concretada'}});fireEvent.click(screen.getByText('Guardar gestión'));await waitFor(()=>expect(api.progress).toHaveBeenCalledWith('case','form',4,'cerrado','Acuerdo confirmado, coordinar entrega.',null,[24,8],'venta_concretada'));expect(api.completeCall).toHaveBeenCalledWith('case','call',expect.objectContaining({discussed:'Confirmó la compra de dos canchas.'}));});
test('cierre histórico sin clasificación sigue visible sin exigir reescribirlo',async()=>{const api=apiFixture();api.readCase.mockResolvedValue({id:'case',version:4,progressState:'cerrado',nextStep:'Cierre histórico documentado',assignedAdvisor:{name:'Nico'}});render(<CommercialLeadManagement conversation={conversation} api={api}/>);expect(await screen.findByLabelText('Resultado comercial')).not.toBeRequired();expect(screen.getByRole('option',{name:'Cierre anterior sin clasificar'})).toBeInTheDocument();expect(screen.getByLabelText('Detalle del cierre')).toHaveValue('Cierre histórico documentado');});
test('waiting case with a new unsaved note cannot activate automatic followup',async()=>{const api=apiFixture();api.resolveConversation.mockResolvedValue({id:'case',channel:'whatsapp'});api.readCase.mockResolvedValue({id:'case',version:4,progressState:'en_espera',assignedAdvisor:{name:'Nico'}});render(<CommercialLeadManagement conversation={{id:'wa',source_channel:'whatsapp'}} api={api}/>);await screen.findByLabelText('Estado comercial');fireEvent.change(screen.getByLabelText('Resumen de la conversación'),{target:{value:'Nuevo acuerdo aún no guardado'}});expect(screen.queryByRole('button',{name:'Activar seguimiento'})).not.toBeInTheDocument();expect(screen.getByText(/Guarda el resumen y el próximo paso/)).toBeInTheDocument();});
