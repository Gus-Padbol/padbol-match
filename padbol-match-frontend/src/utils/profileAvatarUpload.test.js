import {uploadProfileAvatar} from './profileAvatarUpload';
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const file=(name='photo.png',type='image/png',size=5)=>new File([new Uint8Array(size)],name,{type});
function storage({error=null}={}){
 const upload=jest.fn(async()=>({error}));
 const getPublicUrl=jest.fn(path=>({data:{publicUrl:`https://cdn.test/avatars/${path}`}}));
 const from=jest.fn(()=>({upload,getPublicUrl}));
 return {client:{from},upload,getPublicUrl,from};
}
test('successful upload uses my own folder, unique name and returns the public URL',async()=>{
 const s=storage();const profile={foto_url:null};
 const result=await uploadProfileAvatar({storage:s.client,userId:owner,file:file()});
 expect(result.error).toBeUndefined();
 expect(result.path.startsWith(`${owner}/avatar-`)).toBe(true);
 expect(result.publicUrl).toContain(result.path);
 expect(s.upload).toHaveBeenCalledTimes(1);
 const options=s.upload.mock.calls[0][2];
 expect(options).toEqual({contentType:'image/png'});
 expect(options.upsert).toBeUndefined();
 profile.foto_url=result.publicUrl;
 expect(profile.foto_url).toBe(result.publicUrl);
});
test('a different user folder is rejected client-side before storage',async()=>{
 const s=storage();
 const result=await uploadProfileAvatar({storage:s.client,userId:other,authUserId:owner,file:file()});
 expect(result.error).toBeDefined();
 expect(s.upload).not.toHaveBeenCalled();
 expect(s.from).not.toHaveBeenCalled();
});
test('RLS or 413 storage errors are returned without a success URL',async()=>{
 const s=storage({error:{message:'new row violates row-level security policy',statusCode:'413'}});
 const result=await uploadProfileAvatar({storage:s.client,userId:owner,file:file()});
 expect(result.error.message).toMatch(/row-level security/i);
 expect(result.publicUrl).toBeUndefined();
 expect(s.getPublicUrl).not.toHaveBeenCalled();
});
test('two uploads for the same user get distinct paths and the profile keeps the last URL',async()=>{
 const s=storage();const first=await uploadProfileAvatar({storage:s.client,userId:owner,file:file()});
 const second=await uploadProfileAvatar({storage:s.client,userId:owner,file:file()});
 expect(first.path).not.toBe(second.path);
 const profile={foto_url:second.publicUrl};
 expect(profile.foto_url).toBe(second.publicUrl);
 expect(profile.foto_url).not.toBe(first.publicUrl);
 expect(s.upload).toHaveBeenCalledTimes(2);
 for(const call of s.upload.mock.calls)expect(call[2].upsert).toBeUndefined();
});
test('upload never calls a SELECT/download path: only INSERT upload and public URL',async()=>{
 const s=storage();
 const bucket={upload:s.upload,getPublicUrl:s.getPublicUrl};
 const from=jest.fn(()=>bucket);
 await uploadProfileAvatar({storage:{from},userId:owner,file:file()});
 expect(from).toHaveBeenCalledWith('avatars');
 expect(s.upload).toHaveBeenCalledTimes(1);
 expect(s.getPublicUrl).toHaveBeenCalledTimes(1);
 expect(Object.keys(bucket)).toEqual(['upload','getPublicUrl']);
});
test('rejects non-image and oversized files before storage',async()=>{
 const s=storage();
 const badType=await uploadProfileAvatar({storage:s.client,userId:owner,file:file('a.txt','text/plain')});
 const tooBig=await uploadProfileAvatar({storage:s.client,userId:owner,file:file('big.png','image/png',2*1024*1024+1)});
 expect(badType.error).toBeDefined();expect(tooBig.error).toBeDefined();expect(s.upload).not.toHaveBeenCalled();
});
