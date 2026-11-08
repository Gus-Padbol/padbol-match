import { supabase } from '../supabaseClient';
import { upsertJugadorPerfilPorSesion } from './upsertJugadorPerfil';
jest.mock('../supabaseClient', () => ({ supabase: {from:jest.fn(),auth:{getSession:jest.fn(async()=>({data:{session:{user:{id:'qa-own'}}}}))}} }));

function queries(responses) {
  const calls=[];
  supabase.from.mockImplementation(table=>{
    const q={table}; calls.push(q);
    const b={select:jest.fn(()=>b),eq:jest.fn((key,value)=>{q[key]=value;return b;}),is:jest.fn((key,value)=>{q.is=[key,value];return b;}),
      update:jest.fn(row=>{q.update=row;return b;}),upsert:jest.fn((row,options)=>{q.upsert=row;q.options=options;return b;}),
      maybeSingle:jest.fn(async()=>responses.shift()),single:jest.fn(async()=>responses.shift())};
    return b;
  });return calls;
}
beforeEach(()=>{jest.clearAllMocks();supabase.auth.getSession.mockResolvedValue({data:{session:{user:{id:'qa-own'}}}});});
test('new authenticated profile saves full sports step with actor/email from session',async()=>{
  const saved={id:1,user_id:'qa-own',email:'qa@example.invalid',deportes_preferidos:['padbol']};
  const calls=queries([{data:null,error:null},{data:null,error:null},{data:saved,error:null}]);
  const result=await upsertJugadorPerfilPorSesion({userId:'qa-own',email:'QA@EXAMPLE.INVALID',row:{nombre:'QA',apellido:'Prueba',pais:'Argentina',fecha_nacimiento:'1990-01-01',genero:'masculino',whatsapp:'+5491199901013',deportes_preferidos:['padbol'],user_id:'forged',email:'other@example.invalid'}});
  expect(result.data).toEqual(saved);expect(result.error).toBeNull();
  expect(calls[2].upsert).toMatchObject({user_id:'qa-own',email:'qa@example.invalid',deportes_preferidos:['padbol'],fecha_nacimiento:'1990-01-01'});
  expect(calls[2].options).toEqual({onConflict:'user_id'});
});
test('retry updates own existing row rather than creating a second player',async()=>{
  const calls=queries([{data:{id:1,user_id:'qa-own',nombre:'QA',apellido:'Prueba'},error:null},{data:{id:1},error:null}]);
  const result=await upsertJugadorPerfilPorSesion({userId:'qa-own',email:'qa@example.invalid',row:{deportes_preferidos:['padbol']}});
  expect(result.error).toBeNull();expect(calls[1].id).toBe(1);expect(calls[1].update.user_id).toBe('qa-own');expect(calls[1].upsert).toBeUndefined();
});
test('conflict-target setup failure is preserved as a server error, not false success',async()=>{
  const err={code:'42P10',message:'there is no unique or exclusion constraint matching the ON CONFLICT specification'};
  const calls=queries([{data:null,error:null},{data:null,error:null},{data:null,error:err}]);
  const result=await upsertJugadorPerfilPorSesion({userId:'qa-own',email:'qa@example.invalid',row:{nombre:'QA'}});
  expect(result.error).toEqual(err);expect(result.data).toBeNull();expect(calls).toHaveLength(3);
});
test('invalid session never writes a profile',async()=>{
  expect((await upsertJugadorPerfilPorSesion({userId:'',email:'qa@example.invalid',row:{}})).error).toBeTruthy();expect(supabase.from).not.toHaveBeenCalled();
});

test('legacy email row updates by id without adopting user_id',async()=>{
  const calls=queries([{data:null,error:null},{data:{id:9,user_id:null,email:'qa@example.invalid',nombre:'Legacy'},error:null},{data:{id:9,user_id:null,email:'qa@example.invalid'},error:null}]);
  const result=await upsertJugadorPerfilPorSesion({userId:'qa-own',email:'qa@example.invalid',row:{nombre:'QA'}});
  expect(result.error).toBeNull();expect(calls[2].id).toBe(9);expect(calls[2].is).toEqual(['user_id',null]);expect(calls[2].email).toBe('qa@example.invalid');expect(calls[2].update.user_id).toBe('qa-own');
});
test('email owned by another UUID is a conflict and never updates/upserts',async()=>{
  const calls=queries([{data:null,error:null},{data:{id:9,user_id:'other-uid',email:'qa@example.invalid'},error:null}]);
  const result=await upsertJugadorPerfilPorSesion({userId:'qa-own',email:'qa@example.invalid',row:{nombre:'QA'}});
  expect(result.error.code).toBe('PROFILE_EMAIL_OTHER_USER');expect(calls).toHaveLength(2);expect(calls[1].update).toBeUndefined();expect(calls[1].upsert).toBeUndefined();
});
test('lookup without explicit guard uses current SDK session and never writes on change',async()=>{
  let finish;let reads=0;
  supabase.from.mockImplementation(()=>{const q={select:()=>q,eq:()=>q,is:()=>q,maybeSingle:()=>{reads+=1;return reads===1?Promise.resolve({data:null,error:null}):new Promise(r=>{finish=r});}};return q;});
  supabase.auth.getSession.mockResolvedValue({data:{session:{user:{id:'other-uid'}}}});
  const pending=upsertJugadorPerfilPorSesion({userId:'qa-own',email:'qa@example.invalid',row:{nombre:'QA'}});
  await Promise.resolve();finish({data:null,error:null});
  const result=await pending;
  expect(result.error.code).toBe('PROFILE_SESSION_CHANGED');expect(result.data).toBeNull();expect(supabase.from).toHaveBeenCalledTimes(2);
});

test('session change after lookup returns explicit error and never writes',async()=>{
  let current=true;let finish;let reads=0;
  supabase.from.mockImplementation(()=>{const q={select:()=>q,eq:()=>q,is:()=>q,maybeSingle:()=>{reads+=1;return reads===1?Promise.resolve({data:null,error:null}):new Promise(r=>{finish=r});}};return q;});
  const pending=upsertJugadorPerfilPorSesion({userId:'qa-own',email:'qa@example.invalid',row:{nombre:'QA'},isCurrent:()=>current});
  await Promise.resolve();current=false;finish({data:null,error:null});
  const result=await pending;
  expect(result.error.code).toBe('PROFILE_SESSION_CHANGED');expect(result.data).toBeNull();expect(supabase.from).toHaveBeenCalledTimes(2);
});