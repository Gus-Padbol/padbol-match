const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const babel = require('@babel/core');
const parser = require('@babel/parser');
const root = path.resolve(__dirname, '..');
const qa = {
 REACT_APP_APP_VARIANT:'qa', REACT_APP_API_BASE_URL:'https://api.qa.example', REACT_APP_API_URL:'https://api.qa.example',
 REACT_APP_SUPABASE_URL:'https://auth.qa.example', REACT_APP_SUPABASE_ANON_KEY:'sb_publishable_qa_fixture_not_a_real_key',
};
const source = file => fs.readFileSync(path.join(root,'src',file),'utf8');
function nodes(file,predicate) {
 const text=source(file);const ast=parser.parse(text,{sourceType:'unambiguous',plugins:['jsx']});const matches=[];
 function walk(n){if(!n||typeof n!=='object')return;if(predicate(n))matches.push(n);for(const[k,v]of Object.entries(n)){if(['loc','start','end','comments','tokens'].includes(k))continue;if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v);}}walk(ast);
 return matches.map(n=>({node:n,text:text.slice(n.start,n.end)}));
}
function apiHelper(env=qa) {
 const exports={};const module={exports};
 const compiled=babel.transformSync(source('utils/apiPublicBaseUrl.js'),{configFile:false,babelrc:false,plugins:['@babel/plugin-transform-modules-commonjs']}).code;
 vm.runInNewContext(compiled,{exports,module,process:{env},require:()=>require(path.join(root,'src/config/clientEnvironment.js'))});
 return module.exports;
}
function variable(file,name,scope={}) {
 const entry=nodes(file,n=>n.type==='VariableDeclarator'&&n.id.name===name)[0];assert(entry,name);
 const text=source(file).slice(entry.node.init.start,entry.node.init.end);return vm.runInNewContext(`(${text})`,scope);
}
function componentBase(file,name,scope) {
 const entry=nodes(file,n=>['FunctionDeclaration','FunctionExpression'].includes(n.type)&&n.id?.name===name)[0];assert(entry,name);
 const param=entry.node.params[0];const text=source(file).slice(param.start,param.end);
 return vm.runInNewContext(`((${text}) => apiBaseUrl)({})`,scope);
}
const noop=()=>{};

test('actual profile cancellation posts only to the configured QA API and releases pending state',async()=>{
 const calls=[],states=[];const helper=apiHelper();
 const handle=variable('pages/MiPerfil.jsx','handleCancelar',{
  API_BASE_URL:variable('pages/MiPerfil.jsx','API_BASE_URL',helper),sessionOwnerEmail:'qa@example.invalid',setCancelando:v=>states.push(v),
  fetch:async(url,options)=>{calls.push({url,options});return{ok:true,json:async()=>({})};},fetchReservas:async()=>{},alert:noop,t:key=>key,
 });
 await handle({id:41});assert.equal(calls.length,1);assert.equal(calls[0].url,qa.REACT_APP_API_BASE_URL+'/api/cancelar-reserva');assert.equal(calls[0].options.method,'POST');assert.deepEqual(JSON.parse(calls[0].options.body),{reservaId:41,email:'qa@example.invalid'});assert.deepEqual(states,[41,null]);
});

test('actual create venue callback and default send direct creation and contract to QA',async()=>{
 const helper=apiHelper();const API_DEFAULT=variable('components/NuevaSede.jsx','API_DEFAULT',helper);const apiBaseUrl=componentBase('components/NuevaSede.jsx','NuevaSede',{...helper,API_DEFAULT});
 const form=new Proxy({nombre:'QA fixture',cantidad_canchas:'1',licenciatario_email:'owner@example.invalid',fecha_inicio_contrato:'2026-09-09',tipo_licencia:'club_afiliado',precio_base:'1200',horario_apertura:'20:00',horario_cierre:'02:00',whatsapp:'+542215550000'},{get:(obj,key)=>obj[key]??''});
 const validatorExports={};
 vm.runInNewContext(babel.transformSync(source('utils/sedeRequiredConfiguration.js'),{configFile:false,babelrc:false,plugins:['@babel/plugin-transform-modules-commonjs']}).code,{exports:validatorExports});
 const calls=[];const handle=variable('components/NuevaSede.jsx','onSubmit',{
  validateSedeRequiredConfiguration:validatorExports.validateSedeRequiredConfiguration,
  apiBaseUrl,form,licenciaTipoActual:{alcance:'sede'},LICENCIA_TIPO_OPTIONS:[{id:'club_afiliado'}],isSuper:true,isAdminCadena:false,contratoFile:null,
  setErr:noop,setMsg:noop,setSending:noop,setTimeout:noop,navigate:noop,FormData,
  fetchWithAuth:async(url,options)=>{calls.push({url,options});return{sede_id:12};},
 });
 await handle({preventDefault:noop});assert.equal(calls.length,2);assert.deepEqual(calls.map(c=>c.url),[qa.REACT_APP_API_BASE_URL+'/api/admin/sedes-directa',qa.REACT_APP_API_BASE_URL+'/api/sedes/12/contrato']);assert.equal(calls[0].options.method,'POST');assert.equal(JSON.parse(calls[0].options.body).nombre,'QA fixture');assert.equal(JSON.parse(calls[0].options.body).precio_turno,1200);assert.equal(JSON.parse(calls[0].options.body).precio_base,1200);assert.equal(JSON.parse(calls[0].options.body).horario_cierre,'02:00');
});

