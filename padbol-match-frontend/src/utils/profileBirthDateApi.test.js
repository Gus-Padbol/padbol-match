import {fetchProfileBirthDate,saveChangedProfileBirthDate} from './profileBirthDateApi';
const reply=(date,ok=true)=>({ok,json:async()=>({fecha_nacimiento:date})});
beforeEach(()=>{global.fetch=jest.fn();});
test('GET authenticated identity date including null; no legacy fallback',async()=>{
 fetch.mockResolvedValue(reply(null));
 expect(await fetchProfileBirthDate({accessToken:'fixture'})).toBeNull();
 expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/jugador/identidad'),expect.objectContaining({method:'GET',headers:{Authorization:'Bearer fixture'}}));
});
test('unchanged date means no request; changed date sends only date and explicit deletion null',async()=>{
 expect(await saveChangedProfileBirthDate({value:'',initialDate:null,accessToken:'fixture'})).toBeNull();expect(fetch).not.toHaveBeenCalled();
 fetch.mockResolvedValue(reply(null));
 await saveChangedProfileBirthDate({value:'',initialDate:'2000-01-01',accessToken:'fixture'});
 expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({fecha_nacimiento:null});
});
test('changed date is confirmed, never carries document/profile data',async()=>{
 fetch.mockResolvedValue(reply('2000-01-01'));
 expect(await saveChangedProfileBirthDate({value:'2000-01-01',initialDate:null,accessToken:'fixture'})).toBe('2000-01-01');
 expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({fecha_nacimiento:'2000-01-01'});
});
test('errors, malformed and mismatched replies fail closed',async()=>{
 for(const response of [reply(null,false),{ok:true,json:async()=>({})},reply('bad'),reply('2001-01-01')]){
 fetch.mockResolvedValue(response);
 await expect(saveChangedProfileBirthDate({value:'2000-01-01',initialDate:null,accessToken:'fixture'})).rejects.toThrow();
 }
});
test('session switch/unmount prevents dispatch and discards late response',async()=>{
 let current=false;await expect(fetchProfileBirthDate({accessToken:'fixture',isCurrent:()=>current})).rejects.toThrow();expect(fetch).not.toHaveBeenCalled();
 current=true;let resolve;fetch.mockImplementation(()=>new Promise(r=>{resolve=r}));
 const pending=fetchProfileBirthDate({accessToken:'fixture',isCurrent:()=>current});current=false;resolve(reply('2000-01-01'));
 await expect(pending).rejects.toThrow(/sesión cambió/);
});
