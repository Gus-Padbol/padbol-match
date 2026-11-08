import { uploadProfileAvatar } from './profileAvatarUpload';
import { updateOwnProfileRow, insertOwnProfileRow } from './canonicalProfile';

const OWN='11111111-1111-4111-8111-111111111111';
const row={id:4,user_id:OWN,email:'actual@example.invalid',foto_url:'https://old.example/a.png'};
const file=()=>new File([new Uint8Array(4)],'avatar.png',{type:'image/png'});

function storage(){
  const upload=jest.fn(async()=>({error:null}));
  const getPublicUrl=jest.fn((path)=>({data:{publicUrl:`https://qa.example/${path}`}}));
  return {client:{from:()=>({upload,getPublicUrl})},upload,getPublicUrl};
}
function failingUpdate(){
  const error={code:'42501',message:'new row violates row-level security policy'};
  const query={
    update:jest.fn(()=>query),eq:jest.fn(()=>query),is:jest.fn(()=>query),
    select:jest.fn(()=>query),limit:jest.fn(async()=>({data:null,error})),
  };
  return {client:{from:()=>query},query};
}

test.each([
  ['photo-only', {foto_url:'https://qa.example/new'}],
  ['full-profile', {nombre:'Nico',foto_url:'https://qa.example/new'}],
])('%s caller: upload OK + DB error leaves preview intact and no success',async(_name,patch)=>{
  const s=storage(); const db=failingUpdate(); let preview='blob:avatar'; let success=false;
  const uploaded=await uploadProfileAvatar({storage:s.client,userId:OWN,file:file()});
  expect(uploaded.error).toBeUndefined();
  const saved=await updateOwnProfileRow({supabase:db.client,row,userId:OWN,email:row.email,patch:{...patch,foto_url:uploaded.publicUrl}});
  expect(saved.error).toBeTruthy();expect(saved.data).toBeNull();
  if(!saved.error) success=true;
  expect(success).toBe(false);expect(preview).toBe('blob:avatar');
});

test('new-row insert conflict after upload is reported and never email-upserted',async()=>{
  const s=storage();
  const error={code:'23505',message:'duplicate key value violates unique constraint'};
  const query={insert:jest.fn(()=>query),select:jest.fn(()=>query),limit:jest.fn(async()=>({data:null,error}))};
  const uploaded=await uploadProfileAvatar({storage:s.client,userId:OWN,file:file()});
  expect(uploaded.error).toBeUndefined();
  const saved=await insertOwnProfileRow({supabase:{from:()=>query},userId:OWN,payload:{email:row.email,foto_url:uploaded.publicUrl}});
  expect(saved.error).toBe(error);expect(saved.data).toBeNull();expect(query.insert).toHaveBeenCalledTimes(1);
});
