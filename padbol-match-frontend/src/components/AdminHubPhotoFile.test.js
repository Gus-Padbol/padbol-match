import {validateHubImageFile} from './AdminHubPersonalizarSection';
const jpg=new Uint8Array([0xFF,0xD8,0xFF,0xE0,0,0,0,0]);
const png=new Uint8Array([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]);
test('real JPG and PNG signatures pass, including empty MIME with valid extension',async()=>{
 expect(await validateHubImageFile(new File([jpg],'foto.jpg',{type:'image/jpeg'}))).toMatchObject({ok:true});
 expect(await validateHubImageFile(new File([png],'foto.png',{type:'image/png'}))).toMatchObject({ok:true});
 expect(await validateHubImageFile(new File([png],'foto.png',{type:''}))).toMatchObject({ok:true});
});
test('invalid MIME, empty extension and invalid payload fail closed',async()=>{
 expect((await validateHubImageFile(new File([jpg],'foto.heic',{type:'image/heic'}))).code).toBe('INVALID_TYPE');
 expect((await validateHubImageFile(new File([jpg],'foto',{type:''}))).code).toBe('INVALID_EXTENSION');
 expect((await validateHubImageFile(new File(['not-an-image'],'foto.jpg',{type:'image/jpeg'}))).code).toBe('DECODE_FAILED');
 expect((await validateHubImageFile(new File([],'foto.jpg',{type:'image/jpeg'}))).code).toBe('EMPTY_FILE');
});
