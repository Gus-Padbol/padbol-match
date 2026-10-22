import {getAuthHeaders} from './scoreboardApi';
import {createConfirmedAdminTournament} from './adminTournamentCreate';
jest.mock('./scoreboardApi',()=>({getAuthHeaders:jest.fn()}));
const context={apiBaseUrl:'https://fixture.invalid'};
const body={nombre:'QA create',sede_id:7,nivel_torneo:'internacional',deporte:'padbol',tipo_torneo:'grupos_knockout',modalidad_plantel:'selecciones',created_by:'untrusted-body'};
const row={...body,estado:'planificacion',id:91,created_by:'authoritative-actor'};
const response=(data,ok=true,status=200)=>({ok,status,json:async()=>data});
beforeEach(()=>{getAuthHeaders.mockResolvedValue({Authorization:'Bearer current-sdk-session'});global.fetch=jest.fn();});
test('creation uses current SDK authorization and only succeeds after matching receipt and authenticated reread',async()=>{
 fetch.mockResolvedValueOnce(response([row])).mockResolvedValueOnce(response(row));expect(await createConfirmedAdminTournament(context,body)).toEqual(row);
 expect(fetch.mock.calls[0][1]).toMatchObject({method:'POST',headers:{Authorization:'Bearer current-sdk-session'}});expect(JSON.parse(fetch.mock.calls[0][1].body)).not.toHaveProperty('created_by');expect(fetch.mock.calls[1]).toEqual(['https://fixture.invalid/api/torneos/91',{headers:{Authorization:'Bearer current-sdk-session'}}]);
});
test('missing live authorization blocks creation before network',async()=>{getAuthHeaders.mockResolvedValue({});await expect(createConfirmedAdminTournament(context,body)).rejects.toThrow(/sesión/);expect(fetch).not.toHaveBeenCalled();});
test('failed reread retains the receipt and retry only reads the same created record',async()=>{
 const pending={current:null};fetch.mockResolvedValueOnce(response([row])).mockResolvedValueOnce(response(null,false,503));await expect(createConfirmedAdminTournament(context,body,pending)).rejects.toThrow(/puede haber quedado creado/);
 fetch.mockResolvedValueOnce(response(row));await expect(createConfirmedAdminTournament(context,body,pending)).resolves.toEqual(row);expect(fetch.mock.calls.filter(([,options])=>options.method==='POST')).toHaveLength(1);
});
test('empty or mismatched confirmation does not succeed and ambiguous creation never blindly posts again',async()=>{
 const pending={current:null};fetch.mockResolvedValueOnce(response([]));await expect(createConfirmedAdminTournament(context,body,pending)).rejects.toThrow(/identificador/);await expect(createConfirmedAdminTournament(context,body,pending)).rejects.toThrow(/incierto/);expect(fetch).toHaveBeenCalledTimes(1);
 fetch.mockResolvedValueOnce(response([row])).mockResolvedValueOnce(response({...row,sede_id:8}));await expect(createConfirmedAdminTournament(context,body)).rejects.toThrow(/no se confirmó/);
});
test('explicit denied creation leaves the payload intact and permits a new authenticated attempt',async()=>{
 const pending={current:null};fetch.mockResolvedValueOnce(response({error:'Forbidden'},false,403));await expect(createConfirmedAdminTournament(context,body,pending)).rejects.toThrow('Forbidden');expect(pending.current).toBeNull();expect(body.created_by).toBe('untrusted-body');
});

test('an old draft claiming registration open still follows authoritative creation in planning without a false mismatch',async()=>{fetch.mockResolvedValueOnce(response([row])).mockResolvedValueOnce(response(row));await expect(createConfirmedAdminTournament(context,{...body,estado:'abierto'})).resolves.toEqual(row);expect(JSON.parse(fetch.mock.calls[0][1].body).estado).toBe('planificacion');});