test('actual create tournament callback and default post only to QA',async()=>{
 const helper=apiHelper();const apiBaseUrl=componentBase('pages/TorneoCrear.jsx','TorneoCrear',helper);const calls=[],errors=[];
 const handle=variable('pages/TorneoCrear.jsx','handleSubmit',{
  apiBaseUrl,session:{user:{id:'qa-user'}},formData:{nombre:'QA fixture',tipo_torneo:'knockout',fecha_inicio:'2026-09-10',fecha_fin:'2026-09-11',categoria:'libre',deporte:'padbol',sede_id:'12'},
  navigate:noop,authUrlWithRedirect:v=>v,setLoading:noop,setMensaje:noop,setError:v=>errors.push(v),t:v=>v,
  CATEGORIA_TORNEO_DEFAULT:'libre',TORNEO_TIPO_COMPETENCIA_DEFAULT:'dobles',TORNEO_CATEGORIA_EDAD_DEFAULT:'libre',mapEstadoTorneoFormParaApi:v=>v,normalizeTorneoDeporte:v=>v,formatoEquipoPayloadParaApi:()=> 'dobles',
  fetch:async(url,options)=>{calls.push({url,options});return{ok:true,json:async()=>[{id:99}]};},console:{log:noop},resetFormClean:noop,embedded:false,setTimeout:noop,
 });
 await handle({preventDefault:noop});assert.equal(calls.length,1);assert.equal(calls[0].url,qa.REACT_APP_API_BASE_URL+'/api/torneos');assert.equal(calls[0].options.method,'POST');assert.equal(JSON.parse(calls[0].options.body).sede_id,12);assert.deepEqual(errors,['']);
});

test('actual AdminDashboard default and propagated request URL use QA',()=>{
 const helper=apiHelper();const base=componentBase('pages/AdminDashboard.jsx','AdminDashboard',helper);assert.equal(base,qa.REACT_APP_API_BASE_URL);
 const urls=nodes('pages/AdminDashboard.jsx',n=>n.type==='CallExpression'&&n.callee.name==='fetch'&&n.arguments[0]?.type==='TemplateLiteral').filter(x=>x.text.includes('${apiBaseUrl}'));
 assert(urls.length>10,'actual dashboard requests must be present');
 const runnable=urls.find(x=>{const s=source('pages/AdminDashboard.jsx').slice(x.node.arguments[0].start,x.node.arguments[0].end);return !s.replace('${apiBaseUrl}','').includes('${');});assert(runnable);
 const target=runnable.node.arguments[0];const url=vm.runInNewContext(source('pages/AdminDashboard.jsx').slice(target.start,target.end),{apiBaseUrl:base});assert(url.startsWith(qa.REACT_APP_API_BASE_URL+'/'));
});

test('actual Supabase client uses isolated QA auth/storage and preserves PKCE',()=>{
 const text=source('supabaseClient.js');const compiled=babel.transformSync(text,{configFile:false,babelrc:false,plugins:['@babel/plugin-transform-modules-commonjs']}).code;let received;const exports={};
 vm.runInNewContext(compiled,{exports,process:{env:qa},require:name=>name==='@supabase/supabase-js'?{createClient:(...args)=>{received=args;return{};}}:require(path.join(root,'src/config/clientEnvironment.js'))});
 assert.equal(received[0],qa.REACT_APP_SUPABASE_URL);assert.equal(received[1],qa.REACT_APP_SUPABASE_ANON_KEY);assert.equal(received[2].auth.flowType,'pkce');assert.equal(received[2].auth.persistSession,true);
});

test('invalid QA cannot instantiate the real Supabase client or issue a routed request',()=>{
 const invalid={...qa,REACT_APP_SUPABASE_URL:'https://auth.padbolmatch.com'};
 assert.throws(()=>apiHelper(invalid).getApiBaseUrl(),/QA/);
 const compiled=babel.transformSync(source('supabaseClient.js'),{configFile:false,babelrc:false,plugins:['@babel/plugin-transform-modules-commonjs']}).code;let created=0;
 assert.throws(()=>vm.runInNewContext(compiled,{exports:{},process:{env:invalid},require:name=>name==='@supabase/supabase-js'?{createClient:()=>created++}:require(path.join(root,'src/config/clientEnvironment.js'))}),/QA/);assert.equal(created,0);
});

test('source has no production API literal or direct API environment access outside the resolver',()=>{
 const violations=[];for(const file of fs.readdirSync(path.join(root,'src'),{recursive:true}).filter(f=>/\.(js|jsx|cjs)$/.test(f)&&!f.includes('.test.')&&!['utils/apiPublicBaseUrl.js','config/clientEnvironment.js'].includes(f))){
  const text=source(file);const ast=parser.parse(text,{sourceType:'unambiguous',plugins:['jsx']});
  function walk(n){if(!n||typeof n!=='object')return;if(n.type==='StringLiteral'&&/padbol-backend\.onrender\.com/.test(n.value))violations.push(file);if(n.type==='MemberExpression'&&/^REACT_APP_API_(BASE_URL|URL)$/.test(n.property.name))violations.push(file);for(const[k,v]of Object.entries(n)){if(['loc','start','end','comments','tokens'].includes(k))continue;if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v);}}walk(ast);
 }assert.deepEqual(violations,[]);
});
