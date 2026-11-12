/* eslint-disable import/first, no-new-func */
/* global globalThis */
import fs from 'fs';
import path from 'path';
const parser=require('@babel/parser');
const generate=require('@babel/generator').default;
import { saveChangedProfileBirthDate } from '../utils/profileBirthDateApi';
import { uploadProfileAvatar } from '../utils/profileAvatarUpload';
import { updateOwnProfileRow, insertOwnProfileRow, reloadOwnProfile } from '../utils/canonicalProfile';

const OWN='11111111-1111-4111-8111-111111111111';
const OTHER='22222222-2222-4222-8222-222222222222';
const FILE=new File([new Uint8Array(4)],'avatar.png',{type:'image/png'});
const SOURCE=fs.readFileSync(path.join(__dirname,'MiPerfil.jsx'),'utf8');

function extractHandler(name){
  const ast=parser.parse(SOURCE,{sourceType:'module',plugins:['jsx']});
  let found=null;
  function walk(node){
    if(!node||typeof node!=='object')return;
    if(node.type==='VariableDeclarator'&&node.id?.name===name){
      let init=node.init;
      if(init?.type==='CallExpression'&&['useCallback','useMemo'].includes(init.callee?.name))init=init.arguments[0];
      found=generate(init).code;
    }
    for(const [k,v] of Object.entries(node)){
      if(['loc','start','end','leadingComments','trailingComments','innerComments'].includes(k))continue;
      if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object'&&v.type)walk(v);
    }
  }
  walk(ast);
  if(!found)throw new Error(`handler ${name} not found`);
  return found;
}

function deferred(){let resolve;const promise=new Promise(r=>{resolve=r});return {promise,resolve};}

function makeDb({write={data:[{id:1,user_id:OWN,email:'qa@example.invalid'}],error:null},reload={data:{id:1,user_id:OWN,email:'qa@example.invalid',foto_url:'x'},error:null},upload=async()=>({error:null}),clientesDeferred=null,writeDeferred=null,reloadDeferred=null}={}){
  const calls={update:null,insert:null,eqs:[],is:null};
  function profileQuery(){
    const q={};
    q.update=(patch)=>{calls.update=patch;return q};
    q.insert=(row)=>{calls.insert=row;return q};
    q.select=()=>q;
    q.eq=(k,v)=>{calls.eqs.push([k,v]);return q};
    q.is=(k,v)=>{calls.is=[k,v];return q};
    q.limit=async()=>writeDeferred||write;
    q.then=(resolve,reject)=>Promise.resolve(writeDeferred||write).then(resolve,reject);
    q.maybeSingle=async()=>reloadDeferred||reload;
    return q;
  }
  return {
    calls,
    client:{
      from:(table)=>table==='clientes'?{update:()=>({eq:()=>clientesDeferred?clientesDeferred.promise:Promise.resolve({error:null})})}:profileQuery(),
      storage:{from:()=>({upload,getPublicUrl:(p)=>({data:{publicUrl:`https://qa.example/${p}`}})})},
    },
  };
}

