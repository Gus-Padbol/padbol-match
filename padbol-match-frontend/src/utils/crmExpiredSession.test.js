import {createCommercialAssignmentsApi} from './commercialAssignmentsApi';
import {crmAdminApi} from './crmAdminApi';
import React from 'react';
import {render,screen,fireEvent,waitFor,act} from '@testing-library/react';
import CommercialCaseDetail from '../components/CommercialCaseDetail';
import CommercialTeamWorkspace from '../components/CommercialTeamWorkspace';
jest.mock('./apiPublicBaseUrl',()=>({getApiBaseUrl:()=>''}));
jest.mock('../components/CommercialLeadManagement',()=>()=>null);
jest.mock('../components/CrmEmailHistory',()=>()=>null);
jest.mock('../components/CommercialAgendaAlerts',()=>()=>null);
jest.mock('../components/CommercialAssignments',()=>()=>null);
let serial=0;const token=exp=>`header.${btoa(JSON.stringify({exp})).replace(/=/g,'')}.signature-${++serial}`;
afterEach(()=>jest.restoreAllMocks());
const actions=[
 ['commercial read',t=>createCommercialAssignmentsApi(t).getRole()],
 ['commercial reply',t=>createCommercialAssignmentsApi(t).reply('case','form','Draft','stable-id')],
 ['commercial attachment',t=>createCommercialAssignmentsApi(t).media('case','event')],
 ['CRM read',t=>crmAdminApi.permissions(t)],
 ['CRM reply',t=>crmAdminApi.reply(t,'case','Draft','stable-id')],
 ['CRM attachment',t=>crmAdminApi.whatsappMedia(t,'case','event')],
];
test.each(actions)('%s blocks a token already rejected by an authenticated CRM request',async(_,action)=>{
 const session=token(200);global.fetch=jest.fn().mockResolvedValue({ok:false,status:401,json:async()=>({error:'UNAUTHENTICATED'})});await expect(createCommercialAssignmentsApi(session).getRole()).rejects.toMatchObject({status:401});
 await expect(action(session)).rejects.toMatchObject({status:401,code:'UNAUTHENTICATED'});expect(fetch).toHaveBeenCalledTimes(1);
});
test('retained API stops polling after auth rejection; a fresh API only sends when explicitly invoked',async()=>{
 const old=createCommercialAssignmentsApi(token(200));global.fetch=jest.fn().mockResolvedValueOnce({ok:true,json:async()=>({role:'manager'})}).mockResolvedValueOnce({ok:false,status:401,json:async()=>({error:'UNAUTHENTICATED'})}).mockResolvedValue({ok:true,json:async()=>({role:'manager'})});
 await old.getRole();await expect(old.getRole()).rejects.toMatchObject({code:'UNAUTHENTICATED'});
 for(let n=0;n<3;n++)await expect(old.getRole()).rejects.toMatchObject({code:'UNAUTHENTICATED'});
 expect(fetch).toHaveBeenCalledTimes(2);const renewed=createCommercialAssignmentsApi(token(400));expect(fetch).toHaveBeenCalledTimes(2);await renewed.getRole();expect(fetch).toHaveBeenCalledTimes(3);
});
test.each([401,403])('provider %s does not refresh credentials or replay a reply',async status=>{
 jest.spyOn(Date,'now').mockReturnValue(100000);global.fetch=jest.fn().mockResolvedValue({ok:false,status,json:async()=>({error:'PROVIDER_REJECTED'})});
 await expect(createCommercialAssignmentsApi(token(200)).reply('case','form','Draft','stable-id')).rejects.toMatchObject({status,code:'PROVIDER_REJECTED'});expect(fetch).toHaveBeenCalledTimes(1);
});
test('expiry rejection keeps the draft and request ID through API renewal; sending remains manual',async()=>{
 jest.spyOn(Date,'now').mockReturnValue(200000);Object.defineProperty(window,'crypto',{configurable:true,value:{randomUUID:jest.fn().mockReturnValue('stable-id')}});global.fetch=jest.fn().mockResolvedValueOnce({ok:false,status:401,json:async()=>({error:'UNAUTHENTICATED'})}).mockResolvedValue({ok:true,json:async()=>({status:'sent'})});
 const wrap=t=>({...createCommercialAssignmentsApi(t),readCase:jest.fn().mockResolvedValue({status:'open',contact:{name:'Existing case'}}),listActivities:jest.fn().mockResolvedValue({activities:[]})});
 const view=render(<CommercialCaseDetail item={{id:'case',channel:'form'}} api={wrap(token(200))}/>);await screen.findByLabelText('Respuesta');fireEvent.change(screen.getByLabelText('Respuesta'),{target:{value:'Conservar borrador'}});fireEvent.click(screen.getByText('Enviar respuesta'));
 await screen.findByText(/Tu sesión no es válida/);expect(screen.getByLabelText('Respuesta')).toHaveValue('Conservar borrador');expect(fetch).toHaveBeenCalledTimes(1);
 await act(async()=>{view.rerender(<CommercialCaseDetail item={{id:'case',channel:'form'}} api={wrap(token(400))}/>);});expect(screen.getByLabelText('Respuesta')).toHaveValue('Conservar borrador');expect(fetch).toHaveBeenCalledTimes(1);fireEvent.click(screen.getByText('Enviar respuesta'));
 await waitFor(()=>expect(screen.getByLabelText('Respuesta')).toHaveValue(''));expect(fetch).toHaveBeenCalledTimes(2);expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual(JSON.parse(fetch.mock.calls[0][1].body));expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({channel:'form',body:'Conservar borrador',requestId:'stable-id'});expect(window.crypto.randomUUID).toHaveBeenCalledTimes(1);
});
test('unknown expiry delegates authentication to the backend and never retries its denial',async()=>{
 global.fetch=jest.fn().mockResolvedValue({ok:false,status:403,json:async()=>({error:'FORBIDDEN'})});await expect(createCommercialAssignmentsApi('malformed').getRole()).rejects.toMatchObject({status:403});expect(fetch).toHaveBeenCalledTimes(1);
});
test.each(['commercial','CRM'])('an initial %s attachment authentication rejection also stops later transport',async kind=>{
 const session=token(200);global.fetch=jest.fn().mockResolvedValue({ok:false,status:401,json:async()=>({code:'CRM_ADMIN_UNAUTHENTICATED'})});
 const download=()=>kind==='commercial'?createCommercialAssignmentsApi(session).media('case','event'):crmAdminApi.whatsappMedia(session,'case','event');await expect(download()).rejects.toMatchObject({status:401});await expect(download()).rejects.toMatchObject({status:401});expect(fetch).toHaveBeenCalledTimes(1);
});
test('manual read-only recovery of a transient rejection preserves the entire draft and never resends it',async()=>{
 const session=token(200),draft='  First line\nSegunda línea £ ⚽  ';Object.defineProperty(window,'crypto',{configurable:true,value:{randomUUID:jest.fn().mockReturnValue('stable-id')}});
 global.fetch=jest.fn().mockResolvedValueOnce({ok:false,status:401,json:async()=>({error:'UNAUTHENTICATED'})}).mockResolvedValueOnce({ok:true,json:async()=>({role:'manager'})}).mockResolvedValue({ok:true,json:async()=>({status:'sent'})});
 const api={...createCommercialAssignmentsApi(session),readCase:jest.fn().mockResolvedValue({status:'open',contact:{name:'Existing case'}}),listActivities:jest.fn().mockResolvedValue({activities:[]})};render(<CommercialCaseDetail item={{id:'case',channel:'form'}} api={api}/>);await screen.findByLabelText('Respuesta');fireEvent.change(screen.getByLabelText('Respuesta'),{target:{value:draft}});fireEvent.click(screen.getByText('Enviar respuesta'));fireEvent.click(await screen.findByText('Volver a comprobar sesión'));
 await waitFor(()=>expect(screen.queryByText('Volver a comprobar sesión')).not.toBeInTheDocument());expect(screen.getByLabelText('Respuesta')).toHaveValue(draft);expect(fetch).toHaveBeenCalledTimes(2);expect(fetch.mock.calls[1][0]).toBe('/api/admin/crm/commercial-role');expect(fetch.mock.calls[1][1]).toMatchObject({method:'GET'});expect(fetch.mock.calls[1][1].body).toBeUndefined();
 fireEvent.click(screen.getByText('Enviar respuesta'));await waitFor(()=>expect(fetch).toHaveBeenCalledTimes(3));expect(JSON.parse(fetch.mock.calls[2][1].body)).toEqual(JSON.parse(fetch.mock.calls[0][1].body));expect(window.crypto.randomUUID).toHaveBeenCalledTimes(1);await screen.findByText(/Envío aceptado/);
});
test.each([403,'unknown-role'])('unsuccessful manual revalidation %s cannot clear the rejection',async outcome=>{
 const session=token(200),api=createCommercialAssignmentsApi(session);global.fetch=jest.fn().mockResolvedValueOnce({ok:false,status:401,json:async()=>({error:'UNAUTHENTICATED'})}).mockResolvedValue({ok:outcome!=='unknown-role'?false:true,status:403,json:async()=>outcome==='unknown-role'?{role:'unknown'}:{error:'FORBIDDEN'}});
 await expect(api.getRole()).rejects.toMatchObject({status:401});await expect(api.revalidateSession()).rejects.toMatchObject({status:403});await expect(api.reply('case','form','Draft','stable-id')).rejects.toMatchObject({status:401});expect(fetch).toHaveBeenCalledTimes(2);
});
test('workspace recovery remains accessible outside the disabled controls and preserves draft',async()=>{
 const item={id:'case',channel:'form',contact:{name:'Existing case'}};const make=()=>({getRole:jest.fn().mockResolvedValue({role:'advisor'}),listCases:jest.fn().mockResolvedValue({cases:[item]}),readCase:jest.fn().mockResolvedValue({status:'open',contact:item.contact}),listActivities:jest.fn().mockResolvedValue({activities:[]}),reply:jest.fn(),revalidateSession:jest.fn().mockResolvedValue({role:'advisor'})});
 const first=make(),view=render(<CommercialTeamWorkspace api={first} currentUserId="same-user"/>);fireEvent.click(await screen.findByRole('button',{name:/Existing case/}));await screen.findByLabelText('Respuesta');fireEvent.change(screen.getByLabelText('Respuesta'),{target:{value:'Draft íntegro\n⚽'}});
 const next=make();next.getRole.mockRejectedValueOnce({status:401,code:'UNAUTHENTICATED'});next.readCase.mockRejectedValueOnce({status:401,code:'UNAUTHENTICATED'});await act(async()=>{view.rerender(<CommercialTeamWorkspace api={next} currentUserId="same-user"/>);});const button=screen.getByText('Volver a comprobar sesión');expect(button).toBeEnabled();expect(button.closest('fieldset')).toBeNull();expect(screen.getByText('Enviar respuesta')).toBeDisabled();
 fireEvent.click(button);await waitFor(()=>expect(screen.queryByText('Volver a comprobar sesión')).not.toBeInTheDocument());await waitFor(()=>expect(screen.getByText('Enviar respuesta')).toBeEnabled());expect(screen.getByLabelText('Respuesta')).toHaveValue('Draft íntegro\n⚽');expect(next.revalidateSession).toHaveBeenCalledTimes(1);expect(next.reply).not.toHaveBeenCalled();
});
test('a delayed recovery cannot restore data after the API loses scope',async()=>{
 let finish;const first={readCase:jest.fn().mockResolvedValue({status:'open',contact:{name:'Old case'}}),listActivities:jest.fn().mockResolvedValue({activities:[]}),reply:jest.fn().mockRejectedValue({status:401,code:'UNAUTHENTICATED'}),revalidateSession:jest.fn(()=>new Promise(resolve=>{finish=resolve;}))};Object.defineProperty(window,'crypto',{configurable:true,value:{randomUUID:()=> 'id'}});
 const item={id:'case',channel:'form'},view=render(<CommercialCaseDetail item={item} api={first}/>);await screen.findByLabelText('Respuesta');fireEvent.change(screen.getByLabelText('Respuesta'),{target:{value:'Keep'}});fireEvent.click(screen.getByText('Enviar respuesta'));fireEvent.click(await screen.findByText('Volver a comprobar sesión'));
 const next={...first,readCase:jest.fn().mockRejectedValue({status:403,code:'FORBIDDEN'})};await act(async()=>{view.rerender(<CommercialCaseDetail item={item} api={next}/>);});await act(async()=>{finish({role:'manager'});});expect(screen.queryByText('Old case')).not.toBeInTheDocument();expect(screen.queryByLabelText('Respuesta')).not.toBeInTheDocument();expect(first.readCase).toHaveBeenCalledTimes(1);
});
