import React from 'react';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import CommercialCrmPage from './CommercialCrmPage';
import {createCommercialAssignmentsApi} from '../utils/commercialAssignmentsApi';
const mockSignOut=jest.fn();
jest.mock('../context/AuthContext',()=>({useAuth:()=>({session:{access_token:'test',user:{id:'nico'}},signOutAndClear:mockSignOut})}));
jest.mock('../components/CommercialAdminReturn',()=>()=>null);
jest.mock('../components/CommercialCrmHeader',()=>({onView})=><button type="button" onClick={()=>onView('team')}>Equipo comercial</button>);
jest.mock('../components/CommercialTeamWorkspace',()=>({children})=><div data-testid="team">Equipo</div>);
jest.mock('../components/CommercialProspects',()=>()=> <div>Prospect</div>);
jest.mock('./WhatsappCrmDemo',()=>({requiredScope})=><div data-testid="inbox"><div className="wa-messages" data-testid="messages">Consulta</div></div>);
jest.mock('../utils/commercialAssignmentsApi',()=>({createCommercialAssignmentsApi:jest.fn()}));
function makeScrollable(el){el.style.overflowY='auto';Object.defineProperty(el,'scrollHeight',{value:800,configurable:true});Object.defineProperty(el,'clientHeight',{value:100,configurable:true});el.scrollTop=0;}
test('real CommercialCrmPage mounts hook after async role, survives view change and cleans up',async()=>{
 let resolveRole;const rolePromise=new Promise(r=>{resolveRole=r;});createCommercialAssignmentsApi.mockReturnValue({getRole:()=>rolePromise});
 const view=render(<CommercialCrmPage/>);const messages=screen.getByTestId('messages');makeScrollable(messages);fireEvent.wheel(messages,{deltaY:50});expect(messages.scrollTop).toBe(0);
 resolveRole({role:'manager'});await waitFor(()=>expect(document.querySelector('.crm-page--inbox')).toBeInTheDocument());
 const messagesAfter=screen.getByTestId('messages');expect(document.querySelector('.crm-page')?.className).toContain('crm-page--inbox');makeScrollable(messagesAfter);
 fireEvent.wheel(messagesAfter,{deltaY:50});expect(messagesAfter.scrollTop).toBe(50);
 fireEvent.wheel(messagesAfter,{deltaY:50,deltaX:200});expect(messagesAfter.scrollTop).toBe(50);
 fireEvent.wheel(messagesAfter,{deltaY:50,ctrlKey:true});expect(messagesAfter.scrollTop).toBe(50);
 fireEvent.click(screen.getByRole('button',{name:'Equipo comercial'}));expect(screen.getByTestId('team')).toBeInTheDocument();
 cleanup();expect(screen.queryByTestId('messages')).toBeNull();
});

test('page falls back to document when nested message does not overflow',async()=>{
 let resolveRole;const rolePromise=new Promise(r=>{resolveRole=r;});createCommercialAssignmentsApi.mockReturnValue({getRole:()=>rolePromise});
 const view=render(<CommercialCrmPage/>);resolveRole({role:'manager'});await waitFor(()=>expect(document.querySelector('.crm-page--inbox')).toBeInTheDocument());
 const doc=document.scrollingElement||document.documentElement;doc.style.overflowY='auto';Object.defineProperty(doc,'scrollHeight',{value:900,configurable:true});Object.defineProperty(doc,'clientHeight',{value:100,configurable:true});doc.scrollTop=0;
 const messages=screen.getByTestId('messages');fireEvent.wheel(messages,{deltaY:60});expect(doc.scrollTop).toBe(60);
 cleanup();
});