function makeSandbox(db,{upload=async()=>({error:null}),perfil={id:1,user_id:OWN,email:'qa@example.invalid',alias:'existing',foto_url:'https://old.example/a.png'}}={}){
  const state={error:null,success:null,perfil,preview:'blob:old',checking:false,photoPending:true};
  const sessionUserIdRef={current:OWN};
  const pendingFotoFileRef={current:FILE};
  const sandbox={
    console,Math,Date,JSON,URL,setTimeout,clearTimeout,
    t:(k)=>k,
    session:{user:{id:OWN,email:'qa@example.invalid'},access_token:'fixture'},
    sessionOwnerEmail:'qa@example.invalid',
    userProfile:{whatsapp:'+5412345678'},
    perfil,
    formData:{nombre:'Nico',apellido:'Test',genero:'masculino',nivel:'Principiante',lateralidad:'Diestro',pais:'Argentina',localidad:'',ciudad:'',alias:'existing',apodo:'',instagram:'',companero_id:null,fecha_nacimiento:'1990-01-01',numero_fipa:'',es_federado:false,mostrar_torneos_jugados:false,busca_companero:false,deportes_preferidos:[]},
    sessionUserIdRef,pendingFotoFileRef,
    profileReadGenerationRef:{current:0},
    profileMountedRef:{current:true},
    birthDateSnapshotRef:{current:{userId:OWN,date:'1990-01-01'}},
    setBirthDateNotice:jest.fn(),
    saveChangedProfileBirthDate:jest.fn(saveChangedProfileBirthDate),
    supabase:db.client,
    uploadProfileAvatar,updateOwnProfileRow,insertOwnProfileRow,reloadOwnProfile,
    storage:{from:()=>({upload,getPublicUrl:(p)=>({data:{publicUrl:`https://qa.example/${p}`}})})},
    guardandoFoto:false,
    setGuardandoFoto:jest.fn(v=>{state.checking=v}),
    setErrorMsg:jest.fn(v=>{state.error=v}),
    setSuccessMsg:jest.fn(v=>{state.success=v}),
    setPerfil:jest.fn(v=>{state.perfil=v}),
    setFotoPendienteDeSubir:jest.fn(v=>{state.photoPending=v}),
    setFotoPreview:jest.fn(v=>{state.preview=v}),
    fotoPreview:'blob:old',
    setIsSubmitting:jest.fn(),
    setFichaFieldErrors:jest.fn(),
    setPassRegistroTorneo:jest.fn(),
    setPassRegistroTorneo2:jest.fn(),
    perfilSubmitLockRef:{current:false},
    isSubmitting:false,
    torneoPerfil:null,
    torneoIdPerfil:null,
    redirectAfterAuth:'',
    navigate:jest.fn(),
    isPerfilTorneoCompleto:()=>false,
    normalizeTorneoPostPerfilPath:()=>'/home',
    getDisplayName:()=> 'Nico',
    nombreApellidoEditDesdePerfilRow:()=>({nombre:'Nico',apellido:'Test'}),
    instagramUrlFromHandle:()=>'',
    fechaNacimientoParaPayload:()=> '1990-01-01',
    normalizeDeportesPreferidosArray:()=>[],
    mensajeValidarPaisTorneo:()=>null,
    paisPayloadSegunTorneo:()=> 'AR',
    digitsOnly:()=>true,
    whatsappNacionalValido:()=>true,
    whatsappDigitsValido:()=>true,
    buildFullWhatsDigits:()=> '5412345678',
    formatWhatsAppE164:()=> '+5412345678',
    waNumeroLocal:'12345678',waCodigoPais:'+54',
    mensajeErrorDbSupabase:(e)=>e?.message||'db-error',
    mensajeErrorJugadoresPerfilDuplicado:()=>null,
    persistJugadorPerfil:jest.fn(),
    refreshJugadorPerfilFromSupabase:jest.fn(async()=>{}),
    refreshSession:jest.fn(async()=>{}),
    checkRegistrationAliasAvailability:jest.fn(async()=>true),
  };
  const proxy=new Proxy(sandbox,{has:()=>true,get:(target,prop)=>{if(prop in target)return target[prop];if(prop in globalThis)return globalThis[prop];return jest.fn();}});
  return {sandbox,proxy,state,sessionUserIdRef};
}

function build(name,sandbox){
  const code=extractHandler(name);
  const factory=new Function('sandbox',`with (sandbox) { return (${code}); }`);
  return factory(sandbox);
}

const flush=async()=>{for(let i=0;i<6;i+=1)await Promise.resolve();};

test('handleGuardarFoto real: upload OK/DB 0 no success and preview intact',async()=>{
  const db=makeDb({write:{data:[],error:null}});
  const s=makeSandbox(db);const fn=build('handleGuardarFoto',s.proxy);
  await fn();
  expect(s.state.error).toBeTruthy();expect(s.state.success).toBeFalsy();expect(s.state.preview).toBe('blob:old');
  expect(db.calls.update).toBeTruthy();
});

test('handleGuardarFoto real: session change during upload prevents write/state/success',async()=>{
  const upload=deferred();const db=makeDb({upload:()=>upload.promise});const s=makeSandbox(db);
  const fn=build('handleGuardarFoto',s.proxy);const pending=fn();await flush();
  s.sessionUserIdRef.current=OTHER;upload.resolve({error:null});await pending;
  expect(db.calls.update).toBeNull();expect(s.sandbox.setPerfil).not.toHaveBeenCalled();
  expect(s.state.preview).toBe('blob:old');expect(s.state.success).toBeFalsy();
});

