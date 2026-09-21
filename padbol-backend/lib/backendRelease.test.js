import assert from 'node:assert/strict';
import test from 'node:test';
import { backendRuntime, assertStagingIsolation, backendReadiness } from './backendRuntime.js';
import { PUSH_LANGUAGES, normalizePushLanguage, localizedPushPreview } from './pushLanguages.js';
import { createMobilePushService, registerMobilePushRoutes, sendExpoPushNotifications } from './mobilePushNotifications.js';
const stage = { BACKEND_RUNTIME_MODE: 'staging', STAGING_SUPABASE_PROJECT_REF: 'fixture-stage', PRODUCTION_SUPABASE_PROJECT_REF: 'fixture-prod', SUPABASE_URL: 'https://fixture-stage.supabase.co', SUPABASE_KEY: 'fixture-public', SUPABASE_SERVICE_ROLE_KEY: 'fixture-service' };
test('staging isolated and all delivery/jobs disabled by default', () => {
 assert.doesNotThrow(()=>assertStagingIsolation(stage));
 assert.deepEqual(backendRuntime(stage),{staging:true,mode:'staging',backgroundJobsEnabled:false,outboundDeliveryEnabled:false,pushSendEnabled:false});
 for(const patch of [{STAGING_SUPABASE_PROJECT_REF:'fixture-prod'},{SUPABASE_URL:'https://fixture-prod.supabase.co'},{DATABASE_URL:'postgres://other.invalid/db'},{STRIPE_SECRET_KEY:'fixture'},{TWILIO_AUTH_TOKEN:'fixture'},{RESEND_API_KEY:'fixture'},{ANTHROPIC_API_KEY:'fixture'},{MP_ACCESS_TOKEN:'fixture'},{SUPABASE_KEY:''}]) assert.throws(()=>assertStagingIsolation({...stage,...patch}));
});
test('global delivery off overrides per-channel push switch',()=>assert.equal(backendRuntime({...stage,OUTBOUND_DELIVERY_ENABLED:'false',PUSH_SEND_ENABLED:'true'}).pushSendEnabled,false));
test('readiness verifies release and times out without leaking database error',async()=>{
 const runtime=backendRuntime(stage);
 const check=(rpc,timeoutMs)=>backendReadiness({supabaseAdmin:{rpc},serviceRoleConfigured:true,runtime,timeoutMs});
 assert.equal((await check(async()=>({data:{release:'2026-09-09.1',ready:true}}))).ready,true);
 assert.equal((await check(async()=>({data:{release:'old',ready:true}}))).ready,false);
 assert.equal((await check(async()=>({error:{message:'SECRET'}}))).reason,'schema_not_ready');
 assert.equal((await check(()=>new Promise(()=>{}),5)).ready,false);
});
test('disabled push dispatch and receipts do not access registry or transport',async()=>{
 const service=createMobilePushService({supabaseAdmin:new Proxy({}, {get(){throw new Error('must not access DB');}}),serviceRoleConfigured:true,sendEnabled:false,fetchImpl:()=>{throw new Error('must not send');}});
 await assert.rejects(service.dispatch({}),e=>e.code==='PUSH_SEND_DISABLED');
 assert.deepEqual(await service.processPendingReceipts(),{disabled:true,checked:0});
});
for (const language of PUSH_LANGUAGES) test(`localized transactional preview: ${language}`,async()=>{
 const text=localizedPushPreview({language,category:'transactional',type:'reserva_confirmada',title:'private venue',body:'private reservation'});
 assert.equal(text.title,'Padbol Match');assert.ok(text.body.length>20&&text.body.length<=150);assert.ok(!text.body.includes('private'));
 let payload;
 await sendExpoPushNotifications({title:'fallback',body:'fallback',tokens:[{token:'ExpoPushToken[fixture123]',...text}],data:{type:'reserva_confirmada',route:'Reservas'},fetchImpl:async(_url,options)=>{payload=JSON.parse(options.body)[0];return {ok:true,json:async()=>({data:[{status:'ok',id:'fixture-ticket'}]})}}});
 assert.equal(payload.body,text.body);assert.equal(payload.data.type,'reserva_confirmada');assert.equal(payload.data.route,'Reservas');
});
test('marketing and free admin content stay literal; languages have strict aliases',()=>{
 for(const [category,type] of [['marketing','torneo_nuevo'],['transactional','admin_message'],['transactional','general']]) assert.deepEqual(localizedPushPreview({category,type,language:'ar',title:'Written title',body:'Written body'}),{title:'Written title',body:'Written body'});
 assert.equal(PUSH_LANGUAGES.length,20);assert.equal(normalizePushLanguage('fa-IR'),'fa');assert.equal(normalizePushLanguage('PT_br'),'pt-BR');assert.equal(normalizePushLanguage('nl'),null);assert.equal(normalizePushLanguage({} ),null);
});
test('register stores language via service RPC, rejects unsupported locale before write',async()=>{
 let call;const service=createMobilePushService({supabaseAdmin:{async rpc(name,args){call={name,args};return {data:{last_seen_at:'fixture'}}}},serviceRoleConfigured:true});
 const payload={userId:'owner',token:'ExpoPushToken[fixture123]',platform:'android',deviceId:'fixture-installation',language:'fa-IR'};
 const result=await service.registerToken(payload);assert.equal(call.name,'register_mobile_push_token_v2');assert.equal(call.args.p_language,'fa');assert.equal(result.language,'fa');assert.ok(!('token' in result));
 call=null;await assert.rejects(service.registerToken({...payload,language:'unsupported'}),e=>e.status===400);assert.equal(call,null);
});
test('DELETE ignores body owner and uses authenticated user with both selectors',async()=>{
 const handlers=new Map();const app=Object.fromEntries(['post','delete','get','patch'].map(method=>[method,(path,fn)=>handlers.set(method+path,fn)]));
 let received;registerMobilePushRoutes(app,{authUserFromBearer:async()=>({id:'real-owner'}),pushService:{revokeToken:async p=>{received=p;return {ok:true,revoked:0}}},logger:{error(){}}});
 const res={status(){return this},json(){return this}};
 await handlers.get('delete/api/push-tokens')({body:{userId:'other-owner',token:'ExpoPushToken[fixture123]',deviceId:'fixture-installation'}},res);
 assert.deepEqual(received,{userId:'real-owner',token:'ExpoPushToken[fixture123]',deviceId:'fixture-installation'});
});

test('staging suppresses both Make delivery paths before fetch',async()=>{
 const oldMode=process.env.BACKEND_RUNTIME_MODE;const oldEnabled=process.env.OUTBOUND_DELIVERY_ENABLED;const oldFetch=globalThis.fetch;
 process.env.BACKEND_RUNTIME_MODE='staging';delete process.env.OUTBOUND_DELIVERY_ENABLED;
 globalThis.fetch=()=>{throw Error('must not contact Make')};
 try {const {sendMakeEvent}=await import('../make/sendMakeEvent.js');const {notifyMakeAdminInviteWebhook}=await import('../make/sendMakeAdminInviteWebhook.js');assert.deepEqual(await sendMakeEvent('fixture'),{disabled:true});assert.deepEqual(await notifyMakeAdminInviteWebhook({email:'fixture@invalid.test'}),{disabled:true});}
 finally {globalThis.fetch=oldFetch;if(oldMode==null)delete process.env.BACKEND_RUNTIME_MODE;else process.env.BACKEND_RUNTIME_MODE=oldMode;if(oldEnabled==null)delete process.env.OUTBOUND_DELIVERY_ENABLED;else process.env.OUTBOUND_DELIVERY_ENABLED=oldEnabled;}
});
