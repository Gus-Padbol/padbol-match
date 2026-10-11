import {getAuthHeaders} from './scoreboardApi';
import {openConfirmedTournamentRegistration} from './adminTournamentRegistration';
jest.mock('./scoreboardApi',()=>({getAuthHeaders:jest.fn()}));
const context={apiBaseUrl:'https://fixture.invalid',torneoId:7};
const response=(data,ok=true)=>({ok,json:async()=>data});
beforeEach(()=>{getAuthHeaders.mockResolvedValue({Authorization:'Bearer sdk-current'});global.fetch=jest.fn();});
test('open registration uses supported PUT and confirms server receipt plus persisted state',async()=>{
 const row={id:7,estado:'abierto'};fetch.mockResolvedValueOnce(response([row])).mockResolvedValueOnce(response(row));await expect(openConfirmedTournamentRegistration(context)).resolves.toEqual(row);expect(fetch.mock.calls[0][1]).toMatchObject({method:'PUT',headers:{Authorization:'Bearer sdk-current'},body:JSON.stringify({estado:'abierto'})});expect(fetch).toHaveBeenCalledTimes(2);
});
test('anonymous or unsuccessful/mismatched opening never supplies an optimistic open state',async()=>{
 getAuthHeaders.mockResolvedValue({});await expect(openConfirmedTournamentRegistration(context)).rejects.toThrow();expect(fetch).not.toHaveBeenCalled();getAuthHeaders.mockResolvedValue({Authorization:'Bearer sdk-current'});
 fetch.mockResolvedValueOnce(response({error:'Denied'},false));await expect(openConfirmedTournamentRegistration(context)).rejects.toThrow('Denied');fetch.mockResolvedValueOnce(response({id:7,estado:'proximo'}));await expect(openConfirmedTournamentRegistration(context)).rejects.toThrow(/recibo/);fetch.mockResolvedValueOnce(response({id:7,estado:'abierto'})).mockResolvedValueOnce(response({id:7,estado:'proximo'}));await expect(openConfirmedTournamentRegistration(context)).rejects.toThrow(/lectura posterior/);
});