test('handleGuardarFoto real: success rereads same row before state/cache/success',async()=>{
  const db=makeDb({write:{data:[{id:1,user_id:OWN,foto_url:'new'}],error:null},reload:{data:{id:1,user_id:OWN,email:'qa@example.invalid',foto_url:'new'},error:null}});
  const s=makeSandbox(db);const fn=build('handleGuardarFoto',s.proxy);await fn();
  expect(s.state.error).toBeFalsy();expect(s.state.success).toBeTruthy();
  expect(s.sandbox.setPerfil).toHaveBeenCalledWith(expect.objectContaining({id:1,user_id:OWN,foto_url:'new'}));
  expect(s.sandbox.refreshJugadorPerfilFromSupabase.mock.calls[0][1].profileRow).toMatchObject({id:1,user_id:OWN});
});

test('handleGuardarFoto real: reload failure blocks success',async()=>{
  const db=makeDb({write:{data:[{id:1,user_id:OWN,foto_url:'new'}],error:null},reload:{data:null,error:null}});
  const s=makeSandbox(db);const fn=build('handleGuardarFoto',s.proxy);await fn();
  expect(s.state.error).toBeTruthy();expect(s.state.success).toBeFalsy();expect(s.sandbox.setPerfil).not.toHaveBeenCalled();
});

test('aplicarFotoUrlASesion real: session change prevents update; null remove uses id+owner',async()=>{
  const db=makeDb({write:{data:[{id:1,user_id:OWN,foto_url:null}],error:null},reload:{data:{id:1,user_id:OWN,email:'qa@example.invalid',foto_url:null},error:null}});
  const s=makeSandbox(db);s.sessionUserIdRef.current=OTHER;
  const fn=build('aplicarFotoUrlASesion',s.proxy);await fn(null);
  expect(db.calls.update).toBeNull();expect(s.state.success).toBeFalsy();
});

test('aplicarFotoUrlASesion real: null remove persists and reloads same row',async()=>{
  const db=makeDb({write:{data:[{id:1,user_id:OWN,foto_url:null}],error:null},reload:{data:{id:1,user_id:OWN,email:'qa@example.invalid',foto_url:null},error:null}});
  const s=makeSandbox(db);const fn=build('aplicarFotoUrlASesion',s.proxy);await fn(null);
  expect(db.calls.update).toEqual({foto_url:null});expect(s.state.success).toBeTruthy();expect(s.sandbox.setPerfil).toHaveBeenCalled();expect(s.sandbox.refreshJugadorPerfilFromSupabase.mock.calls[0][1].profileRow).toMatchObject({id:1,user_id:OWN,foto_url:null});
});

test('handleGuardar real: session change after upload prevents write',async()=>{
  const upload=deferred();const db=makeDb({upload:()=>upload.promise});const s=makeSandbox(db);
  const fn=build('handleGuardar',s.proxy);const pending=fn({preventDefault(){}});await flush();
  s.sessionUserIdRef.current=OTHER;upload.resolve({error:null});await pending;
  expect(db.calls.update).toBeNull();expect(s.state.success).toBeFalsy();
});

test('handleGuardarFoto real: DB error after upload leaves preview and no success',async()=>{
  const db=makeDb({write:{data:null,error:{code:'42501',message:'rls update denied'}}});
  const s=makeSandbox(db);const fn=build('handleGuardarFoto',s.proxy);await fn();
  expect(s.state.error).toBeTruthy();expect(s.state.success).toBeFalsy();expect(s.state.preview).toBe('blob:old');
  expect(s.sandbox.setPerfil).not.toHaveBeenCalled();
});

