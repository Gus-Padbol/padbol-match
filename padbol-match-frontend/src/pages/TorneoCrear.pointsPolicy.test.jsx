import React from 'react';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import TorneoCrear from './TorneoCrear';
import {getAuthHeaders} from '../utils/scoreboardApi';
jest.mock('../utils/scoreboardApi',()=>({getAuthHeaders:jest.fn()}));
import {readPointsConfig} from '../utils/pointsConfigApi';
jest.mock('../utils/pointsConfigApi',()=>({...jest.requireActual('../utils/pointsConfigApi'),readPointsConfig:jest.fn()}));
jest.mock('../context/AuthContext',()=>({useAuth:()=>({session:{user:{email:'qa@fixture.invalid'},access_token:'fixture-only'}})}));
jest.mock('../context/HubNavLayoutContext',()=>({useHubNavLayout:()=>({navDock:'bottom'})}));
jest.mock('../hooks/useUserRole',()=>()=>({rol:'super_admin',sedeId:null}));
jest.mock('../components/AppHeader',()=>()=>null);jest.mock('../components/BottomNav',()=>()=>null);jest.mock('../components/SedeSearchInput',()=>props=><button type="button" onClick={()=>props.onChangeId(7)}>Elegir sede QA</button>);
jest.mock('../i18n/tSafe',()=>{const es=require('../i18n/locales/es.json');const t=(key,args)=>key.split('.').reduce((value,k)=>value?.[k],es)||args?.defaultValue||key;return {useSafeTranslation:()=>({t,i18n:{language:'es'}})};});
const policy={niveles:{club_oficial:30,club_no_oficial:10,nacional:100,internacional:300,mundial:1000},posiciones:{1:100,2:60,3:40},tipos_custom:[{id:'special',nombre:'Especial aprobado',puntos:80}],niveles_labels:{internacional:'Internacional guardado'},niveles_hidden:['mundial']};
beforeEach(()=>{jest.clearAllMocks();getAuthHeaders.mockResolvedValue({Authorization:'Bearer sdk-current'});global.fetch=jest.fn().mockResolvedValue({json:async()=>[]});readPointsConfig.mockResolvedValue(policy);});
test('create uses server labels/hidden levels and read-only base without a points_total input',async()=>{const {container}=render(<MemoryRouter><TorneoCrear embedded/></MemoryRouter>);await screen.findByRole('option',{name:'Internacional guardado'});expect(screen.queryByRole('option',{name:/Mundial/})).not.toBeInTheDocument();const level=container.querySelector('select[name="nivel_torneo"]');fireEvent.change(level,{target:{value:'internacional'}});expect(screen.getByLabelText('Puntos base')).toHaveValue('300');expect(container.querySelector('input[name="puntos_total"]')).toBeNull();expect(screen.getByLabelText('Puntos base')).toHaveAttribute('readonly');});
test('unavailable policy shows retry and keeps level selection disabled',async()=>{readPointsConfig.mockRejectedValueOnce(new Error('Configuración no disponible'));const {container}=render(<MemoryRouter><TorneoCrear embedded/></MemoryRouter>);await screen.findByRole('alert');expect(container.querySelector('select[name="nivel_torneo"]')).toBeDisabled();fireEvent.click(screen.getByRole('button',{name:'Reintentar'}));await screen.findByRole('option',{name:'Internacional guardado'});await waitFor(()=>expect(container.querySelector('select[name="nivel_torneo"]')).not.toBeDisabled());});

