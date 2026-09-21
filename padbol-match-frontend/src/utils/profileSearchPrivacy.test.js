import { searchPublicPlayerSummaries } from './perfilPublicoApi';
const originalFetch=global.fetch;
afterEach(()=>{global.fetch=originalFetch;});
test('person search requires an access token and never falls back to anonymous table reads',async()=>{
 global.fetch=jest.fn();expect(await searchPublicPlayerSummaries('QA')).toEqual([]);expect(global.fetch).not.toHaveBeenCalled();
});
test('authenticated search keeps public identity and strips contact, birth date and tokens',async()=>{
 global.fetch=jest.fn(async()=>({ok:true,json:async()=>({jugadores:[{user_id:'uuid-qa',alias:'@qa',display_name:'QA',email:'private@example.invalid',whatsapp:'private',fecha_nacimiento:'private',expo_push_token:'private'}]})}));
 const rows=await searchPublicPlayerSummaries('QA',{accessToken:'fixture',limit:3});
 expect(global.fetch.mock.calls[0][0]).toContain('/api/jugadores/buscar?q=QA&limit=3&contexto=perfil');expect(global.fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer fixture');expect(rows[0]).toMatchObject({user_id:'uuid-qa',alias:'qa',nombre:'QA'});
 for(const key of ['email','whatsapp','fecha_nacimiento','expo_push_token'])expect(rows[0]).not.toHaveProperty(key);
});
test('unauthorized search cannot be reported as a successful empty directory',async()=>{
 global.fetch=jest.fn(async()=>({ok:false,status:401}));await expect(searchPublicPlayerSummaries('QA',{accessToken:'expired'})).rejects.toThrow('public_player_search_unavailable');
});