test('aplicarFotoUrlASesion real: DB error/reload fail blocks success',async()=>{
  const db=makeDb({write:{data:null,error:{code:'42501',message:'rls update denied'}}});
  const s=makeSandbox(db);const fn=build('aplicarFotoUrlASesion',s.proxy);await fn('https://qa.example/new.png');
  expect(s.state.error).toBeTruthy();expect(s.state.success).toBeFalsy();expect(s.sandbox.setPerfil).not.toHaveBeenCalled();
  const db2=makeDb({write:{data:[{id:1,user_id:OWN,foto_url:'new'}],error:null},reload:{data:null,error:null}});
  const s2=makeSandbox(db2);const fn2=build('aplicarFotoUrlASesion',s2.proxy);await fn2('https://qa.example/new.png');
  expect(s2.state.error).toBeTruthy();expect(s2.state.success).toBeFalsy();expect(s2.sandbox.setPerfil).not.toHaveBeenCalled();
});

test('handleGuardar real: upload OK + DB error/reload fail never succeeds',async()=>{
  const db=makeDb({write:{data:null,error:{code:'42501',message:'rls update denied'}}});
  const s=makeSandbox(db);const fn=build('handleGuardar',s.proxy);await fn({preventDefault(){}});
  expect(s.state.error).toBeTruthy();expect(s.state.success).toBeFalsy();expect(s.sandbox.setPerfil).not.toHaveBeenCalled();
  const db2=makeDb({write:{data:[{id:1,user_id:OWN}],error:null},reload:{data:null,error:null}});
  const s2=makeSandbox(db2);const fn2=build('handleGuardar',s2.proxy);await fn2({preventDefault(){}});
  expect(s2.state.error).toBeTruthy();expect(s2.state.success).toBeFalsy();expect(s2.sandbox.setPerfil).not.toHaveBeenCalled();
});

test('handleGuardar real: persiste posicion_cancha del formulario existente',async()=>{
  const db=makeDb({write:{data:[{id:1,user_id:OWN,foto_url:'new'}],error:null},reload:{data:{id:1,user_id:OWN,email:'qa@example.invalid',foto_url:'new',posicion_cancha:'izquierda'},error:null}});
  const s=makeSandbox(db);s.sandbox.formData.posicion_cancha='izquierda';
  await build('handleGuardar',s.proxy)({preventDefault(){}});
  expect(db.calls.update.posicion_cancha).toBe('izquierda');
  expect(s.state.error).toBeFalsy();expect(s.state.success).toBeTruthy();
});

test('handleGuardar real: successful save rereads same id before state/cache/success',async()=>{
  const db=makeDb({write:{data:[{id:1,user_id:OWN,foto_url:'new'}],error:null},reload:{data:{id:1,user_id:OWN,email:'qa@example.invalid',foto_url:'new'},error:null}});
  const s=makeSandbox(db);const fn=build('handleGuardar',s.proxy);await fn({preventDefault(){}});
  expect(s.state.error).toBeFalsy();expect(s.state.success).toBeTruthy();expect(s.sandbox.setPerfil).toHaveBeenCalledWith(expect.objectContaining({id:1,user_id:OWN}));expect(s.sandbox.refreshJugadorPerfilFromSupabase.mock.calls[0][1].profileRow).toMatchObject({id:1,user_id:OWN});
});


test('handleGuardar real: session changes during await clientes, no cleanup/cache/success',async()=>{
  const clientes=deferred();
  const db=makeDb({write:{data:[{id:1,user_id:OWN,foto_url:'new'}],error:null},reload:{data:{id:1,user_id:OWN,email:'qa@example.invalid',foto_url:'new'},error:null},clientesDeferred:clientes});
  const s=makeSandbox(db);const fn=build('handleGuardar',s.proxy);const pending=fn({preventDefault(){}});await flush();
  s.sessionUserIdRef.current=OTHER;clientes.resolve({error:null});await pending;
  expect(s.state.success).toBeFalsy();expect(s.state.preview).toBe('blob:old');
  expect(s.sandbox.setFotoPreview).not.toHaveBeenCalled();
  expect(s.sandbox.refreshJugadorPerfilFromSupabase).not.toHaveBeenCalled();
});

test('handleGuardarFoto real: old upload error after session change does not set error',async()=>{
  const upload=deferred();const db=makeDb({upload:()=>upload.promise});
  const s=makeSandbox(db);const fn=build('handleGuardarFoto',s.proxy);const pending=fn();await flush();
  s.sessionUserIdRef.current=OTHER;upload.resolve({error:{message:'old rls'}});await pending;
  expect(s.state.error).toBeFalsy();expect(s.state.success).toBeFalsy();expect(s.state.preview).toBe('blob:old');
});


