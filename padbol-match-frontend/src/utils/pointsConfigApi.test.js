import { getAuthHeaders } from './scoreboardApi';
import { readPointsConfig,savePointsConfig,validatePointsConfig,pointsBaseForLevel } from './pointsConfigApi';
jest.mock('./scoreboardApi',()=>({getAuthHeaders:jest.fn()}));
const policy={niveles:{club_oficial:30,nacional:100,internacional:300},posiciones:{1:100,2:60,3:40},tipos_custom:[],niveles_labels:{internacional:'International'},niveles_hidden:['nacional'],source:'persisted',policy_version:'a'.repeat(64)};
const body=Object.fromEntries(['niveles','posiciones','tipos_custom','niveles_labels','niveles_hidden'].map(key=>[key,policy[key]]));
const context={apiBaseUrl:'https://fixture.invalid'};const response=data=>({ok:true,json:async()=>data});
beforeEach(()=>{getAuthHeaders.mockResolvedValue({Authorization:'Bearer fixture-only'});global.fetch=jest.fn();});
test('100/60/40 are individual multipliers, preserved without reset or sum-to-100 requirement',()=>{expect(validatePointsConfig(policy).posiciones).toEqual({1:100,2:60,3:40});expect(pointsBaseForLevel(policy,'internacional')).toBe(300);expect(pointsBaseForLevel(policy,'club')).toBe(30);});
test('save verifies server receipt then GET, retaining labels and hidden levels',async()=>{fetch.mockResolvedValueOnce(response({ok:true,config:policy})).mockResolvedValueOnce(response(policy));await expect(savePointsConfig(context,body)).resolves.toEqual(policy);expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual(body);expect(fetch).toHaveBeenCalledTimes(2);});
test('failed, empty or mismatching receipts and stale reads never claim saved configuration',async()=>{
 for(const receipt of [{ok:false,json:async()=>({error:'No permission'})},response(null),response({ok:true}),response({ok:true,config:{...policy,posiciones:{1:30}}})]){fetch.mockResolvedValueOnce(receipt);await expect(savePointsConfig(context,body)).rejects.toThrow();}
 fetch.mockResolvedValueOnce(response({ok:true,config:policy})).mockResolvedValueOnce(response({...policy,policy_version:'b'.repeat(64)}));await expect(savePointsConfig(context,body)).rejects.toThrow(/lectura posterior/);
});
test('unknown server policy never becomes locally invented defaults',async()=>{fetch.mockResolvedValue(response({posiciones:{1:100}}));await expect(readPointsConfig(context)).rejects.toThrow();expect(pointsBaseForLevel(policy,'unknown')).toBeNull();});
