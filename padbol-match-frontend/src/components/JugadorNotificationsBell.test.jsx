import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import JugadorNotificationsBell from './JugadorNotificationsBell';
import NotificacionesPage from '../pages/NotificacionesPage';
jest.mock('../context/AuthContext',()=>{const session={user:{id:'qa-user'},access_token:'fixture'};return{useAuth:()=>({session})};});
jest.mock('../context/HubNavLayoutContext',()=>({useHubNavLayout:()=>({navDock:'top'})}));
jest.mock('../i18n/tSafe',()=>{const t=key=>key;return{useSafeTranslation:()=>({t,i18n:{language:'en'}})};});
jest.mock('../supabaseClient',()=>({supabase:{auth:{getSession:async()=>({data:{session:{access_token:'fixture'}}})},channel:()=>({on(){return this;},subscribe(){return this;}}),removeChannel:jest.fn()}}));
jest.mock('./AppHeader',()=>()=>null);
jest.mock('./BottomNav',()=>()=>null);
const originalFetch=global.fetch;
afterEach(()=>{global.fetch=originalFetch;});

async function openNotifications(kind,{fail=false}={}) {
 const row={id:'ab6d7b67-0de6-4761-a402-1ef8082d26ec',titulo:'QA notification',mensaje:'QA body',tipo:'general',leida:false,created_at:'2026-09-09T12:00:00Z'};
 global.fetch=jest.fn(async(_url,options)=>options?.method==='PATCH'?{ok:!fail,status:fail?503:200,json:async()=>fail?{error:'Temporarily unavailable'}:{ok:true}}:{ok:true,json:async()=>({notificaciones:[row],unread_count:1})});
 render(<MemoryRouter>{kind==='bell'?<JugadorNotificationsBell/>:<NotificacionesPage/>}</MemoryRouter>);
 if(kind==='bell'){
  await waitFor(()=>expect(screen.getByRole('button',{name:'Notificaciones: 1 no leídas'})).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button',{name:'Notificaciones: 1 no leídas'}));
 }
 await screen.findByText('QA notification');
}

test.each(['bell','page'])('%s renders the real object DTO and marks all only after server acknowledgement',async kind=>{
 await openNotifications(kind);fireEvent.click(screen.getByRole('button',{name:'Marcar leídas'}));
 await waitFor(()=>expect(global.fetch.mock.calls.some(([url,options])=>url.endsWith('/api/notificaciones/leer-todas')&&options?.method==='PATCH')).toBe(true));
 if(kind==='bell')await waitFor(()=>expect(screen.getByRole('button',{name:'Notificaciones: 0 no leídas'})).toBeInTheDocument());
 else await waitFor(()=>expect(screen.queryByRole('button',{name:'Marcar leídas'})).not.toBeInTheDocument());
});

test.each(['bell','page'])('%s retains unread state and reports an HTTP failure for retry',async kind=>{
 await openNotifications(kind,{fail:true});fireEvent.click(screen.getByRole('button',{name:'Marcar leídas'}));
 await screen.findByText('Temporarily unavailable');
 if(kind==='bell')expect(screen.getByRole('button',{name:'Notificaciones: 1 no leídas'})).toBeInTheDocument();
 expect(screen.getByRole('button',{name:'Marcar leídas'})).toBeInTheDocument();
});
