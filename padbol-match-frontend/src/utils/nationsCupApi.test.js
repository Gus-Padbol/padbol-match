import { getAuthHeaders } from './scoreboardApi';
import { readNationsCup, mutateNationsCup, validateNationsReceipt, createNationsScoreboard, readNationsCupActa, nationsCupRequestId } from './nationsCupApi';
jest.mock('./scoreboardApi',()=>({getAuthHeaders:jest.fn()}));
const context={apiBaseUrl:'https://fixture.invalid/',torneoId:7,accessToken:'fixture-only'};
const state={ok:true,torneo_id:7,revision:0,config:null,capabilities:{can_configure:true,can_draw:false,can_advance:false,can_schedule:false,can_close:false},groups:[],standings:[],thirds:[],qualified:[],bracket:[],matches:[],ties:[],status:'not_configured'};
const response=data=>({ok:true,status:200,json:async()=>data});
const body={expected_revision:0,request_id:'00000000-0000-4000-8000-000000000001',approved:true};
beforeEach(()=>{getAuthHeaders.mockResolvedValue({Authorization:'Bearer fixture-only'});global.fetch=jest.fn().mockResolvedValue(response(state));});
test('GET includes genuine session and rejects anonymous before network',async()=>{
 await readNationsCup(context);expect(fetch.mock.calls[0][0]).toBe('https://fixture.invalid/api/torneos/7/nations-cup');expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer fixture-only');getAuthHeaders.mockResolvedValue({});await expect(readNationsCup(context)).rejects.toMatchObject({status:401});expect(fetch).toHaveBeenCalledTimes(1);
});
test('mutations keep stable request and expected version then verify persisted state',async()=>{
 const saved={...state,revision:1,status:'rules_approved'};fetch.mockResolvedValue(response(saved));await mutateNationsCup(context,'approveRules',body);
 expect(fetch.mock.calls[0][1].method).toBe('POST');expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual(body);expect(fetch).toHaveBeenCalledTimes(2);
});
test.each([403,409,503])('denial %s never becomes a success',async status=>{fetch.mockResolvedValue({ok:false,status,json:async()=>({code:'NATIONS_TIE_APPROVAL_REQUIRED',error:'Pendiente',ties:[{scope:'thirds',team_ids:[1,2]}]})});await expect(mutateNationsCup(context,'advance',body)).rejects.toMatchObject({status});expect(fetch).toHaveBeenCalledTimes(1);});
test('empty, wrong tournament, malformed arrays and unknown capabilities fail closed',()=>{
 for(const data of [null,{ok:true},{...state,torneo_id:8},{...state,thirds:{}},{...state,capabilities:{}}])expect(()=>validateNationsReceipt(data,7)).toThrow();
});
test('missing saved revision or mismatching refetch does not confirm action',async()=>{
 await expect(mutateNationsCup(context,'approveRules',body)).rejects.toThrow(/revisión/);
 const saved={...state,revision:1};fetch.mockResolvedValueOnce(response(saved)).mockResolvedValueOnce(response({...saved,matches:[{id:91,estado:'pendiente'}]}));await expect(mutateNationsCup(context,'approveRules',body)).rejects.toThrow(/lectura posterior/);
});
test('invalid IDs and revision do not send requests',async()=>{await expect(mutateNationsCup(context,'draw',{...body,request_id:'fake'})).rejects.toThrow();await expect(mutateNationsCup(context,'draw',{...body,expected_revision:-1})).rejects.toThrow();expect(fetch).not.toHaveBeenCalled();});

test('receipt key and match transport order do not cause a false mismatch, but seeding differences do',async()=>{
 const matches=[{id:92,estado:'pendiente'},{id:91,estado:'pendiente'}];const saved={...state,revision:1,matches};fetch.mockResolvedValueOnce(response(saved)).mockResolvedValueOnce(response({...saved,matches:[{estado:'pendiente',id:91},{estado:'pendiente',id:92}]}));await expect(mutateNationsCup(context,'advance',body)).resolves.toMatchObject({revision:1});
 const qualified=[{equipo_id:1,nombre:'Equipo QA',seed:1}];fetch.mockResolvedValueOnce(response({...saved,qualified})).mockResolvedValueOnce(response({...saved,qualified:[{...qualified[0],seed:2}]}));await expect(mutateNationsCup(context,'advance',body)).rejects.toThrow(/lectura posterior/);
});

test('real scoreboard UUID is preserved and a control token is never passed to UI',async()=>{
 const id='00000000-0000-4000-8000-000000000099';fetch.mockResolvedValue(response({ok:true,torneo_id:7,partido_id:9,scoreboard_id:id,status:'saved',control_token:'private-fixture'}));await expect(createNationsScoreboard(context,9)).resolves.toEqual({scoreboard_id:id,status:'saved'});expect(fetch.mock.calls[0][1].method).toBe('POST');fetch.mockResolvedValue(response({ok:true,torneo_id:7,partido_id:9,scoreboard_id:99,status:'saved'}));await expect(createNationsScoreboard(context,9)).rejects.toThrow(/confirmó/);
});

test('draft export requires the current revision and never claims official FIPA points',async()=>{
 const acta={ok:true,torneo_id:7,revision:1,type:'event_review_draft',official_fipa_points:null,official_fipa_status:'external_review_required',placements:[],matches:[],declared_participants:[]};fetch.mockResolvedValue(response(acta));await expect(readNationsCupActa(context,1)).resolves.toEqual(acta);await expect(readNationsCupActa(context,0)).rejects.toThrow(/borrador/);fetch.mockResolvedValue(response({...acta,official_fipa_points:1000}));await expect(readNationsCupActa(context,1)).rejects.toThrow(/borrador/);
});

test('native browser cryptography produces a valid independent request identity without network',()=>{
 const original=Object.getOwnPropertyDescriptor(window,'crypto');
 Object.defineProperty(window,'crypto',{configurable:true,value:{getRandomValues:array=>require('crypto').randomFillSync(array)}});
 try { const first=nationsCupRequestId(); expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);expect(nationsCupRequestId()).not.toBe(first);expect(fetch).not.toHaveBeenCalled(); }
 finally {if(original)Object.defineProperty(window,'crypto',original);else delete window.crypto;}
});

test('scoreboard submits court only without a fictional estimated schedule',async()=>{fetch.mockResolvedValue(response({ok:true,torneo_id:7,partido_id:9,scoreboard_id:'00000000-0000-4000-8000-000000000099',status:'created'}));await createNationsScoreboard(context,9,44);expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({court_id:44});});
