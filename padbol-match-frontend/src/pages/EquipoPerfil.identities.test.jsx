import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EquipoPerfil from './EquipoPerfil';
import { supabase } from '../supabaseClient';
import { fetchPublicPlayerSummary } from '../utils/perfilPublicoApi';
jest.mock('react-router-dom', () => ({ ...jest.requireActual('react-router-dom'), useParams: () => ({ id: '179' }) }));
jest.mock('../components/AppHeader', () => () => null);
jest.mock('../components/BottomNav', () => () => null);
jest.mock('../context/HubNavLayoutContext', () => ({ useHubNavLayout: () => ({ navDock: 'bottom' }) }));
jest.mock('../components/JugadorPreviewModal', () => ({open}) => open ? <div>Perfil abierto</div> : null);
jest.mock('../utils/perfilPublicoApi', () => ({ fetchPublicPlayerSummary: jest.fn() }));
jest.mock('../supabaseClient', () => ({ supabase: { from: jest.fn() } }));

// Actual raw QA179 database read; no account identities are fabricated.
const actualTeam = {"creador_id": "22482ee7-d6f3-4ddf-9605-1d492c8ea92b", "cupo_maximo": 8, "id": 179, "inscripcion_estado": "confirmado", "jugadores": [{"estado": "confirmado", "estado_vinculacion": "sin_cuenta", "nombre": "QA Invitado 1", "participante_id": "86e94d64-2e2c-49cc-a855-cd9eceb2001b", "ranking_oficial_elegible": false, "tipo_identidad": "generico", "user_id": null}, {"estado": "confirmado", "estado_vinculacion": "sin_cuenta", "nombre": "QA Invitado 2", "participante_id": "a4a9b9fe-e503-4707-b213-392d3acfedf5", "ranking_oficial_elegible": false, "tipo_identidad": "generico", "user_id": null}, {"estado": "confirmado", "estado_vinculacion": "sin_cuenta", "nombre": "QA Invitado 3", "participante_id": "66ce470a-f740-4b58-8018-64be6e4f6e6c", "ranking_oficial_elegible": false, "tipo_identidad": "generico", "user_id": null}, {"estado": "confirmado", "estado_vinculacion": "sin_cuenta", "nombre": "QA Invitado 4", "participante_id": "5075f834-ee18-4ef3-9038-097090b75a87", "ranking_oficial_elegible": false, "tipo_identidad": "generico", "user_id": null}, {"estado": "pendiente", "estado_vinculacion": "sin_cuenta", "nombre": "", "participante_id": "a064e55a-a70a-44a2-b80c-36993d4a1f4d", "ranking_oficial_elegible": false, "tipo_identidad": "plaza_pendiente", "user_id": null}, {"estado": "pendiente", "estado_vinculacion": "sin_cuenta", "nombre": "", "participante_id": "145c032c-4b4f-45d1-956c-aa08091f176c", "ranking_oficial_elegible": false, "tipo_identidad": "plaza_pendiente", "user_id": null}, {"estado": "pendiente", "estado_vinculacion": "sin_cuenta", "nombre": "", "participante_id": "7345ee11-712e-4538-8fc7-49f977565af9", "ranking_oficial_elegible": false, "tipo_identidad": "plaza_pendiente", "user_id": null}, {"estado": "pendiente", "estado_vinculacion": "sin_cuenta", "nombre": "", "participante_id": "04cdd9e3-bf03-41ee-a747-3ce65004d1f2", "ranking_oficial_elegible": false, "tipo_identidad": "plaza_pendiente", "user_id": null}], "modalidad_plantel": "selecciones", "nombre": "QA Equipo 1 — Cuatro y cuatro", "sede_id": 8, "torneo_id": 48};

function setup(team, error=null) {
 supabase.from.mockImplementation(table => {
 const chain={ select:jest.fn(()=>chain), eq:jest.fn(()=>chain), maybeSingle:jest.fn(async()=>({data:team,error})), order:jest.fn(async()=>({data:[],error:null})) };
 return chain;
 });
 return render(<MemoryRouter><EquipoPerfil /></MemoryRouter>);
}
beforeEach(()=>jest.clearAllMocks());
test('actual QA179 raw database roster shows four guests and four pending places without profile actions or account lookup',async()=>{
 setup(actualTeam);
 expect(await screen.findByRole('heading',{name:actualTeam.nombre})).toHaveStyle({color:'var(--text-primary)'});
 expect(screen.getAllByText('Plaza pendiente')).toHaveLength(4);
 expect(screen.getAllByText('Participante sin cuenta')).toHaveLength(4);
 expect(screen.getByText('QA Invitado 1').closest('button')).toBeNull();
 expect(screen.queryByRole('button',{name:/Jugador|QA Invitado|Plaza pendiente/})).not.toBeInTheDocument();
 expect(fetchPublicPlayerSummary).not.toHaveBeenCalled();
 expect(screen.queryByText('Perfil abierto')).not.toBeInTheDocument();
});
test('a sporting PID or misleading legacy id never causes a guest profile lookup',async()=>{
 setup({...actualTeam,jugadores:[{participante_id:'pid',tipo_identidad:'generico',id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',nombre:'Invitado',alias:'wrong'}]});
 await screen.findByText('Participante sin cuenta');
 expect(fetchPublicPlayerSummary).not.toHaveBeenCalled();
 expect(screen.queryByText('@wrong')).not.toBeInTheDocument();
});
test('legacy registered player still loads public summary and opens preview',async()=>{
 const uid='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
 fetchPublicPlayerSummary.mockResolvedValue({user_id:uid,nombre:'Ana',alias:'ana'});
 setup({...actualTeam,jugadores:[{id:uid,nombre:'Ana'}]});
 const button=await screen.findByRole('button',{name:/@ana/});
 expect(fetchPublicPlayerSummary).toHaveBeenCalledTimes(1);
 fireEvent.click(button);
 expect(screen.getByText('Perfil abierto')).toBeInTheDocument();
});
test('read failure does not show stale player actions',async()=>{
 setup(null,{message:'denied'});
 await screen.findByText(/No se encontr/);
 expect(fetchPublicPlayerSummary).not.toHaveBeenCalled();
});

test('linked registry participant looks up only the real account, not its sporting PID',async()=>{
 const uid='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
 fetchPublicPlayerSummary.mockResolvedValue({user_id:uid,nombre:'Cuenta vinculada',alias:'linked'});
 setup({...actualTeam,jugadores:[{participante_id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',tipo_identidad:'generico',user_id:uid,nombre:'Cuenta vinculada'}]});
 await screen.findByRole('button',{name:/@linked/});
 expect(fetchPublicPlayerSummary).toHaveBeenCalledTimes(1);
 expect(fetchPublicPlayerSummary).toHaveBeenCalledWith(uid);
 expect(screen.queryByText('Participante sin cuenta')).not.toBeInTheDocument();
});
