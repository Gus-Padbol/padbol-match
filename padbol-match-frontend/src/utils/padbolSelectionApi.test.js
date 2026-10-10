import { getAuthHeaders } from './scoreboardApi';
import { createSelectionTeam, readSelectionLineup, saveSelectionLineup, saveSelectionRoster, confirmSelectionRegistration, listSelectionTeams } from './padbolSelectionApi';
jest.mock('./scoreboardApi',()=>({getAuthHeaders:jest.fn()}));
const ids=Array.from({length:8},(_,i)=>`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`);
const plantel=ids.map((user_id,i)=>({user_id,nombre:`QA ${i+1}`,estado:'confirmado'}));
const context={apiBaseUrl:'https://fixture.invalid/',torneoId:9,partidoId:33,equipoId:71};
const lineup={ok:true,torneo_id:9,partido_id:33,equipo_id:71,required:true,can_edit:true,plantel,alineacion:null,alternancia:'games_impares'};
const team={ok:true,torneo_id:9,equipo_id:71,plantel_revision:1,cupo_maximo:8,creador_id:ids[0],jugadores:plantel.slice(0,4),solicitudes:[],can_confirm:true,can_manage:true,can_add_profiles:false,inscripcion_estado:'pendiente',status:'saved'};
const response=data=>({ok:true,status:200,json:async()=>data});
beforeEach(()=>{getAuthHeaders.mockResolvedValue({'Content-Type':'application/json',Authorization:'Bearer local-fixture'});global.fetch=jest.fn().mockResolvedValue(response(lineup));});
test('actual lineup GET carries authenticated headers and refuses anonymous fallback',async()=>{
 await readSelectionLineup(context);expect(fetch.mock.calls[0][0]).toBe('https://fixture.invalid/api/torneos/9/partidos/33/equipos/71/alineacion');expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer local-fixture');getAuthHeaders.mockResolvedValue({});await expect(readSelectionLineup(context)).rejects.toMatchObject({status:401});expect(fetch).toHaveBeenCalledTimes(1);
});
test('four-player save sends only two starters, two substitutes and revision, and validates exact receipt',async()=>{
 const selected={iniciales:ids.slice(0,2),suplentes:ids.slice(2,4)};fetch.mockResolvedValue(response({...lineup,alineacion:{...selected,revision:1}}));await saveSelectionLineup({...context,alineacion:selected,plantel,expected_revision:0});expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({...selected,expected_revision:0});expect(fetch.mock.calls[0][1].method).toBe('PUT');
 fetch.mockResolvedValue(response({...lineup,equipo_id:99}));await expect(saveSelectionLineup({...context,alineacion:selected,plantel,expected_revision:0})).rejects.toThrow(/confirmó/);
});
test('duplicate, outsider and stale revisions are rejected before network',async()=>{
 for(const input of [{alineacion:{iniciales:ids.slice(0,2),suplentes:[ids[0],ids[3]]},expected_revision:0},{alineacion:{iniciales:ids.slice(0,2),suplentes:[ids[2],'ffffffff-ffff-4fff-8fff-ffffffffffff']},expected_revision:0},{alineacion:{iniciales:ids.slice(0,2),suplentes:ids.slice(2,4)},expected_revision:-1}]) await expect(saveSelectionLineup({...context,plantel,...input})).rejects.toThrow();expect(fetch).not.toHaveBeenCalled();
});
test('403,409,missing receipt and malformed persisted lineup never claim success',async()=>{
 for(const failure of [{ok:false,status:403,json:async()=>({error:'Sin permisos'})},{ok:false,status:409,json:async()=>({error:'Recarga la revisión'})},response({ok:true}),response({...lineup,alineacion:{iniciales:ids.slice(0,2),suplentes:[ids[0],ids[3]],revision:1}})]){fetch.mockResolvedValue(failure);await expect(readSelectionLineup(context)).rejects.toThrow();}
});
test('selection create stays in tournament teams, preserves eight capacity and never sends player identity from client',async()=>{
 fetch.mockResolvedValue(response(team));await createSelectionTeam({...context,nombre:'QA selection',cupo_maximo:8,equipo_abierto:true});expect(fetch.mock.calls[0][0]).toBe('https://fixture.invalid/api/torneos/9/selecciones');expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({nombre:'QA selection',cupo_maximo:8,equipo_abierto:true});
});
test('roster change sends only UUIDs/revision; invalid UUID and malformed team response fail honestly',async()=>{
 fetch.mockResolvedValue(response(team));await saveSelectionRoster({...context,user_ids:ids.slice(0,4),expected_revision:0});expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({user_ids:ids.slice(0,4),expected_revision:0});await expect(saveSelectionRoster({...context,user_ids:[ids[0],ids[0]],expected_revision:0})).rejects.toThrow();fetch.mockResolvedValue(response({...team,equipo_id:99}));await expect(saveSelectionRoster({...context,user_ids:ids.slice(0,4),expected_revision:0})).rejects.toThrow();
});
test('free registration requires authoritative confirmed state, not a generic ok response',async()=>{
 fetch.mockResolvedValue(response(team));await expect(confirmSelectionRegistration({...context,expected_revision:1})).rejects.toThrow(/inscripción/);fetch.mockResolvedValue(response({...team,inscripcion_estado:'confirmado'}));await confirmSelectionRegistration({...context,expected_revision:1});expect(fetch.mock.calls.at(-1)[0]).toMatch(/\/confirmar$/);expect(JSON.parse(fetch.mock.calls.at(-1)[1].body)).toEqual({expected_revision:1});
});
test('list errors are never turned into empty teams',async()=>{
 fetch.mockResolvedValue(response({ok:true,torneo_id:99,equipos:[]}));await expect(listSelectionTeams(context)).rejects.toThrow();fetch.mockResolvedValue(response({ok:true,torneo_id:9,equipos:[]}));expect(await listSelectionTeams(context)).toEqual([]);
});
