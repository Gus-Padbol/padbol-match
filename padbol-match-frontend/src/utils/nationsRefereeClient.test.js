import {createNationsRefereeClient} from './nationsRefereeClient';
const ok=data=>({ok:true,status:200,json:async()=>data});
const board={id:'board',torneo_id:28,estado:'en_curso'};
const context={scoreboardId:'board',hasBaseline:true,membership:{A:'1',B:'2'},teamIds:['1','2'],teams:{1:{},2:{}}};
const marker={matchRevision:3,gamesEpoch:0,trackingStatus:'active',state:{active:['a','b']},substitution_window:{allowed:true,completed_games:1,set_number:1}};
function fixture(token=false){const fetchImpl=jest.fn(async url=>url.includes('/context')?ok(context):url.includes('?teamId=')?ok({...marker,teamId:new URL(url,'https://test.invalid').searchParams.get('teamId')}):url.endsWith('/api/torneos/28')?ok({modalidad_plantel:'selecciones'}):ok(board));return {fetchImpl,client:createNationsRefereeClient({scoreboardId:'board',controlToken:token?'opaque-token':null,accessToken:'bearer',fetchImpl})};}
test('staff reads server classification/window, stable point/undo body and durable clock paths',async()=>{
 const {client,fetchImpl}=fixture();const s=await client.read();expect(s.mode).toBe('nations');expect(s.window.allowed).toBe(true);
 const point=client.attempt('point',s,{side:'A'},()=> 'stable-id');expect(point).toEqual({path:'/api/scoreboard/partidos/board/punto/A',body:{requestId:'stable-id',epoch:0}});
 expect(client.attempt('undo',s,{},()=> 'undo-id').body).toEqual({requestId:'undo-id',epoch:0});
 for(const type of ['pause','resume','close'])expect(client.attempt(type,s,{},()=> 'key')).toEqual({path:'/api/nations/marker/board/global/commands',body:{type,idempotencyKey:'key',expectedRevision:3,epoch:0}});
 expect(client.attempt('start',s,{},()=> 'key').path).toBe('/api/nations/marker/board/start');
 expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe('Bearer bearer');
});
test('control token stays scoped to token endpoints, no bearer or client actor/board authority',async()=>{
 const {client,fetchImpl}=fixture(true);const s=await client.read();const attempt=client.attempt('substitution',s,{teamId:'1',swaps:[{outId:'a',inId:'c'},{outId:'b',inId:'d'}]},()=> 'id');
 expect(attempt.path).toBe('/api/scoreboard/control/opaque-token/nations/team/1/commands');
 expect(attempt.body).toEqual({type:'substitution',eventId:'id',idempotencyKey:'id',expectedRevision:3,epoch:0,swaps:[{outId:'a',inId:'c'},{outId:'b',inId:'d'}]});
 expect(fetchImpl.mock.calls.every(([,options])=>!options.headers.Authorization)).toBe(true);
 const before=JSON.stringify(attempt);await client.send(attempt);await client.send(attempt);expect(JSON.stringify(attempt)).toBe(before);expect(fetchImpl.mock.calls.at(-1)[1].body).toBe(fetchImpl.mock.calls.at(-2)[1].body);
});
test('non-Nations staff retains legacy, revoked token never falls back, missing/drift window stays closed',async()=>{
 const {client,fetchImpl}=fixture();fetchImpl.mockImplementation(async url=>url.endsWith('/api/torneos/28')?ok({modalidad_plantel:'dobles'}):ok(board));expect((await client.read()).mode).toBe('legacy');
 const revoked=fixture(true);revoked.fetchImpl.mockResolvedValue({ok:false,status:401,json:async()=>({code:'AUTH_REQUIRED'})});await expect(revoked.client.read()).rejects.toMatchObject({status:401});
 const drift=fixture();drift.fetchImpl.mockImplementation(async url=>url.includes('/context')?ok(context):url.includes('?teamId=')?ok({...marker,teamId:new URL(url,'https://test.invalid').searchParams.get('teamId'),substitution_window:null,code:'CLOCK_OUT_OF_SYNC'}):url.endsWith('/api/torneos/28')?ok({modalidad_plantel:'selecciones'}):ok(board));const s=await drift.client.read();expect(s.window).toBeNull();expect(s.clockSynced).toBe(false);expect(s.coherent).toBe(true); // Natural-terminal close still reaches the locked server check.
});
test('server team identity drift closes all mutations instead of opening a stale change window',async()=>{
 const {client,fetchImpl}=fixture();fetchImpl.mockImplementation(async url=>url.includes('/context')?ok(context):url.includes('?teamId=')?ok({...marker,teamId:'wrong-team'}):url.endsWith('/api/torneos/28')?ok({modalidad_plantel:'selecciones'}):ok(board));
 const s=await client.read();expect(s.coherent).toBe(false);expect(s.window).toBeNull();
});
test('linked board missing denormalized tournament never silently falls back to legacy points',async()=>{
 const {client,fetchImpl}=fixture();fetchImpl.mockImplementation(async url=>url.includes('/context')?{ok:false,status:503,json:async()=>({code:'CONTEXT_UNAVAILABLE'})}:ok({...board,torneo_id:null,partido_torneo_id:70}));
 await expect(client.read()).rejects.toMatchObject({code:'CONTEXT_UNAVAILABLE'});
});
test('hidden public tournament404 still resolves the normal authorized Nations context',async()=>{
 const {client,fetchImpl}=fixture();const normal=fetchImpl.getMockImplementation();fetchImpl.mockImplementation(async(...args)=>args[0].endsWith('/api/torneos/28')?{ok:false,status:404,json:async()=>({code:'NOT_FOUND'})}:normal(...args));
 const s=await client.read();expect(s.mode).toBe('nations');expect(s.coherent).toBe(true);expect(s.window.allowed).toBe(true);
 expect(fetchImpl.mock.calls.find(([url])=>url.endsWith('/context'))[1].headers.Authorization).toBe('Bearer bearer');
});
test('hidden tournament fallback never grants access or downgrades to legacy on denied/broken context',async()=>{
 for(const [status,code]of [[401,'AUTH_REQUIRED'],[403,'FORBIDDEN'],[403,'NOT_NATIONS_TOURNAMENT'],[503,'CONTEXT_UNAVAILABLE']]){
  const {client,fetchImpl}=fixture();fetchImpl.mockImplementation(async url=>url.endsWith('/api/torneos/28')?{ok:false,status:404,json:async()=>({code:'NOT_FOUND'})}:url.endsWith('/context')?{ok:false,status,json:async()=>({code})}:ok(board));
  await expect(client.read()).rejects.toMatchObject({status,code});expect(fetchImpl.mock.calls.some(([url])=>url.includes('?teamId='))).toBe(false);
 }
});
test('catalog auth/server errors do not use hidden-tournament fallback',async()=>{
 for(const status of[401,403,500]){const {client,fetchImpl}=fixture();fetchImpl.mockImplementation(async url=>url.endsWith('/api/torneos/28')?{ok:false,status,json:async()=>({code:'CATALOG_DENIED'})}:ok(board));await expect(client.read()).rejects.toMatchObject({status});expect(fetchImpl.mock.calls.some(([url])=>url.endsWith('/context'))).toBe(false);}
});