test('aplicarFotoUrlASesion real: deferred update error after session change is ignored',async()=>{
  const d=deferred();const db=makeDb({writeDeferred:d.promise});
  const s=makeSandbox(db);const fn=build('aplicarFotoUrlASesion',s.proxy);const pending=fn('https://qa.example/new.png');await flush();
  s.sessionUserIdRef.current=OTHER;d.resolve({data:null,error:{message:'old update error'}});await pending;
  expect(s.state.error).toBeFalsy();expect(s.state.success).toBeFalsy();expect(s.sandbox.setPerfil).not.toHaveBeenCalled();
});

test('aplicarFotoUrlASesion real: deferred reload error after session change is ignored',async()=>{
  const d=deferred();const db=makeDb({write:{data:[{id:1,user_id:OWN,foto_url:'new'}],error:null},reloadDeferred:d.promise});
  const s=makeSandbox(db);const fn=build('aplicarFotoUrlASesion',s.proxy);const pending=fn('https://qa.example/new.png');await flush();
  s.sessionUserIdRef.current=OTHER;d.resolve({data:null,error:{message:'old reload error'}});await pending;
  expect(s.state.error).toBeFalsy();expect(s.state.success).toBeFalsy();expect(s.sandbox.setPerfil).not.toHaveBeenCalled();
});


test('full-save unchanged identity date is omitted from profile DB and API',async()=>{
 const db=makeDb();const s=makeSandbox(db);const fn=build('handleGuardar',s.proxy);
 await fn({preventDefault(){}});
 expect(db.calls.update).not.toHaveProperty('fecha_nacimiento');
 expect(s.sandbox.saveChangedProfileBirthDate).toHaveBeenCalledWith(expect.objectContaining({value:'1990-01-01',initialDate:'1990-01-01'}));
 expect(s.state.success).toBeTruthy();
});
test('full-save date API error after profile write cannot announce success',async()=>{
 const db=makeDb();const s=makeSandbox(db);s.sandbox.formData.fecha_nacimiento='2000-01-01';
 s.sandbox.saveChangedProfileBirthDate=jest.fn(async()=>{throw new Error('API error')});
 await build('handleGuardar',s.proxy)({preventDefault(){}});
 expect(db.calls.update).not.toHaveProperty('fecha_nacimiento');
 expect(s.state.error).toMatch(/demás datos pueden haberse guardado/);
 expect(s.state.success).toBeFalsy();expect(s.sandbox.persistJugadorPerfil).not.toHaveBeenCalled();
});
test.each([OTHER,null])('full-save deferred identity result discarded after session change/unmount %s',async(next)=>{
 const db=makeDb();const s=makeSandbox(db);const d=deferred();
 s.sandbox.formData.fecha_nacimiento='2000-01-01';
 s.sandbox.saveChangedProfileBirthDate=jest.fn(()=>d.promise);
 const pending=build('handleGuardar',s.proxy)({preventDefault(){}});await flush();
 s.sessionUserIdRef.current=next;d.resolve('2000-01-01');await pending;
 expect(s.sandbox.setPerfil).not.toHaveBeenCalled();expect(s.sandbox.persistJugadorPerfil).not.toHaveBeenCalled();expect(s.state.success).toBeFalsy();
});
test('full-save explicit deletion sends empty UI value against prior canonical date',async()=>{
 const db=makeDb();const s=makeSandbox(db);s.sandbox.formData.fecha_nacimiento='';
 s.sandbox.saveChangedProfileBirthDate=jest.fn(async()=>null);
 await build('handleGuardar',s.proxy)({preventDefault(){}});
 expect(s.sandbox.saveChangedProfileBirthDate).toHaveBeenCalledWith(expect.objectContaining({value:'',initialDate:'1990-01-01'}));
 expect(s.sandbox.setPerfil).toHaveBeenCalledWith(expect.objectContaining({fecha_nacimiento:null}));
});

