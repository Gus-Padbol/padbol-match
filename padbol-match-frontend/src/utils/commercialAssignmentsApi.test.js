import {createCommercialAssignmentsApi} from './commercialAssignmentsApi';
jest.mock('./apiPublicBaseUrl',()=>({getApiBaseUrl:()=>''}));
afterEach(()=>jest.restoreAllMocks());
test('assignment uses server-side version and authenticated request',async()=>{
 global.fetch=jest.fn().mockResolvedValue({ok:true,json:async()=>({})});
 await createCommercialAssignmentsApi('session').assign('form','case','advisor',4);
 expect(global.fetch).toHaveBeenCalledWith('/api/admin/crm/commercial-cases/case/assignment',expect.objectContaining({method:'PUT',body:JSON.stringify({channel:'form',advisorId:'advisor',expectedVersion:4}),headers:expect.objectContaining({Authorization:'Bearer session'})}));
});
test('conflicts fail closed',async()=>{
 global.fetch=jest.fn().mockResolvedValue({ok:false,status:409});
 await expect(createCommercialAssignmentsApi('session').assign('whatsapp','case','advisor',3)).rejects.toMatchObject({status:409});
});
test('rejects unknown channel and missing version without making requests',async()=>{
 global.fetch=jest.fn();const api=createCommercialAssignmentsApi('session');
 await expect(api.assign('unknown','case','advisor',1)).rejects.toThrow();
 await expect(api.assign('form','case','advisor',undefined)).rejects.toThrow();
 expect(global.fetch).not.toHaveBeenCalled();
});
test('completes a pending call with the advisor-reviewed fields',async()=>{
 global.fetch=jest.fn().mockResolvedValue({ok:true,json:async()=>({status:'completed'})});
 await createCommercialAssignmentsApi('session').completeCall('case','call',{channel:'whatsapp',situation:'situación',discussed:'conversación',distinguishing:'detalle'});
 expect(global.fetch).toHaveBeenCalledWith('/api/admin/crm/commercial-cases/case/calls/call/complete',expect.objectContaining({method:'POST',body:JSON.stringify({channel:'whatsapp',situation:'situación',discussed:'conversación',distinguishing:'detalle'})}));
});
test('commercial closure carries its explicit result without replacing free-form notes',async()=>{global.fetch=jest.fn().mockResolvedValue({ok:true,json:async()=>({})});await createCommercialAssignmentsApi('session').progress('case','form',8,'cerrado','Entrega acordada',null,[24,8],'venta_concretada');expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({channel:'form',expectedVersion:8,state:'cerrado',nextStep:'Entrega acordada',closureOutcome:'venta_concretada',nextContactAt:null,reminderHours:[24,8]});});
test('followup readiness checks the selected case channel and language without sending',async()=>{global.fetch=jest.fn().mockResolvedValue({ok:true,json:async()=>({ready:false})});await createCommercialAssignmentsApi('session').getFollowupReadiness('case','whatsapp','en');expect(fetch).toHaveBeenCalledWith('/api/admin/crm/commercial-cases/case/followup/readiness?channel=whatsapp&language=en',expect.objectContaining({method:'GET',headers:{Authorization:'Bearer session'}}));});
test.each([['CLOSURE_OUTCOME_REQUIRED','Selecciona si la venta se concretó o no avanzó.'],['INVALID_CLOSURE_OUTCOME','Elige un resultado comercial válido: Venta concretada o No avanzó.'],['FOLLOWUP_NOT_READY','El seguimiento todavía no está habilitado. Revisa las plantillas aprobadas y la disponibilidad de envío.']])('convierte %s en una indicación segura en español',async(code,userMessage)=>{global.fetch=jest.fn().mockResolvedValue({ok:false,status:409,json:async()=>({error:code})});await expect(createCommercialAssignmentsApi('session').startFollowup('case','whatsapp',{consent:true})).rejects.toMatchObject({code,userMessage});});
it('consulta correspondencia por id de ficha y canal con autorización de sesión',async()=>{global.fetch=jest.fn(async()=>({ok:true,json:async()=>({messages:[]})}));await createCommercialAssignmentsApi('fixture').emailHistory('case/id','form');expect(fetch.mock.calls[0][0]).toContain('/api/admin/crm/commercial-cases/case%2Fid/email-history?channel=form');expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer fixture');});
