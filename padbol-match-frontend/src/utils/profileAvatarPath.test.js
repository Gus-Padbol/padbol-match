import {profileAvatarPath} from './profileAvatarPath';
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
test('the first storage folder matches auth.uid, as required by the deployed avatars policy',()=>{
 const path=profileAvatarPath(owner,'image.jpg',123);
 expect(path.split('/')[0]).toBe(owner);
 expect(path.split('/')[0]).not.toBe('perfil');
 expect(path.split('/')[0]).not.toBe(other);
});
test.each(['','../other',owner+'/other','not-a-user'])('rejects invalid owner %s before upload',value=>expect(()=>profileAvatarPath(value,'photo.jpg')).toThrow());
test('a filename cannot inject folders or traversal into the generated path',()=>expect(profileAvatarPath(owner,'../../another.png',123)).toBe(`${owner}/123.png`));