async function fillCreateDraft(container){
 await screen.findByRole('option',{name:'Internacional guardado'});
 for(const [name,value] of Object.entries({nombre:'QA auth form',fecha_inicio:'2026-11-22',fecha_fin:'2026-11-22'}))fireEvent.change(container.querySelector(`input[name="${name}"]`),{target:{value}});
 fireEvent.change(container.querySelector('select[name="tipo_torneo"]'),{target:{value:'knockout'}});
 fireEvent.change(container.querySelector('select[name="nivel_torneo"]'),{target:{value:'internacional'}});
 fireEvent.click(screen.getByRole('button',{name:'Elegir sede QA'}));
}
test('actual form confirms current authorized creation and reread before calling onCreated',async()=>{
 const created=jest.fn();let posted;global.fetch=jest.fn(async(url,options)=>{
  if(options?.method==='POST'){const body=JSON.parse(options.body);posted=body;return {ok:true,json:async()=>[{...body,id:91}]};}
  if(url.endsWith('/api/torneos/91'))return {ok:true,json:async()=>({...posted,id:91})};
  return {ok:true,json:async()=>[]};
 });const {container}=render(<MemoryRouter><TorneoCrear embedded onCreated={created}/></MemoryRouter>);await fillCreateDraft(container);fireEvent.submit(container.querySelector('form'));await waitFor(()=>expect(created).toHaveBeenCalledWith(91));expect(fetch.mock.calls.find(([,opts])=>opts?.method==='POST')[1].headers.Authorization).toBe('Bearer sdk-current');
});
test('actual form keeps its draft when the live token is missing or creation is denied',async()=>{
 getAuthHeaders.mockResolvedValue({});const created=jest.fn();const {container}=render(<MemoryRouter><TorneoCrear embedded onCreated={created}/></MemoryRouter>);await fillCreateDraft(container);fireEvent.submit(container.querySelector('form'));await screen.findByRole('alert');expect(fetch.mock.calls.some(([,opts])=>opts?.method==='POST')).toBe(false);expect(container.querySelector('input[name="nombre"]')).toHaveValue('QA auth form');expect(created).not.toHaveBeenCalled();
 getAuthHeaders.mockResolvedValue({Authorization:'Bearer sdk-current'});fetch.mockResolvedValue({ok:false,status:403,json:async()=>({error:'Forbidden QA'})});fireEvent.submit(container.querySelector('form'));await waitFor(()=>expect(fetch.mock.calls.some(([,opts])=>opts?.method==='POST')).toBe(true));expect(container.querySelector('input[name="nombre"]')).toHaveValue('QA auth form');expect(created).not.toHaveBeenCalled();
});

 test('uses a real enabled canonical default, with no unsupported club alias',async()=>{
  const {container}=render(<MemoryRouter><TorneoCrear embedded/></MemoryRouter>);
  await waitFor(()=>expect(container.querySelector('select[name="nivel_torneo"]')).toHaveValue('club_no_oficial'));
  expect(screen.getByLabelText('Puntos base')).toHaveValue('10');
  expect(container.querySelector('option[value="club"]')).toBeNull();
 });
 test('falls back to a configured enabled level when the default is hidden or absent',async()=>{
  readPointsConfig.mockResolvedValue({...policy,niveles:{internacional:300},tipos_custom:[],niveles_hidden:['club_no_oficial']});
  const {container}=render(<MemoryRouter><TorneoCrear embedded/></MemoryRouter>);
  await waitFor(()=>expect(container.querySelector('select[name="nivel_torneo"]')).toHaveValue('internacional'));
  expect(screen.getByLabelText('Puntos base')).toHaveValue('300');
  expect(container.querySelector('option[value="nacional"]')).toBeNull();
 });
 test('restricts club admins to configured club levels and keeps custom international levels unavailable',async()=>{
  const {container}=render(<MemoryRouter><TorneoCrear embedded rol="admin_club"/></MemoryRouter>);
  await waitFor(()=>expect(container.querySelector('select[name="nivel_torneo"]')).toHaveValue('club_no_oficial'));
  expect([...container.querySelector('select[name="nivel_torneo"]').options].map(o=>o.value)).toEqual(['club_no_oficial','club_oficial']);
 });
 test('keeps the selector empty when no permitted club level is enabled',async()=>{
  readPointsConfig.mockResolvedValue({...policy,niveles:{internacional:300},tipos_custom:[]});
  const {container}=render(<MemoryRouter><TorneoCrear embedded rol="admin_club"/></MemoryRouter>);
  await waitFor(()=>expect(container.querySelector('select[name="nivel_torneo"]')).toHaveValue(''));
  expect(screen.getByLabelText('Puntos base')).toHaveValue('—');
 });
