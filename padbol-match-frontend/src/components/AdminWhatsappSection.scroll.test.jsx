import React from 'react';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import AdminWhatsappSection from './AdminWhatsappSection';
import {crmAdminApi} from '../utils/crmAdminApi';
import {createCommercialAssignmentsApi} from '../utils/commercialAssignmentsApi';
jest.mock('../context/AuthContext',()=>({useAuth:()=>({session:{access_token:'qa',user:{id:'admin',email:'admin@example.test'}},signOutAndClear:jest.fn()})}));
jest.mock('./CommercialAdvisorAccess',()=>()=>null);
jest.mock('./CommercialAgendaAlerts',()=>()=>null);
jest.mock('./CommercialLeadManagement',()=>()=>null);
jest.mock('./CommercialProjectReview',()=>()=>null);
jest.mock('../utils/crmAdminApi',()=>({crmAdminApi:{permissions:jest.fn(),inbox:jest.fn(),activities:jest.fn(),emailHistory:jest.fn(),whatsappMediaList:jest.fn(),whatsappHistory:jest.fn(),sedes:jest.fn(),nextGenerationOverview:jest.fn(),setTestVisibility:jest.fn(),audit:jest.fn(),whatsappMedia:jest.fn()}}));
jest.mock('../utils/commercialAssignmentsApi',()=>({createCommercialAssignmentsApi:jest.fn()}));
beforeEach(()=>{createCommercialAssignmentsApi.mockReturnValue({getRole:()=>Promise.resolve({role:'manager'}),listCases:async()=>({cases:[]}),listAdvisors:async()=>({advisors:[]}),resolveConversation:async()=>null});crmAdminApi.permissions.mockResolvedValue({role:'superadmin',canOperate:false,canAudit:true,canManageVisibility:true,whatsappSendEnabled:false});crmAdminApi.inbox.mockResolvedValue({items:[{id:'conv-scroll',estado:'nuevo',source_channel:'email',origin:'web_form:contacto',identity_used:'qa@example.test',subject:'Consulta larga',inbound_body:'Nombre: QA\nAsunto: Consulta larga',created_at:'2026-10-02T12:00:00.000Z',updated_at:'2026-10-02T12:00:01.000Z',test_visibility_version:0}]});crmAdminApi.activities.mockResolvedValue([]);crmAdminApi.emailHistory.mockResolvedValue({messages:[],truncated:false});crmAdminApi.whatsappMediaList.mockResolvedValue({attachments:[]});crmAdminApi.whatsappHistory.mockResolvedValue({messages:[]});crmAdminApi.sedes.mockResolvedValue([]);crmAdminApi.nextGenerationOverview.mockResolvedValue({sedes:[],jornadas:[]});});
function makeDoc(){const doc=document.scrollingElement||document.documentElement;doc.style.overflowY='auto';Object.defineProperty(doc,'scrollHeight',{value:900,configurable:true});Object.defineProperty(doc,'clientHeight',{value:100,configurable:true});doc.scrollTop=0;return doc;}
test('real AdminWhatsappSection uses document fallback when nested message does not overflow',async()=>{const doc=makeDoc();render(<AdminWhatsappSection accessToken="qa"/>);const msg=(await screen.findAllByText('Consulta larga'))[0];const messages=msg.closest('.wa-messages')||msg.parentElement;expect(messages).toBeTruthy();fireEvent.wheel(messages,{deltaY:60});expect(doc.scrollTop).toBe(60);cleanup();});
