import {fetchHubPhotoSource, saveHubPhotoEdit} from './hubPhotoEditorApi';
const sourceId='ae42ea2e-c955-4574-9b96-23c1b6664fb1';
const target={kind:'deporte',deporte:'padbol',cardKey:'armar_partido'};
const imageUrl='https://example.test/output.jpg';
const frame={version:1,pixels:{x:-100,y:-120,width:1200,height:600},viewport:{width:390,height:844}};
const ok=data=>({ok:true,json:async()=>data});
const meta={source_id:sourceId,frame,image_url:imageUrl,original_url:`/api/admin/hub-images/source/${sourceId}/original`,original:{width:900,height:600,mime:'image/jpeg'}};

test('reopen fetches a protected original, never the published crop or an arbitrary original URL', async()=>{
 const original=new Blob(['source'],{type:'image/jpeg'});
 const fetchImpl=jest.fn().mockResolvedValueOnce(ok(meta)).mockResolvedValueOnce({ok:true,blob:async()=>original});
 const result=await fetchHubPhotoSource({apiBaseUrl:'https://api.example.test/',accessToken:'test-session',target,expectedImageUrl:imageUrl,fetchImpl});
 expect(result.original).toBe(original);expect(result.frame).toEqual(frame);
 expect(fetchImpl.mock.calls[1]).toEqual([`https://api.example.test/api/admin/hub-images/source/${sourceId}/original`,{headers:{Authorization:'Bearer test-session'},cache:'no-store'}]);
 const bad=jest.fn().mockResolvedValueOnce(ok({...meta,original_url:'https://evil.example.test/steal'}));
 await expect(fetchHubPhotoSource({apiBaseUrl:'https://api.example.test',accessToken:'test-session',target,fetchImpl:bad})).rejects.toThrow('original válido');expect(bad).toHaveBeenCalledTimes(1);
});

test('old photo without an original and source failures never fall back to cropping the crop', async()=>{
 const fetchImpl=jest.fn().mockResolvedValue({ok:false,status:404,json:async()=>({code:'SOURCE_NOT_AVAILABLE'})});
 await expect(fetchHubPhotoSource({apiBaseUrl:'https://api.example.test',accessToken:'test-session',target,fetchImpl})).rejects.toThrow('Elige la foto original');expect(fetchImpl).toHaveBeenCalledTimes(1);
 await expect(fetchHubPhotoSource({apiBaseUrl:'https://api.example.test',target,fetchImpl})).rejects.toThrow('Inicia sesión');expect(fetchImpl).toHaveBeenCalledTimes(1);
});

test('save sends final+original first time, then source_id when reframing; negative margins preserved', async()=>{
 const photo=new File(['crop'],'output.jpg',{type:'image/jpeg'}),original=new File(['source'],'original.jpg',{type:'image/jpeg'});
 const fetchImpl=jest.fn().mockResolvedValue(ok({row:{deporte:'padbol',card_key:'armar_partido',imagen_url:imageUrl},source_id:sourceId,image_url:imageUrl,frame}));
 await saveHubPhotoEdit({apiBaseUrl:'https://api.example.test',accessToken:'test-session',target,photo,original,frame,fetchImpl});
 const first=fetchImpl.mock.calls[0][1];expect(first.body.get('original')).toBe(original);expect(first.body.get('foto')).toBe(photo);expect(JSON.parse(first.body.get('frame'))).toEqual(frame);expect(first.headers['Content-Type']).toBeUndefined();expect(first.body.get('expected_image_url')).toBe('null');
 await saveHubPhotoEdit({apiBaseUrl:'https://api.example.test',accessToken:'test-session',target,photo,sourceId,frame,expectedImageUrl:imageUrl,fetchImpl});
 const second=fetchImpl.mock.calls[1][1];expect(second.body.get('source_id')).toBe(sourceId);expect(second.body.get('original')).toBeNull();expect(JSON.parse(second.body.get('expected_image_url'))).toBe(imageUrl);
});

test('a newer publication is reported as a conflict, without automatic retry',async()=>{const fetchImpl=jest.fn().mockResolvedValue({ok:false,status:409,json:async()=>({code:'HUB_IMAGE_CHANGED'})});await expect(saveHubPhotoEdit({apiBaseUrl:'https://api.example.test',accessToken:'test-session',target,photo:new File(['crop'],'output.jpg',{type:'image/jpeg'}),sourceId,frame,expectedImageUrl:imageUrl,fetchImpl})).rejects.toThrow('La foto cambió');expect(fetchImpl).toHaveBeenCalledTimes(1);});
