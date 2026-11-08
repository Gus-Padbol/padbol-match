import {
  loadCanonicalProfile,
  resolveCanonicalProfileRow,
  updateOwnProfileRow,
  insertOwnProfileRow,
  reloadOwnProfile,
} from './canonicalProfile';

const OWN='11111111-1111-4111-8111-111111111111';
const OTHER='22222222-2222-4222-8222-222222222222';
const profile=(overrides={})=>({id:1,user_id:OWN,email:'actual@example.invalid',...overrides});

function fakeSupabase({maybe=[], writes=[]}={}){
  const calls=[]; let mi=0,wi=0;
  const from=jest.fn((table)=>{
    const call={table,eqs:[],is:null}; calls.push(call);
    const b={
      select:jest.fn((cols)=>{call.select=cols;return b;}),
      eq:jest.fn((k,v)=>{call.eqs.push([k,v]);return b;}),
      is:jest.fn((k,v)=>{call.is=[k,v];return b;}),
      update:jest.fn((patch)=>{call.update=patch;return b;}),
      insert:jest.fn((row)=>{call.insert=row;return b;}),
      maybeSingle:jest.fn(async()=>maybe[mi++]??{data:null,error:null}),
      single:jest.fn(async()=>writes[wi++]??{data:null,error:null}),
      limit:jest.fn(async()=>writes[wi++]??{data:null,error:null}),
    };
    return b;
  });
  return {client:{from},calls};
}

test('UUID row is authoritative even when its email differs',async()=>{
  const f=fakeSupabase({maybe:[{data:profile(),error:null}]});
  const result=await loadCanonicalProfile({supabase:f.client,userId:OWN,email:'otro@example.invalid'});
  expect(result.row.user_id).toBe(OWN);expect(result.source).toBe('user_id');
  expect(f.calls).toHaveLength(1);expect(f.calls[0].eqs).toContainEqual(['user_id',OWN]);
});

test('legacy NULL row is used only as email fallback when no UUID row exists',async()=>{
  const legacy={id:7,user_id:null,email:'actual@example.invalid'};
  const f=fakeSupabase({maybe:[{data:null,error:null},{data:legacy,error:null}]});
  const result=await loadCanonicalProfile({supabase:f.client,userId:OWN,email:'actual@example.invalid'});
  expect(result.row).toEqual(legacy);expect(result.source).toBe('email_fallback');
  expect(f.calls).toHaveLength(2);expect(f.calls[1].is).toEqual(['user_id',null]);
});

test('email of another UUID is a conflict, never absence/fallback',async()=>{
  const f=fakeSupabase({maybe:[{data:null,error:null},{data:profile({user_id:OTHER}),error:null}]});
  await expect(loadCanonicalProfile({supabase:f.client,userId:OWN,email:'actual@example.invalid'}))
    .rejects.toMatchObject({code:'PROFILE_EMAIL_OTHER_USER'});
});

test('email row already owned by this UUID is not accepted as fallback',async()=>{
  const f=fakeSupabase({maybe:[{data:null,error:null},{data:profile({user_id:OWN}),error:null}]});
  await expect(loadCanonicalProfile({supabase:f.client,userId:OWN,email:'actual@example.invalid'}))
    .rejects.toMatchObject({code:'PROFILE_EMAIL_OTHER_USER'});
});

test('a UUID row plus a legacy email row still resolves the UUID row',async()=>{
  const f=fakeSupabase({maybe:[{data:profile(),error:null}]});
  const result=await loadCanonicalProfile({supabase:f.client,userId:OWN,email:'actual@example.invalid'});
  expect(result.row.user_id).toBe(OWN);expect(f.calls).toHaveLength(1);
});

test('DB error or multiple-row error is not treated as absent',async()=>{
  const err={code:'DB_DOWN',message:'down'};
  const f=fakeSupabase({maybe:[{data:null,error:err}]});
  await expect(loadCanonicalProfile({supabase:f.client,userId:OWN,email:'actual@example.invalid'})).rejects.toBe(err);
  expect(f.calls).toHaveLength(1);
});

