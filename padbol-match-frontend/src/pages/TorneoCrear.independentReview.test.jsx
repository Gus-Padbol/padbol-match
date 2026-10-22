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
jest.mock('../hooks/useUserRole',()=>()=>({rol:'admin_club',sedeId:7}));
jest.mock('../components/AppHeader',()=>()=>null);jest.mock('../components/BottomNav',()=>()=>null);jest.mock('../components/SedeSearchInput',()=>props=><button type="button" onClick={()=>props.onChangeId(7)}>Elegir sede QA</button>);
jest.mock('../i18n/tSafe',()=>{const es=require('../i18n/locales/es.json');const t=(key,args)=>key.split('.').reduce((value,k)=>value?.[k],es)||args?.defaultValue||key;return {useSafeTranslation:()=>({t,i18n:{language:'es'}})};});
const policy={niveles:{club_oficial:30,club_no_oficial:10,nacional:100,internacional:300,mundial:1000},posiciones:{1:100,2:60,3:40},tipos_custom:[{id:'special',nombre:'Especial aprobado',puntos:80}],niveles_labels:{internacional:'Internacional guardado'},niveles_hidden:['mundial']};
beforeEach(()=>{jest.clearAllMocks();getAuthHeaders.mockResolvedValue({Authorization:'Bearer sdk-current'});global.fetch=jest.fn().mockResolvedValue({json:async()=>[]});readPointsConfig.mockResolvedValue(policy);});

async function completeClubDraft(container){
 await waitFor(()=>expect(container.querySelector('select[name="nivel_torneo"]')).not.toBeDisabled());
 for(const [name,value]of Object.entries({nombre:'QA club canonical default',fecha_inicio:'2026-11-22',fecha_fin:'2026-11-22'}))fireEvent.change(container.querySelector(`input[name="${name}"]`),{target:{value}});
 fireEvent.change(container.querySelector('select[name="tipo_torneo"]'),{target:{value:'knockout'}});
 fireEvent.click(screen.getByRole('button',{name:'Elegir sede QA'}));
}
test('independent club path submits configured default10 with zero enrollment cost and current auth, then verifies receipt',async()=>{
 const created=jest.fn();let submitted;
 global.fetch=jest.fn(async(url,opts)=>{
  if(opts?.method==='POST'){submitted=JSON.parse(opts.body);return{ok:true,json:async()=>[{...submitted,id:91}]};}
  if(url.endsWith('/api/torneos/91'))return{ok:true,json:async()=>({...submitted,id:91})};
  return{ok:true,json:async()=>[]};
 });
 const{container}=render(<MemoryRouter><TorneoCrear embedded rol="admin_club" onCreated={created}/></MemoryRouter>);
 await completeClubDraft(container);
 expect(container.querySelector('select[name="nivel_torneo"]')).toHaveValue('club_no_oficial');
 expect(screen.getByLabelText('Puntos base')).toHaveValue('10');
 fireEvent.submit(container.querySelector('form'));
 await waitFor(()=>expect(created).toHaveBeenCalledWith(91));
 expect(submitted).toMatchObject({nivel_torneo:'club_no_oficial',sede_id:7,costo_inscripcion:0});
 expect(submitted.puntos_total).toBeUndefined();
 expect(fetch.mock.calls.find(([,opts])=>opts?.method==='POST')[1].headers.Authorization).toBe('Bearer sdk-current');
});
test('independent club path cannot submit when both club levels are hidden despite international configured',async()=>{
 readPointsConfig.mockResolvedValue({...policy,niveles_hidden:['club_oficial','club_no_oficial']});
 const created=jest.fn();const{container}=render(<MemoryRouter><TorneoCrear embedded rol="admin_club" onCreated={created}/></MemoryRouter>);
 await completeClubDraft(container);expect(container.querySelector('select[name="nivel_torneo"]')).toHaveValue('');
 fireEvent.submit(container.querySelector('form'));
 await screen.findByRole('alert');expect(fetch.mock.calls.some(([,opts])=>opts?.method==='POST')).toBe(false);expect(created).not.toHaveBeenCalled();
});
