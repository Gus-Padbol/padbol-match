// PREPARED, NOT EXECUTED. Requires approved isolated backend P10_BACKEND_ROOT.
import React from 'react';
import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import CommercialFollowupActivation from './CommercialFollowupActivation';
import {createCommercialAssignmentsApi} from '../utils/commercialAssignmentsApi';
const {spawn}=require('child_process');
const path=require('path');
jest.mock('../utils/apiPublicBaseUrl',()=>({getApiBaseUrl:()=>''}));
const CASE='44444444-4444-4444-8444-444444444444';
const originalFetch=global.fetch;
function callHandler(input){
 if(!process.env.P10_BACKEND_ROOT)throw Error('P10_BACKEND_ROOT is mandatory; do not skip this integration silently');
 return new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,[path.join(__dirname,'p10-handler-bridge.mjs')],{
   // Never inherit provider tokens, credentials, dotenv or NODE_OPTIONS.
   env:{P10_BACKEND_ROOT:process.env.P10_BACKEND_ROOT},stdio:['pipe','pipe','pipe'],
  });
  let stdout='',stderr='';const timeout=setTimeout(()=>{child.kill();reject(Error('P10 handler bridge timeout'));},10000);
  child.stdout.on('data',chunk=>{stdout+=chunk;});child.stderr.on('data',chunk=>{stderr+=chunk;});
  child.on('error',error=>{clearTimeout(timeout);reject(error);});
  child.on('close',code=>{clearTimeout(timeout);if(code!==0){reject(Error(`P10 bridge failed (${code}): ${stderr}`));return;}try{resolve(JSON.parse(stdout));}catch(error){reject(error);}});
  child.stdin.end(JSON.stringify(input));
 });
}
afterEach(()=>{global.fetch=originalFetch;jest.restoreAllMocks();});
test.each(['es','en'])('real component/adapter -> intercepted transport -> real handler/service, language %s',async language=>{
 const replies=[],requests=[];
 global.fetch=jest.fn(async(request,options={})=>{
  const input={path:String(request),method:options.method||'GET',headers:options.headers,body:options.body?JSON.parse(options.body):undefined};
  requests.push(input);const reply=await callHandler(input);replies.push(reply);
  return {ok:reply.status>=200&&reply.status<300,status:reply.status,json:async()=>reply.body};
 });
 const changed=jest.fn();const api=createCommercialAssignmentsApi('synthetic-p10');
 render(<CommercialFollowupActivation caseId={CASE} channel="whatsapp" api={api} onChanged={changed}/>);
 await screen.findByText(/Plantillas y envío verificados/,{}, {timeout:10000});
 if(language==='en'){
  fireEvent.change(screen.getByLabelText('Idioma'),{target:{value:'en'}});
  expect(screen.getByRole('button',{name:'Activar seguimiento'})).toBeDisabled();
  await screen.findByText(/Plantillas y envío verificados/,{}, {timeout:10000});
 }
 fireEvent.click(screen.getByLabelText(/Confirmo que autorizó/));
 fireEvent.change(screen.getByLabelText('Cómo lo autorizó'),{target:{value:'Autorización sintética explícita'}});
 fireEvent.click(screen.getByRole('button',{name:'Activar seguimiento'}));
 await screen.findByText('Seguimiento activado. Se detendrá si la persona responde.',{}, {timeout:10000});
 expect(changed).toHaveBeenCalledTimes(1);
 const posts=requests.filter(request=>request.method==='POST');expect(posts).toHaveLength(1);
 expect(posts[0].body).toEqual({channel:'whatsapp',language,consentEvidence:'Autorización sintética explícita',templateKey:`commercial_waiting_${language}_v1`});
 const enables=replies.flatMap(reply=>reply.calls).filter(call=>call.name==='crm_commercial_followup_enable');expect(enables).toHaveLength(1);
 expect(enables[0].args).toMatchObject({p_actor:'11111111-1111-4111-8111-111111111111',p_case:CASE,p_type:'whatsapp',p_language:language,p_consent_evidence:'Autorización sintética explícita',p_template_key:`commercial_waiting_${language}_v1`});
 expect(replies.find(reply=>reply.body?.status==='active').body).toMatchObject({status:'active',language,dispatchEnabled:true});
},30000);
test('eligibility revoked between GET and POST: real handler 409, no enable and no success',async()=>{
 const replies=[];
 global.fetch=jest.fn(async(request,options={})=>{
  const reply=await callHandler({path:String(request),method:options.method||'GET',headers:options.headers,body:options.body?JSON.parse(options.body):undefined,mode:'deny-start'});replies.push(reply);
  return {ok:reply.status>=200&&reply.status<300,status:reply.status,json:async()=>reply.body};
 });
 const changed=jest.fn(),api=createCommercialAssignmentsApi('synthetic-p10');
 render(<CommercialFollowupActivation caseId={CASE} channel="whatsapp" api={api} onChanged={changed}/>);
 await screen.findByText(/Plantillas y envío verificados/,{}, {timeout:10000});
 fireEvent.click(screen.getByLabelText(/Confirmo que autorizó/));fireEvent.change(screen.getByLabelText('Cómo lo autorizó'),{target:{value:'Autorización sintética explícita'}});
 fireEvent.click(screen.getByRole('button',{name:'Activar seguimiento'}));
 await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent(/todavía no está habilitado/),{timeout:10000});
 expect(replies.some(reply=>reply.status===409&&reply.body.error==='FOLLOWUP_NOT_READY')).toBe(true);
 expect(replies.flatMap(reply=>reply.calls).filter(call=>call.name==='crm_commercial_followup_enable')).toHaveLength(0);
 expect(changed).not.toHaveBeenCalled();expect(screen.queryByText(/Seguimiento activado\./)).not.toBeInTheDocument();
},30000);
