import { fetchPublicPlayerSummary } from './perfilPublicoApi';
import { checkRegistrationAliasAvailability } from './registroAliasApi';
import { fetchJugadoresPerfilPorJugadores } from './jugadorNombreTorneo';
const originalFetch=global.fetch;
const originalEnv=process.env;
const id='ab6d7b67-0de6-4761-a402-1ef8082d26ec';
beforeEach(()=>{process.env={...originalEnv,REACT_APP_APP_VARIANT:'production',REACT_APP_API_BASE_URL:'https://api.qa.example'};});
afterEach(()=>{global.fetch=originalFetch;process.env=originalEnv;});

test('public summary requests only the safe profile DTO and strips sensitive legacy fields',async()=>{
 global.fetch=jest.fn(async()=>({ok:true,json:async()=>({perfil:{user_id:id,alias:'qa-player',nombre:'QA',foto_url:'https://images.example/qa.png',email:'private@example.invalid',whatsapp:'private',fecha_nacimiento:'private',expo_push_token:'private'}})}));
 const summary=await fetchPublicPlayerSummary(id);
 expect(global.fetch).toHaveBeenCalledWith(`https://api.qa.example/api/jugador/perfil-publico/${id}`,{});
 expect(summary).toMatchObject({user_id:id,alias:'qa-player',nombre:'QA'});
 for(const key of ['email','whatsapp','fecha_nacimiento','expo_push_token'])expect(summary).not.toHaveProperty(key);
});

test('public lookup never searches an email or requests empty identifiers',async()=>{
 global.fetch=jest.fn();expect(await fetchPublicPlayerSummary('private@example.invalid')).toBeNull();expect(await fetchPublicPlayerSummary('')).toBeNull();expect(global.fetch).not.toHaveBeenCalled();
});

test('tournament enrichment uses UUID/alias and attaches only the email already supplied by its caller',async()=>{
 global.fetch=jest.fn(async()=>({ok:true,json:async()=>({user_id:id,display_name:'QA Player',username:'qa-player',email:'server-secret@example.invalid',whatsapp:'private'})}));
 const rows=await fetchJugadoresPerfilPorJugadores([{user_id:id,email:'Known@Example.invalid'},{email:'only-email@example.invalid'}]);
 expect(global.fetch).toHaveBeenCalledTimes(1);expect(global.fetch.mock.calls[0][0]).toContain(id);expect(global.fetch.mock.calls[0][0]).not.toContain('email');
 expect(rows).toHaveLength(1);expect(rows[0].email).toBe('known@example.invalid');expect(rows[0]).not.toHaveProperty('whatsapp');
});

test('registration alias endpoint sends only encoded alias and no claimed owner',async()=>{
 global.fetch=jest.fn(async()=>({ok:true,json:async()=>({available:true})}));
 expect(await checkRegistrationAliasAvailability(' qa_% ')).toBe(true);
 expect(global.fetch).toHaveBeenCalledWith('https://api.qa.example/api/registro/alias-disponible?alias=qa_%25',{headers:{}});
 expect(global.fetch.mock.calls[0][0]).not.toContain('user_id');
});

test('authenticated alias check uses Bearer so the server can exclude the actual owner',async()=>{
 global.fetch=jest.fn(async()=>({ok:true,json:async()=>({available:false})}));
 expect(await checkRegistrationAliasAvailability('qa-player',{accessToken:'fixture'})).toBe(false);
 expect(global.fetch.mock.calls[0][1].headers).toEqual({Authorization:'Bearer fixture'});
});

test('alias validation rejects email/empty/overlong input without searching profiles',async()=>{
 global.fetch=jest.fn();for(const alias of ['', 'a@example.invalid','a'.repeat(81)])expect(await checkRegistrationAliasAvailability(alias)).toBe(false);expect(global.fetch).not.toHaveBeenCalled();
});

test('a missing route or malformed alias response cannot be treated as available',async()=>{
 global.fetch=jest.fn(async()=>({ok:false,status:404,json:async()=>({})}));await expect(checkRegistrationAliasAvailability('qa')).rejects.toThrow('alias_availability_unavailable');
 global.fetch=jest.fn(async()=>({ok:true,json:async()=>({rows:[]})}));await expect(checkRegistrationAliasAvailability('qa')).rejects.toThrow('alias_availability_unavailable');
});
