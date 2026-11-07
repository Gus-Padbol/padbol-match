// PREPARED, NOT EXECUTED. Node-only bridge: no sockets, server bootstrap or real RPC.
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=process.env.P10_BACKEND_ROOT;
if(!root)throw new Error('Set P10_BACKEND_ROOT to the approved isolated backend candidate');
// Fail closed before loading any backend module; no provider fallback is permitted.
globalThis.fetch=async()=>{throw new Error('External transport forbidden in P10 bridge');};
const {createCommercialTeamApi,registerCommercialTeamRoutes}=await import(pathToFileURL(resolve(root,'lib/crmCommercialTeamApi.js')).href);
let stdin='';for await(const chunk of process.stdin)stdin+=chunk;
const input=JSON.parse(stdin);
const actor={id:'11111111-1111-4111-8111-111111111111',email:'synthetic-advisor@example.invalid'};
const conversationId='22222222-2222-4222-8222-222222222222';
const planId='33333333-3333-4333-8333-333333333333';
const caseId='44444444-4444-4444-8444-444444444444';
const calls=[];
const db={async rpc(name,args){
 calls.push({name,args});
 if(name==='crm_commercial_team_role')return {data:'manager'};
 if(name==='crm_commercial_team_case_read')return {data:{id:caseId,progressState:'en_espera'}};
 if(name==='crm_commercial_team_schedule_read')return {data:{nextContactAt:null,reminderHours:[24,8]}};
 if(name==='crm_commercial_followup_enable')return {data:{id:planId,status:'active',conversationId,language:args.p_language,templateKey:args.p_template_key,dispatchEnabled:true,scheduleHours:[48,120,192]}};
 throw new Error(`Unexpected in-memory RPC name: ${name}`);
}};
const forbidden=async()=>{throw new Error('Sending forbidden');};
const api=createCommercialTeamApi({db,env:{},sendClaimed:forbidden,sendFormClaimed:forbidden,fetchImpl:forbidden,resolveTrustedSuperadmin:async()=>false,
 getFollowupReadiness:async({type,caseId:id,language})=>{
  if(type!=='whatsapp'||id!==caseId||!['es','en'].includes(language))throw new Error('Unexpected readiness scope');
  if(input.mode==='deny-start'&&input.method==='POST')return {ready:false,reason:'Synthetic eligibility revoked'};
  return {ready:true,enabled:true,templatesReady:true,language,templateKey:`commercial_waiting_${language}_v1`};
 }});
const routes=new Map();const app=Object.fromEntries(['get','post','put','patch'].map(method=>[method,(path,handler)=>routes.set(`${method.toUpperCase()} ${path}`,handler)]));
registerCommercialTeamRoutes(app,{api,authUserFromBearer:async req=>{if(req.headers.Authorization!=='Bearer synthetic-p10')throw Object.assign(new Error('Unauthenticated'),{status:401,code:'UNAUTHENTICATED'});return actor;},logger:{error(){}}});
const url=new URL(input.path,'https://p10.invalid');
if(url.origin!=='https://p10.invalid')throw new Error('Unexpected origin');
const match=url.pathname.match(/^\/api\/admin\/crm\/commercial-cases\/([^/]+)\/followup\/(readiness|start)$/);
if(!match||decodeURIComponent(match[1])!==caseId)throw new Error('Unexpected route or case');
const method=input.method||'GET';
if((match[2]==='readiness'&&method!=='GET')||(match[2]==='start'&&method!=='POST'))throw new Error('Unexpected method');
const handler=routes.get(`${method} /api/admin/crm/commercial-cases/:id/followup/${match[2]}`);
const req={params:{id:caseId},query:Object.fromEntries(url.searchParams),headers:input.headers||{},body:input.body};
let status=200,body;
const res={set(){return this;},status(value){status=value;return this;},json(value){body=value;return this;}};
await handler(req,res);
process.stdout.write(JSON.stringify({status,body,calls}));