test('pure resolver rejects a foreign row returned for the UUID lookup',()=>{
  expect(()=>resolveCanonicalProfileRow({userId:OWN,byUserId:{data:profile({user_id:OTHER})}}))
    .toThrow(expect.objectContaining({code:'PROFILE_UUID_MISMATCH'}));
});

test('update uses id plus UUID ownership and requires exactly one row',async()=>{
  const f=fakeSupabase({writes:[{data:[profile({foto_url:'x'})],error:null}]});
  const result=await updateOwnProfileRow({supabase:f.client,row:profile(),userId:OWN,email:'actual@example.invalid',patch:{foto_url:'x'}});
  expect(result.error).toBeNull();expect(result.data.foto_url).toBe('x');
  expect(f.calls[0].eqs).toContainEqual(['id',1]);
  expect(f.calls[0].eqs).toContainEqual(['user_id',OWN]);
  expect(f.calls[0].select).toBe('*');
});

test('update confirmed legacy own row links NULL to UUID under id+NULL+email',async()=>{
  const f=fakeSupabase({writes:[{data:[{id:7,user_id:OWN,foto_url:'x'}],error:null}]});
  const row={id:7,user_id:null,email:'actual@example.invalid'};
  const result=await updateOwnProfileRow({supabase:f.client,row,userId:OWN,email:'actual@example.invalid',patch:{foto_url:'x'}});
  expect(result.error).toBeNull();expect(f.calls[0].is).toEqual(['user_id',null]);
  expect(f.calls[0].eqs).toContainEqual(['email','actual@example.invalid']);
  expect(f.calls[0].update).toMatchObject({foto_url:'x',user_id:OWN});
});

test('legacy concurrency/RLS returns 0 or foreign row and does not claim success',async()=>{
  for(const data of [[],[{id:7,user_id:OTHER,foto_url:'x'}]]){
    const f=fakeSupabase({writes:[{data,error:null}]});
    const row={id:7,user_id:null,email:'actual@example.invalid'};
    const result=await updateOwnProfileRow({supabase:f.client,row,userId:OWN,email:'actual@example.invalid',patch:{foto_url:'x'}});
    expect(result.error).toBeTruthy();expect(result.data).toBeNull();
  }
});

test('update with 0 or 2 affected rows returns an explicit error',async()=>{
  for(const data of [[],[profile(),profile({id:2})]]){
    const f=fakeSupabase({writes:[{data,error:null}]});
    const result=await updateOwnProfileRow({supabase:f.client,row:profile(),userId:OWN,email:'actual@example.invalid',patch:{foto_url:'x'}});
    expect(result.error.code).toBe('PROFILE_ROW_COUNT');
  }
});

test('insert conflict is surfaced and never retried by email upsert',async()=>{
  const conflict={code:'23505',message:'duplicate key value violates unique constraint'};
  const f=fakeSupabase({writes:[{data:null,error:conflict}]});
  const result=await insertOwnProfileRow({supabase:f.client,userId:OWN,payload:{email:'actual@example.invalid'}});
  expect(result.error).toBe(conflict);expect(f.calls).toHaveLength(1);
  expect(f.calls[0].insert).toMatchObject({user_id:OWN,email:'actual@example.invalid'});
});

test('reload reads expected id+UUID ownership and reports zero rows',async()=>{
  const f=fakeSupabase({maybe:[{data:profile({id:9}),error:null},{data:null,error:null}]});
  const ok=await reloadOwnProfile({supabase:f.client,userId:OWN,expectedId:9});
  expect(ok.data.id).toBe(9);
  expect(f.calls[0].eqs).toContainEqual(['id',9]);expect(f.calls[0].eqs).toContainEqual(['user_id',OWN]);
  const zero=await reloadOwnProfile({supabase:f.client,userId:OWN,expectedId:9});
  expect(zero.error.code).toBe('PROFILE_ROW_ZERO');
});