test('fetchPerfil real uses identity null instead of legacy date and warns without copying',async()=>{
 const db=makeDb();const s=makeSandbox(db);
 s.sandbox.loadCanonicalProfile=jest.fn(async()=>({row:{id:1,user_id:OWN,fecha_nacimiento:'2000-01-01'}}));
 s.sandbox.fetchProfileBirthDate=jest.fn(async()=>null);
 s.sandbox.fechaNacimientoDesdeDb=(v)=>v||'';
 s.sandbox.setFormData=jest.fn();s.sandbox.setLoading=jest.fn();
 await build('fetchPerfil',s.proxy)();
 expect(s.sandbox.setPerfil).toHaveBeenCalledWith(expect.objectContaining({fecha_nacimiento:null}));
 expect(s.sandbox.setFormData).toHaveBeenCalledWith(expect.objectContaining({fecha_nacimiento:''}));
 expect(s.sandbox.setBirthDateNotice).toHaveBeenCalledWith(expect.stringMatching(/no se copiará/));
});
test('fetchPerfil real failed identity request invalidates date snapshot, no legacy fallback',async()=>{
 const db=makeDb();const s=makeSandbox(db);
 s.sandbox.loadCanonicalProfile=jest.fn(async()=>({row:{id:1,user_id:OWN,fecha_nacimiento:'2000-01-01'}}));
 s.sandbox.fetchProfileBirthDate=jest.fn(async()=>{throw new Error('offline')});
 await build('fetchPerfil',s.proxy)();
 expect(s.sandbox.birthDateSnapshotRef.current).toBeNull();
 expect(s.sandbox.setPerfil).not.toHaveBeenCalled();expect(s.state.error).toMatch(/fecha de identidad/);
});

test('real full-save + real identity adapter sends only date, confirms result',async()=>{
 const db=makeDb();const s=makeSandbox(db);s.sandbox.formData.fecha_nacimiento='2000-01-01';
 const previous=global.fetch;global.fetch=jest.fn(async()=>({ok:true,json:async()=>({fecha_nacimiento:'2000-01-01'})}));
 try {
  await build('handleGuardar',s.proxy)({preventDefault(){}});
  expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/jugador/identidad'),expect.objectContaining({method:'PUT',headers:expect.objectContaining({Authorization:'Bearer fixture'}),body:JSON.stringify({fecha_nacimiento:'2000-01-01'})}));
  expect(s.state.success).toBeTruthy();expect(db.calls.update).not.toHaveProperty('fecha_nacimiento');
 }finally{global.fetch=previous;}
});
test('real full-save + real identity adapter discards HTTP response after unmount',async()=>{
 const db=makeDb();const s=makeSandbox(db);s.sandbox.formData.fecha_nacimiento='2000-01-01';
 const entered=deferred();const response=deferred();const previous=global.fetch;
 global.fetch=jest.fn(()=>{entered.resolve();return response.promise});
 try {
  const pending=build('handleGuardar',s.proxy)({preventDefault(){}});await entered.promise;
  s.sessionUserIdRef.current=null;response.resolve({ok:false,json:async()=>({error:'old'})});await pending;
  expect(s.sandbox.setPerfil).not.toHaveBeenCalled();expect(s.sandbox.persistJugadorPerfil).not.toHaveBeenCalled();expect(s.state.error).toBeFalsy();expect(s.state.success).toBeFalsy();
 }finally{global.fetch=previous;}
});

