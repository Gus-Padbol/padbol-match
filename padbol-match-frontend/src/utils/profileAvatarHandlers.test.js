import {uploadProfileAvatar} from './profileAvatarUpload';
const owner='11111111-1111-4111-8111-111111111111';
const file=()=>new File([new Uint8Array(4)],'avatar.png',{type:'image/png'});
function fakeStorage({uploadError=null}={}){
 const upload=jest.fn(async()=>({error:uploadError}));
 const getPublicUrl=jest.fn(path=>({data:{publicUrl:`https://cdn.test/${path}`}}));
 const from=jest.fn(()=>({upload,getPublicUrl}));
 return {storage:{from},upload,getPublicUrl};
}
function fakeProfileRows({legacy=null}={}){
 const rows=new Map(); if(legacy)rows.set('email:'+legacy.email,{...legacy});
 return {
  rows,
  updateByEmail:jest.fn(async(email,patch)=>{
   const key='email:'+email;const row=rows.get(key);if(!row)return {error:{message:'missing'}};Object.assign(row,patch);return {error:null};
  }),
  upsert:jest.fn(async(row)=>{const key='email:'+row.email;const existing=rows.get(key);rows.set(key,{...existing,...row});return {error:null,data:rows.get(key)};}),
  rereadByUserId:jest.fn(async(userId)=>{for(const row of rows.values())if(String(row.user_id)===String(userId))return {data:{...row},error:null};return {data:null,error:null};}),
 };
}
async function handlerPhotoOnly({storage,profiles,existing}){ // MiPerfil.jsx handleGuardarFoto path
 const uploaded=await uploadProfileAvatar({storage,userId:owner,file:file()});
 if(uploaded.error)return {error:uploaded.error,saved:false};
 const url=`${uploaded.publicUrl}?t=1`;
 if(existing){const r=await profiles.updateByEmail(existing.email,{foto_url:url});if(r.error)return {error:r.error,saved:false};}
 else {const r=await profiles.upsert({email:'nuevo@example.invalid',user_id:owner,foto_url:url});if(r.error)return {error:r.error,saved:false};}
 const reread=await profiles.rereadByUserId(owner);
 return {saved:true,url,path:uploaded.path,reread:reread.data};
}
async function handlerSaveProfile({storage,profiles}){ // MiPerfil.jsx save-profile path
 const uploaded=await uploadProfileAvatar({storage,userId:owner,file:file()});
 if(uploaded.error)return {error:uploaded.error,saved:false};
 const url=`${uploaded.publicUrl}?t=2`;
 const r=await profiles.upsert({email:'nuevo@example.invalid',user_id:owner,foto_url:url,nombre:'Nico'});
 if(r.error)return {error:r.error,saved:false};
 const reread=await profiles.rereadByUserId(owner);
 return {saved:true,url,path:uploaded.path,reread:reread.data};
}
test('handleGuardarFoto: upload then update existing row and reread by userId',async()=>{
 const s=fakeStorage();const profiles=fakeProfileRows();profiles.rows.set('email:nico@example.invalid',{email:'nico@example.invalid',user_id:owner,foto_url:null});
 const result=await handlerPhotoOnly({storage:s.storage,profiles,existing:{email:'nico@example.invalid'}});
 expect(result.saved).toBe(true);expect(result.reread.foto_url).toBe(result.url);expect(result.path.startsWith(`${owner}/`)).toBe(true);
});
test('save profile: upload then upsert and reread the last URL',async()=>{
 const s=fakeStorage();const profiles=fakeProfileRows();const result=await handlerSaveProfile({storage:s.storage,profiles});
 expect(result.saved).toBe(true);expect(result.reread.foto_url).toBe(result.url);expect(profiles.upsert).toHaveBeenCalledTimes(1);
});
test('post-upload profile failure leaves an orphan object but reports no success',async()=>{
 const s=fakeStorage();const profiles=fakeProfileRows();profiles.updateByEmail.mockResolvedValue({error:{message:'RLS update denied'}});
 profiles.rows.set('email:nico@example.invalid',{email:'nico@example.invalid',user_id:owner,foto_url:null});
 const result=await handlerPhotoOnly({storage:s.storage,profiles,existing:{email:'nico@example.invalid'}});
 expect(result.saved).toBe(false);expect(result.error.message).toMatch(/RLS/);expect(s.upload).toHaveBeenCalledTimes(1);
 expect(profiles.rows.get('email:nico@example.invalid').foto_url).toBeNull();
});
test('storage error never reaches profile persistence or success',async()=>{
 const s=fakeStorage({uploadError:{message:'new row violates row-level security policy'}});const profiles=fakeProfileRows();
 const result=await handlerSaveProfile({storage:s.storage,profiles});
 expect(result.saved).toBe(false);expect(result.error.message).toMatch(/row-level security/i);
 expect(profiles.upsert).not.toHaveBeenCalled();expect(profiles.rereadByUserId).not.toHaveBeenCalled();
});
