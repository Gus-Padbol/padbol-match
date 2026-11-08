/* eslint-disable import/first, no-new-func */
/* global globalThis */
import fs from 'fs';
import path from 'path';
const parser=require('@babel/parser');
const generate=require('@babel/generator').default;
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
      if(init?.type==='CallExpression'&&init.callee?.name==='useCallback')init=init.arguments[0];
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

function makeDb({write={data:[{id:1,user_id:OWN,email:'qa@example.invalid'}],error:null},reload={data:{id:1,user_id:OWN,email:'qa@example.invalid',foto_url:'x'},error:null},upload=async()=>({error:null})}={}){
  const calls={update:null,insert:null,eqs:[],is:null};
  function profileQuery(){
    const q={};
    q.update=(patch)=>{calls.update=patch;return q};
    q.insert=(row)=>{calls.insert=row;return q};
    q.select=()=>q;
    q.eq=(k,v)=>{calls.eqs.push([k,v]);return q};
    q.is=(k,v)=>{calls.is=[k,v];return q};
    q.limit=async()=>write;
    q.maybeSingle=async()=>reload;
    return q;
  }
  return {
    calls,
    client:{
      from:(table)=>table==='clientes'?{update:()=>({eq:async()=>({error:null})})}:profileQuery(),
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

test('handleGuardarFoto real: upload OK/DB 0/error/reload fail no success and preview intact',async()=>{
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

test('handleGuardar real: session change after upload prevents write; reload fail prevents success',async()=>{
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

test('handleGuardar real: successful save rereads same id before state/cache/success',async()=>{
  const db=makeDb({write:{data:[{id:1,user_id:OWN,foto_url:'new'}],error:null},reload:{data:{id:1,user_id:OWN,email:'qa@example.invalid',foto_url:'new'},error:null}});
  const s=makeSandbox(db);const fn=build('handleGuardar',s.proxy);await fn({preventDefault(){}});
  expect(s.state.error).toBeFalsy();expect(s.state.success).toBeTruthy();expect(s.sandbox.setPerfil).toHaveBeenCalledWith(expect.objectContaining({id:1,user_id:OWN}));expect(s.sandbox.refreshJugadorPerfilFromSupabase.mock.calls[0][1].profileRow).toMatchObject({id:1,user_id:OWN});
});