test('fetchPerfil real: old same-UID identity response cannot restore date after clear/save',async()=>{
 const db=makeDb();const s=makeSandbox(db);const old=deferred();const entered=deferred();
 s.sandbox.loadCanonicalProfile=jest.fn(async()=>({row:{id:1,user_id:OWN,fecha_nacimiento:'1990-01-01'}}));
 s.sandbox.fetchProfileBirthDate=jest.fn(()=>{entered.resolve();return old.promise});
 s.sandbox.fechaNacimientoDesdeDb=(v)=>v||'';s.sandbox.setFormData=jest.fn();s.sandbox.setLoading=jest.fn();
 const reading=build('fetchPerfil',s.proxy)();await entered.promise;
 s.sandbox.formData.fecha_nacimiento='';s.sandbox.saveChangedProfileBirthDate=jest.fn(async()=>null);
 await build('handleGuardar',s.proxy)({preventDefault(){}});
 expect(s.sandbox.birthDateSnapshotRef.current.date).toBeNull();
 old.resolve('1990-01-01');await reading;
 expect(s.sandbox.birthDateSnapshotRef.current.date).toBeNull();
 expect(s.sandbox.setPerfil).toHaveBeenCalledTimes(1);expect(s.sandbox.setPerfil).toHaveBeenLastCalledWith(expect.objectContaining({fecha_nacimiento:null}));
});
test('fetchPerfil real: newest same-UID read wins over late older read',async()=>{
 const db=makeDb();const s=makeSandbox(db);const old=deferred();const entered=deferred();let read=0;
 s.sandbox.loadCanonicalProfile=jest.fn(async()=>({row:{id:1,user_id:OWN,fecha_nacimiento:'1990-01-01'}}));
 s.sandbox.fetchProfileBirthDate=jest.fn(()=>{read+=1;if(read===1){entered.resolve();return old.promise}return Promise.resolve(null)});
 s.sandbox.fechaNacimientoDesdeDb=(v)=>v||'';s.sandbox.setFormData=jest.fn();s.sandbox.setLoading=jest.fn();
 const fn=build('fetchPerfil',s.proxy);const first=fn();await entered.promise;await fn();old.resolve('1990-01-01');await first;
 expect(s.sandbox.birthDateSnapshotRef.current.date).toBeNull();expect(s.sandbox.setPerfil).toHaveBeenCalledTimes(1);
});
function signupSandbox({autoSession=false,dateError=false}={}){
 const db=makeDb();const s=makeSandbox(db);s.sandbox.session={user:null};s.sessionUserIdRef.current=null;
 Object.assign(s.sandbox,{
  nombreRegistroTorneo:'QA',apellidoRegistroTorneo:'Test',emailRegistro:'qa@example.invalid',
  emailValidoVisible:()=>true,waConfirmLocal:'12345678',passRegistroTorneo:'fixture-password',passRegistroTorneo2:'fixture-password',
  aceptoTerminosPrivacidadRegistro:true,registroPasoDeportes:1,registroDeportesSel:['padbol'],aliasDuplicado:false,aliasVerificando:false,
  setRegistroFieldErrors:jest.fn(),fetchWhatsappDisponibleRegistro:jest.fn(async()=>({disponible:true})),
  getSignUpLegalMetadata:()=>({}),mensajeErrorAuthSupabase:()=> 'signup error',
  upsertJugadorPerfilPorSesion:jest.fn(async()=>({data:{id:1,user_id:OWN},error:null})),
  saveChangedProfileBirthDate:jest.fn(async()=>{if(dateError)throw new Error('identity failed');return '2000-01-01'}),
  handleAuthOnce:jest.fn(async()=>{if(autoSession)s.sessionUserIdRef.current=OWN;return {data:{user:{id:OWN,email:'qa@example.invalid'},session:autoSession?{access_token:'fixture'}:null},error:null}}),
 });
 s.sandbox.formData.alias='';s.sandbox.formData.fecha_nacimiento='2000-01-01';
 s.sandbox.supabase={...db.client,from:jest.fn(()=>({upsert:jest.fn(async()=>({error:null}))}))};
 return s;
}
test('signup real: confirmation email/no auto-session shows explicit date not saved without DB/API writes',async()=>{
 const s=signupSandbox();await build('handleRegistroCuenta',s.proxy)({preventDefault(){}});
 expect(s.sandbox.handleAuthOnce).toHaveBeenCalled();expect(s.state.error).toMatch(/Confirma tu correo/);expect(s.state.error).toMatch(/No se ha guardado la fecha/);
 expect(s.state.success).toBeFalsy();expect(s.sandbox.supabase.from).not.toHaveBeenCalled();expect(s.sandbox.saveChangedProfileBirthDate).not.toHaveBeenCalled();
});
test('signup real: identity error with authenticated session prevents complete success',async()=>{
 const s=signupSandbox({autoSession:true,dateError:true});await build('handleRegistroCuenta',s.proxy)({preventDefault(){}});
 expect(s.sandbox.upsertJugadorPerfilPorSesion).toHaveBeenCalled();expect(s.sandbox.upsertJugadorPerfilPorSesion.mock.calls[0][0].row).not.toHaveProperty('fecha_nacimiento');
 expect(s.sandbox.saveChangedProfileBirthDate).toHaveBeenCalledWith(expect.objectContaining({value:'2000-01-01',accessToken:'fixture'}));
 expect(s.state.error).toMatch(/no se confirmó la fecha/);expect(s.state.success).toBeFalsy();expect(s.sandbox.persistJugadorPerfil).not.toHaveBeenCalled();
});

