import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TorneoVista from './TorneoVista';
const mockNavigate=jest.fn();
jest.mock('react-router-dom',()=>({...jest.requireActual('react-router-dom'),useParams:()=>({torneoId:'9'}),useNavigate:()=>mockNavigate}));
jest.mock('../i18n/tSafe',()=>{const t=(key,args)=>args?.defaultValue||key;return {useSafeTranslation:()=>({t,i18n:{language:'es'}})};});
jest.mock('../context/AuthContext',()=>{const auth={session:{user:{id:'00000000-0000-4000-8000-000000000001',email:'qa@fixture.invalid'},access_token:'synthetic-fixture'},userProfile:{nombre:'QA',nivel:'Inicial'},loading:false};return {useAuth:()=>auth};});
jest.mock('../context/HubNavLayoutContext',()=>({useHubNavLayout:()=>({navDock:'bottom'})}));
let mockRole='jugador';
jest.mock('../hooks/useUserRole',()=>({__esModule:true,default:()=>({rol:mockRole,sedeId:null,pais:null})}));
jest.mock('../hooks/useSponsor',()=>({useSponsor:()=>({sponsor:null})}));
jest.mock('../components/AppHeader',()=>()=>null);
jest.mock('../components/BottomNav',()=>()=>null);
jest.mock('../supabaseClient',()=>({supabase:{auth:{getSession:jest.fn(async()=>({data:{session:{access_token:'synthetic-fixture'}}}))}}}));
jest.mock('../components/torneo/TorneoTabbedView',()=>{const actual=jest.requireActual('../components/torneo/TorneoTabbedView');return {...actual,__esModule:true,default:props=>require('react').createElement('div',null,props.adminTorneoBar,props.bannerAntesTabs)};});
let mode;
beforeEach(()=>{
 require('../supabaseClient').supabase.auth.getSession.mockResolvedValue({data:{session:{access_token:'synthetic-fixture'}}});
 mode='selecciones';mockRole='jugador';mockNavigate.mockClear();
 global.fetch=jest.fn(async url=>({ok:true,status:200,json:async()=>{
  if(url.endsWith('/api/torneos/9'))return {id:9,nombre:'Torneo QA',deporte:'padbol',modalidad_plantel:mode,estado:'abierto',fecha_inicio:'2027-11-22',sede_id:7};
  if(url.endsWith('/busca-dupla/me'))return {enrolled:false};
  if(url.endsWith('/busca-dupla/invitaciones'))return {recibidas:[],enviadas:[]};
  return [];
 }}));
});
afterEach(()=>delete global.fetch);
test('protected tournament teams and matches read with the current real-session contract',async()=>{render(<MemoryRouter><TorneoVista/></MemoryRouter>);await waitFor(()=>expect(fetch.mock.calls.some(([url])=>url.endsWith('/api/torneos/9/partidos'))).toBe(true));for(const [url,options] of fetch.mock.calls.filter(([url])=>/\/(equipos|partidos)$/.test(url)))expect(options.headers.Authorization).toBe('Bearer synthetic-fixture');});
test('public selection tournament points to registered rosters without requesting or offering legacy two-player partner flow',async()=>{
 render(<MemoryRouter initialEntries={['/torneo/9']}><TorneoVista/></MemoryRouter>);
 const button=await screen.findByRole('button',{name:'torneos.vista.teamsAndRegistration'});
 expect(screen.queryByText('torneos.vista.playersSeekingPartner')).not.toBeInTheDocument();
 expect(fetch.mock.calls.some(([url])=>url.includes('/busca-dupla'))).toBe(false);
 fireEvent.click(button);expect(mockNavigate).toHaveBeenCalledWith('/torneo/9/equipos',undefined);
 expect(fetch.mock.calls.every(([,options])=>!options?.method||options.method==='GET')).toBe(true);
});
test('legacy doubles preserve authenticated partner discovery and its existing public section',async()=>{
 mode='dobles';render(<MemoryRouter initialEntries={['/torneo/9']}><TorneoVista/></MemoryRouter>);
 await screen.findByText('torneos.vista.playersSeekingPartner');
 await waitFor(()=>expect(fetch.mock.calls.filter(([url])=>url.includes('/busca-dupla'))).toHaveLength(3));
 const call=fetch.mock.calls.find(([url])=>url.endsWith('/busca-dupla'));
 expect(call[1].headers.Authorization).toBe('Bearer synthetic-fixture');
 expect(screen.queryByRole('button',{name:'torneos.vista.teamsAndRegistration'})).not.toBeInTheDocument();
});

test('real admin page cancels inline without PUT and confirms persisted opening visibly',async()=>{
 mockRole='super_admin';let estado='planificacion';
 global.fetch=jest.fn(async(url,options)=>({ok:true,status:200,json:async()=>{
  if(url.endsWith('/api/torneos/9')) {if(options?.method==='PUT')estado='abierto';return {id:9,nombre:'Torneo QA',deporte:'padbol',modalidad_plantel:'selecciones',estado,fecha_inicio:'2027-11-22',sede_id:7};}
  if(url.includes('/lista-espera'))return {enrolled:false};return [];
 }}));
 render(<MemoryRouter initialEntries={[{pathname:'/torneo/9',state:{fromAdmin:true}}]}><TorneoVista/></MemoryRouter>);
 fireEvent.click(await screen.findByRole('button',{name:'torneos.vista.openRegistration'}));
 fireEvent.click(screen.getByRole('button',{name:'Cancelar'}));
 expect(fetch.mock.calls.some(([,options])=>options?.method==='PUT')).toBe(false);
 fireEvent.click(screen.getByRole('button',{name:'torneos.vista.openRegistration'}));
 fireEvent.click(screen.getByRole('button',{name:'torneos.vista.openRegistration'}));
 expect(await screen.findByText('Inscripción abierta y guardado confirmado.')).toHaveAttribute('role','status');
 expect(fetch.mock.calls.filter(([,options])=>options?.method==='PUT')).toHaveLength(1);
 expect(screen.queryByRole('group',{name:'torneos.vista.confirmOpenRegistration'})).not.toBeInTheDocument();
});