test('same-UID load started during save cannot overwrite date after PUT commit',async()=>{
 const db=makeDb();const s=makeSandbox(db);const put=deferred();const putEntered=deferred();const get=deferred();const getEntered=deferred();
 s.sandbox.formData.fecha_nacimiento='';
 s.sandbox.saveChangedProfileBirthDate=jest.fn(()=>{putEntered.resolve();return put.promise});
 s.sandbox.loadCanonicalProfile=jest.fn(async()=>({row:{id:1,user_id:OWN,fecha_nacimiento:'1990-01-01'}}));
 s.sandbox.fetchProfileBirthDate=jest.fn(()=>{getEntered.resolve();return get.promise});
 s.sandbox.fechaNacimientoDesdeDb=(v)=>v||'';s.sandbox.setFormData=jest.fn();s.sandbox.setLoading=jest.fn();
 const saving=build('handleGuardar',s.proxy)({preventDefault(){}});await putEntered.promise;
 const loading=build('fetchPerfil',s.proxy)();await getEntered.promise;
 put.resolve(null);await saving;
 expect(s.sandbox.birthDateSnapshotRef.current.date).toBeNull();
 get.resolve('1990-01-01');await loading;
 expect(s.sandbox.birthDateSnapshotRef.current.date).toBeNull();
 expect(s.sandbox.setPerfil).toHaveBeenCalledTimes(1);expect(s.sandbox.setPerfil).toHaveBeenLastCalledWith(expect.objectContaining({fecha_nacimiento:null}));
});

test.each([true,false])('Napoli notice follows authoritative readiness complete=%s without changing its gate',async complete=>{
 const sandbox={esContextoNacionesNapoli:true,napoliSlug:'nations-cup-napoli-2026',session:{user:{id:OWN}},napoliReadinessRequest:{current:0},napoliReadiness:null,
  getAuthHeaders:async()=>({Authorization:'Bearer fixture'}),API_BASE_URL:'https://qa.example',fetch:jest.fn(async()=>({ok:true,json:async()=>({complete})})),
  location:{state:null},torneoIdValido:false,redirectAfterAuth:'/nations-cup/nations-cup-napoli-2026/inscripcion',t:()=> 'Complete your profile, including WhatsApp, to continue.'};
 sandbox.setNapoliReadiness=value=>{sandbox.napoliReadiness=value;};
 expect(await build('confirmNapoliReadiness',sandbox)()).toBe(complete);
 expect(sandbox.fetch).toHaveBeenCalledTimes(1);
 expect(build('avisoPerfilTorneoMsg',sandbox)()).toBe(complete?'':'Complete your profile, including WhatsApp, to continue.');
});
test('unknown/failed readiness, other user and other redirects retain the existing prompt',async()=>{
 const base={location:{state:null},torneoIdValido:false,redirectAfterAuth:'/nations-cup/nations-cup-napoli-2026/inscripcion',napoliSlug:'nations-cup-napoli-2026',session:{user:{id:OWN}},napoliReadiness:null,t:()=> 'Existing prompt'};
 for(const extra of [{},{napoliReadiness:{slug:base.napoliSlug,actorId:OTHER,complete:true}},{napoliSlug:'other-event',napoliReadiness:{slug:'other-event',actorId:OWN,complete:true}}])expect(build('avisoPerfilTorneoMsg',{...base,...extra})()).toBe('Existing prompt');
 const sandbox={...base,esContextoNacionesNapoli:true,napoliReadinessRequest:{current:0},getAuthHeaders:async()=>({}),API_BASE_URL:'https://qa.example',fetch:async()=>{throw Error('network')},setNapoliReadiness:jest.fn()};
 expect(await build('confirmNapoliReadiness',sandbox)()).toBe(false);
 expect(sandbox.setNapoliReadiness).toHaveBeenCalledWith({slug:base.napoliSlug,actorId:OWN,complete:false});
});
